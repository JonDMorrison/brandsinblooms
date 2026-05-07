import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { HomepageFeatureHighlightsSection } from "./HomepageFeatureHighlightsSection";
import {
  FEATURE_HIGHLIGHTS,
  FEATURE_SECTION_HEADER,
} from "./content/featureHighlightsContent";

const renderInRouter = (ui: React.ReactNode) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe("HomepageFeatureHighlightsSection", () => {
  it("renders the standard feature section header", () => {
    renderInRouter(<HomepageFeatureHighlightsSection isActive motionEnabled />);

    expect(
      screen.getByText(FEATURE_SECTION_HEADER.eyebrow),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: FEATURE_SECTION_HEADER.headline }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(FEATURE_SECTION_HEADER.subtext),
    ).toBeInTheDocument();
  });

  it("renders accessible feature cards with bundled illustrations for every id", () => {
    renderInRouter(<HomepageFeatureHighlightsSection isActive motionEnabled />);

    const cards = screen.getAllByRole("article");

    expect(cards).toHaveLength(FEATURE_HIGHLIGHTS.length);
    for (const [index, feature] of FEATURE_HIGHLIGHTS.entries()) {
      expect(
        screen.getByRole("heading", { name: feature.title }),
      ).toBeInTheDocument();
      expect(screen.getByText(feature.description)).toBeInTheDocument();

      expect(
        screen.getByAltText(`${feature.placeholderLabel} illustration`),
      ).toBeInTheDocument();

      expect(cards[index]).toHaveStyle(
        `--hp-feature-card-delay: ${index * 80}ms`,
      );
    }
  });

  it("wires each card to its /features/<slug> route", () => {
    renderInRouter(<HomepageFeatureHighlightsSection isActive motionEnabled />);
    // Smart CRM card → /features/customer-crm (the live Stage 1 route).
    // The other 5 slugs are wired even though only customer-crm has a
    // resolved content config in Stage 1.
    const expectedSlugs: Record<string, string> = {
      "smart-crm": "customer-crm",
      "campaign-builder": "campaigns",
      "inventory-orders": "inventory-orders",
      "page-editor": "storefront",
      "analytics-dashboard": "analytics",
      "multi-store": "unified-platform",
    };
    for (const feature of FEATURE_HIGHLIGHTS) {
      const link = screen.getByRole("link", { name: feature.title });
      expect(link).toHaveAttribute(
        "href",
        `/features/${expectedSlugs[feature.id]}`,
      );
    }
  });

  it("accepts override screenshot sources through the screenshot map prop", () => {
    renderInRouter(
      <HomepageFeatureHighlightsSection
        isActive
        motionEnabled
        screenshotSrcs={{ "smart-crm": "/customer-dashboard.png" }}
      />,
    );

    expect(
      screen.getByAltText("Remember Every Customer illustration"),
    ).toHaveAttribute("src", "/customer-dashboard.png");
  });

  it("marks fallback mode for static card rendering", () => {
    renderInRouter(
      <HomepageFeatureHighlightsSection isActive motionEnabled={false} />,
    );

    expect(screen.getByTestId("homepage-feature-highlights")).toHaveAttribute(
      "data-motion-enabled",
      "false",
    );
  });
});
