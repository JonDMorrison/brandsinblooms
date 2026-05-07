import { Link } from "react-router-dom";
import type { FeaturePageContent } from "../featurePageContent";
import { SectionEyebrow } from "./SectionEyebrow";

interface FeaturePageKnowledgeBaseProps {
  knowledgeBase: FeaturePageContent["knowledgeBase"];
}

export const FeaturePageKnowledgeBase = ({
  knowledgeBase,
}: FeaturePageKnowledgeBaseProps) => (
  <section className="bg-white px-6 py-20 lg:py-28">
    <div className="mx-auto max-w-6xl">
      <div className="mb-12 max-w-2xl">
        <SectionEyebrow>{knowledgeBase.eyebrow}</SectionEyebrow>
        <h2
          className="text-3xl font-bold leading-tight text-slate-900 lg:text-4xl"
          style={{ fontFamily: "Quicksand, system-ui, sans-serif" }}
        >
          {knowledgeBase.headline}
        </h2>
      </div>
      <ul className="grid gap-6 md:grid-cols-3">
        {knowledgeBase.articles.map((article) => (
          <li
            key={article.title}
            className="rounded-2xl border border-slate-200/70 p-6 transition hover:border-[#3E7C77]/40 hover:shadow-sm"
          >
            <h3 className="mb-2 text-lg font-semibold text-slate-900">
              {article.title}
            </h3>
            <p className="mb-4 leading-relaxed text-slate-600">
              {article.description}
            </p>
            <Link
              to={article.href}
              className="inline-flex items-center text-sm font-semibold text-[#3E7C77] hover:text-[#2E605C]"
            >
              Read more →
            </Link>
          </li>
        ))}
      </ul>
    </div>
  </section>
);

export default FeaturePageKnowledgeBase;
