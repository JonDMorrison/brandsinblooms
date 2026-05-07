import type { FeaturePageContent } from "../featurePageContent";
import { SectionEyebrow } from "./SectionEyebrow";

interface FeaturePageProblemProps {
  problem: FeaturePageContent["problem"];
}

export const FeaturePageProblem = ({ problem }: FeaturePageProblemProps) => (
  <section className="bg-white px-6 py-20 lg:py-28">
    <div className="mx-auto max-w-6xl">
      <div className="mb-12 max-w-2xl">
        <SectionEyebrow>{problem.eyebrow}</SectionEyebrow>
        <h2
          className="text-3xl font-bold leading-tight text-slate-900 lg:text-4xl"
          style={{ fontFamily: "Quicksand, system-ui, sans-serif" }}
        >
          {problem.headline}
        </h2>
      </div>
      <ul className="grid gap-6 md:grid-cols-2">
        {problem.pains.map((pain) => (
          <li
            key={pain.title}
            className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-6"
          >
            <h3 className="mb-2 text-lg font-semibold text-slate-900">
              {pain.title}
            </h3>
            <p className="leading-relaxed text-slate-600">{pain.description}</p>
          </li>
        ))}
      </ul>
    </div>
  </section>
);

export default FeaturePageProblem;
