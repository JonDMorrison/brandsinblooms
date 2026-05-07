import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";

import { LandingPageHeader } from "@/components/landing/LandingPageHeader";
import { HomepageAiCapabilitiesSection } from "./HomepageAiCapabilitiesSection";
import { HomepageDifferentiatorsSection } from "./HomepageDifferentiatorsSection";
import { HomepageFeatureHighlightsSection } from "./HomepageFeatureHighlightsSection";
import { HomepageGuideSection } from "./HomepageGuideSection";
import { HomepageHeroSection } from "./HomepageHeroSection";
import { HomepageIntegrationsEcosystemSection } from "./HomepageIntegrationsEcosystemSection";
import { HomepagePricingCtaFooterSection } from "./HomepagePricingCtaFooterSection";
import { HomepageProblemSection } from "./HomepageProblemSection";
import { HOMEPAGE_SEO, HOMEPAGE_STRUCTURED_DATA } from "./homepageSeo";
import { trackHomepageEvent } from "./homepageTelemetry";
import "./homepageThree.css";

const HomepageHead = () => (
  <Helmet>
    <title>{HOMEPAGE_SEO.title}</title>
    <meta name="description" content={HOMEPAGE_SEO.description} />
    <link rel="canonical" href={HOMEPAGE_SEO.url} />
    <link rel="manifest" href="/manifest.webmanifest" />
    <meta property="og:site_name" content="BloomSuite" />
    <meta property="og:title" content={HOMEPAGE_SEO.title} />
    <meta property="og:description" content={HOMEPAGE_SEO.description} />
    <meta property="og:type" content="website" />
    <meta property="og:url" content={HOMEPAGE_SEO.url} />
    <meta property="og:image" content={HOMEPAGE_SEO.imageUrl} />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content={HOMEPAGE_SEO.imageAlt} />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={HOMEPAGE_SEO.title} />
    <meta name="twitter:description" content={HOMEPAGE_SEO.description} />
    <meta name="twitter:image" content={HOMEPAGE_SEO.imageUrl} />
    <meta name="twitter:image:alt" content={HOMEPAGE_SEO.imageAlt} />
    <script type="application/ld+json">
      {JSON.stringify(HOMEPAGE_STRUCTURED_DATA)}
    </script>
  </Helmet>
);

// Scrolling homepage. Each section renders as a normal block in document
// flow; the browser handles scroll. Top nav now comes from the shared
// LandingPageHeader so the homepage matches every other marketing page
// (Pricing, FAQ, About, Features). The previous custom hp-nav + mobile
// glass overlay + skip-link were retired with this swap; LandingPageHeader
// is sticky and accessible without an explicit skip-link.
export const HomepagePresentation = () => {
  const navigate = useNavigate();

  useEffect(() => {
    trackHomepageEvent("page_view", { section: "hero" });
  }, []);

  // Smooth in-page anchor scroll. Restored on unmount.
  useEffect(() => {
    const previous = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "smooth";
    return () => {
      document.documentElement.style.scrollBehavior = previous;
    };
  }, []);

  // Scroll-driven fade-up reveal for every section below the hero.
  // Adds .hp-fade-up to each section after mount, then flips
  // .is-visible the first time the section intersects the viewport
  // (one-shot reveal so sections stay visible after they appear).
  // The hero deliberately is NOT included — it's already on screen
  // at page load. prefers-reduced-motion short-circuits the effect
  // entirely; the @media block in homepageThree.css also no-ops the
  // class transitions if reduced-motion is on (defense in depth).
  useEffect(() => {
    if (typeof window === "undefined") return;
    // matchMedia isn't implemented by jsdom and may be missing in
    // limited runtimes — guard so the page still mounts cleanly there
    // (the fade-up effect simply doesn't run).
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const selectors = [
      ".hp-problem",
      ".hp-guide",
      ".hp-features",
      ".hp-crm-showcase",
      ".hp-ai-showcase",
      ".hp-impact-section",
      ".hp-integrations-ecosystem",
      ".hp-differentiators",
      ".hp-pricing-cta",
    ];
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>(selectors.join(",")),
    );
    for (const el of elements) {
      el.classList.add("hp-fade-up");
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -10% 0px" },
    );
    for (const el of elements) {
      observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  return (
    // hp-token-scope brings the homepage CSS-variable ramp (--hp-green-*,
    // --hp-hover-duration, --hp-ease-hover, etc., declared in
    // homepageTokens.css) into scope for any nav-level CSS that references
    // them.
    <div className="hp-token-scope">
      <HomepageHead />
      <LandingPageHeader onLogin={() => navigate("/auth")} showUserMenu />
      <main
        id="homepage-main-content"
        className="homepage-three homepage-three--scrolling"
        aria-label="BloomSuite homepage"
        data-testid="homepage-shell"
        tabIndex={-1}
      >
        <section
          id="hero"
          className="hp-scroll-section"
          data-section-id="hero"
          aria-label="Hero section"
        >
          <HomepageHeroSection isActive motionEnabled />
        </section>

        <section
          id="problem"
          className="hp-scroll-section"
          data-section-id="problem"
          aria-label="Problem section"
        >
          <HomepageProblemSection isActive motionEnabled />
        </section>

        <section
          id="guide"
          className="hp-scroll-section"
          data-section-id="guide"
          aria-label="Guide section"
        >
          <HomepageGuideSection isActive motionEnabled />
        </section>

        <section
          id="features"
          className="hp-scroll-section"
          data-section-id="features"
          aria-label="Features section"
        >
          <HomepageFeatureHighlightsSection isActive motionEnabled />
        </section>

        <section
          id="ai"
          className="hp-scroll-section"
          data-section-id="ai"
          aria-label="AI section"
        >
          <HomepageAiCapabilitiesSection isActive motionEnabled />
        </section>

        <section
          id="integrations"
          className="hp-scroll-section"
          data-section-id="integrations"
          aria-label="Integrations section"
        >
          <HomepageIntegrationsEcosystemSection isActive motionEnabled />
        </section>

        <section
          id="differentiators"
          className="hp-scroll-section"
          data-section-id="differentiators"
          aria-label="Differentiators section"
        >
          <HomepageDifferentiatorsSection isActive motionEnabled />
        </section>

        <section
          id="start"
          className="hp-scroll-section"
          data-section-id="start"
          aria-label="Pricing and final CTA section"
        >
          <HomepagePricingCtaFooterSection
            isActive
            motionEnabled
            animationsDisabled={false}
            onDisableAnimations={() => {}}
          />
        </section>
      </main>
    </div>
  );
};

export default HomepagePresentation;
