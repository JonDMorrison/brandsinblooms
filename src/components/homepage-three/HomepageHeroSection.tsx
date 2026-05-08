import { useEffect, useRef } from "react";
import { GlassButton } from "./glass";
import { HERO_CONTENT, HERO_ROTATING_PHRASES } from "./content/heroContent";
import { useTypewriter } from "@/hooks/useTypewriter";
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
}: HomepageHeroSectionProps) => {
  const heroRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLImageElement>(null);
  const rotatingText = useTypewriter({
    phrases: [...HERO_ROTATING_PHRASES],
  });

  // Subtle scroll parallax: the banner moves at 70% of scroll speed so
  // the hero feels grounded while the rest of the page slides past it.
  // Direct DOM manipulation via refs avoids re-rendering on every
  // scroll tick. Skipped when prefers-reduced-motion is on.
  useEffect(() => {
    if (typeof window === "undefined") return;
    // matchMedia isn't implemented by jsdom and may be missing in
    // limited runtimes — guard so the component still mounts cleanly
    // there (the parallax effect simply doesn't run).
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    let rafId: number | null = null;
    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        const heroEl = heroRef.current;
        const bannerEl = bannerRef.current;
        if (!heroEl || !bannerEl) return;
        const rect = heroEl.getBoundingClientRect();
        const offset = -rect.top * 0.3;
        bannerEl.style.transform = `translateY(${offset}px)`;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    // Run once on mount so the initial position reflects current scroll.
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  return (
    <div
      ref={heroRef}
      className="hp-hero"
      data-active={isActive}
      data-motion-enabled={motionEnabled}
      data-testid="homepage-hero"
    >
      <div className="hp-hero__copy" aria-labelledby="homepage-hero-title">
        <p className="hp-hero__eyebrow">{HERO_CONTENT.eyebrow}</p>
        <h1 id="homepage-hero-title" className="hp-hero__headline">
          <span className="hp-hero__headline-line hp-hero__headline-line--rotating hp-hero__headline-line--dark">
            <span
              className="hp-hero__rotating-text"
              aria-live="polite"
              aria-atomic="true"
            >
              {rotatingText}
            </span>
            <span className="hp-hero__cursor" aria-hidden="true">
              |
            </span>
          </span>
          <span className="hp-hero__headline-line hp-hero__headline-line--static hp-hero__headline-line--green">
            {HERO_CONTENT.staticTagline}
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
          ref={bannerRef}
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
};

export default HomepageHeroSection;
