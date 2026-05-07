import type { FeaturePageContent } from "../featurePageContent";
import { SectionEyebrow } from "./SectionEyebrow";

interface FeaturePageOutcomesProps {
  outcomes: FeaturePageContent["outcomes"];
}

export const FeaturePageOutcomes = ({ outcomes }: FeaturePageOutcomesProps) => (
  <section className="bg-white px-6 py-20 lg:py-28">
    <div className="mx-auto max-w-6xl">
      <div className="mb-12 max-w-2xl">
        <SectionEyebrow>{outcomes.eyebrow}</SectionEyebrow>
        <h2
          className="text-3xl font-bold leading-tight text-slate-900 lg:text-4xl"
          style={{ fontFamily: "Quicksand, system-ui, sans-serif" }}
        >
          {outcomes.headline}
        </h2>
      </div>
      <ul className="grid gap-6 md:grid-cols-3">
        {outcomes.items.map((item) => (
          <li
            key={item.title}
            className="rounded-2xl border border-[#3E7C77]/15 bg-[#E1FFFE]/30 p-6"
          >
            <h3 className="mb-2 text-lg font-semibold text-slate-900">
              {item.title}
            </h3>
            <p className="leading-relaxed text-slate-600">{item.description}</p>
          </li>
        ))}
      </ul>
    </div>
  </section>
);

export default FeaturePageOutcomes;
