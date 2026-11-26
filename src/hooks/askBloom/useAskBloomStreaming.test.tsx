import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildTaskPlanFromDetectedTextPlan,
  MISSING_SEND_MODE_MESSAGE,
  useAskBloomStreaming,
} from "@/hooks/askBloom/useAskBloomStreaming";
import type { BloomMessage } from "@/hooks/bloom/types";
import {
  bloomMessagesQueryKey,
  type BloomMessagesPage,
} from "@/hooks/bloom/useBloomMessages";

const streamMocks = vi.hoisted(() => ({
  fetchBloomMessagesPage: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    session: { access_token: "synthetic-token", user: { id: "user-1" } },
  }),
}));
vi.mock("@/hooks/bloom/types", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/bloom/types")>()),
  bloomSupabase: {
    from: () => ({ insert: async () => ({ error: null }) }),
  },
}));
vi.mock("@/hooks/bloom/useBloomMessages", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/bloom/useBloomMessages")>()),
  fetchBloomMessagesPage: streamMocks.fetchBloomMessagesPage,
}));
vi.mock("@/lib/bloomSupport/api", () => ({
  bloomChatClientContext: () => null,
}));

const CAMPAIGN_ID = "55555555-5555-4555-8555-555555555555";

const planFor = (params: Record<string, string>) =>
  buildTaskPlanFromDetectedTextPlan(
    {
      title: "Send the spring newsletter",
      resourceType: "campaign",
      steps: [{ action: "Send campaign", params }],
    },
    "assistant-message-1",
  );

describe("Ask Bloom text-plan send_mode", () => {
  it("never defaults a missing send_mode to now; the task is blocked with a question", () => {
    const [task] = planFor({ "Campaign ID": CAMPAIGN_ID }).tasks;

    expect(task.toolName).toBe("send_campaign");
    expect(task.toolParams).not.toHaveProperty("send_mode");
    expect(task.toolParams).not.toHaveProperty("scheduled_at");
    expect(task.validationAnnotations).toEqual([
      { type: "error", message: MISSING_SEND_MODE_MESSAGE, step: "send_mode" },
    ]);
  });

  it("keeps an explicit send_mode and does not block the task", () => {
    const [task] = planFor({
      "Campaign ID": CAMPAIGN_ID,
      "Send Mode": "now",
    }).tasks;

    expect(task.toolParams.send_mode).toBe("now");
    expect(task.validationAnnotations).toEqual([]);
  });
});

const CONVERSATION_ID = "00000000-0000-4000-8000-0000000000aa";

const persistedMessage = (
  id: string,
  role: BloomMessage["role"],
  text: string,
): BloomMessage => ({
  id,
  conversationId: CONVERSATION_ID,
  role,
  text,
  thinkingContent: null,
  blockData: {},
  mode: "standard",
  model: null,
  tokensInput: null,
  tokensOutput: null,
  attachments: [],
  followUpChips: [],
  isBookmarked: false,
  isCompacted: false,
  metadata: {},
  createdAt: "2026-11-26T10:00:00.000Z",
});

/** A bloom-assist SSE response the test writes to, event by event. */
function controllableSseResponse() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const body = new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController;
    },
  });
  return {
    response: new Response(body, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    }),
    send(event: string, data: unknown) {
      controller?.enqueue(
        encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
      );
    },
    close() {
      controller?.close();
    },
  };
}

const cachedMessages = (queryClient: QueryClient) =>
  queryClient
    .getQueryData<{ pages: BloomMessagesPage[] }>(
      bloomMessagesQueryKey(CONVERSATION_ID),
    )
    ?.pages.flatMap((page) => page.messages) ?? [];

describe("Bloom reply that outlives the page that asked", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    streamMocks.fetchBloomMessagesPage.mockReset();
  });

  it("keeps streaming into the shared message cache after /bloom unmounts", async () => {
    const sse = controllableSseResponse();
    let requestSignal: AbortSignal | null = null;
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      requestSignal = init?.signal ?? null;
      return sse.response;
    });
    vi.stubGlobal("fetch", fetchMock);
    streamMocks.fetchBloomMessagesPage.mockResolvedValue({
      messages: [
        persistedMessage("user-1", "user", "How did the Spring Sale do?"),
        persistedMessage("assistant-1", "assistant", "Spring Sale opened 42%."),
      ],
      nextCursor: null,
    } satisfies BloomMessagesPage);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result, unmount } = renderHook(
      () =>
        useAskBloomStreaming({
          messageStore: "bloomMessageCache",
          tenantId: "tenant-1",
        }),
      { wrapper },
    );

    act(() => {
      result.current.sendMessage("How did the Spring Sale do?", {
        conversationId: CONVERSATION_ID,
        pageContext: null,
      });
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    sse.send("token", { text: "Spring Sale " });
    await waitFor(() => expect(result.current.streamingContent).toBe("Spring Sale "));

    // The user navigates away from /bloom mid-reply.
    unmount();
    expect(requestSignal?.aborted).toBe(false);

    sse.send("token", { text: "opened 42%." });
    await waitFor(() =>
      expect(
        cachedMessages(queryClient).find((message) =>
          message.id.startsWith("streaming-"),
        )?.text,
      ).toBe("Spring Sale opened 42%."),
    );

    sse.send("done", { conversation_id: CONVERSATION_ID, follow_up_chips: [] });
    sse.close();
    await waitFor(() =>
      expect(cachedMessages(queryClient).map((message) => message.id)).toEqual([
        "user-1",
        "assistant-1",
      ]),
    );
    expect(requestSignal?.aborted).toBe(false);
  });

  it("still stops the drawer's local stream when its provider goes away", async () => {
    let requestSignal: AbortSignal | null = null;
    const sse = controllableSseResponse();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        requestSignal = init?.signal ?? null;
        return sse.response;
      }),
    );
    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result, unmount } = renderHook(
      () => useAskBloomStreaming({ conversationId: CONVERSATION_ID }),
      { wrapper },
    );

    act(() => {
      result.current.sendMessage("Hello", { pageContext: null });
    });
    await waitFor(() => expect(requestSignal).not.toBeNull());
    unmount();
    expect(requestSignal?.aborted).toBe(true);
  });
});
