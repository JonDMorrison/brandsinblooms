import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { HomepageDifferentiatorsSection } from "./HomepageDifferentiatorsSection";
import {
  DIFFERENTIATOR_CARDS,
  DIFFERENTIATORS_SECTION_HEADER,
} from "./content/differentiatorsContent";

describe("HomepageDifferentiatorsSection", () => {
  it("renders the section header from DIFFERENTIATORS_SECTION_HEADER", () => {
    render(<HomepageDifferentiatorsSection isActive motionEnabled />);

    expect(
      screen.getByText(DIFFERENTIATORS_SECTION_HEADER.eyebrow),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: DIFFERENTIATORS_SECTION_HEADER.headline,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(DIFFERENTIATORS_SECTION_HEADER.subtext),
    ).toBeInTheDocument();
  });

  it("renders one card per DIFFERENTIATOR_CARDS entry with title and description", () => {
    render(<HomepageDifferentiatorsSection isActive motionEnabled />);

    const grid = screen.getByLabelText(
      "What BloomSuite includes beyond software",
    );

    for (const card of DIFFERENTIATOR_CARDS) {
      expect(
        within(grid).getByRole("heading", { name: card.title }),
      ).toBeInTheDocument();
      expect(within(grid).getByText(card.description)).toBeInTheDocument();
    }
  });
});
