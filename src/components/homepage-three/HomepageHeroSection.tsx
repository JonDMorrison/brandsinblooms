import { GlassButton } from "./glass";
import { HERO_CONTENT } from "./content/heroContent";
import heroBanner from "@/assets/hero-banner.png";
import "./homepageHero.css";

interface HomepageHeroSectionProps {
  isActive: boolean;
  motionEnabled: boolean;
  screenshotSrc?: string;
}

export const HomepageHeroSection = ({
  isActive,
  motionEnabled,
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

    <div className="hp-hero__visual" aria-label="BloomSuite hero illustration">
      <img
        src={heroBanner}
        alt="A garden centre owner using BloomSuite on a tablet, surrounded by floating panels showing campaigns, schedule, conversion tracking, and social posts"
        className="hp-hero__banner"
        loading="eager"
        fetchPriority="high"
        decoding="async"
      />
    </div>
  </div>
);

export default HomepageHeroSection;
