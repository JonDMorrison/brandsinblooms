export interface HeroRoleBadgeConfig {
  label: string;
  position:
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right"
    | "mid-left"
    | "mid-right";
  optional?: boolean;
  delayMs: number;
  floatDurationMs: number;
  floatPhaseMs: number;
}

export const HERO_CONTENT = {
  eyebrow: "AI-Powered Business Platform",
  headlineLineOne: "Grow Your Green Business",
  headlineLineTwo: "With Intelligent CRM",
  subtext:
    "The all-in-one CRM, AI assistant, and commerce platform for garden centres, florists, and eco-conscious retailers.",
  primaryCta: "Start Free Trial",
  secondaryCta: "Book a Demo",
  primaryHref: "#start",
  secondaryHref: "#demo",
};

export const HERO_ROLE_BADGES: HeroRoleBadgeConfig[] = [
  {
    label: "Garden Centre Owner",
    position: "top-left",
    delayMs: 300,
    floatDurationMs: 4800,
    floatPhaseMs: -900,
  },
  {
    label: "Florist",
    position: "top-right",
    delayMs: 360,
    floatDurationMs: 5400,
    floatPhaseMs: -1600,
  },
  {
    label: "Nursery Manager",
    position: "bottom-left",
    delayMs: 420,
    floatDurationMs: 4300,
    floatPhaseMs: -400,
  },
  {
    label: "Retail Chain",
    position: "bottom-right",
    delayMs: 480,
    floatDurationMs: 5900,
    floatPhaseMs: -2200,
  },
  {
    label: "E-Commerce",
    position: "mid-left",
    optional: true,
    delayMs: 540,
    floatDurationMs: 5100,
    floatPhaseMs: -1300,
  },
  {
    label: "Wholesaler",
    position: "mid-right",
    optional: true,
    delayMs: 600,
    floatDurationMs: 4600,
    floatPhaseMs: -2700,
  },
];
