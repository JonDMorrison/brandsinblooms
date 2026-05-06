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
  subtext: "Free 14-day trial. No credit card. Cancel anytime.",
};

export const PRICING_CARDS_LABEL = "Pricing plan cards";
export const PRICING_MOBILE_INITIAL_PLAN_ID: PricingPlanId = "growth";

export const PRICING_PLANS: PricingPlanConfig[] = [
  {
    id: "starter",
    name: "Sprout",
    price: "Free",
    priceDetail: "14-day trial",
    featureListLabel: "Sprout plan features",
    features: [
      "14-day trial",
      "Up to 100 customers",
      "Customer CRM",
      "One location",
      "Email support",
    ],
    ctaLabel: "Start free trial",
    ctaHref: "#start",
    ctaVariant: "secondary",
    delayMs: 150,
    entryDirection: "left",
  },
  {
    id: "growth",
    name: "Bloom",
    price: "$49",
    priceDetail: "/month",
    featureListLabel: "Bloom plan features",
    features: [
      "Unlimited customers",
      "AI assistant",
      "Campaign builder",
      "Storefront editor",
      "Up to 3 locations",
      "Priority support",
    ],
    ctaLabel: "Start free trial",
    ctaHref: "#start",
    ctaVariant: "primary",
    featured: true,
    featuredChip: "Most Popular",
    delayMs: 0,
    entryDirection: "center",
  },
  {
    id: "enterprise",
    name: "Thrive",
    price: "Custom",
    priceDetail: "Tailored to you",
    featureListLabel: "Thrive plan features",
    features: [
      "Everything in Bloom",
      "Unlimited locations",
      "Dedicated success manager",
      "Custom integrations",
      "SLA guarantee",
    ],
    ctaLabel: "Contact sales",
    ctaHref: "#contact-sales",
    ctaVariant: "secondary",
    delayMs: 150,
    entryDirection: "right",
  },
];

export const FINAL_CTA_CONTENT = {
  ariaLabel: "Final homepage call to action",
  headline: "Ready to run customer marketing your way?",
  primaryCta: "Start free trial",
  primaryHref: "#start",
  secondaryCta: "Book a demo",
  secondaryHref: "#demo",
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
        { label: "CRM", href: "#customer-growth" },
        { label: "AI Assistant", href: "#ai" },
        { label: "Visual Editor", href: "#features" },
        { label: "Campaign Builder", href: "#features" },
        { label: "Integrations", href: "#integrations" },
        { label: "Pricing", href: "#start" },
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
        { label: "Cookie Policy", href: "/cookies" },
      ],
    },
  ] satisfies FooterColumnConfig[],
};
