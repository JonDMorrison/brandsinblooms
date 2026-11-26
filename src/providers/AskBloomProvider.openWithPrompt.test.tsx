import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BloomChip } from "@/components/bloom/BloomChip";
import { AskBloomProvider, useAskBloom } from "@/providers/AskBloomProvider";

const mocks = vi.hoisted(() => ({
  user: null as { id: string } | null,
  session: null as { access_token: string } | null,
  tenant: null as { id: string } | null,
  streamSend: vi.fn(),
  insertedConversation: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: mocks.user, session: mocks.session }),
}));

vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({ tenant: mocks.tenant, loading: !mocks.tenant }),
}));

vi.mock("@/hooks/askBloom/useAskBloomStreaming", () => ({
  useAskBloomStreaming: () => ({
    sendMessage: mocks.streamSend,
    cancelStream: vi.fn(),
  }),
}));

vi.mock("@/hooks/askBloom/useAskBloomConversation", () => ({
  useAskBloomConversation: () => ({
    conversation: null,
    messages: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/hooks/askBloom/useAskBloomNavigation", () => ({
  useAskBloomNavigation: () => undefined,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      insert: (row: { id: string }) => {
        mocks.insertedConversation(row);
        return {
          select: () => ({
            single: () => Promise.resolve({ data: { id: row.id }, error: null }),
          }),
        };
      },
    }),
  },
}));

function DrawerProbe() {
  const askBloom = useAskBloom();
  return (
    <output data-testid="drawer">
      {askBloom.state.isOpen ? "open" : "closed"}
      {askBloom.pendingPrompt ? ` pending:${askBloom.pendingPrompt}` : ""}
    </output>
  );
}

const renderChip = () => {
  const queryClient = new QueryClient();
  const tree = () => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/crm/campaigns"]}>
        <AskBloomProvider>
          <BloomChip label="Campaign insights" prompt="How did my campaigns do?" />
          <DrawerProbe />
        </AskBloomProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
  const view = render(tree());
  return { rerender: () => view.rerender(tree()) };
};

afterEach(cleanup);

/** Joy renders a clickable Chip's handler on its inner action <button>. */
const chipButton = () => {
  const button = screen
    .getAllByRole("button", { name: "Campaign insights" })
    .find((element) => element.tagName === "BUTTON");
  if (!button) {
    throw new Error("Campaign insights chip button not found");
  }
  return button;
};

const signIn = () => {
  mocks.user = { id: "user-1" };
  mocks.session = { access_token: "token-1" };
  mocks.tenant = { id: "tenant-1" };
};

beforeEach(() => {
  mocks.user = null;
  mocks.session = null;
  mocks.tenant = null;
  mocks.streamSend.mockReset();
  mocks.insertedConversation.mockReset();
});

describe("Bloom prompt buttons open the drawer", () => {
  it("opens the drawer and waits for the user, tenant and token before asking", async () => {
    const view = renderChip();

    fireEvent.click(chipButton());

    // The drawer opens straight away, but nothing is sent or created yet.
    expect(screen.getByTestId("drawer")).toHaveTextContent(
      "open pending:How did my campaigns do?",
    );
    expect(mocks.streamSend).not.toHaveBeenCalled();
    expect(mocks.insertedConversation).not.toHaveBeenCalled();

    // A signed-in user without an organization yet is still not enough.
    mocks.user = { id: "user-1" };
    mocks.session = { access_token: "token-1" };
    view.rerender();
    expect(mocks.streamSend).not.toHaveBeenCalled();
    expect(mocks.insertedConversation).not.toHaveBeenCalled();
  });

  it("asks the prompt once auth and tenant are loaded", async () => {
    const view = renderChip();
    fireEvent.click(chipButton());
    expect(mocks.streamSend).not.toHaveBeenCalled();

    signIn();
    await act(async () => {
      view.rerender();
    });

    expect(mocks.streamSend).toHaveBeenCalledTimes(1);
    const [prompt, overrides] = mocks.streamSend.mock.calls[0];
    expect(prompt).toBe("How did my campaigns do?");
    expect(overrides).toMatchObject({
      pageContext: expect.objectContaining({
        pathname: "/crm/campaigns",
        pageCategory: "campaigns",
      }),
    });
    expect(mocks.insertedConversation).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: "tenant-1", user_id: "user-1" }),
    );
    expect(screen.getByTestId("drawer")).toHaveTextContent(/^open$/);
  });

  it("sends immediately when everything is already loaded", async () => {
    signIn();
    renderChip();

    await act(async () => {
      fireEvent.click(chipButton());
    });

    expect(mocks.streamSend).toHaveBeenCalledTimes(1);
    expect(mocks.streamSend.mock.calls[0][0]).toBe("How did my campaigns do?");
  });
});
