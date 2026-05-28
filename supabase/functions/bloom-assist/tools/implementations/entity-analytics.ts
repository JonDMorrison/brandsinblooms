import type { Database } from "../../../../../src/integrations/supabase/types.ts";
import type { JsonArray, JsonObject, JsonValue } from "../../types.ts";
import {
  buildSubscriptionSnapshot,
  getEffectivePlan,
  type PlanDefinitionShape,
  type SubscriptionRecordShape,
} from "../../../_shared/subscriptionSnapshot.ts";
import type {
  ToolExecutionContext,
  ToolImplementation,
  ToolResult,
} from "../types.ts";
import {
  getQueryClient,
  isJsonValue,
  isRecord,
  toNumberOrNull,
  type BloomQueryClient,
} from "./shared.ts";

type CustomerLookupRow = Pick<
  Database["public"]["Tables"]["crm_customers"]["Row"],
  | "id"
  | "tenant_id"
  | "first_name"
  | "last_name"
  | "email"
  | "phone"
  | "preferred_channel"
  | "lifetime_value"
  | "total_spent"
  | "last_purchase_date"
  | "created_at"
>;
type UnifiedTimelineRow =
  Database["public"]["Functions"]["get_customer_unified_timeline"]["Returns"][number];
type PurchaseTimelineRow =
  Database["public"]["Functions"]["get_customer_purchase_timeline"]["Returns"][number];
type EngagementTimelineRow =
  Database["public"]["Functions"]["get_customer_engagement_timeline"]["Returns"][number];
type CustomerAiInsightRow = Pick<
  Database["public"]["Tables"]["customer_ai_insights"]["Row"],
  | "customer_id"
  | "tenant_id"
  | "key_insight"
  | "behavioral_patterns"
  | "recommended_actions"
  | "has_sufficient_data"
  | "model_used"
  | "prompt_tokens"
  | "completion_tokens"
  | "generated_at"
  | "expires_at"
>;
type CustomerSegmentRow = Pick<
  Database["public"]["Tables"]["customer_segments"]["Row"],
  "id" | "segment_id" | "assigned_at" | "created_at" | "assigned_by_user_id"
>;
type SegmentRow = Pick<
  Database["public"]["Tables"]["crm_segments"]["Row"],
  "id" | "name" | "status" | "tenant_id"
>;
type CustomerTagRow = Pick<
  Database["public"]["Tables"]["customer_tags"]["Row"],
  "contact_id" | "tag_id" | "created_at"
>;
type TagRow = Pick<
  Database["public"]["Tables"]["crm_tags"]["Row"],
  "id" | "name" | "tenant_id" | "created_at"
>;
type EmailConsentEventRow = Pick<
  Database["public"]["Tables"]["crm_email_consent_events"]["Row"],
  | "id"
  | "customer_id"
  | "tenant_id"
  | "email"
  | "event_type"
  | "source"
  | "created_at"
>;
type SmsConsentEventRow = Pick<
  Database["public"]["Tables"]["crm_sms_consent_events"]["Row"],
  | "id"
  | "customer_id"
  | "tenant_id"
  | "phone"
  | "event_type"
  | "source"
  | "created_at"
>;

type SquareConnectionRow = Pick<
  Database["public"]["Tables"]["square_connections"]["Row"],
  | "id"
  | "merchant_name"
  | "merchant_id"
  | "location_id"
  | "status"
  | "connected_at"
  | "last_synced_at"
  | "last_customer_sync"
  | "last_product_sync"
  | "last_sales_sync"
  | "last_webhook_received_at"
  | "customers_synced"
  | "products_synced"
  | "sales_synced"
  | "webhooks_subscribed"
  | "webhooks_last_checked_at"
  | "webhook_last_error"
  | "webhook_next_retry_at"
  | "webhook_retry_count"
  | "sync_errors"
  | "updated_at"
>;
type CloverConnectionRow = Pick<
  Database["public"]["Tables"]["clover_connections"]["Row"],
  | "id"
  | "merchant_name"
  | "merchant_id"
  | "employee_id"
  | "status"
  | "connected_at"
  | "last_synced_at"
  | "last_customer_sync"
  | "last_product_sync"
  | "last_sales_sync"
  | "last_webhook_received_at"
  | "customers_synced"
  | "products_synced"
  | "sales_synced"
  | "webhooks_subscribed"
  | "webhooks_last_checked_at"
  | "webhook_last_error"
  | "webhook_next_retry_at"
  | "webhook_retry_count"
  | "sync_errors"
  | "last_test_status"
  | "last_tested_at"
  | "updated_at"
>;
type LightspeedConnectionRow = Pick<
  Database["public"]["Tables"]["lightspeed_connections"]["Row"],
  | "id"
  | "retailer_name"
  | "retailer_id"
  | "domain_prefix"
  | "status"
  | "connected_at"
  | "last_synced_at"
  | "last_customer_sync"
  | "last_product_sync"
  | "last_sales_sync"
  | "last_webhook_received_at"
  | "customers_synced"
  | "products_synced"
  | "sales_synced"
  | "webhooks_subscribed"
  | "webhooks_last_checked_at"
  | "webhook_registered"
  | "webhook_last_error"
  | "webhook_next_retry_at"
  | "webhook_retry_count"
  | "sync_errors"
  | "updated_at"
>;
type ShopifyConnectionRow = Pick<
  Database["public"]["Tables"]["shopify_connections"]["Row"],
  | "id"
  | "shop_domain"
  | "shop_name"
  | "shop_email"
  | "shop_owner"
  | "status"
  | "connected_at"
  | "last_synced_at"
  | "last_customer_sync"
  | "last_product_sync"
  | "last_sales_sync"
  | "last_webhook_received_at"
  | "customers_synced"
  | "products_synced"
  | "sales_synced"
  | "webhooks_subscribed"
  | "webhooks_last_checked_at"
  | "webhook_last_error"
  | "webhook_next_retry_at"
  | "webhook_retry_count"
  | "updated_at"
>;
type ProviderConnectionRow = Pick<
  Database["public"]["Tables"]["provider_connections"]["Row"],
  | "id"
  | "provider"
  | "provider_account_id"
  | "provider_account_name"
  | "status"
  | "connected_at"
  | "updated_at"
  | "token_expires_at"
  | "revoked_at"
  | "metadata"
>;
type ImportJobRow = Pick<
  Database["public"]["Tables"]["import_jobs"]["Row"],
  | "id"
  | "provider"
  | "status"
  | "created_at"
  | "updated_at"
  | "completed_at"
  | "failed_rows"
  | "inserted_rows"
  | "skipped_rows"
  | "error_details"
  | "progress_percentage"
>;
type TwilioPhoneNumberRow = Pick<
  Database["public"]["Tables"]["twilio_phone_numbers"]["Row"],
  | "id"
  | "friendly_name"
  | "phone_number"
  | "is_active"
  | "is_verified"
  | "daily_limit"
  | "daily_sent_count"
  | "failure_rate_30d"
  | "bounce_rate_30d"
  | "warmup_stage"
  | "last_health_evaluated_at"
  | "updated_at"
>;
type PosSyncJobRow = Pick<
  Database["public"]["Tables"]["pos_sync_jobs_v2"]["Row"],
  | "id"
  | "provider"
  | "sync_type"
  | "status"
  | "created_at"
  | "updated_at"
  | "started_at"
  | "completed_at"
  | "last_progress_at"
  | "last_error"
  | "error_count"
  | "failed_rows"
  | "customers_synced"
  | "orders_synced"
  | "products_synced"
  | "progress_message"
  | "next_retry_at"
  | "attempts"
>;
type TenantUserRow = Pick<
  Database["public"]["Tables"]["users"]["Row"],
  "id" | "email" | "full_name" | "name" | "created_at"
>;
type StripeSubscriptionRow = SubscriptionRecordShape & {
  user_id: string;
  created_at?: string | null;
  updated_at?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_subscription_item_id?: string | null;
};

type TimelineEvent = {
  tenant_id: string;
  customer_id: string;
  id: string;
  event_type: string;
  event_category: string;
  title: string;
  description: string;
  impact: string;
  metadata: JsonValue | null;
  source: string;
  created_at: string;
};

type DateFilter = {
  start: string | null;
  end: string | null;
  label: string;
};

type IntegrationProvider =
  | "square"
  | "clover"
  | "shopify"
  | "lightspeed"
  | "mailchimp"
  | "twilio"
  | "stripe";
type PosSyncProvider = Database["public"]["Enums"]["pos_provider"];
type IntegrationHealth =
  | "healthy"
  | "syncing"
  | "warning"
  | "error"
  | "not_connected"
  | "not_available";

type ConnectionSnapshot = {
  provider: IntegrationProvider;
  connectionId: string | null;
  accountName: string | null;
  accountId: string | null;
  status: string;
  connectedAt: string | null;
  updatedAt: string | null;
  lastSyncedAt: string | null;
  lastCustomerSync: string | null;
  lastProductSync: string | null;
  lastSalesSync: string | null;
  lastWebhookReceivedAt: string | null;
  customersSynced: number | null;
  productsSynced: number | null;
  salesSynced: number | null;
  hasWebhookMonitoring: boolean;
  webhooksSubscribed: boolean | null;
  webhooksLastCheckedAt: string | null;
  webhookRegistered: boolean | null;
  webhookLastError: string | null;
  webhookNextRetryAt: string | null;
  webhookRetryCount: number | null;
  syncErrors: JsonValue | null;
  metadata: JsonValue | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TIMELINE_LIMIT = 50;
const MAX_TIMELINE_LIMIT = 100;
const DEFAULT_ROLLUP_MONTHS = 12;
const STALE_SYNC_DAYS = 7;
const INTEGRATION_PROVIDERS: readonly IntegrationProvider[] = [
  "square",
  "clover",
  "shopify",
  "lightspeed",
  "mailchimp",
  "twilio",
  "stripe",
];
const POS_SYNC_PROVIDERS: readonly PosSyncProvider[] = [
  "square",
  "clover",
  "lightspeed",
];
const TIMELINE_TABLE_COLUMNS: JsonArray = [
  {
    key: "date",
    label: "Date",
    sortable: true,
    type: "date",
  },
  {
    key: "event_type",
    label: "Event Type",
    sortable: true,
    type: "text",
  },
  {
    key: "description",
    label: "Description",
    sortable: false,
    type: "text",
  },
  {
    key: "source",
    label: "Source",
    sortable: true,
    type: "text",
  },
];
const ACTIVE_SYNC_STATUSES = new Set<string>([
  "pending",
  "in_progress",
  "delayed",
]);
const ACTIVE_IMPORT_STATUSES = new Set<string>([
  "queued",
  "pending",
  "running",
  "processing",
  "in_progress",
]);
const ERROR_CONNECTION_STATUSES = new Set<string>([
  "error",
  "failed",
  "revoked",
  "expired",
  "disconnected",
]);

function createResult(args: {
  blockType: ToolResult["block_type"];
  count?: number | null;
  data: JsonValue | null;
  error?: string | null;
  message: string;
  success?: boolean;
}): ToolResult {
  return {
    success: args.success ?? true,
    data: args.data,
    count: args.count ?? null,
    message: args.message,
    error: args.error ?? null,
    block_type: args.blockType,
    confirmation_required: false,
    confirmation_details: null,
  };
}

function errorResult(
  message: string,
  error = "entity_analytics_error",
): ToolResult {
  return createResult({
    success: false,
    data: null,
    count: 0,
    message,
    error,
    blockType: "text",
  });
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value)
    ? value
    : fallback;
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function jsonValueOrNull(value: unknown): JsonValue | null {
  return isJsonValue(value) ? value : null;
}

function jsonArrayOrEmpty(value: unknown): JsonArray {
  return Array.isArray(value) && value.every(isJsonValue) ? value : [];
}

function jsonObjectOrNull(value: unknown): JsonObject | null {
  return isRecord(value) && Object.values(value).every(isJsonValue)
    ? value
    : null;
}

function finiteNumber(value: unknown, fallback = 0): number {
  const numericValue = toNumberOrNull(value);
  if (numericValue !== null) {
    return numericValue;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toLowerCase())
    .filter(
      (item, index, items) =>
        item.length > 0 && item !== "all" && items.indexOf(item) === index,
    );
}

function customerDisplayName(customer: CustomerLookupRow): string {
  const parts = [customer.first_name, customer.last_name]
    .map((part) => part?.trim() ?? "")
    .filter((part) => part.length > 0);

  return parts.join(" ") || customer.email;
}

function customerSummary(customer: CustomerLookupRow): JsonObject {
  return {
    id: customer.id,
    name: customerDisplayName(customer),
    email: customer.email,
    phone: customer.phone,
    preferred_channel: customer.preferred_channel,
    lifetime_value: customer.lifetime_value ?? customer.total_spent ?? null,
    last_purchase_date: customer.last_purchase_date,
    created_at: customer.created_at,
  };
}

async function loadCustomer(
  client: BloomQueryClient,
  tenantId: string,
  customerId: string,
): Promise<CustomerLookupRow | null> {
  const { data, error } = await client
    .from("crm_customers")
    .select(
      "id, tenant_id, first_name, last_name, email, phone, preferred_channel, lifetime_value, total_spent, last_purchase_date, created_at",
    )
    .eq("tenant_id", tenantId)
    .eq("id", customerId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as CustomerLookupRow | null;
}

function parseIsoDate(value: unknown): string | null {
  const source = readString(value);
  if (!source) {
    return null;
  }

  const timestamp = new Date(source).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function resolveDateFilter(params: JsonObject): DateFilter {
  const explicitStart = parseIsoDate(params.start_date);
  const explicitEnd = parseIsoDate(params.end_date);
  if (explicitStart || explicitEnd) {
    return {
      start: explicitStart,
      end: explicitEnd,
      label: "custom",
    };
  }

  const now = new Date();
  const todayStart = startOfUtcDay(now);
  const range = readString(params.date_range)?.toLowerCase() ?? null;

  switch (range) {
    case "today":
      return {
        start: todayStart.toISOString(),
        end: now.toISOString(),
        label: "today",
      };
    case "yesterday": {
      const yesterdayStart = new Date(todayStart.getTime() - DAY_MS);
      return {
        start: yesterdayStart.toISOString(),
        end: todayStart.toISOString(),
        label: "yesterday",
      };
    }
    case "last_7_days":
      return {
        start: new Date(now.getTime() - 7 * DAY_MS).toISOString(),
        end: now.toISOString(),
        label: "last_7_days",
      };
    case "last_30_days":
      return {
        start: new Date(now.getTime() - 30 * DAY_MS).toISOString(),
        end: now.toISOString(),
        label: "last_30_days",
      };
    case "this_week": {
      const day = todayStart.getUTCDay();
      const mondayOffset = day === 0 ? 6 : day - 1;
      return {
        start: new Date(
          todayStart.getTime() - mondayOffset * DAY_MS,
        ).toISOString(),
        end: now.toISOString(),
        label: "this_week",
      };
    }
    case "this_month":
      return {
        start: new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
        ).toISOString(),
        end: now.toISOString(),
        label: "this_month",
      };
    case "this_quarter": {
      const quarterMonth = Math.floor(now.getUTCMonth() / 3) * 3;
      return {
        start: new Date(
          Date.UTC(now.getUTCFullYear(), quarterMonth, 1),
        ).toISOString(),
        end: now.toISOString(),
        label: "this_quarter",
      };
    }
    case "this_year":
      return {
        start: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)).toISOString(),
        end: now.toISOString(),
        label: "this_year",
      };
    default:
      return { start: null, end: null, label: "all_time" };
  }
}

function readTimelineEventTypes(params: JsonObject): string[] {
  const eventTypes = readStringArray(params.event_types);
  const activityType = readString(params.activity_type)?.toLowerCase();
  if (
    activityType &&
    activityType !== "all" &&
    !eventTypes.includes(activityType)
  ) {
    eventTypes.push(activityType);
  }

  return eventTypes;
}

function isWithinDateFilter(
  timestamp: string | null,
  filter: DateFilter,
): boolean {
  if (!timestamp) {
    return false;
  }

  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) {
    return false;
  }

  if (filter.start && parsed < Date.parse(filter.start)) {
    return false;
  }

  if (filter.end && parsed > Date.parse(filter.end)) {
    return false;
  }

  return true;
}

function matchesEventTypes(
  event: TimelineEvent,
  eventTypes: string[],
): boolean {
  if (eventTypes.length === 0) {
    return true;
  }

  const eventType = event.event_type.toLowerCase();
  const eventCategory = event.event_category.toLowerCase();
  return eventTypes.some(
    (type) => type === eventType || type === eventCategory,
  );
}

function mapUnifiedTimelineEvent(
  row: UnifiedTimelineRow,
  tenantId: string,
  customerId: string,
): TimelineEvent {
  return {
    tenant_id: tenantId,
    customer_id: customerId,
    id: row.id,
    event_type: row.event_type,
    event_category: row.event_category,
    title: row.title,
    description: row.description,
    impact: row.impact,
    metadata: jsonValueOrNull(row.metadata),
    source: "get_customer_unified_timeline",
    created_at: row.created_at,
  };
}

async function loadUnifiedTimelineEvents(
  client: BloomQueryClient,
  tenantId: string,
  customerId: string,
  limit: number,
): Promise<TimelineEvent[]> {
  const { data, error } = await client.rpc("get_customer_unified_timeline", {
    p_customer_id: customerId,
    p_limit: Math.min(MAX_TIMELINE_LIMIT * 2, Math.max(limit * 3, limit)),
    p_offset: 0,
  });

  if (error) {
    throw error;
  }

  return ((data ?? []) as UnifiedTimelineRow[]).map((row) =>
    mapUnifiedTimelineEvent(row, tenantId, customerId),
  );
}

async function loadConsentEvents(
  client: BloomQueryClient,
  tenantId: string,
  customerId: string,
  limit: number,
): Promise<TimelineEvent[]> {
  const [emailResponse, smsResponse] = await Promise.all([
    client
      .from("crm_email_consent_events")
      .select(
        "id, customer_id, tenant_id, email, event_type, source, created_at",
      )
      .eq("tenant_id", tenantId)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(limit),
    client
      .from("crm_sms_consent_events")
      .select(
        "id, customer_id, tenant_id, phone, event_type, source, created_at",
      )
      .eq("tenant_id", tenantId)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  if (emailResponse.error) {
    throw emailResponse.error;
  }
  if (smsResponse.error) {
    throw smsResponse.error;
  }

  const emailEvents = (
    (emailResponse.data ?? []) as EmailConsentEventRow[]
  ).map(
    (event) =>
      ({
        tenant_id: tenantId,
        customer_id: customerId,
        id: event.id,
        event_type: "email_consent",
        event_category: "consent",
        title: `Email consent ${event.event_type}`,
        description: `${event.email} consent recorded from ${event.source}.`,
        impact:
          event.event_type.includes("opt_out") ||
          event.event_type.includes("unsubscribe")
            ? "negative"
            : "neutral",
        metadata: {
          channel: "email",
          email: event.email,
          consent_event_type: event.event_type,
          source: event.source,
        },
        source: "crm_email_consent_events",
        created_at: event.created_at,
      }) satisfies TimelineEvent,
  );

  const smsEvents = ((smsResponse.data ?? []) as SmsConsentEventRow[]).map(
    (event) =>
      ({
        tenant_id: tenantId,
        customer_id: customerId,
        id: event.id,
        event_type: "sms_consent",
        event_category: "consent",
        title: `SMS consent ${event.event_type}`,
        description: `${event.phone} consent recorded from ${event.source}.`,
        impact:
          event.event_type.includes("opt_out") ||
          event.event_type.includes("unsubscribe")
            ? "negative"
            : "neutral",
        metadata: {
          channel: "sms",
          phone: event.phone,
          consent_event_type: event.event_type,
          source: event.source,
        },
        source: "crm_sms_consent_events",
        created_at: event.created_at,
      }) satisfies TimelineEvent,
  );

  return [...emailEvents, ...smsEvents];
}

async function loadSegmentEvents(
  client: BloomQueryClient,
  tenantId: string,
  customerId: string,
): Promise<TimelineEvent[]> {
  const { data: segmentData, error: segmentError } = await client
    .from("crm_segments")
    .select("id, name, status, tenant_id")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .limit(1000);

  if (segmentError) {
    throw segmentError;
  }

  const segments = (segmentData ?? []) as SegmentRow[];
  const segmentIds = segments.map((segment) => segment.id);
  if (segmentIds.length === 0) {
    return [];
  }

  const { data: membershipData, error: membershipError } = await client
    .from("customer_segments")
    .select("id, segment_id, assigned_at, created_at, assigned_by_user_id")
    .eq("customer_id", customerId)
    .in("segment_id", segmentIds)
    .order("assigned_at", { ascending: false });

  if (membershipError) {
    throw membershipError;
  }

  const segmentsById = new Map(
    segments.map((segment) => [segment.id, segment]),
  );
  return ((membershipData ?? []) as CustomerSegmentRow[]).flatMap(
    (membership) => {
      const segment = segmentsById.get(membership.segment_id);
      if (!segment) {
        return [];
      }

      return [
        {
          tenant_id: tenantId,
          customer_id: customerId,
          id: membership.id,
          event_type: "segment_assigned",
          event_category: "segment",
          title: `Added to ${segment.name}`,
          description: `Customer was assigned to the ${segment.name} segment.`,
          impact: "neutral",
          metadata: {
            segment_id: segment.id,
            segment_name: segment.name,
            segment_status: segment.status,
            assigned_by_user_id: membership.assigned_by_user_id,
          },
          source: "customer_segments",
          created_at: membership.assigned_at ?? membership.created_at,
        } satisfies TimelineEvent,
      ];
    },
  );
}

async function loadTagEvents(
  client: BloomQueryClient,
  tenantId: string,
  customerId: string,
): Promise<TimelineEvent[]> {
  const { data: tagData, error: tagError } = await client
    .from("crm_tags")
    .select("id, name, tenant_id, created_at")
    .eq("tenant_id", tenantId)
    .limit(1000);

  if (tagError) {
    throw tagError;
  }

  const tags = (tagData ?? []) as TagRow[];
  const tagIds = tags.map((tag) => tag.id);
  if (tagIds.length === 0) {
    return [];
  }

  const { data: assignmentData, error: assignmentError } = await client
    .from("customer_tags")
    .select("contact_id, tag_id, created_at")
    .eq("contact_id", customerId)
    .in("tag_id", tagIds)
    .order("created_at", { ascending: false });

  if (assignmentError) {
    throw assignmentError;
  }

  const tagsById = new Map(tags.map((tag) => [tag.id, tag]));
  return ((assignmentData ?? []) as CustomerTagRow[]).flatMap((assignment) => {
    const tag = tagsById.get(assignment.tag_id);
    if (!tag || !assignment.created_at) {
      return [];
    }

    return [
      {
        tenant_id: tenantId,
        customer_id: customerId,
        id: `${assignment.contact_id}:${assignment.tag_id}`,
        event_type: "tag_assigned",
        event_category: "tag",
        title: `Tagged ${tag.name}`,
        description: `Customer was tagged ${tag.name}.`,
        impact: "neutral",
        metadata: {
          tag_id: tag.id,
          tag_name: tag.name,
        },
        source: "customer_tags",
        created_at: assignment.created_at,
      } satisfies TimelineEvent,
    ];
  });
}

function monthsForRollup(filter: DateFilter): number {
  if (!filter.start || !filter.end) {
    return DEFAULT_ROLLUP_MONTHS;
  }

  const start = Date.parse(filter.start);
  const end = Date.parse(filter.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return DEFAULT_ROLLUP_MONTHS;
  }

  return clampInteger(Math.ceil((end - start) / (30 * DAY_MS)), 1, 24);
}

async function loadTimelineRollups(
  client: BloomQueryClient,
  customerId: string,
  months: number,
): Promise<{ purchases: JsonArray; engagement: JsonArray }> {
  const [purchaseResponse, engagementResponse] = await Promise.all([
    client.rpc("get_customer_purchase_timeline", {
      p_customer_id: customerId,
      p_months: months,
    }),
    client.rpc("get_customer_engagement_timeline", {
      p_customer_id: customerId,
      p_months: months,
    }),
  ]);

  if (purchaseResponse.error) {
    throw purchaseResponse.error;
  }
  if (engagementResponse.error) {
    throw engagementResponse.error;
  }

  return {
    purchases: ((purchaseResponse.data ?? []) as PurchaseTimelineRow[]).map(
      (row) => ({
        period_date: row.period_date,
        order_count: row.order_count,
        total_revenue: finiteNumber(row.total_revenue),
      }),
    ),
    engagement: (
      (engagementResponse.data ?? []) as EngagementTimelineRow[]
    ).map((row) => ({
      period_date: row.period_date,
      email_events: row.email_events,
      sms_events: row.sms_events,
      engagement_score: finiteNumber(row.engagement_score),
    })),
  };
}

function timelineSummary(events: TimelineEvent[]): JsonObject {
  const byCategory: JsonObject = {};
  const byImpact: JsonObject = {};

  for (const event of events) {
    byCategory[event.event_category] =
      finiteNumber(byCategory[event.event_category]) + 1;
    byImpact[event.impact] = finiteNumber(byImpact[event.impact]) + 1;
  }

  return {
    total_events: events.length,
    latest_event_at: events[0]?.created_at ?? null,
    by_category: byCategory,
    by_impact: byImpact,
    sources: Array.from(new Set(events.map((event) => event.source))),
  };
}

function eventSortDescending(
  left: TimelineEvent,
  right: TimelineEvent,
): number {
  return Date.parse(right.created_at) - Date.parse(left.created_at);
}

function timelineEventPayload(event: TimelineEvent): JsonObject {
  return {
    tenant_id: event.tenant_id,
    customer_id: event.customer_id,
    id: event.id,
    event_type: event.event_type,
    event_category: event.event_category,
    title: event.title,
    description: event.description,
    impact: event.impact,
    metadata: event.metadata,
    source: event.source,
    created_at: event.created_at,
  };
}

function timelineEventDescription(event: TimelineEvent): string {
  if (event.description && event.title) {
    return `${event.title}: ${event.description}`;
  }

  return event.description || event.title;
}

function timelineTableRow(event: TimelineEvent): JsonObject {
  return {
    id: event.id,
    customer_id: event.customer_id,
    date: event.created_at,
    event_type: event.event_type,
    description: timelineEventDescription(event),
    source: event.source,
    impact: event.impact,
    event_category: event.event_category,
  };
}

export const getCustomerTimeline: ToolImplementation = async (
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> => {
  const customerId = readString(params.customer_id);
  if (!customerId) {
    return errorResult("customer_id is required.", "validation_error");
  }

  const client = getQueryClient(context);
  const customer = await loadCustomer(client, context.tenantId, customerId);
  if (!customer) {
    return errorResult("Customer not found for this tenant.", "not_found");
  }

  const limit = clampInteger(
    readInteger(params.limit, DEFAULT_TIMELINE_LIMIT),
    1,
    MAX_TIMELINE_LIMIT,
  );
  const dateFilter = resolveDateFilter(params);
  const eventTypes = readTimelineEventTypes(params);
  const [unifiedEvents, consentEvents, segmentEvents, tagEvents, rollups] =
    await Promise.all([
      loadUnifiedTimelineEvents(client, context.tenantId, customerId, limit),
      loadConsentEvents(client, context.tenantId, customerId, limit),
      loadSegmentEvents(client, context.tenantId, customerId),
      loadTagEvents(client, context.tenantId, customerId),
      loadTimelineRollups(client, customerId, monthsForRollup(dateFilter)),
    ]);

  const events = [
    ...unifiedEvents,
    ...consentEvents,
    ...segmentEvents,
    ...tagEvents,
  ]
    .filter((event) => matchesEventTypes(event, eventTypes))
    .filter((event) => isWithinDateFilter(event.created_at, dateFilter))
    .sort(eventSortDescending)
    .slice(0, limit);
  const rows = events.map(timelineTableRow);

  const data: JsonObject = {
    entity_type: "record",
    tenant_id: context.tenantId,
    customer_id: customerId,
    customer: customerSummary(customer),
    generated_at: new Date().toISOString(),
    date_range: dateFilter,
    event_types: eventTypes,
    columns: TIMELINE_TABLE_COLUMNS,
    rows,
    total_count: events.length,
    page: 1,
    page_size: events.length,
    summary: timelineSummary(events),
    events: events.map(timelineEventPayload),
    rollups,
  };

  return createResult({
    data,
    count: events.length,
    blockType: "data_table",
    message: `Loaded ${events.length} timeline events for ${customerDisplayName(customer)}.`,
  });
};

function mostRecentTimestamp(
  values: Array<string | null | undefined>,
): string | null {
  return (
    values
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null
  );
}

function isTimestampOlderThanDays(
  timestamp: string | null,
  days: number,
): boolean {
  if (!timestamp) {
    return false;
  }

  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) && Date.now() - parsed > days * DAY_MS;
}

function normalizeStatus(value: string | null | undefined): string {
  return value?.trim().toLowerCase() || "unknown";
}

function providerLabel(provider: IntegrationProvider): string {
  switch (provider) {
    case "square":
      return "Square";
    case "clover":
      return "Clover";
    case "shopify":
      return "Shopify";
    case "lightspeed":
      return "Lightspeed";
    case "mailchimp":
      return "Mailchimp";
    case "twilio":
      return "Twilio";
    case "stripe":
      return "Stripe";
  }
}

function integrationProviderFromValue(
  value: unknown,
): IntegrationProvider | "all" {
  const provider = readString(value)?.toLowerCase() ?? "all";
  if (provider === "all") {
    return "all";
  }

  return INTEGRATION_PROVIDERS.includes(provider as IntegrationProvider)
    ? (provider as IntegrationProvider)
    : "all";
}

function baseConnectionSnapshot(args: {
  provider: IntegrationProvider;
  connectionId: string | null;
  accountName: string | null;
  accountId: string | null;
  status: string | null;
  connectedAt: string | null;
  updatedAt: string | null;
  lastSyncedAt?: string | null;
  lastCustomerSync?: string | null;
  lastProductSync?: string | null;
  lastSalesSync?: string | null;
  lastWebhookReceivedAt?: string | null;
  customersSynced?: number | null;
  productsSynced?: number | null;
  salesSynced?: number | null;
  hasWebhookMonitoring?: boolean;
  webhooksSubscribed?: boolean | null;
  webhooksLastCheckedAt?: string | null;
  webhookRegistered?: boolean | null;
  webhookLastError?: string | null;
  webhookNextRetryAt?: string | null;
  webhookRetryCount?: number | null;
  syncErrors?: unknown;
  metadata?: unknown;
}): ConnectionSnapshot {
  return {
    provider: args.provider,
    connectionId: args.connectionId,
    accountName: args.accountName,
    accountId: args.accountId,
    status: normalizeStatus(args.status),
    connectedAt: args.connectedAt,
    updatedAt: args.updatedAt,
    lastSyncedAt: args.lastSyncedAt ?? null,
    lastCustomerSync: args.lastCustomerSync ?? null,
    lastProductSync: args.lastProductSync ?? null,
    lastSalesSync: args.lastSalesSync ?? null,
    lastWebhookReceivedAt: args.lastWebhookReceivedAt ?? null,
    customersSynced: args.customersSynced ?? null,
    productsSynced: args.productsSynced ?? null,
    salesSynced: args.salesSynced ?? null,
    hasWebhookMonitoring: args.hasWebhookMonitoring ?? false,
    webhooksSubscribed: args.webhooksSubscribed ?? null,
    webhooksLastCheckedAt: args.webhooksLastCheckedAt ?? null,
    webhookRegistered: args.webhookRegistered ?? null,
    webhookLastError: args.webhookLastError ?? null,
    webhookNextRetryAt: args.webhookNextRetryAt ?? null,
    webhookRetryCount: args.webhookRetryCount ?? null,
    syncErrors: jsonValueOrNull(args.syncErrors),
    metadata: jsonValueOrNull(args.metadata),
  };
}

function mapSquareConnection(
  row: SquareConnectionRow | null,
): ConnectionSnapshot | null {
  if (!row) {
    return null;
  }

  return baseConnectionSnapshot({
    provider: "square",
    connectionId: row.id,
    accountName: row.merchant_name,
    accountId: row.merchant_id ?? row.location_id,
    status: row.status,
    connectedAt: row.connected_at,
    updatedAt: row.updated_at,
    lastSyncedAt: row.last_synced_at,
    lastCustomerSync: row.last_customer_sync,
    lastProductSync: row.last_product_sync,
    lastSalesSync: row.last_sales_sync,
    lastWebhookReceivedAt: row.last_webhook_received_at,
    customersSynced: row.customers_synced,
    productsSynced: row.products_synced,
    salesSynced: row.sales_synced,
    hasWebhookMonitoring: true,
    webhooksSubscribed: row.webhooks_subscribed,
    webhooksLastCheckedAt: row.webhooks_last_checked_at,
    webhookLastError: row.webhook_last_error,
    webhookNextRetryAt: row.webhook_next_retry_at,
    webhookRetryCount: row.webhook_retry_count,
    syncErrors: row.sync_errors,
  });
}

function mapCloverConnection(
  row: CloverConnectionRow | null,
): ConnectionSnapshot | null {
  if (!row) {
    return null;
  }

  return baseConnectionSnapshot({
    provider: "clover",
    connectionId: row.id,
    accountName: row.merchant_name,
    accountId: row.merchant_id ?? row.employee_id,
    status: row.status,
    connectedAt: row.connected_at,
    updatedAt: row.updated_at,
    lastSyncedAt: row.last_synced_at,
    lastCustomerSync: row.last_customer_sync,
    lastProductSync: row.last_product_sync,
    lastSalesSync: row.last_sales_sync,
    lastWebhookReceivedAt: row.last_webhook_received_at,
    customersSynced: row.customers_synced,
    productsSynced: row.products_synced,
    salesSynced: row.sales_synced,
    hasWebhookMonitoring: true,
    webhooksSubscribed: row.webhooks_subscribed,
    webhooksLastCheckedAt: row.webhooks_last_checked_at,
    webhookLastError: row.webhook_last_error,
    webhookNextRetryAt: row.webhook_next_retry_at,
    webhookRetryCount: row.webhook_retry_count,
    syncErrors: row.sync_errors,
    metadata: {
      last_test_status: row.last_test_status,
      last_tested_at: row.last_tested_at,
    },
  });
}

function mapLightspeedConnection(
  row: LightspeedConnectionRow | null,
): ConnectionSnapshot | null {
  if (!row) {
    return null;
  }

  return baseConnectionSnapshot({
    provider: "lightspeed",
    connectionId: row.id,
    accountName: row.retailer_name ?? row.domain_prefix,
    accountId:
      row.retailer_id !== null ? String(row.retailer_id) : row.domain_prefix,
    status: row.status,
    connectedAt: row.connected_at,
    updatedAt: row.updated_at,
    lastSyncedAt: row.last_synced_at,
    lastCustomerSync: row.last_customer_sync,
    lastProductSync: row.last_product_sync,
    lastSalesSync: row.last_sales_sync,
    lastWebhookReceivedAt: row.last_webhook_received_at,
    customersSynced: row.customers_synced,
    productsSynced: row.products_synced,
    salesSynced: row.sales_synced,
    hasWebhookMonitoring: true,
    webhooksSubscribed: row.webhooks_subscribed,
    webhooksLastCheckedAt: row.webhooks_last_checked_at,
    webhookRegistered: row.webhook_registered,
    webhookLastError: row.webhook_last_error,
    webhookNextRetryAt: row.webhook_next_retry_at,
    webhookRetryCount: row.webhook_retry_count,
    syncErrors: row.sync_errors,
  });
}

function mapShopifyConnection(
  row: ShopifyConnectionRow | null,
): ConnectionSnapshot | null {
  if (!row) {
    return null;
  }

  return baseConnectionSnapshot({
    provider: "shopify",
    connectionId: row.id,
    accountName: row.shop_name ?? row.shop_domain,
    accountId: row.shop_domain,
    status: row.status,
    connectedAt: row.connected_at,
    updatedAt: row.updated_at,
    lastSyncedAt: row.last_synced_at,
    lastCustomerSync: row.last_customer_sync,
    lastProductSync: row.last_product_sync,
    lastSalesSync: row.last_sales_sync,
    lastWebhookReceivedAt: row.last_webhook_received_at,
    customersSynced: row.customers_synced,
    productsSynced: row.products_synced,
    salesSynced: row.sales_synced,
    hasWebhookMonitoring: true,
    webhooksSubscribed: row.webhooks_subscribed,
    webhooksLastCheckedAt: row.webhooks_last_checked_at,
    webhookLastError: row.webhook_last_error,
    webhookNextRetryAt: row.webhook_next_retry_at,
    webhookRetryCount: row.webhook_retry_count,
    metadata: {
      shop_email: row.shop_email,
      shop_owner: row.shop_owner,
    },
  });
}

function mapProviderConnection(
  row: ProviderConnectionRow | null,
): ConnectionSnapshot | null {
  if (!row) {
    return null;
  }

  return baseConnectionSnapshot({
    provider: "mailchimp",
    connectionId: row.id,
    accountName: row.provider_account_name,
    accountId: row.provider_account_id,
    status: row.revoked_at ? "revoked" : row.status,
    connectedAt: row.connected_at ?? row.created_at,
    updatedAt: row.updated_at,
    lastSyncedAt: null,
    hasWebhookMonitoring: false,
    metadata: {
      provider: row.provider,
      token_expires_at: row.token_expires_at,
      revoked_at: row.revoked_at,
      metadata: jsonValueOrNull(row.metadata),
    },
  });
}

async function loadSquareConnection(
  client: BloomQueryClient,
  context: ToolExecutionContext,
): Promise<ConnectionSnapshot | null> {
  const { data, error } = await client
    .from("square_connections")
    .select(
      "id, merchant_name, merchant_id, location_id, status, connected_at, last_synced_at, last_customer_sync, last_product_sync, last_sales_sync, last_webhook_received_at, customers_synced, products_synced, sales_synced, webhooks_subscribed, webhooks_last_checked_at, webhook_last_error, webhook_next_retry_at, webhook_retry_count, sync_errors, updated_at",
    )
    .eq("tenant_id", context.tenantId)
    .eq("user_id", context.userId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(1);

  if (error) {
    throw error;
  }

  return mapSquareConnection(
    ((data ?? []) as SquareConnectionRow[])[0] ?? null,
  );
}

async function loadCloverConnection(
  client: BloomQueryClient,
  context: ToolExecutionContext,
): Promise<ConnectionSnapshot | null> {
  const { data, error } = await client
    .from("clover_connections")
    .select(
      "id, merchant_name, merchant_id, employee_id, status, connected_at, last_synced_at, last_customer_sync, last_product_sync, last_sales_sync, last_webhook_received_at, customers_synced, products_synced, sales_synced, webhooks_subscribed, webhooks_last_checked_at, webhook_last_error, webhook_next_retry_at, webhook_retry_count, sync_errors, last_test_status, last_tested_at, updated_at",
    )
    .eq("tenant_id", context.tenantId)
    .eq("user_id", context.userId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(1);

  if (error) {
    throw error;
  }

  return mapCloverConnection(
    ((data ?? []) as CloverConnectionRow[])[0] ?? null,
  );
}

async function loadLightspeedConnection(
  client: BloomQueryClient,
  context: ToolExecutionContext,
): Promise<ConnectionSnapshot | null> {
  const { data, error } = await client
    .from("lightspeed_connections")
    .select(
      "id, retailer_name, retailer_id, domain_prefix, status, connected_at, last_synced_at, last_customer_sync, last_product_sync, last_sales_sync, last_webhook_received_at, customers_synced, products_synced, sales_synced, webhooks_subscribed, webhooks_last_checked_at, webhook_registered, webhook_last_error, webhook_next_retry_at, webhook_retry_count, sync_errors, updated_at",
    )
    .eq("tenant_id", context.tenantId)
    .eq("user_id", context.userId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(1);

  if (error) {
    throw error;
  }

  return mapLightspeedConnection(
    ((data ?? []) as LightspeedConnectionRow[])[0] ?? null,
  );
}

async function loadShopifyConnection(
  client: BloomQueryClient,
  context: ToolExecutionContext,
): Promise<ConnectionSnapshot | null> {
  const { data, error } = await client
    .from("shopify_connections")
    .select(
      "id, shop_domain, shop_name, shop_email, shop_owner, status, connected_at, last_synced_at, last_customer_sync, last_product_sync, last_sales_sync, last_webhook_received_at, customers_synced, products_synced, sales_synced, webhooks_subscribed, webhooks_last_checked_at, webhook_last_error, webhook_next_retry_at, webhook_retry_count, updated_at",
    )
    .eq("tenant_id", context.tenantId)
    .eq("user_id", context.userId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(1);

  if (error) {
    throw error;
  }

  return mapShopifyConnection(
    ((data ?? []) as ShopifyConnectionRow[])[0] ?? null,
  );
}

async function loadMailchimpConnection(
  client: BloomQueryClient,
  tenantId: string,
): Promise<{
  connection: ConnectionSnapshot | null;
  importJob: ImportJobRow | null;
}> {
  const [connectionResponse, jobResponse] = await Promise.all([
    client
      .from("provider_connections")
      .select(
        "id, provider, provider_account_id, provider_account_name, status, connected_at, created_at, updated_at, token_expires_at, revoked_at, metadata",
      )
      .eq("tenant_id", tenantId)
      .eq("provider", "mailchimp")
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(1),
    client
      .from("import_jobs")
      .select(
        "id, provider, status, created_at, updated_at, completed_at, failed_rows, inserted_rows, skipped_rows, error_details, progress_percentage",
      )
      .eq("tenant_id", tenantId)
      .eq("provider", "mailchimp")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  if (connectionResponse.error) {
    throw connectionResponse.error;
  }
  if (jobResponse.error) {
    throw jobResponse.error;
  }

  return {
    connection: mapProviderConnection(
      ((connectionResponse.data ?? []) as ProviderConnectionRow[])[0] ?? null,
    ),
    importJob: ((jobResponse.data ?? []) as ImportJobRow[])[0] ?? null,
  };
}

async function loadTwilioNumbers(
  client: BloomQueryClient,
  tenantId: string,
): Promise<TwilioPhoneNumberRow[]> {
  const { data, error } = await client
    .from("twilio_phone_numbers")
    .select(
      "id, friendly_name, phone_number, is_active, is_verified, daily_limit, daily_sent_count, failure_rate_30d, bounce_rate_30d, warmup_stage, last_health_evaluated_at, updated_at",
    )
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false, nullsFirst: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as TwilioPhoneNumberRow[];
}

async function loadLatestPosJobs(
  client: BloomQueryClient,
  tenantId: string,
  providers: readonly PosSyncProvider[],
): Promise<Map<string, PosSyncJobRow>> {
  if (providers.length === 0) {
    return new Map();
  }

  const { data, error } = await client
    .from("pos_sync_jobs_v2")
    .select(
      "id, provider, sync_type, status, created_at, updated_at, started_at, completed_at, last_progress_at, last_error, error_count, failed_rows, customers_synced, orders_synced, products_synced, progress_message, next_retry_at, attempts",
    )
    .eq("tenant_id", tenantId)
    .in("provider", [...providers])
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  const latestJobs = new Map<string, PosSyncJobRow>();
  for (const job of (data ?? []) as PosSyncJobRow[]) {
    if (!latestJobs.has(job.provider)) {
      latestJobs.set(job.provider, job);
    }
  }

  return latestJobs;
}

function syncJobPayload(job: PosSyncJobRow | null): JsonObject | null {
  if (!job) {
    return null;
  }

  return {
    id: job.id,
    provider: job.provider,
    sync_type: job.sync_type,
    status: job.status,
    created_at: job.created_at,
    updated_at: job.updated_at,
    started_at: job.started_at,
    completed_at: job.completed_at,
    last_progress_at: job.last_progress_at,
    last_error: job.last_error,
    error_count: job.error_count,
    failed_rows: job.failed_rows,
    customers_synced: job.customers_synced,
    orders_synced: job.orders_synced,
    products_synced: job.products_synced,
    progress_message: job.progress_message,
    next_retry_at: job.next_retry_at,
    attempts: job.attempts,
  };
}

function importJobPayload(job: ImportJobRow | null): JsonObject | null {
  if (!job) {
    return null;
  }

  return {
    id: job.id,
    provider: job.provider,
    status: job.status,
    created_at: job.created_at,
    updated_at: job.updated_at,
    completed_at: job.completed_at,
    failed_rows: job.failed_rows,
    inserted_rows: job.inserted_rows,
    skipped_rows: job.skipped_rows,
    progress_percentage: job.progress_percentage,
    error_details: jsonValueOrNull(job.error_details),
  };
}

function baseDisconnectedRow(
  provider: IntegrationProvider,
  tenantId: string,
): JsonObject {
  return {
    tenant_id: tenantId,
    provider,
    provider_label: providerLabel(provider),
    status: "not_connected",
    health: "not_connected",
    account_name: null,
    account_id: null,
    connected_at: null,
    last_sync_at: null,
    last_activity_at: null,
    sync_counts: {
      customers: 0,
      products: 0,
      sales: 0,
    },
    webhooks: {
      monitored:
        provider === "square" ||
        provider === "clover" ||
        provider === "shopify" ||
        provider === "lightspeed",
      subscribed: false,
      last_checked_at: null,
      last_received_at: null,
      retry_count: 0,
      next_retry_at: null,
      last_error: null,
    },
    latest_sync_job: null,
    latest_import_job: null,
    recommendations: [
      `Connect ${providerLabel(provider)} before relying on this integration for live CRM data.`,
    ],
  };
}

function importJobIsActive(job: ImportJobRow | null): boolean {
  return job ? ACTIVE_IMPORT_STATUSES.has(normalizeStatus(job.status)) : false;
}

function importJobFailed(job: ImportJobRow | null): boolean {
  return job
    ? normalizeStatus(job.status) === "failed" || job.failed_rows > 0
    : false;
}

function connectionHealth(
  snapshot: ConnectionSnapshot,
  latestJob: PosSyncJobRow | null,
  latestImportJob: ImportJobRow | null,
): IntegrationHealth {
  if (!snapshot.connectionId) {
    return "not_connected";
  }

  if (
    (latestJob && ACTIVE_SYNC_STATUSES.has(latestJob.status)) ||
    importJobIsActive(latestImportJob)
  ) {
    return "syncing";
  }

  if (
    ERROR_CONNECTION_STATUSES.has(snapshot.status) ||
    Boolean(snapshot.webhookLastError) ||
    Boolean(latestJob?.last_error) ||
    latestJob?.status === "failed" ||
    importJobFailed(latestImportJob)
  ) {
    return "error";
  }

  const lastSyncAt = mostRecentTimestamp([
    snapshot.lastSyncedAt,
    snapshot.lastCustomerSync,
    snapshot.lastProductSync,
    snapshot.lastSalesSync,
    latestImportJob?.completed_at,
    latestImportJob?.updated_at,
  ]);
  if (
    snapshot.status !== "connected" ||
    isTimestampOlderThanDays(lastSyncAt, STALE_SYNC_DAYS) ||
    (snapshot.hasWebhookMonitoring && snapshot.webhooksSubscribed !== true)
  ) {
    return "warning";
  }

  return "healthy";
}

function recommendationsForConnection(
  snapshot: ConnectionSnapshot,
  latestJob: PosSyncJobRow | null,
  latestImportJob: ImportJobRow | null,
): string[] {
  const recommendations: string[] = [];
  const label = providerLabel(snapshot.provider);
  const lastSyncAt = mostRecentTimestamp([
    snapshot.lastSyncedAt,
    snapshot.lastCustomerSync,
    snapshot.lastProductSync,
    snapshot.lastSalesSync,
    latestImportJob?.completed_at,
    latestImportJob?.updated_at,
  ]);

  if (ERROR_CONNECTION_STATUSES.has(snapshot.status)) {
    recommendations.push(
      `Reconnect ${label}; the saved connection status is ${snapshot.status}.`,
    );
  }
  if (snapshot.provider === "mailchimp" && importJobFailed(latestImportJob)) {
    recommendations.push(
      "Review the latest Mailchimp import errors before starting another import.",
    );
  } else if (!lastSyncAt) {
    recommendations.push(
      snapshot.provider === "mailchimp"
        ? "Run a Mailchimp import to bring list, segment, tag, and consent data into the CRM."
        : `Run a ${label} sync to populate customer, product, and sales activity.`,
    );
  } else if (isTimestampOlderThanDays(lastSyncAt, STALE_SYNC_DAYS)) {
    recommendations.push(
      snapshot.provider === "mailchimp"
        ? `Mailchimp has not imported in more than ${STALE_SYNC_DAYS} days. Run a fresh import if audience data has changed.`
        : `${label} has not synced in more than ${STALE_SYNC_DAYS} days. Run a refresh sync.`,
    );
  }
  if (snapshot.webhookLastError) {
    recommendations.push(
      `Review the latest ${label} webhook error: ${snapshot.webhookLastError}`,
    );
  } else if (
    snapshot.hasWebhookMonitoring &&
    snapshot.webhooksSubscribed !== true
  ) {
    recommendations.push(
      `Verify ${label} webhooks so real-time events keep flowing.`,
    );
  }
  if (latestJob?.status === "failed" || latestJob?.last_error) {
    recommendations.push(
      `Retry the latest ${label} sync job after reviewing its error state.`,
    );
  }

  return recommendations.length > 0
    ? recommendations
    : ["No immediate action needed."];
}

function integrationRowFromConnection(
  tenantId: string,
  snapshot: ConnectionSnapshot | null,
  provider: IntegrationProvider,
  latestJob: PosSyncJobRow | null,
  latestImportJob: ImportJobRow | null,
): JsonObject {
  if (!snapshot) {
    return baseDisconnectedRow(provider, tenantId);
  }

  const lastSyncAt = mostRecentTimestamp([
    snapshot.lastSyncedAt,
    snapshot.lastCustomerSync,
    snapshot.lastProductSync,
    snapshot.lastSalesSync,
    latestJob?.completed_at,
  ]);
  const lastActivityAt = mostRecentTimestamp([
    snapshot.lastWebhookReceivedAt,
    lastSyncAt,
    latestJob?.last_progress_at,
    latestJob?.updated_at,
    snapshot.updatedAt,
  ]);

  return {
    tenant_id: tenantId,
    provider,
    provider_label: providerLabel(provider),
    status: snapshot.status,
    health: connectionHealth(snapshot, latestJob, latestImportJob),
    account_name: snapshot.accountName,
    account_id: snapshot.accountId,
    connected_at: snapshot.connectedAt,
    updated_at: snapshot.updatedAt,
    last_sync_at: lastSyncAt,
    last_activity_at: lastActivityAt,
    sync_counts: {
      customers: snapshot.customersSynced ?? 0,
      products: snapshot.productsSynced ?? 0,
      sales: snapshot.salesSynced ?? 0,
    },
    sync_errors: snapshot.syncErrors,
    webhooks: {
      monitored: snapshot.hasWebhookMonitoring,
      subscribed: snapshot.webhooksSubscribed,
      registered: snapshot.webhookRegistered,
      last_checked_at: snapshot.webhooksLastCheckedAt,
      last_received_at: snapshot.lastWebhookReceivedAt,
      retry_count: snapshot.webhookRetryCount ?? 0,
      next_retry_at: snapshot.webhookNextRetryAt,
      last_error: snapshot.webhookLastError,
    },
    latest_sync_job: syncJobPayload(latestJob),
    latest_import_job: importJobPayload(latestImportJob),
    metadata: snapshot.metadata,
    recommendations: recommendationsForConnection(
      snapshot,
      latestJob,
      latestImportJob,
    ),
  };
}

function twilioStatusRow(
  tenantId: string,
  numbers: TwilioPhoneNumberRow[],
): JsonObject {
  if (numbers.length === 0) {
    return baseDisconnectedRow("twilio", tenantId);
  }

  const activeCount = numbers.filter(
    (number) => number.is_active === true,
  ).length;
  const verifiedCount = numbers.filter(
    (number) => number.is_verified === true,
  ).length;
  const latestHealthAt = mostRecentTimestamp(
    numbers.map(
      (number) => number.last_health_evaluated_at ?? number.updated_at,
    ),
  );
  const unhealthyNumbers = numbers.filter(
    (number) =>
      finiteNumber(number.failure_rate_30d) > 5 ||
      finiteNumber(number.bounce_rate_30d) > 5,
  );
  const health: IntegrationHealth =
    activeCount === 0
      ? "warning"
      : unhealthyNumbers.length > 0
        ? "warning"
        : "healthy";

  return {
    tenant_id: tenantId,
    provider: "twilio",
    provider_label: providerLabel("twilio"),
    status: activeCount > 0 ? "connected" : "configured_inactive",
    health,
    account_name: `${activeCount}/${numbers.length} active phone numbers`,
    account_id: null,
    connected_at: numbers[numbers.length - 1]?.updated_at ?? null,
    updated_at: numbers[0]?.updated_at ?? null,
    last_sync_at: latestHealthAt,
    last_activity_at: latestHealthAt,
    sync_counts: {
      phone_numbers: numbers.length,
      active_phone_numbers: activeCount,
      verified_phone_numbers: verifiedCount,
      daily_sent_count: numbers.reduce(
        (total, number) => total + finiteNumber(number.daily_sent_count),
        0,
      ),
    },
    webhooks: {
      monitored: false,
      subscribed: null,
      last_checked_at: latestHealthAt,
      last_received_at: null,
      retry_count: 0,
      next_retry_at: null,
      last_error: null,
    },
    phone_numbers: numbers.map((number) => ({
      id: number.id,
      friendly_name: number.friendly_name,
      phone_number: number.phone_number,
      is_active: number.is_active,
      is_verified: number.is_verified,
      daily_limit: number.daily_limit,
      daily_sent_count: number.daily_sent_count,
      failure_rate_30d: number.failure_rate_30d,
      bounce_rate_30d: number.bounce_rate_30d,
      warmup_stage: number.warmup_stage,
      last_health_evaluated_at: number.last_health_evaluated_at,
    })),
    latest_sync_job: null,
    latest_import_job: null,
    recommendations:
      activeCount === 0
        ? [
            "Activate at least one Twilio phone number before sending SMS campaigns.",
          ]
        : unhealthyNumbers.length > 0
          ? [
              "Review Twilio number health because one or more numbers have elevated failure or bounce rates.",
            ]
          : ["No immediate action needed."],
  };
}

function stripeStatusRow(tenantId: string): JsonObject {
  return baseDisconnectedRow("stripe", tenantId);
}

function tenantUserDisplayName(user: TenantUserRow): string {
  const fullName = user.full_name?.trim();
  if (fullName) {
    return fullName;
  }

  const name = user.name?.trim();
  if (name) {
    return name;
  }

  return user.email;
}

async function loadPrimaryTenantUser(
  client: BloomQueryClient,
  tenantId: string,
): Promise<TenantUserRow | null> {
  const { data, error } = await client
    .from("users")
    .select("id, email, full_name, name, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as TenantUserRow | null) ?? null;
}

async function loadStripeSubscription(
  client: BloomQueryClient,
  userId: string,
): Promise<StripeSubscriptionRow | null> {
  const { data, error } = await client
    .from("subscriptions")
    .select(
      "user_id, plan, tier, status, billing_interval, current_period_start, current_period_end, cancel_at_period_end, trial_end, start_date, end_date, deleted_at, max_connections, stripe_customer_id, stripe_subscription_id, stripe_subscription_item_id, created_at, updated_at",
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as StripeSubscriptionRow | null) ?? null;
}

async function loadStripePlanDefinition(
  client: BloomQueryClient,
  plan: string,
): Promise<PlanDefinitionShape | null> {
  const { data, error } = await client
    .from("plan_definitions")
    .select("max_products")
    .eq("plan", plan)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as PlanDefinitionShape | null) ?? null;
}

function stripeHealth(status: string): IntegrationHealth {
  switch (status) {
    case "active":
    case "trialing":
      return "healthy";
    case "past_due":
    case "unpaid":
    case "canceled":
    case "expired":
      return "warning";
    default:
      return "not_connected";
  }
}

function stripeRecommendations(args: {
  planDisplayName: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  primaryUserLabel: string;
}): string[] {
  switch (args.status) {
    case "trialing":
      return args.currentPeriodEnd
        ? [
            `${args.planDisplayName} trial ends on ${args.currentPeriodEnd}. Review billing before access expires.`,
          ]
        : [
            `${args.planDisplayName} is currently trialing for ${args.primaryUserLabel}.`,
          ];
    case "past_due":
    case "unpaid":
      return [
        `Resolve the Stripe billing issue for ${args.primaryUserLabel} so premium access is not interrupted.`,
      ];
    case "canceled":
      return args.currentPeriodEnd
        ? [
            `Stripe billing is canceled and access ends on ${args.currentPeriodEnd}. Renew the subscription if this tenant should stay active.`,
          ]
        : [
            "Stripe billing is canceled for this tenant. Renew the subscription if access should continue.",
          ];
    case "expired":
      return [
        "Stripe billing has expired for this tenant. Renew or update billing details to restore active access.",
      ];
    default:
      return args.cancelAtPeriodEnd && args.currentPeriodEnd
        ? [
            `Stripe billing is active, but it is scheduled to cancel at period end on ${args.currentPeriodEnd}.`,
          ]
        : ["No immediate action needed."];
  }
}

function stripeDisconnectedRow(
  tenantId: string,
  recommendation: string,
): JsonObject {
  return {
    ...baseDisconnectedRow("stripe", tenantId),
    recommendations: [recommendation],
  };
}

async function stripeStatusRow(
  client: BloomQueryClient,
  tenantId: string,
): Promise<JsonObject> {
  const primaryUser = await loadPrimaryTenantUser(client, tenantId);
  if (!primaryUser) {
    return stripeDisconnectedRow(
      tenantId,
      "No primary tenant user was found, so Bloom could not resolve Stripe billing status.",
    );
  }

  const subscription = await loadStripeSubscription(client, primaryUser.id);
  if (!subscription) {
    return stripeDisconnectedRow(
      tenantId,
      `No Stripe-backed subscription record was found for ${tenantUserDisplayName(primaryUser)}.`,
    );
  }

  const effectivePlan = getEffectivePlan(subscription);
  const planDefinition = effectivePlan
    ? await loadStripePlanDefinition(client, effectivePlan)
    : null;
  const snapshot = buildSubscriptionSnapshot(
    subscription,
    planDefinition,
    new Date(),
  );

  if (!snapshot) {
    return stripeDisconnectedRow(
      tenantId,
      "Stripe billing data is incomplete for this tenant.",
    );
  }

  const updatedAt = subscription.updated_at ?? subscription.created_at ?? null;

  return {
    tenant_id: tenantId,
    provider: "stripe",
    provider_label: providerLabel("stripe"),
    status: snapshot.status,
    health: stripeHealth(snapshot.status),
    account_name: snapshot.plan_display_name,
    account_id:
      subscription.stripe_customer_id ??
      subscription.stripe_subscription_id ??
      subscription.stripe_subscription_item_id ??
      primaryUser.id,
    connected_at:
      snapshot.current_period_start ?? subscription.start_date ?? updatedAt,
    updated_at: updatedAt,
    last_sync_at: snapshot.current_period_end,
    last_activity_at: updatedAt,
    sync_counts: {
      max_connections: snapshot.feature_limits.maxSites,
      max_products: snapshot.feature_limits.maxProducts,
    },
    webhooks: {
      monitored: false,
      subscribed: null,
      last_checked_at: null,
      last_received_at: null,
      retry_count: 0,
      next_retry_at: null,
      last_error: null,
    },
    latest_sync_job: null,
    latest_import_job: null,
    metadata: {
      primary_user_id: primaryUser.id,
      primary_user_email: primaryUser.email,
      plan: snapshot.plan,
      plan_display_name: snapshot.plan_display_name,
      billing_interval: snapshot.billing_interval,
      current_period_start: snapshot.current_period_start,
      current_period_end: snapshot.current_period_end,
      cancel_at_period_end: snapshot.cancel_at_period_end,
      trial_end: snapshot.trial_end,
      can_access_premium: snapshot.can_access_premium,
      feature_limits: snapshot.feature_limits,
      stripe_customer_id: subscription.stripe_customer_id ?? null,
      stripe_subscription_id: subscription.stripe_subscription_id ?? null,
      stripe_subscription_item_id:
        subscription.stripe_subscription_item_id ?? null,
    },
    recommendations: stripeRecommendations({
      planDisplayName: snapshot.plan_display_name,
      status: snapshot.status,
      cancelAtPeriodEnd: snapshot.cancel_at_period_end,
      currentPeriodEnd: snapshot.current_period_end,
      primaryUserLabel: tenantUserDisplayName(primaryUser),
    }),
  };
}

async function integrationRowForProvider(
  provider: IntegrationProvider,
  client: BloomQueryClient,
  context: ToolExecutionContext,
  latestJobs: Map<string, PosSyncJobRow>,
): Promise<JsonObject> {
  switch (provider) {
    case "square":
      return integrationRowFromConnection(
        context.tenantId,
        await loadSquareConnection(client, context),
        provider,
        latestJobs.get(provider) ?? null,
        null,
      );
    case "clover":
      return integrationRowFromConnection(
        context.tenantId,
        await loadCloverConnection(client, context),
        provider,
        latestJobs.get(provider) ?? null,
        null,
      );
    case "lightspeed":
      return integrationRowFromConnection(
        context.tenantId,
        await loadLightspeedConnection(client, context),
        provider,
        latestJobs.get(provider) ?? null,
        null,
      );
    case "shopify":
      return integrationRowFromConnection(
        context.tenantId,
        await loadShopifyConnection(client, context),
        provider,
        null,
        null,
      );
    case "mailchimp": {
      const { connection, importJob } = await loadMailchimpConnection(
        client,
        context.tenantId,
      );
      return integrationRowFromConnection(
        context.tenantId,
        connection,
        provider,
        null,
        importJob,
      );
    }
    case "twilio":
      return twilioStatusRow(
        context.tenantId,
        await loadTwilioNumbers(client, context.tenantId),
      );
    case "stripe":
      return stripeStatusRow(client, context.tenantId);
  }
}

export const getIntegrationStatus: ToolImplementation = async (
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> => {
  const client = getQueryClient(context);
  const requestedProvider = integrationProviderFromValue(params.provider);
  const providers =
    requestedProvider === "all" ? INTEGRATION_PROVIDERS : [requestedProvider];
  const posProviders = providers.filter(
    (provider): provider is PosSyncProvider =>
      POS_SYNC_PROVIDERS.includes(provider as PosSyncProvider),
  );
  const latestJobs = await loadLatestPosJobs(
    client,
    context.tenantId,
    posProviders,
  );
  const rows = await Promise.all(
    providers.map((provider) =>
      integrationRowForProvider(provider, client, context, latestJobs),
    ),
  );

  if (requestedProvider !== "all") {
    return createResult({
      data: rows[0] ?? null,
      count: rows.length,
      blockType: "data_card",
      message: `Loaded ${providerLabel(requestedProvider)} integration status.`,
    });
  }

  return createResult({
    data: rows as JsonArray,
    count: rows.length,
    blockType: "data_table",
    message: `Loaded status for ${rows.length} integrations.`,
  });
};

function insightPayloadFromCache(
  row: CustomerAiInsightRow,
  customer: CustomerLookupRow,
  cached: boolean,
): JsonObject {
  return {
    tenant_id: row.tenant_id,
    customer_id: row.customer_id,
    customer: customerSummary(customer),
    key_insight: row.key_insight,
    behavioral_patterns: jsonArrayOrEmpty(row.behavioral_patterns),
    recommended_actions: jsonArrayOrEmpty(row.recommended_actions),
    has_sufficient_data: row.has_sufficient_data ?? false,
    model_used: row.model_used,
    prompt_tokens: row.prompt_tokens,
    completion_tokens: row.completion_tokens,
    generated_at: row.generated_at,
    expires_at: row.expires_at,
    cached,
    source: "customer_ai_insights",
  };
}

async function loadCachedCustomerInsight(
  client: BloomQueryClient,
  tenantId: string,
  customerId: string,
): Promise<CustomerAiInsightRow | null> {
  const now = new Date().toISOString();
  const generatedAfter = new Date(Date.now() - DAY_MS).toISOString();
  const { data, error } = await client
    .from("customer_ai_insights")
    .select(
      "customer_id, tenant_id, key_insight, behavioral_patterns, recommended_actions, has_sufficient_data, model_used, prompt_tokens, completion_tokens, generated_at, expires_at",
    )
    .eq("tenant_id", tenantId)
    .eq("customer_id", customerId)
    .gte("generated_at", generatedAfter)
    .gte("expires_at", now)
    .order("generated_at", { ascending: false, nullsFirst: false })
    .limit(1);

  if (error) {
    throw error;
  }

  return ((data ?? []) as CustomerAiInsightRow[])[0] ?? null;
}

function readEdgeFunctionError(response: JsonObject): string | null {
  const error = readString(response.error);
  if (error) {
    return error;
  }

  const message = readString(response.message);
  return response.success === false && message ? message : null;
}

function insightPayloadFromFunctionResponse(
  response: JsonObject,
  customer: CustomerLookupRow,
  tenantId: string,
  customerId: string,
): JsonObject {
  return {
    tenant_id: tenantId,
    customer_id: customerId,
    customer: customerSummary(customer),
    key_insight:
      readString(response.keyInsight) ??
      readString(response.key_insight) ??
      "No insight generated.",
    behavioral_patterns: jsonArrayOrEmpty(
      response.patterns ?? response.behavioral_patterns,
    ),
    recommended_actions: jsonArrayOrEmpty(
      response.actions ?? response.recommended_actions,
    ),
    has_sufficient_data:
      response.hasSufficientData === true ||
      response.has_sufficient_data === true,
    model_used:
      readString(response.modelUsed) ?? readString(response.model_used),
    generated_at:
      readString(response.generatedAt) ??
      readString(response.generated_at) ??
      new Date().toISOString(),
    expires_at:
      readString(response.expiresAt) ?? readString(response.expires_at),
    cached: response.cached === true,
    source: "generate-customer-insights",
  };
}

async function invokeCustomerInsightsFunction(
  context: ToolExecutionContext,
  customerId: string,
): Promise<JsonObject> {
  const client = context.dataClient;
  if (!client) {
    throw new Error("Authenticated customer insights client was unavailable.");
  }

  const { data, error } = await client.functions.invoke(
    "generate-customer-insights",
    {
      body: { customer_id: customerId },
    },
  );

  if (error) {
    throw error;
  }

  const response = jsonObjectOrNull(data);
  if (!response) {
    throw new Error("generate-customer-insights returned an invalid response.");
  }

  const responseError = readEdgeFunctionError(response);
  if (responseError) {
    throw new Error(responseError);
  }

  return response;
}

export const getCustomerInsights: ToolImplementation = async (
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> => {
  const customerId = readString(params.customer_id);
  if (!customerId) {
    return errorResult("customer_id is required.", "validation_error");
  }

  const client = getQueryClient(context);
  const customer = await loadCustomer(client, context.tenantId, customerId);
  if (!customer) {
    return errorResult("Customer not found for this tenant.", "not_found");
  }

  const cachedInsight = await loadCachedCustomerInsight(
    client,
    context.tenantId,
    customerId,
  );
  if (cachedInsight) {
    const data = insightPayloadFromCache(cachedInsight, customer, true);
    return createResult({
      data,
      count: 1,
      blockType: "data_card",
      message: `Loaded cached customer insight for ${customerDisplayName(customer)}.`,
    });
  }

  const response = await invokeCustomerInsightsFunction(context, customerId);
  const data = insightPayloadFromFunctionResponse(
    response,
    customer,
    context.tenantId,
    customerId,
  );

  return createResult({
    data,
    count: 1,
    blockType: "data_card",
    message: `Generated customer insight for ${customerDisplayName(customer)}.`,
  });
};
