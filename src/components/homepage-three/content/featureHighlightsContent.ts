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
  eyebrow: "Platform",
  headline: "What you get with BloomSuite",
  subtext: "Six tools in one workspace. No spreadsheets, no patchwork systems.",
};

export const TRUST_STRIP_CAPTION = "Connects to the tools you already use";

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
    placeholderLabel: "Customer CRM",
    title: "Customer CRM",
    description:
      "Every customer in one record. Purchase history, contact preferences, and lifecycle stage update from your POS automatically.",
  },
  {
    id: "campaign-builder",
    placeholderLabel: "Campaigns",
    title: "Campaigns",
    description:
      "Email and SMS drafted by AI, segmented by customer behaviour, scheduled to send when your customers actually open.",
  },
  {
    id: "inventory-orders",
    placeholderLabel: "Inventory and Orders",
    title: "Inventory and Orders",
    description:
      "Live POS sync from Lightspeed and Square. See what sold, what's left, and what to reorder, without an export.",
  },
  {
    id: "page-editor",
    placeholderLabel: "Storefront",
    title: "Storefront",
    description:
      "Drag-and-drop pages with your branding, products, and pickup or delivery options. Publish in minutes.",
  },
  {
    id: "analytics-dashboard",
    placeholderLabel: "Analytics",
    title: "Analytics",
    description:
      "Plain-language reports on what worked, what didn't, and what to do next. Numbers without dashboard fatigue.",
  },
  {
    id: "multi-store",
    placeholderLabel: "Multi-Location",
    title: "Multi-Location",
    description:
      "Run two stores or twenty from one workspace. Customer data and campaigns share across locations automatically.",
  },
];
