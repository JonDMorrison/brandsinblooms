import { fireEvent, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { HomepagePricingCtaFooterSection } from "./HomepagePricingCtaFooterSection";
import {
  FINAL_CTA_CONTENT,
  FOOTER_CONTENT,
  PRICING_CARDS_LABEL,
  PRICING_MOBILE_INITIAL_PLAN_ID,
  PRICING_PLANS,
  PRICING_SECTION_HEADER,
} from "./content/pricingCtaFooterContent";

const renderSection = (onDisableAnimations = vi.fn()) =>
  render(
    <HomepagePricingCtaFooterSection
      isActive
      motionEnabled
      animationsDisabled={false}
      onDisableAnimations={onDisableAnimations}
    />,
  );

describe("HomepagePricingCtaFooterSection", () => {
  it("renders the centered pricing header and three config-backed plan cards", () => {
    const { container } = renderSection();

    // PRICING_SECTION_HEADER.eyebrow ("Pricing") also appears as a link
    // label in the footer Product column. Scope the eyebrow assertion to
    // the pricing section header to avoid an ambiguous getByText match.
    const pricingHeader = container.querySelector(".hp-pricing-cta__header");
    expect(pricingHeader).not.toBeNull();
    expect(
      within(pricingHeader as HTMLElement).getByText(
        PRICING_SECTION_HEADER.eyebrow,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: PRICING_SECTION_HEADER.headline }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(PRICING_SECTION_HEADER.subtext),
    ).toBeInTheDocument();

    const cardRegion = screen.getByLabelText(PRICING_CARDS_LABEL);
    const cards = within(cardRegion).getAllByRole("article");

    expect(cards).toHaveLength(PRICING_PLANS.length);

    for (const plan of PRICING_PLANS) {
      const card = screen
        .getByRole("heading", { name: plan.name })
        .closest<HTMLElement>(".hp-pricing-card");
      const shell = card?.parentElement;

      expect(card).toBeInTheDocument();
      expect(shell).toHaveAttribute("data-plan-id", plan.id);
      expect(shell).toHaveAttribute(
        "data-entry-direction",
        plan.entryDirection,
      );
      expect(
        within(card!).getByText((_, element) =>
          Boolean(
            element?.classList.contains("hp-pricing-card__price") &&
            element.textContent === plan.price,
          ),
        ),
      ).toBeInTheDocument();
      expect(within(card!).getByText(plan.priceDetail)).toBeInTheDocument();
      expect(
        within(card!).getByRole("list", { name: plan.featureListLabel }),
      ).toBeInTheDocument();
      for (const feature of plan.features) {
        expect(within(card!).getByText(feature)).toBeInTheDocument();
      }
      expect(
        within(card!).getByRole("link", { name: plan.ctaLabel }),
      ).toHaveAttribute("href", plan.ctaHref);
    }

    // The featured tier is now Bloom (was Growth) and its CTA label was
    // renamed to "See plan details" routing to /pricing.
    const featuredPlan = PRICING_PLANS.find((plan) => plan.featured);
    expect(featuredPlan).toBeDefined();
    const featuredCard = screen
      .getByRole("heading", { name: featuredPlan!.name })
      .closest<HTMLElement>(".hp-pricing-card");

    expect(featuredCard).toHaveAttribute("data-featured", "true");
    expect(screen.getByText("Most Popular")).toHaveClass(
      "hp-pricing-card__badge",
    );
    expect(
      within(featuredCard!).getByRole("link", {
        name: featuredPlan!.ctaLabel,
      }),
    ).toHaveClass(
      "hp-pricing-card__button",
      "hp-pricing-card__button--primary",
    );
    expect(
      container.querySelectorAll(".hp-pricing-card__feature-icon"),
    ).toHaveLength(
      PRICING_PLANS.reduce((total, plan) => total + plan.features.length, 0),
    );
  });

  it("renders the separated final CTA block and footer links", () => {
    renderSection();

    const finalCta = screen.getByLabelText(FINAL_CTA_CONTENT.ariaLabel);

    expect(
      within(finalCta).getByRole("heading", {
        name: FINAL_CTA_CONTENT.headline,
      }),
    ).toBeInTheDocument();
    expect(
      within(finalCta).getByRole("link", {
        name: FINAL_CTA_CONTENT.primaryCta,
      }),
    ).toHaveAttribute("href", FINAL_CTA_CONTENT.primaryHref);
    expect(
      within(finalCta).getByRole("link", {
        name: FINAL_CTA_CONTENT.secondaryCta,
      }),
    ).toHaveAttribute("href", FINAL_CTA_CONTENT.secondaryHref);
    expect(
      within(finalCta).getByText((_, element) =>
        Boolean(
          element?.classList.contains("hp-pricing-cta__final-caption") &&
          element.textContent?.replace(/\s+/g, " ").trim() ===
            FINAL_CTA_CONTENT.caption,
        ),
      ),
    ).toHaveClass("hp-pricing-cta__final-caption");

    const footer = screen.getByRole("contentinfo", {
      name: FOOTER_CONTENT.ariaLabel,
    });

    expect(
      within(footer).getByRole("link", { name: FOOTER_CONTENT.brandHomeLabel }),
    ).toHaveAttribute("href", "#hero");
    expect(
      within(footer).getByText(FOOTER_CONTENT.tagline),
    ).toBeInTheDocument();
    expect(
      within(footer).getByText(FOOTER_CONTENT.copyright),
    ).toBeInTheDocument();

    // Socials are omitted entirely until BloomSuite has real brand
    // profiles (the placeholder LinkedIn/X/Instagram links pointed at
    // platform homepages, not BloomSuite). The wrapping container
    // should not render while FOOTER_CONTENT.socials is empty so we
    // don't ship leftover spacing or an empty aria-labelled region.
    expect(FOOTER_CONTENT.socials).toHaveLength(0);
    expect(
      footer.querySelector(".hp-pricing-footer__socials"),
    ).toBeNull();
    expect(
      within(footer).queryByLabelText(FOOTER_CONTENT.socialLabel),
    ).toBeNull();

    for (const column of FOOTER_CONTENT.columns) {
      expect(
        within(footer).getByRole("heading", { name: column.title }),
      ).toBeInTheDocument();
      for (const link of column.links) {
        expect(
          within(footer).getByRole("link", { name: link.label }),
        ).toHaveAttribute("href", link.href);
      }
    }
  });

  it("exposes mobile carousel metadata with Growth as the initial card", () => {
    renderSection();

    const cardRegion = screen.getByLabelText(PRICING_CARDS_LABEL);
    const growthShell = cardRegion.querySelector<HTMLElement>(
      `[data-plan-id="${PRICING_MOBILE_INITIAL_PLAN_ID}"]`,
    );

    expect(cardRegion).toHaveAttribute("data-homepage-gesture-lock", "true");
    expect(cardRegion).toHaveAttribute(
      "data-mobile-initial-plan",
      PRICING_MOBILE_INITIAL_PLAN_ID,
    );
    expect(growthShell).toHaveAttribute("data-featured", "true");
  });

  it("calls the footer disable animations action", () => {
    const onDisableAnimations = vi.fn();
    renderSection(onDisableAnimations);

    fireEvent.click(
      screen.getByRole("link", {
        name: FOOTER_CONTENT.disableAnimationsLabel,
      }),
    );

    expect(onDisableAnimations).toHaveBeenCalledTimes(1);
  });

  it("marks fallback mode for static cards without backdrop blur", () => {
    render(
      <HomepagePricingCtaFooterSection
        isActive
        motionEnabled={false}
        animationsDisabled
        onDisableAnimations={vi.fn()}
      />,
    );

    expect(screen.getByTestId("homepage-pricing-cta-footer")).toHaveAttribute(
      "data-motion-enabled",
      "false",
    );
    expect(
      screen.getByRole("link", {
        name: FOOTER_CONTENT.disableAnimationsLabel,
      }),
    ).toHaveAttribute("data-animations-disabled", "true");
  });
});
