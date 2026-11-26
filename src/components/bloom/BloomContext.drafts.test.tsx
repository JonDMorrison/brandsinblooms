import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BloomProvider, useBloom } from "@/components/bloom/BloomContext";

const EMPTY: never[] = [];

vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({ tenant: { id: "tenant-1" }, loading: false }),
}));
vi.mock("@/hooks/bloom/useBloomConversations", () => ({
  bloomConversationsQueryBaseKey: (tenantId: string | null) => [
    "bloom-conversations",
    tenantId,
  ],
  useBloomConversations: () => ({ data: EMPTY, isLoading: false, error: null }),
}));
vi.mock("@/hooks/bloom/useBloomMessages", () => ({
  useBloomMessages: () => ({
    data: EMPTY,
    isLoading: false,
    error: null,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  }),
}));
vi.mock("@/hooks/bloom/useBloomConversationMutations", () => ({
  useBloomConversationMutations: () => ({
    createConversation: vi.fn(async () => "conversation-new"),
  }),
}));
vi.mock("@/hooks/bloom/useBloomMessageMutations", () => ({
  useBloomMessageMutations: () => ({}),
}));
vi.mock("@/hooks/bloom/useBloomModelPreference", () => ({
  useBloomModelPreference: () => ({
    modelPreference: "auto",
    setModelPreference: vi.fn(),
  }),
}));
vi.mock("@/hooks/bloom/useBloomProfile", () => ({
  useBloomProfile: () => ({ data: undefined }),
}));
vi.mock("@/hooks/bloom/useBloomEntitySummary", () => ({
  useBloomEntitySummary: () => ({ data: null, isLoading: false }),
}));
vi.mock("@/hooks/askBloom/useAskBloomStreaming", () => ({
  useAskBloomStreaming: () => ({
    sendMessage: vi.fn(),
    cancelStream: vi.fn(),
    isStreaming: false,
    connectionState: "idle",
    streamingContent: "",
    streamingThinking: "",
    activeToolCall: null,
    streamError: null,
    streamingBlocks: EMPTY,
    researchPlan: { totalSteps: 0, stepLabels: [] },
    researchSteps: new Map(),
    researchConversationId: null,
    isResearchSynthesizing: false,
    isResearchComplete: false,
    pendingTaskPlan: null,
    dismissPendingTaskPlan: vi.fn(),
  }),
}));

let bloom: ReturnType<typeof useBloom> | null = null;
let navigateTo: ((path: string) => void) | null = null;

function DraftProbe() {
  bloom = useBloom();
  navigateTo = useNavigate();
  return <output data-testid="draft">{bloom.composerDraft}</output>;
}

function mount(path: string) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/bloom"
            element={
              <BloomProvider>
                <DraftProbe />
              </BloomProvider>
            }
          />
          <Route
            path="/bloom/:chatId"
            element={
              <BloomProvider>
                <DraftProbe />
              </BloomProvider>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  bloom = null;
  navigateTo = null;
});

describe("/bloom composer drafts", () => {
  it("keeps each conversation's draft to itself", () => {
    mount("/bloom/conversation-1");
    act(() => bloom?.setComposerDraft("Explain the Spring Sale results"));
    expect(screen.getByTestId("draft")).toHaveTextContent(
      "Explain the Spring Sale results",
    );

    act(() => navigateTo?.("/bloom/conversation-2"));
    expect(screen.getByTestId("draft")).toBeEmptyDOMElement();
    act(() => bloom?.setComposerDraft("Compare my VIP segments"));

    act(() => navigateTo?.("/bloom/conversation-1"));
    expect(screen.getByTestId("draft")).toHaveTextContent(
      "Explain the Spring Sale results",
    );
  });

  it("clears only the draft a stale setter was bound to", () => {
    mount("/bloom/conversation-1");
    act(() => bloom?.setComposerDraft("Draft a thank-you email"));
    const setConversationOneDraft = bloom?.setComposerDraft;

    act(() => navigateTo?.("/bloom/conversation-2"));
    act(() => bloom?.setComposerDraft("Keep this one"));
    // The composer clears the draft it sent from, after the send moved on.
    act(() => setConversationOneDraft?.(""));
    expect(screen.getByTestId("draft")).toHaveTextContent("Keep this one");

    act(() => navigateTo?.("/bloom/conversation-1"));
    expect(screen.getByTestId("draft")).toBeEmptyDOMElement();
  });
});
