import type { CSSProperties } from "react";
import { MonitorDot } from "lucide-react";
import {
  GlassScreenshotFrame,
  GlassStepCard,
  SectionHeader,
} from "./glass";
import {
  HOW_IT_WORKS_SCREENSHOT,
  HOW_IT_WORKS_STEPS,
  IMPACT_SECTION_HEADER,
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
      {/* TEMP: impact stats block (Real Impact / 0% / 0× / 0K+ / 0.0%) hidden
          until verified numbers are available. The IMPACT_SECTION_HEADER now
          drives the Getting Started header above the 3-step onboarding block. */}
      <SectionHeader
        eyebrow={IMPACT_SECTION_HEADER.eyebrow}
        headline={IMPACT_SECTION_HEADER.headline}
        subtext={IMPACT_SECTION_HEADER.subtext}
        align="center"
        isActive={isActive}
        className="hp-how-it-works__section-header"
      />

      <section
        className="hp-how-it-works"
        aria-label="How BloomSuite onboarding works"
      >
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
