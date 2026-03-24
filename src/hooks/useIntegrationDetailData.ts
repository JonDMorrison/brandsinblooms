import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  buildIntegrationDetailModel,
  type IntegrationDetailModel,
  type IntegrationDetailTone,
} from "@/components/integrations/integrationDetailModel";
import {
  getIntegrationSeed,
  type IntegrationDefinition,
  type IntegrationStatus,
} from "@/components/integrations/integrationsHubConfig";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { useTenant } from "@/hooks/useTenant";
import { useUserRole } from "@/hooks/useUserRole";
import { fetchOAuthConfig } from "@/lib/api/oauth";
import { getOAuthRedirectUri } from "@/utils/environmentUtils";

const REQUEST_INTEGRATION_MAILTO =
  "mailto:support@bloomsuite.app?subject=Request%20an%20Integration&body=Hi%20BloomSuite%20team%2C%0A%0AI'd%20like%20to%20request%20support%20for%20the%20following%20integration%3A%0A";

const EMAIL_INFRASTRUCTURE_SUPPORT_MAILTO =
  "mailto:support@bloomsuite.app?subject=Email%20Infrastructure%20Support&body=Hi%20BloomSuite%20team%2C%0A%0AI%20need%20help%20with%20my%20email%20infrastructure.%0A";

const REQUIRED_SQUARE_WEBHOOK_EVENTS = [
  "payment.created",
  "payment.completed",
  "payment.updated",
  "order.created",
  "order.updated",
  "order.fulfillment.updated",
  "customer.created",
  "customer.updated",
  "loyalty.account.created",
  "loyalty.program.enrollment.created",
  "refund.created",
  "catalog.version.updated",
  "inventory.count.updated",
] as const;

const META_OAUTH_SCOPE =
  "pages_read_engagement,pages_show_list,pages_manage_posts,instagram_basic,instagram_content_publish,instagram_manage_insights";

const COMING_SOON_INTEGRATION_SLUGS = [
  "shopify",
  "hubspot",
  "zapier",
  "slack",
  "custom-webhooks",
] as const;

type ComingSoonIntegrationSlug =
  (typeof COMING_SOON_INTEGRATION_SLUGS)[number];

type ComingSoonContent = {
  statusLabel: string;
  statusTone: IntegrationDetailTone;
  availabilityLabel: string;
  cardTitle: string;
  description: string;
  metadata: string[];
  capabilities: string[];
  previewCallout?: {
    title: string;
    description: string;
  };
};

export type ComingSoonDetailData = ComingSoonContent & {
  notifyEmail: string | null;
  requestPath: string;
  isSubmitted: boolean;
};

const COMING_SOON_CONTENT: Record<ComingSoonIntegrationSlug, ComingSoonContent> = {
  shopify: {
    statusLabel: "Upcoming",
    statusTone: "warning",
    availabilityLabel: "Planned ecommerce release",
    cardTitle: "Shopify is queued for a future rollout.",
    description:
      "This page is intentionally limited to roadmap visibility and interest capture while the production Shopify connection flow stays offline.",
    metadata: [
      "Category: POS Systems",
      "Scope: Ecommerce customers + orders",
      "Availability: Planned release",
    ],
    capabilities: [
      "Sync Shopify customers into BloomSuite CRM",
      "Import ecommerce orders for segmentation and reporting",
      "Map storefront activity into existing automation triggers",
    ],
  },
  hubspot: {
    statusLabel: "Upcoming",
    statusTone: "warning",
    availabilityLabel: "Planned automation release",
    cardTitle: "HubSpot support is planned, not open yet.",
    description:
      "The HubSpot detail route is reserved for a future release that will bring CRM and automation interoperability into the shared integrations shell.",
    metadata: [
      "Category: Automation",
      "Scope: CRM sync + workflow handoff",
      "Availability: Planned release",
    ],
    capabilities: [
      "Bring HubSpot contacts into BloomSuite workflows",
      "Send BloomSuite events into HubSpot automation paths",
      "Preserve account-level setup inside the existing integrations hub",
    ],
  },
  zapier: {
    statusLabel: "In progress",
    statusTone: "warning",
    availabilityLabel: "Internal preview build",
    cardTitle: "Zapier is actively being built.",
    description:
      "This route stays informational while the integration is under active construction. Preview infrastructure exists elsewhere in the repo, but setup controls are intentionally hidden here.",
    metadata: [
      "Category: Automation",
      "Scope: Triggers + actions",
      "Availability: In progress",
    ],
    capabilities: [
      "Trigger Zaps from BloomSuite customer and activity events",
      "Accept Zapier-driven actions back into BloomSuite workflows",
      "Offer a guided setup path once the public release is ready",
    ],
    previewCallout: {
      title: "Preview status",
      description:
        "Zapier is currently in progress. Public webhook configuration and setup controls are not exposed from this page yet.",
    },
  },
  slack: {
    statusLabel: "Upcoming",
    statusTone: "warning",
    availabilityLabel: "Planned collaboration release",
    cardTitle: "Slack notifications are on the roadmap.",
    description:
      "Slack will arrive as an automation-facing integration for operational alerts, approvals, and team notifications without adding a second setup surface.",
    metadata: [
      "Category: Automation",
      "Scope: Alerts + workflow notifications",
      "Availability: Planned release",
    ],
    capabilities: [
      "Send BloomSuite alerts into Slack channels",
      "Route automation approvals to Slack-based teams",
      "Keep notification setup inside the shared integrations experience",
    ],
  },
  "custom-webhooks": {
    statusLabel: "Upcoming",
    statusTone: "warning",
    availabilityLabel: "Planned developer release",
    cardTitle: "Custom webhooks are reserved for a later milestone.",
    description:
      "This route is intentionally scoped to roadmap messaging while webhook controls stay disabled until the underlying contract is production-ready.",
    metadata: [
      "Category: Automation",
      "Scope: Outbound callbacks + inbound triggers",
      "Availability: Planned release",
    ],
    capabilities: [
      "Register outbound BloomSuite event callbacks",
      "Accept inbound webhook triggers for workflow automation",
      "Surface delivery status from the shared integrations shell",
    ],
  },
};

type SquareConnectionRecord = {
  id: string;
  status: string | null;
  connected_at: string | null;
  merchant_name: string | null;
  merchant_id: string | null;
  location_id: string | null;
  environment: string | null;
  token_type: string | null;
  last_synced_at: string | null;
  last_customer_sync: string | null;
  last_product_sync: string | null;
  last_sales_sync: string | null;
  last_webhook_received_at: string | null;
  customers_synced: number | null;
  products_synced: number | null;
  sales_synced: number | null;
  webhook_subscription_id: string | null;
  webhooks_last_checked_at: string | null;
  webhook_last_error: string | null;
  webhook_next_retry_at: string | null;
  webhook_retry_count: number | null;
  webhooks_subscribed: boolean | null;
  setup_wizard_completed_at: string | null;
  updated_at: string | null;
};

export type SquareDetailData = {
  connectionId: string | null;
  merchantName: string | null;
  merchantId: string | null;
  locationId: string | null;
  environment: string | null;
  tokenType: string | null;
  connectionStatus: string | null;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  lastCustomerSync: string | null;
  lastSalesSync: string | null;
  lastProductSync: string | null;
  customersSynced: number | null;
  salesSynced: number | null;
  productsSynced: number | null;
  lastWebhookReceivedAt: string | null;
  webhookSubscriptionId: string | null;
  webhooksLastCheckedAt: string | null;
  webhookLastError: string | null;
  webhookRetryCount: number | null;
  webhookNextRetryAt: string | null;
  webhooksSubscribed: boolean | null;
  requiredWebhookEvents: readonly string[];
  syncLogsPath: string;
  automationLogsPath: string;
  automationPath: string;
  canDisconnect: boolean;
};

type CloverConnectionRecord = {
  id: string;
  status: string | null;
  connected_at: string | null;
  merchant_name: string | null;
  merchant_id: string | null;
  employee_id: string | null;
  region: string | null;
  environment: string | null;
  last_synced_at: string | null;
  last_customer_sync: string | null;
  last_product_sync: string | null;
  last_sales_sync: string | null;
  last_webhook_received_at: string | null;
  customers_synced: number | null;
  products_synced: number | null;
  sales_synced: number | null;
  webhook_subscription_id: string | null;
  webhooks_last_checked_at: string | null;
  webhook_last_error: string | null;
  webhook_next_retry_at: string | null;
  webhook_retry_count: number | null;
  webhooks_subscribed: boolean | null;
  setup_wizard_completed_at: string | null;
  last_tested_at: string | null;
  last_test_status: string | null;
  updated_at: string | null;
};

export type CloverDetailData = {
  connectionId: string | null;
  merchantName: string | null;
  merchantId: string | null;
  employeeId: string | null;
  region: string | null;
  environment: string | null;
  connectionStatus: string | null;
  connectedAt: string | null;
  setupWizardCompletedAt: string | null;
  lastSyncedAt: string | null;
  lastCustomerSync: string | null;
  lastSalesSync: string | null;
  lastProductSync: string | null;
  customersSynced: number | null;
  salesSynced: number | null;
  productsSynced: number | null;
  lastWebhookReceivedAt: string | null;
  webhooksLastCheckedAt: string | null;
  webhookLastError: string | null;
  webhookRetryCount: number | null;
  webhookNextRetryAt: string | null;
  webhooksSubscribed: boolean | null;
  appIdConfigured: boolean;
  lastTestedAt: string | null;
  lastTestStatus: string | null;
  syncLogsPath: string;
  automationLogsPath: string;
  automationPath: string;
  canDisconnect: boolean;
};

type LightspeedConnectionRecord = {
  id: string;
  status: string | null;
  connected_at: string | null;
  retailer_name: string | null;
  domain_prefix: string | null;
  last_synced_at: string | null;
  last_customer_sync: string | null;
  last_product_sync: string | null;
  last_sales_sync: string | null;
  last_webhook_received_at: string | null;
  customers_synced: number | null;
  products_synced: number | null;
  sales_synced: number | null;
  webhook_last_error: string | null;
  webhook_next_retry_at: string | null;
  webhook_retry_count: number | null;
  webhook_registered: boolean | null;
  webhook_subscription_id: string | null;
  webhooks_last_checked_at: string | null;
  webhooks_subscribed: boolean | null;
  updated_at: string | null;
};

export type LightspeedDetailData = {
  connectionId: string | null;
  retailerName: string | null;
  domainPrefix: string | null;
  storeUrl: string | null;
  connectionStatus: string | null;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  lastCustomerSync: string | null;
  lastSalesSync: string | null;
  lastProductSync: string | null;
  customersSynced: number | null;
  salesSynced: number | null;
  productsSynced: number | null;
  lastWebhookReceivedAt: string | null;
  webhooksLastCheckedAt: string | null;
  webhookLastError: string | null;
  webhookRetryCount: number | null;
  webhookNextRetryAt: string | null;
  webhooksSubscribed: boolean | null;
  webhookRegistered: boolean;
  webhookSubscriptionId: string | null;
  webhookMode: "real-time" | "sync-only" | "unavailable";
  syncLogsPath: string;
  diagnosticsPath: string;
  canDisconnect: boolean;
};

type PosSyncJobRow = Database["public"]["Tables"]["pos_sync_jobs_v2"]["Row"];

export type TrackedLightspeedSyncJob = PosSyncJobRow & {
  normalizedSyncType: "customers" | "sales" | "products" | "full";
  progressPercent: number;
  isStale: boolean;
  isTerminal: boolean;
};

export type LightspeedSyncState = "idle" | "triggering" | "syncing";

type LightspeedCustomerRow =
  Database["public"]["Tables"]["lightspeed_customers"]["Row"];
type LightspeedSaleRow = Database["public"]["Tables"]["lightspeed_sales"]["Row"];
type LightspeedProductRow =
  Database["public"]["Tables"]["lightspeed_products"]["Row"];

export type LightspeedSortDirection = "asc" | "desc";
export type LightspeedCustomerSortField =
  | "name"
  | "total_spend"
  | "purchase_count"
  | "last_purchase_date";
export type LightspeedSalesSortField = "sale_date" | "total_amount" | "status";
export type LightspeedProductsSortField =
  | "name"
  | "category"
  | "inventory_count"
  | "price";

export type LightspeedDashboardOptions = {
  customers?: {
    page?: number;
    search?: string;
    sortField?: LightspeedCustomerSortField;
    sortDirection?: LightspeedSortDirection;
  };
  sales?: {
    page?: number;
    status?: string;
    startDate?: string | null;
    endDate?: string | null;
    sortField?: LightspeedSalesSortField;
    sortDirection?: LightspeedSortDirection;
  };
  products?: {
    page?: number;
    category?: string;
    inStockOnly?: boolean;
    sortField?: LightspeedProductsSortField;
    sortDirection?: LightspeedSortDirection;
  };
  syncLogs?: {
    page?: number;
  };
};

export type LightspeedPagination = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type LightspeedCustomerDataQuality = {
  missingEmail: boolean;
  missingPhone: boolean;
  zeroPurchaseCount: boolean;
  staleSync: boolean;
  missingCrmLink: boolean;
};

export type LightspeedCustomerTableRow = LightspeedCustomerRow & {
  displayName: string;
  quality: LightspeedCustomerDataQuality;
};

export type LightspeedSalesSummary = {
  revenue: number;
  averageOrderValue: number;
  saleCount: number;
};

export type LightspeedProductStockState = "out" | "low" | "healthy" | "unknown";

export type LightspeedProductTableRow = LightspeedProductRow & {
  stockState: LightspeedProductStockState;
};

export type LightspeedSyncLogRow = PosSyncJobRow & {
  normalizedSyncType: "customers" | "sales" | "products" | "full";
  progressPercent: number;
  isStale: boolean;
  isTerminal: boolean;
};

export type LightspeedDashboardData = {
  customers: {
    rows: LightspeedCustomerTableRow[];
    pagination: LightspeedPagination;
    isLoading: boolean;
    isFetching: boolean;
  };
  sales: {
    rows: LightspeedSaleRow[];
    pagination: LightspeedPagination;
    summary: LightspeedSalesSummary;
    isLoading: boolean;
    isFetching: boolean;
  };
  products: {
    rows: LightspeedProductTableRow[];
    pagination: LightspeedPagination;
    categories: string[];
    isLoading: boolean;
    isFetching: boolean;
  };
  syncLogs: {
    rows: LightspeedSyncLogRow[];
    pagination: LightspeedPagination;
    isLoading: boolean;
    isFetching: boolean;
  };
};

const LIGHTSPEED_ACTIVE_JOB_STATUSES = ["pending", "in_progress", "delayed"] as const;
const LIGHTSPEED_SYNC_ORDER = ["customers", "sales", "products", "full"] as const;
const LIGHTSPEED_STALE_JOB_MS = 5 * 60 * 1000;
const LIGHTSPEED_DASHBOARD_PAGE_SIZE = 50;
const LIGHTSPEED_DATA_STALE_MS = 30 * 24 * 60 * 60 * 1000;

function normalizeLightspeedJobSyncType(
  syncType: PosSyncJobRow["sync_type"] | string,
): "customers" | "sales" | "products" | "full" {
  if (syncType === "orders" || syncType === "sales") {
    return "sales";
  }

  if (syncType === "products") {
    return "products";
  }

  if (syncType === "full") {
    return "full";
  }

  return "customers";
}

function isTerminalLightspeedJobStatus(status: PosSyncJobRow["status"]) {
  return status === "completed" || status === "failed" || status === "cancelled";
}

function getLightspeedJobActivityTimestamp(job: PosSyncJobRow) {
  return (
    job.last_progress_at ??
    job.updated_at ??
    job.started_at ??
    job.created_at
  );
}

function calculateLightspeedJobProgress(job: PosSyncJobRow) {
  if (job.status === "completed") {
    return 100;
  }

  const estimatedRows = typeof job.estimated_rows === "number" ? job.estimated_rows : null;
  const totalPagesEstimate =
    typeof job.total_pages_est === "number" ? job.total_pages_est : null;
  const processedRows = Math.max(
    job.processed_rows ?? 0,
    job.inserted_rows ?? 0,
    job.fetched_rows ?? 0,
  );

  if (estimatedRows && estimatedRows > 0) {
    const rawProgress = Math.round((processedRows / estimatedRows) * 100);
    return Math.max(job.status === "in_progress" ? 5 : 0, Math.min(99, rawProgress));
  }

  if (totalPagesEstimate && totalPagesEstimate > 0) {
    const rawProgress = Math.round(((job.current_page ?? 0) / totalPagesEstimate) * 100);
    return Math.max(job.status === "in_progress" ? 5 : 0, Math.min(99, rawProgress));
  }

  if ((job.current_page ?? 0) > 0) {
    return Math.min(95, (job.current_page ?? 0) * 10);
  }

  return job.status === "in_progress" ? 5 : 0;
}

function buildLightspeedPagination(
  page: number,
  totalCount: number,
  pageSize = LIGHTSPEED_DASHBOARD_PAGE_SIZE,
): LightspeedPagination {
  const normalizedTotalCount = Math.max(totalCount, 0);
  const totalPages = Math.max(1, Math.ceil(normalizedTotalCount / pageSize));

  return {
    page,
    pageSize,
    totalCount: normalizedTotalCount,
    totalPages,
  };
}

function getLightspeedPageRange(page: number, pageSize = LIGHTSPEED_DASHBOARD_PAGE_SIZE) {
  const safePage = Math.max(page, 1);
  const from = (safePage - 1) * pageSize;
  const to = from + pageSize - 1;

  return { from, to, safePage };
}

function isLightspeedDataStale(timestamp?: string | null) {
  if (!timestamp) {
    return true;
  }

  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) {
    return true;
  }

  return Date.now() - parsed > LIGHTSPEED_DATA_STALE_MS;
}

function formatLightspeedCustomerName(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null,
  customerId?: string | null,
) {
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  if (fullName) {
    return fullName;
  }

  return email?.trim() || customerId || "Unnamed customer";
}

function getLightspeedProductStockState(
  inventoryCount?: number | null,
): LightspeedProductStockState {
  if (typeof inventoryCount !== "number") {
    return "unknown";
  }

  if (inventoryCount <= 0) {
    return "out";
  }

  if (inventoryCount <= 5) {
    return "low";
  }

  return "healthy";
}

function normalizeLightspeedSyncLogRow(job: PosSyncJobRow): LightspeedSyncLogRow {
  return {
    ...job,
    normalizedSyncType: normalizeLightspeedJobSyncType(job.sync_type),
    progressPercent: calculateLightspeedJobProgress(job),
    isStale: isLightspeedJobStale(job),
    isTerminal: isTerminalLightspeedJobStatus(job.status),
  };
}

function getJsonArrayLength(value: Json | null | undefined) {
  return Array.isArray(value) ? value.length : 0;
}

function isLightspeedJobStale(job: PosSyncJobRow) {
  if (isTerminalLightspeedJobStatus(job.status) || job.status === "delayed") {
    return false;
  }

  const timestamp = getLightspeedJobActivityTimestamp(job);
  if (!timestamp) {
    return false;
  }

  const activityTime = new Date(timestamp).getTime();
  if (!Number.isFinite(activityTime)) {
    return false;
  }

  return Date.now() - activityTime > LIGHTSPEED_STALE_JOB_MS;
}

type MetaConnectionRecord = {
  id: string;
  platform: string;
  platform_account_name: string | null;
  platform_account_id: string | null;
  page_id: string | null;
  username: string | null;
  expires_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  is_active: boolean | null;
  deleted_at: string | null;
};

export type MetaAssetRow = {
  id: string;
  platform: "facebook" | "instagram";
  name: string;
  externalId: string | null;
  secondaryLabel: string;
  connectedAt: string | null;
  lastActivityAt: string | null;
};

export type MetaDetailData = {
  authorizationStatus: "authorized" | "expired" | "not-connected";
  authorizationLabel: string;
  providerLabel: string;
  connectedAt: string | null;
  lastActivityAt: string | null;
  expiresAt: string | null;
  facebookPages: MetaAssetRow[];
  instagramAccounts: MetaAssetRow[];
  facebookPageCount: number;
  instagramAccountCount: number;
  connectedAssetCount: number;
  connectedPlatforms: string[];
  platformSummary: string;
  authorizationSummary: string;
  scopes: string[];
  syncLogsPath: string;
  managementPath: string;
  canDisconnect: boolean;
};

type Ga4ConnectionRecord = {
  id: string;
  property_id: string;
  connection_status: string;
  service_account_configured: boolean;
  last_test_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Ga4DetailData = {
  connectionId: string | null;
  propertyId: string | null;
  propertyLabel: string;
  connectionStatus: "connected" | "authorizing" | "error" | "not-connected" | string;
  connectionLabel: string;
  serviceAccountConfigured: boolean;
  lastTestAt: string | null;
  connectedAt: string | null;
  updatedAt: string | null;
  reportingPath: string;
  managementPath: string;
  reportingSummary: string;
  canDisconnect: boolean;
};

type MarketingProviderKey = "mailchimp" | "klaviyo" | "constant_contact";

type MarketingProviderConnectionRecord = {
  id: string;
  provider: string;
  provider_account_name: string | null;
  provider_account_id: string | null;
  connected_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  status: string;
  token_expires_at: string | null;
  metadata: unknown;
};

type ProviderArtifactRecord = {
  id: string;
  artifact_type: string;
  external_id: string;
  name: string;
  member_count: number | null;
  created_at: string;
};

type ImportJobRecord = {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  report: unknown;
};

export type MarketingImportDetailData = {
  provider: MarketingProviderKey;
  providerLabel: string;
  providerDescription: string;
  connectionId: string | null;
  accountName: string | null;
  accountId: string | null;
  contactEmail: string | null;
  connectionStatus: "connected" | "not-connected" | string;
  connectionLabel: string;
  connectedAt: string | null;
  updatedAt: string | null;
  tokenExpiresAt: string | null;
  listCount: number;
  segmentCount: number;
  latestImportId: string | null;
  latestImportStatus: string | null;
  latestImportStartedAt: string | null;
  latestImportCompletedAt: string | null;
  latestImportSummary: string;
  importFlowPath: string;
  previewListsPath: string;
  purposeLabel: string;
  liveSyncLabel: string;
  capabilities: string[];
  canDisconnect: boolean;
};

type EmailInfrastructureDomainRecord = {
  id: string;
  domain: string;
  status: string;
  created_at: string | null;
  updated_at: string | null;
  verified_at: string | null;
  last_verify_attempt_at: string | null;
  last_verify_error: string | null;
  error: string | null;
  daily_limit: number | null;
  daily_sent_count: number | null;
  warmup_stage: number | null;
  entri_provider: string | null;
  is_entri_managed: boolean | null;
  healthy_days_counter: number | null;
  resend_status: unknown;
};

type EmailInfrastructureDnsRecord = {
  id: string;
  name: string;
  type: string;
  value: string;
  purpose: string;
  required: boolean;
};

type EmailInfrastructureHealthCheck = {
  id: string;
  check_type: string;
  status: string;
  details: unknown;
  response_time_ms: number;
  checked_at: string;
};

type EmailInfrastructureDnsStatus = {
  id: string;
  name: string;
  type: string;
  value: string;
  purpose: string;
  required: boolean;
  verified: boolean;
  lastCheckedAt: string | null;
};

export type EmailInfrastructureDetailData = {
  badgeLabel: string;
  badgeTone: IntegrationDetailTone;
  metadata: string[];
  primaryDomainId: string | null;
  primaryDomain: string | null;
  primaryStatus: string;
  primaryStatusLabel: string;
  providerLabel: string;
  providerModeLabel: string;
  domainCount: number;
  verifiedDomainCount: number;
  dnsRecordCount: number;
  dnsVerifiedCount: number;
  latestHealthCheckAt: string | null;
  healthCheckStatus: "healthy" | "warning" | "error" | "neutral";
  healthCheckLabel: string;
  reputationScore: number | null;
  reputationTier: string | null;
  trendDirection: "up" | "down" | "flat" | null;
  sent24h: number;
  delivered24h: number;
  bounceRate24h: number;
  complaintRate24h: number;
  sent30d: number;
  deliveryRate30d: number;
  bounceRate30d: number;
  dailySentCount: number | null;
  dailyLimit: number | null;
  warmupStage: number | null;
  healthyDaysCounter: number | null;
  verifiedAt: string | null;
  lastVerifyAttemptAt: string | null;
  lastError: string | null;
  readinessSummary: string;
  configurationSummary: string;
  healthSummary: string;
  domainConnectSummary: string;
  dnsRecords: EmailInfrastructureDnsStatus[];
  domainSettingsPath: string;
  emailSettingsPath: string;
  dnsRecordsPath: string;
  sendingLogsPath: string;
  supportPath: string;
  canRunHealthCheck: boolean;
};

type DetailResult = {
  item: IntegrationDefinition;
  model: IntegrationDetailModel;
  targetPath?: string;
  requestPath?: string;
  squareConnection?: SquareConnectionRecord | null;
  squareDetail?: SquareDetailData;
  cloverConnection?: CloverConnectionRecord | null;
  cloverDetail?: CloverDetailData;
  lightspeedConnection?: LightspeedConnectionRecord | null;
  lightspeedDetail?: LightspeedDetailData;
  metaConnections?: MetaConnectionRecord[] | null;
  metaDetail?: MetaDetailData;
  ga4Detail?: Ga4DetailData;
  marketingImportDetail?: MarketingImportDetailData;
  emailInfrastructureDetail?: EmailInfrastructureDetailData;
  lightspeedDashboard?: LightspeedDashboardData;
  disconnectRef?:
    | { kind: "square" | "clover" | "lightspeed" | "ga4"; id: string }
    | { kind: "provider"; id: string; provider: string }
    | { kind: "meta"; ids: string[] };
};

function isComingSoonIntegrationSlug(
  slug?: string | null,
): slug is ComingSoonIntegrationSlug {
  return COMING_SOON_INTEGRATION_SLUGS.some((candidate) => candidate === slug);
}

function buildComingSoonRequestPath(name: string) {
  return `${REQUEST_INTEGRATION_MAILTO}${encodeURIComponent(name)}`;
}

function buildComingSoonDetailData(
  seed: IntegrationDefinition,
  notifyEmail: string | null,
  isSubmitted: boolean,
): ComingSoonDetailData | null {
  if (!isComingSoonIntegrationSlug(seed.slug)) {
    return null;
  }

  const content = COMING_SOON_CONTENT[seed.slug];

  return {
    ...content,
    notifyEmail,
    requestPath: buildComingSoonRequestPath(seed.name),
    isSubmitted,
  };
}

const MARKETING_PROVIDER_META: Record<
  MarketingProviderKey,
  {
    label: string;
    description: string;
    capabilities: string[];
  }
> = {
  mailchimp: {
    label: "Mailchimp",
    description: "Import audiences, tags, and list structure from Mailchimp.",
    capabilities: [
      "Preview available audiences before importing",
      "Start one-time contact imports into BloomSuite",
      "Preserve list and segment structure for review",
    ],
  },
  klaviyo: {
    label: "Klaviyo",
    description: "Import lists and audience structure from Klaviyo.",
    capabilities: [
      "Preview available lists before importing",
      "Start one-time contact imports into BloomSuite",
      "Retain imported audience groupings for CRM review",
    ],
  },
  constant_contact: {
    label: "Constant Contact",
    description: "Import contact lists from Constant Contact.",
    capabilities: [
      "Preview available contact lists before importing",
      "Start one-time contact imports into BloomSuite",
      "Reuse the existing migration wizard without enabling live sync",
    ],
  },
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function getMetadataString(metadata: unknown, keys: string[]) {
  const source = asObject(metadata);

  if (!source) {
    return null;
  }

  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return null;
}

function getImportReportCount(report: unknown, key: string) {
  const value = asObject(report)?.[key];

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getImportReportErrorCount(report: unknown) {
  const errors = asObject(report)?.errors;

  return Array.isArray(errors) ? errors.length : null;
}

function countUniqueArtifacts(
  artifacts: ProviderArtifactRecord[],
  artifactType: string,
) {
  return new Set(
    artifacts
      .filter((artifact) => artifact.artifact_type === artifactType)
      .map((artifact) => artifact.external_id || artifact.id),
  ).size;
}

function buildGa4DetailData(
  connection: Ga4ConnectionRecord | null,
  canDisconnect: boolean,
): Ga4DetailData {
  const propertyLabel = connection?.property_id
    ? `Property ${connection.property_id}`
    : "Property pending";
  const isConnected = connection?.connection_status === "connected";

  return {
    connectionId: connection?.id ?? null,
    propertyId: connection?.property_id ?? null,
    propertyLabel,
    connectionStatus: connection?.connection_status ?? "not-connected",
    connectionLabel: isConnected
      ? "Connected"
      : connection?.connection_status === "error"
        ? "Attention needed"
        : connection?.connection_status === "authorizing"
          ? "Authorizing"
          : "Not connected",
    serviceAccountConfigured: Boolean(connection?.service_account_configured),
    lastTestAt: connection?.last_test_at ?? null,
    connectedAt: connection?.created_at ?? null,
    updatedAt: connection?.updated_at ?? null,
    reportingPath: "/integrations/website",
    managementPath: "/integrations/website",
    reportingSummary: isConnected
      ? "Website analytics reporting is available from the Website integrations page."
      : "Connect a GA4 property to unlock website analytics reporting.",
    canDisconnect,
  };
}

function buildMarketingImportDetailData(
  provider: MarketingProviderKey,
  connection: MarketingProviderConnectionRecord | null,
  artifacts: ProviderArtifactRecord[],
  latestImport: ImportJobRecord | null,
  canDisconnect: boolean,
): MarketingImportDetailData {
  const providerMeta = MARKETING_PROVIDER_META[provider];
  const accountName =
    connection?.provider_account_name ??
    getMetadataString(connection?.metadata, ["accountname", "name", "organization_name"]);
  const contactEmail = getMetadataString(connection?.metadata, [
    "contact_email",
    "email",
    "login_email",
  ]) ?? getMetadataString(asObject(connection?.metadata)?.login, ["email"]);
  const listCount = countUniqueArtifacts(artifacts, "list");
  const segmentCount = countUniqueArtifacts(artifacts, "segment");
  const contactsImported = getImportReportCount(latestImport?.report, "contacts_imported");
  const segmentsCreated = getImportReportCount(latestImport?.report, "segments_created");
  const errorCount = getImportReportErrorCount(latestImport?.report);
  const latestImportSummary = latestImport
    ? [
        contactsImported !== null
          ? `${contactsImported.toLocaleString()} contacts imported`
          : null,
        segmentsCreated !== null ? `${segmentsCreated} segments created` : null,
        errorCount !== null ? `${errorCount} errors` : null,
      ]
        .filter((value): value is string => Boolean(value))
        .join(" • ") || `Latest import status: ${latestImport.status}`
    : "No import job has been recorded yet.";

  return {
    provider,
    providerLabel: providerMeta.label,
    providerDescription: providerMeta.description,
    connectionId: connection?.id ?? null,
    accountName: accountName ?? null,
    accountId: connection?.provider_account_id ?? null,
    contactEmail: contactEmail ?? null,
    connectionStatus: connection?.status ?? "not-connected",
    connectionLabel: connection ? "Connected" : "Not connected",
    connectedAt: connection?.connected_at ?? connection?.created_at ?? null,
    updatedAt:
      latestImport?.completed_at ??
      latestImport?.updated_at ??
      connection?.updated_at ??
      connection?.connected_at ??
      null,
    tokenExpiresAt: connection?.token_expires_at ?? null,
    listCount,
    segmentCount,
    latestImportId: latestImport?.id ?? null,
    latestImportStatus: latestImport?.status ?? null,
    latestImportStartedAt: latestImport?.created_at ?? null,
    latestImportCompletedAt: latestImport?.completed_at ?? null,
    latestImportSummary,
    importFlowPath: `/integrations/migrations?provider=${provider}`,
    previewListsPath: `/integrations/migrations?provider=${provider}&step=choose`,
    purposeLabel: "Contact Import",
    liveSyncLabel: "Not available",
    capabilities: providerMeta.capabilities,
    canDisconnect,
  };
}

function normalizeInfrastructureValue(value: string | null | undefined) {
  return value?.trim().replace(/\.$/, "").toLowerCase() ?? null;
}

function getEmailInfrastructureStatusLabel(status: string | null | undefined) {
  switch (status) {
    case "active":
      return "Connected";
    case "warming_up":
      return "Warming up";
    case "verifying":
      return "Verifying";
    case "pending_dns":
      return "DNS pending";
    case "failed":
    case "error":
      return "Needs attention";
    case "paused":
      return "Paused";
    case "blocked":
      return "Blocked";
    default:
      return "Setup required";
  }
}

function getEmailInfrastructureProviderLabel(
  domain: EmailInfrastructureDomainRecord | null,
) {
  if (!domain) {
    return "Domain settings";
  }

  if (domain.entri_provider) {
    return domain.entri_provider;
  }

  if (domain.is_entri_managed) {
    return "Entri";
  }

  return "Manual DNS";
}

function getEmailInfrastructureProviderModeLabel(
  domain: EmailInfrastructureDomainRecord | null,
) {
  if (!domain) {
    return "Setup tools available";
  }

  if (domain.is_entri_managed && domain.entri_provider) {
    return `Managed with ${domain.entri_provider}`;
  }

  if (domain.is_entri_managed) {
    return "Managed automatically";
  }

  if (domain.entri_provider) {
    return `Prepared for ${domain.entri_provider}`;
  }

  return "Manual DNS setup";
}

function getEmailInfrastructureHealthStatus(
  checks: EmailInfrastructureHealthCheck[],
): Pick<
  EmailInfrastructureDetailData,
  "healthCheckStatus" | "healthCheckLabel" | "latestHealthCheckAt"
> {
  if (checks.length === 0) {
    return {
      healthCheckStatus: "neutral",
      healthCheckLabel: "No health checks yet",
      latestHealthCheckAt: null,
    };
  }

  const latestHealthCheckAt = getMostRecentTimestamp(
    checks.map((check) => check.checked_at),
  );
  const statuses = checks.map((check) => check.status);

  if (statuses.some((status) => status === "error")) {
    return {
      healthCheckStatus: "error",
      healthCheckLabel: "Health issues detected",
      latestHealthCheckAt,
    };
  }

  if (statuses.some((status) => status === "warning")) {
    return {
      healthCheckStatus: "warning",
      healthCheckLabel: "Needs review",
      latestHealthCheckAt,
    };
  }

  if (statuses.every((status) => status === "healthy")) {
    return {
      healthCheckStatus: "healthy",
      healthCheckLabel: "Healthy",
      latestHealthCheckAt,
    };
  }

  return {
    healthCheckStatus: "neutral",
    healthCheckLabel: "Checks available",
    latestHealthCheckAt,
  };
}

function buildEmailInfrastructureVerificationMap(
  domain: EmailInfrastructureDomainRecord | null,
) {
  const verificationMap = new Map<
    string,
    { verified: boolean; lastCheckedAt: string | null }
  >();
  const resendStatus = asObject(domain?.resend_status);
  const directDns = asObject(resendStatus?.direct_dns);
  const directChecks = Array.isArray(directDns?.checks) ? directDns.checks : [];
  const providerRecords = Array.isArray(resendStatus?.records)
    ? resendStatus.records
    : [];

  for (const entry of providerRecords) {
    const source = asObject(entry);
    const type = typeof source?.type === "string" ? source.type : null;
    const name =
      typeof source?.name === "string"
        ? source.name
        : typeof source?.fqdn_queried === "string"
          ? source.fqdn_queried
          : null;

    if (!type || !name) {
      continue;
    }

    verificationMap.set(
      `${type}:${normalizeInfrastructureValue(name)}`,
      {
        verified:
          Boolean(source?.dns_verified) || source?.status === "verified",
        lastCheckedAt: null,
      },
    );
  }

  for (const entry of directChecks) {
    const source = asObject(entry);
    const type = typeof source?.record_type === "string" ? source.record_type : null;
    const fqdn = typeof source?.fqdn === "string" ? source.fqdn : null;

    if (!type || !fqdn) {
      continue;
    }

    verificationMap.set(
      `${type}:${normalizeInfrastructureValue(fqdn)}`,
      {
        verified: Boolean(source?.found) || Boolean(source?.verified),
        lastCheckedAt:
          typeof source?.last_checked_at === "string"
            ? source.last_checked_at
            : null,
      },
    );
  }

  return verificationMap;
}

function buildEmailInfrastructureDetailData(
  domains: EmailInfrastructureDomainRecord[],
  dnsRecords: EmailInfrastructureDnsRecord[],
  healthChecks: EmailInfrastructureHealthCheck[],
  healthDashboard: Record<string, unknown> | null,
  deliverabilitySummary: Record<string, unknown> | null,
): EmailInfrastructureDetailData {
  const primaryDomain =
    domains.find((domain) => ["active", "warming_up"].includes(domain.status)) ??
    domains.find((domain) => Boolean(domain.verified_at)) ??
    domains[0] ??
    null;
  const verificationMap = buildEmailInfrastructureVerificationMap(primaryDomain);
  const dnsStatuses = dnsRecords.map((record) => {
    const match = verificationMap.get(
      `${record.type}:${normalizeInfrastructureValue(record.name)}`,
    );

    return {
      ...record,
      verified: match?.verified ?? false,
      lastCheckedAt: match?.lastCheckedAt ?? null,
    };
  });
  const verifiedDomainCount = domains.filter(
    (domain) => Boolean(domain.verified_at) || ["active", "warming_up"].includes(domain.status),
  ).length;
  const dnsVerifiedCount = dnsStatuses.filter((record) => record.verified).length;
  const providerLabel = getEmailInfrastructureProviderLabel(primaryDomain);
  const providerModeLabel = getEmailInfrastructureProviderModeLabel(primaryDomain);
  const primaryStatusLabel = getEmailInfrastructureStatusLabel(primaryDomain?.status);
  const healthState = getEmailInfrastructureHealthStatus(healthChecks);
  const reputationScore =
    typeof healthDashboard?.reputation_score === "number"
      ? healthDashboard.reputation_score
      : null;
  const sent24h =
    typeof healthDashboard?.sent_24h === "number" ? healthDashboard.sent_24h : 0;
  const delivered24h =
    typeof healthDashboard?.delivered_24h === "number"
      ? healthDashboard.delivered_24h
      : 0;
  const bounceRate24h =
    typeof healthDashboard?.bounce_rate_24h === "number"
      ? healthDashboard.bounce_rate_24h
      : 0;
  const complaintRate24h =
    typeof healthDashboard?.complaint_rate_24h === "number"
      ? healthDashboard.complaint_rate_24h
      : 0;
  const sent30d =
    typeof deliverabilitySummary?.sent_30d === "number"
      ? deliverabilitySummary.sent_30d
      : 0;
  const delivered30d =
    typeof deliverabilitySummary?.delivered_30d === "number"
      ? deliverabilitySummary.delivered_30d
      : 0;
  const bounced30d =
    typeof deliverabilitySummary?.bounced_30d === "number"
      ? deliverabilitySummary.bounced_30d
      : 0;
  const deliveryRate30d = sent30d > 0 ? (delivered30d / sent30d) * 100 : 0;
  const bounceRate30d = sent30d > 0 ? (bounced30d / sent30d) * 100 : 0;

  return {
    badgeLabel: "Infrastructure",
    badgeTone: "neutral",
    metadata: [
      `Category: Infrastructure`,
      `Domain: ${primaryDomain?.domain ?? "Not configured"}`,
      `Status: ${primaryStatusLabel}`,
      `Provider: ${providerLabel}`,
    ],
    primaryDomainId: primaryDomain?.id ?? null,
    primaryDomain: primaryDomain?.domain ?? null,
    primaryStatus: primaryDomain?.status ?? "not-configured",
    primaryStatusLabel,
    providerLabel,
    providerModeLabel,
    domainCount: domains.length,
    verifiedDomainCount,
    dnsRecordCount: dnsStatuses.length,
    dnsVerifiedCount,
    latestHealthCheckAt: healthState.latestHealthCheckAt,
    healthCheckStatus: healthState.healthCheckStatus,
    healthCheckLabel: healthState.healthCheckLabel,
    reputationScore,
    reputationTier:
      typeof healthDashboard?.reputation_tier === "string"
        ? healthDashboard.reputation_tier
        : null,
    trendDirection:
      healthDashboard?.trend_direction === "up" ||
      healthDashboard?.trend_direction === "down" ||
      healthDashboard?.trend_direction === "flat"
        ? healthDashboard.trend_direction
        : null,
    sent24h,
    delivered24h,
    bounceRate24h,
    complaintRate24h,
    sent30d,
    deliveryRate30d,
    bounceRate30d,
    dailySentCount: primaryDomain?.daily_sent_count ?? null,
    dailyLimit: primaryDomain?.daily_limit ?? null,
    warmupStage: primaryDomain?.warmup_stage ?? null,
    healthyDaysCounter: primaryDomain?.healthy_days_counter ?? null,
    verifiedAt: primaryDomain?.verified_at ?? null,
    lastVerifyAttemptAt: primaryDomain?.last_verify_attempt_at ?? null,
    lastError: primaryDomain?.last_verify_error ?? primaryDomain?.error ?? null,
    readinessSummary: primaryDomain
      ? `${primaryDomain.domain} is currently ${primaryStatusLabel.toLowerCase()} with ${dnsVerifiedCount}/${dnsStatuses.length || 0} DNS records verified.`
      : "No sending domain is configured yet. Add a domain to begin DNS verification and delivery monitoring.",
    configurationSummary: primaryDomain
      ? `${providerModeLabel} keeps BloomSuite pointed at ${primaryDomain.domain} for sending, DNS verification, and warmup controls.`
      : "Open Domain settings to connect a sending domain or start manual DNS setup.",
    healthSummary:
      reputationScore !== null
        ? `Tenant reputation is ${reputationScore.toFixed(0)} with ${sent24h.toLocaleString()} emails sent in the last 24 hours.`
        : healthState.healthCheckLabel,
    domainConnectSummary: primaryDomain?.is_entri_managed
      ? `Automatic DNS management is available through ${providerLabel}.`
      : "Use Domain settings to run Domain Connect, review DNS records, or continue manual setup.",
    dnsRecords: dnsStatuses,
    domainSettingsPath: "/domains",
    emailSettingsPath: "/crm/settings/email-sending",
    dnsRecordsPath: "/domains",
    sendingLogsPath: "/activity?q=email",
    supportPath: EMAIL_INFRASTRUCTURE_SUPPORT_MAILTO,
    canRunHealthCheck: Boolean(primaryDomain?.id),
  };
}

function buildSquareDetailData(
  connection: SquareConnectionRecord | null,
  canDisconnect: boolean,
): SquareDetailData {
  return {
    connectionId: connection?.id ?? null,
    merchantName: connection?.merchant_name ?? null,
    merchantId: connection?.merchant_id ?? null,
    locationId: connection?.location_id ?? null,
    environment: connection?.environment ?? null,
    tokenType: connection?.token_type ?? null,
    connectionStatus: connection?.status ?? null,
    connectedAt: connection?.connected_at ?? null,
    lastSyncedAt:
      connection?.last_synced_at ??
      getMostRecentTimestamp([
        connection?.last_sales_sync,
        connection?.last_product_sync,
        connection?.last_customer_sync,
      ]),
    lastCustomerSync: connection?.last_customer_sync ?? null,
    lastSalesSync: connection?.last_sales_sync ?? null,
    lastProductSync: connection?.last_product_sync ?? null,
    customersSynced: connection?.customers_synced ?? null,
    salesSynced: connection?.sales_synced ?? null,
    productsSynced: connection?.products_synced ?? null,
    lastWebhookReceivedAt: connection?.last_webhook_received_at ?? null,
    webhookSubscriptionId: connection?.webhook_subscription_id ?? null,
    webhooksLastCheckedAt: connection?.webhooks_last_checked_at ?? null,
    webhookLastError: connection?.webhook_last_error ?? null,
    webhookRetryCount: connection?.webhook_retry_count ?? null,
    webhookNextRetryAt: connection?.webhook_next_retry_at ?? null,
    webhooksSubscribed: connection?.webhooks_subscribed ?? null,
    requiredWebhookEvents: REQUIRED_SQUARE_WEBHOOK_EVENTS,
    syncLogsPath: "/activity?source=square&type=sync",
    automationLogsPath: "/activity?source=square&type=automation",
    automationPath: "/crm/automations",
    canDisconnect,
  };
}

function buildCloverDetailData(
  connection: CloverConnectionRecord | null,
  canDisconnect: boolean,
): CloverDetailData {
  return {
    connectionId: connection?.id ?? null,
    merchantName: connection?.merchant_name ?? null,
    merchantId: connection?.merchant_id ?? null,
    employeeId: connection?.employee_id ?? null,
    region: connection?.region ?? null,
    environment: connection?.environment ?? null,
    connectionStatus: connection?.status ?? null,
    connectedAt: connection?.connected_at ?? null,
    setupWizardCompletedAt: connection?.setup_wizard_completed_at ?? null,
    lastSyncedAt:
      connection?.last_synced_at ??
      getMostRecentTimestamp([
        connection?.last_sales_sync,
        connection?.last_product_sync,
        connection?.last_customer_sync,
      ]),
    lastCustomerSync: connection?.last_customer_sync ?? null,
    lastSalesSync: connection?.last_sales_sync ?? null,
    lastProductSync: connection?.last_product_sync ?? null,
    customersSynced: connection?.customers_synced ?? null,
    salesSynced: connection?.sales_synced ?? null,
    productsSynced: connection?.products_synced ?? null,
    lastWebhookReceivedAt: connection?.last_webhook_received_at ?? null,
    webhooksLastCheckedAt: connection?.webhooks_last_checked_at ?? null,
    webhookLastError: connection?.webhook_last_error ?? null,
    webhookRetryCount: connection?.webhook_retry_count ?? null,
    webhookNextRetryAt: connection?.webhook_next_retry_at ?? null,
    webhooksSubscribed: connection?.webhooks_subscribed ?? null,
    appIdConfigured: Boolean(connection?.webhook_subscription_id),
    lastTestedAt: connection?.last_tested_at ?? null,
    lastTestStatus: connection?.last_test_status ?? null,
    syncLogsPath: "/activity?source=clover&type=sync",
    automationLogsPath: "/activity?source=clover&type=automation",
    automationPath: "/crm/automations",
    canDisconnect,
  };
}

function getLightspeedStoreUrl(domainPrefix?: string | null) {
  if (!domainPrefix) {
    return null;
  }

  return `https://${domainPrefix}.retail.lightspeed.app`;
}

function getLightspeedWebhookMode(
  connection: LightspeedConnectionRecord | null,
): LightspeedDetailData["webhookMode"] {
  if (connection?.webhooks_subscribed) {
    return "real-time";
  }

  if (
    connection?.webhook_last_error ===
    "Lightspeed webhook API not available for this account. Sync-only mode."
  ) {
    return "unavailable";
  }

  return "sync-only";
}

function buildLightspeedDetailData(
  connection: LightspeedConnectionRecord | null,
  canDisconnect: boolean,
): LightspeedDetailData {
  return {
    connectionId: connection?.id ?? null,
    retailerName: connection?.retailer_name ?? null,
    domainPrefix: connection?.domain_prefix ?? null,
    storeUrl: getLightspeedStoreUrl(connection?.domain_prefix),
    connectionStatus: connection?.status ?? null,
    connectedAt: connection?.connected_at ?? null,
    lastSyncedAt:
      connection?.last_synced_at ??
      getMostRecentTimestamp([
        connection?.last_sales_sync,
        connection?.last_product_sync,
        connection?.last_customer_sync,
      ]),
    lastCustomerSync: connection?.last_customer_sync ?? null,
    lastSalesSync: connection?.last_sales_sync ?? null,
    lastProductSync: connection?.last_product_sync ?? null,
    customersSynced: connection?.customers_synced ?? null,
    salesSynced: connection?.sales_synced ?? null,
    productsSynced: connection?.products_synced ?? null,
    lastWebhookReceivedAt: connection?.last_webhook_received_at ?? null,
    webhooksLastCheckedAt: connection?.webhooks_last_checked_at ?? null,
    webhookLastError: connection?.webhook_last_error ?? null,
    webhookRetryCount: connection?.webhook_retry_count ?? null,
    webhookNextRetryAt: connection?.webhook_next_retry_at ?? null,
    webhooksSubscribed: connection?.webhooks_subscribed ?? null,
    webhookRegistered: Boolean(connection?.webhook_registered),
    webhookSubscriptionId: connection?.webhook_subscription_id ?? null,
    webhookMode: getLightspeedWebhookMode(connection),
    syncLogsPath: "/activity?source=lightspeed&type=sync",
    diagnosticsPath: "/integrations/lightspeed/debug",
    canDisconnect,
  };
}

function summarizeCounts(entries: Array<[string, number | null | undefined]>) {
  const parts = entries
    .filter(([, value]) => typeof value === "number" && value >= 0)
    .map(([label, value]) => `${label} ${value}`);

  return parts.length > 0 ? parts.join(" • ") : null;
}

function getMostRecentTimestamp(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())[0] ?? null;
}

function getEarliestTimestamp(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[0] ?? null;
}

function isTimestampExpired(timestamp?: string | null) {
  if (!timestamp) {
    return false;
  }

  return new Date(timestamp).getTime() <= Date.now();
}

function buildMetaAssetRow(
  connection: MetaConnectionRecord,
  platform: "facebook" | "instagram",
): MetaAssetRow {
  const externalId =
    platform === "facebook"
      ? connection.page_id ?? connection.platform_account_id
      : connection.platform_account_id ?? connection.page_id;

  return {
    id: connection.id,
    platform,
    name:
      connection.platform_account_name ??
      connection.username ??
      (platform === "facebook" ? "Facebook Page" : "Instagram Account"),
    externalId,
    secondaryLabel:
      platform === "facebook"
        ? connection.username
          ? `Username @${connection.username}`
          : "Facebook Page"
        : connection.username
          ? `Username @${connection.username}`
          : "Instagram Business account",
    connectedAt: connection.created_at ?? null,
    lastActivityAt: connection.updated_at ?? null,
  };
}

function buildMetaDetailData(
  connections: MetaConnectionRecord[],
  canDisconnect: boolean,
): MetaDetailData {
  const activeConnections = connections.filter(
    (connection) => connection.is_active !== false && !connection.deleted_at,
  );
  const facebookPages = activeConnections
    .filter((connection) => connection.platform === "facebook")
    .map((connection) => buildMetaAssetRow(connection, "facebook"));
  const instagramAccounts = activeConnections
    .filter((connection) => connection.platform === "instagram")
    .map((connection) => buildMetaAssetRow(connection, "instagram"));
  const expiresAt = getEarliestTimestamp(
    activeConnections.map((connection) => connection.expires_at),
  );
  const authorizationStatus =
    activeConnections.length === 0
      ? "not-connected"
      : activeConnections.some((connection) => !isTimestampExpired(connection.expires_at))
        ? "authorized"
        : "expired";
  const connectedPlatforms = [
    ...(facebookPages.length > 0 ? ["facebook"] : []),
    ...(instagramAccounts.length > 0 ? ["instagram"] : []),
  ];

  return {
    authorizationStatus,
    authorizationLabel:
      authorizationStatus === "authorized"
        ? "Authorized"
        : authorizationStatus === "expired"
          ? "Expired"
          : "Not connected",
    providerLabel: "Meta OAuth",
    connectedAt: getEarliestTimestamp(
      activeConnections.map((connection) => connection.created_at),
    ),
    lastActivityAt: getMostRecentTimestamp(
      activeConnections.map((connection) => connection.updated_at),
    ),
    expiresAt,
    facebookPages,
    instagramAccounts,
    facebookPageCount: facebookPages.length,
    instagramAccountCount: instagramAccounts.length,
    connectedAssetCount: activeConnections.length,
    connectedPlatforms,
    platformSummary:
      activeConnections.length > 0
        ? `${facebookPages.length} Facebook page${facebookPages.length === 1 ? "" : "s"} • ${instagramAccounts.length} Instagram account${instagramAccounts.length === 1 ? "" : "s"}`
        : "No Facebook Pages or Instagram Business accounts connected",
    authorizationSummary:
      authorizationStatus === "authorized"
        ? "Meta authorization is active for the connected Facebook Pages and Instagram Business accounts."
        : authorizationStatus === "expired"
          ? "Stored Meta assets remain visible, but authorization has expired and should be renewed before publishing or analytics refresh."
          : "Authorize Meta to connect Facebook Pages and Instagram Business accounts for publishing and analytics.",
    scopes: META_OAUTH_SCOPE.split(","),
    syncLogsPath: "/activity?type=publishing&q=meta",
    managementPath: "/social-accounts",
    canDisconnect,
  };
}

async function launchMetaAuthorizationFlow() {
  sessionStorage.removeItem("oauth_state");
  localStorage.removeItem("oauth_state_backup");
  sessionStorage.removeItem("processed_oauth_codes");

  const state = crypto.randomUUID();
  const timestamp = Date.now().toString();
  const combinedState = `${state}-${timestamp}`;

  sessionStorage.setItem("oauth_state", combinedState);
  localStorage.setItem("oauth_state_backup", combinedState);

  const configData = await fetchOAuthConfig();
  const redirectUri = getOAuthRedirectUri();
  const authUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");

  authUrl.searchParams.set("client_id", configData.clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", META_OAUTH_SCOPE);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("state", combinedState);
  authUrl.searchParams.set("auth_type", "rerequest");

  const oauthTab = window.open(authUrl.toString(), "_blank", "noopener,noreferrer");

  if (!oauthTab) {
    throw new Error(
      "Please allow new tabs to connect Meta, then try again.",
    );
  }
}

function buildFallbackResult(seed: ReturnType<typeof getIntegrationSeed>): DetailResult | null {
  if (!seed) {
    return null;
  }

  const item: IntegrationDefinition = {
    ...seed,
    status: seed.defaultStatus,
  };

  return {
    item,
    model: buildIntegrationDetailModel({
      item,
      status: item.status,
      contextLabel: item.metaLabel,
      configurationHint: item.targetPath
        ? `Open the existing ${item.name} destination to manage setup and provider-specific settings.`
        : `${item.name} configuration controls will appear in a later milestone.`,
      activityHint:
        item.status === "coming-soon"
          ? "This integration is planned, but provider-specific activity is not available yet."
          : "Provider-specific sync activity will appear here after the integration is connected.",
      canDisconnect: item.canDisconnect,
    }),
    targetPath: item.targetPath,
    requestPath:
      item.status === "coming-soon"
        ? `${REQUEST_INTEGRATION_MAILTO}${encodeURIComponent(item.name)}`
        : undefined,
  };
}

export function useIntegrationDetailData(
  slug?: string,
  options?: LightspeedDashboardOptions,
) {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { hasRole } = useUserRole();
  const { data: isSuperAdmin = false } = useIsSuperAdmin();
  const queryClient = useQueryClient();
  const seed = slug ? getIntegrationSeed(slug) : null;
  const [submittedInterestKey, setSubmittedInterestKey] = useState<string | null>(null);
  const [lightspeedTrackedJobIds, setLightspeedTrackedJobIds] = useState<string[]>([]);
  const [lightspeedJobRowsById, setLightspeedJobRowsById] = useState<Record<string, PosSyncJobRow>>({});
  const [shouldToastLightspeedCompletion, setShouldToastLightspeedCompletion] =
    useState(false);
  const lastLightspeedTerminalToastRef = useRef<string | null>(null);

  const query = useQuery({
    queryKey: ["integration-detail", slug ?? null, tenant?.id ?? null, user?.id ?? null],
    enabled: Boolean(seed),
    queryFn: async (): Promise<DetailResult | null> => {
      if (!seed) {
        return null;
      }

      const fallback = buildFallbackResult(seed);
      if (!fallback) {
        return null;
      }

      switch (seed.slug) {
        case "square": {
          if (!tenant?.id || !user?.id) {
            return fallback;
          }

          const { data, error } = await supabase
            .from("square_connections")
            .select(
              "id, status, connected_at, merchant_name, merchant_id, location_id, environment, token_type, last_synced_at, last_customer_sync, last_product_sync, last_sales_sync, last_webhook_received_at, customers_synced, products_synced, sales_synced, webhook_subscription_id, webhooks_last_checked_at, webhook_last_error, webhook_next_retry_at, webhook_retry_count, webhooks_subscribed, setup_wizard_completed_at, updated_at",
            )
            .eq("tenant_id", tenant.id)
            .eq("user_id", user.id)
            .eq("status", "connected")
            .order("connected_at", { ascending: false })
            .limit(1);

          if (error) throw error;

          const connection = data?.[0] ?? null;
          if (!connection) {
            return fallback;
          }

          const item: IntegrationDefinition = {
            ...seed,
            status: "connected",
            connectedSince: connection.connected_at,
            metaLabel: connection.merchant_name ?? "Square merchant",
          };

          return {
            item,
            model: buildIntegrationDetailModel({
              item,
              status: "connected",
              contextLabel: connection.merchant_name,
              connectedAt: connection.connected_at,
              verificationAt: connection.setup_wizard_completed_at,
              lastSyncAt:
                connection.last_synced_at ??
                getMostRecentTimestamp([
                  connection.last_sales_sync,
                  connection.last_product_sync,
                  connection.last_customer_sync,
                ]),
              lastActivityAt: getMostRecentTimestamp([
                connection.last_webhook_received_at,
                connection.last_synced_at,
                connection.updated_at,
              ]),
              lastWebhookReceivedAt: connection.last_webhook_received_at,
              hasWebhookMonitoring: true,
              webhooksSubscribed: connection.webhooks_subscribed,
              webhookRetryCount: connection.webhook_retry_count,
              webhookNextRetryAt: connection.webhook_next_retry_at,
              lastError: connection.webhook_last_error,
              syncSummary: summarizeCounts([
                ["Customers", connection.customers_synced],
                ["Products", connection.products_synced],
                ["Sales", connection.sales_synced],
              ]),
              serviceStateLabel: connection.status ?? "Connected",
              canDisconnect: item.canDisconnect,
            }),
            targetPath: item.targetPath,
            squareConnection: connection,
            disconnectRef: { kind: "square", id: connection.id },
          };
        }
        case "clover": {
          if (!tenant?.id || !user?.id) {
            return fallback;
          }

          const { data, error } = await supabase
            .from("clover_connections")
            .select(
              "id, status, connected_at, merchant_name, merchant_id, employee_id, region, environment, last_synced_at, last_customer_sync, last_product_sync, last_sales_sync, last_webhook_received_at, customers_synced, products_synced, sales_synced, webhook_subscription_id, webhooks_last_checked_at, webhook_last_error, webhook_next_retry_at, webhook_retry_count, webhooks_subscribed, setup_wizard_completed_at, last_tested_at, last_test_status, updated_at",
            )
            .eq("tenant_id", tenant.id)
            .eq("user_id", user.id)
            .eq("status", "connected")
            .order("connected_at", { ascending: false })
            .limit(1);

          if (error) throw error;

          const connection = data?.[0] ?? null;
          if (!connection) {
            return fallback;
          }

          const item: IntegrationDefinition = {
            ...seed,
            status: "connected",
            connectedSince: connection.connected_at,
            metaLabel: connection.merchant_name ?? "Clover merchant",
          };

          return {
            item,
            model: buildIntegrationDetailModel({
              item,
              status: "connected",
              contextLabel: connection.merchant_name,
              connectedAt: connection.connected_at,
              verificationAt: connection.setup_wizard_completed_at,
              lastSyncAt:
                connection.last_synced_at ??
                getMostRecentTimestamp([
                  connection.last_sales_sync,
                  connection.last_product_sync,
                  connection.last_customer_sync,
                ]),
              lastActivityAt: getMostRecentTimestamp([
                connection.last_webhook_received_at,
                connection.last_synced_at,
                connection.updated_at,
              ]),
              lastWebhookReceivedAt: connection.last_webhook_received_at,
              hasWebhookMonitoring: true,
              webhooksSubscribed: connection.webhooks_subscribed,
              webhookRetryCount: connection.webhook_retry_count,
              webhookNextRetryAt: connection.webhook_next_retry_at,
              lastError: connection.webhook_last_error,
              syncSummary: summarizeCounts([
                ["Customers", connection.customers_synced],
                ["Products", connection.products_synced],
                ["Sales", connection.sales_synced],
              ]),
              serviceStateLabel: connection.status ?? "Connected",
              canDisconnect: item.canDisconnect,
            }),
            targetPath: item.targetPath,
            cloverConnection: connection,
            disconnectRef: { kind: "clover", id: connection.id },
          };
        }
        case "lightspeed": {
          if (!tenant?.id || !user?.id) {
            return fallback;
          }

          const { data, error } = await supabase
            .from("lightspeed_connections")
            .select(
              "id, status, connected_at, retailer_name, domain_prefix, last_synced_at, last_customer_sync, last_product_sync, last_sales_sync, last_webhook_received_at, customers_synced, products_synced, sales_synced, webhook_last_error, webhook_next_retry_at, webhook_retry_count, webhook_registered, webhook_subscription_id, webhooks_last_checked_at, webhooks_subscribed, updated_at",
            )
            .eq("tenant_id", tenant.id)
            .eq("user_id", user.id)
            .eq("status", "connected")
            .order("connected_at", { ascending: false })
            .limit(1);

          if (error) throw error;

          const connection = data?.[0] ?? null;
          if (!connection) {
            return fallback;
          }

          const item: IntegrationDefinition = {
            ...seed,
            status: "connected",
            connectedSince: connection.connected_at,
            metaLabel:
              getLightspeedStoreUrl(connection.domain_prefix) ??
              connection.retailer_name ??
              "Lightspeed retailer",
            targetPath: "/integrations/lightspeed/guide",
          };

          return {
            item,
            model: buildIntegrationDetailModel({
              item,
              status: "connected",
              contextLabel: connection.retailer_name ?? connection.domain_prefix,
              connectedAt: connection.connected_at,
              lastSyncAt:
                connection.last_synced_at ??
                getMostRecentTimestamp([
                  connection.last_sales_sync,
                  connection.last_product_sync,
                  connection.last_customer_sync,
                ]),
              lastActivityAt: getMostRecentTimestamp([
                connection.last_webhook_received_at,
                connection.last_synced_at,
                connection.updated_at,
              ]),
              lastWebhookReceivedAt: connection.last_webhook_received_at,
              hasWebhookMonitoring: true,
              webhooksSubscribed: connection.webhooks_subscribed,
              webhookRetryCount: connection.webhook_retry_count,
              webhookNextRetryAt: connection.webhook_next_retry_at,
              lastError: connection.webhook_last_error,
              syncSummary: summarizeCounts([
                ["Customers", connection.customers_synced],
                ["Products", connection.products_synced],
                ["Sales", connection.sales_synced],
              ]),
              serviceStateLabel: connection.status ?? "Connected",
              canDisconnect: item.canDisconnect,
            }),
            targetPath: item.targetPath,
            lightspeedConnection: connection,
            disconnectRef: { kind: "lightspeed", id: connection.id },
          };
        }
        case "mailchimp":
        case "klaviyo":
        case "constant-contact": {
          if (!tenant?.id || !user?.id) {
            return fallback;
          }

          const provider =
            seed.slug === "constant-contact"
              ? "constant_contact"
              : (seed.slug as MarketingProviderKey);
          const [connectionResponse, artifactsResponse, jobsResponse] = await Promise.all([
            supabase
              .from("provider_connections")
              .select(
                "id, provider, provider_account_name, provider_account_id, connected_at, created_at, updated_at, status, token_expires_at, metadata",
              )
              .eq("tenant_id", tenant.id)
              .eq("user_id", user.id)
              .eq("provider", provider)
              .eq("status", "connected")
              .is("revoked_at", null)
              .order("connected_at", { ascending: false })
              .limit(1),
            supabase
              .from("provider_artifacts")
              .select("id, artifact_type, external_id, name, member_count, created_at")
              .eq("tenant_id", tenant.id)
              .eq("provider", provider)
              .order("created_at", { ascending: false }),
            supabase
              .from("import_jobs")
              .select("id, status, created_at, updated_at, completed_at, report")
              .eq("tenant_id", tenant.id)
              .eq("user_id", user.id)
              .eq("provider", provider)
              .order("created_at", { ascending: false })
              .limit(5),
          ]);

          if (connectionResponse.error) throw connectionResponse.error;
          if (artifactsResponse.error) throw artifactsResponse.error;
          if (jobsResponse.error) throw jobsResponse.error;

          const connection = connectionResponse.data?.[0] ?? null;
          const artifacts = artifactsResponse.data ?? [];
          const latestImport = jobsResponse.data?.[0] ?? null;
          const marketingImportDetail = buildMarketingImportDetailData(
            provider,
            connection,
            artifacts,
            latestImport,
            seed.canDisconnect,
          );
          const accountLabel =
            marketingImportDetail.accountName ??
            marketingImportDetail.accountId ??
            `${seed.name} import connection`;
          const item: IntegrationDefinition = {
            ...seed,
            status: connection ? "connected" : "available",
            connectedSince: marketingImportDetail.connectedAt,
            metaLabel: connection ? accountLabel : "Purpose: Contact Import",
          };

          return {
            item,
            model: buildIntegrationDetailModel({
              item,
              status: item.status,
              contextLabel: connection ? accountLabel : `${seed.name} import flow`,
              connectedAt: marketingImportDetail.connectedAt,
              lastSyncAt:
                marketingImportDetail.latestImportCompletedAt ??
                marketingImportDetail.updatedAt,
              lastActivityAt: marketingImportDetail.updatedAt,
              hasWebhookMonitoring: false,
              syncSummary: marketingImportDetail.latestImportSummary,
              serviceStateLabel: marketingImportDetail.connectionLabel,
              canDisconnect: item.canDisconnect,
              configurationHint:
                "Use the migration wizard to preview provider lists and run one-time contact imports. This connection does not enable live sync.",
              activityHint:
                "Import history and provider list discovery appear here without exposing encrypted tokens or hidden provider credentials.",
            }),
            targetPath: marketingImportDetail.importFlowPath,
            marketingImportDetail,
            disconnectRef: connection
              ? { kind: "provider", id: connection.id, provider }
              : undefined,
          };
        }
        case "meta": {
          if (!user?.id) {
            return fallback;
          }

          const { data, error } = await supabase
            .from("social_connections")
            .select(
              "id, platform, platform_account_name, platform_account_id, page_id, username, expires_at, created_at, updated_at, is_active, deleted_at",
            )
            .eq("user_id", user.id)
            .in("platform", ["facebook", "instagram"])
            .is("deleted_at", null)
            .order("created_at", { ascending: false });

          if (error) throw error;

          const connections = data ?? [];
          const activeConnections = connections.filter(
            (connection) => connection.is_active !== false,
          );
          const metaDetail = buildMetaDetailData(connections, seed.canDisconnect);
          const names = activeConnections
            .map((connection) => connection.platform_account_name || connection.platform)
            .filter(Boolean)
            .join(" • ");
          const status: IntegrationStatus =
            metaDetail.authorizationStatus === "authorized"
              ? "connected"
              : "available";
          const item: IntegrationDefinition = {
            ...seed,
            status,
            connectedSince: metaDetail.connectedAt,
            metaLabel:
              names ||
              (metaDetail.authorizationStatus === "expired"
                ? "Stored Meta assets require reauthorization"
                : "Authorize Meta to connect Facebook and Instagram"),
          };

          return {
            item,
            model: buildIntegrationDetailModel({
              item,
              status,
              contextLabel: names || "Facebook and Instagram access",
              connectedAt: metaDetail.connectedAt,
              lastSyncAt: metaDetail.lastActivityAt,
              lastActivityAt: metaDetail.lastActivityAt,
              hasWebhookMonitoring: false,
              syncSummary: metaDetail.platformSummary,
              serviceStateLabel: metaDetail.authorizationLabel,
              canDisconnect: item.canDisconnect,
              configurationHint:
                "Use Meta authorization to connect Facebook Pages and Instagram Business accounts, then manage assets from Social Accounts.",
            }),
            targetPath: item.targetPath,
            metaConnections: connections,
            metaDetail,
            disconnectRef:
              connections.length > 0
                ? { kind: "meta", ids: connections.map((connection) => connection.id) }
                : undefined,
          };
        }
        case "google-analytics-4": {
          if (!user?.id) {
            return fallback;
          }

          const { data, error } = await supabase
            .from("google_analytics_settings")
            .select("id, property_id, connection_status, last_test_at, service_account_configured, created_at, updated_at")
            .eq("user_id", user.id)
            .maybeSingle();

          if (error) throw error;

          const connection = data ?? null;
          const ga4Detail = buildGa4DetailData(connection, seed.canDisconnect);

          const item: IntegrationDefinition = {
            ...seed,
            status:
              connection?.connection_status === "connected"
                ? "connected"
                : "available",
            connectedSince: ga4Detail.connectedAt,
            metaLabel: connection?.property_id
              ? `Property ${connection.property_id}`
              : "Property pending",
          };

          return {
            item,
            model: buildIntegrationDetailModel({
              item,
              status: item.status,
              contextLabel: ga4Detail.propertyLabel,
              connectedAt: ga4Detail.connectedAt,
              verificationAt: ga4Detail.lastTestAt,
              lastActivityAt: ga4Detail.lastTestAt ?? ga4Detail.updatedAt,
              hasWebhookMonitoring: false,
              syncSummary: ga4Detail.serviceAccountConfigured
                ? "Service account configured"
                : "Service account configuration required",
              serviceStateLabel: ga4Detail.connectionLabel,
              canDisconnect: item.canDisconnect,
              configurationHint:
                "Use the Website integrations page to manage the GA4 property and reporting surfaces already present in the repo.",
              activityHint:
                "This detail page shows connection state and reporting readiness. The reporting dashboard stays on the Website integrations page.",
            }),
            targetPath: ga4Detail.managementPath,
            ga4Detail,
            disconnectRef: connection
              ? { kind: "ga4", id: connection.id }
              : undefined,
          };
        }
        case "email-infrastructure": {
          if (!tenant?.id) {
            return fallback;
          }

          const { data, error } = await supabase
            .from("email_domains")
            .select(
              "id, domain, status, created_at, updated_at, verified_at, last_verify_attempt_at, last_verify_error, error, daily_limit, daily_sent_count, warmup_stage, entri_provider, is_entri_managed, healthy_days_counter, resend_status",
            )
            .eq("tenant_id", tenant.id)
            .order("created_at", { ascending: false });

          if (error) throw error;

          const domains = (data ?? []) as EmailInfrastructureDomainRecord[];
          const primaryDomain =
            domains.find((domain) => ["active", "warming_up"].includes(domain.status)) ??
            domains.find((domain) => Boolean(domain.verified_at)) ??
            domains[0] ??
            null;

          const [dnsRecordsResult, healthChecksResult, healthDashboardResult, deliverabilityResult] =
            await Promise.all([
              primaryDomain
                ? supabase
                    .from("email_dns_records")
                    .select("id, name, type, value, purpose, required")
                    .eq("email_domain_id", primaryDomain.id)
                    .order("purpose", { ascending: true })
                : Promise.resolve({ data: [], error: null }),
              primaryDomain
                ? supabase.functions.invoke("domain-health-check", {
                    body: { method: "GET" },
                    headers: { "X-Domain-Id": primaryDomain.id },
                  })
                : Promise.resolve({ data: { checks: [] }, error: null }),
              supabase.rpc("get_tenant_email_health_dashboard" as never, {
                p_tenant_id: tenant.id,
              } as never),
              supabase
                .from("deliverability_summary_30d")
                .select(
                  "sent_30d, delivered_30d, opened_30d, clicked_30d, bounced_30d, complained_30d",
                )
                .eq("tenant_id", tenant.id)
                .maybeSingle(),
            ]);

          if (dnsRecordsResult.error) throw dnsRecordsResult.error;
          if (healthChecksResult.error) throw healthChecksResult.error;
          if (healthDashboardResult.error) throw healthDashboardResult.error;
          if (deliverabilityResult.error) throw deliverabilityResult.error;

          const emailInfrastructureDetail = buildEmailInfrastructureDetailData(
            domains,
            (dnsRecordsResult.data ?? []) as EmailInfrastructureDnsRecord[],
            (((healthChecksResult.data as { checks?: EmailInfrastructureHealthCheck[] } | null)
              ?.checks ?? []) as EmailInfrastructureHealthCheck[]),
            (Array.isArray(healthDashboardResult.data)
              ? (healthDashboardResult.data[0] ?? null)
              : (healthDashboardResult.data ?? null)) as Record<string, unknown> | null,
            (deliverabilityResult.data ?? null) as Record<string, unknown> | null,
          );

          const status: IntegrationStatus =
            primaryDomain &&
            (["active", "warming_up"].includes(primaryDomain.status) ||
              Boolean(primaryDomain.verified_at))
              ? "connected"
              : "available";
          const item: IntegrationDefinition = {
            ...seed,
            status,
            connectedSince: primaryDomain?.created_at ?? null,
            metaLabel: primaryDomain?.domain ?? "No sending domain configured",
          };

          return {
            item,
            model: buildIntegrationDetailModel({
              item,
              status,
              contextLabel: primaryDomain?.domain ?? "Domain setup required",
              connectedAt: primaryDomain?.created_at ?? null,
              verificationAt: primaryDomain?.verified_at ?? null,
              lastActivityAt:
                emailInfrastructureDetail.latestHealthCheckAt ??
                primaryDomain?.verified_at ??
                primaryDomain?.last_verify_attempt_at ??
                primaryDomain?.updated_at ??
                null,
              hasWebhookMonitoring: false,
              lastError: emailInfrastructureDetail.lastError,
              syncSummary: summarizeCounts([
                ["Domains", emailInfrastructureDetail.domainCount],
                ["Verified", emailInfrastructureDetail.verifiedDomainCount],
                ["Sent 24h", emailInfrastructureDetail.sent24h],
                ["DNS verified", emailInfrastructureDetail.dnsVerifiedCount],
              ]),
              serviceStateLabel: emailInfrastructureDetail.primaryStatusLabel,
              canDisconnect: false,
              configurationHint:
                emailInfrastructureDetail.configurationSummary,
              activityHint:
                emailInfrastructureDetail.healthSummary,
            }),
            targetPath: emailInfrastructureDetail.domainSettingsPath,
            emailInfrastructureDetail,
          };
        }
        default:
          return fallback;
      }
    },
  });

  const resolved = useMemo(() => {
    const base = query.data ?? buildFallbackResult(seed);
    if (!base) {
      return null;
    }

    if (seed?.slug === "square") {
      return {
        ...base,
        squareDetail: buildSquareDetailData(
          base.squareConnection ?? null,
          Boolean(base.model.canDisconnect && isSuperAdmin),
        ),
      };
    }

    if (seed?.slug === "clover") {
      return {
        ...base,
        cloverDetail: buildCloverDetailData(
          base.cloverConnection ?? null,
          Boolean(base.model.canDisconnect && isSuperAdmin),
        ),
      };
    }

    if (seed?.slug === "lightspeed") {
      return {
        ...base,
        lightspeedDetail: buildLightspeedDetailData(
          base.lightspeedConnection ?? null,
          Boolean(base.model.canDisconnect && isSuperAdmin),
        ),
      };
    }

    if (seed?.slug === "meta") {
      return {
        ...base,
        metaDetail: buildMetaDetailData(
          base.metaConnections ?? [],
          Boolean(base.model.canDisconnect && base.disconnectRef),
        ),
      };
    }

    return base;
  }, [query.data, seed, isSuperAdmin]);

  const lightspeedDashboardOptions = useMemo(
    () => ({
      customers: {
        page: Math.max(options?.customers?.page ?? 1, 1),
        search: options?.customers?.search?.trim() ?? "",
        sortField: options?.customers?.sortField ?? "last_purchase_date",
        sortDirection: options?.customers?.sortDirection ?? "desc",
      },
      sales: {
        page: Math.max(options?.sales?.page ?? 1, 1),
        status: options?.sales?.status?.trim() ?? "all",
        startDate: options?.sales?.startDate ?? null,
        endDate: options?.sales?.endDate ?? null,
        sortField: options?.sales?.sortField ?? "sale_date",
        sortDirection: options?.sales?.sortDirection ?? "desc",
      },
      products: {
        page: Math.max(options?.products?.page ?? 1, 1),
        category: options?.products?.category?.trim() ?? "all",
        inStockOnly: Boolean(options?.products?.inStockOnly),
        sortField: options?.products?.sortField ?? "name",
        sortDirection: options?.products?.sortDirection ?? "asc",
      },
      syncLogs: {
        page: Math.max(options?.syncLogs?.page ?? 1, 1),
      },
    }),
    [options],
  );

  const isLightspeedDashboardEnabled =
    slug === "lightspeed" && Boolean(tenant?.id) && Boolean(resolved?.lightspeedDetail);

  const lightspeedCustomersQuery = useQuery({
    queryKey: [
      "integration-detail-lightspeed-customers",
      tenant?.id ?? null,
      lightspeedDashboardOptions.customers.page,
      lightspeedDashboardOptions.customers.search,
      lightspeedDashboardOptions.customers.sortField,
      lightspeedDashboardOptions.customers.sortDirection,
    ],
    enabled: isLightspeedDashboardEnabled,
    queryFn: async () => {
      if (!tenant?.id) {
        return {
          rows: [] as LightspeedCustomerTableRow[],
          pagination: buildLightspeedPagination(1, 0),
        };
      }

      const { from, to, safePage } = getLightspeedPageRange(
        lightspeedDashboardOptions.customers.page,
      );
      const searchTerm = lightspeedDashboardOptions.customers.search.replace(/,/g, " ");
      let request = supabase
        .from("lightspeed_customers")
        .select("*", { count: "exact" })
        .eq("tenant_id", tenant.id);

      if (searchTerm) {
        const pattern = `%${searchTerm}%`;
        request = request.or(
          [
            `first_name.ilike.${pattern}`,
            `last_name.ilike.${pattern}`,
            `email.ilike.${pattern}`,
            `phone.ilike.${pattern}`,
            `lightspeed_customer_id.ilike.${pattern}`,
          ].join(","),
        );
      }

      if (lightspeedDashboardOptions.customers.sortField === "name") {
        request = request
          .order("first_name", {
            ascending: lightspeedDashboardOptions.customers.sortDirection === "asc",
            nullsFirst: false,
          })
          .order("last_name", {
            ascending: lightspeedDashboardOptions.customers.sortDirection === "asc",
            nullsFirst: false,
          });
      } else {
        request = request.order(lightspeedDashboardOptions.customers.sortField, {
          ascending: lightspeedDashboardOptions.customers.sortDirection === "asc",
          nullsFirst: false,
        });
      }

      const { data, error, count } = await request.range(from, to);
      if (error) {
        throw error;
      }

      return {
        rows: (data ?? []).map((row) => ({
          ...row,
          displayName: formatLightspeedCustomerName(
            row.first_name,
            row.last_name,
            row.email,
            row.lightspeed_customer_id,
          ),
          quality: {
            missingEmail: !row.email,
            missingPhone: !row.phone,
            zeroPurchaseCount: !row.purchase_count,
            staleSync: isLightspeedDataStale(row.synced_at),
            missingCrmLink: !row.contact_id,
          },
        })),
        pagination: buildLightspeedPagination(safePage, count ?? 0),
      };
    },
  });

  const lightspeedSalesQuery = useQuery({
    queryKey: [
      "integration-detail-lightspeed-sales",
      tenant?.id ?? null,
      lightspeedDashboardOptions.sales.page,
      lightspeedDashboardOptions.sales.status,
      lightspeedDashboardOptions.sales.startDate,
      lightspeedDashboardOptions.sales.endDate,
      lightspeedDashboardOptions.sales.sortField,
      lightspeedDashboardOptions.sales.sortDirection,
    ],
    enabled: isLightspeedDashboardEnabled,
    queryFn: async () => {
      if (!tenant?.id) {
        return {
          rows: [] as LightspeedSaleRow[],
          pagination: buildLightspeedPagination(1, 0),
        };
      }

      const { from, to, safePage } = getLightspeedPageRange(
        lightspeedDashboardOptions.sales.page,
      );
      let request = supabase
        .from("lightspeed_sales")
        .select("*", { count: "exact" })
        .eq("tenant_id", tenant.id);

      if (lightspeedDashboardOptions.sales.status !== "all") {
        request = request.eq("status", lightspeedDashboardOptions.sales.status);
      }

      if (lightspeedDashboardOptions.sales.startDate) {
        request = request.gte(
          "sale_date",
          `${lightspeedDashboardOptions.sales.startDate}T00:00:00.000Z`,
        );
      }

      if (lightspeedDashboardOptions.sales.endDate) {
        request = request.lte(
          "sale_date",
          `${lightspeedDashboardOptions.sales.endDate}T23:59:59.999Z`,
        );
      }

      request = request.order(lightspeedDashboardOptions.sales.sortField, {
        ascending: lightspeedDashboardOptions.sales.sortDirection === "asc",
        nullsFirst: false,
      });

      const { data, error, count } = await request.range(from, to);
      if (error) {
        throw error;
      }

      return {
        rows: data ?? [],
        pagination: buildLightspeedPagination(safePage, count ?? 0),
      };
    },
  });

  const lightspeedSalesSummaryQuery = useQuery({
    queryKey: [
      "integration-detail-lightspeed-sales-summary",
      tenant?.id ?? null,
      lightspeedDashboardOptions.sales.status,
      lightspeedDashboardOptions.sales.startDate,
      lightspeedDashboardOptions.sales.endDate,
    ],
    enabled: isLightspeedDashboardEnabled,
    queryFn: async () => {
      if (!tenant?.id) {
        return {
          revenue: 0,
          averageOrderValue: 0,
          saleCount: 0,
        } satisfies LightspeedSalesSummary;
      }

      let request = supabase
        .from("lightspeed_sales")
        .select("id, total_amount")
        .eq("tenant_id", tenant.id);

      if (lightspeedDashboardOptions.sales.status !== "all") {
        request = request.eq("status", lightspeedDashboardOptions.sales.status);
      }

      if (lightspeedDashboardOptions.sales.startDate) {
        request = request.gte(
          "sale_date",
          `${lightspeedDashboardOptions.sales.startDate}T00:00:00.000Z`,
        );
      }

      if (lightspeedDashboardOptions.sales.endDate) {
        request = request.lte(
          "sale_date",
          `${lightspeedDashboardOptions.sales.endDate}T23:59:59.999Z`,
        );
      }

      const { data, error } = await request;
      if (error) {
        throw error;
      }

      const saleCount = data?.length ?? 0;
      const revenue = (data ?? []).reduce(
        (total, row) => total + (row.total_amount ?? 0),
        0,
      );

      return {
        revenue,
        averageOrderValue: saleCount > 0 ? revenue / saleCount : 0,
        saleCount,
      } satisfies LightspeedSalesSummary;
    },
  });

  const lightspeedProductsQuery = useQuery({
    queryKey: [
      "integration-detail-lightspeed-products",
      tenant?.id ?? null,
      lightspeedDashboardOptions.products.page,
      lightspeedDashboardOptions.products.category,
      lightspeedDashboardOptions.products.inStockOnly,
      lightspeedDashboardOptions.products.sortField,
      lightspeedDashboardOptions.products.sortDirection,
    ],
    enabled: isLightspeedDashboardEnabled,
    queryFn: async () => {
      if (!tenant?.id) {
        return {
          rows: [] as LightspeedProductTableRow[],
          pagination: buildLightspeedPagination(1, 0),
        };
      }

      const { from, to, safePage } = getLightspeedPageRange(
        lightspeedDashboardOptions.products.page,
      );
      let request = supabase
        .from("lightspeed_products")
        .select("*", { count: "exact" })
        .eq("tenant_id", tenant.id);

      if (lightspeedDashboardOptions.products.category !== "all") {
        request = request.eq("category", lightspeedDashboardOptions.products.category);
      }

      if (lightspeedDashboardOptions.products.inStockOnly) {
        request = request.gt("inventory_count", 0);
      }

      request = request.order(lightspeedDashboardOptions.products.sortField, {
        ascending: lightspeedDashboardOptions.products.sortDirection === "asc",
        nullsFirst: false,
      });

      const { data, error, count } = await request.range(from, to);
      if (error) {
        throw error;
      }

      return {
        rows: (data ?? []).map((row) => ({
          ...row,
          stockState: getLightspeedProductStockState(row.inventory_count),
        })),
        pagination: buildLightspeedPagination(safePage, count ?? 0),
      };
    },
  });

  const lightspeedProductCategoriesQuery = useQuery({
    queryKey: ["integration-detail-lightspeed-product-categories", tenant?.id ?? null],
    enabled: isLightspeedDashboardEnabled,
    queryFn: async () => {
      if (!tenant?.id) {
        return [] as string[];
      }

      const { data, error } = await supabase
        .from("lightspeed_products")
        .select("category")
        .eq("tenant_id", tenant.id)
        .not("category", "is", null)
        .limit(5000);

      if (error) {
        throw error;
      }

      return Array.from(
        new Set(
          (data ?? [])
            .map((row) => row.category?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((left, right) => left.localeCompare(right));
    },
  });

  const lightspeedSyncLogsQuery = useQuery({
    queryKey: [
      "integration-detail-lightspeed-sync-logs",
      tenant?.id ?? null,
      lightspeedDashboardOptions.syncLogs.page,
    ],
    enabled: isLightspeedDashboardEnabled,
    queryFn: async () => {
      if (!tenant?.id) {
        return {
          rows: [] as LightspeedSyncLogRow[],
          pagination: buildLightspeedPagination(1, 0),
        };
      }

      const { from, to, safePage } = getLightspeedPageRange(
        lightspeedDashboardOptions.syncLogs.page,
      );
      const { data, error, count } = await supabase
        .from("pos_sync_jobs_v2")
        .select("*", { count: "exact" })
        .eq("tenant_id", tenant.id)
        .eq("provider", "lightspeed")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        throw error;
      }

      return {
        rows: (data ?? []).map(normalizeLightspeedSyncLogRow),
        pagination: buildLightspeedPagination(safePage, count ?? 0),
      };
    },
  });

  useEffect(() => {
    if (
      slug !== "lightspeed" ||
      !tenant?.id ||
      !resolved?.lightspeedDetail?.connectionId
    ) {
      return;
    }

    let cancelled = false;

    const bootstrapTrackedJobs = async () => {
      const { data, error } = await supabase
        .from("pos_sync_jobs_v2")
        .select("*")
        .eq("tenant_id", tenant.id)
        .eq("provider", "lightspeed")
        .in("status", [...LIGHTSPEED_ACTIVE_JOB_STATUSES])
        .order("created_at", { ascending: false })
        .limit(3);

      if (cancelled || error || !data?.length) {
        return;
      }

      setLightspeedTrackedJobIds((previousIds) =>
        previousIds.length > 0
          ? Array.from(new Set([...previousIds, ...data.map((job) => job.id)]))
          : data.map((job) => job.id),
      );
      setLightspeedJobRowsById((previousJobs) => {
        const nextJobs = { ...previousJobs };

        for (const job of data) {
          nextJobs[job.id] = job;
        }

        return nextJobs;
      });
    };

    void bootstrapTrackedJobs();

    return () => {
      cancelled = true;
    };
  }, [slug, tenant?.id, resolved?.lightspeedDetail?.connectionId]);

  useEffect(() => {
    if (
      slug !== "lightspeed" ||
      !tenant?.id ||
      lightspeedTrackedJobIds.length === 0
    ) {
      return;
    }

    let cancelled = false;

    const fetchTrackedJobs = async () => {
      const { data, error } = await supabase
        .from("pos_sync_jobs_v2")
        .select("*")
        .eq("tenant_id", tenant.id)
        .in("id", lightspeedTrackedJobIds);

      if (cancelled || error || !data) {
        return;
      }

      setLightspeedJobRowsById((previousJobs) => {
        const nextJobs = { ...previousJobs };

        for (const job of data) {
          nextJobs[job.id] = job;
        }

        return nextJobs;
      });
    };

    void fetchTrackedJobs();

    return () => {
      cancelled = true;
    };
  }, [slug, tenant?.id, lightspeedTrackedJobIds]);

  useEffect(() => {
    if (
      slug !== "lightspeed" ||
      !tenant?.id ||
      lightspeedTrackedJobIds.length === 0
    ) {
      return;
    }

    const trackedJobIds = new Set(lightspeedTrackedJobIds);
    const channel = supabase
      .channel(`lightspeed-sync-jobs-${tenant.id}-${lightspeedTrackedJobIds.join("-")}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pos_sync_jobs_v2",
          filter: `tenant_id=eq.${tenant.id}`,
        },
        (payload) => {
          const nextJob = payload.new as PosSyncJobRow;
          if (
            !nextJob ||
            nextJob.provider !== "lightspeed" ||
            !trackedJobIds.has(nextJob.id)
          ) {
            return;
          }

          setLightspeedJobRowsById((previousJobs) => ({
            ...previousJobs,
            [nextJob.id]: nextJob,
          }));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [slug, tenant?.id, lightspeedTrackedJobIds]);

  const comingSoonDetail = useMemo(() => {
    if (!seed || !isComingSoonIntegrationSlug(seed.slug)) {
      return null;
    }

    const interestKey = user?.id ? `${user.id}:${seed.slug}` : null;

    return buildComingSoonDetailData(
      seed,
      user?.email?.trim() ?? null,
      submittedInterestKey !== null && submittedInterestKey === interestKey,
    );
  }, [seed, submittedInterestKey, user?.email, user?.id]);

  const comingSoonInterestMutation = useMutation({
    mutationFn: async () => {
      if (!seed || !isComingSoonIntegrationSlug(seed.slug)) {
        throw new Error("Notify me is only available for coming-soon integrations.");
      }

      if (!user?.id || !tenant?.id) {
        throw new Error("You must be signed in with an active organization before requesting updates.");
      }

      const email = user.email?.trim();

      if (!email) {
        throw new Error("Your account email is required before we can notify you.");
      }

      const { error } = await supabase.from("integration_interest").insert({
        tenant_id: tenant.id,
        user_id: user.id,
        email,
        integration_slug: seed.slug,
      });

      if (error) {
        if (error.code === "23505") {
          return { duplicate: true };
        }

        throw error;
      }

      return { duplicate: false };
    },
    onSuccess: () => {
      if (user?.id && seed && isComingSoonIntegrationSlug(seed.slug)) {
        setSubmittedInterestKey(`${user.id}:${seed.slug}`);
      }
    },
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : "We couldn't save your notification request.";
      toast.error(message);
    },
  });

  const emailInfrastructureHealthCheckMutation = useMutation({
    mutationFn: async () => {
      if (slug !== "email-infrastructure") {
        throw new Error(
          "Health checks are only available on the email infrastructure detail page.",
        );
      }

      const domainId = resolved?.emailInfrastructureDetail?.primaryDomainId;

      if (!domainId) {
        throw new Error("Add a sending domain before running a health check.");
      }

      const { data, error } = await supabase.functions.invoke(
        "domain-health-check",
        {
          body: {
            domainId,
            checkTypes: ["dns", "tls", "http"],
          },
        },
      );

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: async () => {
      toast.success("Email infrastructure health check complete.");

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["integration-detail", slug] }),
        queryClient.invalidateQueries({ queryKey: ["integrations-hub"] }),
      ]);
    },
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : "Email infrastructure health check failed.";
      toast.error(message);
    },
  });

  const squareSyncMutation = useMutation({
    mutationFn: async () => {
      if (slug !== "square") {
        throw new Error("Square sync is only available on the Square detail page.");
      }

      if (!resolved?.squareDetail?.connectionId) {
        throw new Error("Connect Square before starting a sync.");
      }

      const { data, error } = await supabase.functions.invoke("square-full-sync");

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: async () => {
      toast.success("Square sync started.");

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["integration-detail"] }),
        queryClient.invalidateQueries({ queryKey: ["integrations-hub"] }),
      ]);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Square sync could not be started.";
      toast.error(message);
    },
  });

  const verifySquareWebhooksMutation = useMutation({
    mutationFn: async () => {
      if (slug !== "square") {
        throw new Error("Webhook verification is only available on the Square detail page.");
      }

      if (!resolved?.squareDetail?.connectionId) {
        throw new Error("Connect Square before verifying webhooks.");
      }

      const { data, error } = await supabase.functions.invoke("square-manage-webhooks", {
        body: { action: "verify" },
      });

      if (error) {
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.message ?? data?.error ?? "Square webhook verification failed.");
      }

      return data;
    },
    onSuccess: async (data) => {
      toast.success(data?.message ?? "Square webhook subscription verified.");

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["integration-detail"] }),
        queryClient.invalidateQueries({ queryKey: ["integrations-hub"] }),
      ]);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Square webhook verification failed.";
      toast.error(message);
    },
  });

  const cloverSyncMutation = useMutation({
    mutationFn: async () => {
      if (slug !== "clover") {
        throw new Error("Clover sync is only available on the Clover detail page.");
      }

      if (!resolved?.cloverDetail?.connectionId) {
        throw new Error("Connect Clover before starting a sync.");
      }

      const { data, error } = await supabase.functions.invoke("clover-sync-customers");

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: async () => {
      toast.success("Clover sync started.");

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["integration-detail"] }),
        queryClient.invalidateQueries({ queryKey: ["integrations-hub"] }),
      ]);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Clover sync could not be started.";
      toast.error(message);
    },
  });

  const cloverConnectionTestMutation = useMutation({
    mutationFn: async () => {
      if (slug !== "clover") {
        throw new Error("Connection testing is only available on the Clover detail page.");
      }

      if (!resolved?.cloverDetail?.connectionId) {
        throw new Error("Connect Clover before running a connection test.");
      }

      const { data, error } = await supabase.functions.invoke("clover-test-harness", {
        body: { date_range_days: 30 },
      });

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: async (data) => {
      toast.success(data?.summary ?? "Clover connection test completed.");

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["integration-detail"] }),
        queryClient.invalidateQueries({ queryKey: ["integrations-hub"] }),
      ]);
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Clover connection test could not be completed.";
      toast.error(message);
    },
  });

  const lightspeedSyncMutation = useMutation({
    mutationFn: async () => {
      if (slug !== "lightspeed") {
        throw new Error("Lightspeed sync is only available on the Lightspeed detail page.");
      }

      if (!resolved?.lightspeedDetail?.connectionId) {
        throw new Error("Connect Lightspeed before starting a sync.");
      }

      const { data, error } = await supabase.functions.invoke("lightspeed-full-sync");

      if (error) {
        throw error;
      }

      if (!Array.isArray(data?.jobs) || data.jobs.length === 0) {
        throw new Error("Lightspeed sync could not be started.");
      }

      return data;
    },
    onSuccess: async (data) => {
      const nextTrackedJobIds = data.jobs
        .map((job: { id?: string | null }) => job.id)
        .filter((jobId): jobId is string => Boolean(jobId));

      setLightspeedTrackedJobIds(nextTrackedJobIds);
      setShouldToastLightspeedCompletion(true);
      lastLightspeedTerminalToastRef.current = null;

      if (data.errors?.length) {
        toast.info(
          `Lightspeed sync queued with warnings: ${data.errors.join("; ")}`,
        );
      } else {
        toast.info("Lightspeed sync queued. Progress will update live.");
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["integration-detail"] }),
        queryClient.invalidateQueries({ queryKey: ["integrations-hub"] }),
      ]);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Lightspeed sync could not be started.";
      toast.error(message);
    },
  });

  const lightspeedSyncJobs = useMemo<TrackedLightspeedSyncJob[]>(() => {
    return lightspeedTrackedJobIds
      .map((jobId) => lightspeedJobRowsById[jobId])
      .filter((job): job is PosSyncJobRow => Boolean(job))
      .map((job) => ({
        ...job,
        normalizedSyncType: normalizeLightspeedJobSyncType(job.sync_type),
        progressPercent: calculateLightspeedJobProgress(job),
        isStale: isLightspeedJobStale(job),
        isTerminal: isTerminalLightspeedJobStatus(job.status),
      }))
      .sort((leftJob, rightJob) => {
        return (
          LIGHTSPEED_SYNC_ORDER.indexOf(leftJob.normalizedSyncType) -
          LIGHTSPEED_SYNC_ORDER.indexOf(rightJob.normalizedSyncType)
        );
      });
  }, [lightspeedTrackedJobIds, lightspeedJobRowsById]);

  const lightspeedSyncLogRows = useMemo(() => {
    const baseRows = lightspeedSyncLogsQuery.data?.rows ?? [];
    const mergedRows = new Map<string, LightspeedSyncLogRow>();

    for (const row of baseRows) {
      mergedRows.set(row.id, row);
    }

    for (const job of lightspeedSyncJobs) {
      mergedRows.set(job.id, normalizeLightspeedSyncLogRow(job));
    }

    return Array.from(mergedRows.values())
      .sort((left, right) => {
        return Date.parse(right.created_at) - Date.parse(left.created_at);
      })
      .slice(
        lightspeedDashboardOptions.syncLogs.page === 1
          ? 0
          : (lightspeedSyncLogsQuery.data?.rows.length ?? LIGHTSPEED_DASHBOARD_PAGE_SIZE),
      );
  }, [
    lightspeedDashboardOptions.syncLogs.page,
    lightspeedSyncJobs,
    lightspeedSyncLogsQuery.data?.rows,
  ]);

  const lightspeedDashboard = useMemo<LightspeedDashboardData | null>(() => {
    if (!isLightspeedDashboardEnabled) {
      return null;
    }

    return {
      customers: {
        rows: lightspeedCustomersQuery.data?.rows ?? [],
        pagination:
          lightspeedCustomersQuery.data?.pagination ?? buildLightspeedPagination(1, 0),
        isLoading: lightspeedCustomersQuery.isLoading,
        isFetching: lightspeedCustomersQuery.isFetching,
      },
      sales: {
        rows: lightspeedSalesQuery.data?.rows ?? [],
        pagination:
          lightspeedSalesQuery.data?.pagination ?? buildLightspeedPagination(1, 0),
        summary: lightspeedSalesSummaryQuery.data ?? {
          revenue: 0,
          averageOrderValue: 0,
          saleCount: 0,
        },
        isLoading:
          lightspeedSalesQuery.isLoading || lightspeedSalesSummaryQuery.isLoading,
        isFetching:
          lightspeedSalesQuery.isFetching || lightspeedSalesSummaryQuery.isFetching,
      },
      products: {
        rows: lightspeedProductsQuery.data?.rows ?? [],
        pagination:
          lightspeedProductsQuery.data?.pagination ?? buildLightspeedPagination(1, 0),
        categories: lightspeedProductCategoriesQuery.data ?? [],
        isLoading:
          lightspeedProductsQuery.isLoading || lightspeedProductCategoriesQuery.isLoading,
        isFetching:
          lightspeedProductsQuery.isFetching || lightspeedProductCategoriesQuery.isFetching,
      },
      syncLogs: {
        rows: lightspeedSyncLogRows,
        pagination:
          lightspeedSyncLogsQuery.data?.pagination ?? buildLightspeedPagination(1, 0),
        isLoading: lightspeedSyncLogsQuery.isLoading,
        isFetching: lightspeedSyncLogsQuery.isFetching,
      },
    };
  }, [
    isLightspeedDashboardEnabled,
    lightspeedCustomersQuery.data?.pagination,
    lightspeedCustomersQuery.data?.rows,
    lightspeedCustomersQuery.isFetching,
    lightspeedCustomersQuery.isLoading,
    lightspeedProductCategoriesQuery.data,
    lightspeedProductCategoriesQuery.isFetching,
    lightspeedProductCategoriesQuery.isLoading,
    lightspeedProductsQuery.data?.pagination,
    lightspeedProductsQuery.data?.rows,
    lightspeedProductsQuery.isFetching,
    lightspeedProductsQuery.isLoading,
    lightspeedSalesQuery.data?.pagination,
    lightspeedSalesQuery.data?.rows,
    lightspeedSalesQuery.isFetching,
    lightspeedSalesQuery.isLoading,
    lightspeedSalesSummaryQuery.data,
    lightspeedSalesSummaryQuery.isFetching,
    lightspeedSalesSummaryQuery.isLoading,
    lightspeedSyncLogRows,
    lightspeedSyncLogsQuery.data?.pagination,
    lightspeedSyncLogsQuery.isFetching,
    lightspeedSyncLogsQuery.isLoading,
  ]);

  const lightspeedActiveJobIds = useMemo(() => {
    return lightspeedSyncJobs
      .filter((job) => !job.isTerminal)
      .map((job) => job.id);
  }, [lightspeedSyncJobs]);

  const lightspeedSyncState: LightspeedSyncState = lightspeedSyncMutation.isPending
    ? "triggering"
    : lightspeedActiveJobIds.length > 0
      ? "syncing"
      : "idle";

  const lightspeedHasStaleJobs = useMemo(() => {
    return lightspeedSyncJobs.some((job) => job.isStale);
  }, [lightspeedSyncJobs]);

  useEffect(() => {
    if (!shouldToastLightspeedCompletion || lightspeedSyncJobs.length === 0) {
      return;
    }

    if (!lightspeedSyncJobs.every((job) => job.isTerminal)) {
      return;
    }

    const terminalSignature = lightspeedSyncJobs
      .map((job) => `${job.id}:${job.status}:${job.updated_at}`)
      .sort()
      .join("|");

    if (lastLightspeedTerminalToastRef.current === terminalSignature) {
      return;
    }

    lastLightspeedTerminalToastRef.current = terminalSignature;

    const failedJobs = lightspeedSyncJobs.filter(
      (job) => job.status === "failed" || job.status === "cancelled",
    );
    const insertedRows = lightspeedSyncJobs.reduce(
      (total, job) => total + (job.inserted_rows ?? job.processed_rows ?? 0),
      0,
    );

    if (failedJobs.length > 0) {
      toast.error(
        `Lightspeed sync finished with issues. ${failedJobs.length} of ${lightspeedSyncJobs.length} jobs failed.`,
      );
    } else {
      toast.success(
        `Lightspeed sync complete. ${insertedRows.toLocaleString()} records processed across ${lightspeedSyncJobs.length} jobs.`,
      );
    }

    setShouldToastLightspeedCompletion(false);

    void Promise.all([
      queryClient.invalidateQueries({ queryKey: ["integration-detail"] }),
      queryClient.invalidateQueries({ queryKey: ["integrations-hub"] }),
    ]);
  }, [lightspeedSyncJobs, queryClient, shouldToastLightspeedCompletion]);

  const metaReauthorizationMutation = useMutation({
    mutationFn: async () => {
      if (slug !== "meta") {
        throw new Error("Meta authorization is only available on the Meta detail page.");
      }

      await launchMetaAuthorizationFlow();
    },
    onSuccess: () => {
      toast.success("Meta authorization opened in a new tab.");
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Meta authorization could not be started.";
      toast.error(message);
    },
  });

  const metaAssetRefreshMutation = useMutation({
    mutationFn: async () => {
      if (slug !== "meta") {
        throw new Error("Meta asset refresh is only available on the Meta detail page.");
      }

      const { data, error } = await supabase.functions.invoke("sync-analytics");

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: async () => {
      toast.success("Meta asset refresh started.");

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["integration-detail"] }),
        queryClient.invalidateQueries({ queryKey: ["integrations-hub"] }),
      ]);
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Meta asset refresh could not be started.";
      toast.error(message);
    },
  });

  const ga4ConnectionTestMutation = useMutation({
    mutationFn: async () => {
      if (slug !== "google-analytics-4") {
        throw new Error("Connection testing is only available on the Google Analytics detail page.");
      }

      if (!resolved?.ga4Detail?.propertyId) {
        throw new Error("Connect Google Analytics before running a connection test.");
      }

      const { data, error } = await supabase.functions.invoke("ga-report-data", {
        body: {
          propertyId: resolved.ga4Detail.propertyId,
          dateRange: 7,
        },
      });

      if (error) {
        throw error;
      }

      if (!data?.success) {
        throw new Error("Google Analytics connection test failed.");
      }

      if (resolved.ga4Detail.connectionId) {
        const { error: updateError } = await supabase
          .from("google_analytics_settings")
          .update({ last_test_at: new Date().toISOString() })
          .eq("id", resolved.ga4Detail.connectionId)
          .eq("user_id", user?.id ?? "");

        if (updateError) {
          throw updateError;
        }
      }

      return data;
    },
    onSuccess: async () => {
      toast.success("Google Analytics connection test completed.");

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["integration-detail"] }),
        queryClient.invalidateQueries({ queryKey: ["integrations-hub"] }),
      ]);
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Google Analytics connection test failed.";
      toast.error(message);
    },
  });

  const ga4ReauthorizationMutation = useMutation({
    mutationFn: async () => {
      if (slug !== "google-analytics-4") {
        throw new Error("Reauthorization is only available on the Google Analytics detail page.");
      }

      if (!resolved?.ga4Detail?.propertyId) {
        throw new Error("A GA4 property ID is required before reauthorizing Google Analytics.");
      }

      const { data, error } = await supabase.functions.invoke("oauth-initiate", {
        body: { propertyId: resolved.ga4Detail.propertyId },
      });

      if (error) {
        throw error;
      }

      if (!data?.success || !data?.authUrl) {
        throw new Error("Unable to start Google Analytics authorization.");
      }

      window.location.href = data.authUrl;
    },
    onSuccess: () => {
      toast.success("Redirecting to Google Analytics authorization.");
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Google Analytics authorization could not be started.";
      toast.error(message);
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!resolved?.disconnectRef) {
        return;
      }

      if (!user?.id) {
        throw new Error("You must be signed in to disconnect an integration.");
      }

      if (
        (resolved.disconnectRef.kind === "square" ||
          resolved.disconnectRef.kind === "clover" ||
          resolved.disconnectRef.kind === "lightspeed") &&
        !isSuperAdmin
      ) {
        throw new Error(
          `Only site admins can disconnect ${resolved.disconnectRef.kind === "square" ? "Square" : resolved.disconnectRef.kind === "clover" ? "Clover" : "Lightspeed"}.`,
        );
      }

      switch (resolved.disconnectRef.kind) {
        case "square": {
          const { error } = await supabase
            .from("square_connections")
            .delete()
            .eq("id", resolved.disconnectRef.id)
            .eq("user_id", user.id)
            .eq("tenant_id", tenant?.id ?? "");

          if (error) throw error;
          return;
        }
        case "clover": {
          const { error } = await supabase
            .from("clover_connections")
            .delete()
            .eq("id", resolved.disconnectRef.id)
            .eq("user_id", user.id)
            .eq("tenant_id", tenant?.id ?? "");

          if (error) throw error;
          return;
        }
        case "lightspeed": {
          const { error } = await supabase
            .from("lightspeed_connections")
            .delete()
            .eq("id", resolved.disconnectRef.id)
            .eq("user_id", user.id)
            .eq("tenant_id", tenant?.id ?? "");

          if (error) throw error;
          return;
        }
        case "provider": {
          if (resolved.disconnectRef.provider === "constant_contact") {
            const { data, error } = await supabase.functions.invoke(
              "constant-contact-revoke-token",
            );

            if (error) throw error;
            if (data?.error) {
              throw new Error(data.error);
            }

            return;
          }

          if (
            resolved.disconnectRef.provider === "mailchimp" ||
            resolved.disconnectRef.provider === "klaviyo"
          ) {
            const { data, error } = await supabase.functions.invoke(
              "mailchimp-revoke-token",
              {
                body: { provider: resolved.disconnectRef.provider },
              },
            );

            if (error) throw error;
            if (data?.error) {
              throw new Error(data.message ?? "Disconnect failed.");
            }

            return;
          }

          const { error } = await supabase
            .from("provider_connections")
            .update({ status: "revoked", revoked_at: new Date().toISOString() })
            .eq("id", resolved.disconnectRef.id)
            .eq("user_id", user.id)
            .eq("tenant_id", tenant?.id ?? "");

          if (error) throw error;
          return;
        }
        case "meta": {
          const { error } = await supabase
            .from("social_connections")
            .delete()
            .in("id", resolved.disconnectRef.ids)
            .eq("user_id", user.id);

          if (error) throw error;
          return;
        }
        case "ga4": {
          const { error } = await supabase
            .from("google_analytics_settings")
            .delete()
            .eq("id", resolved.disconnectRef.id)
            .eq("user_id", user.id);

          if (error) throw error;
          return;
        }
      }
    },
    onSuccess: async () => {
      if (resolved?.item) {
        toast.success(`${resolved.item.name} disconnected.`);
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["integration-detail", slug] }),
        queryClient.invalidateQueries({ queryKey: ["integrations-hub"] }),
      ]);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Disconnect failed.";
      toast.error(message);
    },
  });

  return {
    isValidSlug: Boolean(seed),
    item: resolved?.item ?? null,
    model: resolved?.model ?? null,
    comingSoonDetail,
    squareDetail: resolved?.squareDetail ?? null,
    cloverDetail: resolved?.cloverDetail ?? null,
    lightspeedDetail: resolved?.lightspeedDetail ?? null,
    lightspeedDashboard,
    metaDetail: resolved?.metaDetail ?? null,
    ga4Detail: resolved?.ga4Detail ?? null,
    marketingImportDetail: resolved?.marketingImportDetail ?? null,
    emailInfrastructureDetail: resolved?.emailInfrastructureDetail ?? null,
    targetPath: resolved?.targetPath,
    requestPath: resolved?.requestPath,
    canUseActions:
      !isComingSoonIntegrationSlug(resolved?.item?.slug ?? null) && hasRole("member"),
    canDisconnect: Boolean(
      resolved?.model?.canDisconnect &&
        resolved?.disconnectRef &&
        (!["square", "clover", "lightspeed"].includes(resolved.disconnectRef.kind) ||
          isSuperAdmin),
    ),
    isLoading: Boolean(seed) && query.isLoading,
    isFetching: Boolean(seed) && query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    submitComingSoonInterest: comingSoonInterestMutation.mutateAsync,
    isSubmittingComingSoonInterest: comingSoonInterestMutation.isPending,
    runEmailInfrastructureHealthCheck:
      emailInfrastructureHealthCheckMutation.mutateAsync,
    isRunningEmailInfrastructureHealthCheck:
      emailInfrastructureHealthCheckMutation.isPending,
    triggerSquareSync: squareSyncMutation.mutateAsync,
    isSquareSyncing: squareSyncMutation.isPending,
    verifySquareWebhooks: verifySquareWebhooksMutation.mutateAsync,
    isVerifyingSquareWebhooks: verifySquareWebhooksMutation.isPending,
    triggerCloverSync: cloverSyncMutation.mutateAsync,
    isCloverSyncing: cloverSyncMutation.isPending,
    runCloverConnectionTest: cloverConnectionTestMutation.mutateAsync,
    isCloverConnectionTesting: cloverConnectionTestMutation.isPending,
    lightspeedSyncJobs,
    lightspeedActiveJobIds,
    lightspeedSyncState,
    lightspeedHasStaleJobs,
    triggerLightspeedSync: lightspeedSyncMutation.mutateAsync,
    isLightspeedSyncing: lightspeedSyncState !== "idle",
    triggerMetaReauthorization: metaReauthorizationMutation.mutateAsync,
    isMetaReauthorizing: metaReauthorizationMutation.isPending,
    refreshMetaAssets: metaAssetRefreshMutation.mutateAsync,
    isRefreshingMetaAssets: metaAssetRefreshMutation.isPending,
    triggerGa4ConnectionTest: ga4ConnectionTestMutation.mutateAsync,
    isGa4ConnectionTesting: ga4ConnectionTestMutation.isPending,
    triggerGa4Reauthorization: ga4ReauthorizationMutation.mutateAsync,
    isGa4Reauthorizing: ga4ReauthorizationMutation.isPending,
    disconnect: disconnectMutation.mutateAsync,
    isDisconnecting: disconnectMutation.isPending,
  };
}