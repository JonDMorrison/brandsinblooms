import type { ComponentType, SVGProps } from "react";

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
 eyebrow: "Pricing preview · USD",
 headline: "Three products. One simple starting price.",
 subtext: "Choose BloomSites, BloomSuite POS or BloomSuite CRM for $99/month each, or all three for $250/month. Explore proposed pricing and confirm your quote with our team.",
};
export const PRICING_CARDS_LABEL = "Pricing plan cards";
export const PRICING_MOBILE_INITIAL_PLAN_ID: PricingPlanId = "growth";
export const PRICING_PLANS: PricingPlanConfig[] = [
 {id:"starter",name:"BloomSites",price:"$99",priceDetail:"/month USD",featureListLabel:"BloomSites features",features:["Website and visual editor","Plant catalogue and discovery","Online selling capability"],ctaLabel:"Calculate my setup",ctaHref:"/build-your-suite?product=site",ctaVariant:"secondary",delayMs:150,entryDirection:"left"},
 {id:"growth",name:"BloomSuite POS",price:"$99",priceDetail:"/month USD",featureListLabel:"BloomSuite POS features",features:["Garden centre checkout","Stock and receiving","One location and one register"],ctaLabel:"Calculate my setup",ctaHref:"/build-your-suite?product=pos",ctaVariant:"primary",featured:true,featuredChip:"Built for garden retail",delayMs:0,entryDirection:"center"},
 {id:"enterprise",name:"BloomSuite CRM",price:"$99",priceDetail:"/month USD",featureListLabel:"BloomSuite CRM features",features:["Customer database and insights","Email campaigns and automations","20,000 monthly emails"],ctaLabel:"Calculate my setup",ctaHref:"/build-your-suite?product=crm",ctaVariant:"secondary",delayMs:150,entryDirection:"right"}
];
export const SEED_FOOTNOTE = {
 text: "Complete BloomSuite: all three for $250/month USD. Save $47/month. Proposed pricing; usage, processing and setup costs vary. Existing subscriptions stay unchanged.",
 linkLabel: "Build your BloomSuite",
 linkHref: "/pricing",
};
export const FINAL_CTA_CONTENT = {
  ariaLabel: "Final homepage call to action",
  headline: "Ready to grow your garden centre?",
  subhead:
    "Choose the products that fit your garden centre.",
  primaryCta: "Explore pricing",
  // /auth matches the trial sign-up handler used by the top-nav
  // "Start Free Trial" button (NavigationShell.navigateToAuth).
  primaryHref: "/pricing",
  secondaryCta: "Talk to our team",
  // /contact matches the top-nav "Book a Demo" handler
  // (NavigationShell.navigateToDemo).
  secondaryHref: "/contact",
  caption: "Transparent estimate · Confirm your setup with our team",
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
  // TODO: add social entries when BloomSuite Facebook/Instagram/LinkedIn profiles are created
  socials: [] satisfies FooterSocialLinkConfig[],
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
