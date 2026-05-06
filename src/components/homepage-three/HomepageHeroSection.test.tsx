import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { HomepageHeroSection } from "./HomepageHeroSection";
import { HERO_ROLE_BADGES } from "./content/heroContent";

describe("HomepageHeroSection", () => {
  it("renders the two-tone hero copy, CTA anchors, and dashboard screenshot", () => {
    render(<HomepageHeroSection isActive motionEnabled />);

    expect(
      screen.getByText("AI-Powered Business Platform"),
    ).toBeInTheDocument();
    expect(screen.getByText("Grow Your Green Business")).toHaveClass(
      "hp-hero__headline-line--dark",
    );
    expect(screen.getByText("With Intelligent CRM")).toHaveClass(
      "hp-hero__headline-line--green",
    );
    expect(
      screen.getByText(
        "The all-in-one CRM, AI assistant, and commerce platform for garden centres, florists, and eco-conscious retailers.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Start Free Trial" }),
    ).toHaveAttribute("href", "#start");
    expect(screen.getByRole("link", { name: "Book a Demo" })).toHaveAttribute(
      "href",
      "#demo",
    );
    expect(
      screen.getByRole("img", {
        name: "BloomSuite CRM Dashboard — customer management, campaigns, analytics, and AI assistant",
      }),
    ).toHaveAttribute("src", "/homepage/section-1.png");
    expect(screen.getByText("app.bloomsuite.com")).toBeInTheDocument();
  });

  it("renders six role badges with distinct float timing metadata", () => {
    render(<HomepageHeroSection isActive motionEnabled />);

    const badgeList = screen.getByRole("list", {
      name: "BloomSuite customer roles",
    });
    const badges = within(badgeList).getAllByRole("listitem");

    expect(badges).toHaveLength(6);
    for (const badge of HERO_ROLE_BADGES) {
      expect(screen.getByText(badge.label)).toBeInTheDocument();
    }

    const durations = badges.map((badge) =>
      badge.style.getPropertyValue("--hp-badge-float-duration"),
    );
    expect(new Set(durations).size).toBe(HERO_ROLE_BADGES.length);
    expect(
      badges.filter((badge) => badge.getAttribute("data-optional") === "true"),
    ).toHaveLength(2);
  });

  it("marks fallback mode so CSS can keep badges and dashboard static", () => {
    render(<HomepageHeroSection isActive motionEnabled={false} />);

    expect(screen.getByTestId("homepage-hero")).toHaveAttribute(
      "data-motion-enabled",
      "false",
    );
  });
});
