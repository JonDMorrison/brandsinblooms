import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { HomepageImpactHowItWorksSection } from "./HomepageImpactHowItWorksSection";
import {
  HOW_IT_WORKS_HEADER,
  HOW_IT_WORKS_SCREENSHOT,
  HOW_IT_WORKS_STEPS,
  IMPACT_SECTION_HEADER,
  IMPACT_STATS,
} from "./content/impactHowItWorksContent";

describe("HomepageImpactHowItWorksSection", () => {
  it("renders the centered impact header and inactive zeroed counters before section entry", () => {
    const { container } = render(
      <HomepageImpactHowItWorksSection isActive={false} motionEnabled />,
    );

    expect(screen.getByText(IMPACT_SECTION_HEADER.eyebrow)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: IMPACT_SECTION_HEADER.headline }),
    ).toBeInTheDocument();
    expect(screen.getByText(IMPACT_SECTION_HEADER.subtext)).toBeInTheDocument();

    const statCards = Array.from(
      container.querySelectorAll(".hp-impact-stat-card"),
    );
    expect(statCards).toHaveLength(IMPACT_STATS.length);
    for (const [index, stat] of IMPACT_STATS.entries()) {
      expect(statCards[index]).toHaveAttribute(
        "data-counter-target",
        `${stat.value.toLocaleString(undefined, {
          maximumFractionDigits: stat.decimals ?? 0,
          minimumFractionDigits: stat.decimals ?? 0,
        })}${stat.suffix}`,
      );
      expect(statCards[index]).toHaveAttribute(
        "data-counter-duration-ms",
        "1200",
      );
      expect(statCards[index]).toHaveAttribute(
        "data-counter-delay-ms",
        String(stat.delayMs),
      );
      expect(
        within(statCards[index] as HTMLElement).getByText(stat.label),
      ).toBeInTheDocument();
      expect(
        within(statCards[index] as HTMLElement).getByText(
          `${(0).toLocaleString(undefined, {
            maximumFractionDigits: stat.decimals ?? 0,
            minimumFractionDigits: stat.decimals ?? 0,
          })}${stat.suffix}`,
        ),
      ).toBeInTheDocument();
      expect(
        statCards[index].querySelector(".hp-stat-card__sr-value")?.textContent,
      ).toBe("");
    }
  });

  it("renders final counter values and polite screen-reader announcements in static mode", () => {
    const { container } = render(
      <HomepageImpactHowItWorksSection isActive motionEnabled={false} />,
    );

    const statCards = Array.from(
      container.querySelectorAll(".hp-impact-stat-card"),
    );

    for (const [index, stat] of IMPACT_STATS.entries()) {
      expect(
        within(statCards[index] as HTMLElement).getByText(
          stat.screenReaderValue,
        ),
      ).toHaveAttribute("aria-live", "polite");
      expect(
        within(statCards[index] as HTMLElement).getByText(stat.label),
      ).toBeInTheDocument();
    }
  });

  it("renders the onboarding screenshot placeholder and accepts a real source", () => {
    const { rerender } = render(
      <HomepageImpactHowItWorksSection
        isActive
        motionEnabled
        screenshotSrc={undefined}
      />,
    );

    expect(screen.getByText(HOW_IT_WORKS_HEADER.headline)).toBeInTheDocument();
    expect(screen.getByText(HOW_IT_WORKS_HEADER.subtext)).toBeInTheDocument();
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
