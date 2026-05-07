import type { MouseEvent, ReactNode } from "react";
import { Check } from "lucide-react";
import {
  FINAL_CTA_CONTENT,
  FOOTER_CONTENT,
  PRICING_CARDS_LABEL,
  PRICING_MOBILE_INITIAL_PLAN_ID,
  PRICING_PLANS,
  PRICING_SECTION_HEADER,
  SEED_FOOTNOTE,
  type FooterLinkConfig,
  type PricingPlanConfig,
} from "./content/pricingCtaFooterContent";
import bloomsuiteLogo from "@/assets/bloomsuite-logo-correct.png";
import "./homepagePricingCta.css";

interface HomepagePricingCtaFooterSectionProps {
  isActive: boolean;
  motionEnabled: boolean;
  animationsDisabled: boolean;
  onDisableAnimations: () => void;
}

const BloomSuiteFooterMark = () => (
  // alt="" because the parent <a> already has aria-label "Go to
  // BloomSuite homepage" — labelling the image would make screen
  // readers announce the brand twice for one link.
  <img
    src={bloomsuiteLogo}
    alt=""
    className="hp-pricing-footer__mark"
  />
);

const renderCaption = (caption: string) => {
  const parts = caption.split(" · ");

  return parts.map((part, index) => (
    <span key={part}>
      {index > 0 ? (
        <span className="hp-pricing-cta__final-caption-separator"> · </span>
      ) : null}
      {part}
    </span>
  ));
};

const PricingButton = ({
  href,
  variant,
  children,
}: {
  href: string;
  variant: PricingPlanConfig["ctaVariant"];
  children: ReactNode;
}) => (
  <a
    className={`hp-pricing-card__button hp-pricing-card__button--${variant}`}
    href={href}
  >
    {children}
  </a>
);

const FinalCtaButton = ({
  href,
  variant,
  children,
}: {
  href: string;
  variant: "primary" | "secondary";
  children: ReactNode;
}) => (
  <a
    className={`hp-pricing-cta__button hp-pricing-cta__button--${variant}`}
    href={href}
  >
    {children}
  </a>
);

const PlanPrice = ({ plan }: { plan: PricingPlanConfig }) => {
  if (plan.featured && plan.price.startsWith("$")) {
    return (
      <span className="hp-pricing-card__price">
        <span className="hp-pricing-card__currency">$</span>
        {plan.price.slice(1)}
      </span>
    );
  }

  return <span className="hp-pricing-card__price">{plan.price}</span>;
};

const PricingPlanCard = ({ plan }: { plan: PricingPlanConfig }) => {
  const titleId = `hp-pricing-plan-${plan.id}`;
  const priceId = `hp-pricing-price-${plan.id}`;

  return (
    <div
      className="hp-pricing-card-shell"
      data-plan-id={plan.id}
      data-featured={plan.featured ? "true" : "false"}
      data-entry-direction={plan.entryDirection}
    >
      <article
        className="hp-pricing-card"
        data-featured={plan.featured ? "true" : "false"}
        aria-labelledby={titleId}
        aria-describedby={priceId}
      >
        {plan.featuredChip ? (
          <span className="hp-pricing-card__badge">{plan.featuredChip}</span>
        ) : null}

        <header className="hp-pricing-card__header">
          <h3 id={titleId} className="hp-pricing-card__name">
            {plan.name}
          </h3>
          <div className="hp-pricing-card__price-wrap" id={priceId}>
            <PlanPrice plan={plan} />
            <span className="hp-pricing-card__detail">{plan.priceDetail}</span>
          </div>
        </header>

        <span className="hp-pricing-card__divider" aria-hidden="true" />

        <ul
          className="hp-pricing-card__features"
          aria-label={plan.featureListLabel}
        >
          {plan.features.map((feature) => (
            <li key={feature} className="hp-pricing-card__feature">
              <span
                className="hp-pricing-card__feature-check"
                aria-hidden="true"
              >
                <Check className="hp-pricing-card__feature-icon" />
              </span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <PricingButton href={plan.ctaHref} variant={plan.ctaVariant}>
          {plan.ctaLabel}
        </PricingButton>
      </article>
    </div>
  );
};

const FooterLink = ({ link }: { link: FooterLinkConfig }) => (
  <a className="hp-pricing-footer__link" href={link.href}>
    {link.label}
  </a>
);

export const HomepagePricingCtaFooterSection = ({
  isActive,
  motionEnabled,
  animationsDisabled,
  onDisableAnimations,
}: HomepagePricingCtaFooterSectionProps) => {
  const handleDisableAnimations = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    onDisableAnimations();
  };

  return (
    <div
      className="hp-pricing-cta"
      data-active={isActive}
      data-motion-enabled={motionEnabled}
      data-homepage-gesture-lock="true"
      data-testid="homepage-pricing-cta-footer"
    >
      <section
        className="hp-pricing-cta__pricing"
        aria-labelledby="hp-pricing-title"
      >
        <div className="hp-pricing-cta__pricing-inner">
          <header className="hp-pricing-cta__header" data-active={isActive}>
            <p className="hp-pricing-cta__eyebrow">
              <span
                className="hp-pricing-cta__eyebrow-line"
                aria-hidden="true"
              />
              <span>{PRICING_SECTION_HEADER.eyebrow}</span>
            </p>
            <h2 className="hp-pricing-cta__headline" id="hp-pricing-title">
              {PRICING_SECTION_HEADER.headline}
            </h2>
            <p className="hp-pricing-cta__subtext">
              {PRICING_SECTION_HEADER.subtext}
            </p>
          </header>

          <div className="hp-pricing-cta__cards-wrap">
            <div
              className="hp-pricing-cta__cards"
              aria-label={PRICING_CARDS_LABEL}
              data-homepage-gesture-lock="true"
              data-mobile-initial-plan={PRICING_MOBILE_INITIAL_PLAN_ID}
            >
              {PRICING_PLANS.map((plan) => (
                <PricingPlanCard key={plan.id} plan={plan} />
              ))}
            </div>
          </div>

          <p className="hp-pricing-cta__seed-footnote">
            {SEED_FOOTNOTE.text}{" "}
            <a
              className="hp-pricing-cta__seed-footnote-link"
              href={SEED_FOOTNOTE.linkHref}
            >
              {SEED_FOOTNOTE.linkLabel}
            </a>
          </p>
        </div>
      </section>

      <section
        className="hp-pricing-cta__final"
        aria-label={FINAL_CTA_CONTENT.ariaLabel}
      >
        <div className="hp-pricing-cta__final-inner">
          <h3 className="hp-pricing-cta__final-headline">
            {FINAL_CTA_CONTENT.headline}
          </h3>
          {FINAL_CTA_CONTENT.subhead ? (
            <p className="hp-pricing-cta__final-subhead">
              {FINAL_CTA_CONTENT.subhead}
            </p>
          ) : null}
          <div className="hp-pricing-cta__final-actions">
            <FinalCtaButton
              href={FINAL_CTA_CONTENT.primaryHref}
              variant="primary"
            >
              {FINAL_CTA_CONTENT.primaryCta}
            </FinalCtaButton>
            <FinalCtaButton
              href={FINAL_CTA_CONTENT.secondaryHref}
              variant="secondary"
            >
              {FINAL_CTA_CONTENT.secondaryCta}
            </FinalCtaButton>
          </div>
          <p className="hp-pricing-cta__final-caption">
            {renderCaption(FINAL_CTA_CONTENT.caption)}
          </p>
        </div>
      </section>

      <footer
        className="hp-pricing-footer"
        aria-label={FOOTER_CONTENT.ariaLabel}
      >
        <div className="hp-pricing-footer__content">
          <div className="hp-pricing-footer__brand-column">
            <a
              className="hp-pricing-footer__brand"
              href="#hero"
              aria-label={FOOTER_CONTENT.brandHomeLabel}
            >
              <BloomSuiteFooterMark />
              <span>{FOOTER_CONTENT.wordmark}</span>
            </a>
            <p className="hp-pricing-footer__tagline">
              {FOOTER_CONTENT.tagline}
            </p>
            {FOOTER_CONTENT.socials.length > 0 && (
              <div
                className="hp-pricing-footer__socials"
                aria-label={FOOTER_CONTENT.socialLabel}
              >
                {FOOTER_CONTENT.socials.map((social) => {
                  const Icon = social.icon;

                  return (
                    <a
                      key={social.label}
                      className="hp-pricing-footer__social-link"
                      href={social.href}
                      aria-label={social.label}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Icon aria-hidden="true" />
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          <nav
            className="hp-pricing-footer__columns"
            aria-label={FOOTER_CONTENT.navLabel}
          >
            {FOOTER_CONTENT.columns.map((column) => (
              <div key={column.title} className="hp-pricing-footer__column">
                <h3 className="hp-pricing-footer__column-title">
                  {column.title}
                </h3>
                <ul className="hp-pricing-footer__list">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <FooterLink link={link} />
                    </li>
                  ))}
                  {column.title === "LEGAL" ? (
                    <li>
                      <a
                        className="hp-pricing-footer__link"
                        href="#disable-animations"
                        onClick={handleDisableAnimations}
                        data-animations-disabled={animationsDisabled}
                      >
                        {FOOTER_CONTENT.disableAnimationsLabel}
                      </a>
                    </li>
                  ) : null}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <p className="hp-pricing-footer__copyright">
          {FOOTER_CONTENT.copyright}
        </p>
      </footer>
    </div>
  );
};

export default HomepagePricingCtaFooterSection;
