import type { CSSProperties } from "react";
import { Lock, Star } from "lucide-react";
import {
  CRM_CALLOUTS,
  CRM_SHOWCASE_HEADER,
  CRM_TRUST_METRICS,
} from "./content/crmShowcaseContent";
import "./homepageCrm.css";

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

interface HomepageCrmShowcaseSectionProps {
  isActive: boolean;
  motionEnabled: boolean;
  screenshotSrc?: string;
}

const CrmScreenshotShowcase = ({ src }: { src?: string }) => (
  <div className="hp-crm-frame-stack">
    <span
      className="hp-crm-frame-stack__shadow hp-crm-frame-stack__shadow--one"
      aria-hidden="true"
    />
    <span
      className="hp-crm-frame-stack__shadow hp-crm-frame-stack__shadow--two"
      aria-hidden="true"
    />

    <div className="hp-crm-frame">
      <div className="hp-crm-frame__chrome" aria-hidden="true">
        <span className="hp-crm-frame__traffic-lights">
          <span className="hp-crm-frame__traffic-light hp-crm-frame__traffic-light--red" />
          <span className="hp-crm-frame__traffic-light hp-crm-frame__traffic-light--amber" />
          <span className="hp-crm-frame__traffic-light hp-crm-frame__traffic-light--green" />
        </span>
        <span className="hp-crm-frame__url-pill">
          <Lock aria-hidden="true" />
          <span>app.bloomsuite.com</span>
        </span>
        <span />
      </div>

      <img
        className="hp-crm-frame__image"
        src={src || CRM_DASHBOARD_SCREENSHOT_SRC}
        alt={CRM_DASHBOARD_SCREENSHOT_ALT}
        loading="lazy"
        decoding="async"
        style={CRM_DASHBOARD_SCREENSHOT_STYLE}
      />
    </div>
  </div>
);

export const HomepageCrmShowcaseSection = ({
  isActive,
  motionEnabled,
  screenshotSrc,
}: HomepageCrmShowcaseSectionProps) => (
  <div
    className="hp-crm-showcase"
    data-active={isActive}
    data-motion-enabled={motionEnabled}
    data-homepage-gesture-lock="true"
    data-testid="homepage-crm-showcase"
  >
    <div className="hp-crm-showcase__layout">
      <header className="hp-crm-showcase__header" data-active={isActive}>
        <p className="hp-crm-showcase__eyebrow">
          <span className="hp-crm-showcase__eyebrow-line" aria-hidden="true" />
          <span className="hp-crm-showcase__eyebrow-text">
            {CRM_SHOWCASE_HEADER.eyebrow}
          </span>
          <span
            className="hp-crm-showcase__eyebrow-line hp-crm-showcase__eyebrow-line--end"
            aria-hidden="true"
          />
        </p>
        <h2 className="hp-crm-showcase__headline">
          {CRM_SHOWCASE_HEADER.headline}
        </h2>
        <p className="hp-crm-showcase__subtext">
          {CRM_SHOWCASE_HEADER.subtext}
        </p>
      </header>

      <div className="hp-crm-callouts" aria-label="CRM feature callouts">
        {CRM_CALLOUTS.map((callout) => {
          const Icon = callout.icon;

          return (
            <article
              key={callout.title}
              className="hp-crm-callout"
              style={
                {
                  "--hp-crm-callout-delay": `${callout.delayMs}ms`,
                } as CSSProperties
              }
            >
              <span className="hp-crm-callout__icon" aria-hidden="true">
                <Icon />
              </span>
              <div className="hp-crm-callout__body">
                <h3 className="hp-crm-callout__title">{callout.title}</h3>
                <p className="hp-crm-callout__description">
                  {callout.description}
                </p>
              </div>
            </article>
          );
        })}
      </div>

      <div
        className="hp-crm-showcase__visual"
        aria-label="BloomSuite CRM dashboard showcase"
      >
        <CrmScreenshotShowcase src={screenshotSrc} />
      </div>

      <dl className="hp-crm-metrics" aria-label="CRM trust metrics">
        {CRM_TRUST_METRICS.map((metric) => (
          <div key={metric.label} className="hp-crm-metric">
            <dt className="hp-crm-metric__value">
              <span>{metric.value}</span>
              {metric.showStars ? (
                <span className="hp-crm-metric__stars" aria-hidden="true">
                  <Star />
                  <Star />
                  <Star />
                  <Star />
                  <Star />
                </span>
              ) : null}
            </dt>
            <dd className="hp-crm-metric__label">{metric.label}</dd>
          </div>
        ))}
      </dl>
    </div>
  </div>
);

export default HomepageCrmShowcaseSection;
