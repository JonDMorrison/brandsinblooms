import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

import { CustomPersonaModal } from "@/components/crm/personas/CustomPersonaModal";

const renderModal = () =>
  render(
    <CustomPersonaModal
      open
      onSave={vi.fn().mockResolvedValue({})}
      onCancel={vi.fn()}
    />,
  );

describe("CustomPersonaModal accent picker", () => {
  it("renders the accent group as a radio group with the default selection marked", () => {
    renderModal();

    const group = screen.getByRole("radiogroup", { name: /accent color/i });
    expect(group).toBeInTheDocument();

    const defaultOption = screen.getByTestId("persona-accent-primary");
    expect(defaultOption).toHaveAttribute("aria-checked", "true");
    expect(defaultOption).toHaveAttribute("aria-selected", "true");
  });

  it("updates the selected accent when another option is clicked", () => {
    renderModal();

    const previous = screen.getByTestId("persona-accent-primary");
    const next = screen.getByTestId("persona-accent-success");

    expect(previous).toHaveAttribute("aria-checked", "true");
    expect(next).toHaveAttribute("aria-checked", "false");

    fireEvent.click(next);

    expect(screen.getByTestId("persona-accent-success")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByTestId("persona-accent-primary")).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });
});
