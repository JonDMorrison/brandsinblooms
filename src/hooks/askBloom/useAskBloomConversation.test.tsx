import * as React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { useAskBloomConversation } from "@/hooks/askBloom/useAskBloomConversation";
import type { BloomMessage } from "@/hooks/bloom/types";
import {
  bloomMessagesQueryKey,
  type BloomMessagesPage,
} from "@/hooks/bloom/useBloomMessages";

const CONVERSATION_ID = "11111111-1111-4111-8111-111111111111";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({ tenant: { id: "tenant-1" }, loading: false }),
}));

const conversationRow = {
  id: CONVERSATION_ID,
  tenant_id: "tenant-1",
  user_id: "user-1",
  title: "Best customers",
  status: "active",
  mode: "standard",
  metadata: {},
  message_count: 2,
  last_message_preview: "Here are your best customers",
  session_type: "standard",
  resource_type: null,
  resource_id: null,
  created_at: "2026-11-26T10:00:00.000Z",
  updated_at: "2026-11-26T10:01:00.000Z",
};

vi.mock("@/integrations/supabase/client", () => {
  const conversationQuery = {
    eq: () => conversationQuery,
    maybeSingle: () => Promise.resolve({ data: conversationRow, error: null }),
  };
  return {
    supabase: {
      from: (table: string) => {
        if (table !== "bloom_conversations") {
          throw new Error(`The drawer must not read ${table} directly.`);
        }
        return { select: () => conversationQuery };
      },
    },
  };
});

const bloomMessage = (
  overrides: Partial<BloomMessage> & Pick<BloomMessage, "id" | "role" | "text">,
): BloomMessage => ({
  conversationId: CONVERSATION_ID,
  thinkingContent: null,
  blockData: null,
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
  toolExecutions: [],
  ...overrides,
});

describe("useAskBloomConversation", () => {
  it("reads a conversation's messages from the Bloom message cache /bloom uses", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    // What /bloom has in its cache for this conversation.
    queryClient.setQueryData<{
      pages: BloomMessagesPage[];
      pageParams: Array<string | null>;
    }>(bloomMessagesQueryKey(CONVERSATION_ID), {
      pages: [
        {
          messages: [
            bloomMessage({
              id: "user-message",
              role: "user",
              text: "Who are my best customers?",
            }),
            bloomMessage({
              id: "assistant-message",
              role: "assistant",
              text: "Here are your best customers.",
              followUpChips: ["Email them"],
              createdAt: "2026-11-26T10:00:05.000Z",
            }),
          ],
          nextCursor: null,
        },
      ],
      pageParams: [null],
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(
      () =>
        useAskBloomConversation({
          conversationId: CONVERSATION_ID,
          resourceType: null,
          resourceId: null,
          enabled: true,
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    expect(result.current.conversation?.id).toBe(CONVERSATION_ID);
    expect(result.current.messages.map((message) => message.id)).toEqual([
      "user-message",
      "assistant-message",
    ]);
    expect(result.current.messages[1]).toMatchObject({
      role: "assistant",
      content: "Here are your best customers.",
    });
    expect(
      result.current.messages[1].blocks.find(
        (block) => block.type === "suggestion_chips",
      )?.data,
    ).toEqual({ suggestions: ["Email them"] });
  });
});
