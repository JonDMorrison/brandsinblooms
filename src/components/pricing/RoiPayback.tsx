import { BrandFoliage } from "@/components/brand";

/**
 * Section 6 — ROI / payback math.
 *
 * Anchors the Bloom plan price ($699/mo) against a concrete
 * customer-recovery metric so readers can do the math without
 * leaving the page. Typography matches the homepage hero scale via
 * the .pricing-roi-panel__heading rule in pricingPage.css.
 */
export const RoiPayback = () => {
  return (
    <section className="px-6 py-16 md:py-20 bg-white">
      <div className="max-w-5xl mx-auto">
        <div className="pricing-roi-panel">
          <BrandFoliage
            className="pricing-foliage pricing-foliage--bottom-right"
            aria-hidden="true"
          />

          <h2 className="pricing-roi-panel__heading">
            What BloomSuite needs to do to pay for itself
          </h2>

          <div className="pricing-roi-panel__body">
            <p>
              Bloom costs <strong>$699/month</strong>. If BloomSuite helps
              you bring back just <strong>14 customers a month</strong> at
              a <strong>$50 average sale</strong>, it&apos;s already paid
              for itself.
            </p>
            <p>
              Most garden centres see meaningfully more than that —
              automated seasonal campaigns, win-back flows for lapsed
              customers, and POS-synced segmentation typically generate
              dozens of additional visits per month from existing customer
              lists alone.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
