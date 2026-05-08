/**
 * Section 2 — Cost comparison anchor.
 *
 * Positions BloomSuite against the typical garden-centre tool stack
 * BEFORE the price grid, so users see the relative value before
 * eyeballing the absolute monthly numbers.
 */
export const CostComparison = () => {
  return (
    <section className="px-6 py-12 md:py-16 bg-white">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
          {/* "What you're probably paying now" — warm-tinted, less weight */}
          <article className="pricing-comparison-card pricing-comparison-card--negative">
            <h3 className="pricing-comparison-card__heading">
              What you&apos;re probably paying now
            </h3>

            <ul className="pricing-comparison-card__list">
              <li>Mailchimp or Klaviyo: $200–400/month</li>
              <li>Shopify or Squarespace: $80–300/month</li>
              <li>POS reporting or analytics add-on: $50–150/month</li>
              <li>
                Hours every week wrangling lists between them: priceless
              </li>
            </ul>

            <p className="pricing-comparison-card__footer">
              Most garden centres pay $300–500/month for tools that don&apos;t
              share data.
            </p>
          </article>

          {/* "What BloomSuite costs" — green-tinted, visual win */}
          <article className="pricing-comparison-card pricing-comparison-card--positive">
            <h3 className="pricing-comparison-card__heading">
              What BloomSuite costs
            </h3>

            <p className="pricing-comparison-card__big">
              $349–$1,199/month
            </p>

            <p className="text-[15px] leading-relaxed">
              One connected platform. Customers, campaigns, storefront,
              POS sync. All in one place.
            </p>

            <p className="pricing-comparison-card__footer">
              Plus — Early Adopter pricing locked in for life when you
              join now.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
};
