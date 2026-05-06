import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import {
  GlassButton,
  GlassCard,
  GlassChip,
  GlassScreenshotFrame,
  GlassStatCard,
  GlassStepCard,
  SectionHeader,
} from ".";

describe("homepage glass component library", () => {
  it("renders typed glass containers, buttons, and chips with variants", () => {
    render(
      <div className="hp-token-scope">
        <GlassCard variant="elevated" padding="lg">
          Card content
        </GlassCard>
        <GlassButton variant="primary" size="lg">
          Start Free Trial
        </GlassButton>
        <GlassButton variant="ghost" href="/contact">
          Book a Demo
        </GlassButton>
        <GlassChip variant="green">Live</GlassChip>
      </div>,
    );

    expect(screen.getByText("Card content")).toHaveClass(
      "hp-glass-card--elevated",
    );
    expect(
      screen.getByRole("button", { name: "Start Free Trial" }),
    ).toHaveClass("hp-glass-button--primary");
    expect(screen.getByRole("link", { name: "Book a Demo" })).toHaveAttribute(
      "href",
      "/contact",
    );
    expect(screen.getByText("Live")).toHaveClass("hp-glass-chip--green");
  });

  it("renders screenshot, stat, step, and section header primitives", () => {
    render(
      <div className="hp-token-scope">
        <GlassScreenshotFrame
          src="/preview.png"
          alt="Dashboard preview"
          showChrome
        />
        <GlassStatCard
          value={42}
          label="Campaign lift"
          suffix="%"
          isActive={false}
        />
        <GlassStepCard
          step={2}
          title="Plan"
          description="Choose a seasonal audience."
        />
        <SectionHeader
          eyebrow="Features"
          headline="Built for focus"
          subtext="Reusable section header."
          align="left"
        />
      </div>,
    );

    expect(screen.getByAltText("Dashboard preview")).toHaveClass(
      "hp-screenshot-frame__image",
    );
    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.getByLabelText("Step 2")).toHaveTextContent("2");
    expect(screen.getByText("Built for focus")).toBeInTheDocument();
  });
});
