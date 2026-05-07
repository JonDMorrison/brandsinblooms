import { Link } from "react-router-dom";
import type { FeaturePageContent } from "../featurePageContent";

interface FeaturePageCtaProps {
  cta: FeaturePageContent["cta"];
}

export const FeaturePageCta = ({ cta }: FeaturePageCtaProps) => (
  <section className="bg-gradient-to-br from-[#2E605C] to-[#3E7C77] px-6 py-20 text-white lg:py-28">
    <div className="mx-auto max-w-3xl text-center">
      <h2
        className="mb-4 text-3xl font-bold leading-tight lg:text-4xl"
        style={{ fontFamily: "Quicksand, system-ui, sans-serif" }}
      >
        {cta.headline}
      </h2>
      <p className="mb-8 text-lg leading-relaxed text-white/90">
        {cta.subhead}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          to={cta.primaryHref}
          className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 text-sm font-semibold text-[#2E605C] shadow-sm transition hover:bg-[#E1FFFE]"
        >
          {cta.primaryLabel}
        </Link>
        <Link
          to={cta.secondaryHref}
          className="inline-flex items-center justify-center rounded-xl border border-white/40 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          {cta.secondaryLabel}
        </Link>
      </div>
    </div>
  </section>
);

export default FeaturePageCta;
