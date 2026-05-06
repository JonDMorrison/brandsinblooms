import type { ComponentType, SVGProps } from "react";
import { Instagram, Linkedin, Twitter } from "lucide-react";

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
  eyebrow: "SIMPLE PRICING",
  headline: "Plans That Grow With You",
  subtext: "Start free. Upgrade when you're ready. No surprises.",
};

export const PRICING_CARDS_LABEL = "Pricing plan cards";
export const PRICING_MOBILE_INITIAL_PLAN_ID: PricingPlanId = "growth";

export const PRICING_PLANS: PricingPlanConfig[] = [
  {
    id: "starter",
    name: "Starter",
    price: "Free",
    priceDetail: "Forever",
    featureListLabel: "Starter plan features",
    features: ["Up to 100 customers", "Basic CRM", "1 store", "Email support"],
    ctaLabel: "Get Started",
    ctaHref: "#start",
    ctaVariant: "secondary",
    delayMs: 150,
    entryDirection: "left",
  },
  {
    id: "growth",
    name: "Growth",
    price: "$49",
    priceDetail: "/month",
    featureListLabel: "Growth plan features",
    features: [
      "Unlimited customers",
      "AI Assistant",
      "Campaign Builder",
      "Visual Editor",
      "Up to 3 stores",
      "Priority support",
    ],
    ctaLabel: "Start Free Trial",
    ctaHref: "#start",
    ctaVariant: "primary",
    featured: true,
    featuredChip: "Most Popular",
    delayMs: 0,
    entryDirection: "center",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    priceDetail: "Tailored to you",
    featureListLabel: "Enterprise plan features",
    features: [
      "Everything in Growth",
      "Unlimited stores",
      "Dedicated success manager",
      "Custom integrations",
      "SLA guarantee",
    ],
    ctaLabel: "Contact Sales",
    ctaHref: "#contact-sales",
    ctaVariant: "secondary",
    delayMs: 150,
    entryDirection: "right",
  },
];

export const FINAL_CTA_CONTENT = {
  ariaLabel: "Final homepage call to action",
  headline: "Ready to Grow Your Green Business?",
  primaryCta: "Start Free Trial",
  primaryHref: "#start",
  secondaryCta: "Book a Demo",
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
        { label: "Blog", href: "/blog" },
        { label: "Careers", href: "/careers" },
        { label: "Contact", href: "/contact" },
        { label: "Press Kit", href: "/press-kit" },
      ],
    },
    {
      title: "RESOURCES",
      links: [
        { label: "Documentation", href: "/docs" },
        { label: "API Reference", href: "/api" },
        { label: "Status Page", href: "/status" },
        { label: "Changelog", href: "/changelog" },
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
