// The trust strip ("Connects to the tools you already use" + 6 logos) was
// removed from the top of the Features section — the full Integrations
// section further down covers the same ground with more detail. The
// TrustLogoConfig / TRUST_STRIP_CAPTION / TRUST_LOGOS exports and the
// providerLogoAssets import that fed the strip's logos were dropped at
// the same time.

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

// Outcome-led card titles: each card opens with the result the operator
// gets, not the feature name. Card 6's id stays as "multi-store" even
// though its pitch broadened to "Single Login, Many Features" — the id
// is referenced by downstream asset maps and tests; renaming it would
// cause unrelated breakage. A dedicated id-rename commit can follow
// later if it bothers anyone reading the code.
export const FEATURE_HIGHLIGHTS: FeatureHighlightConfig[] = [
  {
    id: "smart-crm",
    placeholderLabel: "Remember Every Customer",
    title: "Remember Every Customer",
    description:
      "A CRM built for garden centres. Every visit, every purchase, every preference, on one timeline. Walk-ins, repeat buyers, and lapsed customers all in one place.",
  },
  {
    id: "campaign-builder",
    placeholderLabel: "Send the Right Message at the Right Time",
    title: "Send the Right Message at the Right Time",
    description:
      "Email and SMS campaigns drafted with AI, segmented by who actually buys what, and scheduled around your busy season. Set them up once, run them every year.",
  },
  {
    id: "inventory-orders",
    placeholderLabel: "Know What's Selling, Live",
    title: "Know What's Selling, Live",
    description:
      "Inventory and order data syncing from Lightspeed, Square, and Shopify. See what's moving, what's stuck, and what to reorder before you run out.",
  },
  {
    id: "page-editor",
    placeholderLabel: "A Storefront That Sells for You",
    title: "A Storefront That Sells for You",
    description:
      "A drag-and-drop ecommerce site with your branding, your products, and pickup or delivery options. No web developer, no second platform fee.",
  },
  {
    id: "analytics-dashboard",
    placeholderLabel: "Numbers in Plain English",
    title: "Numbers in Plain English",
    description:
      "Analytics that tell you what worked, what didn't, and what to try next. No dashboards to interpret, no spreadsheets to build, no consultant to hire.",
  },
  {
    id: "multi-store",
    placeholderLabel: "Single Login, Many Features",
    title: "Single Login, Many Features",
    description:
      "One platform for your CRM, campaigns, inventory, storefront, and analytics. No tab-switching, no separate bills, no data silos. Everything talks to everything, automatically.",
  },
];
