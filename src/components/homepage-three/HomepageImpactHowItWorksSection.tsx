import type { CSSProperties } from "react";
import { MonitorDot } from "lucide-react";
import {
  GlassScreenshotFrame,
  GlassStatCard,
  GlassStepCard,
  SectionHeader,
} from "./glass";
import {
  HOW_IT_WORKS_HEADER,
  HOW_IT_WORKS_SCREENSHOT,
  HOW_IT_WORKS_STEPS,
  IMPACT_SECTION_HEADER,
  IMPACT_STATS,
} from "./content/impactHowItWorksContent";
import "./homepageImpact.css";

interface HomepageImpactHowItWorksSectionProps {
  isActive: boolean;
  motionEnabled: boolean;
  screenshotSrc?: string;
}

export const HomepageImpactHowItWorksSection = ({
  isActive,
  motionEnabled,
  screenshotSrc,
}: HomepageImpactHowItWorksSectionProps) => (
  <div
    className="hp-impact-section"
    data-active={isActive}
    data-motion-enabled={motionEnabled}
    data-homepage-gesture-lock="true"
    data-testid="homepage-impact-how-it-works"
  >
    <div className="hp-impact-section__inner">
      <section className="hp-impact-stats" aria-label="BloomSuite impact stats">
        <SectionHeader
          eyebrow={IMPACT_SECTION_HEADER.eyebrow}
          headline={IMPACT_SECTION_HEADER.headline}
          subtext={IMPACT_SECTION_HEADER.subtext}
          align="center"
          isActive={isActive}
          className="hp-impact-stats__header"
        />

        <div className="hp-impact-stats__grid">
          {IMPACT_STATS.map((stat) => (
            <GlassStatCard
              key={stat.label}
              value={stat.value}
              suffix={stat.suffix}
              label={stat.label}
              decimals={stat.decimals ?? 0}
              durationMs={1200}
              delayMs={stat.delayMs}
              animate={motionEnabled}
              isActive={isActive}
              announceOnComplete
              finalValueLabel={stat.screenReaderValue}
              className="hp-impact-stat-card"
              style={
                {
                  "--hp-impact-stat-delay": `${stat.delayMs}ms`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      </section>

      <section
        className="hp-how-it-works"
        aria-label="How BloomSuite onboarding works"
      >
        <header className="hp-how-it-works__header">
          <h3 className="hp-how-it-works__headline">
            {HOW_IT_WORKS_HEADER.headline}
          </h3>
          <p className="hp-how-it-works__subtext">
            {HOW_IT_WORKS_HEADER.subtext}
          </p>
        </header>

        <div className="hp-how-it-works__body">
          <GlassScreenshotFrame
            src={screenshotSrc}
            alt={HOW_IT_WORKS_SCREENSHOT.alt}
            showChrome
            chromeUrl={HOW_IT_WORKS_SCREENSHOT.chromeUrl}
            placeholderLabel={HOW_IT_WORKS_SCREENSHOT.label}
            placeholderIcon={<MonitorDot aria-hidden="true" />}
            className="hp-how-it-works__screenshot"
          />

          <div
            className="hp-how-it-works__steps"
            aria-label="Three setup steps"
          >
            {HOW_IT_WORKS_STEPS.map((step) => (
              <GlassStepCard
                key={step.stepLabel}
                role="article"
                step={step.step}
                stepLabel={step.stepLabel}
                title={step.title}
                description={step.description}
                className="hp-how-step-card"
                style={
                  {
                    "--hp-how-step-delay": `${step.delayMs}ms`,
                  } as CSSProperties
                }
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  </div>
);

export default HomepageImpactHowItWorksSection;
