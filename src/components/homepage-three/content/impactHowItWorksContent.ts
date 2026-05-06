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

export const IMPACT_SECTION_HEADER = {
  eyebrow: "Real Impact",
  headline: "Why Teams Choose BloomSuite",
  subtext: "Trusted by garden centres and florists to drive measurable growth.",
};

export const IMPACT_STATS: ImpactStatConfig[] = [
  {
    value: 40,
    suffix: "%",
    label: "Faster Campaign Delivery",
    delayMs: 0,
    screenReaderValue: "40% Faster Campaign Delivery",
  },
  {
    value: 3,
    suffix: "×",
    label: "Higher Customer Retention",
    delayMs: 150,
    screenReaderValue: "3x Higher Customer Retention",
  },
  {
    value: 10,
    suffix: "K+",
    label: "Active Users",
    delayMs: 300,
    screenReaderValue: "10K+ Active Users",
  },
  {
    value: 99.9,
    suffix: "%",
    label: "Platform Uptime",
    decimals: 1,
    delayMs: 450,
    screenReaderValue: "99.9% Platform Uptime",
  },
];

export const HOW_IT_WORKS_HEADER = {
  headline: "Get Started in 3 Easy Steps",
  subtext: "A guided onboarding experience designed for speed and simplicity.",
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
    title: "Quick Setup",
    description:
      "Connect your store, import customers, and configure your dashboard in under 2 minutes.",
    delayMs: 0,
  },
  {
    step: 2,
    stepLabel: "02",
    title: "Start Selling Smarter",
    description:
      "Launch AI-powered campaigns, set up automated workflows, and let the platform learn your business.",
    delayMs: 150,
  },
  {
    step: 3,
    stepLabel: "03",
    title: "Watch Growth Happen",
    description:
      "Track results in real-time. Your AI assistant surfaces insights and actions daily.",
    delayMs: 300,
  },
];
