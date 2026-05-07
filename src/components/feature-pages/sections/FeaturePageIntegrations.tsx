import type { FeaturePageContent } from "../featurePageContent";
import { SectionEyebrow } from "./SectionEyebrow";

interface FeaturePageIntegrationsProps {
  integrations: NonNullable<FeaturePageContent["integrations"]>;
}

export const FeaturePageIntegrations = ({
  integrations,
}: FeaturePageIntegrationsProps) => (
  <section className="bg-slate-50 px-6 py-20 lg:py-24">
    <div className="mx-auto max-w-6xl text-center">
      <SectionEyebrow>{integrations.eyebrow}</SectionEyebrow>
      <h2
        className="mb-10 text-2xl font-bold leading-tight text-slate-900 lg:text-3xl"
        style={{ fontFamily: "Quicksand, system-ui, sans-serif" }}
      >
        {integrations.headline}
      </h2>
      <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
        {integrations.logos.map((logo) => (
          <li
            key={logo.name}
            className="text-sm font-medium uppercase tracking-wider text-slate-500"
          >
            {logo.name}
          </li>
        ))}
      </ul>
    </div>
  </section>
);

export default FeaturePageIntegrations;
