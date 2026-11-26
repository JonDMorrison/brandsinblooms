import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { AskBloomConversationArea } from "@/components/askBloom/AskBloomConversationArea";
import { BloomHomeState } from "@/components/bloom/BloomHomeState";
import type { AskBloomState } from "@/types/askBloom";
import { getAskBloomStarterConfig } from "@/utils/askBloomStarters";

const mocks = vi.hoisted(() => ({
  drawerSend: vi.fn(),
  pageSend: vi.fn(() => Promise.resolve()),
  onboardingStage: 0,
}));

vi.mock("@/providers/AskBloomProvider", () => ({
  useAskBloom: () => ({
    state: drawerState(),
    sendMessage: mocks.drawerSend,
    cancelStream: vi.fn(),
    retryStream: vi.fn(),
    keepPartialResponse: vi.fn(),
    acceptNavigationPrompt: vi.fn(),
    dismissNavigationPrompt: vi.fn(),
    presentResourceForm: vi.fn(),
  }),
}));

vi.mock("@/hooks/askBloom/useAskBloomInsights", () => ({
  useAskBloomInsights: () => ({ insights: [], isLoading: false }),
}));

vi.mock("@/components/bloom/BloomContext", () => ({
  useBloom: () => ({
    sendMessage: mocks.pageSend,
    isStreaming: false,
    pageContext: null,
  }),
}));

vi.mock("@/hooks/bloom/useBloomOnboarding", () => ({
  useBloomOnboarding: () => ({ stage: mocks.onboardingStage }),
}));

vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({ tenant: { id: "tenant-1" }, loading: false }),
}));

vi.mock("@/hooks/bloom/useBloomProfile", () => ({
  useBloomProfile: () => ({
    data: { workspaceMemory: null },
    isLoading: false,
  }),
}));

vi.mock("@/hooks/bloom/useBloomProfileMutations", () => ({
  useBloomProfileMutations: () => ({
    isUnpinningEntity: false,
    unpinEntity: vi.fn(),
  }),
}));

vi.mock("@/hooks/bloom/useBloomSuggestions", () => ({
  useBloomSuggestions: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/hooks/bloom/useBloomDailySnapshot", () => ({
  useBloomDailySnapshot: () => ({
    data: {
      revenueToday: 0,
      newCustomersToday: 0,
      activeCampaignsCount: 0,
      pendingOrdersCount: 0,
    },
    isLoading: false,
    isError: true,
  }),
}));

vi.mock("@/hooks/bloom/useBloomInsights", () => ({
  useBloomInsights: () => ({ data: [], isLoading: false }),
}));

function drawerState(): AskBloomState {
  return {
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
  };
}

const general = getAskBloomStarterConfig(null);

/** The greeting and the starter labels the welcome shows, in order. */
const readWelcome = () => {
  const welcome = screen.getByTestId("bloom-welcome");
  const heading = welcome.querySelector("h3")?.textContent ?? "";
  const starters = general.starters
    .map((starter) => starter.label)
    .filter((label) =>
      Array.from(welcome.querySelectorAll("button")).some((button) =>
        button.textContent?.includes(label),
      ),
    );
  return { heading, starters };
};

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
    writable: true,
  });
});

beforeEach(() => {
  mocks.drawerSend.mockReset();
  mocks.pageSend.mockClear();
  mocks.onboardingStage = 0;
});

afterEach(cleanup);

describe("one Bloom welcome", () => {
  it.each([0, 2])(
    "renders the drawer's greeting and starters on /bloom (onboarding stage %s)",
    (stage) => {
      mocks.onboardingStage = stage;

      render(
        <MemoryRouter>
          <AskBloomConversationArea />
        </MemoryRouter>,
      );
      const drawer = readWelcome();
      cleanup();

      render(
        <MemoryRouter>
          <BloomHomeState />
        </MemoryRouter>,
      );
      const page = readWelcome();

      expect(drawer.heading).toBe(general.greeting);
      expect(page).toEqual(drawer);
      expect(page.starters).toEqual(
        general.starters.map((starter) => starter.label),
      );
      // The retired /bloom-only starter list is gone.
      expect(screen.queryByText("Check my inventory")).not.toBeInTheDocument();
    },
  );

  it("asks the same starter prompt from the drawer and from /bloom", () => {
    const [firstStarter] = general.starters;

    render(
      <MemoryRouter>
        <AskBloomConversationArea />
      </MemoryRouter>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(firstStarter.label) }),
    );
    cleanup();

    render(
      <MemoryRouter>
        <BloomHomeState />
      </MemoryRouter>,
    );
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(firstStarter.label) }),
    );

    expect(mocks.drawerSend).toHaveBeenCalledWith(firstStarter.prompt);
    expect(mocks.pageSend).toHaveBeenCalledWith(firstStarter.prompt);
  });
});
