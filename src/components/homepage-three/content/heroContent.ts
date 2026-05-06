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
  eyebrow: "For independent garden centres",
  // Headline split so each line renders on a single row at >=1024px:
  // line 1 carries the verb phrase, line 2 the closer.
  headlineLineOne: "The most powerful marketing tool",
  headlineLineTwo: "built for garden centres.",
  subtext:
    "BloomSuite gives garden centres and florists one place to manage customers, run email and SMS campaigns, build a storefront, and connect to Lightspeed, Stripe, Shopify, and Mailchimp.",
  primaryCta: "Start free trial",
  secondaryCta: "Book a demo",
  primaryHref: "/auth",
  secondaryHref: "#demo",
};

export const HERO_ROLE_BADGES: HeroRoleBadgeConfig[] = [
  {
    label: "Garden Centre",
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
    label: "Nursery",
    position: "bottom-left",
    delayMs: 420,
    floatDurationMs: 4300,
    floatPhaseMs: -400,
  },
  {
    label: "Multi-Location",
    position: "bottom-right",
    delayMs: 480,
    floatDurationMs: 5900,
    floatPhaseMs: -2200,
  },
];
