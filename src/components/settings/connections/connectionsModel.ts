import type { LightspeedConnectionSummary } from "@/hooks/useLightspeedConnectionSummary";
import type { POSConnection, POSSyncLog } from "@/hooks/usePOSConnections";
import { SUPPORT_EMAIL } from "@/lib/bloomSupport/constants";

/**
 * Shopify (legacy pos_connections flow) is retired. Existing rows still render
 * as connected cards, but it is no longer offered in the catalog.
 */
export const LEGACY_SHOPIFY_DEPRECATED = true;

/**
 * The setup wizard no longer offers Square: it stored pasted access tokens
 * unencrypted. Square returns to the catalog once Square sign-in is reachable.
 */
const RETIRED_WIZARD_PLATFORMS = new Set(["square", ...(LEGACY_SHOPIFY_DEPRECATED ? ["shopify"] : [])]);

export type IntegrationLogoKey =
  | "square"
  | "shopify"
  | "lightspeed"
  | "clover"
  | "vmx"
  | "mailchimp"
  | "zapier"
  | "generic";

export type IntegrationCategory = "Point of sale" | "Data import" | "Email" | "Automation";

interface CatalogEntryBase {
  id: string;
  name: string;
  /** Name used in sentences, e.g. "VMX" rather than "VMX / CSV upload". */
  shortName: string;
  category: IntegrationCategory;
  valueProp: string;
  logo: IntegrationLogoKey;
  /** What BloomSuite pulls in once connected. */
  dataScopes: string[];
}

/** Connects through the in-page POSSetupWizard and lands in pos_connections. */
export interface WizardCatalogEntry extends CatalogEntryBase {
  kind: "wizard";
  /** What the merchant pastes in to connect, used in reconnect guidance. */
  credentialLabel: string;
}

/** Connects through its own flow in the Integration Hub. */
export interface HubCatalogEntry extends CatalogEntryBase {
  kind: "hub";
  connectPath: string;
  guidePath: string;
}

export interface ComingSoonCatalogEntry extends CatalogEntryBase {
  kind: "coming-soon";
}

export type CatalogEntry = WizardCatalogEntry | HubCatalogEntry | ComingSoonCatalogEntry;

const WIZARD_PLATFORMS: WizardCatalogEntry[] = [
  {
    kind: "wizard",
    id: "shopify",
    shortName: "Shopify",
    credentialLabel: "access token",
    name: "Shopify",
    category: "Point of sale",
    valueProp: "Sync customers and orders from your Shopify store.",
    logo: "shopify",
    dataScopes: ["Customers", "Orders"],
  },
  {
    kind: "wizard",
    id: "square",
    shortName: "Square",
    credentialLabel: "access token",
    name: "Square",
    category: "Point of sale",
    valueProp: "Keep customers, catalog and sales in sync with your Square POS.",
    logo: "square",
    dataScopes: ["Customers", "Catalog", "Sales"],
  },
  {
    kind: "wizard",
    id: "vmx",
    shortName: "VMX",
    credentialLabel: "API key",
    name: "VMX / CSV upload",
    category: "Data import",
    valueProp: "Bring in customers and purchases from a VMX export or any CSV.",
    logo: "vmx",
    dataScopes: ["Customers", "Purchases"],
  },
];

export const wizardPlatforms = WIZARD_PLATFORMS.filter(
  (platform) => !RETIRED_WIZARD_PLATFORMS.has(platform.id),
);

export const LIGHTSPEED_MANAGE_PATH = "/integrations/lightspeed";

export const hubIntegrations: HubCatalogEntry[] = [
  {
    kind: "hub",
    id: "lightspeed",
    name: "Lightspeed X-Series",
    shortName: "Lightspeed",
    category: "Point of sale",
    valueProp: "Sign in with Lightspeed to sync customers, products and sales.",
    logo: "lightspeed",
    dataScopes: ["Customers", "Products", "Sales"],
    connectPath: "/integrations/lightspeed/connect",
    guidePath: "/integrations/lightspeed/guide",
  },
  {
    kind: "hub",
    id: "mailchimp",
    shortName: "Mailchimp",
    name: "Mailchimp",
    category: "Email",
    valueProp: "Import contacts, lists, segments and consent history.",
    logo: "mailchimp",
    dataScopes: ["Contacts", "Lists", "Segments"],
    connectPath: "/integrations/mailchimp",
    guidePath: "/docs/integrations/mailchimp",
  },
];

export const comingSoonIntegrations: ComingSoonCatalogEntry[] = [
  {
    kind: "coming-soon",
    id: "clover",
    name: "Clover",
    shortName: "Clover",
    category: "Point of sale",
    valueProp: "Sync customers and orders from your Clover POS.",
    logo: "clover",
    dataScopes: ["Customers", "Orders"],
  },
  {
    kind: "coming-soon",
    id: "square",
    name: "Square",
    shortName: "Square",
    category: "Point of sale",
    valueProp: "Sign in with Square to sync customers, catalog and sales automatically.",
    logo: "square",
    dataScopes: ["Customers", "Catalog", "Sales"],
  },
  {
    kind: "coming-soon",
    id: "zapier",
    shortName: "Zapier",
    name: "Zapier",
    category: "Automation",
    valueProp: "Connect BloomSuite to thousands of apps with no-code workflows.",
    logo: "zapier",
    dataScopes: ["Triggers", "Actions"],
  },
];

export const buildIntegrationRequestHref = (integrationName?: string) => {
  const subject = integrationName
    ? `Integration request: ${integrationName}`
    : "Integration request";
  const body = integrationName
    ? `Hi BloomSuite team,\n\nPlease let me know when the ${integrationName} integration is available.\n`
    : "Hi BloomSuite team,\n\nI'd like BloomSuite to connect with: \n";
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

const formatPlatformLabel = (value: string) =>
  value
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const getPlatformEntry = (platformId: string): WizardCatalogEntry =>
  WIZARD_PLATFORMS.find((platform) => platform.id === platformId) ?? {
    kind: "wizard",
    id: platformId,
    name: formatPlatformLabel(platformId),
    shortName: formatPlatformLabel(platformId),
    credentialLabel: "credentials",
    category: "Point of sale",
    valueProp: "Connected platform",
    logo: "generic",
    dataScopes: [],
  };

/* ------------------------------------------------------------------ */
/* Sync status                                                         */
/* ------------------------------------------------------------------ */

// Status strings written by the *-sync edge functions and the sync worker.
const SUCCESS_STATUSES = new Set(["completed", "success", "succeeded", "active", "done"]);
const FAILURE_STATUSES = new Set(["failed", "error", "errored"]);
const RUNNING_STATUSES = new Set(["running", "syncing", "in_progress", "processing", "queued"]);

const normalize = (value?: string | null) => (value ?? "").trim().toLowerCase();

export const isSuccessStatus = (value?: string | null) => SUCCESS_STATUSES.has(normalize(value));
export const isFailureStatus = (value?: string | null) => FAILURE_STATUSES.has(normalize(value));
export const isRunningStatus = (value?: string | null) => RUNNING_STATUSES.has(normalize(value));

export type SyncLogOutcome = "success" | "failed" | "running" | "unknown";

export const getLogOutcome = (log: POSSyncLog): SyncLogOutcome => {
  if (isFailureStatus(log.status)) return "failed";
  if (isRunningStatus(log.status)) return "running";
  if (isSuccessStatus(log.status)) return "success";
  return "unknown";
};

const logTime = (log: POSSyncLog) => new Date(log.completed_at ?? log.started_at).getTime();

/** Logs newest first. */
export const getSortedLogs = (connection: POSConnection): POSSyncLog[] =>
  [...(connection.pos_sync_logs ?? [])].sort(
    (left, right) => new Date(right.started_at).getTime() - new Date(left.started_at).getTime(),
  );

export type ConnectionHealth = "healthy" | "syncing" | "attention" | "pending" | "inactive";

export interface ConnectionInsight {
  connection: POSConnection;
  platform: WizardCatalogEntry;
  health: ConnectionHealth;
  logs: POSSyncLog[];
  latestLog: POSSyncLog | null;
  lastSuccessfulLog: POSSyncLog | null;
  /** Most recent moment data is known to have landed successfully. */
  lastSuccessAt: string | null;
  errorMessage: string | null;
}

export const getConnectionInsight = (
  connection: POSConnection,
  syncingConnectionId: string | null,
): ConnectionInsight => {
  const logs = getSortedLogs(connection);
  const latestLog = logs[0] ?? null;
  const latestFinishedLog = logs.find((log) => getLogOutcome(log) !== "running") ?? null;
  const lastSuccessfulLog = logs.find((log) => getLogOutcome(log) === "success") ?? null;

  const successCandidates = [lastSuccessfulLog?.completed_at ?? lastSuccessfulLog?.started_at, connection.last_sync_at]
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime());
  const lastSuccessAt = successCandidates[0] ?? null;

  const latestFinishedFailed = latestFinishedLog ? getLogOutcome(latestFinishedLog) === "failed" : false;
  const connectionReportsFailure =
    isFailureStatus(connection.sync_status) &&
    !(latestFinishedLog && getLogOutcome(latestFinishedLog) === "success");

  const isRunning =
    syncingConnectionId === connection.id ||
    (latestLog !== null && getLogOutcome(latestLog) === "running") ||
    isRunningStatus(connection.sync_status);

  let health: ConnectionHealth;
  if (!connection.is_active) {
    health = "inactive";
  } else if (isRunning) {
    health = "syncing";
  } else if (latestFinishedFailed || connectionReportsFailure) {
    health = "attention";
  } else if (!lastSuccessAt) {
    health = "pending";
  } else {
    health = "healthy";
  }

  const failedLog = logs.find((log) => getLogOutcome(log) === "failed");
  const errorMessage =
    health === "attention"
      ? (connection.sync_error?.trim() || failedLog?.error_message?.trim() || null)
      : null;

  return {
    connection,
    platform: getPlatformEntry(connection.platform),
    health,
    logs,
    latestLog,
    lastSuccessfulLog,
    lastSuccessAt,
    errorMessage,
  };
};

export const HEALTH_PRESENTATION: Record<
  ConnectionHealth,
  { label: string; color: "success" | "primary" | "danger" | "neutral" | "warning" }
> = {
  healthy: { label: "Healthy", color: "success" },
  syncing: { label: "Syncing", color: "primary" },
  attention: { label: "Needs attention", color: "danger" },
  pending: { label: "Waiting for first sync", color: "neutral" },
  inactive: { label: "Disconnected", color: "warning" },
};

/* ------------------------------------------------------------------ */
/* Plain-language failure guidance                                     */
/* ------------------------------------------------------------------ */

export interface FailureGuidance {
  summary: string;
  nextStep: string;
  reconnectRecommended: boolean;
}

export const getFailureGuidance = (
  platform: Pick<WizardCatalogEntry, "shortName" | "credentialLabel">,
  rawMessage: string | null,
): FailureGuidance => {
  const message = rawMessage ?? "";
  const platformName = platform.shortName;

  if (/\b(401|403)\b|unauthori[sz]ed|forbidden|invalid[^.]*token|token[^.]*(expired|invalid|revoked)|access denied|credential/i.test(message)) {
    return {
      summary: `${platformName} stopped accepting BloomSuite's access.`,
      nextStep: `Disconnect and reconnect ${platformName} with a fresh ${platform.credentialLabel}, then run a sync.`,
      reconnectRecommended: true,
    };
  }

  if (/\b429\b|rate.?limit|too many requests/i.test(message)) {
    return {
      summary: `${platformName} asked BloomSuite to slow down.`,
      nextStep: "Nothing is lost. Wait a few minutes, then try the sync again.",
      reconnectRecommended: false,
    };
  }

  if (/time(d)?.?out|network|fetch failed|ECONN|ENOTFOUND|\b50[0-4]\b|unavailable|gateway/i.test(message)) {
    return {
      summary: `${platformName} didn't respond in time.`,
      nextStep: "This is usually temporary. Try the sync again in a few minutes.",
      reconnectRecommended: false,
    };
  }

  if (/\b404\b|not found|no such/i.test(message)) {
    return {
      summary: `BloomSuite couldn't find the connected ${platformName} account.`,
      nextStep: `Check the account is still active in ${platformName}, then reconnect.`,
      reconnectRecommended: true,
    };
  }

  return {
    summary: "The last sync didn't finish.",
    nextStep: "Try again. If it keeps failing, follow the setup guide or contact support.",
    reconnectRecommended: false,
  };
};

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Hub-managed connections (own tables, managed in the Integration Hub) */
/* ------------------------------------------------------------------ */

export interface HubConnectionInsight {
  id: string;
  name: string;
  platformName: string;
  category: IntegrationCategory;
  logo: IntegrationLogoKey;
  dataScopes: string[];
  health: ConnectionHealth;
  lastSuccessAt: string | null;
  /** Running totals synced so far, e.g. "1,204 customers · 380 products". */
  totalsSummary: string | null;
  attentionSummary: string | null;
  managePath: string;
  reconnectPath: string;
  guidePath: string;
}

const latestTimestamp = (values: Array<string | null | undefined>) =>
  values
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;

const pluralize = (count: number, singular: string, plural: string) =>
  `${formatCount(count)} ${count === 1 ? singular : plural}`;

export const getLightspeedInsight = (connection: LightspeedConnectionSummary): HubConnectionInsight => {
  const lastSuccessAt = latestTimestamp([
    connection.last_synced_at,
    connection.last_customer_sync,
    connection.last_product_sync,
    connection.last_sales_sync,
  ]);
  const isConnected = (connection.status ?? "").toLowerCase() === "connected";

  const totals = [
    connection.customers_synced !== null ? pluralize(connection.customers_synced, "customer", "customers") : null,
    connection.products_synced !== null ? pluralize(connection.products_synced, "product", "products") : null,
    connection.sales_synced !== null ? pluralize(connection.sales_synced, "sale", "sales") : null,
  ].filter(Boolean);

  return {
    id: connection.id,
    name: connection.retailer_name || connection.domain_prefix || "Lightspeed X-Series",
    platformName: "Lightspeed X-Series",
    category: "Point of sale",
    logo: "lightspeed",
    dataScopes: ["Customers", "Products", "Sales"],
    health: !isConnected ? "attention" : lastSuccessAt ? "healthy" : "pending",
    lastSuccessAt,
    totalsSummary: totals.length > 0 ? `${totals.join(" · ")} synced` : null,
    attentionSummary: isConnected
      ? null
      : "Lightspeed is no longer connected. Reconnect it in the Integration Hub to resume syncing.",
    managePath: LIGHTSPEED_MANAGE_PATH,
    reconnectPath: "/integrations/lightspeed/connect",
    guidePath: "/integrations/lightspeed/guide",
  };
};

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

export interface OverviewIssue {
  id: string;
  name: string;
}

export interface ConnectionsOverview {
  total: number;
  needsAttention: OverviewIssue[];
  syncingCount: number;
  lastSuccessAt: string | null;
  lastImport: { customers: number; orders: number; at: string } | null;
}

export const getConnectionsOverview = (
  insights: ConnectionInsight[],
  hubInsights: HubConnectionInsight[] = [],
): ConnectionsOverview => {
  const lastSuccessAt = latestTimestamp([
    ...insights.map((insight) => insight.lastSuccessAt),
    ...hubInsights.map((insight) => insight.lastSuccessAt),
  ]);

  const latestSuccessfulLog = insights
    .map((insight) => insight.lastSuccessfulLog)
    .filter((log): log is POSSyncLog => log !== null)
    .sort((left, right) => logTime(right) - logTime(left))[0];

  const hasCounts =
    latestSuccessfulLog &&
    (latestSuccessfulLog.customers_synced !== null || latestSuccessfulLog.orders_synced !== null);

  return {
    total: insights.length + hubInsights.length,
    needsAttention: [
      ...insights
        .filter((insight) => insight.health === "attention")
        .map((insight) => ({ id: insight.connection.id, name: insight.connection.name || insight.platform.name })),
      ...hubInsights
        .filter((insight) => insight.health === "attention")
        .map((insight) => ({ id: insight.id, name: insight.name })),
    ],
    syncingCount: insights.filter((insight) => insight.health === "syncing").length,
    lastSuccessAt,
    lastImport: hasCounts
      ? {
          customers: latestSuccessfulLog.customers_synced ?? 0,
          orders: latestSuccessfulLog.orders_synced ?? 0,
          at: latestSuccessfulLog.completed_at ?? latestSuccessfulLog.started_at,
        }
      : null,
  };
};

export const formatCount = (value: number) => new Intl.NumberFormat("en-US").format(value);

export const formatImportSummary = (log: POSSyncLog | null) => {
  if (!log || (log.customers_synced === null && log.orders_synced === null)) {
    return null;
  }
  const customers = log.customers_synced ?? 0;
  const orders = log.orders_synced ?? 0;
  return `${formatCount(customers)} ${customers === 1 ? "customer" : "customers"} · ${formatCount(orders)} ${orders === 1 ? "order" : "orders"}`;
};
