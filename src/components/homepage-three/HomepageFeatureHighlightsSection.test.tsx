import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { HomepageFeatureHighlightsSection } from "./HomepageFeatureHighlightsSection";
import {
  FEATURE_HIGHLIGHTS,
  FEATURE_SECTION_HEADER,
} from "./content/featureHighlightsContent";

describe("HomepageFeatureHighlightsSection", () => {
  it("renders the standard feature section header", () => {
    // The trust strip + 6 logos at the top of the Features section was
    // removed — the full Integrations section further down covers the
    // same ground with more detail. The trust assertions that used to
    // live in this test were removed alongside the markup.
    render(<HomepageFeatureHighlightsSection isActive motionEnabled />);

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

  it("renders accessible feature cards with available screenshots and fallback placeholders", () => {
    render(<HomepageFeatureHighlightsSection isActive motionEnabled />);

    const cards = screen.getAllByRole("article");
    const defaultScreenshotSrcs = {
      "smart-crm": "/homepage/smart-customer-crm.png",
      "campaign-builder": "/homepage/ai-campaign-builder.png",
      "analytics-dashboard": "/homepage/growth-and-analytics.png",
    } as const;

    expect(cards).toHaveLength(FEATURE_HIGHLIGHTS.length);
    for (const [index, feature] of FEATURE_HIGHLIGHTS.entries()) {
      expect(
        screen.getByRole("heading", { name: feature.title }),
      ).toBeInTheDocument();
      expect(screen.getByText(feature.description)).toBeInTheDocument();

      if (feature.id in defaultScreenshotSrcs) {
        expect(
          screen.getByAltText(`${feature.placeholderLabel} preview`),
        ).toHaveAttribute(
          "src",
          defaultScreenshotSrcs[
            feature.id as keyof typeof defaultScreenshotSrcs
          ],
        );
      } else {
        expect(
          screen.getByRole("img", {
            name: `${feature.placeholderLabel} screenshot placeholder`,
          }),
        ).toBeInTheDocument();
      }

      expect(cards[index]).toHaveStyle(
        `--hp-feature-card-delay: ${index * 80}ms`,
      );
    }
  });

  it("accepts real screenshot sources through a single screenshot map prop", () => {
    render(
      <HomepageFeatureHighlightsSection
        isActive
        motionEnabled
        screenshotSrcs={{ "smart-crm": "/customer-dashboard.png" }}
      />,
    );

    // Feature placeholderLabel for smart-crm is "Remember Every Customer"
    // (outcome-led copy rewrite). Alt text + placeholder aria-label
    // follow the same label.
    expect(
      screen.getByAltText("Remember Every Customer preview"),
    ).toHaveAttribute("src", "/customer-dashboard.png");
    expect(
      screen.queryByRole("img", {
        name: "Remember Every Customer screenshot placeholder",
      }),
    ).toBeNull();
  });

  it("marks fallback mode for static card rendering", () => {
    render(<HomepageFeatureHighlightsSection isActive motionEnabled={false} />);

    expect(screen.getByTestId("homepage-feature-highlights")).toHaveAttribute(
      "data-motion-enabled",
      "false",
    );
  });
});
