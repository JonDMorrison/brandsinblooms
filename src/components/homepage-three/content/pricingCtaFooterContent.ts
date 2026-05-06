import type { ComponentType, SVGProps } from "react";
import { Instagram, Linkedin, Twitter } from "lucide-react";

// Plan IDs are kept as starter/growth/enterprise to avoid breaking the
// PRICING_MOBILE_INITIAL_PLAN_ID reference and any consumer that branches
// on id. The user-facing names are Sprout / Bloom / Thrive per the
// product subscription enum.
export type PricingPlanId = "starter" | "growth" | "enterprise";
export type PricingPlanCtaVariant = "primary" | "secondary";
export type PricingPlanEntryDirection = "left" | "center" | "right";

export interface PricingPlanConfig {
  id: PricingPlanId;
  name: string;
  price: string;
  priceDetail: string;
  featureListLabel: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  ctaVariant: PricingPlanCtaVariant;
  featured?: boolean;
  featuredChip?: string;
  delayMs: number;
  entryDirection: PricingPlanEntryDirection;
}

export interface FooterLinkConfig {
  label: string;
  href: string;
}

export interface FooterColumnConfig {
  title: string;
  links: FooterLinkConfig[];
}

export interface FooterSocialLinkConfig extends FooterLinkConfig {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export const PRICING_SECTION_HEADER = {
  eyebrow: "Pricing",
  headline: "Plans that match your store.",
  subtext:
    "All plans include a 14-day free trial. Need CRM only without a website? See our Seed plan at $199/month on the pricing page.",
};

export const PRICING_CARDS_LABEL = "Pricing plan cards";
export const PRICING_MOBILE_INITIAL_PLAN_ID: PricingPlanId = "growth";

// Card prices and feature lists mirror the canonical intro pricing in
// src/components/pricing/pricingConfig.ts (Sprout $349 / Bloom $699 /
// Thrive $1,199). All three cards route to /pricing for the full plan
// detail page rather than triggering an in-page section anchor.
export const PRICING_PLANS: PricingPlanConfig[] = [
  {
    id: "starter",
    name: "Sprout",
    price: "$349",
    priceDetail: "/month",
    featureListLabel: "Sprout plan features",
    features: [
      "Website + Ecommerce + BloomSuite",
      "Up to 10,000 contacts",
      "20,000 emails per month",
      "2,000 SMS per month",
      "Email support",
    ],
    ctaLabel: "See plan details",
    ctaHref: "/pricing",
    ctaVariant: "secondary",
    delayMs: 150,
    entryDirection: "left",
  },
  {
    id: "growth",
    name: "Bloom",
    price: "$699",
    priceDetail: "/month",
    featureListLabel: "Bloom plan features",
    features: [
      "Website + Ecommerce + BloomSuite",
      "Up to 25,000 contacts",
      "100,000 emails per month",
      "5,000 SMS per month",
      "Priority support",
    ],
    ctaLabel: "See plan details",
    ctaHref: "/pricing",
    ctaVariant: "primary",
    featured: true,
    featuredChip: "Most Popular",
    delayMs: 0,
    entryDirection: "center",
  },
  {
    id: "enterprise",
    name: "Thrive",
    price: "$1,199",
    priceDetail: "/month",
    featureListLabel: "Thrive plan features",
    features: [
      "Multi-location ready",
      "Unlimited emails",
      "50,000 SMS per month",
      "Dedicated success manager",
      "SLA guarantee",
    ],
    ctaLabel: "See plan details",
    ctaHref: "/pricing",
    ctaVariant: "secondary",
    delayMs: 150,
    entryDirection: "right",
  },
];

// Small line below the three pricing cards pointing users at the
// pricing page when they want the website-less "Seed" tier ($199/month
// CRM-only) — it doesn't appear on the homepage cards.
export const SEED_FOOTNOTE = {
  text: "Have a website already? Start with Seed at $199/month for CRM, messaging, automations, and insights without a new site.",
  linkLabel: "See all plans",
  linkHref: "/pricing",
};

export const FINAL_CTA_CONTENT = {
  ariaLabel: "Final homepage call to action",
  headline: "Ready to grow your garden centre?",
  subhead:
    "Start your trial today. No credit card. Ready to use in under an hour.",
  primaryCta: "Start free trial",
  // /auth matches the trial sign-up handler used by the top-nav
  // "Start Free Trial" button (NavigationShell.navigateToAuth).
  primaryHref: "/auth",
  secondaryCta: "Talk to our team",
  // /contact matches the top-nav "Book a Demo" handler
  // (NavigationShell.navigateToDemo).
  secondaryHref: "/contact",
  caption: "No credit card required · 14-day free trial · Cancel anytime",
};

export const FOOTER_CONTENT = {
  ariaLabel: "BloomSuite footer",
  navLabel: "Footer links",
  brandHomeLabel: "Go to BloomSuite homepage",
  wordmark: "BloomSuite",
  tagline: "Intelligence for green businesses",
  socialLabel: "BloomSuite social links",
  disableAnimationsLabel: "Disable animations",
  copyright: "© 2026 BloomSuite. All rights reserved.",
  socials: [
    {
      label: "LinkedIn",
      href: "https://www.linkedin.com/",
      icon: Linkedin,
    },
    {
      label: "Twitter/X",
      href: "https://x.com/",
      icon: Twitter,
    },
    {
      label: "Instagram",
      href: "https://www.instagram.com/",
      icon: Instagram,
    },
  ] satisfies FooterSocialLinkConfig[],
  columns: [
    {
      title: "PRODUCT",
      links: [
        { label: "Features", href: "/features" },
        { label: "Pricing", href: "/pricing" },
        { label: "Integrations", href: "#integrations" },
        { label: "FAQ", href: "/faq" },
      ],
    },
    {
      title: "COMPANY",
      links: [
        { label: "About", href: "/about" },
        { label: "Contact", href: "/contact" },
      ],
    },
    {
      title: "LEGAL",
      links: [
        { label: "Privacy Policy", href: "/privacy" },
        { label: "Terms of Service", href: "/terms" },
        { label: "Platform Agreement", href: "/platform-agreement" },
        { label: "SMS Program", href: "/sms-program" },
      ],
    },
  ] satisfies FooterColumnConfig[],
};
