import "@testing-library/jest-dom/vitest";
import * as React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import { DndContext } from "@dnd-kit/core";
import { describe, it, expect, vi, beforeEach } from "vitest";
import BlockLibrary from "../BlockLibrary";
import { createStudioBlock } from "@/lib/studio/blockFactory";
const account = vi.hoisted(() => ({
  scopeKey: "user:account-a",
  accountId: "account-a",
  create: vi.fn(),
  rename: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@/hooks/useSavedNewsletterBlocks", () => ({
  useSavedNewsletterBlocks: () => ({
    ...account,
    blocks: [],
    loading: false,
    error: "",
    busy: false,
    ready: true,
    accountName: account.accountId,
    reload: vi.fn(),
  }),
}));
vi.mock("@/contexts/DesignSystemContext", () => ({
  useDesignSystem: () => ({ designSystem: null }),
}));
function Wrapper() {
  const [blocks] = React.useState(() => [createStudioBlock("coupon")]);
  return (
    <DndContext>
      <BlockLibrary
        blocks={blocks}
        selectedBlockId={blocks[0].id}
        onAddBlock={() => {}}
        onSelectBlock={() => {}}
        onInsertSavedBlock={() => {}}
      />
    </DndContext>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  account.scopeKey = "user:account-a";
  account.accountId = "account-a";
});
describe("newsletter account switching safety", () => {
  it("closes a pending save dialog when the destination account changes", () => {
    const view = render(<Wrapper />);
    fireEvent.click(screen.getByRole("tab", { name: "Saved" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Save selected block" }),
    );
    expect(screen.getByLabelText("Block name")).toBeInTheDocument();
    account.scopeKey = "user:account-b";
    account.accountId = "account-b";
    view.rerender(<Wrapper />);
    expect(screen.queryByLabelText("Block name")).not.toBeInTheDocument();
    expect(account.create).not.toHaveBeenCalled();
  });
  it("stops a confirmed browser-library import when the account changes mid-batch", async () => {
    localStorage.setItem(
      "bloomsuite-saved-block-templates",
      JSON.stringify([
        { name: "One", block: createStudioBlock("coupon") },
        { name: "Two", block: createStudioBlock("coupon") },
      ]),
    );
    let resolve!: (value: unknown) => void;
    account.create.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const view = render(<Wrapper />);
    fireEvent.click(screen.getByRole("tab", { name: "Saved" }));
    fireEvent.click(screen.getByRole("button", { name: "Import 2 blocks" }));
    expect(account.create).toHaveBeenCalledTimes(1);
    expect(account.create.mock.calls[0][0].expectedTenantId).toBe("account-a");
    account.scopeKey = "user:account-b";
    account.accountId = "account-b";
    view.rerender(<Wrapper />);
    await act(async () => resolve({ id: "one" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Account changed"),
    );
    expect(account.create).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse(localStorage.getItem("bloomsuite-saved-block-templates")!),
    ).toHaveLength(1);
    confirm.mockRestore();
  });
});
