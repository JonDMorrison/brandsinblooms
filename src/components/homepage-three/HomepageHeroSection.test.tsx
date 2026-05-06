import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { HomepageHeroSection } from "./HomepageHeroSection";
import { HERO_CONTENT, HERO_ROLE_BADGES } from "./content/heroContent";

describe("HomepageHeroSection", () => {
  it("renders the two-tone hero copy, CTA anchors, and dashboard screenshot", () => {
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
    expect(
      screen.getByRole("img", {
        name: "BloomSuite CRM Dashboard — customer management, campaigns, analytics, and AI assistant",
      }),
    ).toHaveAttribute("src", "/homepage/section-1.png");
    expect(screen.getByText("app.bloomsuite.com")).toBeInTheDocument();
  });

  it("renders one role badge per HERO_ROLE_BADGES entry with distinct float timing", () => {
    render(<HomepageHeroSection isActive motionEnabled />);

    const badgeList = screen.getByRole("list", {
      name: "BloomSuite customer roles",
    });
    const badges = within(badgeList).getAllByRole("listitem");

    expect(badges).toHaveLength(HERO_ROLE_BADGES.length);
    for (const badge of HERO_ROLE_BADGES) {
      expect(screen.getByText(badge.label)).toBeInTheDocument();
    }

    const durations = badges.map((badge) =>
      badge.style.getPropertyValue("--hp-badge-float-duration"),
    );
    expect(new Set(durations).size).toBe(HERO_ROLE_BADGES.length);
  });

  it("marks fallback mode so CSS can keep badges and dashboard static", () => {
    render(<HomepageHeroSection isActive motionEnabled={false} />);

    expect(screen.getByTestId("homepage-hero")).toHaveAttribute(
      "data-motion-enabled",
      "false",
    );
  });
});
