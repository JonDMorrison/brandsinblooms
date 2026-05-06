import type { CSSProperties } from "react";
import {
  FEATURE_HIGHLIGHTS,
  FEATURE_SECTION_HEADER,
  type FeatureHighlightConfig,
  type FeatureHighlightId,
} from "./content/featureHighlightsContent";
import smartCrmIllustration from "@/assets/features/smart-crm.png";
import campaignBuilderIllustration from "@/assets/features/campaign-builder.png";
import inventoryOrdersIllustration from "@/assets/features/inventory-orders.png";
import pageEditorIllustration from "@/assets/features/page-editor.png";
import analyticsDashboardIllustration from "@/assets/features/analytics-dashboard.png";
import multiStoreIllustration from "@/assets/features/multi-store.png";
import "./homepageFeatures.css";

export type FeatureScreenshotMap = Partial<Record<FeatureHighlightId, string>>;

// Defaults now cover every FeatureHighlightId — there are no longer any
// cards relying on the old gray-skeleton placeholder fallback. The
// explicit Record<...> annotation enforces full coverage at compile
// time so a future id addition forces a matching illustration.
const DEFAULT_FEATURE_SCREENSHOTS: Record<FeatureHighlightId, string> = {
  "smart-crm": smartCrmIllustration,
  "campaign-builder": campaignBuilderIllustration,
  "inventory-orders": inventoryOrdersIllustration,
  "page-editor": pageEditorIllustration,
  "analytics-dashboard": analyticsDashboardIllustration,
  "multi-store": multiStoreIllustration,
};

interface HomepageFeatureHighlightsSectionProps {
  isActive: boolean;
  motionEnabled: boolean;
  screenshotSrcs?: FeatureScreenshotMap;
}

interface FeaturePreviewCardProps {
  feature: FeatureHighlightConfig;
  index: number;
  src: string;
}

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
        <img
          className="hp-feature-card__image"
          src={src}
          alt={`${feature.placeholderLabel} illustration`}
          loading="lazy"
          decoding="async"
        />
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
  const resolvedScreenshotSrcs: Record<FeatureHighlightId, string> = {
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
