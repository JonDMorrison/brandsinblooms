import type { FeaturePageContent } from "../featurePageContent";
import { SectionEyebrow } from "./SectionEyebrow";

interface FeaturePageFaqProps {
  faq: FeaturePageContent["faq"];
}

export const FeaturePageFaq = ({ faq }: FeaturePageFaqProps) => (
  <section className="bg-slate-50/50 px-6 py-20 lg:py-28">
    <div className="mx-auto max-w-3xl">
      <div className="mb-10">
        <SectionEyebrow>{faq.eyebrow}</SectionEyebrow>
        <h2
          className="text-3xl font-bold leading-tight text-slate-900 lg:text-4xl"
          style={{ fontFamily: "Quicksand, system-ui, sans-serif" }}
        >
          {faq.headline}
        </h2>
      </div>
      <ul className="divide-y divide-slate-200/70 rounded-2xl border border-slate-200/70 bg-white">
        {faq.items.map((item) => (
          <li key={item.question}>
            <details className="group px-6 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-semibold text-slate-900 marker:hidden">
                <span>{item.question}</span>
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#E1FFFE] text-[#3E7C77] transition group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-prose leading-relaxed text-slate-600">
                {item.answer}
              </p>
            </details>
          </li>
        ))}
      </ul>
    </div>
  </section>
);

export default FeaturePageFaq;
