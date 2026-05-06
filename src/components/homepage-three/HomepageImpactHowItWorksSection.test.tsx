import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { HomepageImpactHowItWorksSection } from "./HomepageImpactHowItWorksSection";
import {
  HOW_IT_WORKS_SCREENSHOT,
  HOW_IT_WORKS_STEPS,
  IMPACT_SECTION_HEADER,
} from "./content/impactHowItWorksContent";

// The original "Real Impact / Why Teams Choose BloomSuite" stats block
// (40% / 3× / 10K+ / 99.9%) is hidden until verified numbers are
// available. IMPACT_SECTION_HEADER now drives the Getting Started header
// above the 3-step onboarding panel ("Up and running in a week.").
describe("HomepageImpactHowItWorksSection", () => {
  it("renders the Getting Started header and no impact stat cards", () => {
    const { container } = render(
      <HomepageImpactHowItWorksSection isActive={false} motionEnabled />,
    );

    expect(screen.getByText(IMPACT_SECTION_HEADER.eyebrow)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: IMPACT_SECTION_HEADER.headline }),
    ).toBeInTheDocument();
    expect(screen.getByText(IMPACT_SECTION_HEADER.subtext)).toBeInTheDocument();

    expect(container.querySelectorAll(".hp-impact-stat-card")).toHaveLength(0);
    expect(container.querySelector(".hp-impact-stats")).toBeNull();
  });

  it("renders the onboarding screenshot placeholder and accepts a real source", () => {
    const { rerender } = render(
      <HomepageImpactHowItWorksSection
        isActive
        motionEnabled
        screenshotSrc={undefined}
      />,
    );

    expect(
      screen.getByText(HOW_IT_WORKS_SCREENSHOT.chromeUrl),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: HOW_IT_WORKS_SCREENSHOT.alt }),
    ).toHaveTextContent(HOW_IT_WORKS_SCREENSHOT.label);

    rerender(
      <HomepageImpactHowItWorksSection
        isActive
        motionEnabled
        screenshotSrc="/onboarding.png"
      />,
    );

    expect(screen.getByAltText(HOW_IT_WORKS_SCREENSHOT.alt)).toHaveAttribute(
      "src",
      "/onboarding.png",
    );
    expect(screen.queryByText(HOW_IT_WORKS_SCREENSHOT.label)).toBeNull();
  });

  it("renders three numbered step cards with stagger metadata", () => {
    render(<HomepageImpactHowItWorksSection isActive motionEnabled />);

    const steps = screen.getByLabelText("Three setup steps");
    const stepCards = within(steps).getAllByRole("article");

    expect(stepCards).toHaveLength(HOW_IT_WORKS_STEPS.length);
    for (const [index, step] of HOW_IT_WORKS_STEPS.entries()) {
      expect(
        within(stepCards[index]).getByLabelText(`Step ${step.stepLabel}`),
      ).toHaveTextContent(step.stepLabel);
      expect(
        screen.getByRole("heading", { name: step.title }),
      ).toBeInTheDocument();
      expect(screen.getByText(step.description)).toBeInTheDocument();
      expect(stepCards[index]).toHaveStyle(
        `--hp-how-step-delay: ${step.delayMs}ms`,
      );
    }
  });
});
