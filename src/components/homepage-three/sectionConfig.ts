import type { ParticleTint } from "./particles/atmosphere";
import { PRICING_SECTION_HEADER } from "./content/pricingCtaFooterContent";

export type HomepageNavCategory =
  | "features"
  | "ai"
  | "integrations"
  | "pricing";

export interface HomepageSectionConfig {
  id: string;
  slug: string;
  name: string;
  navCategory: HomepageNavCategory;
  eyebrow: string;
  title: string;
  summary: string;
  accent: "leaf" | "coral" | "indigo" | "teal";
  surface: "light" | "subtle" | "dark";
  particleDensity: number;
  particleTint: ParticleTint;
}

export interface HomepageNavItemConfig {
  label: string;
  category: HomepageNavCategory;
  // In-page section to scroll to when this nav item is clicked.
  targetSlug: string;
  // Optional react-router route. When set, clicking the nav item navigates
  // to this route instead of scrolling to the in-page section. Used for
  // pages that live outside the scroll-locked homepage (e.g. /pricing).
  // Falls back to in-page scroll when omitted.
  targetHref?: string;
}

// Vertical-scroll section order. The new "problem", "guide", and
// "differentiators" sections were added between hero and pricing. The
// previous "customer-growth", "automation", and "testimonials" sections
// are no longer rendered; their components remain on disk for now.
//
// Final-CTA + footer live inside HomepagePricingCtaFooterSection (rendered
// at the "start" section), not as standalone sections — this preserves
// the existing component contract and its unit tests.
//
// particleDensity / particleTint / accent / surface are kept as metadata
// for downstream consumers but are no longer used by HomepagePresentation
// since the scrolling rebuild dropped the scroll-engine + particle
// rotation logic.
export const HOMEPAGE_SECTIONS: HomepageSectionConfig[] = [
  {
    id: "hero",
    slug: "hero",
    name: "Hero",
    navCategory: "features",
    eyebrow: "BloomSuite",
    title: "Growth tools for modern garden centers",
    summary:
      "A calmer operating layer for campaigns, customer insight, and local commerce.",
    accent: "leaf",
    surface: "light",
    particleDensity: 0,
    particleTint: "bright",
  },
  {
    id: "problem",
    slug: "problem",
    name: "Problem",
    navCategory: "features",
    eyebrow: "The reality",
    title: "Marketing for garden centres usually looks like this.",
    summary:
      "Most garden centres are running customer marketing on tools built for someone else's business.",
    accent: "coral",
    surface: "subtle",
    particleDensity: 0,
    particleTint: "muted",
  },
  {
    id: "guide",
    slug: "guide",
    name: "Built for garden retail",
    navCategory: "features",
    eyebrow: "Built for garden retail",
    title: "We understand garden centres.",
    summary: "BloomSuite was built around how plant retail actually works.",
    accent: "leaf",
    surface: "light",
    particleDensity: 0,
    particleTint: "sage",
  },
  {
    id: "features",
    slug: "features",
    name: "Features",
    navCategory: "features",
    eyebrow: "Platform",
    title: "What you get with BloomSuite",
    summary:
      "Six tools in one workspace. No spreadsheets, no patchwork systems.",
    accent: "teal",
    surface: "subtle",
    particleDensity: 0,
    particleTint: "sage",
  },
  {
    id: "ai",
    slug: "ai",
    name: "AI",
    navCategory: "ai",
    eyebrow: "AI",
    title: "AI that knows your customers.",
    summary:
      "Trained on your sales history and brand voice. It drafts, segments, and suggests. You approve.",
    accent: "indigo",
    surface: "dark",
    particleDensity: 0,
    particleTint: "none",
  },
  {
    id: "integrations",
    slug: "integrations",
    name: "Integrations",
    navCategory: "integrations",
    eyebrow: "Integrations",
    title: "Connects to what you already use.",
    summary: "Two-way sync with the tools your store already runs on.",
    accent: "teal",
    surface: "subtle",
    particleDensity: 0,
    particleTint: "sage",
  },
  {
    id: "differentiators",
    slug: "differentiators",
    name: "More than software",
    navCategory: "integrations",
    eyebrow: "More than software",
    title: "A partner for your garden centre.",
    summary:
      "BloomSuite isn't just a platform. You also get the people, the training, and the community that come with it.",
    accent: "leaf",
    surface: "light",
    particleDensity: 0,
    particleTint: "sage",
  },
  {
    id: "start",
    slug: "start",
    name: "Pricing",
    navCategory: "pricing",
    eyebrow: PRICING_SECTION_HEADER.eyebrow,
    title: PRICING_SECTION_HEADER.headline,
    summary: PRICING_SECTION_HEADER.subtext,
    accent: "teal",
    surface: "light",
    particleDensity: 0,
    particleTint: "sage",
  },
];

export const HOMEPAGE_NAV_ITEMS: HomepageNavItemConfig[] = [
  { label: "Features", category: "features", targetSlug: "features" },
  { label: "AI", category: "ai", targetSlug: "ai" },
  {
    label: "Integrations",
    category: "integrations",
    targetSlug: "integrations",
  },
  {
    label: "Pricing",
    category: "pricing",
    targetSlug: "start",
    targetHref: "/pricing",
  },
];

export const getHomepageSectionIndexBySlug = (slug: string) =>
  HOMEPAGE_SECTIONS.findIndex((section) => section.slug === slug);

export const getHomepageNavTargetIndex = (targetSlug: string) => {
  const sectionIndex = getHomepageSectionIndexBySlug(targetSlug);
  return sectionIndex >= 0 ? sectionIndex : 0;
};
