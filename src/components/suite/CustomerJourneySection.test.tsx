import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { CustomerJourneySection } from "./CustomerJourneySection";

describe("CustomerJourneySection", () => {
  it("retains the customer-centred four-stage journey, repeat path and product links", () => {
    const { container } = render(<MemoryRouter><CustomerJourneySection /></MemoryRouter>);
    const list = screen.getByRole("list");
    const stages = within(list).getAllByRole("listitem");
    expect(stages).toHaveLength(4);
    expect(stages.map(stage => within(stage).getByRole("heading", { level: 3 }).textContent)).toEqual(["Discover", "Research", "Purchase", "Follow up"]);
    expect(within(stages[0]).getByRole("link")).toHaveAttribute("href", "https://bloomsites.app/");
    expect(within(stages[1]).getByRole("link")).toHaveAttribute("href", "/plant-intelligence");
    expect(within(stages[2]).getByRole("link")).toHaveAttribute("href", "/#suite-products");
    expect(within(stages[3]).getByRole("link")).toHaveAttribute("href", "/crm/features");
    expect(within(stages[3]).getByText(/customers who opt in/)).toBeInTheDocument();
    expect(screen.getByText("Every visit can lead to the next.")).toBeInTheDocument();
    expect(screen.getByText(/Illustrative customer journey/)).toBeInTheDocument();
    expect(container.querySelectorAll('.hp-journey__visual[aria-hidden="true"]')).toHaveLength(4);
    expect(screen.getByRole("link", { name: /Explore the BloomSuite family/ })).toHaveAttribute("href", "#suite-products");
  });
});
