import type { FeaturePageContent } from "../featurePageContent";
import { SectionEyebrow } from "./SectionEyebrow";

interface FeaturePageCapabilitiesProps {
  capabilities: FeaturePageContent["capabilities"];
}

export const FeaturePageCapabilities = ({
  capabilities,
}: FeaturePageCapabilitiesProps) => (
  <section className="bg-[#E1FFFE]/30 px-6 py-20 lg:py-28">
    <div className="mx-auto max-w-6xl">
      <div className="mb-14 max-w-2xl">
        <SectionEyebrow>{capabilities.eyebrow}</SectionEyebrow>
        <h2
          className="mb-4 text-3xl font-bold leading-tight text-slate-900 lg:text-4xl"
          style={{ fontFamily: "Quicksand, system-ui, sans-serif" }}
        >
          {capabilities.headline}
        </h2>
        <p className="text-lg leading-relaxed text-slate-600">
          {capabilities.subhead}
        </p>
      </div>
      <ol className="space-y-10">
        {capabilities.items.map((item, index) => {
          const isEven = index % 2 === 0;
          return (
            <li
              key={item.title}
              className={`flex flex-col gap-4 lg:max-w-3xl ${
                isEven ? "lg:ml-0" : "lg:ml-auto lg:text-right"
              }`}
            >
              <div className="flex items-start gap-4">
                <span
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#3E7C77] text-sm font-bold text-white ${
                    isEven ? "" : "lg:order-2"
                  }`}
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <div>
                  <h3 className="mb-2 text-xl font-semibold text-slate-900">
                    {item.title}
                  </h3>
                  <p className="max-w-prose leading-relaxed text-slate-600">
                    {item.description}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  </section>
);

export default FeaturePageCapabilities;
