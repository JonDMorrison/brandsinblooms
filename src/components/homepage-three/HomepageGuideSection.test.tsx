import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { HomepageGuideSection } from "./HomepageGuideSection";
import {
  GUIDE_CHECKMARKS,
  GUIDE_PILLARS,
  GUIDE_SECTION_HEADER,
} from "./content/guideContent";

describe("HomepageGuideSection", () => {
  it("renders the eyebrow, headline, and subtext from GUIDE_SECTION_HEADER", () => {
    render(<HomepageGuideSection isActive motionEnabled />);

    expect(screen.getByText(GUIDE_SECTION_HEADER.eyebrow)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: GUIDE_SECTION_HEADER.headline }),
    ).toBeInTheDocument();
    expect(screen.getByText(GUIDE_SECTION_HEADER.subtext)).toBeInTheDocument();
  });

  it("renders one checkmark per GUIDE_CHECKMARKS entry", () => {
    render(<HomepageGuideSection isActive motionEnabled />);

    const list = screen.getByLabelText(
      "Why BloomSuite fits garden retail",
    );
    for (const item of GUIDE_CHECKMARKS) {
      expect(within(list).getByText(item.label)).toBeInTheDocument();
    }
  });

  it("renders one pillar card per GUIDE_PILLARS entry with title and description", () => {
    render(<HomepageGuideSection isActive motionEnabled />);

    const pillars = screen.getByLabelText("Platform pillars");
    for (const pillar of GUIDE_PILLARS) {
      expect(
        within(pillars).getByRole("heading", { name: pillar.title }),
      ).toBeInTheDocument();
      expect(within(pillars).getByText(pillar.description)).toBeInTheDocument();
    }
  });
});
