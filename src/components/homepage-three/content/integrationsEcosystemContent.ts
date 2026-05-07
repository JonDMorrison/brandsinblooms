import { providerLogoAssets } from "@/components/integrations/providerLogoAssets";
import { socialIconUrls } from "@/utils/socialIcons";

export type IntegrationCardSize = "standard";

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
  eyebrow: "Integrations",
  headline: "Connects to what you already use.",
  subtext: "Two-way sync with the tools your store already runs on.",
};

export const INTEGRATION_COUNT_COPY = {
  headline: "10+ integrations and growing",
  cta: "Don't see yours? We'll build it.",
  ctaHref: "#contact",
};

// Ordered by category for scannability: POS first (the most-asked-
// about integration for garden centres), then ecommerce, email,
// social, analytics. Stripe (payments-only) and Cloudflare
// (infrastructure-only) were dropped — neither speaks to the garden
// centre operator's day-to-day. VMX POS added to round out the POS
// row alongside Lightspeed, Square, and Clover.
export const INTEGRATION_CARDS: IntegrationCardConfig[] = [
  {
    id: "lightspeed",
    name: "Lightspeed",
    logo: {
      src: getProviderLogo("lightspeed"),
      alt: "Lightspeed logo",
    },
    category: "POS",
    description: "Live inventory and sales sync, location by location.",
    size: "standard",
    delayMs: 0,
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
      "Transactions and customer data flow into BloomSuite automatically.",
    size: "standard",
    delayMs: 80,
  },
  {
    id: "clover",
    name: "Clover",
    logo: {
      src: getProviderLogo("clover"),
      alt: "Clover logo",
    },
    category: "POS",
    description:
      "Transactions, inventory, and customer data, synced to your dashboard.",
    size: "standard",
    delayMs: 160,
  },
  {
    id: "vmx-pos",
    name: "VMX POS",
    logo: {
      src: getProviderLogo("vmx-pos"),
      alt: "VMX POS logo",
    },
    category: "POS",
    description:
      "Transactions, customer data, and receipt-level history syncing into BloomSuite live.",
    size: "standard",
    delayMs: 240,
  },
  {
    id: "shopify",
    name: "Shopify",
    logo: {
      src: getProviderLogo("shopify"),
      alt: "Shopify logo",
    },
    category: "E-COMMERCE",
    description: "Two-way sync of products, orders, and customers.",
    size: "standard",
    delayMs: 320,
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
      "Audiences and segments stay in lockstep across both platforms.",
    size: "standard",
    delayMs: 400,
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
      "Lifecycle flows, predictive analytics, and shared customer data.",
    size: "standard",
    delayMs: 480,
  },
  {
    id: "constant-contact",
    name: "Constant Contact",
    logo: {
      src: getProviderLogo("constant-contact"),
      alt: "Constant Contact logo",
    },
    category: "EMAIL",
    description:
      "Sync lists, automate campaigns, and keep contact preferences in one place.",
    size: "standard",
    delayMs: 560,
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
      "Publish to Facebook and Instagram from your campaign builder.",
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
      "Storefront traffic, conversions, and customer journeys mapped to your CRM.",
    size: "standard",
    delayMs: 720,
  },
];
