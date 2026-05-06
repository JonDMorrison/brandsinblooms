import { providerLogoAssets } from "@/components/integrations/providerLogoAssets";
import { socialIconUrls } from "@/utils/socialIcons";

export type IntegrationCardSize = "standard" | "wide";

export interface IntegrationLogoConfig {
  src: string;
  alt: string;
}

export interface IntegrationCardConfig {
  id: string;
  name: string;
  logo?: IntegrationLogoConfig;
  category: string;
  description: string;
  size: IntegrationCardSize;
  delayMs: number;
}

const getProviderLogo = (integrationId: string) => {
  const logoSrc = providerLogoAssets[integrationId];

  if (!logoSrc) {
    throw new Error(`Missing logo asset for ${integrationId}.`);
  }

  return logoSrc;
};

export const INTEGRATIONS_SECTION_HEADER = {
  eyebrow: "INTEGRATIONS",
  headline: "Works With Your Favorite Tools",
  subtext:
    "Connect BloomSuite with the platforms you already rely on, set up in minutes, not days.",
};

export const INTEGRATION_COUNT_COPY = {
  headline: "12+ integrations and growing",
  cta: "Don't see yours? We'll build it.",
  ctaHref: "#contact",
};

export const INTEGRATION_CARDS: IntegrationCardConfig[] = [
  {
    id: "stripe",
    name: "Stripe",
    logo: {
      src: getProviderLogo("stripe"),
      alt: "Stripe logo",
    },
    category: "PAYMENTS",
    description:
      "Accept payments, manage subscriptions, and handle invoicing, all synced with your CRM in real-time.",
    size: "wide",
    delayMs: 0,
  },
  {
    id: "shopify",
    name: "Shopify",
    logo: {
      src: getProviderLogo("shopify"),
      alt: "Shopify logo",
    },
    category: "E-COMMERCE",
    description:
      "Sync products, orders, and customers between your Shopify store and BloomSuite.",
    size: "standard",
    delayMs: 80,
  },
  {
    id: "lightspeed",
    name: "Lightspeed",
    logo: {
      src: getProviderLogo("lightspeed"),
      alt: "Lightspeed logo",
    },
    category: "POS",
    description:
      "Connect your Lightspeed POS for real-time inventory and sales sync.",
    size: "standard",
    delayMs: 160,
  },
  {
    id: "square",
    name: "Square",
    logo: {
      src: getProviderLogo("square"),
      alt: "Square logo",
    },
    category: "POS",
    description:
      "Process payments and sync Square transactions directly into your dashboard.",
    size: "standard",
    delayMs: 240,
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    logo: {
      src: getProviderLogo("mailchimp"),
      alt: "Mailchimp logo",
    },
    category: "EMAIL",
    description:
      "Import audiences, sync segments, and trigger campaigns across both platforms.",
    size: "standard",
    delayMs: 320,
  },
  {
    id: "klaviyo",
    name: "Klaviyo",
    logo: {
      src: getProviderLogo("klaviyo"),
      alt: "Klaviyo logo",
    },
    category: "EMAIL",
    description:
      "Advanced email automation with deep customer data sync, lifecycle flows, predictive analytics, and segmentation.",
    size: "wide",
    delayMs: 400,
  },
  {
    id: "meta",
    name: "Meta",
    logo: {
      src: socialIconUrls.facebook,
      alt: "Facebook logo",
    },
    category: "SOCIAL",
    description:
      "Connect Facebook and Instagram for social publishing and analytics.",
    size: "standard",
    delayMs: 480,
  },
  {
    id: "cloudflare",
    name: "Cloudflare",
    logo: {
      src: getProviderLogo("cloudflare"),
      alt: "Cloudflare logo",
    },
    category: "INFRASTRUCTURE",
    description:
      "CDN, security, and performance optimization for your storefront.",
    size: "standard",
    delayMs: 560,
  },
  {
    id: "clover",
    name: "Clover",
    logo: {
      src: getProviderLogo("clover"),
      alt: "Clover logo",
    },
    category: "POS",
    description: "Sync Clover POS transactions, inventory, and customer data.",
    size: "standard",
    delayMs: 640,
  },
  {
    id: "google-analytics",
    name: "Google Analytics",
    logo: {
      src: getProviderLogo("google-analytics"),
      alt: "Google Analytics logo",
    },
    category: "ANALYTICS",
    description:
      "Track storefront traffic, conversions, and customer journeys.",
    size: "standard",
    delayMs: 720,
  },
];
