import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  MemoryRouter,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import BloomPage from "./BloomPage";

const mocks = vi.hoisted(() => ({
  setComposerDraft: vi.fn(),
  createConversation: vi.fn(async () => "00000000-0000-4000-8000-000000000010"),
  sendMessage: vi.fn(async () => undefined),
}));

vi.mock("@/components/bloom/BloomContext", () => ({
  useBloom: () => mocks,
}));
vi.mock("@/components/bloom/BloomConversationArea", () => ({
  BloomConversationArea: () => (
    <div data-testid="bloom-conversation">Current Bloom conversation</div>
  ),
}));
vi.mock("@/components/bloom/BloomApprovalBar", () => ({
  BloomApprovalBar: () => <div data-testid="approval-bar">Approvals</div>,
}));
vi.mock("@/components/bloom/BloomInputArea", () => ({
  BloomInputArea: () => <div data-testid="input-area">Bloom composer</div>,
}));
vi.mock("@/hooks/useTenant", () => ({
  useTenant: () => ({ tenant: { id: "synthetic-tenant" }, loading: false }),
}));
vi.mock("@/hooks/bloom/types", () => ({
  bloomSupabase: {
    from: vi.fn(() => {
      throw new Error(
        "No actual customer insight lookup expected in this test.",
      );
    }),
  },
  toBloomProactiveInsight: vi.fn(),
}));

function LocationEcho() {
  const route = useLocation();
  return <span data-testid="target-path">{route.pathname + route.search}</span>;
}
function mount(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<Outlet context={{ prioritizePageContext: false }} />}>
          <Route path="/bloom" element={<BloomPage />} />
        </Route>
        <Route path="/crm/intelligence" element={<LocationEcho />} />
      </Routes>
    </MemoryRouter>,
  );
}
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("Bloom return path from Intelligence", () => {
  it("prefills the exact question without sending and preserves a safe return path", async () => {
    mount(
      "/bloom?origin=intelligence&returnView=growth&prompt=" +
        encodeURIComponent("Compare my recorded October spending"),
    );
    await waitFor(() =>
      expect(mocks.setComposerDraft).toHaveBeenCalledWith(
        "Compare my recorded October spending",
      ),
    );
    expect(mocks.sendMessage).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Back to Intelligence" }),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "Back to Intelligence" }),
    );
    expect(screen.getByTestId("target-path")).toHaveTextContent(
      "/crm/intelligence?view=growth",
    );
  });
  it("does not show a return control for unrelated Bloom visits", () => {
    mount("/bloom");
    expect(
      screen.queryByRole("button", { name: "Back to Intelligence" }),
    ).toBeNull();
  });
  it("never follows an unsafe or unknown return destination", () => {
    mount("/bloom?origin=intelligence&returnView=%2F%2Fevil.example");
    fireEvent.click(
      screen.getByRole("button", { name: "Back to Intelligence" }),
    );
    expect(screen.getByTestId("target-path")).toHaveTextContent(
      "/crm/intelligence?view=overview",
    );
  });
});
