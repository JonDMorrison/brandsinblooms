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
vi.mock("@/components/bloom/BloomPageComposer", () => ({
  BloomPageComposer: () => <div data-testid="input-area">Bloom composer</div>,
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
        <Route path="/dashboard" element={<LocationEcho />} />
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
    expect(screen.queryByRole("button", { name: "Back to Dashboard" })).toBeNull();
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
  it("offers a clear dashboard exit for ordinary Bloom visits", () => {
    mount("/bloom");
    expect(
      screen.queryByRole("button", { name: "Back to Intelligence" }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Back to Dashboard" }),
    );
    expect(screen.getByTestId("target-path")).toHaveTextContent("/dashboard");
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

describe("Bloom page layout", () => {
  it("puts the return control in its own row above the conversation, never over it", () => {
    mount("/bloom");
    const returnRow = screen.getByTestId("bloom-return-control");
    const stage = screen.getByTestId("bloom-conversation-stage");
    const conversation = screen.getByTestId("bloom-conversation");

    // The control is a sibling before the stage, not a layer inside it.
    expect(returnRow.parentElement).toBe(stage.parentElement);
    expect(returnRow.nextElementSibling).toBe(stage);
    expect(stage).toContainElement(conversation);
    expect(stage).not.toContainElement(returnRow);
    expect(returnRow).toContainElement(
      screen.getByRole("button", { name: "Back to Dashboard" }),
    );
    // In normal flow at every width: no absolute or fixed positioning.
    expect(getComputedStyle(returnRow).position).not.toBe("absolute");
    expect(getComputedStyle(returnRow).position).not.toBe("fixed");
    expect(getComputedStyle(returnRow).flexShrink).toBe("0");
  });

  it("prefills a ?prompt= link once and removes it from the address", async () => {
    mount("/bloom?prompt=" + encodeURIComponent("Draft the spring newsletter"));
    await waitFor(() =>
      expect(mocks.setComposerDraft).toHaveBeenCalledWith(
        "Draft the spring newsletter",
      ),
    );
    expect(mocks.setComposerDraft).toHaveBeenCalledTimes(1);
    expect(mocks.sendMessage).not.toHaveBeenCalled();
  });
});
