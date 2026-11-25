import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { CustomerJourneySection } from "./CustomerJourneySection";

describe("CustomerJourneySection", () => {
  it("retains the circular four-stage journey with actual product images and product links", () => {
    const { container } = render(<MemoryRouter><CustomerJourneySection /></MemoryRouter>);
    const stages = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(stages).toHaveLength(4);
    expect(stages.map(stage => within(stage).getByRole("heading", { level: 3 }).textContent)).toEqual(["Discover","Research","Purchase","Follow up"]);
    const links = ["https://bloomsites.app/","/plant-intelligence","/#suite-products","/crm/features"];
    const images = ["/customer-journey/horsford-home.webp","/customer-journey/horsford-shop.webp","/pos/features-assets/register.webp","/homepage/section-1.png"];
    stages.forEach((stage,i) => {
      expect(within(stage).getByRole("link")).toHaveAttribute("href",links[i]);
      expect(within(stage).getByRole("img")).toHaveAttribute("src",images[i]);
    });
    expect(within(stages[3]).getByText(/customers who opt in/)).toBeInTheDocument();
    expect(screen.getByText("Your customer")).toBeInTheDocument();
    expect(container.querySelectorAll(".hp-journey__arrows > path")).toHaveLength(4);
    expect(screen.getByText("Every visit can lead to the next.")).toBeInTheDocument();
    expect(screen.getByRole("link",{name:/Explore the BloomSuite family/})).toHaveAttribute("href","#suite-products");
  });
});
