import { useEffect, useState, type MouseEvent } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";

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
import {
  HOMEPAGE_NAV_ITEMS,
  type HomepageNavItemConfig,
} from "./sectionConfig";
import bloomsuiteLogo from "@/assets/bloomsuite-logo-correct.png";
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

const BloomSuiteMark = () => (
  <img src={bloomsuiteLogo} alt="BloomSuite" className="hp-logo-mark" />
);

interface NavigationShellProps {
  mobileMenuOpen: boolean;
  onMobileMenuToggle: () => void;
  onMobileMenuClose: () => void;
}

const NavigationShell = ({
  mobileMenuOpen,
  onMobileMenuToggle,
  onMobileMenuClose,
}: NavigationShellProps) => {
  const navigate = useNavigate();

  const navigateToAuth = () => {
    trackHomepageEvent("cta_click", {
      label: "Start Free Trial",
      href: "/auth",
      source: "top_nav",
    });
    navigate("/auth");
  };

  const navigateToDemo = () => {
    trackHomepageEvent("cta_click", {
      label: "Book a Demo",
      href: "/contact",
      source: "top_nav",
    });
    navigate("/contact");
  };

  const handleNavItemClick = (
    item: HomepageNavItemConfig,
    event: MouseEvent<HTMLAnchorElement>,
  ) => {
    if (item.targetHref) {
      event.preventDefault();
      trackHomepageEvent("cta_click", {
        label: item.label,
        href: item.targetHref,
        source: "top_nav",
      });
      navigate(item.targetHref);
      onMobileMenuClose();
      return;
    }
    // In-page anchors: let the browser handle the scroll. CSS sets
    // scroll-behavior: smooth on <html> and scroll-margin-top on each
    // section so anchored jumps tuck cleanly under the fixed nav.
    onMobileMenuClose();
  };

  return (
    <>
      <nav className="hp-nav" aria-label="Homepage navigation">
        <div className="hp-nav__inner">
          <a
            className="hp-brand"
            href="#hero"
            aria-label="Go to BloomSuite hero section"
          >
            <BloomSuiteMark />
            <span>BloomSuite</span>
          </a>

          <div className="hp-nav__links" aria-label="Homepage sections">
            {HOMEPAGE_NAV_ITEMS.map((item) => (
              <a
                key={item.category}
                className="hp-nav__link"
                href={item.targetHref ?? `#${item.targetSlug}`}
                onClick={(event) => handleNavItemClick(item, event)}
              >
                <span>{item.label}</span>
              </a>
            ))}
          </div>

          <div className="hp-nav__actions">
            <button
              type="button"
              className="hp-demo-link"
              onClick={navigateToDemo}
            >
              Book a Demo
            </button>
            <button
              type="button"
              className="hp-trial-button"
              onClick={navigateToAuth}
            >
              Start Free Trial
            </button>
          </div>

          <button
            type="button"
            className="hp-menu-button"
            onClick={onMobileMenuToggle}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <X aria-hidden="true" />
            ) : (
              <Menu aria-hidden="true" />
            )}
          </button>
        </div>
      </nav>

      <div
        className="hp-mobile-overlay"
        data-open={mobileMenuOpen}
        aria-hidden={!mobileMenuOpen}
      >
        <div className="hp-mobile-overlay__panel">
          <div className="hp-mobile-overlay__links">
            {HOMEPAGE_NAV_ITEMS.map((item) => (
              <a
                key={item.category}
                className="hp-mobile-overlay__link"
                href={item.targetHref ?? `#${item.targetSlug}`}
                onClick={(event) => handleNavItemClick(item, event)}
                tabIndex={mobileMenuOpen ? 0 : -1}
              >
                {item.label}
              </a>
            ))}
          </div>
          <div className="hp-mobile-overlay__actions">
            <button
              type="button"
              className="hp-mobile-overlay__cta hp-mobile-overlay__cta--primary"
              onClick={navigateToAuth}
              tabIndex={mobileMenuOpen ? 0 : -1}
            >
              Start Free Trial
            </button>
            <button
              type="button"
              className="hp-mobile-overlay__cta hp-mobile-overlay__cta--ghost"
              onClick={navigateToDemo}
              tabIndex={mobileMenuOpen ? 0 : -1}
            >
              Book a Demo
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// Scrolling rebuild of the homepage. The scroll-engine, gesture lock,
// progress rail, and per-section transition machinery from the previous
// scroll-locked design were removed. Each section now renders as a normal
// block in document flow; the browser handles scroll. The Pricing nav
// item routes to /pricing via the targetHref shortcut added in
// commit 05b25820. Hero, Features, AI, Integrations, and Pricing sections
// reuse their existing components untouched. Three new sections —
// Problem, Guide, and Differentiators — bring back the messaging spine
// from the old landing page using the same glass + token design system.
export const HomepagePresentation = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  return (
    <>
      <HomepageHead />
      <a className="hp-skip-link" href="#homepage-main-content">
        Skip to content
      </a>
      <NavigationShell
        mobileMenuOpen={mobileMenuOpen}
        onMobileMenuToggle={() => setMobileMenuOpen((open) => !open)}
        onMobileMenuClose={() => setMobileMenuOpen(false)}
      />
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
    </>
  );
};

export default HomepagePresentation;
