import type {
  BloomMode,
  JsonArray,
  JsonObject,
  JsonValue,
  OpenAIToolDefinition,
  OrchestratorContext,
  PersistenceClient,
  ToolExecutionStatus,
} from "../types.ts";

export const TOOL_ROLES = ["admin", "staff", "viewer"] as const;
export const TOOL_CATEGORIES = [
  "query",
  "mutation",
  "analytics",
  "content",
  "navigation",
  "utility",
] as const;
export const TOOL_RISK_LEVELS = ["safe", "low", "medium", "high"] as const;
export const TOOL_BLOCK_TYPES = [
  "data_card",
  "data_table",
  "stat_card",
  "chart",
  "text",
  "image",
  "navigation",
  "confirmation",
] as const;
export const INTENT_CATEGORIES = [
  "query",
  "mutation",
  "analytics",
  "content",
  "image",
  "navigation",
  "general",
] as const;
export const INTENT_COMPLEXITIES = ["simple", "complex"] as const;
export const FILTER_OPERATORS = [
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "starts_with",
  "ends_with",
  "gt",
  "lt",
  "gte",
  "lte",
  "between",
  "in",
  "not_in",
  "is_null",
  "is_not_null",
  "has",
  "has_not",
  "has_count",
] as const;
export const TOOL_ENTITIES = [
  "customer",
  "product",
  "campaign",
  "segment",
  "order",
] as const;
export const CUSTOMER_FILTER_FIELDS = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "total_spent",
  "lifetime_value",
  "last_purchase_date",
  "created_at",
  "sms_opt_in",
  "email_opt_in",
  "signup_source",
  "preferred_channel",
  "city",
  "state_region",
  "postal_code",
  "is_vip",
  "suppressed",
  "persona",
  "persona_id",
  "segment",
  "tag",
  "product_tag",
] as const;
export const PRODUCT_FILTER_FIELDS = [
  "name",
  "sku",
  "status",
  "source",
  "price",
  "compare_at_price",
  "cost_price",
  "inventory_count",
  "is_visible",
  "track_inventory",
  "category",
  "subcategory",
  "created_at",
  "updated_at",
] as const;
export const CAMPAIGN_FILTER_FIELDS = [
  "name",
  "subject_line",
  "status",
  "delivery_method",
  "created_at",
  "scheduled_at",
  "sent_at",
  "segment_id",
  "open_rate",
  "click_rate",
  "messages_sent",
  "messages_failed",
  "total_recipients",
  "auto_send_enabled",
] as const;
export const SEGMENT_FILTER_FIELDS = [
  "name",
  "status",
  "customer_count",
  "auto_update",
  "include_all_customers",
  "is_system_segment",
  "created_at",
  "updated_at",
  "source",
  "persona_id",
] as const;
export const ORDER_FILTER_FIELDS = [
  "source",
  "external_id",
  "email",
  "status",
  "financial_status",
  "fulfillment_status",
  "fulfillment_state",
  "order_date",
  "created_at",
  "total_amount",
  "total_price",
  "currency",
] as const;
export const PRODUCT_SOURCES = [
  "platform",
  "square",
  "stripe",
  "shopify",
  "lightspeed",
  "import",
] as const;
export const PRODUCT_STATUSES = ["active", "draft", "archived"] as const;
export const CAMPAIGN_STATUSES = [
  "draft",
  "scheduled",
  "queued",
  "partially_queued",
  "sending",
  "paused",
  "sent",
  "failed",
  "archived",
] as const;
export const CAMPAIGN_DELIVERY_METHODS = ["email", "sms"] as const;
export const SEGMENT_STATUSES = [
  "draft",
  "active",
  "paused",
  "archived",
] as const;
export const SEGMENT_KINDS = ["dynamic", "static"] as const;
export const CUSTOMER_CHANNELS = ["email", "sms", "both", "none"] as const;
export const ORDER_SOURCES = [
  "square",
  "clover",
  "shopify",
  "lightspeed",
] as const;

export type ToolRole = (typeof TOOL_ROLES)[number];
export type ToolCategory = (typeof TOOL_CATEGORIES)[number];
export type ToolRiskLevel = (typeof TOOL_RISK_LEVELS)[number];
export type ToolBlockType = (typeof TOOL_BLOCK_TYPES)[number];
export type IntentClassification = (typeof INTENT_CATEGORIES)[number];
export type IntentComplexity = (typeof INTENT_COMPLEXITIES)[number];
export type IntentClassificationResult = {
  category: IntentClassification;
  complexity: IntentComplexity;
};
export type FilterOperator = (typeof FILTER_OPERATORS)[number];
export type ToolEntity = (typeof TOOL_ENTITIES)[number];

export type ToolName =
  | "query_customers"
  | "query_products"
  | "query_campaigns"
  | "query_segments"
  | "query_tags"
  | "query_personas"
  | "query_orders"
  | "search_knowledge"
  | "get_customer_detail"
  | "get_product_detail"
  | "get_segment_members"
  | "create_customer"
  | "update_customer"
  | "delete_customer"
  | "create_product"
  | "update_product"
  | "toggle_product_status"
  | "create_campaign"
  | "update_campaign"
  | "clone_campaign"
  | "schedule_campaign"
  | "send_campaign"
  | "pause_resume_campaign"
  | "create_segment"
  | "update_segment"
  | "assign_segment"
  | "create_tag"
  | "bulk_tag_customers"
  | "manage_consent"
  | "get_dashboard_summary"
  | "get_revenue_analytics"
  | "get_email_health"
  | "get_customer_timeline"
  | "get_campaign_analytics"
  | "get_integration_status"
  | "get_customer_insights"
  | "generate_content"
  | "generate_image"
  | "navigate_to"
  | "export_data"
  | "compute_audience_size";

export type ToolDefinition = OpenAIToolDefinition & {
  function: OpenAIToolDefinition["function"] & {
    name: ToolName;
    parameters: JsonObject;
  };
  category: ToolCategory;
  risk_level: ToolRiskLevel;
  requires_confirmation: boolean;
  allowed_roles: ToolRole[];
  allowed_modes: BloomMode[];
};

export type ToolFilter = {
  entity?: ToolEntity;
  field: string;
  operator: FilterOperator;
  value?: JsonValue;
};

export type JunctionFilterValue = {
  relationship: "segment" | "tag" | "persona";
  match_field: "id" | "name";
  match_value: JsonValue;
  matching_ids?: string[];
  count?: number;
};

export type ConfirmationDetails = {
  action: string;
  affected_count: number | null;
  reversible: boolean;
  risk_level: ToolRiskLevel;
  tool_name: ToolName;
};

export type ToolResult = {
  success: boolean;
  data: JsonValue | null;
  count: number | null;
  message: string;
  error: string | null;
  block_type: ToolBlockType;
  confirmation_required?: boolean;
  confirmation_details?: ConfirmationDetails | null;
};

export type ToolExecutionContext = OrchestratorContext & {
  conversationId: string;
  messageId: string;
  timezone: string;
  authenticatedTenantId?: string;
  cacheAuditScopeId?: string;
  serviceClient: PersistenceClient;
  dataClient?: PersistenceClient;
  approved?: boolean;
};

export type ToolImplementation = (
  params: JsonObject,
  context: ToolExecutionContext,
) => Promise<ToolResult>;

export type ToolValidationIssue = {
  path: string;
  message: string;
};

export type ToolValidationResult =
  | { ok: true; value: JsonObject }
  | { ok: false; issues: ToolValidationIssue[] };

export type ToolExecutionLogInput = {
  toolName: string;
  input: JsonObject;
  output: JsonValue | null;
  status: ToolExecutionStatus;
  errorMessage: string | null;
  executionTimeMs: number;
};

export type ToolDefinitionFilter = {
  mode: BloomMode;
  userRole: string;
  intent?: IntentClassification | null;
};

export type IntentClassifierOptions = {
  openAiApiKey?: string;
  timeoutMs?: number;
};

export type FilterFieldCatalog = Record<ToolEntity, readonly string[]>;

export type ApplyFiltersOptions = {
  entity?: ToolEntity;
  timezone?: string;
  allowedFields?: readonly string[];
};

export type RelativeDateRange = {
  start: string;
  end: string;
};

export type ToolListPayload = JsonArray;
