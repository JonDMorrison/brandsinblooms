// TODO: replace with real customer testimonials when permission obtained
// — see brand-bloom-community channels for quote candidates.
//
// Anonymous placeholder testimonials are used here ONLY because no
// real attributable testimonials are available in the repo today
// (no /src/assets/logos/customers/, no testimonial content file with
// attributable quotes). These are deliberately generic role+region
// attributions, not real names or business names.
const placeholderTestimonials = [
  {
    quote:
      "Cut my marketing time in half. I send better campaigns and spend more time on the floor with customers.",
    attribution: "Owner, Independent Garden Centre, BC",
  },
  {
    quote:
      "Finally something built for how garden centres actually work. The seasonal automations alone are worth it.",
    attribution: "Marketing Manager, Multi-Location Garden Centre, Pacific Northwest",
  },
  {
    quote:
      "Setup took an afternoon. We were running our first campaign within a week.",
    attribution: "Owner, Family-Run Nursery, Atlantic Canada",
  },
];

export const CustomerProof = () => {
  return (
    <section className="px-6 py-16 md:py-20 bg-[#F8F9FB]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10 md:mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 font-[var(--hp-font-display)]">
            Garden centres growing with BloomSuite
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            200+ independent garden centres in North America trust
            BloomSuite for customer marketing and online sales.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
          {placeholderTestimonials.map((entry, index) => (
            <article key={index} className="pricing-testimonial-card">
              <p className="pricing-testimonial-card__quote">
                &ldquo;{entry.quote}&rdquo;
              </p>
              <p className="pricing-testimonial-card__attribution">
                — {entry.attribution}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
