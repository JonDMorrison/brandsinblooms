import { Link } from "react-router-dom";
import type { FeaturePageContent } from "../featurePageContent";
import { SectionEyebrow } from "./SectionEyebrow";

interface FeaturePageRelatedProps {
  related: FeaturePageContent["related"];
}

export const FeaturePageRelated = ({ related }: FeaturePageRelatedProps) => (
  <section className="bg-slate-50/50 px-6 py-20 lg:py-24">
    <div className="mx-auto max-w-6xl">
      <div className="mb-10 max-w-2xl">
        <SectionEyebrow>{related.eyebrow}</SectionEyebrow>
        <h2
          className="text-3xl font-bold leading-tight text-slate-900 lg:text-4xl"
          style={{ fontFamily: "Quicksand, system-ui, sans-serif" }}
        >
          {related.headline}
        </h2>
      </div>
      <ul className="grid gap-6 md:grid-cols-2">
        {related.links.map((link) => (
          <li key={link.slug}>
            <Link
              to={`/features/${link.slug}`}
              className="group block h-full rounded-2xl border border-slate-200/70 bg-white p-6 transition hover:-translate-y-0.5 hover:border-[#3E7C77]/40 hover:shadow-md"
            >
              <h3 className="mb-2 text-lg font-semibold text-slate-900 group-hover:text-[#2E605C]">
                {link.title}
              </h3>
              <p className="mb-4 leading-relaxed text-slate-600">
                {link.description}
              </p>
              <span className="inline-flex items-center text-sm font-semibold text-[#3E7C77]">
                Explore →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  </section>
);

export default FeaturePageRelated;
