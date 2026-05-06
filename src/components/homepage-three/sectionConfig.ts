import type { ParticleTint } from "./particles/atmosphere";
import type { TransitionPairConfig } from "./sectionEngine";
import { PRICING_SECTION_HEADER } from "./content/pricingCtaFooterContent";
import { TESTIMONIALS_SECTION_HEADER } from "./content/testimonialsSocialProofContent";

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
  targetSlug: string;
}

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
    particleDensity: 0.75,
    particleTint: "bright",
  },
  {
    id: "features",
    slug: "features",
    name: "Features",
    navCategory: "features",
    eyebrow: "Features",
    title: "Everyday marketing work in one steady flow",
    summary:
      "Plan seasonal moments, prepare content, and keep the next customer touch ready.",
    accent: "teal",
    surface: "subtle",
    particleDensity: 0.4,
    particleTint: "sage",
  },
  {
    id: "customer-growth",
    slug: "customer-growth",
    name: "Customer Growth",
    navCategory: "features",
    eyebrow: "Customer Growth",
    title: "Customer context that travels with every campaign",
    summary:
      "Segments, preferences, and history stay close to the work your team is doing.",
    accent: "coral",
    surface: "subtle",
    particleDensity: 0.35,
    particleTint: "muted",
  },
  {
    id: "ai",
    slug: "ai",
    name: "AI",
    navCategory: "ai",
    eyebrow: "AI",
    title: "Creative assistance tuned for horticulture retail",
    summary:
      "Draft timely messages, refine offers, and turn local ideas into polished outreach.",
    accent: "indigo",
    surface: "dark",
    particleDensity: 0,
    particleTint: "none",
  },
  {
    id: "automation",
    slug: "automation",
    name: "Impact",
    navCategory: "ai",
    eyebrow: "Real Impact",
    title: "Why Teams Choose BloomSuite",
    summary:
      "Trusted by garden centres and florists to drive measurable growth.",
    accent: "leaf",
    surface: "light",
    particleDensity: 0.5,
    particleTint: "sage",
  },
  {
    id: "integrations",
    slug: "integrations",
    name: "Integrations",
    navCategory: "integrations",
    eyebrow: "Integrations",
    title: "Connect point of sale, email, and commerce systems",
    summary:
      "Keep the tools you already trust while BloomSuite coordinates the customer layer.",
    accent: "teal",
    surface: "subtle",
    particleDensity: 0.35,
    particleTint: "sage",
  },
  {
    id: "testimonials",
    slug: "testimonials",
    name: TESTIMONIALS_SECTION_HEADER.eyebrow,
    navCategory: "integrations",
    eyebrow: TESTIMONIALS_SECTION_HEADER.eyebrow,
    title: TESTIMONIALS_SECTION_HEADER.headline,
    summary: TESTIMONIALS_SECTION_HEADER.subtext,
    accent: "leaf",
    surface: "light",
    particleDensity: 0.4,
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
    particleDensity: 0.45,
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
  { label: "Pricing", category: "pricing", targetSlug: "start" },
];

export const HOMEPAGE_TRANSITIONS: TransitionPairConfig[] = [
  { from: 0, to: 1, type: "slide-up", durationMs: 700 },
  { from: 1, to: 2, type: "slide-up", durationMs: 700 },
  { from: 2, to: 3, type: "dissolve", durationMs: 800 },
  { from: 3, to: 4, type: "dissolve", durationMs: 800 },
  { from: 4, to: 5, type: "crossfade-hold", durationMs: 600 },
  { from: 5, to: 6, type: "crossfade-hold", durationMs: 600 },
  { from: 6, to: 7, type: "scale-fade", durationMs: 700 },
];

export const getHomepageSectionIndexBySlug = (slug: string) =>
  HOMEPAGE_SECTIONS.findIndex((section) => section.slug === slug);

export const getHomepageNavTargetIndex = (targetSlug: string) => {
  const sectionIndex = getHomepageSectionIndexBySlug(targetSlug);
  return sectionIndex >= 0 ? sectionIndex : 0;
};
