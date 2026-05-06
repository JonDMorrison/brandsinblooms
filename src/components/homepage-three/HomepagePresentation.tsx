import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  TouchEvent,
} from "react";
import { Menu, X } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { HomepageAiCapabilitiesSection } from "./HomepageAiCapabilitiesSection";
import { HomepageCrmShowcaseSection } from "./HomepageCrmShowcaseSection";
import { HomepageFeatureHighlightsSection } from "./HomepageFeatureHighlightsSection";
import { HomepageHeroSection } from "./HomepageHeroSection";
import { HomepageImpactHowItWorksSection } from "./HomepageImpactHowItWorksSection";
import { HomepageIntegrationsEcosystemSection } from "./HomepageIntegrationsEcosystemSection";
import { HomepagePricingCtaFooterSection } from "./HomepagePricingCtaFooterSection";
import { HomepageTestimonialsSocialProofSection } from "./HomepageTestimonialsSocialProofSection";
import { HOMEPAGE_SEO, HOMEPAGE_STRUCTURED_DATA } from "./homepageSeo";
import { trackHomepageEvent } from "./homepageTelemetry";
import { useDeviceTier } from "./performance/useDeviceTier";
import {
  getHashForSectionSlug,
  getSectionIndexFromHash,
  type SectionInputKind,
  type TransitionType,
  useSectionEngine,
} from "./sectionEngine";
import {
  HOMEPAGE_NAV_ITEMS,
  HOMEPAGE_SECTIONS,
  HOMEPAGE_TRANSITIONS,
  getHomepageNavTargetIndex,
} from "./sectionConfig";
import "./homepageThree.css";

const LazyNanoLeafParticles = lazy(() =>
  import("./particles/NanoLeafParticles").then((module) => ({
    default: module.NanoLeafParticles,
  })),
);

const WHEEL_THRESHOLD = 72;
const WHEEL_QUIET_MS = 260;
const TOUCH_THRESHOLD_PX = 60;
const DISSOLVE_BACKGROUND_PORTION = 0.625;

const clampProgress = (progress: number) => Math.min(Math.max(progress, 0), 1);

const createCubicBezier = (x1: number, y1: number, x2: number, y2: number) => {
  const sampleCurve = (point1: number, point2: number, time: number) => {
    const inverseTime = 1 - time;
    return (
      3 * inverseTime * inverseTime * time * point1 +
      3 * inverseTime * time * time * point2 +
      time * time * time
    );
  };

  return (progress: number) => {
    const target = clampProgress(progress);
    let lowerBound = 0;
    let upperBound = 1;
    let time = target;

    for (let iteration = 0; iteration < 8; iteration += 1) {
      const x = sampleCurve(x1, x2, time);

      if (Math.abs(x - target) < 0.001) {
        break;
      }

      if (x < target) {
        lowerBound = time;
      } else {
        upperBound = time;
      }

      time = (lowerBound + upperBound) / 2;
    }

    return sampleCurve(y1, y2, time);
  };
};

const easeEntry = createCubicBezier(0.16, 1, 0.3, 1);
const easeExit = createCubicBezier(0.7, 0, 0.84, 0);
const easeHover = createCubicBezier(0.4, 0, 0.2, 1);

const progressInRange = (progress: number, start: number, end: number) => {
  if (end <= start) {
    return progress >= end ? 1 : 0;
  }

  return clampProgress((progress - start) / (end - start));
};

const getWheelDelta = (event: WheelEvent) => {
  const modeMultiplier =
    event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
  return event.deltaY * modeMultiplier;
};

const getGestureLockedElement = (target: EventTarget | null) =>
  target instanceof Element
    ? target.closest<HTMLElement>("[data-homepage-gesture-lock='true']")
    : null;

const canGestureLockedElementScroll = (element: HTMLElement, deltaY = 0) => {
  const hasScrollableContent = element.scrollHeight > element.clientHeight + 1;

  if (!hasScrollableContent) {
    return false;
  }

  if (deltaY > 0) {
    return element.scrollTop + element.clientHeight < element.scrollHeight - 1;
  }

  if (deltaY < 0) {
    return element.scrollTop > 1;
  }

  return true;
};

const getInitialSectionIndex = () => {
  if (typeof window === "undefined") {
    return 0;
  }

  return (
    getSectionIndexFromHash(
      window.location.hash,
      HOMEPAGE_SECTIONS.map((section) => section.slug),
    ) ?? 0
  );
};

const getSectionFrameStyle = ({
  isCurrent,
  isPrevious,
  transitionType,
  progress,
  direction,
  motionEnabled,
}: {
  isCurrent: boolean;
  isPrevious: boolean;
  transitionType: TransitionType;
  progress: number;
  direction: "forward" | "backward" | "none";
  motionEnabled: boolean;
}): CSSProperties => {
  const safeProgress = clampProgress(progress);
  const directionSign = direction === "backward" ? -1 : 1;
  const entryProgress = easeEntry(safeProgress);
  const exitProgress = easeExit(safeProgress);

  const withContentOpacity = (
    style: CSSProperties,
    contentOpacity = 1,
  ): CSSProperties =>
    ({
      ...style,
      "--hp-section-content-opacity": contentOpacity,
    }) as CSSProperties;

  if (!isCurrent && !isPrevious) {
    return withContentOpacity({
      opacity: 0,
      transform: "translate3d(0, 0, 0)",
      pointerEvents: "none",
      visibility: "hidden",
    });
  }

  if (!motionEnabled) {
    return withContentOpacity({
      opacity: isPrevious ? 1 - exitProgress : entryProgress,
      transform: "translate3d(0, 0, 0)",
      pointerEvents: isCurrent ? "auto" : "none",
      visibility: "visible",
    });
  }

  if (transitionType === "dissolve") {
    const backgroundProgress = progressInRange(
      safeProgress,
      0,
      DISSOLVE_BACKGROUND_PORTION,
    );
    const contentProgress = progressInRange(
      safeProgress,
      DISSOLVE_BACKGROUND_PORTION,
      1,
    );
    const outgoingOpacity = 1 - easeExit(backgroundProgress);
    const incomingOpacity = easeEntry(backgroundProgress);
    const currentContentOpacity = easeEntry(contentProgress);
    const previousContentOpacity = 1 - easeExit(backgroundProgress);

    return withContentOpacity(
      {
        opacity: isPrevious ? outgoingOpacity : incomingOpacity,
        transform: "translate3d(0, 0, 0)",
        pointerEvents: isCurrent ? "auto" : "none",
        visibility: "visible",
      },
      isPrevious ? previousContentOpacity : currentContentOpacity,
    );
  }

  if (transitionType === "scale-fade") {
    const outgoingScale = 1 - exitProgress * 0.04;
    const incomingScale = 1.04 - entryProgress * 0.04;

    return withContentOpacity({
      opacity: isPrevious ? 1 - exitProgress : entryProgress,
      transform: `scale(${isPrevious ? outgoingScale : incomingScale})`,
      pointerEvents: isCurrent ? "auto" : "none",
      visibility: "visible",
    });
  }

  if (transitionType === "crossfade-hold") {
    return withContentOpacity(
      {
        opacity: isPrevious ? 1 - exitProgress : entryProgress,
        transform: "translate3d(0, 0, 0)",
        pointerEvents: isCurrent ? "auto" : "none",
        visibility: "visible",
      },
      isPrevious ? 1 - exitProgress : entryProgress,
    );
  }

  const outgoingTranslate = -36 * exitProgress * directionSign;
  const incomingTranslate = 32 * (1 - entryProgress) * directionSign;

  return withContentOpacity({
    opacity: isPrevious
      ? 1 - exitProgress * 0.22
      : Math.min(entryProgress * 1.08, 1),
    transform: `translate3d(0, ${isPrevious ? outgoingTranslate : incomingTranslate}%, 0)`,
    pointerEvents: isCurrent ? "auto" : "none",
    visibility: "visible",
  });
};

const getInterpolatedParticleDensity = ({
  currentDensity,
  previousDensity,
  progress,
}: {
  currentDensity: number;
  previousDensity?: number;
  progress: number;
}) => {
  if (previousDensity === undefined) {
    return currentDensity;
  }

  const easedProgress = easeHover(progress);
  return previousDensity + (currentDensity - previousDensity) * easedProgress;
};

const getParticleTintForTransition = ({
  currentTint,
  previousTint,
  progress,
}: {
  currentTint: (typeof HOMEPAGE_SECTIONS)[number]["particleTint"];
  previousTint?: (typeof HOMEPAGE_SECTIONS)[number]["particleTint"];
  progress: number;
}) => {
  if (!previousTint) {
    return currentTint;
  }

  return progress < 0.5 ? previousTint : currentTint;
};

const BloomSuiteMark = () => (
  <svg
    aria-hidden="true"
    className="hp-logo-mark"
    viewBox="0 0 44 44"
    role="img"
  >
    <path
      className="hp-logo-mark__stem"
      d="M22 36V17"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="3.5"
    />
    <path
      className="hp-logo-mark__leaf"
      d="M22 20C12 20 8 14 9 7c7-1 13 3 13 13Z"
      fill="currentColor"
    />
    <path
      className="hp-logo-mark__leaf hp-logo-mark__leaf--right"
      d="M22 23c10 0 14-6 13-13-7-1-13 3-13 13Z"
      fill="currentColor"
    />
    <circle
      className="hp-logo-mark__seed"
      cx="22"
      cy="37"
      r="3.25"
      fill="currentColor"
    />
  </svg>
);

interface NavigationShellProps {
  activeCategory: string;
  mobileMenuOpen: boolean;
  onMobileMenuToggle: () => void;
  onMobileMenuClose: () => void;
  onNavigateToSection: (
    sectionIndex: number,
    inputKind: SectionInputKind,
  ) => void;
}

const NavigationShell = ({
  activeCategory,
  mobileMenuOpen,
  onMobileMenuToggle,
  onMobileMenuClose,
  onNavigateToSection,
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
    targetSlug: string,
    inputKind: SectionInputKind,
  ) => {
    onNavigateToSection(getHomepageNavTargetIndex(targetSlug), inputKind);
    onMobileMenuClose();
  };

  return (
    <>
      <nav className="hp-nav" aria-label="Homepage navigation">
        <div className="hp-nav__inner">
          <button
            type="button"
            className="hp-brand"
            onClick={() => onNavigateToSection(0, "nav")}
            aria-label="Go to BloomSuite hero section"
          >
            <BloomSuiteMark />
            <span>BloomSuite</span>
          </button>

          <div className="hp-nav__links" aria-label="Homepage sections">
            {HOMEPAGE_NAV_ITEMS.map((item) => (
              <button
                key={item.category}
                type="button"
                className="hp-nav__link"
                data-active={activeCategory === item.category}
                onClick={() => handleNavItemClick(item.targetSlug, "nav")}
              >
                <span>{item.label}</span>
              </button>
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
              <button
                key={item.category}
                type="button"
                className="hp-mobile-overlay__link"
                data-active={activeCategory === item.category}
                onClick={() => handleNavItemClick(item.targetSlug, "nav")}
                tabIndex={mobileMenuOpen ? 0 : -1}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="hp-mobile-overlay__actions">
            <button
              type="button"
              className="hp-trial-button"
              onClick={navigateToAuth}
              tabIndex={mobileMenuOpen ? 0 : -1}
            >
              Start Free Trial
            </button>
            <button
              type="button"
              className="hp-demo-link hp-demo-link--mobile"
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

interface ProgressIndicatorProps {
  currentSection: number;
  onNavigateToSection: (
    sectionIndex: number,
    inputKind: SectionInputKind,
  ) => void;
}

const ProgressIndicator = ({
  currentSection,
  onNavigateToSection,
}: ProgressIndicatorProps) => (
  <nav className="hp-progress" aria-label="Homepage section progress">
    {HOMEPAGE_SECTIONS.map((section, index) => {
      const state =
        index === currentSection
          ? "active"
          : index < currentSection
            ? "completed"
            : "upcoming";

      return (
        <button
          key={section.id}
          type="button"
          className="hp-progress__dot"
          data-state={state}
          aria-label={`Navigate to ${section.name}`}
          onClick={() => onNavigateToSection(index, "progress")}
        >
          <span className="hp-progress__tooltip" role="tooltip">
            {section.name}
          </span>
        </button>
      );
    })}
  </nav>
);

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

export const HomepagePresentation = () => {
  const sectionSlugs = useMemo(
    () => HOMEPAGE_SECTIONS.map((section) => section.slug),
    [],
  );
  const initialSection = useMemo(getInitialSectionIndex, []);
  const engine = useSectionEngine({
    sectionCount: HOMEPAGE_SECTIONS.length,
    initialSection,
    transitionPairs: HOMEPAGE_TRANSITIONS,
  });
  const deviceTier = useDeviceTier();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sectionAnnouncement, setSectionAnnouncement] = useState("");
  const wheelStateRef = useRef({
    accumulatedDelta: 0,
    consumedGesture: false,
    resetTimer: 0,
  });
  const shellRef = useRef<HTMLElement | null>(null);
  const touchStateRef = useRef({
    startY: 0,
    currentY: 0,
    tracking: false,
  });
  const initialSectionSlugRef = useRef<string | null>(null);
  const isHistoryNavigationRef = useRef(false);
  const didSyncInitialHashRef = useRef(false);
  const lastAnnouncedSectionRef = useRef<string | null>(null);
  const activeSection =
    HOMEPAGE_SECTIONS[engine.currentSection] ?? HOMEPAGE_SECTIONS[0];
  if (initialSectionSlugRef.current === null) {
    initialSectionSlugRef.current = activeSection.slug;
  }
  const previousSection =
    engine.previousSection === null
      ? undefined
      : HOMEPAGE_SECTIONS[engine.previousSection];
  const motionEnabled = deviceTier.tier !== "fallback";
  const particleDensity = getInterpolatedParticleDensity({
    currentDensity: activeSection.particleDensity,
    previousDensity: previousSection?.particleDensity,
    progress: engine.transitionProgress,
  });
  const particleTint = getParticleTintForTransition({
    currentTint: activeSection.particleTint,
    previousTint: previousSection?.particleTint,
    progress: engine.transitionProgress,
  });

  const navigateToSection = useCallback(
    (sectionIndex: number, inputKind: SectionInputKind) => {
      const speedMultiplier =
        inputKind === "progress" || inputKind === "history" ? 1.5 : 1;
      engine.goTo(sectionIndex, {
        inputKind,
        speedMultiplier,
        force:
          inputKind === "history" ||
          inputKind === "progress" ||
          inputKind === "nav",
      });
    },
    [engine],
  );

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;
    const previousHtmlOverscroll =
      document.documentElement.style.overscrollBehavior;

    const isJsdom = window.navigator.userAgent.toLowerCase().includes("jsdom");

    if (!isJsdom) {
      window.scrollTo({ top: 0, left: 0 });
    }
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.documentElement.style.overscrollBehavior = "none";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overscrollBehavior = previousBodyOverscroll;
      document.documentElement.style.overscrollBehavior =
        previousHtmlOverscroll;
    };
  }, []);

  useEffect(() => {
    trackHomepageEvent("page_view", {
      section: initialSectionSlugRef.current ?? "hero",
    });
  }, []);

  useEffect(() => {
    const nextHash = getHashForSectionSlug(activeSection.slug);

    trackHomepageEvent("section_view", { section: activeSection.slug });

    if (isHistoryNavigationRef.current) {
      isHistoryNavigationRef.current = false;
      return;
    }

    if (window.location.hash === nextHash) {
      didSyncInitialHashRef.current = true;
      return;
    }

    if (!didSyncInitialHashRef.current) {
      window.history.replaceState(null, "", nextHash);
      didSyncInitialHashRef.current = true;
      return;
    }

    window.history.pushState(null, "", nextHash);
  }, [activeSection.slug]);

  useEffect(() => {
    const handleLocationChange = () => {
      const sectionIndex = getSectionIndexFromHash(
        window.location.hash,
        sectionSlugs,
      );

      if (sectionIndex === null || sectionIndex === engine.currentSection) {
        return;
      }

      isHistoryNavigationRef.current = true;
      engine.goTo(sectionIndex, {
        inputKind: "history",
        speedMultiplier: 1.5,
        force: true,
      });
    };

    window.addEventListener("popstate", handleLocationChange);
    window.addEventListener("hashchange", handleLocationChange);

    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      window.removeEventListener("hashchange", handleLocationChange);
    };
  }, [engine, sectionSlugs]);

  const handleAdvanceByDirection = useCallback(
    (direction: "forward" | "backward", inputKind: SectionInputKind) => {
      if (direction === "forward") {
        engine.advance({ inputKind });
        return;
      }

      engine.retreat({ inputKind });
    },
    [engine],
  );

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      const deltaY = getWheelDelta(event);
      const lockedElement = getGestureLockedElement(event.target);

      if (
        lockedElement &&
        canGestureLockedElementScroll(lockedElement, deltaY)
      ) {
        return;
      }

      event.preventDefault();
      const wheelState = wheelStateRef.current;

      window.clearTimeout(wheelState.resetTimer);
      wheelState.resetTimer = window.setTimeout(() => {
        wheelState.accumulatedDelta = 0;
        wheelState.consumedGesture = false;
      }, WHEEL_QUIET_MS);

      if (Math.abs(deltaY) < 1 || wheelState.consumedGesture) {
        return;
      }

      wheelState.accumulatedDelta += deltaY;

      if (Math.abs(wheelState.accumulatedDelta) < WHEEL_THRESHOLD) {
        return;
      }

      wheelState.consumedGesture = true;
      handleAdvanceByDirection(
        wheelState.accumulatedDelta > 0 ? "forward" : "backward",
        "wheel",
      );
    },
    [handleAdvanceByDirection],
  );

  useEffect(() => {
    const shell = shellRef.current;

    if (!shell) {
      return undefined;
    }

    shell.addEventListener("wheel", handleWheel, { passive: false });

    return () => shell.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const handleTouchStart = useCallback((event: TouchEvent<HTMLElement>) => {
    const lockedElement = getGestureLockedElement(event.target);

    if (lockedElement && canGestureLockedElementScroll(lockedElement)) {
      touchStateRef.current.tracking = false;
      return;
    }

    const touch = event.touches[0];

    if (!touch) {
      return;
    }

    touchStateRef.current = {
      startY: touch.clientY,
      currentY: touch.clientY,
      tracking: true,
    };
  }, []);

  const handleTouchMove = useCallback((event: TouchEvent<HTMLElement>) => {
    const touch = event.touches[0];

    if (!touch || !touchStateRef.current.tracking) {
      return;
    }

    touchStateRef.current.currentY = touch.clientY;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const touchState = touchStateRef.current;

    if (!touchState.tracking) {
      return;
    }

    const deltaY = touchState.startY - touchState.currentY;
    touchState.tracking = false;

    if (Math.abs(deltaY) < TOUCH_THRESHOLD_PX) {
      return;
    }

    handleAdvanceByDirection(deltaY > 0 ? "forward" : "backward", "touch");
  }, [handleAdvanceByDirection]);

  const handleKeyboardEvent = useCallback(
    (event: KeyboardEvent | ReactKeyboardEvent<HTMLElement>) => {
      const target = event.target;
      const editableElement =
        target instanceof Element
          ? target.closest("input, textarea, select, [contenteditable='true']")
          : null;

      if (editableElement) {
        return;
      }

      if (["ArrowDown", " ", "Spacebar", "PageDown"].includes(event.key)) {
        event.preventDefault();
        engine.advance({ inputKind: "keyboard" });
        return;
      }

      if (["ArrowUp", "PageUp"].includes(event.key)) {
        event.preventDefault();
        engine.retreat({ inputKind: "keyboard" });
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        engine.goTo(0, { inputKind: "keyboard", force: true });
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        engine.goTo(HOMEPAGE_SECTIONS.length - 1, {
          inputKind: "keyboard",
          force: true,
        });
      }
    },
    [engine],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyboardEvent);

    return () => window.removeEventListener("keydown", handleKeyboardEvent);
  }, [handleKeyboardEvent]);

  useEffect(
    () => () => {
      window.clearTimeout(wheelStateRef.current.resetTimer);
    },
    [],
  );

  useEffect(() => {
    if (engine.inputKind !== "keyboard") {
      return;
    }

    const nextAnnouncement = `Showing ${activeSection.name} section`;

    if (lastAnnouncedSectionRef.current === nextAnnouncement) {
      return;
    }

    lastAnnouncedSectionRef.current = nextAnnouncement;
    setSectionAnnouncement(nextAnnouncement);
  }, [activeSection.name, engine.currentSection, engine.inputKind]);

  return (
    <>
      <HomepageHead />
      <main
        ref={shellRef}
        className="homepage-three"
        aria-label="BloomSuite homepage"
        data-testid="homepage-shell"
        data-current-section={engine.currentSection}
        data-current-surface={activeSection.surface}
        data-device-tier={deviceTier.tier}
        data-animations-disabled={deviceTier.animationsDisabled}
        data-transitioning={engine.isTransitioning}
        data-transition-type={engine.activeTransition}
        data-transition-direction={engine.transitionDirection}
        data-particle-density={particleDensity.toFixed(3)}
        style={
          {
            "--hp-transition-progress": engine.transitionProgress,
            "--hp-transition-duration": `${engine.transitionDurationMs}ms`,
            "--hp-section-motion-enabled": motionEnabled ? 1 : 0,
          } as CSSProperties
        }
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onKeyDown={handleKeyboardEvent}
        tabIndex={-1}
      >
        <a className="hp-skip-link" href="#homepage-main-content">
          Skip to content
        </a>
        <div
          className="hp-visually-hidden"
          aria-live="polite"
          aria-atomic="true"
        >
          {sectionAnnouncement}
        </div>
        <div className="hp-shared-backdrop" aria-hidden="true" />
        {motionEnabled && particleDensity > 0 ? (
          <Suspense fallback={null}>
            <LazyNanoLeafParticles
              tier={deviceTier.tier}
              densityMultiplier={particleDensity}
              tint={particleTint}
              reportFrame={deviceTier.reportFrame}
            />
          </Suspense>
        ) : null}
        <NavigationShell
          activeCategory={activeSection.navCategory}
          mobileMenuOpen={mobileMenuOpen}
          onMobileMenuToggle={() => setMobileMenuOpen((open) => !open)}
          onMobileMenuClose={() => setMobileMenuOpen(false)}
          onNavigateToSection={navigateToSection}
        />

        <div
          id="homepage-main-content"
          className="hp-section-stage"
          aria-label="BloomSuite homepage sections"
          tabIndex={-1}
        >
          {HOMEPAGE_SECTIONS.map((section, index) => {
            const isCurrent = index === engine.currentSection;
            const isPrevious = index === engine.previousSection;
            const sectionStyle = getSectionFrameStyle({
              isCurrent,
              isPrevious,
              transitionType: engine.activeTransition,
              progress: engine.transitionProgress,
              direction: engine.transitionDirection,
              motionEnabled,
            });

            return (
              <section
                key={section.id}
                id={section.slug}
                className="hp-section"
                aria-label={`${section.name} section`}
                data-section-id={section.id}
                data-accent={section.accent}
                data-surface={section.surface}
                data-active={isCurrent}
                data-previous={isPrevious}
                aria-hidden={!isCurrent}
                style={sectionStyle}
              >
                {section.id === "hero" ? (
                  <HomepageHeroSection
                    isActive={isCurrent}
                    motionEnabled={motionEnabled}
                  />
                ) : section.id === "features" ? (
                  <HomepageFeatureHighlightsSection
                    isActive={isCurrent}
                    motionEnabled={motionEnabled}
                  />
                ) : section.id === "customer-growth" ? (
                  <HomepageCrmShowcaseSection
                    isActive={isCurrent}
                    motionEnabled={motionEnabled}
                  />
                ) : section.id === "ai" ? (
                  <HomepageAiCapabilitiesSection
                    isActive={isCurrent}
                    motionEnabled={motionEnabled}
                  />
                ) : section.id === "automation" ? (
                  <HomepageImpactHowItWorksSection
                    isActive={isCurrent}
                    motionEnabled={motionEnabled}
                  />
                ) : section.id === "integrations" ? (
                  <HomepageIntegrationsEcosystemSection
                    isActive={isCurrent}
                    motionEnabled={motionEnabled}
                  />
                ) : section.id === "testimonials" ? (
                  <HomepageTestimonialsSocialProofSection
                    isActive={isCurrent}
                    motionEnabled={motionEnabled}
                  />
                ) : section.id === "start" ? (
                  <HomepagePricingCtaFooterSection
                    isActive={isCurrent}
                    motionEnabled={motionEnabled}
                    animationsDisabled={deviceTier.animationsDisabled}
                    onDisableAnimations={() =>
                      deviceTier.setAnimationsDisabled(true)
                    }
                  />
                ) : (
                  <div className="hp-section__content">
                    <p className="hp-section__eyebrow">{section.eyebrow}</p>
                    <h1 className="hp-section__title">{section.title}</h1>
                    <p className="hp-section__summary">{section.summary}</p>
                    <div className="hp-section__signal" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <ProgressIndicator
          currentSection={engine.currentSection}
          onNavigateToSection={navigateToSection}
        />
      </main>
    </>
  );
};

export default HomepagePresentation;
