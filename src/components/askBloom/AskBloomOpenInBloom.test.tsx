import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  MemoryRouter,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AskBloomHeader } from "@/components/askBloom/AskBloomHeader";
import { BloomShell } from "@/components/bloom/BloomShell";

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  openConversation: vi.fn(),
  conversationId: "conversation-1" as string | null,
}));

vi.mock("@/providers/AskBloomProvider", () => {
  const askBloom = () => ({
    state: {
      conversationId: mocks.conversationId,
      messages: [],
      isOpen: true,
      isCollapsed: false,
    },
    close: mocks.close,
    openConversation: mocks.openConversation,
    loadConversation: vi.fn(),
    newConversation: vi.fn(),
    toggleCollapse: vi.fn(),
  });
  return { useAskBloom: askBloom, useOptionalAskBloom: askBloom };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({ tenant: { id: "tenant-1" }, loading: false }),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

vi.mock("@/components/bloom/BloomContext", () => ({
  BloomProvider: ({ children }: { children: React.ReactNode }) => children,
  useBloom: () => ({
    activeConversationId: mocks.conversationId,
    conversationStartCount: 0,
    entitySummary: null,
    messages: [],
    pageContext: null,
  }),
}));

vi.mock("@/components/bloom/BloomHeader", () => ({
  BloomHeader: () => <div>Bloom header</div>,
}));
vi.mock("@/components/bloom/BloomSidebar", () => ({
  BloomSidebar: () => <div>Bloom history</div>,
}));
vi.mock("@/components/bloom/BloomShortcutsPanel", () => ({
  BloomShortcutsPanel: () => null,
}));
vi.mock("@/hooks/bloom/useBloomShortcuts", () => ({
  useBloomShortcuts: () => undefined,
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
}

function LeaveBloomButton() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate("/dashboard")}>
      Leave Bloom
    </button>
  );
}

beforeEach(() => {
  mocks.close.mockReset();
  mocks.openConversation.mockReset();
  mocks.conversationId = "conversation-1";
});

describe("Open in Bloom", () => {
  it("opens /bloom on the drawer's conversation id and closes the drawer", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/crm/customers"]}>
          <AskBloomHeader />
          <LocationProbe />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open in Bloom" }));

    expect(screen.getByTestId("location")).toHaveTextContent(
      "/bloom/conversation-1",
    );
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });

  it("opens the /bloom home when the drawer has no conversation yet", () => {
    mocks.conversationId = null;
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <AskBloomHeader />
          <LocationProbe />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open in Bloom" }));

    expect(screen.getByTestId("location")).toHaveTextContent(/^\/bloom$/);
  });

  it("hands the same conversation back to the drawer when the user leaves /bloom", async () => {
    render(
      <MemoryRouter initialEntries={["/bloom/conversation-1"]}>
        <LeaveBloomButton />
        <Routes>
          <Route path="/bloom" element={<BloomShell />}>
            <Route path=":chatId" element={<Outlet />} />
          </Route>
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getAllByText("Bloom history").length).toBeGreaterThan(0);
    expect(mocks.openConversation).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Leave Bloom" }));

    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.openConversation).toHaveBeenCalledWith("conversation-1"),
    );
  });
});
