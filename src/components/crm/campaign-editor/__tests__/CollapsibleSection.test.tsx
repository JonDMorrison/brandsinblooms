import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CollapsibleSection } from "@/components/crm/campaign-editor/CollapsibleSection";

describe("CollapsibleSection", () => {
  it("shows title and summary when collapsed; hides body", () => {
    render(
      <CollapsibleSection
        title="Setup"
        summary="My Campaign · Email · From jane@example.com"
        defaultExpanded={false}
      >
        <div data-testid="section-body">Body content</div>
      </CollapsibleSection>,
    );

    expect(screen.getByText("Setup")).toBeInTheDocument();
    expect(
      screen.getByText("My Campaign · Email · From jane@example.com"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("section-body")).not.toBeInTheDocument();
  });

  it("renders full children and no summary when expanded", () => {
    render(
      <CollapsibleSection
        title="Audience"
        summary="should not show when expanded"
        defaultExpanded
      >
        <div data-testid="section-body">Audience controls</div>
      </CollapsibleSection>,
    );

    expect(screen.getByText("Audience")).toBeInTheDocument();
    expect(screen.getByTestId("section-body")).toBeInTheDocument();
    expect(
      screen.queryByText("should not show when expanded"),
    ).not.toBeInTheDocument();
  });

  it("toggles when the header is clicked", async () => {
    const user = userEvent.setup();
    render(
      <CollapsibleSection
        title="Content"
        summary="2 blocks"
        defaultExpanded={false}
      >
        <div data-testid="section-body">Hidden body</div>
      </CollapsibleSection>,
    );

    expect(screen.queryByTestId("section-body")).not.toBeInTheDocument();

    const header = screen.getByRole("button", { name: /content/i });
    await user.click(header);

    expect(screen.getByTestId("section-body")).toBeInTheDocument();
    expect(header).toHaveAttribute("aria-expanded", "true");

    await user.click(header);
    expect(screen.queryByTestId("section-body")).not.toBeInTheDocument();
    expect(header).toHaveAttribute("aria-expanded", "false");
  });

  it("renders an optional badge alongside the title", () => {
    render(
      <CollapsibleSection
        title="Audience"
        badge={<span data-testid="recipient-badge">~5,014 recipients</span>}
        defaultExpanded={false}
      >
        <div>Body</div>
      </CollapsibleSection>,
    );

    expect(screen.getByTestId("recipient-badge")).toBeInTheDocument();
  });
});
