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
              you earn <strong>35 additional orders a month</strong> at
              a <strong>$50 average sale and 40% gross margin</strong>,
              that contributes $700 toward the subscription before other
              incremental costs.
            </p>
            <p>
              This is an illustrative break-even calculation, not a promise
              of additional sales. Use your own order value, margins and
              costs to assess what would make the investment worthwhile.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

