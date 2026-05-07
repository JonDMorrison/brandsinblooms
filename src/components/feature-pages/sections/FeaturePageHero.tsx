import { Link } from "react-router-dom";
import type { FeaturePageContent } from "../featurePageContent";
import { SectionEyebrow } from "./SectionEyebrow";

interface FeaturePageHeroProps {
  hero: FeaturePageContent["hero"];
  cta: FeaturePageContent["cta"];
}

export const FeaturePageHero = ({ hero, cta }: FeaturePageHeroProps) => (
  <section className="relative overflow-hidden bg-gradient-to-b from-[#E1FFFE]/40 to-white px-6 pb-16 pt-28 lg:pb-24 lg:pt-36">
    <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
      <div>
        <SectionEyebrow>{hero.eyebrow}</SectionEyebrow>
        <h1
          className="mb-5 text-4xl font-bold leading-tight text-slate-900 lg:text-5xl"
          style={{ fontFamily: "Quicksand, system-ui, sans-serif" }}
        >
          {hero.headline}
        </h1>
        <p className="mb-8 max-w-prose text-lg leading-relaxed text-slate-600">
          {hero.subhead}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to={cta.primaryHref}
            className="inline-flex items-center justify-center rounded-xl bg-[#3E7C77] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2E605C]"
          >
            {cta.primaryLabel}
          </Link>
          <Link
            to={cta.secondaryHref}
            className="inline-flex items-center justify-center rounded-xl border border-[#3E7C77]/30 bg-white px-6 py-3 text-sm font-semibold text-[#2E605C] transition hover:border-[#3E7C77]/60 hover:bg-[#E1FFFE]/40"
          >
            {cta.secondaryLabel}
          </Link>
        </div>
      </div>
      <div className="relative">
        <img
          src={hero.illustrationSrc}
          alt={hero.illustrationAlt}
          className="mx-auto w-full max-w-[520px]"
          loading="eager"
          decoding="async"
        />
      </div>
    </div>
  </section>
);

export default FeaturePageHero;
