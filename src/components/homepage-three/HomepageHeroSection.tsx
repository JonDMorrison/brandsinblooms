import type { CSSProperties } from "react";
import { GlassButton, GlassChip, GlassScreenshotFrame } from "./glass";
import { HERO_CONTENT, HERO_ROLE_BADGES } from "./content/heroContent";
import "./homepageHero.css";

const CRM_DASHBOARD_SCREENSHOT_SRC = "/homepage/section-1.png";
const CRM_DASHBOARD_SCREENSHOT_ALT =
  "BloomSuite CRM Dashboard — customer management, campaigns, analytics, and AI assistant";
const CRM_DASHBOARD_SCREENSHOT_STYLE: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  objectPosition: "top left",
  display: "block",
};

interface HomepageHeroSectionProps {
  isActive: boolean;
  motionEnabled: boolean;
  screenshotSrc?: string;
}

export const HomepageHeroSection = ({
  isActive,
  motionEnabled,
  screenshotSrc,
}: HomepageHeroSectionProps) => (
  <div
    className="hp-hero"
    data-active={isActive}
    data-motion-enabled={motionEnabled}
    data-testid="homepage-hero"
  >
    <div className="hp-hero__copy" aria-labelledby="homepage-hero-title">
      <p className="hp-hero__eyebrow">{HERO_CONTENT.eyebrow}</p>
      <h1 id="homepage-hero-title" className="hp-hero__headline">
        <span className="hp-hero__headline-line hp-hero__headline-line--dark">
          {HERO_CONTENT.headlineLineOne}
        </span>
        <span className="hp-hero__headline-line hp-hero__headline-line--green">
          {HERO_CONTENT.headlineLineTwo}
        </span>
      </h1>
      <p className="hp-hero__subtext">{HERO_CONTENT.subtext}</p>
      <div className="hp-hero__ctas" aria-label="Hero calls to action">
        <GlassButton
          variant="primary"
          size="lg"
          href={HERO_CONTENT.primaryHref}
        >
          {HERO_CONTENT.primaryCta}
        </GlassButton>
        <GlassButton
          variant="secondary"
          size="lg"
          href={HERO_CONTENT.secondaryHref}
        >
          {HERO_CONTENT.secondaryCta}
        </GlassButton>
      </div>
    </div>

    <div
      className="hp-hero__visual"
      aria-label="BloomSuite CRM dashboard preview"
    >
      <GlassScreenshotFrame
        src={screenshotSrc || CRM_DASHBOARD_SCREENSHOT_SRC}
        alt={CRM_DASHBOARD_SCREENSHOT_ALT}
        showChrome
        chromeUrl="app.bloomsuite.com"
        imageLoading="eager"
        imageFetchPriority="high"
        imageStyle={CRM_DASHBOARD_SCREENSHOT_STYLE}
        className="hp-hero-dashboard"
      />

      <ul className="hp-hero-badges" aria-label="BloomSuite customer roles">
        {HERO_ROLE_BADGES.map((badge) => (
          <li
            key={badge.label}
            className="hp-hero-badge"
            data-position={badge.position}
            data-optional={badge.optional ? "true" : "false"}
            style={
              {
                "--hp-badge-delay": `${badge.delayMs}ms`,
                "--hp-badge-float-duration": `${badge.floatDurationMs}ms`,
                "--hp-badge-float-phase": `${badge.floatPhaseMs}ms`,
              } as CSSProperties
            }
          >
            <GlassChip className="hp-hero-badge__chip">
              <span className="hp-hero-badge__dot" aria-hidden="true" />
              {badge.label}
            </GlassChip>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

export default HomepageHeroSection;
