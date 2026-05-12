import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { StudioCtaCard } from "@/components/crm/campaign-editor/StudioCtaCard";

describe("StudioCtaCard", () => {
  it("renders title, subtitle, icon, and arrow", () => {
    render(<StudioCtaCard onOpen={() => {}} />);
    expect(screen.getByText("Open the Design Studio")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Edit text, add images, change layouts, design your email",
      ),
    ).toBeInTheDocument();
    const card = screen.getByTestId("studio-cta-card");
    // Two lucide SVGs inside: Palette and ArrowRight.
    expect(card.querySelectorAll("svg").length).toBeGreaterThanOrEqual(2);
  });

  it("calls onOpen when clicked", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<StudioCtaCard onOpen={onOpen} />);
    await user.click(screen.getByTestId("studio-cta-card"));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("fires onOpen on Enter and Space keypress", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<StudioCtaCard onOpen={onOpen} />);
    const card = screen.getByTestId("studio-cta-card");
    card.focus();
    await user.keyboard("{Enter}");
    expect(onOpen).toHaveBeenCalledTimes(1);
    await user.keyboard(" ");
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it("does not call onOpen when disabled", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(
      <StudioCtaCard
        onOpen={onOpen}
        disabled
        disabledReason="Pick a template first"
      />,
    );
    const card = screen.getByTestId("studio-cta-card");
    await user.click(card);
    expect(onOpen).not.toHaveBeenCalled();
    expect(card).toHaveAttribute("aria-disabled", "true");
    expect(card).toHaveAttribute("tabindex", "-1");
  });

  it("surfaces disabledReason as a tooltip when disabled", async () => {
    const user = userEvent.setup();
    render(
      <StudioCtaCard
        onOpen={() => {}}
        disabled
        disabledReason="This campaign has already been sent"
      />,
    );
    await user.hover(screen.getByTestId("studio-cta-card"));
    expect(
      await screen.findByText("This campaign has already been sent"),
    ).toBeInTheDocument();
  });

  it("respects custom title and subtitle overrides", () => {
    render(
      <StudioCtaCard
        onOpen={() => {}}
        title="View in Studio"
        subtitle="Read-only design view"
      />,
    );
    expect(screen.getByText("View in Studio")).toBeInTheDocument();
    expect(screen.getByText("Read-only design view")).toBeInTheDocument();
  });
});
