import type { CSSProperties } from "react";
import { Plug } from "lucide-react";
import {
  INTEGRATION_CARDS,
  INTEGRATION_COUNT_COPY,
  INTEGRATIONS_SECTION_HEADER,
  type IntegrationCardConfig,
} from "./content/integrationsEcosystemContent";
import "./homepageIntegrations.css";

interface HomepageIntegrationsEcosystemSectionProps {
  isActive: boolean;
  motionEnabled: boolean;
}

const IntegrationCard = ({
  integration,
}: {
  integration: IntegrationCardConfig;
}) => {
  const titleId = `hp-integration-title-${integration.id}`;
  const descriptionId = `hp-integration-description-${integration.id}`;

  const renderLogo = () => {
    if (integration.logo) {
      return (
        <img
          className="hp-integration-card__logo"
          src={integration.logo.src}
          alt={integration.logo.alt}
          loading="lazy"
          decoding="async"
        />
      );
    }

    return null;
  };

  return (
    <article
      className={`hp-integration-card hp-integration-card--${integration.size}`}
      data-integration-id={integration.id}
      data-card-size={integration.size}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      style={
        {
          "--hp-integration-card-delay": `${integration.delayMs}ms`,
        } as CSSProperties
      }
    >
      <div className="hp-integration-card__media">
        <span className="hp-integration-card__icon">{renderLogo()}</span>
        <span className="hp-integration-card__category">
          {integration.category}
        </span>
      </div>
      <div className="hp-integration-card__body">
        <h3 id={titleId} className="hp-integration-card__name">
          {integration.name}
        </h3>
        <p id={descriptionId} className="hp-integration-card__description">
          {integration.description}
        </p>
      </div>
    </article>
  );
};

export const HomepageIntegrationsEcosystemSection = ({
  isActive,
  motionEnabled,
}: HomepageIntegrationsEcosystemSectionProps) => (
  <div
    className="hp-integrations-ecosystem"
    data-active={isActive}
    data-motion-enabled={motionEnabled}
    data-homepage-gesture-lock="true"
    data-testid="homepage-integrations-ecosystem"
  >
    <div className="hp-integrations-ecosystem__inner">
      <header className="hp-integrations-ecosystem__header">
        <p className="hp-integrations-ecosystem__eyebrow">
          <span
            className="hp-integrations-ecosystem__eyebrow-line"
            aria-hidden="true"
          />
          <span className="hp-integrations-ecosystem__eyebrow-text">
            {INTEGRATIONS_SECTION_HEADER.eyebrow}
          </span>
        </p>
        <h2 className="hp-integrations-ecosystem__headline">
          {INTEGRATIONS_SECTION_HEADER.headline}
        </h2>
        <p className="hp-integrations-ecosystem__subtext">
          {INTEGRATIONS_SECTION_HEADER.subtext}
        </p>
      </header>

      <div
        className="hp-integrations-grid"
        aria-label="Integration ecosystem cards"
      >
        {INTEGRATION_CARDS.map((integration) => (
          <IntegrationCard key={integration.id} integration={integration} />
        ))}
      </div>

      <div className="hp-integrations-ecosystem__copy">
        <p className="hp-integrations-ecosystem__count">
          <Plug
            className="hp-integrations-ecosystem__count-icon"
            aria-hidden="true"
          />
          <span>{INTEGRATION_COUNT_COPY.headline}</span>
        </p>
        <a
          className="hp-integrations-ecosystem__cta"
          href={INTEGRATION_COUNT_COPY.ctaHref}
        >
          {INTEGRATION_COUNT_COPY.cta}
        </a>
      </div>
    </div>
  </div>
);

export default HomepageIntegrationsEcosystemSection;
