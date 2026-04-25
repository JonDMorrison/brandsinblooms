import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  Clipboard,
  Copy,
  ExternalLink,
  Import,
  LifeBuoy,
  Mail,
  Megaphone,
  MessageSquare,
  MoonStar,
  PackagePlus,
  Plus,
  RefreshCcw,
  Settings,
  ShieldCheck,
  Sparkles,
  SunMedium,
  TicketPlus,
  Users,
  Workflow,
} from "lucide-react";

import { buildJavaScriptEmbedCode, getPublicFormUrl } from "@/lib/forms/share";

import { scoreStaticSearchItem } from "./staticSearchRegistry";
import type { SearchResultItem } from "./types";

export type PaletteCommandId =
  | "go-dashboard"
  | "create-customer"
  | "import-customers"
  | "create-segment-from-customers"
  | "create-campaign"
  | "view-saved-blocks"
  | "check-sending-domain"
  | "preview-campaign"
  | "view-campaign-recipients"
  | "send-test-email"
  | "create-form"
  | "view-form-templates"
  | "create-automation"
  | "view-automation-templates"
  | "add-product"
  | "sync-pos"
  | "new-sms-campaign"
  | "new-sms-automation"
  | "connect-integration"
  | "check-connection-health"
  | "open-settings-connections"
  | "open-settings-compliance"
  | "open-billing"
  | "open-settings"
  | "open-account"
  | "clear-search-history"
  | "toggle-theme"
  | "show-shortcuts"
  | "create-ticket";

export type PaletteActionExecution =
  | {
      type: "navigate";
      route: string;
    }
  | {
      type: "open-new-tab";
      route: string;
    }
  | {
      type: "copy";
      value: string;
    }
  | {
      type: "toggle-automation";
      automationId: string;
      nextIsActive: boolean;
    }
  | {
      type: "duplicate-campaign";
      campaignId: string;
    }
  | {
      type: "clear-search-history";
    }
  | {
      type: "toggle-theme";
    }
  | {
      type: "show-shortcuts";
    }
  | {
      type: "send-test-email";
      campaignRoute: string;
    }
  | {
      type: "sync-pos";
      integrationRoute?: string;
    };

export interface PaletteExecutableAction {
  id: string;
  label: string;
  icon: LucideIcon;
  keepPaletteOpen?: boolean;
  successLabel?: string;
  execution: PaletteActionExecution;
}

interface CommandRegistryEntry {
  id: PaletteCommandId;
  title: string;
  subtitle?: string;
  icon: string;
  keywords: string[];
  resolve: (pathname: string) => PaletteActionExecution | null;
  isAvailable?: (pathname: string) => boolean;
}

const FALLBACK_PATHNAME = "/";
const COMMAND_METADATA = "Command";

function getActivePathname(pathname?: string): string {
  if (!pathname) {
    return FALLBACK_PATHNAME;
  }

  return pathname || FALLBACK_PATHNAME;
}

function withSearch(baseRoute: string, search: string): string {
  if (!search) {
    return baseRoute;
  }

  return `${baseRoute}${baseRoute.includes("?") ? "&" : "?"}${search}`;
}

function getCurrentCampaignBaseRoute(pathname: string): string | null {
  const match = pathname.match(/^\/crm\/campaigns\/([^/?#]+)(?:\/(?:analytics|report|recipients)(?:\/[^/?#]+)?)?$/);

  if (!match) {
    return null;
  }

  return `/crm/campaigns/${match[1]}`;
}

function isCampaignRoute(pathname: string): boolean {
  return getCurrentCampaignBaseRoute(pathname) !== null;
}

function isProductsRoute(pathname: string): boolean {
  return /^\/products(?:\/|$)/.test(pathname);
}

function isIntegrationsRoute(pathname: string): boolean {
  return /^\/integrations(?:\/|$)/.test(pathname);
}

const COMMAND_REGISTRY: CommandRegistryEntry[] = [
  {
    id: "go-dashboard",
    title: "Go to Dashboard",
    subtitle: "Jump back to the main overview.",
    icon: "dashboard",
    keywords: ["home", "overview", "start"],
    resolve: () => ({ type: "navigate", route: "/dashboard" }),
  },
  {
    id: "create-customer",
    title: "Create Customer",
    subtitle: "Open the new customer form.",
    icon: "customers",
    keywords: ["add customer", "new customer", "crm"],
    resolve: () => ({ type: "navigate", route: "/crm/customers/new" }),
  },
  {
    id: "import-customers",
    title: "Import Customers",
    subtitle: "Start a customer import from the CRM list.",
    icon: "customers",
    keywords: ["upload csv", "contacts", "crm"],
    resolve: () => ({
      type: "navigate",
      route: "/crm/customers?import=1",
    }),
  },
  {
    id: "create-segment-from-customers",
    title: "Create Segment from Customers",
    subtitle: "Open the segment builder from the customer workflow.",
    icon: "segments",
    keywords: ["segment", "audience", "customers"],
    resolve: () => ({
      type: "navigate",
      route: "/crm/segments/new?source=customers",
    }),
  },
  {
    id: "create-campaign",
    title: "Create Campaign",
    subtitle: "Open the campaign builder.",
    icon: "campaigns",
    keywords: ["new campaign", "email campaign", "marketing"],
    resolve: () => ({ type: "navigate", route: "/crm/campaigns/new" }),
  },
  {
    id: "view-saved-blocks",
    title: "View Saved Blocks",
    subtitle: "Browse reusable campaign blocks.",
    icon: "saved-block",
    keywords: ["blocks", "templates", "campaigns"],
    resolve: () => ({ type: "navigate", route: "/crm/campaigns/blocks" }),
  },
  {
    id: "check-sending-domain",
    title: "Check Sending Domain",
    subtitle: "Review domain health and email readiness.",
    icon: "settings",
    keywords: ["domain", "dns", "email infrastructure"],
    resolve: () => ({ type: "navigate", route: "/domains" }),
  },
  {
    id: "preview-campaign",
    title: "Preview Campaign",
    subtitle: "Open the current campaign route in a new tab.",
    icon: "campaigns",
    keywords: ["campaign preview", "open current campaign"],
    isAvailable: isCampaignRoute,
    resolve: (pathname) => {
      const campaignRoute = getCurrentCampaignBaseRoute(pathname);

      if (!campaignRoute) {
        return null;
      }

      return { type: "open-new-tab", route: campaignRoute };
    },
  },
  {
    id: "view-campaign-recipients",
    title: "View Recipients",
    subtitle: "Open the current campaign recipients list.",
    icon: "customers",
    keywords: ["recipients", "audience", "campaign"],
    isAvailable: isCampaignRoute,
    resolve: (pathname) => {
      const campaignRoute = getCurrentCampaignBaseRoute(pathname);

      if (!campaignRoute) {
        return null;
      }

      return {
        type: "navigate",
        route: `${campaignRoute}/recipients`,
      };
    },
  },
  {
    id: "send-test-email",
    title: "Send Test Email",
    subtitle: "Trigger the current campaign's test send flow.",
    icon: "mail",
    keywords: ["test send", "preview email", "campaign"],
    isAvailable: isCampaignRoute,
    resolve: (pathname) => {
      const campaignRoute = getCurrentCampaignBaseRoute(pathname);

      if (!campaignRoute) {
        return null;
      }

      return {
        type: "send-test-email",
        campaignRoute,
      };
    },
  },
  {
    id: "create-form",
    title: "Create Form",
    subtitle: "Open the form creator.",
    icon: "forms",
    keywords: ["new form", "lead form", "embed"],
    resolve: () => ({ type: "navigate", route: "/crm/forms?create=1" }),
  },
  {
    id: "view-form-templates",
    title: "View Form Templates",
    subtitle: "Start from form starter templates.",
    icon: "forms",
    keywords: ["templates", "forms", "starter"],
    resolve: () => ({ type: "navigate", route: "/crm/forms?create=1" }),
  },
  {
    id: "create-automation",
    title: "Create Automation",
    subtitle: "Open the automation builder.",
    icon: "automations",
    keywords: ["workflow", "journey", "automation"],
    resolve: () => ({ type: "navigate", route: "/crm/automations/new" }),
  },
  {
    id: "view-automation-templates",
    title: "View Automation Templates",
    subtitle: "Browse automation starter templates.",
    icon: "automations",
    keywords: ["automation templates", "guide", "workflow"],
    resolve: () => ({
      type: "navigate",
      route: "/crm/automations/new/guide",
    }),
  },
  {
    id: "add-product",
    title: "Add Product",
    subtitle: "Open the product create flow.",
    icon: "products",
    keywords: ["new product", "catalog", "inventory"],
    resolve: () => ({ type: "navigate", route: "/products/new" }),
  },
  {
    id: "sync-pos",
    title: "Sync POS",
    subtitle: "Trigger a sync for the current product or integration context.",
    icon: "integrations",
    keywords: ["sync", "point of sale", "inventory", "square", "shopify"],
    isAvailable: (pathname) => isProductsRoute(pathname) || isIntegrationsRoute(pathname),
    resolve: (pathname) => ({
      type: "sync-pos",
      integrationRoute: pathname,
    }),
  },
  {
    id: "new-sms-campaign",
    title: "New SMS Campaign",
    subtitle: "Open the SMS campaign flow.",
    icon: "sms",
    keywords: ["sms", "text", "campaign"],
    resolve: () => ({ type: "navigate", route: "/sms/new" }),
  },
  {
    id: "new-sms-automation",
    title: "New SMS Automation",
    subtitle: "Open the SMS automation wizard.",
    icon: "sms",
    keywords: ["sms automation", "text workflow", "automation"],
    resolve: () => ({
      type: "navigate",
      route: "/sms/automations/new",
    }),
  },
  {
    id: "connect-integration",
    title: "Connect New Integration",
    subtitle: "Open the integrations catalog.",
    icon: "integrations",
    keywords: ["connect", "integration", "apps"],
    resolve: () => ({ type: "navigate", route: "/integrations" }),
  },
  {
    id: "check-connection-health",
    title: "Check Connection Health",
    subtitle: "Review connection status and recent sync state.",
    icon: "integrations",
    keywords: ["health", "connection", "sync status"],
    resolve: () => ({ type: "navigate", route: "/integrations" }),
  },
  {
    id: "open-settings-connections",
    title: "Open Connections",
    subtitle: "Jump to the settings connections section.",
    icon: "settings",
    keywords: ["settings", "connections", "integrations"],
    resolve: () => ({
      type: "navigate",
      route: "/settings?section=connections",
    }),
  },
  {
    id: "open-settings-compliance",
    title: "Open Compliance",
    subtitle: "Jump to compliance-related settings.",
    icon: "settings",
    keywords: ["settings", "compliance", "policy"],
    resolve: () => ({
      type: "navigate",
      route: "/settings?section=compliance",
    }),
  },
  {
    id: "open-billing",
    title: "Open Billing",
    subtitle: "Review billing and account usage.",
    icon: "billing",
    keywords: ["billing", "usage", "subscription"],
    resolve: () => ({ type: "navigate", route: "/account" }),
  },
  {
    id: "open-settings",
    title: "Open Settings",
    subtitle: "Go to global settings.",
    icon: "settings",
    keywords: ["preferences", "configuration", "settings"],
    resolve: () => ({ type: "navigate", route: "/settings" }),
  },
  {
    id: "open-account",
    title: "Open Account",
    subtitle: "Go to the account page.",
    icon: "settings",
    keywords: ["account", "profile", "billing"],
    resolve: () => ({ type: "navigate", route: "/account" }),
  },
  {
    id: "clear-search-history",
    title: "Clear Search History",
    subtitle: "Clear recent searches from the command palette.",
    icon: "search",
    keywords: ["delete history", "forget recent", "recent searches"],
    resolve: () => ({ type: "clear-search-history" }),
  },
  {
    id: "toggle-theme",
    title: "Toggle Theme",
    subtitle: "Switch between the app color schemes.",
    icon: "settings",
    keywords: ["dark mode", "light mode", "appearance"],
    resolve: () => ({ type: "toggle-theme" }),
  },
  {
    id: "show-shortcuts",
    title: "Keyboard Shortcuts",
    subtitle: "Open the palette shortcuts reference.",
    icon: "help",
    keywords: ["shortcuts", "keyboard", "help"],
    resolve: () => ({ type: "show-shortcuts" }),
  },
  {
    id: "create-ticket",
    title: "Create Ticket",
    subtitle: "Open the helpdesk ticket composer.",
    icon: "support",
    keywords: ["helpdesk", "support", "new ticket"],
    resolve: () => ({ type: "navigate", route: "/helpdesk/tickets/new" }),
  },
];

const ROUTE_AWARE_COMMANDS: Array<{
  pattern: RegExp;
  commandIds: PaletteCommandId[];
}> = [
  {
    pattern: /^\/crm\/campaigns\/[^/?#]+(?:\/(?:analytics|report|recipients)(?:\/[^/?#]+)?)?$/,
    commandIds: [
      "preview-campaign",
      "view-campaign-recipients",
      "send-test-email",
    ],
  },
  {
    pattern: /^\/crm\/customers(?:\/|$)/,
    commandIds: [
      "create-customer",
      "import-customers",
      "create-segment-from-customers",
    ],
  },
  {
    pattern: /^\/crm\/campaigns(?:\/|$)/,
    commandIds: [
      "create-campaign",
      "view-saved-blocks",
      "check-sending-domain",
    ],
  },
  {
    pattern: /^\/crm\/forms(?:\/|$)/,
    commandIds: ["create-form", "view-form-templates"],
  },
  {
    pattern: /^\/crm\/automations(?:\/|$)/,
    commandIds: ["create-automation", "view-automation-templates"],
  },
  {
    pattern: /^\/products(?:\/|$)/,
    commandIds: ["add-product", "sync-pos"],
  },
  {
    pattern: /^\/sms(?:\/|$)/,
    commandIds: ["new-sms-campaign", "new-sms-automation"],
  },
  {
    pattern: /^\/integrations(?:\/|$)/,
    commandIds: ["connect-integration", "check-connection-health"],
  },
  {
    pattern: /^\/settings(?:\/|$)/,
    commandIds: [
      "open-settings-connections",
      "open-settings-compliance",
      "open-billing",
    ],
  },
];

function resolveCommandEntry(
  entry: CommandRegistryEntry,
  pathname?: string,
): {
  action: PaletteExecutableAction;
  item: SearchResultItem;
} | null {
  const activePathname = getActivePathname(pathname);

  if (entry.isAvailable && !entry.isAvailable(activePathname)) {
    return null;
  }

  const execution = entry.resolve(activePathname);

  if (!execution) {
    return null;
  }

  const route =
    execution.type === "navigate" || execution.type === "open-new-tab"
      ? execution.route
      : activePathname;

  return {
    action: {
      id: `command:${entry.id}`,
      label: entry.title,
      icon: getActionIconForCommand(entry.id),
      keepPaletteOpen: execution.type !== "navigate",
      execution,
    },
    item: {
      id: `command:${entry.id}`,
      type: "action",
      title: entry.title,
      subtitle: entry.subtitle,
      route,
      icon: entry.icon,
      categoryIcon: "actions",
      metadata: COMMAND_METADATA,
      keywords: entry.keywords,
      group: "actions",
    },
  };
}

function normalizeCommandSearchText(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function scoreCommandSearchItem(item: SearchResultItem, query: string): number {
  const normalizedQuery = normalizeCommandSearchText(query);

  if (!normalizedQuery) {
    return 1;
  }

  const staticScore = scoreStaticSearchItem(item, normalizedQuery);
  const haystacks = [
    item.title,
    item.subtitle,
    item.metadata,
    item.route,
    ...(item.keywords ?? []),
  ]
    .map((value) => normalizeCommandSearchText(value))
    .filter(Boolean);
  const title = normalizeCommandSearchText(item.title);
  const tokens = normalizedQuery.split(" ").filter(Boolean);
  const matchedTokenCount = tokens.filter((token) =>
    haystacks.some((value) => value.includes(token)),
  ).length;

  let score = staticScore;

  if (title === normalizedQuery) {
    score = Math.max(score, 240);
  } else if (title.startsWith(normalizedQuery)) {
    score = Math.max(score, 220);
  } else if (title.includes(normalizedQuery)) {
    score = Math.max(score, 200);
  }

  if (matchedTokenCount === tokens.length && tokens.length > 0) {
    score = Math.max(score, 160 + matchedTokenCount);
  }

  return score;
}

export function isCommandModeQuery(query: string): boolean {
  return /^\s*>/.test(query);
}

export function getCommandModeSearchTerm(query: string): string {
  return query.replace(/^\s*>\s*/, "").trim();
}

export function getCommandIdFromSearchItem(
  item: Pick<SearchResultItem, "id">,
): PaletteCommandId | null {
  if (!item.id.startsWith("command:")) {
    return null;
  }

  return item.id.slice("command:".length) as PaletteCommandId;
}

export function getResolvedCommandAction(
  commandId: PaletteCommandId,
  pathname?: string,
): PaletteExecutableAction | null {
  const entry = COMMAND_REGISTRY.find((candidate) => candidate.id === commandId);

  if (!entry) {
    return null;
  }

  return resolveCommandEntry(entry, pathname)?.action ?? null;
}

export function getCommandSearchItems(
  query: string,
  pathname?: string,
): SearchResultItem[] {
  const activePathname = getActivePathname(pathname);
  const searchTerm = getCommandModeSearchTerm(query);
  const resolvedItems = COMMAND_REGISTRY.map((entry, index) => {
    const resolved = resolveCommandEntry(entry, activePathname);

    if (!resolved) {
      return null;
    }

    return {
      index,
      item: resolved.item,
      score: searchTerm ? scoreCommandSearchItem(resolved.item, searchTerm) : 1,
    };
  }).filter(
    (
      value,
    ): value is { index: number; item: SearchResultItem; score: number } =>
      value !== null,
  );

  if (!searchTerm) {
    return resolvedItems.map((entry) => entry.item);
  }

  return resolvedItems
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.item);
}

export function getRouteAwareSuggestionItems(pathname?: string): SearchResultItem[] {
  const activePathname = getActivePathname(pathname);
  const match = ROUTE_AWARE_COMMANDS.find((candidate) =>
    candidate.pattern.test(activePathname),
  );

  if (!match) {
    return [];
  }

  return match.commandIds
    .map((commandId) => getResolvedCommandAction(commandId, activePathname))
    .filter((action): action is PaletteExecutableAction => action !== null)
    .map((action) => {
      const commandId = action.id.slice("command:".length) as PaletteCommandId;
      return getResolvedCommandSearchItem(commandId, activePathname);
    })
    .filter((item): item is SearchResultItem => item !== null);
}

function getResolvedCommandSearchItem(
  commandId: PaletteCommandId,
  pathname?: string,
): SearchResultItem | null {
  const entry = COMMAND_REGISTRY.find((candidate) => candidate.id === commandId);

  if (!entry) {
    return null;
  }

  return resolveCommandEntry(entry, pathname)?.item ?? null;
}

function getRegexMatch(
  value: string | undefined,
  matcher: RegExp,
): string | null {
  if (!value) {
    return null;
  }

  const match = value.match(matcher);
  return match?.[1] ?? null;
}

function getEmailFromItem(item: SearchResultItem): string | null {
  const fields = [item.subtitle, item.metadata, item.title, ...(item.keywords ?? [])];

  for (const field of fields) {
    const value = getRegexMatch(field, /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);

    if (value) {
      return value;
    }
  }

  return null;
}

function getSkuFromItem(item: SearchResultItem): string | null {
  const fields = [item.subtitle, ...(item.keywords ?? [])];

  for (const field of fields) {
    if (!field) {
      continue;
    }

    const parts = field.split(" • ").map((part) => part.trim()).filter(Boolean);
    const candidate = parts.find((part) => /^[A-Z0-9][A-Z0-9_-]{2,}$/i.test(part));

    if (candidate) {
      return candidate;
    }
  }

  return null;
}

function getEmbedKeyFromItem(item: SearchResultItem): string | null {
  return getRegexMatch(
    item.subtitle || item.keywords?.join(" "),
    /embed key\s+([A-Z0-9_-]+)/i,
  );
}

function getTicketNumberFromItem(item: SearchResultItem): string | null {
  const fields = [item.subtitle, ...(item.keywords ?? [])];

  for (const field of fields) {
    const value = getRegexMatch(field, /([A-Z]{2,}-\d+|\d{4,})/i);

    if (value) {
      return value;
    }
  }

  return null;
}

function getHighlightQueryValue(route: string): string | null {
  const query = route.split("?")[1];

  if (!query) {
    return null;
  }

  const params = new URLSearchParams(query);
  return params.get("highlight");
}

function buildAction(
  id: string,
  label: string,
  icon: LucideIcon,
  execution: PaletteActionExecution,
  options?: Pick<PaletteExecutableAction, "keepPaletteOpen" | "successLabel">,
): PaletteExecutableAction {
  return {
    id,
    label,
    icon,
    keepPaletteOpen: options?.keepPaletteOpen,
    successLabel: options?.successLabel,
    execution,
  };
}

function getCampaignBaseRoute(route: string): string {
  return route.replace(/\/(?:analytics|report|recipients)(?:\/[^/?#]+)?$/, "");
}

function getProductActions(item: SearchResultItem): PaletteExecutableAction[] {
  const actions = [
    buildAction(
      `${item.id}:edit-product`,
      "Edit Product",
      PackagePlus,
      { type: "navigate", route: item.route },
    ),
    buildAction(
      `${item.id}:view-storefront`,
      "View on Storefront",
      ExternalLink,
      { type: "open-new-tab", route: item.route },
      { keepPaletteOpen: true },
    ),
  ];
  const sku = getSkuFromItem(item);

  if (sku) {
    actions.push(
      buildAction(
        `${item.id}:copy-sku`,
        "Copy SKU",
        Clipboard,
        { type: "copy", value: sku },
        { keepPaletteOpen: true, successLabel: "Copied!" },
      ),
    );
  }

  return actions;
}

function getFormActions(item: SearchResultItem): PaletteExecutableAction[] {
  const actions = [
    buildAction(`${item.id}:open-editor`, "Open Editor", ArrowUpRight, {
      type: "navigate",
      route: item.route,
    }),
    buildAction(
      `${item.id}:view-submissions`,
      "View Submissions",
      Mail,
      {
        type: "navigate",
        route: withSearch(item.route, "tab=submissions"),
      },
    ),
  ];
  const embedKey = getEmbedKeyFromItem(item);

  if (embedKey) {
    actions.splice(
      1,
      0,
      buildAction(
        `${item.id}:preview-form`,
        "Preview Form",
        ExternalLink,
        {
          type: "open-new-tab",
          route: getPublicFormUrl(embedKey, ""),
        },
        { keepPaletteOpen: true },
      ),
    );
    actions.push(
      buildAction(
        `${item.id}:copy-embed-code`,
        "Copy Embed Code",
        Copy,
        {
          type: "copy",
          value: buildJavaScriptEmbedCode({
            embedKey,
            origin: "",
            formName: item.title,
          }),
        },
        { keepPaletteOpen: true, successLabel: "Copied!" },
      ),
    );
  }

  return actions;
}

function getCustomerActions(item: SearchResultItem): PaletteExecutableAction[] {
  const customerId = getRegexMatch(item.route, /^\/crm\/customers\/([^/?#]+)/);
  const customerSearch = customerId ? `customerId=${customerId}` : "";
  const actions = [
    buildAction(`${item.id}:view-dashboard`, "View Dashboard", Users, {
      type: "navigate",
      route: item.route,
    }),
    buildAction(
      `${item.id}:create-campaign`,
      "Create Campaign for Customer",
      Megaphone,
      {
        type: "navigate",
        route: withSearch("/crm/campaigns/new", customerSearch),
      },
    ),
    buildAction(`${item.id}:send-sms`, "Send SMS", MessageSquare, {
      type: "navigate",
      route: withSearch("/sms/new", customerSearch),
    }),
  ];
  const email = getEmailFromItem(item);

  if (email) {
    actions.push(
      buildAction(
        `${item.id}:copy-email`,
        "Copy Email",
        Clipboard,
        { type: "copy", value: email },
        { keepPaletteOpen: true, successLabel: "Copied!" },
      ),
    );
  }

  return actions;
}

function getCampaignActions(item: SearchResultItem): PaletteExecutableAction[] {
  const baseRoute = getCampaignBaseRoute(item.route);
  const campaignId = getRegexMatch(baseRoute, /^\/crm\/campaigns\/([^/?#]+)/);
  const actions = [
    buildAction(`${item.id}:open-builder`, "Open Builder", ArrowUpRight, {
      type: "navigate",
      route: baseRoute,
    }),
    buildAction(`${item.id}:view-report`, "View Report", Sparkles, {
      type: "navigate",
      route: `${baseRoute}/report`,
    }),
    buildAction(
      `${item.id}:view-recipients`,
      "View Recipients",
      Users,
      {
        type: "navigate",
        route: `${baseRoute}/recipients`,
      },
    ),
  ];

  if (campaignId) {
    actions.push(
      buildAction(
        `${item.id}:duplicate-campaign`,
        "Duplicate Campaign",
        Copy,
        { type: "duplicate-campaign", campaignId },
        { keepPaletteOpen: true },
      ),
    );
  }

  return actions;
}

function getSegmentActions(item: SearchResultItem): PaletteExecutableAction[] {
  const segmentId = getRegexMatch(item.route, /^\/crm\/segments\/([^/?#]+)/);
  const segmentSearch = segmentId ? `segmentId=${segmentId}` : "";

  return [
    buildAction(`${item.id}:view-members`, "View Customers", Users, {
      type: "navigate",
      route: `${item.route}/members`,
    }),
    buildAction(
      `${item.id}:segment-campaign`,
      "Create Campaign",
      Megaphone,
      {
        type: "navigate",
        route: withSearch("/crm/campaigns/new", segmentSearch),
      },
    ),
    buildAction(`${item.id}:segment-sms`, "Send SMS", MessageSquare, {
      type: "navigate",
      route: withSearch("/sms/new", segmentSearch),
    }),
  ];
}

function getAutomationActions(item: SearchResultItem): PaletteExecutableAction[] {
  const automationId = getRegexMatch(item.route, /^\/crm\/automations\/([^/?#]+)/);
  const isActive = item.metadata?.toLowerCase() === "active";
  const actions = [
    buildAction(`${item.id}:edit-workflow`, "Edit Workflow", Workflow, {
      type: "navigate",
      route: item.route,
    }),
  ];

  if (automationId) {
    actions.push(
      buildAction(
        `${item.id}:toggle-automation`,
        isActive ? "Deactivate" : "Activate",
        RefreshCcw,
        {
          type: "toggle-automation",
          automationId,
          nextIsActive: !isActive,
        },
        { keepPaletteOpen: true },
      ),
    );
  }

  return actions;
}

function getSavedBlockActions(item: SearchResultItem): PaletteExecutableAction[] {
  const highlightId = getHighlightQueryValue(item.route);
  const duplicateRoute = highlightId
    ? withSearch(item.route, `duplicate=${highlightId}`)
    : item.route;

  return [
    buildAction(`${item.id}:open-block`, "Open Block", ArrowUpRight, {
      type: "navigate",
      route: item.route,
    }),
    buildAction(`${item.id}:duplicate-block`, "Duplicate", Copy, {
      type: "navigate",
      route: duplicateRoute,
    }),
    buildAction(
      `${item.id}:copy-block-name`,
      "Copy to Clipboard",
      Clipboard,
      { type: "copy", value: item.title },
      { keepPaletteOpen: true, successLabel: "Copied!" },
    ),
  ];
}

function getSmsCampaignActions(item: SearchResultItem): PaletteExecutableAction[] {
  return [
    buildAction(`${item.id}:view-details`, "View Details", ArrowUpRight, {
      type: "navigate",
      route: item.route,
    }),
    buildAction(`${item.id}:open-new-tab`, "Open in New Tab", ExternalLink, {
      type: "open-new-tab",
      route: item.route,
    }, { keepPaletteOpen: true }),
  ];
}

function getTicketActions(item: SearchResultItem): PaletteExecutableAction[] {
  const actions = [
    buildAction(`${item.id}:open-ticket`, "Open Ticket", LifeBuoy, {
      type: "navigate",
      route: item.route,
    }),
  ];
  const ticketNumber = getTicketNumberFromItem(item);

  if (ticketNumber) {
    actions.push(
      buildAction(
        `${item.id}:copy-ticket-number`,
        "Copy Ticket Number",
        Clipboard,
        { type: "copy", value: ticketNumber },
        { keepPaletteOpen: true, successLabel: "Copied!" },
      ),
    );
  }

  return actions;
}

function getIntegrationActions(item: SearchResultItem): PaletteExecutableAction[] {
  return [
    buildAction(`${item.id}:open-integration`, "Open Integration", ArrowUpRight, {
      type: "navigate",
      route: item.route,
    }),
    buildAction(`${item.id}:sync-now`, "Sync Now", RefreshCcw, {
      type: "sync-pos",
      integrationRoute: item.route,
    }, { keepPaletteOpen: true }),
    buildAction(`${item.id}:view-logs`, "View Logs", ShieldCheck, {
      type: "navigate",
      route: withSearch(item.route, "tab=sync-logs"),
    }),
  ];
}

function getPageActions(item: SearchResultItem): PaletteExecutableAction[] {
  return [
    buildAction(`${item.id}:open-page`, item.type === "setting" ? "Open Setting" : "Open Page", ArrowUpRight, {
      type: "navigate",
      route: item.route,
    }),
    buildAction(`${item.id}:open-page-tab`, "Open in New Tab", ExternalLink, {
      type: "open-new-tab",
      route: item.route,
    }, { keepPaletteOpen: true }),
  ];
}

function getActionIconForCommand(commandId: PaletteCommandId): LucideIcon {
  switch (commandId) {
    case "create-customer":
      return Plus;
    case "import-customers":
      return Import;
    case "create-segment-from-customers":
      return Users;
    case "create-campaign":
    case "preview-campaign":
    case "view-campaign-recipients":
    case "send-test-email":
      return Megaphone;
    case "create-form":
    case "view-form-templates":
      return Clipboard;
    case "create-automation":
    case "view-automation-templates":
      return Workflow;
    case "add-product":
      return PackagePlus;
    case "sync-pos":
      return RefreshCcw;
    case "new-sms-campaign":
    case "new-sms-automation":
      return MessageSquare;
    case "connect-integration":
    case "check-connection-health":
    case "open-settings-connections":
      return Settings;
    case "open-settings-compliance":
      return ShieldCheck;
    case "open-billing":
      return Sparkles;
    case "open-settings":
    case "open-account":
      return Settings;
    case "clear-search-history":
      return Clipboard;
    case "toggle-theme":
      return MoonStar;
    case "show-shortcuts":
      return SunMedium;
    case "create-ticket":
      return TicketPlus;
    case "go-dashboard":
      return ArrowUpRight;
    case "view-saved-blocks":
      return Sparkles;
    case "check-sending-domain":
      return ShieldCheck;
    default:
      return ArrowUpRight;
  }
}

export function getResultActionItems(item: SearchResultItem): PaletteExecutableAction[] {
  switch (item.type) {
    case "customer":
      return getCustomerActions(item);
    case "campaign":
      return getCampaignActions(item);
    case "product":
      return getProductActions(item);
    case "segment":
      return getSegmentActions(item);
    case "automation":
      return getAutomationActions(item);
    case "form":
      return getFormActions(item);
    case "saved_block":
      return getSavedBlockActions(item);
    case "sms_campaign":
    case "sms_automation":
      return getSmsCampaignActions(item);
    case "ticket":
      return getTicketActions(item);
    case "integration":
      return getIntegrationActions(item);
    case "page":
    case "setting":
      return getPageActions(item);
    case "action": {
      const commandId = getCommandIdFromSearchItem(item);
      const action = commandId ? getResolvedCommandAction(commandId, item.route) : null;
      return action ? [action] : getPageActions(item);
    }
    default:
      return getPageActions(item);
  }
}