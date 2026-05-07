import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { HomepageHeroSection } from "./HomepageHeroSection";
import { HERO_CONTENT } from "./content/heroContent";

describe("HomepageHeroSection", () => {
  it("renders the two-tone hero copy, CTA anchors, and the illustrated banner", () => {
    render(<HomepageHeroSection isActive motionEnabled />);

    expect(screen.getByText(HERO_CONTENT.eyebrow)).toBeInTheDocument();
    expect(screen.getByText(HERO_CONTENT.headlineLineOne)).toHaveClass(
      "hp-hero__headline-line--dark",
    );
    expect(screen.getByText(HERO_CONTENT.headlineLineTwo)).toHaveClass(
      "hp-hero__headline-line--green",
    );
    expect(screen.getByText(HERO_CONTENT.subtext)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: HERO_CONTENT.primaryCta }),
    ).toHaveAttribute("href", HERO_CONTENT.primaryHref);
    expect(
      screen.getByRole("link", { name: HERO_CONTENT.secondaryCta }),
    ).toHaveAttribute("href", HERO_CONTENT.secondaryHref);
    // The retired role badges + GlassScreenshotFrame chrome are gone;
    // the visual is now a single illustrated banner.
    expect(
      screen.getByRole("img", {
        name: /garden centre owner using BloomSuite on a tablet/i,
      }),
    ).toHaveClass("hp-hero__banner");
  });

  it("marks fallback mode so CSS can keep the banner static", () => {
    render(<HomepageHeroSection isActive motionEnabled={false} />);

    expect(screen.getByTestId("homepage-hero")).toHaveAttribute(
      "data-motion-enabled",
      "false",
    );
  });
});
