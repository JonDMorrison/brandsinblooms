import { providerLogoAssets } from "@/components/integrations/providerLogoAssets";

export interface TrustLogoConfig {
  label: string;
  src?: string;
}

export type FeatureHighlightId =
  | "smart-crm"
  | "campaign-builder"
  | "inventory-orders"
  | "page-editor"
  | "analytics-dashboard"
  | "multi-store";

export interface FeatureHighlightConfig {
  id: FeatureHighlightId;
  placeholderLabel: string;
  title: string;
  description: string;
}

export const FEATURE_SECTION_HEADER = {
  eyebrow: "PLATFORM FEATURES",
  headline: "Everything You Need to Grow",
  subtext:
    "Advanced tools designed for garden centres, florists, and eco-conscious retailers.",
};

export const TRUST_STRIP_CAPTION = "Trusted by leading green businesses";

export const TRUST_LOGOS: TrustLogoConfig[] = [
  { label: "Lightspeed", src: providerLogoAssets.lightspeed },
  { label: "Stripe", src: providerLogoAssets.stripe },
  { label: "Shopify", src: providerLogoAssets.shopify },
  { label: "Mailchimp", src: providerLogoAssets.mailchimp },
  { label: "Square", src: providerLogoAssets.square },
  { label: "Cloudflare", src: providerLogoAssets.cloudflare },
];

export const FEATURE_HIGHLIGHTS: FeatureHighlightConfig[] = [
  {
    id: "smart-crm",
    placeholderLabel: "Customer Dashboard",
    title: "Smart Customer CRM",
    description:
      "360° profiles, purchase history, lifecycle stages, and AI-powered insights.",
  },
  {
    id: "campaign-builder",
    placeholderLabel: "Campaign Editor",
    title: "AI Campaign Builder",
    description:
      "Email and SMS campaigns generated, audience-matched, and timed by AI.",
  },
  {
    id: "inventory-orders",
    placeholderLabel: "Inventory View",
    title: "Inventory & Orders",
    description:
      "Real-time tracking, predictive restocking, and multi-channel order management.",
  },
  {
    id: "page-editor",
    placeholderLabel: "Page Builder",
    title: "Visual Page Editor",
    description:
      "Drag-and-drop storefront builder with themes, blocks, and brand customization.",
  },
  {
    id: "analytics-dashboard",
    placeholderLabel: "Analytics View",
    title: "Growth Analytics",
    description:
      "AI-explained metrics — what happened, why, and what to do next.",
  },
  {
    id: "multi-store",
    placeholderLabel: "Multi-Store View",
    title: "Multi-Store Control",
    description:
      "One platform for every location. Shared AI intelligence across stores.",
  },
];
