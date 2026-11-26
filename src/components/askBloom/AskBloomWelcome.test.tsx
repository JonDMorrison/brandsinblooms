import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AskBloomConversationArea } from "@/components/askBloom/AskBloomConversationArea";
import AskBloomInput from "@/components/askBloom/AskBloomInput";
import type { AskBloomMessage, AskBloomState, ResourceFocus } from "@/types/askBloom";

const askBloomMock = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  state: null as AskBloomState | null,
}));

vi.mock("@/providers/AskBloomProvider", () => ({
  useAskBloom: () => ({
    state: askBloomMock.state,
    sendMessage: askBloomMock.sendMessage,
    cancelStream: vi.fn(),
    retryStream: vi.fn(),
    keepPartialResponse: vi.fn(),
    newConversation: vi.fn(),
    clearResourceFocus: vi.fn(),
    pinConversation: vi.fn(),
    unpinConversation: vi.fn(),
    acceptNavigationPrompt: vi.fn(),
    dismissNavigationPrompt: vi.fn(),
    presentResourceForm: vi.fn(),
  }),
}));

vi.mock("@/hooks/askBloom/useAskBloomInsights", () => ({
  useAskBloomInsights: () => ({ insights: [], isLoading: false }),
}));

vi.mock("@/hooks/bloom/useBloomFileUpload", () => ({
  useBloomFileUpload: () => ({
    addFiles: vi.fn(),
    attachments: [],
    clearFiles: vi.fn(),
    files: [],
    hasUnreadyFiles: false,
    isUploading: false,
    removeFile: vi.fn(),
    retryFile: vi.fn(),
  }),
}));

vi.mock("@/hooks/bloom/useBloomVoiceInput", () => ({
  useBloomVoiceInput: () => ({
    analyserNode: null,
    error: null,
    interimTranscript: "",
    isListening: false,
    isSupported: false,
    resetTranscript: vi.fn(),
    startListening: vi.fn(),
    stopListening: vi.fn(),
    transcript: "",
  }),
}));

const buildState = (overrides: Partial<AskBloomState> = {}): AskBloomState => ({
  isOpen: true,
  panelWidth: 400,
  isCollapsed: false,
  resourceFocus: null,
  contextUpdatedToken: 0,
  navigationPrompt: null,
  conversationId: null,
  messages: [],
  pendingTaskPlan: null,
  executingPlanIds: new Set<string>(),
  taskStatusesByPlan: {},
  completionSummaries: {},
  planDecisions: {},
  pendingResourceForm: null,
  restoredFormValues: null,
  isStreaming: false,
  isTransitioning: false,
  isSendingMessage: false,
  isLoadingConversation: false,
  isPinned: false,
  thinkingContent: null,
  activeToolCall: null,
  streamingBlocks: [],
  streamError: null,
  ...overrides,
});

const customerFocus: ResourceFocus = {
  resourceType: "customer",
  resourceId: "customer-1",
  resourceLabel: "Jane Gardener",
  resourceSummary: "Loyal spring shopper",
  sourceRoute: "/crm/customers/customer-1",
  fetchedAt: "2026-11-18T00:00:00.000Z",
};

const renderConversationArea = () =>
  render(
    <MemoryRouter>
      <AskBloomConversationArea />
    </MemoryRouter>,
  );

const mockComposerWidth = (width: number) =>
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width,
    height: 120,
    top: 0,
    left: 0,
    right: width,
    bottom: 120,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });

const renderInput = () =>
  render(
    <MemoryRouter>
      <AskBloomInput />
    </MemoryRouter>,
  );

beforeAll(() => {
  // jsdom does not implement scrollIntoView; the conversation area auto-scrolls.
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
    writable: true,
  });
});

beforeEach(() => {
  vi.restoreAllMocks();
  askBloomMock.sendMessage.mockReset();
  askBloomMock.state = buildState();
});

describe("Ask Bloom welcome state", () => {
  it("shows the store guide copy and four starters without the old logo", () => {
    const { container } = renderConversationArea();

    expect(screen.getByText("Your store guide")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Good decisions start with a clear view.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Bloom checks your customer, sales, and campaign records/),
    ).toBeInTheDocument();

    for (const label of [
      "Best customers",
      "Who to win back",
      "Last email",
      "Write an email",
    ]) {
      expect(screen.getByRole("button", { name: new RegExp(label) })).toBeInTheDocument();
    }

    expect(container.querySelector("img")).toBeNull();
    expect(
      screen.getByText("Sourced answers · You approve every change"),
    ).toBeInTheDocument();
  });

  it("asks the starter prompt in one tap", () => {
    renderConversationArea();

    fireEvent.click(screen.getByRole("button", { name: /Best customers/ }));

    expect(askBloomMock.sendMessage).toHaveBeenCalledWith(
      "Who are my best customers?",
    );
  });

  it("keeps more help collapsed until asked, then sends the chosen action", () => {
    renderConversationArea();

    const toggle = screen.getByRole("button", { name: /More help and actions/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("button", { name: "Check low stock" }),
    ).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("button", { name: "Check low stock" }));
    expect(askBloomMock.sendMessage).toHaveBeenCalledWith(
      "What is running low on stock?",
    );

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("button", { name: "Check low stock" }),
    ).not.toBeInTheDocument();
  });

  it("uses resource starters without the general body copy or more-help card", () => {
    askBloomMock.state = buildState({ resourceFocus: customerFocus });
    renderConversationArea();

    expect(
      screen.getByRole("heading", {
        name: "What would you like to know about Jane Gardener?",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Purchase history/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Bloom checks your customer, sales, and campaign records/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /More help and actions/ }),
    ).not.toBeInTheDocument();
  });
});

describe("Ask Bloom composer", () => {
  it("labels the welcome composer and offers the Ask Bloom send pill", () => {
    mockComposerWidth(376);
    renderInput();

    const textarea = screen.getByRole("textbox", { name: "What can I help with?" });
    expect(textarea).toHaveAttribute(
      "placeholder",
      "Ask how to do something, or about your store...",
    );

    const send = screen.getByRole("button", { name: "Send message" });
    expect(send).toHaveTextContent("Ask Bloom");
    expect(send).toBeDisabled();

    fireEvent.change(textarea, { target: { value: "Who are my best customers?" } });
    expect(send).toBeEnabled();
    fireEvent.click(send);
    // The shared composer forwards the chosen mode, model and attachments.
    expect(askBloomMock.sendMessage).toHaveBeenCalledWith(
      "Who are my best customers?",
      { mode: "standard", modelPreference: "auto", attachments: [] },
    );
  });

  it("keeps the icon send button in the compact panel", () => {
    mockComposerWidth(300);
    renderInput();

    const send = screen.getByRole("button", { name: "Send message" });
    expect(within(send).queryByText("Ask Bloom")).not.toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "What can I help with?" }),
    ).toBeInTheDocument();
  });

  it("switches to a follow-up prompt and icon send button once a conversation exists", () => {
    const message: AskBloomMessage = {
      id: "message-1",
      conversationId: "conversation-1",
      role: "user",
      content: "Who are my best customers?",
      blocks: [],
      toolCalls: [],
      createdAt: "2026-11-18T00:00:00.000Z",
      isStreaming: false,
    };
    askBloomMock.state = buildState({
      conversationId: "conversation-1",
      messages: [message],
    });
    mockComposerWidth(376);
    renderInput();

    expect(screen.queryByText("What can I help with?")).not.toBeInTheDocument();
    const textarea = screen.getByRole("textbox", { name: "Ask Bloom message" });
    expect(textarea).toHaveAttribute("placeholder", "Ask a follow-up...");

    const send = screen.getByRole("button", { name: "Send message" });
    expect(within(send).queryByText("Ask Bloom")).not.toBeInTheDocument();
  });
});
