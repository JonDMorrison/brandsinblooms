import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { HomepageCrmShowcaseSection } from "./HomepageCrmShowcaseSection";
import {
  CRM_CALLOUTS,
  CRM_SHOWCASE_HEADER,
} from "./content/crmShowcaseContent";

const CRM_DASHBOARD_SCREENSHOT_ALT =
  "BloomSuite CRM Dashboard — customer management, campaigns, analytics, and AI assistant";

describe("HomepageCrmShowcaseSection", () => {
  it("renders the compact left-aligned header and real screenshot", () => {
    render(<HomepageCrmShowcaseSection isActive motionEnabled />);

    expect(screen.getByText(CRM_SHOWCASE_HEADER.eyebrow)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: CRM_SHOWCASE_HEADER.headline }),
    ).toBeInTheDocument();
    expect(screen.getByText(CRM_SHOWCASE_HEADER.subtext)).toBeInTheDocument();
    expect(screen.getByText("app.bloomsuite.com")).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: CRM_DASHBOARD_SCREENSHOT_ALT,
      }),
    ).toHaveAttribute("src", "/homepage/section-1.png");
  });

  it("renders three staggered callout cards with accent-ready classes", () => {
    render(<HomepageCrmShowcaseSection isActive motionEnabled />);

    const calloutRegion = screen.getByLabelText("CRM feature callouts");
    const callouts = within(calloutRegion).getAllByRole("article");

    expect(callouts).toHaveLength(CRM_CALLOUTS.length);
    for (const [index, callout] of CRM_CALLOUTS.entries()) {
      expect(
        screen.getByRole("heading", { name: callout.title }),
      ).toBeInTheDocument();
      expect(screen.getByText(callout.description)).toBeInTheDocument();
      expect(callouts[index]).toHaveClass("hp-crm-callout");
      expect(callouts[index]).toHaveStyle(
        `--hp-crm-callout-delay: ${callout.delayMs}ms`,
      );
    }
  });

  it("does not render the trust-metrics dl when CRM_TRUST_METRICS is empty", () => {
    // The 4.9/5 / 99.9% / < 2 min strip was hidden until verified — the
    // metrics array is empty and HomepageCrmShowcaseSection conditionally
    // omits the <dl> entirely. Asserting absence keeps a regression
    // (e.g. someone re-adds an empty <dl>) from quietly slipping past.
    render(<HomepageCrmShowcaseSection isActive motionEnabled />);

    expect(screen.queryByLabelText("CRM trust metrics")).toBeNull();
  });

  it("accepts a real screenshot source without changing the frame API", () => {
    render(
      <HomepageCrmShowcaseSection
        isActive
        motionEnabled
        screenshotSrc="/crm-dashboard.png"
      />,
    );

    expect(screen.getByAltText(CRM_DASHBOARD_SCREENSHOT_ALT)).toHaveAttribute(
      "src",
      "/crm-dashboard.png",
    );
  });

  it("marks fallback mode for simple fade rendering", () => {
    render(<HomepageCrmShowcaseSection isActive motionEnabled={false} />);

    expect(screen.getByTestId("homepage-crm-showcase")).toHaveAttribute(
      "data-motion-enabled",
      "false",
    );
  });
});
