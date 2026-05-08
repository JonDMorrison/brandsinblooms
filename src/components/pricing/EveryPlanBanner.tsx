/**
 * Section 3 — "Every plan gets every feature" reframing banner.
 * Promoted from below-the-grid (where it lived as a paragraph in
 * AllPlansInclude) to above-the-grid so users read it BEFORE they
 * compare plan cards. Reframes the price grid as a volume choice,
 * not a feature paywall.
 */
export const EveryPlanBanner = () => {
  return (
    <section
      className="pricing-every-plan-banner"
      aria-label="Every plan gets every feature"
    >
      <p className="pricing-every-plan-banner__text">
        Every plan gets every feature. The difference is just how many
        customers you can reach.
      </p>
    </section>
  );
};
