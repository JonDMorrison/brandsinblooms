import type { FeaturePageContent } from "../featurePageContent";
import { SectionEyebrow } from "./SectionEyebrow";

interface FeaturePageUseCasesProps {
  useCases: FeaturePageContent["useCases"];
}

export const FeaturePageUseCases = ({ useCases }: FeaturePageUseCasesProps) => (
  <section className="bg-white px-6 py-20 lg:py-28">
    <div className="mx-auto max-w-5xl">
      <div className="mb-12 max-w-2xl">
        <SectionEyebrow>{useCases.eyebrow}</SectionEyebrow>
        <h2
          className="text-3xl font-bold leading-tight text-slate-900 lg:text-4xl"
          style={{ fontFamily: "Quicksand, system-ui, sans-serif" }}
        >
          {useCases.headline}
        </h2>
      </div>
      <ol className="space-y-8">
        {useCases.scenarios.map((scenario, index) => (
          <li
            key={scenario.title}
            className="rounded-2xl border-l-4 border-[#3E7C77] bg-slate-50/70 px-6 py-5"
          >
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#3E7C77]">
              Scenario {index + 1}
            </p>
            <h3 className="mb-2 text-xl font-semibold text-slate-900">
              {scenario.title}
            </h3>
            <p className="max-w-prose leading-relaxed text-slate-600">
              {scenario.description}
            </p>
          </li>
        ))}
      </ol>
    </div>
  </section>
);

export default FeaturePageUseCases;
