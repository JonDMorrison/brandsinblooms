import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Globe,
  Mail,
  Network,
  ShoppingBag,
  ShoppingCart,
  Store,
  Webhook,
  Zap,
} from "lucide-react";

export type IntegrationStatus = "connected" | "available" | "coming-soon";

export type IntegrationCategory =
  | "pos-systems"
  | "social"
  | "analytics"
  | "marketing-import"
  | "automation"
  | "infrastructure";

export type IntegrationTabValue = "all" | IntegrationCategory;

export interface IntegrationChildStatus {
  name: string;
  status: Extract<IntegrationStatus, "connected" | "available">;
  description?: string;
}

export interface IntegrationDefinition {
  slug: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  categoryLabel: string;
  status: IntegrationStatus;
  icon: LucideIcon;
  keywords: string[];
  syncScopeLabel?: string;
  connectedSince?: string | null;
  targetPath?: string;
  actionLabel?: string;
  detailActionLabel?: string;
  disablePrimaryAction?: boolean;
  canDisconnect?: boolean;
  isManagedInfrastructure?: boolean;
  detailSummary?: string;
  metaLabel?: string;
  children?: IntegrationChildStatus[];
}

interface IntegrationSeed extends Omit<IntegrationDefinition, "status"> {
  defaultStatus: IntegrationStatus;
}

export interface IntegrationSummaryCounts {
  connected: number;
  available: number;
  comingSoon: number;
  total: number;
}

export const INTEGRATION_CATEGORIES: Array<{
  value: IntegrationCategory;
  label: string;
}> = [
  { value: "pos-systems", label: "POS Systems" },
  { value: "social", label: "Social" },
  { value: "analytics", label: "Analytics" },
  { value: "marketing-import", label: "Marketing Import" },
  { value: "automation", label: "Automation" },
  { value: "infrastructure", label: "Infrastructure" },
];

export const INTEGRATION_STATUS_ORDER: IntegrationStatus[] = [
  "connected",
  "available",
  "coming-soon",
];

const INTEGRATION_SEEDS: IntegrationSeed[] = [
  {
    slug: "square",
    name: "Square",
    description:
      "Sync customers, orders, and loyalty data from your Square merchant account.",
    category: "pos-systems",
    categoryLabel: "POS Systems",
    defaultStatus: "available",
    icon: Store,
    keywords: ["square", "pos", "customers", "orders", "merchant"],
    syncScopeLabel: "Customers + Orders",
    canDisconnect: true,
    targetPath: "/integrations/square/guide",
    actionLabel: "Connect",
    detailActionLabel: "Open Square setup",
    detailSummary:
      "Square keeps BloomSuite aligned with your live customer and order activity.",
  },
  {
    slug: "clover",
    name: "Clover",
    description:
      "Connect Clover to bring POS customer and sales data into BloomSuite.",
    category: "pos-systems",
    categoryLabel: "POS Systems",
    defaultStatus: "available",
    icon: ShoppingBag,
    keywords: ["clover", "pos", "orders", "customers"],
    syncScopeLabel: "Customers + Orders",
    canDisconnect: true,
    targetPath: "/integrations/clover/guide",
    actionLabel: "Connect",
    detailActionLabel: "Open Clover setup",
    detailSummary:
      "Clover sync keeps customer and purchase history ready for campaigns and segmentation.",
  },
  {
    slug: "lightspeed",
    name: "Lightspeed X-Series",
    description:
      "Sync retail activity, customers, and products from your Lightspeed X-Series store.",
    category: "pos-systems",
    categoryLabel: "POS Systems",
    defaultStatus: "available",
    icon: ShoppingCart,
    keywords: ["lightspeed", "vend", "x-series", "pos", "orders"],
    syncScopeLabel: "Customers + Orders",
    canDisconnect: true,
    targetPath: "/integrations/lightspeed/connect",
    actionLabel: "Connect",
    detailActionLabel: "Open Lightspeed setup",
    detailSummary:
      "Lightspeed X-Series powers BloomSuite with retail customer and order events.",
  },
  {
    slug: "shopify",
    name: "Shopify",
    description:
      "Sync products, orders, and customers between Shopify and BloomSuite.",
    category: "pos-systems",
    categoryLabel: "POS Systems",
    defaultStatus: "coming-soon",
    icon: ShoppingBag,
    keywords: ["shopify", "ecommerce", "storefront"],
    syncScopeLabel: "Ecommerce customers + orders",
    disablePrimaryAction: true,
    actionLabel: "Notify me",
    detailActionLabel: "Request Shopify access",
    detailSummary:
      "Shopify will arrive as a future ecommerce connection for customer and order syncing inside BloomSuite.",
  },
  {
    slug: "meta",
    name: "Meta",
    description:
      "Manage Facebook Pages and Instagram Business accounts through a single Meta connection.",
    category: "social",
    categoryLabel: "Social",
    defaultStatus: "available",
    icon: Network,
    keywords: ["meta", "facebook", "instagram", "social", "pages", "publishing"],
    syncScopeLabel: "Facebook + Instagram publishing",
    canDisconnect: true,
    targetPath: "/social-accounts",
    actionLabel: "Connect",
    detailActionLabel: "Open social account settings",
    detailSummary:
      "Meta authorizes Facebook Pages and Instagram Business accounts from a shared OAuth flow.",
    children: [
      {
        name: "Facebook",
        status: "available",
        description: "Facebook Pages and publishing access",
      },
      {
        name: "Instagram",
        status: "available",
        description: "Instagram Business account access",
      },
    ],
  },
  {
    slug: "google-analytics",
    name: "Google Analytics 4",
    description:
      "Pull website traffic, conversions, and attribution data into BloomSuite reporting.",
    category: "analytics",
    categoryLabel: "Analytics",
    defaultStatus: "available",
    icon: BarChart3,
    keywords: ["ga4", "google analytics", "analytics", "traffic"],
    syncScopeLabel: "Traffic + Engagement",
    canDisconnect: true,
    targetPath: "/integrations/website",
    actionLabel: "Connect",
    detailActionLabel: "Open GA4 settings",
    detailSummary:
      "GA4 provides website traffic and engagement signals for BloomSuite analytics.",
  },
  {
    slug: "mailchimp",
    name: "Mailchimp",
    description:
      "Import contacts, lists, tags, and consent data from your Mailchimp account.",
    category: "marketing-import",
    categoryLabel: "Marketing Import",
    defaultStatus: "available",
    icon: Mail,
    keywords: ["mailchimp", "email", "contacts", "segments", "lists"],
    syncScopeLabel: "Contacts + Lists",
    canDisconnect: true,
    targetPath: "/integrations/migrations",
    actionLabel: "Connect",
    detailActionLabel: "Open import flow",
    detailSummary:
      "Mailchimp import brings audience lists and consent history into BloomSuite.",
  },
  {
    slug: "klaviyo",
    name: "Klaviyo",
    description:
      "Migrate profiles, lists, and segments from Klaviyo into BloomSuite.",
    category: "marketing-import",
    categoryLabel: "Marketing Import",
    defaultStatus: "available",
    icon: Mail,
    keywords: ["klaviyo", "profiles", "segments", "lists", "email"],
    syncScopeLabel: "Profiles + Lists",
    canDisconnect: true,
    targetPath: "/integrations/migrations",
    actionLabel: "Connect",
    detailActionLabel: "Open import flow",
    detailSummary:
      "Klaviyo import carries over profiles and list structure for BloomSuite CRM.",
  },
  {
    slug: "constant-contact",
    name: "Constant Contact",
    description:
      "Import contacts and lists from Constant Contact into BloomSuite.",
    category: "marketing-import",
    categoryLabel: "Marketing Import",
    defaultStatus: "available",
    icon: Mail,
    keywords: ["constant contact", "contacts", "lists", "email"],
    syncScopeLabel: "Contacts + Lists",
    canDisconnect: true,
    targetPath: "/integrations/migrations",
    actionLabel: "Connect",
    detailActionLabel: "Open import flow",
    detailSummary:
      "Constant Contact import brings list structure and contact records into BloomSuite.",
  },
  {
    slug: "custom-webhooks",
    name: "Custom Webhooks",
    description:
      "Push BloomSuite CRM events to any external system via HTTP webhook.",
    category: "automation",
    categoryLabel: "Automation",
    defaultStatus: "coming-soon",
    icon: Webhook,
    keywords: ["webhooks", "api", "automation", "callbacks"],
    syncScopeLabel: "Outbound callbacks + inbound triggers",
    disablePrimaryAction: true,
    actionLabel: "Notify me",
    detailActionLabel: "Request webhook access",
    detailSummary:
      "Custom webhooks are planned for future outbound callbacks and inbound workflow automation.",
  },
  {
    slug: "email-infrastructure",
    name: "Email Infrastructure",
    description:
      "Monitor your sending domain, DNS health, and email deliverability from one place.",
    category: "infrastructure",
    categoryLabel: "Infrastructure",
    defaultStatus: "available",
    icon: Globe,
    keywords: ["domain", "dns", "email", "resend", "entri", "infrastructure"],
    syncScopeLabel: "Sending domain + DNS",
    canDisconnect: false,
    isManagedInfrastructure: true,
    targetPath: "/domains",
    actionLabel: "Manage settings",
    detailActionLabel: "Open infrastructure settings",
    detailSummary:
      "BloomSuite email infrastructure covers sending domains, DNS verification, provider readiness, and tenant-level delivery health.",
  },
];

export function getIntegrationSeed(slug: string) {
  if (slug === "lightspeed-x-series") {
    return INTEGRATION_SEEDS.find((seed) => seed.slug === "lightspeed") ?? null;
  }

  if (slug === "google-analytics-4") {
    return (
      INTEGRATION_SEEDS.find((seed) => seed.slug === "google-analytics") ??
      null
    );
  }

  if (slug === "email-domain-dns") {
    return (
      INTEGRATION_SEEDS.find((seed) => seed.slug === "email-infrastructure") ??
      null
    );
  }

  return INTEGRATION_SEEDS.find((seed) => seed.slug === slug) ?? null;
}

export function getIntegrationSeeds() {
  return INTEGRATION_SEEDS.slice();
}

export function filterIntegrations(
  items: IntegrationDefinition[],
  activeTab: IntegrationTabValue,
  searchQuery: string,
) {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return items.filter((item) => {
    const matchesCategory = activeTab === "all" || item.category === activeTab;
    if (!matchesCategory) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const haystack = [
      item.name,
      item.description,
      item.categoryLabel,
      item.syncScopeLabel,
      item.metaLabel,
      ...item.keywords,
      ...(item.children ?? []).flatMap((child) => [child.name, child.description ?? ""]),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

export function getTabCounts(
  items: IntegrationDefinition[],
  searchQuery: string,
): Record<IntegrationTabValue, number> {
  const counts: Record<IntegrationTabValue, number> = {
    all: filterIntegrations(items, "all", searchQuery).length,
    "pos-systems": 0,
    social: 0,
    analytics: 0,
    "marketing-import": 0,
    automation: 0,
    infrastructure: 0,
  };

  INTEGRATION_CATEGORIES.forEach((category) => {
    counts[category.value] = filterIntegrations(items, category.value, searchQuery).length;
  });

  return counts;
}

export function getSummaryCounts(items: IntegrationDefinition[]): IntegrationSummaryCounts {
  return items.reduce<IntegrationSummaryCounts>(
    (summary, item) => {
      if (item.status === "connected") {
        summary.connected += 1;
      } else if (item.status === "available") {
        summary.available += 1;
      } else {
        summary.comingSoon += 1;
      }

      summary.total += 1;
      return summary;
    },
    { connected: 0, available: 0, comingSoon: 0, total: 0 },
  );
}

export function groupIntegrationsByStatus(items: IntegrationDefinition[]) {
  return {
    connected: items.filter((item) => item.status === "connected"),
    available: items.filter((item) => item.status === "available"),
    comingSoon: items.filter((item) => item.status === "coming-soon"),
  };
}
