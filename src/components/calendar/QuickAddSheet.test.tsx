import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QuickAddSheet } from "./QuickAddSheet";

describe("QuickAddSheet", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders as a JoyDialog (not a Drawer)", () => {
    render(
      <QuickAddSheet
        isOpen
        onClose={vi.fn()}
        selectedDate={new Date("2026-05-14T12:00:00Z")}
        onSubmit={vi.fn()}
      />,
    );

    // JoyDialog renders an MUI Joy ModalDialog with role="dialog".
    // Joy Drawer's content does not get a dialog role.
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // "Quick Add" copy appears in the JoyDialog title slot.
    expect(screen.getByText("Quick Add")).toBeInTheDocument();
  });

  it("returns null when no date is selected", () => {
    const { container } = render(
      <QuickAddSheet
        isOpen
        onClose={vi.fn()}
        selectedDate={null}
        onSubmit={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
