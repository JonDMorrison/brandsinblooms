import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  buildIntegrationDetailModel,
  getUserFacingIntegrationError,
  summarizeUserFacingIntegrationWarnings,
  type IntegrationDetailModel,
  type IntegrationDetailRow,
  type IntegrationDetailTimelineEntry,
  type IntegrationDetailTone,
} from "@/components/integrations/integrationDetailModel";
import {
  getIntegrationSeed,
  type IntegrationDefinition,
  type IntegrationStatus,
} from "@/components/integrations/integrationsHubConfig";
import { formatCount } from "@/components/integrations/shared/dataTabPrimitives";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { isMailchimpImportJobActivelyRunning } from "@/hooks/mailchimpImportState";
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

const REQUIRED_SHOPIFY_WEBHOOK_EVENTS = [
  "customers/create",
  "customers/update",
  "orders/create",
  "orders/updated",
  "orders/paid",
  "orders/fulfilled",
  "orders/cancelled",
  "refunds/create",
  "products/create",
  "products/update",
  "app/uninstalled",
] as const;

const META_OAUTH_SCOPE =
  "pages_manage_posts,pages_read_engagement,pages_show_list,instagram_basic,instagram_content_publish,instagram_manage_insights,read_insights";

const COMING_SOON_INTEGRATION_SLUGS = [
  "hubspot",
  "zapier",
  "slack",
  "custom-webhooks",
] as const;

type ComingSoonIntegrationSlug = (typeof COMING_SOON_INTEGRATION_SLUGS)[number];

type ComingSoonContent = {
  statusLabel: string;
  statusTone: IntegrationDetailTone;
  availabilityLabel: string;
  description: string;
  metadata: string[];
  capabilities: string[];
  callout?: {
    tone: "info" | "warning";
    title: string;
    description: string;
  };
  notifyLabel: string;
  notifyConfirmation: string;
  requestLabel: string;
  payloadPreview?: {
    summary: string;
    content: string;
  };
};

export type ComingSoonDetailData = ComingSoonContent & {
  integrationName: string;
  notifyEmail: string | null;
  requestPath: string;
  isSubmitted: boolean;
};

const COMING_SOON_CONTENT: Record<
  ComingSoonIntegrationSlug,
  ComingSoonContent
> = {
  shopify: {
    statusLabel: "Coming soon",
    statusTone: "warning",
    availabilityLabel: "Planned ecommerce release",
    description:
      "The new first-class Shopify integration will replace the retired legacy flow and bring ecommerce activity fully into the shared BloomSuite integrations shell.",
    metadata: [
      "Category: POS Systems",
      "Scope: Products, orders, customers, and storefront data",
      "Availability: Planned release",
    ],
    capabilities: [
      "Sync Shopify products, orders, and customers into BloomSuite CRM",
      "Trigger automations on new orders, abandoned carts, and fulfillment events",
      "Import your Shopify customer base as a migration source",
      "Display Shopify products on BloomSuite-powered store pages",
    ],
    callout: {
      tone: "warning",
      title:
        "The legacy Shopify connection flow in BloomSuite has been retired.",
      description:
        "The new first-class Shopify integration is currently being built.",
    },
    notifyLabel: "Notify me when available",
    notifyConfirmation:
      "You're on the list. We'll notify you when Shopify is available.",
    requestLabel: "Request this integration →",
  },
  hubspot: {
    statusLabel: "Coming soon",
    statusTone: "warning",
    availabilityLabel: "Planned automation release",
    description:
      "HubSpot support is planned as a first-class CRM and automation integration within the shared BloomSuite detail-page shell.",
    metadata: [
      "Category: Automation",
      "Scope: CRM sync, imports, and lifecycle handoff",
      "Availability: Planned release",
    ],
    capabilities: [
      "Sync BloomSuite CRM contacts and customers into HubSpot",
      "Push BloomSuite automation events as HubSpot timeline activities",
      "Import HubSpot contacts into BloomSuite",
      "Bi-directional deal and lifecycle stage sync",
    ],
    notifyLabel: "Notify me when available",
    notifyConfirmation:
      "You're on the list. We'll notify you when HubSpot is available.",
    requestLabel: "Request this integration →",
  },
  zapier: {
    statusLabel: "In progress",
    statusTone: "warning",
    availabilityLabel: "Internal preview build",
    description:
      "Zapier is in active development and will become BloomSuite's no-code bridge to the broader app ecosystem.",
    metadata: [
      "Category: Automation",
      "Scope: Triggers, actions, and multi-step workflows",
      "Availability: In progress",
    ],
    capabilities: [
      "Trigger Zapier workflows from BloomSuite CRM events (new customer, purchase, loyalty join)",
      "Push data from 5,000+ Zapier-connected apps into BloomSuite contacts",
      "No-code automation across your full tool stack",
      "Multi-step Zap support with BloomSuite as trigger or action",
    ],
    callout: {
      tone: "info",
      title: "The Zapier integration is in active development.",
      description: "The documentation below describes planned functionality.",
    },
    notifyLabel: "Notify me when available",
    notifyConfirmation:
      "You're on the list. We'll notify you when Zapier is available.",
    requestLabel: "Request this integration →",
  },
  slack: {
    statusLabel: "Coming soon",
    statusTone: "warning",
    availabilityLabel: "Planned collaboration release",
    description:
      "Slack support is planned as BloomSuite's shared collaboration and alerting surface for operators and teams.",
    metadata: [
      "Category: Automation",
      "Scope: Alerts + workflow notifications",
      "Availability: Planned release",
    ],
    capabilities: [
      "Receive BloomSuite CRM notifications in designated Slack channels",
      "Alert your team when automations fire, syncs fail, or connections have issues",
      "Daily and weekly performance summaries delivered to Slack",
      "Custom alert rules based on thresholds (e.g. orders over GBP 500)",
    ],
    notifyLabel: "Notify me when available",
    notifyConfirmation:
      "You're on the list. We'll notify you when Slack is available.",
    requestLabel: "Request this integration →",
  },
  "custom-webhooks": {
    statusLabel: "Coming soon",
    statusTone: "warning",
    availabilityLabel: "Planned developer release",
    description:
      "Custom Webhooks are planned as BloomSuite's general-purpose outbound event delivery surface for external systems.",
    metadata: [
      "Category: Automation",
      "Scope: Outbound callbacks, payload templates, and delivery logs",
      "Availability: Planned release",
    ],
    capabilities: [
      "Send BloomSuite CRM events to any external system via HTTP POST",
      "Configure custom payload templates and authentication headers",
      "Monitor delivery logs and retry failed webhook calls automatically",
      "Webhook signing — verify requests originated from BloomSuite",
    ],
    notifyLabel: "Notify me when available",
    notifyConfirmation:
      "You're on the list. We'll notify you when Custom Webhooks is available.",
    requestLabel: "Request this integration →",
    payloadPreview: {
      summary: "Preview example payload",
      content: `{
  "event": "purchase.completed",
  "timestamp": "2026-03-01T14:30:00Z",
  "data": {
    "customer_email": "jane@example.com",
    "order_total": 4250,
    "currency": "GBP"
  }
}`,
    },
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
type ShopifyCustomerRow =
  Database["public"]["Tables"]["shopify_customers"]["Row"];
type ShopifyOrderRow = Database["public"]["Tables"]["shopify_orders"]["Row"];
type ShopifyProductRow =
  Database["public"]["Tables"]["shopify_products"]["Row"];
type SquareCustomerRow = Database["public"]["Tables"]["pos_customers"]["Row"];
type BaseSquareSaleRow = Database["public"]["Tables"]["pos_orders"]["Row"];
type SquareProductRow = Database["public"]["Tables"]["products"]["Row"];
type CloverConnectionTestRecord =
  Database["public"]["Tables"]["clover_connection_tests"]["Row"];

export type TrackedLightspeedSyncJob = PosSyncJobRow & {
  normalizedSyncType: "customers" | "sales" | "products" | "full";
  progressPercent: number;
  isStale: boolean;
  isTerminal: boolean;
};

export type LightspeedSyncState = "idle" | "triggering" | "syncing";

type LightspeedCustomerRow =
  Database["public"]["Tables"]["lightspeed_customers"]["Row"];
type BaseLightspeedSaleRow =
  Database["public"]["Tables"]["lightspeed_sales"]["Row"];
type LightspeedProductRow =
  Database["public"]["Tables"]["lightspeed_products"]["Row"];

export type LightspeedSortDirection = "asc" | "desc";
export type SquareCustomerSortField =
  | "name"
  | "email"
  | "updated_at"
  | "created_at";
export type SquareSalesSortField = "order_date" | "total_amount" | "status";
export type SquareProductsSortField =
  | "name"
  | "category"
  | "inventory_count"
  | "price";
export type LightspeedCustomerSortField =
  | "name"
  | "total_spend"
  | "purchase_count"
  | "last_purchase_date"
  | "synced_at";
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
    sortField?: LightspeedCustomerSortField | SquareCustomerSortField;
    sortDirection?: LightspeedSortDirection;
  };
  sales?: {
    page?: number;
    search?: string;
    status?: string;
    startDate?: string | null;
    endDate?: string | null;
    sortField?: LightspeedSalesSortField | SquareSalesSortField;
    sortDirection?: LightspeedSortDirection;
  };
  products?: {
    page?: number;
    search?: string;
    category?: string;
    categories?: string[];
    inStockOnly?: boolean;
    sortField?: LightspeedProductsSortField | SquareProductsSortField;
    sortDirection?: LightspeedSortDirection;
  };
  syncLogs?: {
    page?: number;
    status?: string;
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

export type LightspeedSaleRow = BaseLightspeedSaleRow & {
  customerDisplayName: string | null;
  lineItemCount: number;
};

export type LightspeedSalesSummary = {
  revenue: number;
  averageOrderValue: number;
  saleCount: number;
};

export type LightspeedProductStockState = "out" | "low" | "healthy" | "unknown";

export type LightspeedProductTableRow = LightspeedProductRow & {
  stockState: LightspeedProductStockState;
  normalizedTags: string[];
};

export type LightspeedSyncLogRow = PosSyncJobRow & {
  normalizedSyncType: "customers" | "sales" | "products" | "full";
  progressPercent: number;
  isStale: boolean;
  isTerminal: boolean;
};

export type SquareCustomerTableRow = SquareCustomerRow & {
  displayName: string;
  normalizedTags: string[];
};

export type SquareSaleRow = BaseSquareSaleRow & {
  customerDisplayName: string | null;
  lineItemCount: number;
  orderType: string | null;
  automationFired: boolean;
};

export type SquareSalesSummary = {
  revenue: number;
  averageOrderValue: number;
  saleCount: number;
};

export type SquareProductTableRow = SquareProductRow & {
  stockState: LightspeedProductStockState;
  normalizedTags: string[];
};

export type SquareSyncLogRow = LightspeedSyncLogRow;

export type ShopifyCustomerSortField =
  | "name"
  | "email"
  | "orders_count"
  | "total_spent"
  | "last_order_date"
  | "synced_at";
export type ShopifyOrdersSortField =
  | "order_date"
  | "total_price"
  | "financial_status"
  | "fulfillment_status";
export type ShopifyProductsSortField =
  | "title"
  | "vendor"
  | "product_type"
  | "inventory_quantity"
  | "updated_at";

export type ShopifyCustomerTableRow = ShopifyCustomerRow & {
  displayName: string;
  normalizedTags: string[];
};

export type ShopifyOrderTableRow = ShopifyOrderRow & {
  customerDisplayName: string | null;
  lineItemCount: number;
};

export type ShopifySalesSummary = {
  revenue: number;
  averageOrderValue: number;
  saleCount: number;
};

export type ShopifyProductTableRow = ShopifyProductRow & {
  normalizedTags: string[];
  imageCount: number;
  variantCount: number;
  stockState: LightspeedProductStockState;
};

export type ShopifySyncLogRow = PosSyncJobRow & {
  normalizedSyncType: "customers" | "orders" | "products" | "full";
  progressPercent: number;
  isStale: boolean;
  isTerminal: boolean;
};

export type ShopifyDashboardData = {
  customers: {
    rows: ShopifyCustomerTableRow[];
    pagination: LightspeedPagination;
    isLoading: boolean;
    isFetching: boolean;
  };
  orders: {
    rows: ShopifyOrderTableRow[];
    pagination: LightspeedPagination;
    summary: ShopifySalesSummary;
    isLoading: boolean;
    isFetching: boolean;
  };
  products: {
    rows: ShopifyProductTableRow[];
    pagination: LightspeedPagination;
    categories: string[];
    isLoading: boolean;
    isFetching: boolean;
  };
  syncLogs: {
    rows: ShopifySyncLogRow[];
    pagination: LightspeedPagination;
    isLoading: boolean;
    isFetching: boolean;
  };
};

export type CloverCustomerTableRow = SquareCustomerRow & {
  displayName: string;
  normalizedTags: string[];
};

export type CloverSaleRow = BaseSquareSaleRow & {
  customerDisplayName: string | null;
  lineItemCount: number;
  orderType: string | null;
};

export type CloverSalesSummary = {
  revenue: number;
  averageOrderValue: number;
  saleCount: number;
};

export type CloverProductTableRow = SquareProductRow & {
  stockState: LightspeedProductStockState;
  normalizedTags: string[];
};

export type CloverSyncLogRow = LightspeedSyncLogRow;

export type CloverConnectionTestEndpointResult = {
  success: boolean;
  count?: number;
  samples?: Json[];
  data?: Json;
  error?: string;
  timing_ms: number;
  status_code?: number;
};

export type CloverConnectionTestReport = {
  status: "success" | "partial" | "failed";
  summary: string;
  duration_ms: number;
  results: {
    merchant: CloverConnectionTestEndpointResult;
    employees: CloverConnectionTestEndpointResult;
    customers: CloverConnectionTestEndpointResult;
    inventory: CloverConnectionTestEndpointResult;
    orders: CloverConnectionTestEndpointResult;
    payments: CloverConnectionTestEndpointResult;
  };
  counts: {
    employees: number;
    customers: number;
    items: number;
    orders_last_30d: number;
    payments_last_30d: number;
  };
  errors: Array<{ endpoint: string; code: string; message: string }>;
};

export type CloverConnectionTestHistoryRow = CloverConnectionTestRecord & {
  report: CloverConnectionTestReport;
};

export type CloverDashboardData = {
  customers: {
    rows: CloverCustomerTableRow[];
    pagination: LightspeedPagination;
    isLoading: boolean;
    isFetching: boolean;
  };
  sales: {
    rows: CloverSaleRow[];
    pagination: LightspeedPagination;
    summary: CloverSalesSummary;
    isLoading: boolean;
    isFetching: boolean;
  };
  products: {
    rows: CloverProductTableRow[];
    pagination: LightspeedPagination;
    categories: string[];
    isLoading: boolean;
    isFetching: boolean;
  };
  syncLogs: {
    rows: CloverSyncLogRow[];
    pagination: LightspeedPagination;
    isLoading: boolean;
    isFetching: boolean;
  };
  connectionTests: {
    rows: CloverConnectionTestHistoryRow[];
    latestReport: CloverConnectionTestReport | null;
    latestTestedAt: string | null;
    pagination: LightspeedPagination;
    isLoading: boolean;
    isFetching: boolean;
  };
};

export type SquareDashboardData = {
  customers: {
    rows: SquareCustomerTableRow[];
    pagination: LightspeedPagination;
    isLoading: boolean;
    isFetching: boolean;
  };
  sales: {
    rows: SquareSaleRow[];
    pagination: LightspeedPagination;
    summary: SquareSalesSummary;
    isLoading: boolean;
    isFetching: boolean;
  };
  products: {
    rows: SquareProductTableRow[];
    pagination: LightspeedPagination;
    categories: string[];
    isLoading: boolean;
    isFetching: boolean;
  };
  syncLogs: {
    rows: SquareSyncLogRow[];
    pagination: LightspeedPagination;
    isLoading: boolean;
    isFetching: boolean;
  };
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

const LIGHTSPEED_ACTIVE_JOB_STATUSES = [
  "pending",
  "in_progress",
  "delayed",
] as const;
const LIGHTSPEED_SYNC_ORDER = [
  "customers",
  "sales",
  "products",
  "full",
] as const;
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

function normalizeShopifyJobSyncType(
  syncType: PosSyncJobRow["sync_type"] | string,
): "customers" | "orders" | "products" | "full" {
  if (syncType === "orders" || syncType === "sales") {
    return "orders";
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
  return (
    status === "completed" || status === "failed" || status === "cancelled"
  );
}

function getLightspeedJobActivityTimestamp(job: PosSyncJobRow) {
  return (
    job.last_progress_at ?? job.updated_at ?? job.started_at ?? job.created_at
  );
}

function calculateLightspeedJobProgress(job: PosSyncJobRow) {
  if (job.status === "completed") {
    return 100;
  }

  const estimatedRows =
    typeof job.estimated_rows === "number" ? job.estimated_rows : null;
  const totalPagesEstimate =
    typeof job.total_pages_est === "number" ? job.total_pages_est : null;
  const processedRows = Math.max(
    job.processed_rows ?? 0,
    job.inserted_rows ?? 0,
    job.fetched_rows ?? 0,
  );

  if (estimatedRows && estimatedRows > 0) {
    const rawProgress = Math.round((processedRows / estimatedRows) * 100);
    return Math.max(
      job.status === "in_progress" ? 5 : 0,
      Math.min(99, rawProgress),
    );
  }

  if (totalPagesEstimate && totalPagesEstimate > 0) {
    const rawProgress = Math.round(
      ((job.current_page ?? 0) / totalPagesEstimate) * 100,
    );
    return Math.max(
      job.status === "in_progress" ? 5 : 0,
      Math.min(99, rawProgress),
    );
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

function getLightspeedPageRange(
  page: number,
  pageSize = LIGHTSPEED_DASHBOARD_PAGE_SIZE,
) {
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

function formatSquareCustomerName(
  name?: string | null,
  email?: string | null,
  customerId?: string | null,
) {
  if (name?.trim()) {
    return name.trim();
  }

  return email?.trim() || customerId || "Unnamed customer";
}

function formatShopifyCustomerName(
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

function getSquareOrderType(order: BaseSquareSaleRow) {
  if (order.fulfillment_type?.trim()) {
    return order.fulfillment_type.trim();
  }

  if (order.fulfillment_state?.trim()) {
    return order.fulfillment_state.trim();
  }

  if (
    order.raw_data &&
    typeof order.raw_data === "object" &&
    !Array.isArray(order.raw_data)
  ) {
    const rawData = order.raw_data as Record<string, unknown>;
    const candidate = [rawData.order_type, rawData.orderType].find(
      (value) => typeof value === "string" && value.trim().length > 0,
    );

    return typeof candidate === "string" ? candidate.trim() : null;
  }

  return null;
}

function hasSquareAutomationFired(rawData: Json | null | undefined) {
  if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) {
    return false;
  }

  const source = rawData as Record<string, unknown>;
  const markers = [
    source.triggers_fired,
    source.triggersFired,
    source.automation_fired,
    source.automationFired,
  ];

  return markers.some((value) => {
    if (Array.isArray(value)) {
      return value.length > 0;
    }

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      return value > 0;
    }

    if (typeof value === "string") {
      return value.trim().length > 0;
    }

    return false;
  });
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

function normalizeLightspeedSyncLogRow(
  job: PosSyncJobRow,
): LightspeedSyncLogRow {
  return {
    ...job,
    normalizedSyncType: normalizeLightspeedJobSyncType(job.sync_type),
    progressPercent: calculateLightspeedJobProgress(job),
    isStale: isLightspeedJobStale(job),
    isTerminal: isTerminalLightspeedJobStatus(job.status),
  };
}

function normalizeShopifySyncLogRow(job: PosSyncJobRow): ShopifySyncLogRow {
  return {
    ...job,
    normalizedSyncType: normalizeShopifyJobSyncType(job.sync_type),
    progressPercent: calculateLightspeedJobProgress(job),
    isStale: isLightspeedJobStale(job),
    isTerminal: isTerminalLightspeedJobStatus(job.status),
  };
}

function getJsonArrayLength(value: Json | null | undefined) {
  return Array.isArray(value) ? value.length : 0;
}

function normalizeJsonStringList(value: Json | null | undefined) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .flatMap((entry) => {
      if (typeof entry === "string") {
        return [entry.trim()];
      }

      if (entry && typeof entry === "object") {
        const namedEntry = entry as {
          name?: unknown;
          label?: unknown;
          value?: unknown;
        };
        const candidate = [
          namedEntry.name,
          namedEntry.label,
          namedEntry.value,
        ].find((item) => typeof item === "string" && item.trim().length > 0);

        return typeof candidate === "string" ? [candidate.trim()] : [];
      }

      return [];
    })
    .filter(
      (entry, index, allEntries) =>
        Boolean(entry) && allEntries.indexOf(entry) === index,
    );
}

function isJsonRecord(
  value: Json | null | undefined,
): value is Record<string, Json> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeCloverTestStatus(
  status?: string | null,
): "success" | "partial" | "failed" {
  if (status === "success" || status === "partial") {
    return status;
  }

  return "failed";
}

function parseCloverEndpointResult(
  value: Json | null | undefined,
): CloverConnectionTestEndpointResult {
  if (!isJsonRecord(value)) {
    return {
      success: false,
      error: "No result recorded",
      timing_ms: 0,
    };
  }

  return {
    success: Boolean(value.success),
    count: typeof value.count === "number" ? value.count : undefined,
    samples: Array.isArray(value.samples) ? value.samples : undefined,
    data: value.data,
    error: typeof value.error === "string" ? value.error : undefined,
    timing_ms: typeof value.timing_ms === "number" ? value.timing_ms : 0,
    status_code:
      typeof value.status_code === "number" ? value.status_code : undefined,
  };
}

function parseCloverTestCounts(value: Json | null | undefined) {
  const source = isJsonRecord(value) ? value : {};

  return {
    employees: typeof source.employees === "number" ? source.employees : 0,
    customers: typeof source.customers === "number" ? source.customers : 0,
    items: typeof source.items === "number" ? source.items : 0,
    orders_last_30d:
      typeof source.orders_last_30d === "number" ? source.orders_last_30d : 0,
    payments_last_30d:
      typeof source.payments_last_30d === "number"
        ? source.payments_last_30d
        : 0,
  };
}

function parseCloverTestErrors(value: Json | null | undefined) {
  if (!Array.isArray(value)) {
    return [] as Array<{ endpoint: string; code: string; message: string }>;
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return [];
    }

    const candidate = entry as Record<string, unknown>;

    return [
      {
        endpoint:
          typeof candidate.endpoint === "string"
            ? candidate.endpoint
            : "unknown",
        code: typeof candidate.code === "string" ? candidate.code : "ERROR",
        message:
          typeof candidate.message === "string"
            ? candidate.message
            : "Unknown Clover test error",
      },
    ];
  });
}

function parseCloverConnectionTestReport(
  row: CloverConnectionTestRecord,
): CloverConnectionTestReport {
  const results = isJsonRecord(row.raw_results) ? row.raw_results : {};

  return {
    status: normalizeCloverTestStatus(row.status),
    summary: row.summary ?? "Clover connection test completed.",
    duration_ms: row.duration_ms ?? 0,
    results: {
      merchant: parseCloverEndpointResult(results.merchant),
      employees: parseCloverEndpointResult(results.employees),
      customers: parseCloverEndpointResult(results.customers),
      inventory: parseCloverEndpointResult(results.inventory),
      orders: parseCloverEndpointResult(results.orders),
      payments: parseCloverEndpointResult(results.payments),
    },
    counts: parseCloverTestCounts(row.counts),
    errors: parseCloverTestErrors(row.errors),
  };
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
  active: boolean;
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
  totalAssetCount: number;
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
  tenant_id: string;
  property_id: string;
  property_name: string | null;
  measurement_id: string | null;
  google_account_email: string | null;
  connection_status: string;
  service_account_configured: boolean;
  last_pull_at: string | null;
  last_test_at: string | null;
  last_test_status: string | null;
  last_test_message: string | null;
  created_at: string;
  updated_at: string;
};

export type Ga4ConnectionTestResult = {
  status: "success" | "error" | "idle";
  title: string;
  message: string;
  checkedAt: string | null;
};

export type Ga4DetailData = {
  connectionId: string | null;
  tenantId: string | null;
  propertyId: string | null;
  propertyName: string | null;
  propertyLabel: string;
  measurementId: string | null;
  googleAccountEmail: string | null;
  connectionStatus:
    | "connected"
    | "authorizing"
    | "error"
    | "not-connected"
    | string;
  connectionLabel: string;
  authorizationLabel: string;
  serviceAccountConfigured: boolean;
  readPermissionsConfirmed: boolean;
  reportingStatus: string;
  lastPullAt: string | null;
  lastTestAt: string | null;
  lastTestStatus: "success" | "error" | "idle";
  lastTestMessage: string | null;
  latestConnectionTest: Ga4ConnectionTestResult;
  connectedAt: string | null;
  updatedAt: string | null;
  reportingPath: string;
  managementPath: string;
  analyticsUrl: string;
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

type MarketingImportReportSummary = {
  contactsImported: number;
  contactsSkipped: number;
  contactsFailed: number;
  segmentsCreated: number;
  tagsCreated: number;
  consentsRecorded: number;
  errors: string[];
  batchesProcessed: number;
};

type MarketingImportHistoryEntry = {
  id: string;
  startedAt: string | null;
  completedAt: string | null;
  status: string;
  contactsImported: number;
  segmentsCreated: number;
  errorCount: number;
  durationSeconds: number | null;
};

type MarketingImportFieldRow = {
  label: string;
  value: string;
  description?: string;
  tone?: IntegrationDetailTone;
  valueClassName?: string;
  copyValue?: string | null;
  copyLabel?: string;
};

type MarketingImportStatePresentation = {
  label: string;
  subtitle: string;
  tone: IntegrationDetailTone;
  valueClassName: string;
};

type MarketingImportDangerZone = {
  title: string;
  description: string;
  confirmDescription: string;
  bullets: string[];
  safetyNote: string;
};

export type MarketingImportDetailData = {
  provider: MarketingProviderKey;
  providerSlug: "mailchimp" | "klaviyo" | "constant-contact";
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
  latestImportReport: MarketingImportReportSummary | null;
  latestCompletedImport: MarketingImportHistoryEntry | null;
  importHistory: MarketingImportHistoryEntry[];
  latestImportLabel: string;
  latestImportTone: IntegrationDetailTone;
  contactsImportedAllTime: number;
  importJobCount: number;
  hasRunningImport: boolean;
  runningImportId: string | null;
  importFlowPath: string;
  previewListsPath: string;
  purposeLabel: string;
  liveSyncLabel: string;
  importOnlyLabel: string;
  connectionState: MarketingImportStatePresentation;
  authorizationLabel: string;
  authorizationSummary: string;
  authorizationModelLabel: string;
  healthRows: {
    authorization: IntegrationDetailRow[];
    importHistory: IntegrationDetailRow[];
  };
  timeline: IntegrationDetailTimelineEntry[];
  connectionDetailsRows: MarketingImportFieldRow[];
  capabilityRows: MarketingImportFieldRow[];
  capabilitiesNote: string | null;
  supportsRevokeToken: boolean;
  supportsValidateConnection: boolean;
  dangerZone: MarketingImportDangerZone;
  capabilities: string[];
  canDisconnect: boolean;
};

type EmailInfrastructureDomainRecord = {
  id: string;
  domain: string;
  status: string;
  created_at: string | null;
  updated_at: string | null;
  env: string | null;
  is_sandbox: boolean | null;
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
  verificationState: "verified" | "incorrect" | "missing" | "not-configured";
  statusLabel: string;
  statusTone: IntegrationDetailTone;
  statusReason: string;
  lastCheckedAt: string | null;
};

type EmailInfrastructureFieldRow = {
  label: string;
  value: string;
  description?: string;
  tone?: IntegrationDetailTone;
  copyValue?: string | null;
  copyLabel?: string;
};

type EmailInfrastructureSetupTool = {
  label: string;
  description: string;
  path: string;
  tone?: IntegrationDetailTone;
};

export type EmailInfrastructureDetailData = {
  badgeLabel: string;
  badgeTone: IntegrationDetailTone;
  metadata: string[];
  primaryDomainId: string | null;
  primaryDomain: string | null;
  primaryStatus: string;
  primaryStatusLabel: string;
  environmentLabel: string;
  isSandbox: boolean;
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
  banner: {
    tone: "info" | "warning";
    title: string;
    description: string;
  } | null;
  readinessSummary: string;
  configurationSummary: string;
  healthSummary: string;
  domainConnectSummary: string;
  healthRows: {
    domain: IntegrationDetailRow[];
    dnsHealth: IntegrationDetailRow[];
    sendingHealth: IntegrationDetailRow[];
  };
  configurationRows: EmailInfrastructureFieldRow[];
  protocolRows: EmailInfrastructureFieldRow[];
  setupToolRows: EmailInfrastructureSetupTool[];
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
  shopifyConnection?: {
    id: string;
    shop_domain: string;
    shop_name: string | null;
    shop_owner: string | null;
    shop_email: string | null;
    scope: string | null;
    status: string | null;
    connected_at: string | null;
    last_synced_at: string | null;
    last_customer_sync: string | null;
    last_sales_sync: string | null;
    last_product_sync: string | null;
    last_webhook_received_at: string | null;
    customers_synced: number | null;
    sales_synced: number | null;
    products_synced: number | null;
    webhooks_subscribed: boolean | null;
    webhook_subscription_ids: string[] | null;
    webhooks_last_checked_at: string | null;
    webhook_retry_count: number | null;
    webhook_next_retry_at: string | null;
    webhook_last_error: string | null;
    updated_at: string;
  } | null;
  shopifyDashboard?: ShopifyDashboardData | null;
  squareConnection?: SquareConnectionRecord | null;
  squareDetail?: SquareDetailData;
  squareDashboard?: SquareDashboardData;
  cloverConnection?: CloverConnectionRecord | null;
  cloverDetail?: CloverDetailData;
  cloverDashboard?: CloverDashboardData;
  lightspeedConnection?: LightspeedConnectionRecord | null;
  lightspeedDetail?: LightspeedDetailData;
  metaConnections?: MetaConnectionRecord[] | null;
  metaDetail?: MetaDetailData;
  ga4Detail?: Ga4DetailData;
  marketingImportDetail?: MarketingImportDetailData;
  emailInfrastructureDetail?: EmailInfrastructureDetailData;
  lightspeedDashboard?: LightspeedDashboardData;
  disconnectRef?:
    | {
        kind: "square" | "clover" | "lightspeed" | "shopify" | "ga4";
        id: string;
      }
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
    integrationName: seed.name,
    notifyEmail,
    requestPath: buildComingSoonRequestPath(seed.name),
    isSubmitted,
  };
}

const MARKETING_PROVIDER_META: Record<
  MarketingProviderKey,
  {
    label: string;
    slug: "mailchimp" | "klaviyo" | "constant-contact";
    description: string;
    capabilities: string[];
    authorizationModelLabel: string;
    supportsRevokeToken: boolean;
    supportsValidateConnection: boolean;
  }
> = {
  mailchimp: {
    label: "Mailchimp",
    slug: "mailchimp",
    description:
      "Import contacts, lists, segments, tags, and consent data from Mailchimp.",
    capabilities: [
      "Import contacts and consent data into BloomSuite CRM",
      "Bring Mailchimp lists and audiences into import planning",
      "Import Mailchimp segments as BloomSuite CRM segments",
      "Preserve tags, groups, and interests during migration",
    ],
    authorizationModelLabel: "OAuth authorization",
    supportsRevokeToken: true,
    supportsValidateConnection: false,
  },
  klaviyo: {
    label: "Klaviyo",
    slug: "klaviyo",
    description: "Import lists and audience structure from Klaviyo.",
    capabilities: [
      "Preview available lists before importing",
      "Start one-time contact imports into BloomSuite",
      "Retain imported audience groupings for CRM review",
    ],
    authorizationModelLabel: "API key connection",
    supportsRevokeToken: false,
    supportsValidateConnection: true,
  },
  constant_contact: {
    label: "Constant Contact",
    slug: "constant-contact",
    description: "Import contact lists from Constant Contact.",
    capabilities: [
      "Preview available contact lists before importing",
      "Start one-time contact imports into BloomSuite",
      "Reuse the existing migration wizard without enabling live sync",
    ],
    authorizationModelLabel: "OAuth authorization",
    supportsRevokeToken: true,
    supportsValidateConnection: false,
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

function getMetadataText(metadata: unknown, keys: string[]) {
  const source = asObject(metadata);

  if (!source) {
    return null;
  }

  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
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

function getImportReportErrors(report: unknown) {
  const errors = asObject(report)?.errors;

  if (!Array.isArray(errors)) {
    return [];
  }

  return errors.filter((error): error is string => typeof error === "string");
}

function buildMarketingImportReportSummary(
  report: unknown,
): MarketingImportReportSummary | null {
  const source = asObject(report);

  if (!source) {
    return null;
  }

  return {
    contactsImported: getImportReportCount(report, "contacts_imported") ?? 0,
    contactsSkipped: getImportReportCount(report, "contacts_skipped") ?? 0,
    contactsFailed: getImportReportCount(report, "contacts_failed") ?? 0,
    segmentsCreated: getImportReportCount(report, "segments_created") ?? 0,
    tagsCreated: getImportReportCount(report, "tags_created") ?? 0,
    consentsRecorded: getImportReportCount(report, "consents_recorded") ?? 0,
    errors: getImportReportErrors(report),
    batchesProcessed: getImportReportCount(report, "batches_processed") ?? 0,
  };
}

function isCompletedMarketingImportJob(job: ImportJobRecord) {
  return job.status?.trim().toLowerCase() === "completed";
}

function getMarketingImportDurationSeconds(
  startedAt?: string | null,
  completedAt?: string | null,
  fallbackStart?: string | null,
) {
  if (!completedAt) {
    return null;
  }

  const startValue = startedAt ?? fallbackStart;
  if (!startValue) {
    return null;
  }

  const startedTime = new Date(startValue).getTime();
  const completedTime = new Date(completedAt).getTime();

  if (Number.isNaN(startedTime) || Number.isNaN(completedTime)) {
    return null;
  }

  return Math.max(0, Math.floor((completedTime - startedTime) / 1000));
}

function buildMarketingImportHistoryEntry(
  job: ImportJobRecord,
): MarketingImportHistoryEntry {
  const report = buildMarketingImportReportSummary(job.report);
  const startedAt = job.created_at;

  return {
    id: job.id,
    startedAt,
    completedAt: job.completed_at,
    status: job.status,
    contactsImported: report?.contactsImported ?? 0,
    segmentsCreated: report?.segmentsCreated ?? 0,
    errorCount: report?.errors.length ?? 0,
    durationSeconds: getMarketingImportDurationSeconds(
      startedAt,
      job.completed_at,
      job.created_at,
    ),
  };
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

function sumImportReportCount(importJobs: ImportJobRecord[], key: string) {
  return importJobs.reduce((total, job) => {
    const value = getImportReportCount(job.report, key);
    return total + (value ?? 0);
  }, 0);
}

function formatMarketingImportStatusLabel(status?: string | null) {
  if (!status) {
    return "Not started";
  }

  switch (status.trim().toLowerCase()) {
    case "completed":
      return "Completed";
    case "running":
    case "processing":
    case "in_progress":
      return "Running";
    case "paused":
      return "Paused";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    case "queued":
    case "pending":
      return "Queued";
    default:
      return status
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
  }
}

function getMarketingImportStatusTone(
  status?: string | null,
): IntegrationDetailTone {
  switch (status?.trim().toLowerCase()) {
    case "completed":
      return "success";
    case "failed":
      return "danger";
    case "paused":
      return "neutral";
    case "queued":
    case "pending":
    case "running":
    case "processing":
    case "in_progress":
      return "warning";
    default:
      return "neutral";
  }
}

function getMarketingImportConnectionState(
  provider: MarketingProviderKey,
  connection: MarketingProviderConnectionRecord | null,
): MarketingImportStatePresentation {
  if (provider === "mailchimp") {
    switch (connection?.status?.trim().toLowerCase()) {
      case "connected":
        return {
          label: "Connected",
          subtitle:
            "Mailchimp authorization is active for previews and one-time or periodic imports.",
          tone: "success",
          valueClassName: "text-emerald-600",
        };
      case "expired":
        return {
          label: "Expired",
          subtitle:
            "The saved Mailchimp authorization has expired. Reconnect to restore previews and imports.",
          tone: "danger",
          valueClassName: "text-rose-600",
        };
      case "revoked":
        return {
          label: "Revoked",
          subtitle:
            "Mailchimp access was revoked. Connect Mailchimp again to restore previews and imports.",
          tone: "warning",
          valueClassName: "text-amber-600",
        };
      case "error":
        return {
          label: "Error",
          subtitle:
            "BloomSuite could not validate the stored Mailchimp authorization. Reconnect to continue.",
          tone: "danger",
          valueClassName: "text-rose-600",
        };
      case "pending":
        return {
          label: "Pending",
          subtitle: "Mailchimp authorization is in progress.",
          tone: "neutral",
          valueClassName: "text-slate-600",
        };
      default:
        return {
          label: "Not Connected",
          subtitle:
            "Connect Mailchimp to authorize previews and one-time contact imports.",
          tone: "neutral",
          valueClassName: "text-slate-600",
        };
    }
  }

  if (connection?.status === "connected") {
    return {
      label: provider === "klaviyo" ? "Validated" : "Connected",
      subtitle:
        provider === "klaviyo"
          ? "Stored credential is ready for list previews and one-time imports"
          : "Stored authorization is ready for list previews and one-time imports",
      tone: "success",
      valueClassName: "text-emerald-600",
    };
  }

  if (connection) {
    return {
      label: provider === "klaviyo" ? "Action required" : "Reconnect required",
      subtitle:
        provider === "klaviyo"
          ? "Connect Klaviyo to validate the stored credential before importing"
          : "Reconnect this provider before starting new previews or imports.",
      tone: "warning",
      valueClassName: "text-amber-600",
    };
  }

  return {
    label: "Not connected",
    subtitle:
      provider === "klaviyo"
        ? "Connect Klaviyo to validate the stored credential before importing"
        : "Connect this provider to authorize previews and one-time imports",
    tone: "warning",
    valueClassName: "text-amber-600",
  };
}

function buildMarketingImportCapabilityRows(
  provider: MarketingProviderKey,
  listCount: number,
  segmentCount: number,
): MarketingImportFieldRow[] {
  if (provider === "mailchimp") {
    return [
      {
        label: "Contacts",
        value: "Available to import",
        description: "Mailchimp contacts can be imported into BloomSuite CRM.",
        tone: "success",
      },
      {
        label: "Tags",
        value: "Available to import",
        description: "Mailchimp tags are preserved during the import flow.",
        tone: "success",
      },
      {
        label: "Lists & Audiences",
        value: "Available to import",
        description:
          listCount > 0
            ? `${formatCount(listCount)} cached list${listCount === 1 ? "" : "s"} available for preview and import.`
            : "Preview lists to cache Mailchimp audience metadata.",
        tone: "success",
      },
      {
        label: "Segments",
        value: "Available to import",
        description:
          segmentCount > 0
            ? `${formatCount(segmentCount)} cached segment${segmentCount === 1 ? "" : "s"} ready for import planning.`
            : "Segments are imported as BloomSuite CRM segments when selected.",
        tone: "success",
      },
      {
        label: "Consent status",
        value: "Available to import",
        description:
          "Mailchimp email consent state can be carried with imported contacts.",
        tone: "success",
      },
      {
        label: "Groups / Interests",
        value: "Available to import",
        description:
          "Mailchimp groups and interests can be preserved as part of the migration surface.",
        tone: "success",
      },
      {
        label: "Live sync",
        value: "Not available",
        description:
          "Mailchimp is available for one-time or periodic import, not live two-way sync.",
        tone: "neutral",
        valueClassName: "text-slate-600",
      },
    ];
  }

  if (provider === "klaviyo") {
    return [
      {
        label: "Profiles",
        value: "Available",
        description:
          "One-time profile imports are available through the existing migration wizard.",
        tone: "success",
      },
      {
        label: "Lists and Segments",
        value: `${formatCount(listCount)} lists • ${formatCount(segmentCount)} segments`,
        description:
          "Preview lists to refresh cached audience structure before importing.",
        tone: listCount > 0 || segmentCount > 0 ? "success" : "neutral",
      },
      {
        label: "SMS Consent",
        value: "Supported",
        description:
          "Klaviyo SMS consent can be imported alongside profile data when present.",
        tone: "success",
      },
    ];
  }

  return [
    {
      label: "Contact Lists",
      value: formatCount(listCount),
      description:
        listCount > 0
          ? "Constant Contact lists are available for preview and import planning."
          : "Preview lists to cache Constant Contact list metadata.",
      tone: listCount > 0 ? "success" : "neutral",
    },
    {
      label: "Event Registrations",
      value: "Unavailable",
      description:
        "Event registration data is not imported from Constant Contact in this workflow.",
      tone: "neutral",
      valueClassName: "text-slate-600",
    },
    {
      label: "Survey Responses",
      value: "Unavailable",
      description:
        "Survey response data is not imported from Constant Contact in this workflow.",
      tone: "neutral",
      valueClassName: "text-slate-600",
    },
  ];
}

function buildMarketingImportDangerZone(
  provider: MarketingProviderKey,
  providerLabel: string,
  authorizationModelLabel: string,
): MarketingImportDangerZone {
  if (provider === "mailchimp") {
    return {
      title: "Disconnect Mailchimp",
      description:
        "Remove BloomSuite's access to your Mailchimp account and stop future Mailchimp imports.",
      confirmDescription:
        "Disconnecting Mailchimp revokes the saved authorization, clears cached list and segment data, and prevents future previews or imports until Mailchimp is connected again.",
      bullets: [
        "Remove BloomSuite's access to your Mailchimp account",
        "Prevent future imports from Mailchimp",
        "Clear cached list and segment data",
      ],
      safetyNote:
        "Previously imported contacts remain in your BloomSuite CRM. Your Mailchimp account is not affected.",
    };
  }

  const revokeLabel =
    provider === "klaviyo"
      ? "stored credential"
      : authorizationModelLabel.toLowerCase();

  return {
    title: `Disconnect ${providerLabel}`,
    description: `Disconnect ${providerLabel} by removing the ${revokeLabel} used for import previews and one-time imports.`,
    confirmDescription:
      provider === "klaviyo"
        ? `Disconnecting ${providerLabel} removes the stored connection details for this tenant and stops future previews or imports until the provider is connected again.`
        : `Disconnecting ${providerLabel} revokes the stored authorization and stops future previews or imports until the provider is connected again.`,
    bullets: [
      "Future list previews will stop until the provider is connected again.",
      "New one-time imports cannot be started while the connection is removed.",
      "Previously imported CRM records are not deleted from BloomSuite.",
    ],
    safetyNote:
      "Previously imported CRM records remain in BloomSuite after the connection is removed.",
  };
}

function buildGa4DetailData(
  connection: Ga4ConnectionRecord | null,
  canDisconnect: boolean,
): Ga4DetailData {
  const propertyLabel =
    connection?.property_name?.trim() ||
    (connection?.property_id ? `Property ${connection.property_id}` : "—");
  const isConnected = connection?.connection_status === "connected";
  const lastTestStatus =
    connection?.last_test_status === "success"
      ? "success"
      : connection?.last_test_status === "error"
        ? "error"
        : "idle";
  const latestConnectionTest: Ga4ConnectionTestResult =
    lastTestStatus === "success"
      ? {
          status: "success",
          title: "Test passed",
          message:
            connection?.last_test_message ??
            "Property accessible · Sessions data available",
          checkedAt: connection?.last_test_at ?? null,
        }
      : lastTestStatus === "error"
        ? {
            status: "error",
            title: "Test failed",
            message:
              connection?.last_test_message ??
              "BloomSuite could not verify this GA4 connection.",
            checkedAt: connection?.last_test_at ?? null,
          }
        : {
            status: "idle",
            title: "No test run yet",
            message:
              "No test run yet. Click 'Run Test' to verify your connection.",
            checkedAt: null,
          };

  return {
    connectionId: connection?.id ?? null,
    tenantId: connection?.tenant_id ?? null,
    propertyId: connection?.property_id ?? null,
    propertyName: connection?.property_name ?? null,
    propertyLabel,
    measurementId: connection?.measurement_id ?? null,
    googleAccountEmail: connection?.google_account_email ?? null,
    connectionStatus: connection?.connection_status ?? "not-connected",
    connectionLabel: isConnected
      ? "Connected"
      : connection?.connection_status === "error"
        ? "Reconnect required"
        : connection?.connection_status === "authorizing"
          ? "Authorizing"
          : "Not connected",
    authorizationLabel: isConnected ? "Authorized" : "Reconnect required",
    serviceAccountConfigured: Boolean(connection?.service_account_configured),
    readPermissionsConfirmed: Boolean(connection?.service_account_configured),
    reportingStatus: isConnected ? "Active" : "Unavailable",
    lastPullAt: connection?.last_pull_at ?? null,
    lastTestAt: connection?.last_test_at ?? null,
    lastTestStatus,
    lastTestMessage: connection?.last_test_message ?? null,
    latestConnectionTest,
    connectedAt: connection?.created_at ?? null,
    updatedAt: connection?.updated_at ?? null,
    reportingPath: "/integrations/website",
    managementPath: "/integrations/website",
    analyticsUrl: "https://analytics.google.com",
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
  importJobs: ImportJobRecord[],
  canDisconnect: boolean,
): MarketingImportDetailData {
  const providerMeta = MARKETING_PROVIDER_META[provider];
  const latestImport = importJobs[0] ?? null;
  const completedImportJobs = importJobs
    .filter(isCompletedMarketingImportJob)
    .sort((left, right) => {
      const leftTime = new Date(left.completed_at ?? left.updated_at).getTime();
      const rightTime = new Date(
        right.completed_at ?? right.updated_at,
      ).getTime();

      return rightTime - leftTime;
    });
  const latestCompletedJob = completedImportJobs[0] ?? null;
  const latestImportReport = buildMarketingImportReportSummary(
    latestCompletedJob?.report,
  );
  const latestCompletedImport = latestCompletedJob
    ? buildMarketingImportHistoryEntry(latestCompletedJob)
    : null;
  const runningImport =
    importJobs.find((job) => isMailchimpImportJobActivelyRunning(job)) ?? null;
  const importHistory = completedImportJobs
    .slice(0, 5)
    .map(buildMarketingImportHistoryEntry);
  const accountName =
    getMetadataString(connection?.metadata, [
      "accountname",
      "name",
      "organization_name",
    ]) ?? connection?.provider_account_name;
  const accountId =
    getMetadataText(connection?.metadata, ["account_id", "id"]) ??
    connection?.provider_account_id ??
    null;
  const contactEmail =
    getMetadataString(connection?.metadata, [
      "contact_email",
      "email",
      "login_email",
    ]) ?? getMetadataString(asObject(connection?.metadata)?.login, ["email"]);
  const listCount = countUniqueArtifacts(artifacts, "list");
  const segmentCount = countUniqueArtifacts(artifacts, "segment");
  const contactsImported = latestImportReport?.contactsImported ?? null;
  const segmentsCreated = latestImportReport?.segmentsCreated ?? null;
  const errorCount = latestImportReport?.errors.length ?? null;
  const contactsImportedAllTime = sumImportReportCount(
    completedImportJobs,
    "contacts_imported",
  );
  const connectionState = getMarketingImportConnectionState(
    provider,
    connection,
  );
  const latestImportLabel = formatMarketingImportStatusLabel(
    latestCompletedJob?.status,
  );
  const latestImportTone = getMarketingImportStatusTone(
    latestCompletedJob?.status,
  );
  const latestImportSummary = latestCompletedImport
    ? [
        contactsImported !== null
          ? `${contactsImported.toLocaleString()} contacts imported`
          : null,
        segmentsCreated !== null ? `${segmentsCreated} segments created` : null,
        errorCount !== null ? `${errorCount} errors` : null,
      ]
        .filter((value): value is string => Boolean(value))
        .join(" • ") || `Latest import status: ${latestCompletedImport.status}`
    : "No import job has been recorded yet.";
  const authorizationLabel =
    provider === "mailchimp"
      ? connectionState.label
      : provider === "klaviyo"
        ? connection
          ? "API key configured"
          : "API key required"
        : connection
          ? connectionState.label
          : "OAuth authorization required";
  const authorizationSummary =
    provider === "klaviyo"
      ? connection
        ? "Klaviyo credentials are stored securely for preview and import flows. The raw API key is never shown from this page."
        : "Connect Klaviyo to validate the stored credential before importing profiles."
      : provider === "mailchimp"
        ? connectionState.subtitle
        : connection
          ? `${providerMeta.label} authorization is active for previews and one-time imports.`
          : `Connect ${providerMeta.label} to authorize list previews and one-time contact imports.`;
  const authorizationRows: IntegrationDetailRow[] =
    provider === "mailchimp"
      ? [
          {
            label: "Status",
            value: connectionState.label,
            tone: connectionState.tone,
            tooltip: authorizationSummary,
          },
          {
            label: "Connected since",
            value: connection?.connected_at ? "Connected" : "Not connected",
            timestamp:
              connection?.connected_at ?? connection?.created_at ?? null,
            tone: connection?.connected_at ? "success" : "warning",
            tooltip: connection?.connected_at
              ? "When BloomSuite last established the Mailchimp connection for this tenant."
              : "Mailchimp has not been connected for this tenant yet.",
          },
          {
            label: "Mailchimp account",
            value: accountName ?? "Not available",
            tone: accountName ? "neutral" : "warning",
            tooltip:
              "Mailchimp account metadata stored with the current connection.",
          },
        ]
      : [
          {
            label: providerMeta.authorizationModelLabel,
            value: authorizationLabel,
            tone: connection ? "success" : "warning",
            tooltip: authorizationSummary,
          },
          {
            label: "Connection updated",
            value: connection?.updated_at
              ? "Recently updated"
              : "No update recorded",
            timestamp:
              connection?.updated_at ?? connection?.connected_at ?? null,
            tone: connection ? "neutral" : "warning",
            tooltip:
              (connection?.updated_at ?? connection?.connected_at)
                ? "Latest connection metadata refresh recorded for this provider."
                : "No provider connection metadata is stored yet.",
          },
        ];
  const latestImportActivityAt =
    latestCompletedJob?.completed_at ??
    latestCompletedJob?.updated_at ??
    latestCompletedJob?.created_at ??
    null;
  const importHistoryRows: IntegrationDetailRow[] =
    provider === "mailchimp"
      ? [
          {
            label: "Status",
            value: latestCompletedImport
              ? latestCompletedImport.contactsImported > 0
                ? `${latestCompletedImport.contactsImported.toLocaleString()} contacts imported`
                : "Completed"
              : "No imports yet",
            tone: latestCompletedImport
              ? latestCompletedImport.contactsImported > 0
                ? "success"
                : "neutral"
              : "neutral",
            tooltip: latestImportSummary,
          },
          {
            label: "Last import",
            value: latestImportActivityAt
              ? "Import recorded"
              : "No imports yet",
            timestamp: latestImportActivityAt,
            tone: latestCompletedImport ? latestImportTone : "neutral",
            tooltip: latestImportSummary,
          },
          {
            label: "Total contacts",
            value: formatCount(contactsImportedAllTime),
            tone: contactsImportedAllTime > 0 ? "success" : "neutral",
            tooltip: `${completedImportJobs.length} completed import job${completedImportJobs.length === 1 ? "" : "s"} recorded for this provider.`,
          },
        ]
      : [
          {
            label: "Latest Import",
            value: latestImportLabel,
            tone: latestCompletedImport ? latestImportTone : "warning",
            tooltip: latestImportSummary,
          },
          {
            label: "Last import activity",
            value: latestImportActivityAt
              ? "Activity recorded"
              : "No import activity yet",
            timestamp: latestImportActivityAt,
            tone: latestCompletedImport ? latestImportTone : "warning",
            tooltip: latestImportSummary,
          },
          {
            label: "Contacts Imported",
            value: formatCount(contactsImportedAllTime),
            tone: contactsImportedAllTime > 0 ? "success" : "neutral",
            tooltip: `${completedImportJobs.length} import job${completedImportJobs.length === 1 ? "" : "s"} recorded for this provider.`,
          },
        ];
  const timeline: IntegrationDetailTimelineEntry[] =
    provider === "mailchimp"
      ? [
          ...importHistory.map((entry) => ({
            key: `${provider}-${entry.id}`,
            label:
              entry.segmentsCreated > 0
                ? `${entry.contactsImported.toLocaleString()} contacts imported · ${entry.segmentsCreated} segments created`
                : `${entry.contactsImported.toLocaleString()} contacts imported`,
            timestamp: entry.completedAt,
            tone: entry.errorCount > 0 ? "warning" : "success",
          })),
          {
            key: `${provider}-connected`,
            label: connection
              ? `${providerMeta.label} connected`
              : `${providerMeta.label} not connected`,
            timestamp:
              connection?.connected_at ?? connection?.created_at ?? null,
            tone: connection ? "success" : "warning",
          },
        ]
      : [
          {
            key: `${provider}-connected`,
            label: connection
              ? `${providerMeta.label} connected`
              : `${providerMeta.label} not connected`,
            timestamp:
              connection?.connected_at ?? connection?.created_at ?? null,
            tone: connection ? "success" : "warning",
          },
        ];

  if (provider !== "mailchimp" && latestImport?.created_at) {
    timeline.push({
      key: `${provider}-import-started`,
      label: `${providerMeta.label} import started`,
      timestamp: latestImport.created_at,
      tone: latestImportTone === "danger" ? "warning" : "neutral",
    });
  }

  if (provider !== "mailchimp" && latestImport?.completed_at) {
    timeline.push({
      key: `${provider}-import-completed`,
      label:
        latestImportTone === "danger"
          ? `${providerMeta.label} import failed`
          : `${providerMeta.label} import completed`,
      timestamp: latestImport.completed_at,
      tone: latestImportTone,
    });
  }

  const connectionDetailsRows: MarketingImportFieldRow[] =
    provider === "mailchimp"
      ? [
          {
            label: "Authorization Status",
            value: connectionState.label,
            description: connectionState.subtitle,
            tone: connectionState.tone,
            valueClassName: connectionState.valueClassName,
          },
          {
            label: "Mailchimp Account",
            value: accountName ?? "Not available",
          },
          {
            label: "Mailchimp Account ID",
            value: accountId ?? "Not available",
            copyValue: accountId,
            copyLabel: "Account ID",
          },
          {
            label: "Connected Since",
            value:
              connection?.connected_at ??
              connection?.created_at ??
              "Not connected",
            description:
              connection?.connected_at || connection?.created_at
                ? "Stored Mailchimp connection timestamp for this tenant."
                : "No Mailchimp connection is stored yet.",
          },
        ]
      : [
          {
            label: "Provider",
            value: providerMeta.label,
          },
          {
            label: "Authorization",
            value: connectionState.label,
            description: connectionState.subtitle,
            tone: connectionState.tone,
            valueClassName: connectionState.valueClassName,
          },
          {
            label: "Account Name",
            value: accountName ?? "Not connected yet",
          },
          {
            label: "Account ID",
            value: connection?.provider_account_id ?? "Not available",
            copyValue: connection?.provider_account_id ?? null,
            copyLabel: "Account ID",
          },
          {
            label: "Contact Email",
            value: contactEmail ?? "Not available",
          },
          {
            label: "Connected Since",
            value:
              connection?.connected_at ??
              connection?.created_at ??
              "Not connected",
            description:
              connection?.connected_at || connection?.created_at
                ? "Stored connection timestamp for this tenant."
                : "No provider connection is stored yet.",
          },
        ];

  if (provider === "klaviyo") {
    connectionDetailsRows.push({
      label: "Credential Type",
      value: "API key",
      description:
        "Stored securely for import workflows. The raw API key is never displayed here.",
      tone: connection ? "success" : "warning",
    });
  } else if (provider !== "mailchimp") {
    connectionDetailsRows.push({
      label: "Token Expiry",
      value: connection?.token_expires_at ?? "No expiry reported",
      description: connection?.token_expires_at
        ? "OAuth token expiry reported by the provider connection."
        : "This provider did not report a token expiry for the current connection.",
      tone: connection?.token_expires_at ? "neutral" : "warning",
    });
  }

  const capabilityRows = buildMarketingImportCapabilityRows(
    provider,
    listCount,
    segmentCount,
  );
  const capabilitiesNote =
    provider === "mailchimp"
      ? "Mailchimp is available for one-time or periodic import, not live two-way sync."
      : null;
  const dangerZone = buildMarketingImportDangerZone(
    provider,
    providerMeta.label,
    providerMeta.authorizationModelLabel,
  );

  return {
    provider,
    providerSlug: providerMeta.slug,
    providerLabel: providerMeta.label,
    providerDescription: providerMeta.description,
    connectionId: connection?.id ?? null,
    accountName: accountName ?? null,
    accountId: connection?.provider_account_id ?? null,
    contactEmail: contactEmail ?? null,
    connectionStatus: connection?.status ?? "not-connected",
    connectionLabel: connectionState.label,
    connectedAt: connection?.connected_at ?? connection?.created_at ?? null,
    updatedAt:
      runningImport?.updated_at ??
      latestCompletedJob?.completed_at ??
      latestCompletedJob?.updated_at ??
      connection?.updated_at ??
      connection?.connected_at ??
      null,
    tokenExpiresAt: connection?.token_expires_at ?? null,
    listCount,
    segmentCount,
    latestImportId: latestCompletedJob?.id ?? null,
    latestImportStatus: latestCompletedJob?.status ?? null,
    latestImportStartedAt: latestCompletedJob?.created_at ?? null,
    latestImportCompletedAt: latestCompletedJob?.completed_at ?? null,
    latestImportSummary,
    latestImportReport,
    latestCompletedImport,
    importHistory,
    latestImportLabel,
    latestImportTone,
    contactsImportedAllTime,
    importJobCount: completedImportJobs.length,
    hasRunningImport: Boolean(runningImport),
    runningImportId: runningImport?.id ?? null,
    importFlowPath:
      provider === "mailchimp"
        ? "/integrations/mailchimp"
        : `/integrations/migrations?provider=${provider}`,
    previewListsPath:
      provider === "mailchimp"
        ? "/integrations/mailchimp"
        : `/integrations/migrations?provider=${provider}&step=choose`,
    purposeLabel: "Contact Import",
    liveSyncLabel: "Not available",
    importOnlyLabel: "Import only",
    connectionState,
    authorizationLabel,
    authorizationSummary,
    authorizationModelLabel: providerMeta.authorizationModelLabel,
    healthRows: {
      authorization: authorizationRows,
      importHistory: importHistoryRows,
    },
    timeline,
    connectionDetailsRows,
    capabilityRows,
    capabilitiesNote,
    supportsRevokeToken: providerMeta.supportsRevokeToken,
    supportsValidateConnection: providerMeta.supportsValidateConnection,
    dangerZone,
    capabilities: providerMeta.capabilities,
    canDisconnect,
  };
}

function normalizeInfrastructureValue(value: string | null | undefined) {
  return value?.trim().replace(/\.$/, "").toLowerCase() ?? null;
}

function formatIsoDate(timestamp: string | null | undefined) {
  if (!timestamp) {
    return "Not available";
  }

  const parsed = new Date(timestamp);

  if (Number.isNaN(parsed.getTime())) {
    return "Not available";
  }

  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRate(value?: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0%";
  }

  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)}%`;
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

function getEmailInfrastructureEnvironmentLabel(
  domain: EmailInfrastructureDomainRecord | null,
) {
  if (domain?.is_sandbox) {
    return "Sandbox";
  }

  if (domain?.env === "dev") {
    return "Development";
  }

  if (domain?.env === "prod") {
    return "Production";
  }

  return "Environment pending";
}

function getInfrastructureToneFromVerificationState(
  state: EmailInfrastructureDnsStatus["verificationState"],
): IntegrationDetailTone {
  switch (state) {
    case "verified":
      return "success";
    case "incorrect":
      return "danger";
    case "missing":
      return "warning";
    default:
      return "neutral";
  }
}

function getInfrastructureLabelFromVerificationState(
  state: EmailInfrastructureDnsStatus["verificationState"],
) {
  switch (state) {
    case "verified":
      return "Verified";
    case "incorrect":
      return "Incorrect";
    case "missing":
      return "Missing";
    default:
      return "Not configured";
  }
}

function getInfrastructurePurposeLabel(purpose: string) {
  switch (purpose) {
    case "spf":
      return "SPF";
    case "dkim":
      return "DKIM";
    case "dmarc":
      return "DMARC";
    case "return_path":
      return "Return Path";
    case "verification":
      return "Verification";
    default:
      return purpose
        .split("_")
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(" ");
  }
}

function getEmailInfrastructureDnsBadge(
  primaryDomain: EmailInfrastructureDomainRecord | null,
  dnsStatuses: EmailInfrastructureDnsStatus[],
): Pick<EmailInfrastructureDetailData, "badgeLabel" | "badgeTone"> {
  if (!primaryDomain) {
    return { badgeLabel: "Setup required", badgeTone: "neutral" };
  }

  if (dnsStatuses.length === 0) {
    return { badgeLabel: "DNS setup needed", badgeTone: "warning" };
  }

  if (dnsStatuses.some((record) => record.verificationState === "incorrect")) {
    return { badgeLabel: "DNS issues", badgeTone: "danger" };
  }

  if (dnsStatuses.some((record) => record.verificationState === "missing")) {
    return { badgeLabel: "DNS pending", badgeTone: "warning" };
  }

  return { badgeLabel: "DNS healthy", badgeTone: "success" };
}

function buildEmailInfrastructureBanner(
  primaryDomain: EmailInfrastructureDomainRecord | null,
  dnsStatuses: EmailInfrastructureDnsStatus[],
  providerModeLabel: string,
) {
  if (!primaryDomain) {
    return {
      tone: "warning" as const,
      title: "No sending domain configured",
      description:
        "Add a sending domain before BloomSuite can verify DNS, evaluate sending health, or run infrastructure checks.",
    };
  }

  if (primaryDomain.is_sandbox) {
    return {
      tone: "info" as const,
      title: "Sandbox sending domain",
      description:
        "This domain is marked as sandbox-only. Use it for setup validation and test sending, not production traffic.",
    };
  }

  if (primaryDomain.last_verify_error || primaryDomain.error) {
    return {
      tone: "warning" as const,
      title: "Recent DNS verification issue",
      description:
        primaryDomain.last_verify_error ??
        primaryDomain.error ??
        "BloomSuite recorded a recent verification problem for this domain.",
    };
  }

  if (dnsStatuses.some((record) => record.verificationState === "incorrect")) {
    return {
      tone: "warning" as const,
      title: "DNS records need correction",
      description: `At least one required DNS record is present with the wrong value. Review the records below or open ${providerModeLabel.toLowerCase()} to repair the domain.`,
    };
  }

  if (dnsStatuses.some((record) => record.verificationState === "missing")) {
    return {
      tone: "warning" as const,
      title: "DNS verification still in progress",
      description:
        "BloomSuite can see the domain, but one or more required DNS records are still missing from public DNS results.",
    };
  }

  return null;
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

function getEmailInfrastructureHealthTone(
  status: EmailInfrastructureDetailData["healthCheckStatus"],
): IntegrationDetailTone {
  switch (status) {
    case "healthy":
      return "success";
    case "warning":
      return "warning";
    case "error":
      return "danger";
    default:
      return "neutral";
  }
}

function buildEmailInfrastructureVerificationMap(
  domain: EmailInfrastructureDomainRecord | null,
) {
  const verificationMap = new Map<
    string,
    {
      verificationState: EmailInfrastructureDnsStatus["verificationState"];
      lastCheckedAt: string | null;
      statusReason: string;
    }
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

    verificationMap.set(`${type}:${normalizeInfrastructureValue(name)}`, {
      verificationState:
        Boolean(source?.dns_verified) || source?.status === "verified"
          ? "verified"
          : Boolean(source?.has_conflict)
            ? "incorrect"
            : "missing",
      lastCheckedAt: null,
      statusReason:
        typeof source?.status === "string"
          ? `Provider reported ${source.status}`
          : Boolean(source?.has_conflict)
            ? "Provider reported a conflicting value"
            : "Provider has not verified this record yet",
    });
  }

  for (const entry of directChecks) {
    const source = asObject(entry);
    const type =
      typeof source?.record_type === "string" ? source.record_type : null;
    const fqdn = typeof source?.fqdn === "string" ? source.fqdn : null;

    if (!type || !fqdn) {
      continue;
    }

    verificationMap.set(`${type}:${normalizeInfrastructureValue(fqdn)}`, {
      verificationState: Boolean(source?.verified)
        ? "verified"
        : Boolean(source?.found)
          ? "incorrect"
          : "missing",
      lastCheckedAt:
        typeof source?.last_checked_at === "string"
          ? source.last_checked_at
          : null,
      statusReason: Boolean(source?.verified)
        ? "Public DNS matches the expected value"
        : Boolean(source?.found)
          ? "Public DNS found a record, but the value does not match"
          : "Public DNS did not return the expected record",
    });
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
    domains.find((domain) =>
      ["active", "warming_up"].includes(domain.status),
    ) ??
    domains.find((domain) => Boolean(domain.verified_at)) ??
    domains[0] ??
    null;
  const verificationMap =
    buildEmailInfrastructureVerificationMap(primaryDomain);
  const dnsStatuses = dnsRecords.map((record) => {
    const match = verificationMap.get(
      `${record.type}:${normalizeInfrastructureValue(record.name)}`,
    );
    const verificationState = match?.verificationState ?? "missing";

    return {
      ...record,
      verified: verificationState === "verified",
      verificationState,
      statusLabel:
        getInfrastructureLabelFromVerificationState(verificationState),
      statusTone: getInfrastructureToneFromVerificationState(verificationState),
      statusReason:
        match?.statusReason ??
        "BloomSuite has not verified this DNS record yet",
      lastCheckedAt: match?.lastCheckedAt ?? null,
    };
  });
  const verifiedDomainCount = domains.filter(
    (domain) =>
      Boolean(domain.verified_at) ||
      ["active", "warming_up"].includes(domain.status),
  ).length;
  const dnsVerifiedCount = dnsStatuses.filter(
    (record) => record.verified,
  ).length;
  const providerLabel = getEmailInfrastructureProviderLabel(primaryDomain);
  const providerModeLabel =
    getEmailInfrastructureProviderModeLabel(primaryDomain);
  const environmentLabel =
    getEmailInfrastructureEnvironmentLabel(primaryDomain);
  const primaryStatusLabel = getEmailInfrastructureStatusLabel(
    primaryDomain?.status,
  );
  const healthState = getEmailInfrastructureHealthStatus(healthChecks);
  const reputationScore =
    typeof healthDashboard?.reputation_score === "number"
      ? healthDashboard.reputation_score
      : null;
  const sent24h =
    typeof healthDashboard?.sent_24h === "number"
      ? healthDashboard.sent_24h
      : 0;
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
  const badge = getEmailInfrastructureDnsBadge(primaryDomain, dnsStatuses);
  const banner = buildEmailInfrastructureBanner(
    primaryDomain,
    dnsStatuses,
    providerModeLabel,
  );
  const purposeRows = ["spf", "dkim", "dmarc"].map((purpose) => {
    const matchingRecords = dnsStatuses.filter(
      (record) => record.purpose === purpose,
    );
    const hasIncorrect = matchingRecords.some(
      (record) => record.verificationState === "incorrect",
    );
    const hasMissing = matchingRecords.some(
      (record) => record.verificationState === "missing",
    );
    const allVerified =
      matchingRecords.length > 0 &&
      matchingRecords.every(
        (record) => record.verificationState === "verified",
      );
    const verificationState =
      matchingRecords.length === 0
        ? "not-configured"
        : hasIncorrect
          ? "incorrect"
          : hasMissing
            ? "missing"
            : allVerified
              ? "verified"
              : "not-configured";

    return {
      label: getInfrastructurePurposeLabel(purpose),
      value: getInfrastructureLabelFromVerificationState(verificationState),
      description:
        matchingRecords.length > 0
          ? matchingRecords
              .map((record) => `${record.type} ${record.name}`)
              .join(" • ")
          : "No record is currently stored for this protocol",
      tone: getInfrastructureToneFromVerificationState(verificationState),
    } satisfies EmailInfrastructureFieldRow;
  });
  const configurationRows: EmailInfrastructureFieldRow[] = [
    {
      label: "Primary Domain",
      value: primaryDomain?.domain ?? "No sending domain configured",
      description: primaryDomain?.created_at
        ? `Added ${formatIsoDate(primaryDomain.created_at)}`
        : "Open domain settings to add a sending domain",
      tone: primaryDomain ? "success" : "warning",
      copyValue: primaryDomain?.domain ?? null,
      copyLabel: "Primary domain",
    },
    {
      label: "Status",
      value: primaryStatusLabel,
      description: environmentLabel,
      tone:
        primaryDomain && ["active", "warming_up"].includes(primaryDomain.status)
          ? "success"
          : primaryDomain
            ? "warning"
            : "neutral",
    },
    {
      label: "Provider",
      value: providerLabel,
      description: providerModeLabel,
    },
    {
      label: "Verified At",
      value: primaryDomain?.verified_at
        ? formatIsoDate(primaryDomain.verified_at)
        : "Not verified yet",
      description: primaryDomain?.last_verify_attempt_at
        ? `Last DNS check ${formatIsoDate(primaryDomain.last_verify_attempt_at)}`
        : "No verification attempts recorded yet",
      tone: primaryDomain?.verified_at ? "success" : "warning",
    },
  ];
  const healthRows = {
    domain: [
      {
        label: "Primary Domain",
        value: primaryDomain?.domain ?? "Setup required",
        tone: primaryDomain ? "success" : "warning",
        tooltip:
          primaryDomain?.domain ??
          "No domain is configured for BloomSuite email sending yet.",
      },
      {
        label: "Status",
        value: primaryStatusLabel,
        tone:
          primaryDomain &&
          ["active", "warming_up"].includes(primaryDomain.status)
            ? "success"
            : primaryDomain
              ? "warning"
              : "neutral",
        tooltip: providerModeLabel,
      },
      {
        label: "Environment",
        value: environmentLabel,
        tone: primaryDomain?.is_sandbox ? "warning" : "neutral",
        tooltip: primaryDomain?.is_sandbox
          ? "Sandbox domains are intended for setup validation and low-risk test sending."
          : "Production domains are used for live sending.",
      },
    ],
    dnsHealth: purposeRows.map((row) => ({
      label: row.label,
      value: row.value,
      tone: row.tone,
      tooltip: row.description,
    })),
    sendingHealth: [
      {
        label: "Health Check",
        value: healthState.healthCheckLabel,
        tone: getEmailInfrastructureHealthTone(healthState.healthCheckStatus),
        tooltip: healthState.latestHealthCheckAt
          ? `Latest DNS check ${formatIsoDate(healthState.latestHealthCheckAt)}`
          : "No infrastructure checks have been recorded yet.",
      },
      {
        label: "Reputation",
        value:
          reputationScore !== null
            ? `${Math.round(reputationScore)} ${typeof healthDashboard?.reputation_tier === "string" ? `• ${healthDashboard.reputation_tier}` : ""}`.trim()
            : "Unavailable",
        tone: reputationScore !== null ? "success" : "neutral",
        tooltip:
          reputationScore !== null
            ? `${sent24h.toLocaleString()} sent in the last 24 hours`
            : "Tenant reputation data is not available yet.",
      },
      {
        label: "Delivery",
        value: `${formatRate(bounceRate24h)} bounce • ${formatRate(complaintRate24h)} complaint`,
        tone:
          bounceRate24h <= 2 && complaintRate24h <= 0.3 ? "success" : "warning",
        tooltip:
          deliveryRate30d > 0
            ? `${deliveryRate30d.toFixed(1)}% delivered over the last 30 days`
            : "No 30-day delivery summary is available yet.",
      },
    ],
  };
  const setupToolRows: EmailInfrastructureSetupTool[] = [
    {
      label: "Domain Management",
      description:
        "Review domains, default sending settings, and DNS evidence.",
      path: "/domains",
      tone: "neutral",
    },
    {
      label: "Domain Connect Setup",
      description:
        "Open the email sending setup flow and Domain Connect wizard.",
      path: "/crm/settings/email-sending",
      tone: "neutral",
    },
    {
      label: "Sending Logs",
      description:
        "Inspect sending activity, recent failures, and delivery events.",
      path: "/activity?q=email",
      tone: "neutral",
    },
  ];

  return {
    badgeLabel: badge.badgeLabel,
    badgeTone: badge.badgeTone,
    metadata: [
      `Category: Infrastructure`,
      `Domain: ${primaryDomain?.domain ?? "Not configured"}`,
      `Status: ${primaryStatusLabel}`,
      `Provider: ${providerLabel}`,
      `Environment: ${environmentLabel}`,
    ],
    primaryDomainId: primaryDomain?.id ?? null,
    primaryDomain: primaryDomain?.domain ?? null,
    primaryStatus: primaryDomain?.status ?? "not-configured",
    primaryStatusLabel,
    environmentLabel,
    isSandbox: Boolean(primaryDomain?.is_sandbox),
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
    banner,
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
    healthRows,
    configurationRows,
    protocolRows: purposeRows,
    setupToolRows,
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
  return (
    values
      .filter((value): value is string => Boolean(value))
      .sort(
        (left, right) => new Date(right).getTime() - new Date(left).getTime(),
      )[0] ?? null
  );
}

function getEarliestTimestamp(values: Array<string | null | undefined>) {
  return (
    values
      .filter((value): value is string => Boolean(value))
      .sort(
        (left, right) => new Date(left).getTime() - new Date(right).getTime(),
      )[0] ?? null
  );
}

function isTimestampExpired(timestamp?: string | null) {
  if (!timestamp) {
    return false;
  }

  return new Date(timestamp).getTime() <= Date.now();
}

function isTimestampWithinDays(
  timestamp: string | null | undefined,
  days: number,
) {
  if (!timestamp) {
    return false;
  }

  const targetTime = new Date(timestamp).getTime();

  if (Number.isNaN(targetTime) || targetTime <= Date.now()) {
    return false;
  }

  return targetTime - Date.now() <= days * 24 * 60 * 60 * 1000;
}

function buildMetaAssetRow(
  connection: MetaConnectionRecord,
  platform: "facebook" | "instagram",
): MetaAssetRow {
  const externalId =
    platform === "facebook"
      ? (connection.page_id ?? connection.platform_account_id)
      : (connection.platform_account_id ?? connection.page_id);

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
    active: connection.is_active !== false,
  };
}

function buildMetaDetailData(
  connections: MetaConnectionRecord[],
  canDisconnect: boolean,
): MetaDetailData {
  const availableConnections = connections.filter(
    (connection) => !connection.deleted_at,
  );
  const activeConnections = availableConnections.filter(
    (connection) => connection.is_active !== false,
  );
  const facebookPages = availableConnections
    .filter((connection) => connection.platform === "facebook")
    .map((connection) => buildMetaAssetRow(connection, "facebook"));
  const instagramAccounts = availableConnections
    .filter((connection) => connection.platform === "instagram")
    .map((connection) => buildMetaAssetRow(connection, "instagram"));
  const expiresAt = getEarliestTimestamp(
    activeConnections.map((connection) => connection.expires_at),
  );
  const authorizationStatus =
    activeConnections.length === 0
      ? "not-connected"
      : activeConnections.some(
            (connection) => !isTimestampExpired(connection.expires_at),
          )
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
    totalAssetCount: availableConnections.length,
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

  const oauthTab = window.open(
    authUrl.toString(),
    "_blank",
    "noopener,noreferrer",
  );

  if (!oauthTab) {
    throw new Error("Please allow new tabs to connect Meta, then try again.");
  }
}

function buildFallbackResult(
  seed: ReturnType<typeof getIntegrationSeed>,
): DetailResult | null {
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
  const { user, loading: authLoading } = useAuth();
  const { tenant, loading: tenantLoading } = useTenant();
  const { hasRole } = useUserRole();
  const { data: isSuperAdmin = false } = useIsSuperAdmin();
  const queryClient = useQueryClient();
  const seed = slug ? getIntegrationSeed(slug) : null;
  const isMailchimpBootstrapPending =
    seed?.slug === "mailchimp" && (authLoading || tenantLoading);
  const [submittedInterestKey, setSubmittedInterestKey] = useState<
    string | null
  >(null);
  const [lightspeedTrackedJobIds, setLightspeedTrackedJobIds] = useState<
    string[]
  >([]);
  const [lightspeedJobRowsById, setLightspeedJobRowsById] = useState<
    Record<string, PosSyncJobRow>
  >({});
  const [shouldToastLightspeedCompletion, setShouldToastLightspeedCompletion] =
    useState(false);
  const lastLightspeedTerminalToastRef = useRef<string | null>(null);

  const query = useQuery({
    queryKey: [
      "integration-detail",
      slug ?? null,
      tenant?.id ?? null,
      user?.id ?? null,
    ],
    enabled: Boolean(seed) && !isMailchimpBootstrapPending,
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
              contextLabel:
                connection.retailer_name ?? connection.domain_prefix,
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
        case "shopify": {
          if (!tenant?.id || !user?.id) {
            return fallback;
          }

          const response = await (supabase as any)
            .from("shopify_connections")
            .select(
              "id, shop_domain, shop_name, shop_owner, shop_email, scope, status, connected_at, last_synced_at, last_customer_sync, last_sales_sync, last_product_sync, last_webhook_received_at, customers_synced, sales_synced, products_synced, webhooks_subscribed, webhook_subscription_ids, webhooks_last_checked_at, webhook_retry_count, webhook_next_retry_at, webhook_last_error, updated_at",
            )
            .eq("tenant_id", tenant.id)
            .eq("user_id", user.id)
            .order("updated_at", { ascending: false })
            .limit(1);

          if (response.error) {
            throw response.error;
          }

          const connection = response.data?.[0] ?? null;

          if (!connection) {
            const item: IntegrationDefinition = {
              ...seed,
              status: "available",
              metaLabel: "OAuth-based Shopify connection",
            };

            return {
              item,
              model: buildIntegrationDetailModel({
                item,
                status: "available",
                contextLabel: "Shopify OAuth install flow",
                hasWebhookMonitoring: true,
                syncSummary: "Customers 0 • Products 0 • Orders 0",
                serviceStateLabel: "Ready to connect",
                configurationHint:
                  "Connect Shopify by entering your store domain, completing the Shopify OAuth install, and letting BloomSuite store the encrypted access token for this tenant.",
                activityHint:
                  "After the OAuth flow completes, this page will refresh and show the connected merchant, webhook health, and future sync readiness.",
                canDisconnect: false,
              }),
              targetPath: "/integrations/shopify",
              shopifyConnection: null,
            };
          }

          const status =
            connection.status === "connected" ? "connected" : "available";
          const detailStatus: IntegrationStatus = "connected";
          const label = connection.shop_name ?? connection.shop_domain;
          const item: IntegrationDefinition = {
            ...seed,
            status,
            connectedSince: connection.connected_at,
            metaLabel: label,
          };

          return {
            item,
            model: buildIntegrationDetailModel({
              item,
              status: detailStatus,
              contextLabel: label,
              connectedAt: connection.connected_at,
              lastSyncAt:
                connection.last_synced_at ??
                getMostRecentTimestamp([
                  connection.last_customer_sync,
                  connection.last_sales_sync,
                  connection.last_product_sync,
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
                ["Orders", connection.sales_synced],
              ]),
              serviceStateLabel: connection.status ?? "Connected",
              configurationHint:
                connection.status === "connected"
                  ? "BloomSuite stores the encrypted Shopify access token in shopify_connections and refreshes the integration detail shell from that tenant-scoped connection record."
                  : "Connect Shopify by entering your store domain and authorizing BloomSuite through Shopify's OAuth install screen.",
              activityHint:
                connection.status === "connected"
                  ? "Webhook setup is triggered automatically after OAuth. Use Verify webhooks to re-check coverage, subscription health, and delivery readiness for this store."
                  : "This Shopify store is disconnected. Reinstall or reconnect to restore webhook intake and sync jobs.",
              canDisconnect: true,
            }),
            targetPath: "/integrations/shopify",
            shopifyConnection: connection,
            disconnectRef: { kind: "shopify", id: connection.id },
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
          let connectionQuery = supabase
            .from("provider_connections")
            .select(
              "id, provider, provider_account_name, provider_account_id, connected_at, created_at, updated_at, status, token_expires_at, metadata",
            )
            .eq("tenant_id", tenant.id)
            .eq("provider", provider)
            .order("updated_at", { ascending: false })
            .order("connected_at", { ascending: false })
            .limit(1);

          let jobsQuery = supabase
            .from("import_jobs")
            .select("id, status, created_at, updated_at, completed_at, report")
            .eq("tenant_id", tenant.id)
            .eq("provider", provider)
            .order("created_at", { ascending: false });

          if (provider !== "mailchimp") {
            connectionQuery = connectionQuery.eq("user_id", user.id);
            jobsQuery = jobsQuery.eq("user_id", user.id);
          }

          const [connectionResponse, artifactsResponse, jobsResponse] =
            await Promise.all([
              connectionQuery,
              supabase
                .from("provider_artifacts")
                .select(
                  "id, artifact_type, external_id, name, member_count, created_at",
                )
                .eq("tenant_id", tenant.id)
                .eq("provider", provider)
                .order("created_at", { ascending: false }),
              jobsQuery,
            ]);

          if (connectionResponse.error) throw connectionResponse.error;
          if (artifactsResponse.error) throw artifactsResponse.error;
          if (jobsResponse.error) throw jobsResponse.error;

          const connection = connectionResponse.data?.[0] ?? null;
          const artifacts = artifactsResponse.data ?? [];
          const importJobs = jobsResponse.data ?? [];
          const marketingImportDetail = buildMarketingImportDetailData(
            provider,
            connection,
            artifacts,
            importJobs,
            seed.canDisconnect,
          );
          const accountLabel =
            marketingImportDetail.accountName ??
            marketingImportDetail.accountId ??
            `${seed.name} import connection`;
          const item: IntegrationDefinition = {
            ...seed,
            status:
              connection?.status === "connected" ? "connected" : "available",
            connectedSince: marketingImportDetail.connectedAt,
            metaLabel: connection ? accountLabel : "Purpose: Contact Import",
          };

          return {
            item,
            model: buildIntegrationDetailModel({
              item,
              status: item.status,
              contextLabel: connection
                ? accountLabel
                : `${seed.name} import flow`,
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
                provider === "mailchimp"
                  ? "Use the Mailchimp integration page to connect Mailchimp, review cached audiences, and manage one-time imports. This connection does not enable live sync."
                  : "Use the migration wizard to preview provider lists and run one-time contact imports. This connection does not enable live sync.",
              activityHint:
                provider === "mailchimp"
                  ? "Connection state, cached audience counts, and import history appear here without exposing encrypted tokens or hidden provider credentials."
                  : "Import history and provider list discovery appear here without exposing encrypted tokens or hidden provider credentials.",
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
          const metaDetail = buildMetaDetailData(
            connections,
            seed.canDisconnect,
          );
          const names = activeConnections
            .map(
              (connection) =>
                connection.platform_account_name || connection.platform,
            )
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
                ? {
                    kind: "meta",
                    ids: connections.map((connection) => connection.id),
                  }
                : undefined,
          };
        }
        case "google-analytics": {
          if (!tenant?.id || !user?.id) {
            return fallback;
          }

          const { data, error } = await supabase
            .from("google_analytics_settings")
            .select(
              "id, tenant_id, property_id, property_name, measurement_id, google_account_email, connection_status, last_pull_at, last_test_at, last_test_status, last_test_message, service_account_configured, created_at, updated_at",
            )
            .eq("tenant_id", tenant.id)
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
              lastActivityAt:
                ga4Detail.lastPullAt ??
                ga4Detail.lastTestAt ??
                ga4Detail.updatedAt,
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
              "id, domain, status, created_at, updated_at, env, is_sandbox, verified_at, last_verify_attempt_at, last_verify_error, error, daily_limit, daily_sent_count, warmup_stage, entri_provider, is_entri_managed, healthy_days_counter, resend_status",
            )
            .eq("tenant_id", tenant.id)
            .order("created_at", { ascending: false });

          if (error) throw error;

          const domains = (data ?? []) as EmailInfrastructureDomainRecord[];
          const primaryDomain =
            domains.find((domain) =>
              ["active", "warming_up"].includes(domain.status),
            ) ??
            domains.find((domain) => Boolean(domain.verified_at)) ??
            domains[0] ??
            null;

          const [
            dnsRecordsResult,
            healthChecksResult,
            healthDashboardResult,
            deliverabilityResult,
          ] = await Promise.all([
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
            supabase.rpc(
              "get_tenant_email_health_dashboard" as never,
              {
                p_as_of: new Date().toISOString(),
                p_tenant_id: tenant.id,
              } as never,
            ),
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
            ((
              healthChecksResult.data as {
                checks?: EmailInfrastructureHealthCheck[];
              } | null
            )?.checks ?? []) as EmailInfrastructureHealthCheck[],
            (Array.isArray(healthDashboardResult.data)
              ? (healthDashboardResult.data[0] ?? null)
              : (healthDashboardResult.data ?? null)) as Record<
              string,
              unknown
            > | null,
            (deliverabilityResult.data ?? null) as Record<
              string,
              unknown
            > | null,
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
              configurationHint: emailInfrastructureDetail.configurationSummary,
              activityHint: emailInfrastructureDetail.healthSummary,
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
    if (isMailchimpBootstrapPending) {
      return null;
    }

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
  }, [query.data, seed, isSuperAdmin, isMailchimpBootstrapPending]);

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
        search: options?.sales?.search?.trim() ?? "",
        status: options?.sales?.status?.trim() ?? "all",
        startDate: options?.sales?.startDate ?? null,
        endDate: options?.sales?.endDate ?? null,
        sortField: options?.sales?.sortField ?? "sale_date",
        sortDirection: options?.sales?.sortDirection ?? "desc",
      },
      products: {
        page: Math.max(options?.products?.page ?? 1, 1),
        search: options?.products?.search?.trim() ?? "",
        categories: Array.from(
          new Set(
            (
              options?.products?.categories ??
              (options?.products?.category &&
              options.products.category !== "all"
                ? [options.products.category]
                : [])
            )
              .map((value) => value?.trim())
              .filter((value): value is string => Boolean(value)),
          ),
        ),
        inStockOnly: Boolean(options?.products?.inStockOnly),
        sortField: options?.products?.sortField ?? "name",
        sortDirection: options?.products?.sortDirection ?? "asc",
      },
      syncLogs: {
        page: Math.max(options?.syncLogs?.page ?? 1, 1),
        status: options?.syncLogs?.status?.trim() ?? "all",
      },
    }),
    [options],
  );

  const squareDashboardOptions = useMemo(
    () => ({
      customers: {
        page: Math.max(options?.customers?.page ?? 1, 1),
        search: options?.customers?.search?.trim() ?? "",
        sortField:
          (options?.customers?.sortField as
            | SquareCustomerSortField
            | undefined) ?? "updated_at",
        sortDirection: options?.customers?.sortDirection ?? "desc",
      },
      sales: {
        page: Math.max(options?.sales?.page ?? 1, 1),
        search: options?.sales?.search?.trim() ?? "",
        status: options?.sales?.status?.trim() ?? "all",
        startDate: options?.sales?.startDate ?? null,
        endDate: options?.sales?.endDate ?? null,
        sortField:
          (options?.sales?.sortField as SquareSalesSortField | undefined) ??
          "order_date",
        sortDirection: options?.sales?.sortDirection ?? "desc",
      },
      products: {
        page: Math.max(options?.products?.page ?? 1, 1),
        search: options?.products?.search?.trim() ?? "",
        categories: Array.from(
          new Set(
            (
              options?.products?.categories ??
              (options?.products?.category &&
              options.products.category !== "all"
                ? [options.products.category]
                : [])
            )
              .map((value) => value?.trim())
              .filter((value): value is string => Boolean(value)),
          ),
        ),
        inStockOnly: Boolean(options?.products?.inStockOnly),
        sortField:
          (options?.products?.sortField as
            | SquareProductsSortField
            | undefined) ?? "name",
        sortDirection: options?.products?.sortDirection ?? "asc",
      },
      syncLogs: {
        page: Math.max(options?.syncLogs?.page ?? 1, 1),
        status: options?.syncLogs?.status?.trim() ?? "all",
      },
    }),
    [options],
  );

  const cloverDashboardOptions = useMemo(
    () => ({
      customers: {
        page: Math.max(options?.customers?.page ?? 1, 1),
        search: options?.customers?.search?.trim() ?? "",
        sortField:
          (options?.customers?.sortField as
            | SquareCustomerSortField
            | undefined) ?? "updated_at",
        sortDirection: options?.customers?.sortDirection ?? "desc",
      },
      sales: {
        page: Math.max(options?.sales?.page ?? 1, 1),
        search: options?.sales?.search?.trim() ?? "",
        status: options?.sales?.status?.trim() ?? "all",
        startDate: options?.sales?.startDate ?? null,
        endDate: options?.sales?.endDate ?? null,
        sortField:
          (options?.sales?.sortField as SquareSalesSortField | undefined) ??
          "order_date",
        sortDirection: options?.sales?.sortDirection ?? "desc",
      },
      products: {
        page: Math.max(options?.products?.page ?? 1, 1),
        search: options?.products?.search?.trim() ?? "",
        categories: Array.from(
          new Set(
            (
              options?.products?.categories ??
              (options?.products?.category &&
              options.products.category !== "all"
                ? [options.products.category]
                : [])
            )
              .map((value) => value?.trim())
              .filter((value): value is string => Boolean(value)),
          ),
        ),
        inStockOnly: Boolean(options?.products?.inStockOnly),
        sortField:
          (options?.products?.sortField as
            | SquareProductsSortField
            | undefined) ?? "name",
        sortDirection: options?.products?.sortDirection ?? "asc",
      },
      syncLogs: {
        page: Math.max(options?.syncLogs?.page ?? 1, 1),
        status: options?.syncLogs?.status?.trim() ?? "all",
      },
      connectionTests: {
        page: Math.max(options?.syncLogs?.page ?? 1, 1),
      },
    }),
    [options],
  );

  const shopifyDashboardOptions = useMemo(
    () => ({
      customers: {
        page: Math.max(options?.customers?.page ?? 1, 1),
        search: options?.customers?.search?.trim() ?? "",
        sortField:
          (options?.customers?.sortField as
            | ShopifyCustomerSortField
            | undefined) ?? "last_order_date",
        sortDirection: options?.customers?.sortDirection ?? "desc",
      },
      orders: {
        page: Math.max(options?.sales?.page ?? 1, 1),
        search: options?.sales?.search?.trim() ?? "",
        status: options?.sales?.status?.trim() ?? "all",
        startDate: options?.sales?.startDate ?? null,
        endDate: options?.sales?.endDate ?? null,
        sortField:
          (options?.sales?.sortField as ShopifyOrdersSortField | undefined) ??
          "order_date",
        sortDirection: options?.sales?.sortDirection ?? "desc",
      },
      products: {
        page: Math.max(options?.products?.page ?? 1, 1),
        search: options?.products?.search?.trim() ?? "",
        categories: Array.from(
          new Set(
            (
              options?.products?.categories ??
              (options?.products?.category &&
              options.products.category !== "all"
                ? [options.products.category]
                : [])
            )
              .map((value) => value?.trim())
              .filter((value): value is string => Boolean(value)),
          ),
        ),
        inStockOnly: Boolean(options?.products?.inStockOnly),
        sortField:
          (options?.products?.sortField as
            | ShopifyProductsSortField
            | undefined) ?? "updated_at",
        sortDirection: options?.products?.sortDirection ?? "desc",
      },
      syncLogs: {
        page: Math.max(options?.syncLogs?.page ?? 1, 1),
        status: options?.syncLogs?.status?.trim() ?? "all",
      },
    }),
    [options],
  );

  const isLightspeedDashboardEnabled =
    slug === "lightspeed" &&
    Boolean(tenant?.id) &&
    Boolean(resolved?.lightspeedDetail);
  const isSquareDashboardEnabled =
    slug === "square" &&
    Boolean(tenant?.id) &&
    Boolean(resolved?.squareDetail?.connectionId);
  const isCloverDashboardEnabled =
    slug === "clover" &&
    Boolean(tenant?.id) &&
    Boolean(resolved?.cloverDetail?.connectionId);
  const isShopifyDashboardEnabled =
    slug === "shopify" &&
    Boolean(tenant?.id) &&
    Boolean(resolved?.shopifyConnection?.id);

  const shopifyCustomersQuery = useQuery({
    queryKey: [
      "integration-detail-shopify-customers",
      tenant?.id ?? null,
      shopifyDashboardOptions.customers.page,
      shopifyDashboardOptions.customers.search,
      shopifyDashboardOptions.customers.sortField,
      shopifyDashboardOptions.customers.sortDirection,
    ],
    enabled: isShopifyDashboardEnabled,
    queryFn: async () => {
      if (!tenant?.id) {
        return {
          rows: [] as ShopifyCustomerTableRow[],
          pagination: buildLightspeedPagination(1, 0),
        };
      }

      const { from, to, safePage } = getLightspeedPageRange(
        shopifyDashboardOptions.customers.page,
      );
      const searchTerm = shopifyDashboardOptions.customers.search.replace(
        /,/g,
        " ",
      );
      let request = supabase
        .from("shopify_customers")
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
            `shopify_customer_id.ilike.${pattern}`,
          ].join(","),
        );
      }

      if (shopifyDashboardOptions.customers.sortField === "name") {
        request = request
          .order("first_name", {
            ascending:
              shopifyDashboardOptions.customers.sortDirection === "asc",
            nullsFirst: false,
          })
          .order("last_name", {
            ascending:
              shopifyDashboardOptions.customers.sortDirection === "asc",
            nullsFirst: false,
          });
      } else {
        request = request.order(shopifyDashboardOptions.customers.sortField, {
          ascending: shopifyDashboardOptions.customers.sortDirection === "asc",
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
          displayName: formatShopifyCustomerName(
            row.first_name,
            row.last_name,
            row.email,
            row.shopify_customer_id,
          ),
          normalizedTags: row.tags ?? [],
        })),
        pagination: buildLightspeedPagination(safePage, count ?? 0),
      };
    },
  });

  const shopifyOrdersQuery = useQuery({
    queryKey: [
      "integration-detail-shopify-orders",
      tenant?.id ?? null,
      shopifyDashboardOptions.orders.page,
      shopifyDashboardOptions.orders.search,
      shopifyDashboardOptions.orders.status,
      shopifyDashboardOptions.orders.startDate,
      shopifyDashboardOptions.orders.endDate,
      shopifyDashboardOptions.orders.sortField,
      shopifyDashboardOptions.orders.sortDirection,
    ],
    enabled: isShopifyDashboardEnabled,
    queryFn: async () => {
      if (!tenant?.id) {
        return {
          rows: [] as ShopifyOrderTableRow[],
          pagination: buildLightspeedPagination(1, 0),
        };
      }

      const { from, to, safePage } = getLightspeedPageRange(
        shopifyDashboardOptions.orders.page,
      );
      let request = supabase
        .from("shopify_orders")
        .select("*", { count: "exact" })
        .eq("tenant_id", tenant.id);

      if (shopifyDashboardOptions.orders.search) {
        const pattern = `%${shopifyDashboardOptions.orders.search}%`;
        request = request.or(
          [
            `order_number.ilike.${pattern}`,
            `email.ilike.${pattern}`,
            `shopify_order_id.ilike.${pattern}`,
          ].join(","),
        );
      }

      if (shopifyDashboardOptions.orders.status !== "all") {
        request = request.eq(
          "financial_status",
          shopifyDashboardOptions.orders.status,
        );
      }

      if (shopifyDashboardOptions.orders.startDate) {
        request = request.gte(
          "order_date",
          `${shopifyDashboardOptions.orders.startDate}T00:00:00.000Z`,
        );
      }

      if (shopifyDashboardOptions.orders.endDate) {
        request = request.lte(
          "order_date",
          `${shopifyDashboardOptions.orders.endDate}T23:59:59.999Z`,
        );
      }

      request = request.order(shopifyDashboardOptions.orders.sortField, {
        ascending: shopifyDashboardOptions.orders.sortDirection === "asc",
        nullsFirst: false,
      });

      const { data, error, count } = await request.range(from, to);
      if (error) {
        throw error;
      }

      const customerIds = Array.from(
        new Set(
          (data ?? [])
            .map((row) => row.shopify_customer_id)
            .filter((value): value is string => Boolean(value)),
        ),
      );

      let customerNameMap = new Map<string, string>();

      if (customerIds.length > 0) {
        const { data: customerData, error: customerError } = await supabase
          .from("shopify_customers")
          .select("shopify_customer_id, first_name, last_name, email")
          .eq("tenant_id", tenant.id)
          .in("shopify_customer_id", customerIds);

        if (customerError) {
          throw customerError;
        }

        customerNameMap = new Map(
          (customerData ?? []).map((row) => [
            row.shopify_customer_id,
            formatShopifyCustomerName(
              row.first_name,
              row.last_name,
              row.email,
              row.shopify_customer_id,
            ),
          ]),
        );
      }

      return {
        rows: (data ?? []).map((row) => ({
          ...row,
          customerDisplayName: row.shopify_customer_id
            ? (customerNameMap.get(row.shopify_customer_id) ?? null)
            : null,
          lineItemCount: getJsonArrayLength(row.line_items),
        })),
        pagination: buildLightspeedPagination(safePage, count ?? 0),
      };
    },
  });

  const shopifyOrdersSummaryQuery = useQuery({
    queryKey: [
      "integration-detail-shopify-orders-summary",
      tenant?.id ?? null,
      shopifyDashboardOptions.orders.search,
      shopifyDashboardOptions.orders.status,
      shopifyDashboardOptions.orders.startDate,
      shopifyDashboardOptions.orders.endDate,
    ],
    enabled: isShopifyDashboardEnabled,
    queryFn: async () => {
      if (!tenant?.id) {
        return {
          revenue: 0,
          averageOrderValue: 0,
          saleCount: 0,
        } satisfies ShopifySalesSummary;
      }

      let request = supabase
        .from("shopify_orders")
        .select("id, total_price")
        .eq("tenant_id", tenant.id);

      if (shopifyDashboardOptions.orders.search) {
        const pattern = `%${shopifyDashboardOptions.orders.search}%`;
        request = request.or(
          [
            `order_number.ilike.${pattern}`,
            `email.ilike.${pattern}`,
            `shopify_order_id.ilike.${pattern}`,
          ].join(","),
        );
      }

      if (shopifyDashboardOptions.orders.status !== "all") {
        request = request.eq(
          "financial_status",
          shopifyDashboardOptions.orders.status,
        );
      }

      if (shopifyDashboardOptions.orders.startDate) {
        request = request.gte(
          "order_date",
          `${shopifyDashboardOptions.orders.startDate}T00:00:00.000Z`,
        );
      }

      if (shopifyDashboardOptions.orders.endDate) {
        request = request.lte(
          "order_date",
          `${shopifyDashboardOptions.orders.endDate}T23:59:59.999Z`,
        );
      }

      const { data, error } = await request;
      if (error) {
        throw error;
      }

      const saleCount = data?.length ?? 0;
      const revenue = (data ?? []).reduce(
        (total, row) => total + (Number(row.total_price ?? 0) || 0),
        0,
      );

      return {
        revenue,
        averageOrderValue: saleCount > 0 ? revenue / saleCount : 0,
        saleCount,
      } satisfies ShopifySalesSummary;
    },
  });

  const shopifyProductsQuery = useQuery({
    queryKey: [
      "integration-detail-shopify-products",
      tenant?.id ?? null,
      shopifyDashboardOptions.products.page,
      shopifyDashboardOptions.products.search,
      shopifyDashboardOptions.products.categories.join("|"),
      shopifyDashboardOptions.products.inStockOnly,
      shopifyDashboardOptions.products.sortField,
      shopifyDashboardOptions.products.sortDirection,
    ],
    enabled: isShopifyDashboardEnabled,
    queryFn: async () => {
      if (!tenant?.id) {
        return {
          rows: [] as ShopifyProductTableRow[],
          pagination: buildLightspeedPagination(1, 0),
        };
      }

      const { from, to, safePage } = getLightspeedPageRange(
        shopifyDashboardOptions.products.page,
      );
      let request = supabase
        .from("shopify_products")
        .select("*", { count: "exact" })
        .eq("tenant_id", tenant.id);

      if (shopifyDashboardOptions.products.search) {
        const pattern = `%${shopifyDashboardOptions.products.search}%`;
        request = request.or(
          [
            `title.ilike.${pattern}`,
            `vendor.ilike.${pattern}`,
            `product_type.ilike.${pattern}`,
            `shopify_product_id.ilike.${pattern}`,
          ].join(","),
        );
      }

      if (shopifyDashboardOptions.products.categories.length > 0) {
        request = request.in(
          "product_type",
          shopifyDashboardOptions.products.categories,
        );
      }

      if (shopifyDashboardOptions.products.inStockOnly) {
        request = request.gt("inventory_quantity", 0);
      }

      request = request.order(shopifyDashboardOptions.products.sortField, {
        ascending: shopifyDashboardOptions.products.sortDirection === "asc",
        nullsFirst: false,
      });

      const { data, error, count } = await request.range(from, to);
      if (error) {
        throw error;
      }

      return {
        rows: (data ?? []).map((row) => ({
          ...row,
          normalizedTags: row.tags ?? [],
          imageCount: getJsonArrayLength(row.images),
          variantCount: getJsonArrayLength(row.variants),
          stockState: getLightspeedProductStockState(row.inventory_quantity),
        })),
        pagination: buildLightspeedPagination(safePage, count ?? 0),
      };
    },
  });

  const shopifyProductTypesQuery = useQuery({
    queryKey: ["integration-detail-shopify-product-types", tenant?.id ?? null],
    enabled: isShopifyDashboardEnabled,
    queryFn: async () => {
      if (!tenant?.id) {
        return [] as string[];
      }

      const { data, error } = await supabase
        .from("shopify_products")
        .select("product_type")
        .eq("tenant_id", tenant.id)
        .not("product_type", "is", null)
        .limit(5000);

      if (error) {
        throw error;
      }

      return Array.from(
        new Set(
          (data ?? [])
            .map((row) => row.product_type?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((left, right) => left.localeCompare(right));
    },
  });

  const shopifySyncLogsQuery = useQuery({
    queryKey: [
      "integration-detail-shopify-sync-logs",
      tenant?.id ?? null,
      shopifyDashboardOptions.syncLogs.page,
      shopifyDashboardOptions.syncLogs.status,
    ],
    enabled: isShopifyDashboardEnabled,
    queryFn: async () => {
      if (!tenant?.id) {
        return {
          rows: [] as ShopifySyncLogRow[],
          pagination: buildLightspeedPagination(1, 0),
        };
      }

      const { from, to, safePage } = getLightspeedPageRange(
        shopifyDashboardOptions.syncLogs.page,
      );
      let request = supabase
        .from("pos_sync_jobs_v2")
        .select("*", { count: "exact" })
        .eq("tenant_id", tenant.id)
        .eq("provider", "shopify");

      if (shopifyDashboardOptions.syncLogs.status !== "all") {
        request = request.eq("status", shopifyDashboardOptions.syncLogs.status);
      }

      const { data, error, count } = await request
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        throw error;
      }

      return {
        rows: (data ?? []).map(normalizeShopifySyncLogRow),
        pagination: buildLightspeedPagination(safePage, count ?? 0),
      };
    },
  });

  const shopifyActiveJobsQuery = useQuery({
    queryKey: [
      "integration-detail-shopify-active-sync-jobs",
      tenant?.id ?? null,
    ],
    enabled: isShopifyDashboardEnabled,
    refetchInterval: (query) => {
      const rows = query.state.data as ShopifySyncLogRow[] | undefined;
      return rows && rows.length > 0 ? 5000 : false;
    },
    queryFn: async () => {
      if (!tenant?.id) {
        return [] as ShopifySyncLogRow[];
      }

      const { data, error } = await supabase
        .from("pos_sync_jobs_v2")
        .select("*")
        .eq("tenant_id", tenant.id)
        .eq("provider", "shopify")
        .in("status", [...LIGHTSPEED_ACTIVE_JOB_STATUSES])
        .order("created_at", { ascending: false })
        .limit(3);

      if (error) {
        throw error;
      }

      return (data ?? []).map(normalizeShopifySyncLogRow);
    },
  });

  const shopifyRecentJobsQuery = useQuery({
    queryKey: [
      "integration-detail-shopify-recent-sync-jobs",
      tenant?.id ?? null,
    ],
    enabled: isShopifyDashboardEnabled,
    queryFn: async () => {
      if (!tenant?.id) {
        return [] as ShopifySyncLogRow[];
      }

      const { data, error } = await supabase
        .from("pos_sync_jobs_v2")
        .select("*")
        .eq("tenant_id", tenant.id)
        .eq("provider", "shopify")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) {
        throw error;
      }

      return (data ?? []).map(normalizeShopifySyncLogRow);
    },
  });

  const squareCustomersQuery = useQuery({
    queryKey: [
      "integration-detail-square-customers",
      tenant?.id ?? null,
      resolved?.squareDetail?.connectionId ?? null,
      squareDashboardOptions.customers.page,
      squareDashboardOptions.customers.search,
      squareDashboardOptions.customers.sortField,
      squareDashboardOptions.customers.sortDirection,
    ],
    enabled: isSquareDashboardEnabled,
    queryFn: async () => {
      if (!tenant?.id || !resolved?.squareDetail?.connectionId) {
        return {
          rows: [] as SquareCustomerTableRow[],
          pagination: buildLightspeedPagination(1, 0),
        };
      }

      const { from, to, safePage } = getLightspeedPageRange(
        squareDashboardOptions.customers.page,
      );
      let request = supabase
        .from("pos_customers")
        .select("*", { count: "exact" })
        .eq("pos_connection_id", resolved.squareDetail.connectionId)
        .eq("pos_source", "square");

      if (squareDashboardOptions.customers.search) {
        const pattern = `%${squareDashboardOptions.customers.search.replace(/,/g, " ")}%`;
        request = request.or(
          [
            `name.ilike.${pattern}`,
            `email.ilike.${pattern}`,
            `phone.ilike.${pattern}`,
            `external_id.ilike.${pattern}`,
          ].join(","),
        );
      }

      request = request.order(squareDashboardOptions.customers.sortField, {
        ascending: squareDashboardOptions.customers.sortDirection === "asc",
        nullsFirst: false,
      });

      const { data, error, count } = await request.range(from, to);
      if (error) {
        throw error;
      }

      return {
        rows: (data ?? []).map((row) => ({
          ...row,
          displayName: formatSquareCustomerName(
            row.name,
            row.email,
            row.external_id,
          ),
          normalizedTags: row.tags ?? [],
        })),
        pagination: buildLightspeedPagination(safePage, count ?? 0),
      };
    },
  });

  const squareSalesQuery = useQuery({
    queryKey: [
      "integration-detail-square-sales",
      tenant?.id ?? null,
      resolved?.squareDetail?.connectionId ?? null,
      squareDashboardOptions.sales.page,
      squareDashboardOptions.sales.search,
      squareDashboardOptions.sales.status,
      squareDashboardOptions.sales.startDate,
      squareDashboardOptions.sales.endDate,
      squareDashboardOptions.sales.sortField,
      squareDashboardOptions.sales.sortDirection,
    ],
    enabled: isSquareDashboardEnabled,
    queryFn: async () => {
      if (!tenant?.id || !resolved?.squareDetail?.connectionId) {
        return {
          rows: [] as SquareSaleRow[],
          pagination: buildLightspeedPagination(1, 0),
        };
      }

      const { from, to, safePage } = getLightspeedPageRange(
        squareDashboardOptions.sales.page,
      );
      let request = supabase
        .from("pos_orders")
        .select("*", { count: "exact" })
        .eq("pos_connection_id", resolved.squareDetail.connectionId);

      if (squareDashboardOptions.sales.search) {
        const pattern = `%${squareDashboardOptions.sales.search}%`;
        request = request.or(
          [
            `external_id.ilike.${pattern}`,
            `external_customer_id.ilike.${pattern}`,
          ].join(","),
        );
      }

      if (squareDashboardOptions.sales.status !== "all") {
        request = request.eq("status", squareDashboardOptions.sales.status);
      }

      if (squareDashboardOptions.sales.startDate) {
        request = request.gte(
          "order_date",
          `${squareDashboardOptions.sales.startDate}T00:00:00.000Z`,
        );
      }

      if (squareDashboardOptions.sales.endDate) {
        request = request.lte(
          "order_date",
          `${squareDashboardOptions.sales.endDate}T23:59:59.999Z`,
        );
      }

      request = request.order(squareDashboardOptions.sales.sortField, {
        ascending: squareDashboardOptions.sales.sortDirection === "asc",
        nullsFirst: false,
      });

      const { data, error, count } = await request.range(from, to);
      if (error) {
        throw error;
      }

      const customerIds = Array.from(
        new Set(
          (data ?? [])
            .map((row) => row.pos_customer_id)
            .filter((value): value is string => Boolean(value)),
        ),
      );

      let customerNameMap = new Map<string, string>();

      if (customerIds.length > 0) {
        const { data: customerData, error: customerError } = await supabase
          .from("pos_customers")
          .select("id, name, email, external_id")
          .in("id", customerIds);

        if (customerError) {
          throw customerError;
        }

        customerNameMap = new Map(
          (customerData ?? []).map((row) => [
            row.id,
            formatSquareCustomerName(row.name, row.email, row.external_id),
          ]),
        );
      }

      return {
        rows: (data ?? []).map((row) => ({
          ...row,
          customerDisplayName: row.pos_customer_id
            ? (customerNameMap.get(row.pos_customer_id) ?? null)
            : null,
          lineItemCount: getJsonArrayLength(row.items),
          orderType: getSquareOrderType(row),
          automationFired: hasSquareAutomationFired(row.raw_data),
        })),
        pagination: buildLightspeedPagination(safePage, count ?? 0),
      };
    },
  });

  const squareSalesSummaryQuery = useQuery({
    queryKey: [
      "integration-detail-square-sales-summary",
      tenant?.id ?? null,
      resolved?.squareDetail?.connectionId ?? null,
      squareDashboardOptions.sales.search,
      squareDashboardOptions.sales.status,
      squareDashboardOptions.sales.startDate,
      squareDashboardOptions.sales.endDate,
    ],
    enabled: isSquareDashboardEnabled,
    queryFn: async () => {
      if (!tenant?.id || !resolved?.squareDetail?.connectionId) {
        return {
          revenue: 0,
          averageOrderValue: 0,
          saleCount: 0,
        } satisfies SquareSalesSummary;
      }

      let request = supabase
        .from("pos_orders")
        .select("id, total_amount")
        .eq("pos_connection_id", resolved.squareDetail.connectionId);

      if (squareDashboardOptions.sales.search) {
        const pattern = `%${squareDashboardOptions.sales.search}%`;
        request = request.or(
          [
            `external_id.ilike.${pattern}`,
            `external_customer_id.ilike.${pattern}`,
          ].join(","),
        );
      }

      if (squareDashboardOptions.sales.status !== "all") {
        request = request.eq("status", squareDashboardOptions.sales.status);
      }

      if (squareDashboardOptions.sales.startDate) {
        request = request.gte(
          "order_date",
          `${squareDashboardOptions.sales.startDate}T00:00:00.000Z`,
        );
      }

      if (squareDashboardOptions.sales.endDate) {
        request = request.lte(
          "order_date",
          `${squareDashboardOptions.sales.endDate}T23:59:59.999Z`,
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
      } satisfies SquareSalesSummary;
    },
  });

  const squareProductsQuery = useQuery({
    queryKey: [
      "integration-detail-square-products",
      tenant?.id ?? null,
      squareDashboardOptions.products.page,
      squareDashboardOptions.products.search,
      squareDashboardOptions.products.categories.join("|"),
      squareDashboardOptions.products.inStockOnly,
      squareDashboardOptions.products.sortField,
      squareDashboardOptions.products.sortDirection,
    ],
    enabled: isSquareDashboardEnabled,
    queryFn: async () => {
      if (!tenant?.id) {
        return {
          rows: [] as SquareProductTableRow[],
          pagination: buildLightspeedPagination(1, 0),
        };
      }

      const { from, to, safePage } = getLightspeedPageRange(
        squareDashboardOptions.products.page,
      );
      let request = supabase
        .from("products")
        .select("*", { count: "exact" })
        .eq("tenant_id", tenant.id)
        .eq("source", "square");

      if (squareDashboardOptions.products.search) {
        const pattern = `%${squareDashboardOptions.products.search}%`;
        request = request.or(
          [
            `name.ilike.${pattern}`,
            `sku.ilike.${pattern}`,
            `external_id.ilike.${pattern}`,
          ].join(","),
        );
      }

      if (squareDashboardOptions.products.categories.length > 0) {
        request = request.in(
          "category",
          squareDashboardOptions.products.categories,
        );
      }

      if (squareDashboardOptions.products.inStockOnly) {
        request = request.gt("inventory_count", 0);
      }

      request = request.order(squareDashboardOptions.products.sortField, {
        ascending: squareDashboardOptions.products.sortDirection === "asc",
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
          normalizedTags: row.tags ?? [],
        })),
        pagination: buildLightspeedPagination(safePage, count ?? 0),
      };
    },
  });

  const squareProductCategoriesQuery = useQuery({
    queryKey: [
      "integration-detail-square-product-categories",
      tenant?.id ?? null,
    ],
    enabled: isSquareDashboardEnabled,
    queryFn: async () => {
      if (!tenant?.id) {
        return [] as string[];
      }

      const { data, error } = await supabase
        .from("products")
        .select("category")
        .eq("tenant_id", tenant.id)
        .eq("source", "square")
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

  const squareSyncLogsQuery = useQuery({
    queryKey: [
      "integration-detail-square-sync-logs",
      tenant?.id ?? null,
      squareDashboardOptions.syncLogs.page,
      squareDashboardOptions.syncLogs.status,
    ],
    enabled: isSquareDashboardEnabled,
    queryFn: async () => {
      if (!tenant?.id) {
        return {
          rows: [] as SquareSyncLogRow[],
          pagination: buildLightspeedPagination(1, 0),
        };
      }

      const { from, to, safePage } = getLightspeedPageRange(
        squareDashboardOptions.syncLogs.page,
      );
      let request = supabase
        .from("pos_sync_jobs_v2")
        .select("*", { count: "exact" })
        .eq("tenant_id", tenant.id)
        .eq("provider", "square");

      if (squareDashboardOptions.syncLogs.status !== "all") {
        request = request.eq("status", squareDashboardOptions.syncLogs.status);
      }

      const { data, error, count } = await request
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

  const cloverCustomersQuery = useQuery({
    queryKey: [
      "integration-detail-clover",
      "customers",
      tenant?.id ?? null,
      resolved?.cloverDetail?.connectionId ?? null,
      cloverDashboardOptions.customers.page,
      cloverDashboardOptions.customers.search,
      cloverDashboardOptions.customers.sortField,
      cloverDashboardOptions.customers.sortDirection,
    ],
    enabled: isCloverDashboardEnabled,
    queryFn: async () => {
      if (!tenant?.id || !resolved?.cloverDetail?.connectionId) {
        return {
          rows: [] as CloverCustomerTableRow[],
          pagination: buildLightspeedPagination(1, 0),
        };
      }

      const { from, to, safePage } = getLightspeedPageRange(
        cloverDashboardOptions.customers.page,
      );
      let request = supabase
        .from("pos_customers")
        .select("*", { count: "exact" })
        .eq("pos_connection_id", resolved.cloverDetail.connectionId)
        .eq("pos_source", "clover");

      if (cloverDashboardOptions.customers.search) {
        const pattern = `%${cloverDashboardOptions.customers.search.replace(/,/g, " ")}%`;
        request = request.or(
          [
            `name.ilike.${pattern}`,
            `email.ilike.${pattern}`,
            `phone.ilike.${pattern}`,
            `external_id.ilike.${pattern}`,
          ].join(","),
        );
      }

      request = request.order(cloverDashboardOptions.customers.sortField, {
        ascending: cloverDashboardOptions.customers.sortDirection === "asc",
        nullsFirst: false,
      });

      const { data, error, count } = await request.range(from, to);
      if (error) {
        throw error;
      }

      return {
        rows: (data ?? []).map((row) => ({
          ...row,
          displayName: formatSquareCustomerName(
            row.name,
            row.email,
            row.external_id,
          ),
          normalizedTags: row.tags ?? [],
        })),
        pagination: buildLightspeedPagination(safePage, count ?? 0),
      };
    },
  });

  const cloverSalesQuery = useQuery({
    queryKey: [
      "integration-detail-clover",
      "sales",
      tenant?.id ?? null,
      resolved?.cloverDetail?.connectionId ?? null,
      cloverDashboardOptions.sales.page,
      cloverDashboardOptions.sales.search,
      cloverDashboardOptions.sales.status,
      cloverDashboardOptions.sales.startDate,
      cloverDashboardOptions.sales.endDate,
      cloverDashboardOptions.sales.sortField,
      cloverDashboardOptions.sales.sortDirection,
    ],
    enabled: isCloverDashboardEnabled,
    queryFn: async () => {
      if (!tenant?.id || !resolved?.cloverDetail?.connectionId) {
        return {
          rows: [] as CloverSaleRow[],
          pagination: buildLightspeedPagination(1, 0),
        };
      }

      const { from, to, safePage } = getLightspeedPageRange(
        cloverDashboardOptions.sales.page,
      );
      let request = supabase
        .from("pos_orders")
        .select("*", { count: "exact" })
        .eq("pos_connection_id", resolved.cloverDetail.connectionId);

      if (cloverDashboardOptions.sales.search) {
        const pattern = `%${cloverDashboardOptions.sales.search}%`;
        request = request.or(
          [
            `external_id.ilike.${pattern}`,
            `external_customer_id.ilike.${pattern}`,
          ].join(","),
        );
      }

      if (cloverDashboardOptions.sales.status !== "all") {
        request = request.eq("status", cloverDashboardOptions.sales.status);
      }

      if (cloverDashboardOptions.sales.startDate) {
        request = request.gte(
          "order_date",
          `${cloverDashboardOptions.sales.startDate}T00:00:00.000Z`,
        );
      }

      if (cloverDashboardOptions.sales.endDate) {
        request = request.lte(
          "order_date",
          `${cloverDashboardOptions.sales.endDate}T23:59:59.999Z`,
        );
      }

      request = request.order(cloverDashboardOptions.sales.sortField, {
        ascending: cloverDashboardOptions.sales.sortDirection === "asc",
        nullsFirst: false,
      });

      const { data, error, count } = await request.range(from, to);
      if (error) {
        throw error;
      }

      const customerIds = Array.from(
        new Set(
          (data ?? [])
            .map((row) => row.pos_customer_id)
            .filter((value): value is string => Boolean(value)),
        ),
      );

      let customerNameMap = new Map<string, string>();

      if (customerIds.length > 0) {
        const { data: customerData, error: customerError } = await supabase
          .from("pos_customers")
          .select("id, name, email, external_id")
          .in("id", customerIds);

        if (customerError) {
          throw customerError;
        }

        customerNameMap = new Map(
          (customerData ?? []).map((row) => [
            row.id,
            formatSquareCustomerName(row.name, row.email, row.external_id),
          ]),
        );
      }

      return {
        rows: (data ?? []).map((row) => ({
          ...row,
          customerDisplayName: row.pos_customer_id
            ? (customerNameMap.get(row.pos_customer_id) ?? null)
            : null,
          lineItemCount: getJsonArrayLength(row.items),
          orderType: getSquareOrderType(row),
        })),
        pagination: buildLightspeedPagination(safePage, count ?? 0),
      };
    },
  });

  const cloverSalesSummaryQuery = useQuery({
    queryKey: [
      "integration-detail-clover",
      "sales-summary",
      tenant?.id ?? null,
      resolved?.cloverDetail?.connectionId ?? null,
      cloverDashboardOptions.sales.search,
      cloverDashboardOptions.sales.status,
      cloverDashboardOptions.sales.startDate,
      cloverDashboardOptions.sales.endDate,
    ],
    enabled: isCloverDashboardEnabled,
    queryFn: async () => {
      if (!tenant?.id || !resolved?.cloverDetail?.connectionId) {
        return {
          revenue: 0,
          averageOrderValue: 0,
          saleCount: 0,
        } satisfies CloverSalesSummary;
      }

      let request = supabase
        .from("pos_orders")
        .select("id, total_amount")
        .eq("pos_connection_id", resolved.cloverDetail.connectionId);

      if (cloverDashboardOptions.sales.search) {
        const pattern = `%${cloverDashboardOptions.sales.search}%`;
        request = request.or(
          [
            `external_id.ilike.${pattern}`,
            `external_customer_id.ilike.${pattern}`,
          ].join(","),
        );
      }

      if (cloverDashboardOptions.sales.status !== "all") {
        request = request.eq("status", cloverDashboardOptions.sales.status);
      }

      if (cloverDashboardOptions.sales.startDate) {
        request = request.gte(
          "order_date",
          `${cloverDashboardOptions.sales.startDate}T00:00:00.000Z`,
        );
      }

      if (cloverDashboardOptions.sales.endDate) {
        request = request.lte(
          "order_date",
          `${cloverDashboardOptions.sales.endDate}T23:59:59.999Z`,
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
      } satisfies CloverSalesSummary;
    },
  });

  const cloverProductsQuery = useQuery({
    queryKey: [
      "integration-detail-clover",
      "products",
      tenant?.id ?? null,
      cloverDashboardOptions.products.page,
      cloverDashboardOptions.products.search,
      cloverDashboardOptions.products.categories.join("|"),
      cloverDashboardOptions.products.inStockOnly,
      cloverDashboardOptions.products.sortField,
      cloverDashboardOptions.products.sortDirection,
    ],
    enabled: isCloverDashboardEnabled,
    queryFn: async () => {
      if (!tenant?.id) {
        return {
          rows: [] as CloverProductTableRow[],
          pagination: buildLightspeedPagination(1, 0),
        };
      }

      const { from, to, safePage } = getLightspeedPageRange(
        cloverDashboardOptions.products.page,
      );
      let request = supabase
        .from("products")
        .select("*", { count: "exact" })
        .eq("tenant_id", tenant.id)
        .eq("source", "clover");

      if (cloverDashboardOptions.products.search) {
        const pattern = `%${cloverDashboardOptions.products.search}%`;
        request = request.or(
          [
            `name.ilike.${pattern}`,
            `sku.ilike.${pattern}`,
            `external_id.ilike.${pattern}`,
          ].join(","),
        );
      }

      if (cloverDashboardOptions.products.categories.length > 0) {
        request = request.in(
          "category",
          cloverDashboardOptions.products.categories,
        );
      }

      if (cloverDashboardOptions.products.inStockOnly) {
        request = request.gt("inventory_count", 0);
      }

      request = request.order(cloverDashboardOptions.products.sortField, {
        ascending: cloverDashboardOptions.products.sortDirection === "asc",
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
          normalizedTags: row.tags ?? [],
        })),
        pagination: buildLightspeedPagination(safePage, count ?? 0),
      };
    },
  });

  const cloverProductCategoriesQuery = useQuery({
    queryKey: [
      "integration-detail-clover",
      "product-categories",
      tenant?.id ?? null,
    ],
    enabled: isCloverDashboardEnabled,
    queryFn: async () => {
      if (!tenant?.id) {
        return [] as string[];
      }

      const { data, error } = await supabase
        .from("products")
        .select("category")
        .eq("tenant_id", tenant.id)
        .eq("source", "clover")
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

  const cloverSyncLogsQuery = useQuery({
    queryKey: [
      "integration-detail-clover",
      "sync-logs",
      tenant?.id ?? null,
      cloverDashboardOptions.syncLogs.page,
      cloverDashboardOptions.syncLogs.status,
    ],
    enabled: isCloverDashboardEnabled,
    queryFn: async () => {
      if (!tenant?.id) {
        return {
          rows: [] as CloverSyncLogRow[],
          pagination: buildLightspeedPagination(1, 0),
        };
      }

      const { from, to, safePage } = getLightspeedPageRange(
        cloverDashboardOptions.syncLogs.page,
      );
      let request = supabase
        .from("pos_sync_jobs_v2")
        .select("*", { count: "exact" })
        .eq("tenant_id", tenant.id)
        .eq("provider", "clover");

      if (cloverDashboardOptions.syncLogs.status !== "all") {
        request = request.eq("status", cloverDashboardOptions.syncLogs.status);
      }

      const { data, error, count } = await request
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

  const cloverConnectionTestsQuery = useQuery({
    queryKey: [
      "integration-detail-clover",
      "connection-tests",
      tenant?.id ?? null,
      resolved?.cloverDetail?.connectionId ?? null,
      cloverDashboardOptions.connectionTests.page,
    ],
    enabled: isCloverDashboardEnabled,
    queryFn: async () => {
      if (!tenant?.id || !resolved?.cloverDetail?.connectionId) {
        return {
          rows: [] as CloverConnectionTestHistoryRow[],
          pagination: buildLightspeedPagination(1, 0),
        };
      }

      const { from, to, safePage } = getLightspeedPageRange(
        cloverDashboardOptions.connectionTests.page,
      );

      const { data, error, count } = await supabase
        .from("clover_connection_tests")
        .select("*", { count: "exact" })
        .eq("tenant_id", tenant.id)
        .eq("connection_id", resolved.cloverDetail.connectionId)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        throw error;
      }

      return {
        rows: (data ?? []).map((row) => ({
          ...row,
          report: parseCloverConnectionTestReport(row),
        })),
        pagination: buildLightspeedPagination(safePage, count ?? 0),
      };
    },
  });

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
      const searchTerm = lightspeedDashboardOptions.customers.search.replace(
        /,/g,
        " ",
      );
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
            ascending:
              lightspeedDashboardOptions.customers.sortDirection === "asc",
            nullsFirst: false,
          })
          .order("last_name", {
            ascending:
              lightspeedDashboardOptions.customers.sortDirection === "asc",
            nullsFirst: false,
          });
      } else {
        request = request.order(
          lightspeedDashboardOptions.customers.sortField,
          {
            ascending:
              lightspeedDashboardOptions.customers.sortDirection === "asc",
            nullsFirst: false,
          },
        );
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
      lightspeedDashboardOptions.sales.search,
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

      if (lightspeedDashboardOptions.sales.search) {
        request = request.ilike(
          "lightspeed_sale_id",
          `%${lightspeedDashboardOptions.sales.search}%`,
        );
      }

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

      const customerIds = Array.from(
        new Set(
          (data ?? [])
            .map((row) => row.lightspeed_customer_id)
            .filter((value): value is string => Boolean(value)),
        ),
      );

      let customerNameMap = new Map<string, string>();

      if (customerIds.length > 0) {
        const { data: customerData, error: customerError } = await supabase
          .from("lightspeed_customers")
          .select("lightspeed_customer_id, first_name, last_name, email")
          .eq("tenant_id", tenant.id)
          .in("lightspeed_customer_id", customerIds);

        if (customerError) {
          throw customerError;
        }

        customerNameMap = new Map(
          (customerData ?? []).map((row) => [
            row.lightspeed_customer_id,
            formatLightspeedCustomerName(
              row.first_name,
              row.last_name,
              row.email,
              row.lightspeed_customer_id,
            ),
          ]),
        );
      }

      return {
        rows: (data ?? []).map((row) => ({
          ...row,
          customerDisplayName: row.lightspeed_customer_id
            ? (customerNameMap.get(row.lightspeed_customer_id) ?? null)
            : null,
          lineItemCount: getJsonArrayLength(row.line_items),
        })),
        pagination: buildLightspeedPagination(safePage, count ?? 0),
      };
    },
  });

  const lightspeedSalesSummaryQuery = useQuery({
    queryKey: [
      "integration-detail-lightspeed-sales-summary",
      tenant?.id ?? null,
      lightspeedDashboardOptions.sales.search,
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

      if (lightspeedDashboardOptions.sales.search) {
        request = request.ilike(
          "lightspeed_sale_id",
          `%${lightspeedDashboardOptions.sales.search}%`,
        );
      }

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
      lightspeedDashboardOptions.products.search,
      lightspeedDashboardOptions.products.categories.join("|"),
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

      if (lightspeedDashboardOptions.products.search) {
        const pattern = `%${lightspeedDashboardOptions.products.search}%`;
        request = request.or(
          [`name.ilike.${pattern}`, `sku.ilike.${pattern}`].join(","),
        );
      }

      if (lightspeedDashboardOptions.products.categories.length > 0) {
        request = request.in(
          "category",
          lightspeedDashboardOptions.products.categories,
        );
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
          normalizedTags: normalizeJsonStringList(row.tags),
        })),
        pagination: buildLightspeedPagination(safePage, count ?? 0),
      };
    },
  });

  const lightspeedProductCategoriesQuery = useQuery({
    queryKey: [
      "integration-detail-lightspeed-product-categories",
      tenant?.id ?? null,
    ],
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
      lightspeedDashboardOptions.syncLogs.status,
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
      let request = supabase
        .from("pos_sync_jobs_v2")
        .select("*", { count: "exact" })
        .eq("tenant_id", tenant.id)
        .eq("provider", "lightspeed");

      if (lightspeedDashboardOptions.syncLogs.status !== "all") {
        request = request.eq(
          "status",
          lightspeedDashboardOptions.syncLogs.status,
        );
      }

      const { data, error, count } = await request
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
      .channel(
        `lightspeed-sync-jobs-${tenant.id}-${lightspeedTrackedJobIds.join("-")}`,
      )
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
        throw new Error(
          "Notify me is only available for coming-soon integrations.",
        );
      }

      if (!user?.id || !tenant?.id) {
        throw new Error(
          "You must be signed in with an active organization before requesting updates.",
        );
      }

      const email = user.email?.trim();

      if (!email) {
        throw new Error(
          "Your account email is required before we can notify you.",
        );
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
      const message = getUserFacingIntegrationError(
        error,
        "We couldn't save your notification request.",
      );
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
        queryClient.invalidateQueries({
          queryKey: ["integration-detail", slug],
        }),
        queryClient.invalidateQueries({ queryKey: ["integrations-hub"] }),
        queryClient.invalidateQueries({
          queryKey: ["mailchimp-connection-summary"],
        }),
      ]);
    },
    onError: (error) => {
      const message = getUserFacingIntegrationError(
        error,
        "Email infrastructure health check failed.",
      );
      toast.error(message);
    },
  });

  const squareSyncMutation = useMutation({
    mutationFn: async () => {
      if (slug !== "square") {
        throw new Error(
          "Square sync is only available on the Square detail page.",
        );
      }

      if (!resolved?.squareDetail?.connectionId) {
        throw new Error("Connect Square before starting a sync.");
      }

      const { data, error } =
        await supabase.functions.invoke("square-full-sync");

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
      const message = getUserFacingIntegrationError(
        error,
        "Square sync could not be started.",
      );
      toast.error(message);
    },
  });

  const shopifySyncMutation = useMutation({
    mutationFn: async () => {
      if (slug !== "shopify") {
        throw new Error(
          "Shopify sync is only available on the Shopify detail page.",
        );
      }

      if (!resolved?.shopifyConnection?.id) {
        throw new Error("Connect Shopify before starting a sync.");
      }

      const { data, error } =
        await supabase.functions.invoke("shopify-full-sync");

      if (error) {
        throw error;
      }

      if (!Array.isArray(data?.jobs) || data.jobs.length === 0) {
        throw new Error("Shopify sync could not be started.");
      }

      return data;
    },
    onSuccess: async (data) => {
      if (data.errors?.length) {
        toast.info(
          summarizeUserFacingIntegrationWarnings(
            data.errors,
            "Shopify sync queued with warnings.",
          ),
        );
      } else {
        toast.info("Shopify sync queued. Background jobs have started.");
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["integration-detail"] }),
        queryClient.invalidateQueries({ queryKey: ["integrations-hub"] }),
        queryClient.invalidateQueries({
          queryKey: ["integration-detail-shopify-active-sync-jobs"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["integration-detail-shopify-recent-sync-jobs"],
        }),
      ]);
    },
    onError: (error) => {
      const message = getUserFacingIntegrationError(
        error,
        "Shopify sync could not be started.",
      );
      toast.error(message);
    },
  });

  const verifySquareWebhooksMutation = useMutation({
    mutationFn: async () => {
      if (slug !== "square") {
        throw new Error(
          "Webhook verification is only available on the Square detail page.",
        );
      }

      if (!resolved?.squareDetail?.connectionId) {
        throw new Error("Connect Square before verifying webhooks.");
      }

      const { data, error } = await supabase.functions.invoke(
        "square-manage-webhooks",
        {
          body: { action: "verify" },
        },
      );

      if (error) {
        throw error;
      }

      if (!data?.success) {
        throw new Error(
          data?.message ?? data?.error ?? "Square webhook verification failed.",
        );
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
      const message = getUserFacingIntegrationError(
        error,
        "Square webhook verification failed.",
      );
      toast.error(message);
    },
  });

  const verifyShopifyWebhooksMutation = useMutation({
    mutationFn: async () => {
      if (slug !== "shopify") {
        throw new Error(
          "Webhook verification is only available on the Shopify detail page.",
        );
      }

      if (!resolved?.shopifyConnection?.id) {
        throw new Error("Connect Shopify before verifying webhooks.");
      }

      const { data, error } = await supabase.functions.invoke(
        "shopify-manage-webhooks",
        {
          body: { action: "verify" },
        },
      );

      if (error) {
        throw error;
      }

      if (!data?.success) {
        throw new Error(
          data?.message ??
            data?.error ??
            "Shopify webhook verification failed.",
        );
      }

      return data;
    },
    onSuccess: async (data) => {
      toast.success(data?.message ?? "Shopify webhooks verified.");

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["integration-detail"] }),
        queryClient.invalidateQueries({ queryKey: ["integrations-hub"] }),
      ]);
    },
    onError: (error) => {
      const message = getUserFacingIntegrationError(
        error,
        "Shopify webhook verification failed.",
      );
      toast.error(message);
    },
  });

  const cloverSyncMutation = useMutation({
    mutationFn: async () => {
      if (slug !== "clover") {
        throw new Error(
          "Clover sync is only available on the Clover detail page.",
        );
      }

      if (!resolved?.cloverDetail?.connectionId) {
        throw new Error("Connect Clover before starting a sync.");
      }

      const { data, error } = await supabase.functions.invoke(
        "clover-sync-customers",
      );

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: async () => {
      toast.success("Clover sync started.");

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["integration-detail"] }),
        queryClient.invalidateQueries({
          queryKey: ["integration-detail-clover"],
        }),
        queryClient.invalidateQueries({ queryKey: ["integrations-hub"] }),
      ]);
    },
    onError: (error) => {
      const message = getUserFacingIntegrationError(
        error,
        "Clover sync could not be started.",
      );
      toast.error(message);
    },
  });

  const cloverConnectionTestMutation = useMutation({
    mutationFn: async () => {
      if (slug !== "clover") {
        throw new Error(
          "Connection testing is only available on the Clover detail page.",
        );
      }

      if (!resolved?.cloverDetail?.connectionId) {
        throw new Error("Connect Clover before running a connection test.");
      }

      const { data, error } = await supabase.functions.invoke(
        "clover-test-harness",
        {
          body: { date_range_days: 30 },
        },
      );

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: async (data) => {
      toast.success(data?.summary ?? "Clover connection test completed.");

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["integration-detail"] }),
        queryClient.invalidateQueries({
          queryKey: ["integration-detail-clover"],
        }),
        queryClient.invalidateQueries({ queryKey: ["integrations-hub"] }),
      ]);
    },
    onError: (error) => {
      const message = getUserFacingIntegrationError(
        error,
        "Clover connection test could not be completed.",
      );
      toast.error(message);
    },
  });

  const lightspeedSyncMutation = useMutation({
    mutationFn: async () => {
      if (slug !== "lightspeed") {
        throw new Error(
          "Lightspeed sync is only available on the Lightspeed detail page.",
        );
      }

      if (!resolved?.lightspeedDetail?.connectionId) {
        throw new Error("Connect Lightspeed before starting a sync.");
      }

      const { data, error } = await supabase.functions.invoke(
        "lightspeed-full-sync",
      );

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
          summarizeUserFacingIntegrationWarnings(
            data.errors,
            "Lightspeed sync queued with warnings. Some records may need attention.",
          ),
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
      const message = getUserFacingIntegrationError(
        error,
        "Lightspeed sync could not be started.",
      );
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
          : (lightspeedSyncLogsQuery.data?.rows.length ??
              LIGHTSPEED_DASHBOARD_PAGE_SIZE),
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
          lightspeedCustomersQuery.data?.pagination ??
          buildLightspeedPagination(1, 0),
        isLoading: lightspeedCustomersQuery.isLoading,
        isFetching: lightspeedCustomersQuery.isFetching,
      },
      sales: {
        rows: lightspeedSalesQuery.data?.rows ?? [],
        pagination:
          lightspeedSalesQuery.data?.pagination ??
          buildLightspeedPagination(1, 0),
        summary: lightspeedSalesSummaryQuery.data ?? {
          revenue: 0,
          averageOrderValue: 0,
          saleCount: 0,
        },
        isLoading:
          lightspeedSalesQuery.isLoading ||
          lightspeedSalesSummaryQuery.isLoading,
        isFetching:
          lightspeedSalesQuery.isFetching ||
          lightspeedSalesSummaryQuery.isFetching,
      },
      products: {
        rows: lightspeedProductsQuery.data?.rows ?? [],
        pagination:
          lightspeedProductsQuery.data?.pagination ??
          buildLightspeedPagination(1, 0),
        categories: lightspeedProductCategoriesQuery.data ?? [],
        isLoading:
          lightspeedProductsQuery.isLoading ||
          lightspeedProductCategoriesQuery.isLoading,
        isFetching:
          lightspeedProductsQuery.isFetching ||
          lightspeedProductCategoriesQuery.isFetching,
      },
      syncLogs: {
        rows: lightspeedSyncLogRows,
        pagination:
          lightspeedSyncLogsQuery.data?.pagination ??
          buildLightspeedPagination(1, 0),
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

  const squareDashboard = useMemo<SquareDashboardData | null>(() => {
    if (!isSquareDashboardEnabled) {
      return null;
    }

    return {
      customers: {
        rows: squareCustomersQuery.data?.rows ?? [],
        pagination:
          squareCustomersQuery.data?.pagination ??
          buildLightspeedPagination(1, 0),
        isLoading: squareCustomersQuery.isLoading,
        isFetching: squareCustomersQuery.isFetching,
      },
      sales: {
        rows: squareSalesQuery.data?.rows ?? [],
        pagination:
          squareSalesQuery.data?.pagination ?? buildLightspeedPagination(1, 0),
        summary: squareSalesSummaryQuery.data ?? {
          revenue: 0,
          averageOrderValue: 0,
          saleCount: 0,
        },
        isLoading:
          squareSalesQuery.isLoading || squareSalesSummaryQuery.isLoading,
        isFetching:
          squareSalesQuery.isFetching || squareSalesSummaryQuery.isFetching,
      },
      products: {
        rows: squareProductsQuery.data?.rows ?? [],
        pagination:
          squareProductsQuery.data?.pagination ??
          buildLightspeedPagination(1, 0),
        categories: squareProductCategoriesQuery.data ?? [],
        isLoading:
          squareProductsQuery.isLoading ||
          squareProductCategoriesQuery.isLoading,
        isFetching:
          squareProductsQuery.isFetching ||
          squareProductCategoriesQuery.isFetching,
      },
      syncLogs: {
        rows: squareSyncLogsQuery.data?.rows ?? [],
        pagination:
          squareSyncLogsQuery.data?.pagination ??
          buildLightspeedPagination(1, 0),
        isLoading: squareSyncLogsQuery.isLoading,
        isFetching: squareSyncLogsQuery.isFetching,
      },
    };
  }, [
    isSquareDashboardEnabled,
    squareCustomersQuery.data?.pagination,
    squareCustomersQuery.data?.rows,
    squareCustomersQuery.isFetching,
    squareCustomersQuery.isLoading,
    squareProductCategoriesQuery.data,
    squareProductCategoriesQuery.isFetching,
    squareProductCategoriesQuery.isLoading,
    squareProductsQuery.data?.pagination,
    squareProductsQuery.data?.rows,
    squareProductsQuery.isFetching,
    squareProductsQuery.isLoading,
    squareSalesQuery.data?.pagination,
    squareSalesQuery.data?.rows,
    squareSalesQuery.isFetching,
    squareSalesQuery.isLoading,
    squareSalesSummaryQuery.data,
    squareSalesSummaryQuery.isFetching,
    squareSalesSummaryQuery.isLoading,
    squareSyncLogsQuery.data?.pagination,
    squareSyncLogsQuery.data?.rows,
    squareSyncLogsQuery.isFetching,
    squareSyncLogsQuery.isLoading,
  ]);

  const cloverDashboard = useMemo<CloverDashboardData | null>(() => {
    if (!isCloverDashboardEnabled) {
      return null;
    }

    const latestConnectionTest =
      cloverConnectionTestsQuery.data?.rows[0] ?? null;

    return {
      customers: {
        rows: cloverCustomersQuery.data?.rows ?? [],
        pagination:
          cloverCustomersQuery.data?.pagination ??
          buildLightspeedPagination(1, 0),
        isLoading: cloverCustomersQuery.isLoading,
        isFetching: cloverCustomersQuery.isFetching,
      },
      sales: {
        rows: cloverSalesQuery.data?.rows ?? [],
        pagination:
          cloverSalesQuery.data?.pagination ?? buildLightspeedPagination(1, 0),
        summary: cloverSalesSummaryQuery.data ?? {
          revenue: 0,
          averageOrderValue: 0,
          saleCount: 0,
        },
        isLoading:
          cloverSalesQuery.isLoading || cloverSalesSummaryQuery.isLoading,
        isFetching:
          cloverSalesQuery.isFetching || cloverSalesSummaryQuery.isFetching,
      },
      products: {
        rows: cloverProductsQuery.data?.rows ?? [],
        pagination:
          cloverProductsQuery.data?.pagination ??
          buildLightspeedPagination(1, 0),
        categories: cloverProductCategoriesQuery.data ?? [],
        isLoading:
          cloverProductsQuery.isLoading ||
          cloverProductCategoriesQuery.isLoading,
        isFetching:
          cloverProductsQuery.isFetching ||
          cloverProductCategoriesQuery.isFetching,
      },
      syncLogs: {
        rows: cloverSyncLogsQuery.data?.rows ?? [],
        pagination:
          cloverSyncLogsQuery.data?.pagination ??
          buildLightspeedPagination(1, 0),
        isLoading: cloverSyncLogsQuery.isLoading,
        isFetching: cloverSyncLogsQuery.isFetching,
      },
      connectionTests: {
        rows: cloverConnectionTestsQuery.data?.rows ?? [],
        latestReport: latestConnectionTest?.report ?? null,
        latestTestedAt: latestConnectionTest?.created_at ?? null,
        pagination:
          cloverConnectionTestsQuery.data?.pagination ??
          buildLightspeedPagination(1, 0),
        isLoading: cloverConnectionTestsQuery.isLoading,
        isFetching: cloverConnectionTestsQuery.isFetching,
      },
    };
  }, [
    cloverConnectionTestsQuery.data?.pagination,
    cloverConnectionTestsQuery.data?.rows,
    cloverConnectionTestsQuery.isFetching,
    cloverConnectionTestsQuery.isLoading,
    cloverCustomersQuery.data?.pagination,
    cloverCustomersQuery.data?.rows,
    cloverCustomersQuery.isFetching,
    cloverCustomersQuery.isLoading,
    cloverProductCategoriesQuery.data,
    cloverProductCategoriesQuery.isFetching,
    cloverProductCategoriesQuery.isLoading,
    cloverProductsQuery.data?.pagination,
    cloverProductsQuery.data?.rows,
    cloverProductsQuery.isFetching,
    cloverProductsQuery.isLoading,
    cloverSalesQuery.data?.pagination,
    cloverSalesQuery.data?.rows,
    cloverSalesQuery.isFetching,
    cloverSalesQuery.isLoading,
    cloverSalesSummaryQuery.data,
    cloverSalesSummaryQuery.isFetching,
    cloverSalesSummaryQuery.isLoading,
    cloverSyncLogsQuery.data?.pagination,
    cloverSyncLogsQuery.data?.rows,
    cloverSyncLogsQuery.isFetching,
    cloverSyncLogsQuery.isLoading,
    isCloverDashboardEnabled,
  ]);

  const shopifyDashboard = useMemo<ShopifyDashboardData | null>(() => {
    if (!isShopifyDashboardEnabled) {
      return null;
    }

    return {
      customers: {
        rows: shopifyCustomersQuery.data?.rows ?? [],
        pagination:
          shopifyCustomersQuery.data?.pagination ??
          buildLightspeedPagination(1, 0),
        isLoading: shopifyCustomersQuery.isLoading,
        isFetching: shopifyCustomersQuery.isFetching,
      },
      orders: {
        rows: shopifyOrdersQuery.data?.rows ?? [],
        pagination:
          shopifyOrdersQuery.data?.pagination ??
          buildLightspeedPagination(1, 0),
        summary: shopifyOrdersSummaryQuery.data ?? {
          revenue: 0,
          averageOrderValue: 0,
          saleCount: 0,
        },
        isLoading:
          shopifyOrdersQuery.isLoading || shopifyOrdersSummaryQuery.isLoading,
        isFetching:
          shopifyOrdersQuery.isFetching || shopifyOrdersSummaryQuery.isFetching,
      },
      products: {
        rows: shopifyProductsQuery.data?.rows ?? [],
        pagination:
          shopifyProductsQuery.data?.pagination ??
          buildLightspeedPagination(1, 0),
        categories: shopifyProductTypesQuery.data ?? [],
        isLoading:
          shopifyProductsQuery.isLoading || shopifyProductTypesQuery.isLoading,
        isFetching:
          shopifyProductsQuery.isFetching ||
          shopifyProductTypesQuery.isFetching,
      },
      syncLogs: {
        rows: shopifySyncLogsQuery.data?.rows ?? [],
        pagination:
          shopifySyncLogsQuery.data?.pagination ??
          buildLightspeedPagination(1, 0),
        isLoading: shopifySyncLogsQuery.isLoading,
        isFetching: shopifySyncLogsQuery.isFetching,
      },
    };
  }, [
    isShopifyDashboardEnabled,
    shopifyCustomersQuery.data?.pagination,
    shopifyCustomersQuery.data?.rows,
    shopifyCustomersQuery.isFetching,
    shopifyCustomersQuery.isLoading,
    shopifyOrdersQuery.data?.pagination,
    shopifyOrdersQuery.data?.rows,
    shopifyOrdersQuery.isFetching,
    shopifyOrdersQuery.isLoading,
    shopifyOrdersSummaryQuery.data,
    shopifyOrdersSummaryQuery.isFetching,
    shopifyOrdersSummaryQuery.isLoading,
    shopifyProductsQuery.data?.pagination,
    shopifyProductsQuery.data?.rows,
    shopifyProductsQuery.isFetching,
    shopifyProductsQuery.isLoading,
    shopifyProductTypesQuery.data,
    shopifyProductTypesQuery.isFetching,
    shopifyProductTypesQuery.isLoading,
    shopifySyncLogsQuery.data?.pagination,
    shopifySyncLogsQuery.data?.rows,
    shopifySyncLogsQuery.isFetching,
    shopifySyncLogsQuery.isLoading,
  ]);

  const lightspeedActiveJobIds = useMemo(() => {
    return lightspeedSyncJobs
      .filter((job) => job.status === "in_progress" && !job.isStale)
      .map((job) => job.id);
  }, [lightspeedSyncJobs]);

  const shopifySyncJobs = shopifyActiveJobsQuery.data ?? [];

  const shopifyActiveJobIds = useMemo(() => {
    return shopifySyncJobs
      .filter((job) => !job.isTerminal)
      .map((job) => job.id);
  }, [shopifySyncJobs]);

  const shopifySyncState: LightspeedSyncState = shopifySyncMutation.isPending
    ? "triggering"
    : shopifyActiveJobIds.length > 0
      ? "syncing"
      : "idle";

  const lightspeedSyncState: LightspeedSyncState =
    lightspeedSyncMutation.isPending
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
        throw new Error(
          "Meta authorization is only available on the Meta detail page.",
        );
      }

      await launchMetaAuthorizationFlow();
    },
    onSuccess: () => {
      toast.success("Meta authorization opened in a new tab.");
    },
    onError: (error) => {
      const message = getUserFacingIntegrationError(
        error,
        "Meta authorization could not be started.",
      );
      toast.error(message);
    },
  });

  const metaAssetRefreshMutation = useMutation({
    mutationFn: async () => {
      if (slug !== "meta") {
        throw new Error(
          "Meta asset refresh is only available on the Meta detail page.",
        );
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
      const message = getUserFacingIntegrationError(
        error,
        "Meta asset refresh could not be started.",
      );
      toast.error(message);
    },
  });

  const ga4ConnectionTestMutation = useMutation({
    mutationFn: async () => {
      if (slug !== "google-analytics") {
        throw new Error(
          "Connection testing is only available on the Google Analytics detail page.",
        );
      }

      if (!tenant?.id || !user?.id) {
        throw new Error(
          "A tenant-scoped user context is required to test Google Analytics.",
        );
      }

      if (!resolved?.ga4Detail?.propertyId) {
        throw new Error(
          "Connect Google Analytics before running a connection test.",
        );
      }

      const testedAt = new Date().toISOString();

      try {
        const { data, error } = await supabase.functions.invoke(
          "ga-report-data",
          {
            body: {
              propertyId: resolved.ga4Detail.propertyId,
              dateRange: 7,
            },
          },
        );

        if (error) {
          throw error;
        }

        if (!data?.success) {
          throw new Error("Google Analytics connection test failed.");
        }

        if (resolved.ga4Detail.connectionId) {
          const { error: updateError } = await supabase
            .from("google_analytics_settings")
            .update({
              last_test_at: testedAt,
              last_test_status: "success",
              last_test_message:
                "Property accessible · Sessions data available",
            })
            .eq("id", resolved.ga4Detail.connectionId)
            .eq("tenant_id", tenant.id)
            .eq("user_id", user.id);

          if (updateError) {
            throw updateError;
          }
        }

        return data;
      } catch (error) {
        if (resolved.ga4Detail.connectionId) {
          await supabase
            .from("google_analytics_settings")
            .update({
              last_test_at: testedAt,
              last_test_status: "error",
              last_test_message: getUserFacingIntegrationError(
                error,
                "Google Analytics connection test failed.",
              ),
            })
            .eq("id", resolved.ga4Detail.connectionId)
            .eq("tenant_id", tenant.id)
            .eq("user_id", user.id);
        }

        throw error;
      }
    },
    onSuccess: async () => {
      toast.success("Google Analytics connection test completed.");

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["integration-detail"] }),
        queryClient.invalidateQueries({ queryKey: ["integrations-hub"] }),
      ]);
    },
    onError: async (error) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["integration-detail"] }),
        queryClient.invalidateQueries({ queryKey: ["integrations-hub"] }),
      ]);

      const message = getUserFacingIntegrationError(
        error,
        "Google Analytics connection test failed.",
      );
      toast.error(message);
    },
  });

  const ga4ReauthorizationMutation = useMutation({
    mutationFn: async () => {
      if (slug !== "google-analytics") {
        throw new Error(
          "Reauthorization is only available on the Google Analytics detail page.",
        );
      }

      if (!resolved?.ga4Detail?.propertyId) {
        throw new Error(
          "A GA4 property ID is required before reauthorizing Google Analytics.",
        );
      }

      const { data, error } = await supabase.functions.invoke(
        "oauth-initiate",
        {
          body: { propertyId: resolved.ga4Detail.propertyId },
        },
      );

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
      const message = getUserFacingIntegrationError(
        error,
        "Google Analytics authorization could not be started.",
      );
      toast.error(message);
    },
  });

  const lightspeedResetMutation = useMutation({
    mutationFn: async () => {
      if (slug !== "lightspeed") {
        throw new Error(
          "Reset is only available on the Lightspeed detail page.",
        );
      }

      if (!isSuperAdmin) {
        throw new Error("Only site admins can reset Lightspeed synced data.");
      }

      const { data, error } = await supabase.functions.invoke(
        "lightspeed-reset-tenant",
      );

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(
          data.message ?? "Unable to reset Lightspeed synced data.",
        );
      }

      return data as {
        success: boolean;
        tenantId: string;
        counts: {
          customers: number;
          sales: number;
          products: number;
          syncJobs: number;
          connections: number;
        };
        message: string;
      };
    },
    onSuccess: async (data) => {
      setLightspeedTrackedJobIds([]);
      setLightspeedJobRowsById({});
      setShouldToastLightspeedCompletion(false);
      lastLightspeedTerminalToastRef.current = null;

      const counts = data?.counts;
      const countSummary = [
        counts?.customers
          ? `${counts.customers.toLocaleString()} customer${counts.customers === 1 ? "" : "s"}`
          : null,
        counts?.sales
          ? `${counts.sales.toLocaleString()} sale${counts.sales === 1 ? "" : "s"}`
          : null,
        counts?.products
          ? `${counts.products.toLocaleString()} product${counts.products === 1 ? "" : "s"}`
          : null,
        counts?.syncJobs
          ? `${counts.syncJobs.toLocaleString()} sync log${counts.syncJobs === 1 ? "" : "s"}`
          : null,
      ]
        .filter(Boolean)
        .join(", ");

      toast.success(
        countSummary
          ? `Lightspeed synced data reset for this tenant. Removed ${countSummary}.`
          : "Lightspeed synced data reset for this tenant.",
      );

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["integration-detail"] }),
        queryClient.invalidateQueries({ queryKey: ["integrations-hub"] }),
      ]);
    },
    onError: (error) => {
      toast.error(
        getUserFacingIntegrationError(
          error,
          "Unable to reset Lightspeed synced data.",
        ),
      );
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
        case "shopify": {
          const { data, error } =
            await supabase.functions.invoke("shopify-disconnect");

          if (error) throw error;
          if (data?.error) {
            throw new Error(data.message ?? "Disconnect failed.");
          }

          return;
        }
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
            .eq("tenant_id", tenant?.id ?? "")
            .eq("user_id", user.id);

          if (error) throw error;
          return;
        }
      }
    },
    onSuccess: async () => {
      if (slug === "shopify") {
        toast.success("Shopify disconnected successfully");
      } else if (slug === "mailchimp") {
        toast.success("Mailchimp disconnected successfully");
      } else if (resolved?.item) {
        toast.success(`${resolved.item.name} disconnected.`);
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["integration-detail", slug],
        }),
        queryClient.invalidateQueries({ queryKey: ["integrations-hub"] }),
      ]);
    },
    onError: (error) => {
      const message = getUserFacingIntegrationError(
        error,
        "Disconnect failed.",
      );
      toast.error(message);
    },
  });

  const marketingImportValidationMutation = useMutation({
    mutationFn: async () => {
      if (resolved?.item?.slug !== "klaviyo") {
        throw new Error("Connection validation is only available for Klaviyo.");
      }

      const { data, error } = await supabase.functions.invoke(
        "klaviyo-fetch-lists",
      );

      if (error) throw error;
      if (data?.error) {
        throw new Error(data.error);
      }

      return data as { lists?: unknown[] } | null;
    },
    onSuccess: async (data) => {
      const listCount = Array.isArray(data?.lists) ? data.lists.length : 0;
      toast.success(
        listCount > 0
          ? `Klaviyo connection validated. ${listCount} list${listCount === 1 ? "" : "s"} available.`
          : "Klaviyo connection validated.",
      );

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["integration-detail", slug],
        }),
        queryClient.invalidateQueries({ queryKey: ["integrations-hub"] }),
      ]);
    },
    onError: (error) => {
      toast.error(
        getUserFacingIntegrationError(
          error,
          "Unable to validate the Klaviyo connection.",
        ),
      );
    },
  });

  return {
    isValidSlug: Boolean(seed),
    item: resolved?.item ?? null,
    model: resolved?.model ?? null,
    comingSoonDetail,
    shopifyConnection: resolved?.shopifyConnection ?? null,
    shopifyDashboard,
    squareDetail: resolved?.squareDetail ?? null,
    squareDashboard,
    cloverDetail: resolved?.cloverDetail ?? null,
    cloverDashboard,
    lightspeedDetail: resolved?.lightspeedDetail ?? null,
    lightspeedDashboard,
    metaDetail: resolved?.metaDetail ?? null,
    ga4Detail: resolved?.ga4Detail ?? null,
    marketingImportDetail: resolved?.marketingImportDetail ?? null,
    emailInfrastructureDetail: resolved?.emailInfrastructureDetail ?? null,
    targetPath: resolved?.targetPath,
    requestPath: resolved?.requestPath,
    canUseActions:
      !isComingSoonIntegrationSlug(resolved?.item?.slug ?? null) &&
      hasRole("member"),
    canAccessLightspeedAdminFeatures:
      resolved?.item?.slug === "lightspeed" ? isSuperAdmin : false,
    canDisconnect: Boolean(
      resolved?.model?.canDisconnect &&
      resolved?.disconnectRef &&
      (!["square", "clover", "lightspeed"].includes(
        resolved.disconnectRef.kind,
      ) ||
        isSuperAdmin),
    ),
    isLoading:
      Boolean(seed) && (query.isLoading || isMailchimpBootstrapPending),
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
    triggerShopifySync: shopifySyncMutation.mutateAsync,
    isShopifySyncing: shopifySyncState !== "idle",
    verifySquareWebhooks: verifySquareWebhooksMutation.mutateAsync,
    isVerifyingSquareWebhooks: verifySquareWebhooksMutation.isPending,
    verifyShopifyWebhooks: verifyShopifyWebhooksMutation.mutateAsync,
    isVerifyingShopifyWebhooks: verifyShopifyWebhooksMutation.isPending,
    triggerCloverSync: cloverSyncMutation.mutateAsync,
    isCloverSyncing: cloverSyncMutation.isPending,
    runCloverConnectionTest: cloverConnectionTestMutation.mutateAsync,
    isCloverConnectionTesting: cloverConnectionTestMutation.isPending,
    shopifySyncJobs,
    shopifyActiveJobIds,
    shopifySyncState,
    lightspeedSyncJobs,
    lightspeedActiveJobIds,
    lightspeedTrackedJobIds,
    lightspeedRealtimeActive: lightspeedTrackedJobIds.length > 0,
    lightspeedSyncState,
    lightspeedHasStaleJobs,
    triggerLightspeedSync: lightspeedSyncMutation.mutateAsync,
    isLightspeedSyncing: lightspeedSyncState !== "idle",
    resetLightspeedData: lightspeedResetMutation.mutateAsync,
    isResettingLightspeedData: lightspeedResetMutation.isPending,
    triggerMetaReauthorization: metaReauthorizationMutation.mutateAsync,
    isMetaReauthorizing: metaReauthorizationMutation.isPending,
    refreshMetaAssets: metaAssetRefreshMutation.mutateAsync,
    isRefreshingMetaAssets: metaAssetRefreshMutation.isPending,
    triggerGa4ConnectionTest: ga4ConnectionTestMutation.mutateAsync,
    isGa4ConnectionTesting: ga4ConnectionTestMutation.isPending,
    triggerGa4Reauthorization: ga4ReauthorizationMutation.mutateAsync,
    isGa4Reauthorizing: ga4ReauthorizationMutation.isPending,
    validateMarketingImportConnection:
      marketingImportValidationMutation.mutateAsync,
    isValidatingMarketingImportConnection:
      marketingImportValidationMutation.isPending,
    disconnect: disconnectMutation.mutateAsync,
    isDisconnecting: disconnectMutation.isPending,
  };
}
