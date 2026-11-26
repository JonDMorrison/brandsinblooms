import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AskBloomInput from "@/components/askBloom/AskBloomInput";
import { BloomPageComposer } from "@/components/bloom/BloomPageComposer";

const mocks = vi.hoisted(() => ({
  drawerSend: vi.fn(),
  drawerStop: vi.fn(),
  drawerStreaming: false,
  pageSend: vi.fn(() => Promise.resolve()),
  pageStop: vi.fn(),
  pageStreaming: false,
  pageDraft: "",
  setPageDraft: vi.fn(),
  registerController: vi.fn(),
}));

vi.mock("@/providers/AskBloomProvider", () => ({
  useAskBloom: () => ({
    state: {
      conversationId: null,
      messages: [],
      panelWidth: 400,
      isPinned: false,
      resourceFocus: null,
      isStreaming: mocks.drawerStreaming,
      isTransitioning: false,
      isSendingMessage: false,
      isLoadingConversation: false,
    },
    sendMessage: mocks.drawerSend,
    cancelStream: mocks.drawerStop,
    ensureConversationId: vi.fn(() => Promise.resolve("conversation-1")),
    newConversation: vi.fn(),
    clearResourceFocus: vi.fn(),
    pinConversation: vi.fn(),
    unpinConversation: vi.fn(),
  }),
}));

vi.mock("@/components/bloom/BloomContext", () => ({
  useBloom: () => ({
    activeConversationId: null,
    activeMode: "standard",
    archiveConversation: vi.fn(),
    cancelStream: mocks.pageStop,
    composerDraft: mocks.pageDraft,
    createConversation: vi.fn(() => Promise.resolve("conversation-2")),
    isStreaming: mocks.pageStreaming,
    messages: [],
    messagesLoading: false,
    modelPreference: "auto",
    openShortcutsPanel: vi.fn(),
    registerComposerController: mocks.registerController,
    sendMessage: mocks.pageSend,
    setActiveMode: vi.fn(),
    setComposerDraft: mocks.setPageDraft,
    setModelPreference: vi.fn(),
  }),
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

const renderInRouter = (node: React.ReactNode) =>
  render(<MemoryRouter>{node}</MemoryRouter>);

/** The controls a composer offers, by accessible name. */
const composerControls = () => ({
  textbox: screen.getByRole("textbox", { name: "What can I help with?" }),
  tools: screen.getByRole("button", { name: "Tools and modes" }),
  send: screen.getByRole("button", { name: "Send message" }),
});

beforeEach(() => {
  Object.values(mocks).forEach((value) => {
    if (typeof value === "function" && "mockClear" in value) {
      value.mockClear();
    }
  });
  mocks.drawerStreaming = false;
  mocks.pageStreaming = false;
  mocks.pageDraft = "";
});

afterEach(cleanup);

describe("one Bloom composer", () => {
  it("renders the same composer in the drawer and on /bloom", () => {
    const drawer = renderInRouter(<AskBloomInput />);
    const drawerComposer = drawer.container.querySelector(
      "[data-bloom-composer]",
    );
    expect(drawerComposer).toHaveAttribute("data-bloom-composer", "panel");
    const drawerControls = composerControls();
    expect(drawerControls.textbox).toHaveAttribute(
      "placeholder",
      "Ask how to do something, or about your store...",
    );
    cleanup();

    const page = renderInRouter(<BloomPageComposer />);
    expect(
      page.container.querySelector("[data-bloom-composer]"),
    ).toHaveAttribute("data-bloom-composer", "page");
    const pageControls = composerControls();
    expect(pageControls.textbox).toHaveAttribute(
      "placeholder",
      drawerControls.textbox.getAttribute("placeholder"),
    );
    expect(
      screen.getByText(/Bloom Assist can make mistakes/),
    ).toBeInTheDocument();
    // /bloom's shortcuts reach the shared composer.
    expect(mocks.registerController).toHaveBeenCalledWith(
      expect.objectContaining({
        focus: expect.any(Function),
        setValue: expect.any(Function),
      }),
    );
  });

  it("sends the drawer's chosen mode and model with the message", () => {
    renderInRouter(<AskBloomInput />);

    fireEvent.click(screen.getByRole("button", { name: "Tools and modes" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Reasoning/ }));
    expect(
      screen.getByRole("button", { name: "Clear Reasoning mode" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Why did sales dip?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(mocks.drawerSend).toHaveBeenCalledWith("Why did sales dip?", {
      mode: "reasoning",
      modelPreference: "auto",
      attachments: [],
    });
  });

  it("sends /bloom's draft and attachments through BloomContext", async () => {
    mocks.pageDraft = "How did my campaigns do?";
    renderInRouter(<BloomPageComposer />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    });

    expect(mocks.pageSend).toHaveBeenCalledWith("How did my campaigns do?", []);
    expect(mocks.setPageDraft).toHaveBeenCalledWith("");
  });

  it.each([
    ["drawer", () => <AskBloomInput />, () => mocks.drawerStop],
    ["/bloom", () => <BloomPageComposer />, () => mocks.pageStop],
  ] as const)(
    "turns send into stop while %s is streaming",
    (surface, renderComposer, stop) => {
      mocks.drawerStreaming = surface === "drawer";
      mocks.pageStreaming = surface === "/bloom";
      renderInRouter(renderComposer());

      fireEvent.click(screen.getByRole("button", { name: "Stop response" }));

      expect(stop()).toHaveBeenCalledTimes(1);
    },
  );
});
