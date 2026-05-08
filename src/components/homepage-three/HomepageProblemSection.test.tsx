import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { HomepageProblemSection } from "./HomepageProblemSection";
import {
  PROBLEM_CARDS,
  PROBLEM_SECTION_HEADER,
} from "./content/problemContent";

describe("HomepageProblemSection", () => {
  it("renders the section header from PROBLEM_SECTION_HEADER", () => {
    render(<HomepageProblemSection isActive motionEnabled />);

    expect(screen.getByText(PROBLEM_SECTION_HEADER.eyebrow)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: PROBLEM_SECTION_HEADER.headline }),
    ).toBeInTheDocument();
    expect(screen.getByText(PROBLEM_SECTION_HEADER.subtext)).toBeInTheDocument();
  });

  it("renders one glass card per PROBLEM_CARDS entry with title and description", () => {
    render(<HomepageProblemSection isActive motionEnabled />);

    const grid = screen.getByLabelText(
      "Garden centre marketing pain points",
    );

    for (const card of PROBLEM_CARDS) {
      expect(
        within(grid).getByRole("heading", { name: card.title }),
      ).toBeInTheDocument();
      expect(within(grid).getByText(card.description)).toBeInTheDocument();
    }
  });

  it("forwards isActive and motionEnabled to data attributes", () => {
    render(<HomepageProblemSection isActive={false} motionEnabled />);

    const root = screen.getByTestId("homepage-problem");
    expect(root).toHaveAttribute("data-active", "false");
    expect(root).toHaveAttribute("data-motion-enabled", "true");
  });
});
