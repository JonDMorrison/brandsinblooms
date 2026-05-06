import type { CSSProperties } from "react";
import {
  FEATURE_HIGHLIGHTS,
  FEATURE_SECTION_HEADER,
  type FeatureHighlightConfig,
  type FeatureHighlightId,
} from "./content/featureHighlightsContent";
import "./homepageFeatures.css";

export type FeatureScreenshotMap = Partial<Record<FeatureHighlightId, string>>;

const DEFAULT_FEATURE_SCREENSHOTS: FeatureScreenshotMap = {
  "smart-crm": "/homepage/smart-customer-crm.png",
  "campaign-builder": "/homepage/ai-campaign-builder.png",
  "analytics-dashboard": "/homepage/growth-and-analytics.png",
};

interface HomepageFeatureHighlightsSectionProps {
  isActive: boolean;
  motionEnabled: boolean;
  screenshotSrcs?: FeatureScreenshotMap;
}

interface FeaturePreviewCardProps {
  feature: FeatureHighlightConfig;
  index: number;
  src?: string;
}

const FeatureSkeleton = ({ id }: { id: FeatureHighlightId }) => {
  if (id === "smart-crm") {
    return (
      <div
        className="hp-feature-skeleton hp-feature-skeleton--crm"
        aria-hidden="true"
      >
        <span className="hp-feature-skeleton__toolbar" />
        <span className="hp-feature-skeleton__metric" />
        <span className="hp-feature-skeleton__metric" />
        <span className="hp-feature-skeleton__metric" />
        <span className="hp-feature-skeleton__line" />
        <span className="hp-feature-skeleton__line" />
      </div>
    );
  }

  if (id === "campaign-builder") {
    return (
      <div
        className="hp-feature-skeleton hp-feature-skeleton--campaign"
        aria-hidden="true"
      >
        <span className="hp-feature-skeleton__toolbar" />
        <span className="hp-feature-skeleton__canvas" />
        <span className="hp-feature-skeleton__sidebar" />
      </div>
    );
  }

  if (id === "inventory-orders") {
    return (
      <div
        className="hp-feature-skeleton hp-feature-skeleton--inventory"
        aria-hidden="true"
      >
        <span className="hp-feature-skeleton__toolbar" />
        <span className="hp-feature-skeleton__cell" />
        <span className="hp-feature-skeleton__cell" />
        <span className="hp-feature-skeleton__cell" />
        <span className="hp-feature-skeleton__cell" />
        <span className="hp-feature-skeleton__wide" />
      </div>
    );
  }

  if (id === "page-editor") {
    return (
      <div
        className="hp-feature-skeleton hp-feature-skeleton--editor"
        aria-hidden="true"
      >
        <span className="hp-feature-skeleton__sidebar" />
        <span className="hp-feature-skeleton__stack" />
        <span className="hp-feature-skeleton__stack" />
        <span className="hp-feature-skeleton__stack" />
      </div>
    );
  }

  if (id === "analytics-dashboard") {
    return (
      <div
        className="hp-feature-skeleton hp-feature-skeleton--analytics"
        aria-hidden="true"
      >
        <span className="hp-feature-skeleton__toolbar" />
        <svg
          className="hp-feature-skeleton__chart"
          viewBox="0 0 260 88"
          focusable="false"
          aria-hidden="true"
        >
          <path d="M8 72 C62 66 84 54 122 50 C166 45 186 30 252 18" />
        </svg>
      </div>
    );
  }

  return (
    <div
      className="hp-feature-skeleton hp-feature-skeleton--multistore"
      aria-hidden="true"
    >
      <span className="hp-feature-skeleton__store" />
      <span className="hp-feature-skeleton__connector" />
      <span className="hp-feature-skeleton__store" />
      <span className="hp-feature-skeleton__connector" />
      <span className="hp-feature-skeleton__store" />
    </div>
  );
};

const FeaturePreviewCard = ({
  feature,
  index,
  src,
}: FeaturePreviewCardProps) => {
  const titleId = `hp-feature-title-${feature.id}`;
  const descriptionId = `hp-feature-description-${feature.id}`;

  return (
    <article
      role="article"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="hp-feature-card"
      style={{ "--hp-feature-card-delay": `${index * 80}ms` } as CSSProperties}
    >
      <div className="hp-feature-card__preview">
        {src ? (
          <img
            className="hp-feature-card__image"
            src={src}
            alt={`${feature.placeholderLabel} preview`}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div
            className="hp-feature-card__placeholder"
            role="img"
            aria-label={`${feature.placeholderLabel} screenshot placeholder`}
          >
            <FeatureSkeleton id={feature.id} />
            <span className="hp-feature-card__placeholder-label">
              {feature.placeholderLabel}
            </span>
          </div>
        )}
      </div>
      <div className="hp-feature-card__body">
        <h3 id={titleId} className="hp-feature-card__title">
          {feature.title}
        </h3>
        <p id={descriptionId} className="hp-feature-card__description">
          {feature.description}
        </p>
      </div>
    </article>
  );
};

export const HomepageFeatureHighlightsSection = ({
  isActive,
  motionEnabled,
  screenshotSrcs,
}: HomepageFeatureHighlightsSectionProps) => {
  const resolvedScreenshotSrcs = {
    ...DEFAULT_FEATURE_SCREENSHOTS,
    ...screenshotSrcs,
  };

  return (
    <div
      className="hp-features"
      data-active={isActive}
      data-motion-enabled={motionEnabled}
      data-homepage-gesture-lock="true"
      data-testid="homepage-feature-highlights"
    >
      <div className="hp-features__main">
        <header className="hp-features__header" data-active={isActive}>
          <p className="hp-features__eyebrow">
            <span className="hp-features__eyebrow-line" aria-hidden="true" />
            <span>{FEATURE_SECTION_HEADER.eyebrow}</span>
          </p>
          <h2 className="hp-features__headline">
            {FEATURE_SECTION_HEADER.headline}
          </h2>
          <p className="hp-features__subtext">
            {FEATURE_SECTION_HEADER.subtext}
          </p>
        </header>

        <div
          className="hp-feature-grid"
          aria-label="Platform feature highlights"
        >
          {FEATURE_HIGHLIGHTS.map((feature, index) => (
            <FeaturePreviewCard
              key={feature.id}
              feature={feature}
              index={index}
              src={resolvedScreenshotSrcs[feature.id]}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default HomepageFeatureHighlightsSection;
