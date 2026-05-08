export interface ImpactStatConfig {
  value: number;
  suffix: string;
  label: string;
  decimals?: number;
  delayMs: number;
  screenReaderValue: string;
}

export interface HowItWorksStepConfig {
  step: number;
  stepLabel: string;
  title: string;
  description: string;
  delayMs: number;
}

// IMPACT_SECTION_HEADER now drives the "Getting Started" header above the
// 3-step onboarding block. The original "Real Impact" stats block was hidden
// (see HomepageImpactHowItWorksSection.tsx) until verified numbers are
// available.
export const IMPACT_SECTION_HEADER = {
  eyebrow: "Getting Started",
  headline: "Up and running in a week.",
  subtext:
    "We migrate your customer data, connect your POS, and walk you through your first campaign.",
};

// Kept as an empty export for any lingering imports — the consumer was
// removed when the stats block was hidden.
export const IMPACT_STATS: ImpactStatConfig[] = [];

// HOW_IT_WORKS_HEADER is no longer rendered (IMPACT_SECTION_HEADER above
// drives the section heading now). Kept as null-ish strings so any stale
// consumer doesn't crash.
export const HOW_IT_WORKS_HEADER = {
  headline: "",
  subtext: "",
};

export const HOW_IT_WORKS_SCREENSHOT = {
  label: "Onboarding Screenshot",
  alt: "BloomSuite onboarding screenshot placeholder",
  chromeUrl: "app.bloomsuite.com/setup",
};

export const HOW_IT_WORKS_STEPS: HowItWorksStepConfig[] = [
  {
    step: 1,
    stepLabel: "01",
    title: "Connect your stack",
    description:
      "We pull customer data from your POS, your existing email tool, and your Shopify store. Nothing manual, nothing rekeyed.",
    delayMs: 0,
  },
  {
    step: 2,
    stepLabel: "02",
    title: "Send your first campaign",
    description:
      "Pick a template, segment your audience, let AI draft the copy. Send when ready.",
    delayMs: 150,
  },
  {
    step: 3,
    stepLabel: "03",
    title: "See what works",
    description:
      "Daily AI summary tells you what to do next. Ten minutes a day, not an afternoon.",
    delayMs: 300,
  },
];
