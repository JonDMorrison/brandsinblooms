import type { BloomMode, JsonArray, JsonObject } from "../types.ts";
import type {
  IntentClassification,
  ToolCategory,
  ToolDefinition,
  ToolDefinitionFilter,
  ToolName,
  ToolRiskLevel,
  ToolRole,
} from "./types.ts";
import {
  CAMPAIGN_DELIVERY_METHODS,
  CAMPAIGN_FILTER_FIELDS,
  CAMPAIGN_STATUSES,
  CUSTOMER_CHANNELS,
  CUSTOMER_FILTER_FIELDS,
  FILTER_OPERATORS,
  ORDER_FILTER_FIELDS,
  ORDER_SOURCES,
  PRODUCT_FILTER_FIELDS,
  PRODUCT_SOURCES,
  PRODUCT_STATUSES,
  SEGMENT_FILTER_FIELDS,
  SEGMENT_KINDS,
  SEGMENT_STATUSES,
} from "./types.ts";

const ALL_ROLES: ToolRole[] = ["admin", "staff", "viewer"];
const STAFF_PLUS: ToolRole[] = ["admin", "staff"];
const ADMIN_ONLY: ToolRole[] = ["admin"];
const STANDARD_REASONING: BloomMode[] = ["standard", "reasoning"];
const QUERY_MODES: BloomMode[] = ["standard", "reasoning", "research"];
const CONTENT_MODES: BloomMode[] = ["standard", "reasoning"];
const IMAGE_MODES: BloomMode[] = ["image"];
const NAVIGATION_MODES: BloomMode[] = ["standard", "reasoning", "research"];
const SORT_ORDERS = ["asc", "desc"] as const;
const PAGE_SIZES = [10, 25, 50] as const;
const EXPORT_FORMATS = ["csv", "json"] as const;
const CONTENT_TYPES = [
  "email_body",
  "subject_lines",
  "sms",
  "product_description",
  "social_post",
  "email_subject",
  "sms_message",
  "campaign_copy",
  "social_caption",
] as const;
const CONTENT_TONES = [
  "professional",
  "casual",
  "playful",
  "urgent",
  "seasonal",
  "warm",
  "educational",
] as const;
const CONTENT_PLATFORMS = ["facebook", "instagram"] as const;
const SOCIAL_CONTENT_TYPES = [
  "tips",
  "feature",
  "workshop",
  "inspiration",
  "behind-scenes",
] as const;
const IMAGE_STYLES = [
  "photorealistic",
  "illustration",
  "flat",
  "watercolor",
  "sketch",
  "product_photo",
  "lifestyle",
  "seasonal_display",
  "social_graphic",
  "email_header",
] as const;
const IMAGE_ASPECT_RATIOS = [
  "square",
  "landscape",
  "portrait",
  "1:1",
  "4:3",
  "16:9",
  "9:16",
] as const;
const NAVIGATION_TARGETS = [
  "dashboard",
  "customers",
  "customer_detail",
  "products",
  "product_detail",
  "campaigns",
  "campaign_detail",
  "segments",
  "segment_detail",
  "integrations",
  "analytics",
  "settings",
] as const;
const ANALYTICS_RANGES = [
  "today",
  "yesterday",
  "last_7_days",
  "last_30_days",
  "this_month",
  "this_quarter",
  "this_year",
] as const;
const REVENUE_PERIODS = [
  "today",
  "this_week",
  "this_month",
  "this_quarter",
  "this_year",
  "custom",
] as const;
const REVENUE_BREAKDOWNS = [
  "total",
  "by_channel",
  "by_provider",
  "time_series",
] as const;
const DASHBOARD_COMPARISON_PERIODS = [
  "previous_period",
  "previous_month",
] as const;
const CAMPAIGN_ANALYTICS_TYPES = [
  "single",
  "comparison",
  "best",
  "worst",
  "time_series",
] as const;
const CAMPAIGN_ANALYTICS_METRICS = [
  "opens",
  "clicks",
  "delivery",
  "recipients",
  "failures",
  "all",
  "delivery_rate",
  "open_rate",
  "click_rate",
  "bounce_rate",
  "click_to_open_rate",
  "delivered_count",
  "open_count",
  "click_count",
  "unsubscribe_count",
  "spam_complaint_count",
  "total_recipients",
  "failure_count",
  "revenue_attributed",
  "conversion_rate",
] as const;
const ANALYTICS_DIRECTIONS = ["best", "worst", "asc", "desc"] as const;
const HEALTH_CHANNELS = ["email", "sms", "all"] as const;
const CUSTOMER_TIMELINE_EVENT_TYPES = [
  "purchase",
  "email",
  "sms",
  "consent",
  "segment",
  "tag",
  "loyalty",
  "risk",
  "all",
] as const;
const INTEGRATION_PROVIDERS = [
  "square",
  "clover",
  "shopify",
  "lightspeed",
  "mailchimp",
  "twilio",
  "stripe",
] as const;
const EXPORT_ENTITIES = [
  "customers",
  "products",
  "campaigns",
  "segments",
  "orders",
] as const;
const EXPORT_FILTER_ENTITIES = [
  "customer",
  "product",
  "campaign",
  "segment",
  "order",
] as const;
const EXPORT_FILTER_FIELDS = [
  ...CUSTOMER_FILTER_FIELDS,
  ...PRODUCT_FILTER_FIELDS,
  ...CAMPAIGN_FILTER_FIELDS,
  ...SEGMENT_FILTER_FIELDS,
  ...ORDER_FILTER_FIELDS,
] as const;

function enumValues(values: readonly (string | number)[]): JsonArray {
  return [...values];
}

function objectSchema(
  properties: Record<string, JsonObject>,
  required: string[] = [],
): JsonObject {
  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
}

function stringSchema(
  description: string,
  options: {
    enum?: readonly string[];
    minLength?: number;
    maxLength?: number;
    format?: string;
    pattern?: string;
  } = {},
): JsonObject {
  return {
    type: "string",
    description,
    ...(options.enum ? { enum: enumValues(options.enum) } : {}),
    ...(options.minLength ? { minLength: options.minLength } : {}),
    ...(options.maxLength ? { maxLength: options.maxLength } : {}),
    ...(options.format ? { format: options.format } : {}),
    ...(options.pattern ? { pattern: options.pattern } : {}),
  };
}

function numberSchema(
  description: string,
  options: {
    minimum?: number;
    maximum?: number;
  } = {},
): JsonObject {
  return {
    type: "number",
    description,
    ...(options.minimum !== undefined ? { minimum: options.minimum } : {}),
    ...(options.maximum !== undefined ? { maximum: options.maximum } : {}),
  };
}

function integerSchema(
  description: string,
  options: {
    minimum?: number;
    maximum?: number;
    enum?: readonly number[];
  } = {},
): JsonObject {
  return {
    type: "integer",
    description,
    ...(options.minimum !== undefined ? { minimum: options.minimum } : {}),
    ...(options.maximum !== undefined ? { maximum: options.maximum } : {}),
    ...(options.enum ? { enum: enumValues(options.enum) } : {}),
  };
}

function booleanSchema(description: string): JsonObject {
  return { type: "boolean", description };
}

function jsonObjectSchema(description: string): JsonObject {
  return { type: "object", description };
}

function arraySchema(
  description: string,
  items: JsonObject,
  options: {
    minItems?: number;
    maxItems?: number;
  } = {},
): JsonObject {
  return {
    type: "array",
    description,
    items,
    ...(options.minItems !== undefined ? { minItems: options.minItems } : {}),
    ...(options.maxItems !== undefined ? { maxItems: options.maxItems } : {}),
  };
}

function filterSchema(entity: string, fields: readonly string[]): JsonObject {
  return objectSchema(
    {
      entity: stringSchema("Entity this filter applies to.", {
        enum: [entity],
      }),
      field: stringSchema("Allowed filter field for this entity.", {
        enum: fields,
      }),
      operator: stringSchema("Filter operator to apply.", {
        enum: FILTER_OPERATORS,
      }),
      value: {
        description:
          "Filter value. For has, has_not, and has_count use relationship, match_field, match_value, and matching_ids once resolved.",
      },
    },
    ["field", "operator"],
  );
}

function exportFilterSchema(): JsonObject {
  return objectSchema(
    {
      entity: stringSchema("Export entity this filter applies to.", {
        enum: EXPORT_FILTER_ENTITIES,
      }),
      field: stringSchema("Allowed export filter field.", {
        enum: EXPORT_FILTER_FIELDS,
      }),
      operator: stringSchema("Filter operator to apply.", {
        enum: FILTER_OPERATORS,
      }),
      value: { description: "Filter value." },
    },
    ["entity", "field", "operator"],
  );
}

function queryParameters(
  entity: string,
  fields: readonly string[],
  sortFields: readonly string[],
): JsonObject {
  return objectSchema({
    filters: arraySchema(
      "AND-joined filters. Use junction operators for persona, segment, and tag relationships when supported by the tool.",
      filterSchema(entity, fields),
      { maxItems: 12 },
    ),
    search: stringSchema(
      "Optional search phrase for name, email, SKU, or title fields.",
      {
        minLength: 1,
        maxLength: 120,
      },
    ),
    page: integerSchema("One-based page number.", {
      minimum: 1,
      maximum: 1000,
    }),
    page_size: integerSchema("Page size.", { enum: PAGE_SIZES }),
    sort_by: stringSchema("Field to sort by.", { enum: sortFields }),
    sort_order: stringSchema("Sort direction.", { enum: SORT_ORDERS }),
  });
}

function idParameters(idName: string, description: string): JsonObject {
  return objectSchema(
    {
      [idName]: stringSchema(description, {
        pattern:
          "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
      }),
    },
    [idName],
  );
}

function uuidSchema(description: string): JsonObject {
  return stringSchema(description, {
    pattern:
      "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
  });
}

function defineTool(args: {
  name: ToolName;
  description: string;
  parameters: JsonObject;
  category: ToolCategory;
  riskLevel: ToolRiskLevel;
  requiresConfirmation: boolean;
  allowedRoles: ToolRole[];
  allowedModes: BloomMode[];
}): ToolDefinition {
  return {
    type: "function",
    function: {
      name: args.name,
      description: args.description,
      parameters: args.parameters,
    },
    category: args.category,
    risk_level: args.riskLevel,
    requires_confirmation: args.requiresConfirmation,
    allowed_roles: args.allowedRoles,
    allowed_modes: args.allowedModes,
  };
}

const customerWriteFields = {
  first_name: stringSchema("Customer first name.", { maxLength: 120 }),
  last_name: stringSchema("Customer last name.", { maxLength: 120 }),
  email: stringSchema("Customer email address.", {
    format: "email",
    maxLength: 320,
  }),
  phone: stringSchema("Customer phone number.", { maxLength: 40 }),
  city: stringSchema("Customer city.", { maxLength: 120 }),
  state_region: stringSchema("Customer state, province, or region.", {
    maxLength: 120,
  }),
  postal_code: stringSchema("Customer postal or ZIP code.", { maxLength: 32 }),
  preferred_channel: stringSchema("Preferred communication channel.", {
    enum: CUSTOMER_CHANNELS,
  }),
  email_opt_in: booleanSchema("Whether email consent is granted."),
  sms_opt_in: booleanSchema("Whether SMS consent is granted."),
  is_vip: booleanSchema("Whether the customer should be marked as VIP."),
  tags: arraySchema(
    "Customer tag names.",
    stringSchema("Tag name.", { maxLength: 80 }),
    {
      maxItems: 25,
    },
  ),
};
const productWriteFields = {
  name: stringSchema("Product name.", { minLength: 1, maxLength: 180 }),
  description: stringSchema("Product description.", { maxLength: 2000 }),
  sku: stringSchema("Product SKU.", { maxLength: 120 }),
  barcode: stringSchema("Barcode.", { maxLength: 120 }),
  price: numberSchema("Product price.", { minimum: 0 }),
  cost_price: numberSchema("Product cost.", { minimum: 0 }),
  compare_at_price: numberSchema("Compare-at price.", { minimum: 0 }),
  currency: stringSchema("ISO currency code.", { pattern: "^[A-Z]{3}$" }),
  inventory_count: integerSchema("Inventory count.", { minimum: 0 }),
  track_inventory: booleanSchema("Whether inventory should be tracked."),
  low_stock_threshold: integerSchema("Low-stock threshold.", { minimum: 0 }),
  category: stringSchema("Product category.", { maxLength: 120 }),
  subcategory: stringSchema("Product subcategory.", { maxLength: 120 }),
  tags: arraySchema(
    "Product tags.",
    stringSchema("Tag name.", { maxLength: 80 }),
    {
      maxItems: 25,
    },
  ),
  source: stringSchema("Product source.", { enum: PRODUCT_SOURCES }),
  status: stringSchema("Product status.", { enum: PRODUCT_STATUSES }),
  is_visible: booleanSchema("Whether product is visible to shoppers."),
};
const campaignWriteFields = {
  name: stringSchema("Campaign name.", { minLength: 1, maxLength: 180 }),
  subject_line: stringSchema("Email subject line.", { maxLength: 180 }),
  preheader_text: stringSchema("Email preheader text.", { maxLength: 220 }),
  content: stringSchema("Campaign body content.", { maxLength: 20000 }),
  delivery_method: stringSchema("Campaign delivery channel.", {
    enum: CAMPAIGN_DELIVERY_METHODS,
  }),
  status: stringSchema("Campaign status.", { enum: CAMPAIGN_STATUSES }),
  segment_id: stringSchema("Target segment ID.", {
    pattern:
      "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
  }),
  include_all_customers: booleanSchema("Whether to target all customers."),
  scheduled_at: stringSchema("ISO timestamp for scheduled send.", {
    format: "date-time",
  }),
};
const segmentWriteFields = {
  name: stringSchema("Segment name.", { minLength: 1, maxLength: 180 }),
  description: stringSchema("Segment description.", { maxLength: 1000 }),
  kind: stringSchema("Segment type.", { enum: SEGMENT_KINDS }),
  type: stringSchema("Segment type alias.", { enum: SEGMENT_KINDS }),
  status: stringSchema("Segment status.", { enum: SEGMENT_STATUSES }),
  include_all_customers: booleanSchema(
    "Whether the segment includes all customers.",
  ),
  auto_update: booleanSchema(
    "Whether segment rules should refresh automatically.",
  ),
  rules: jsonObjectSchema(
    "Nested segment rule group from the CRM segment builder.",
  ),
  conditions: jsonObjectSchema("Segment conditions stored on crm_segments."),
  filters: arraySchema(
    "Customer filters used for a dynamic segment.",
    filterSchema("customer", CUSTOMER_FILTER_FIELDS),
    { maxItems: 20 },
  ),
  member_ids: arraySchema(
    "Static segment member customer IDs.",
    uuidSchema("Customer ID."),
    { maxItems: 250 },
  ),
  customer_ids: arraySchema(
    "Static segment member customer IDs.",
    uuidSchema("Customer ID."),
    { maxItems: 250 },
  ),
};

export const TOOL_REGISTRY: ToolDefinition[] = [
  defineTool({
    name: "query_customers",
    description:
      "Find and list CRM customers, contacts, people, buyers, clients, subscribers, VIPs, opt-ins, or local shoppers. Use for plural customer lookups, filtered lists, audience exploration, and questions like who bought recently. Use get_customer_detail for one known customer.",
    parameters: queryParameters(
      "customer",
      CUSTOMER_FILTER_FIELDS,
      CUSTOMER_FILTER_FIELDS,
    ),
    category: "query",
    riskLevel: "safe",
    requiresConfirmation: false,
    allowedRoles: ALL_ROLES,
    allowedModes: QUERY_MODES,
  }),
  defineTool({
    name: "query_products",
    description:
      "Find and list products, SKUs, inventory items, catalog entries, plants, supplies, visible items, low-stock items, or imported POS products. Use for product tables and catalog searches. Use get_product_detail for one known product.",
    parameters: queryParameters(
      "product",
      PRODUCT_FILTER_FIELDS,
      PRODUCT_FILTER_FIELDS,
    ),
    category: "query",
    riskLevel: "safe",
    requiresConfirmation: false,
    allowedRoles: ALL_ROLES,
    allowedModes: QUERY_MODES,
  }),
  defineTool({
    name: "query_campaigns",
    description:
      "Find and list campaigns, newsletters, emails, sends, scheduled blasts, drafts, failed sends, or marketing messages. Use for campaign grids, status checks, and performance-adjacent listing. Use get_campaign_analytics for deeper metrics.",
    parameters: queryParameters(
      "campaign",
      CAMPAIGN_FILTER_FIELDS,
      CAMPAIGN_FILTER_FIELDS,
    ),
    category: "query",
    riskLevel: "safe",
    requiresConfirmation: false,
    allowedRoles: ALL_ROLES,
    allowedModes: QUERY_MODES,
  }),
  defineTool({
    name: "query_segments",
    description:
      "Find and list customer segments, audiences, groups, dynamic lists, static lists, personas-backed audiences, or saved filters. Use when the user asks which segments exist or wants segment counts. Use get_segment_members for the customers inside one segment.",
    parameters: queryParameters(
      "segment",
      SEGMENT_FILTER_FIELDS,
      SEGMENT_FILTER_FIELDS,
    ),
    category: "query",
    riskLevel: "safe",
    requiresConfirmation: false,
    allowedRoles: ALL_ROLES,
    allowedModes: QUERY_MODES,
  }),
  defineTool({
    name: "query_tags",
    description:
      "Find and list CRM tags, customer labels, audience tags, applied labels, or saved tag definitions. Use when the user asks which tags exist or needs per-tag customer counts.",
    parameters: objectSchema({
      search: stringSchema("Optional tag search phrase.", {
        minLength: 1,
        maxLength: 120,
      }),
      page: integerSchema("One-based page number.", {
        minimum: 1,
        maximum: 1000,
      }),
      page_size: integerSchema("Page size.", { enum: PAGE_SIZES }),
    }),
    category: "query",
    riskLevel: "safe",
    requiresConfirmation: false,
    allowedRoles: ALL_ROLES,
    allowedModes: QUERY_MODES,
  }),
  defineTool({
    name: "query_personas",
    description:
      "Find and list customer personas, audience personas, shopper profiles, predefined persona options, or custom CRM personas. Use for persona selection and counts only; personas are read-only in Bloom Assist.",
    parameters: objectSchema({
      search: stringSchema("Optional persona search phrase.", {
        minLength: 1,
        maxLength: 120,
      }),
      include_system: booleanSchema(
        "Whether predefined system personas should be included.",
      ),
      page: integerSchema("One-based page number.", {
        minimum: 1,
        maximum: 1000,
      }),
      page_size: integerSchema("Page size.", { enum: PAGE_SIZES }),
    }),
    category: "query",
    riskLevel: "safe",
    requiresConfirmation: false,
    allowedRoles: ALL_ROLES,
    allowedModes: QUERY_MODES,
  }),
  defineTool({
    name: "query_orders",
    description:
      "Find and list orders, purchases, sales, transactions, Shopify orders, Square/Clover POS orders, Lightspeed sales, refunds, or fulfillment records. Use for order history and revenue record lookup, not high-level analytics.",
    parameters: queryParameters(
      "order",
      ORDER_FILTER_FIELDS,
      ORDER_FILTER_FIELDS,
    ),
    category: "query",
    riskLevel: "safe",
    requiresConfirmation: false,
    allowedRoles: ALL_ROLES,
    allowedModes: QUERY_MODES,
  }),
  defineTool({
    name: "search_knowledge",
    description:
      "Search the tenant knowledge base for policies, FAQs, product guides, store procedures, service details, or uploaded reference documents. Use when the user asks about store-specific information that may live outside CRM records.",
    parameters: objectSchema(
      {
        query: stringSchema(
          "Question or phrase to search in the knowledge base.",
          {
            minLength: 1,
            maxLength: 500,
          },
        ),
      },
      ["query"],
    ),
    category: "query",
    riskLevel: "safe",
    requiresConfirmation: false,
    allowedRoles: ALL_ROLES,
    allowedModes: QUERY_MODES,
  }),
  defineTool({
    name: "get_customer_detail",
    description:
      "Fetch one customer's full CRM profile by ID, including contact details, consent, personas, segments, tags, purchase metrics, and timeline-ready context. Use for one customer, contact, buyer, subscriber, or client when the ID is known.",
    parameters: idParameters("customer_id", "Customer ID to inspect."),
    category: "query",
    riskLevel: "safe",
    requiresConfirmation: false,
    allowedRoles: ALL_ROLES,
    allowedModes: QUERY_MODES,
  }),
  defineTool({
    name: "get_product_detail",
    description:
      "Fetch one product's full catalog record by ID, including details, inventory, variations, images, pricing, source, and visibility. Use for one SKU, item, plant, supply, or product when the ID is known.",
    parameters: idParameters("product_id", "Product ID to inspect."),
    category: "query",
    riskLevel: "safe",
    requiresConfirmation: false,
    allowedRoles: ALL_ROLES,
    allowedModes: QUERY_MODES,
  }),
  defineTool({
    name: "get_segment_members",
    description:
      "List customers inside a known segment or audience. Use for questions like who is in this segment, show members, audience membership, customer group contents, or segment roster.",
    parameters: objectSchema(
      {
        segment_id: uuidSchema("Segment ID."),
        page: integerSchema("One-based page number.", {
          minimum: 1,
          maximum: 1000,
        }),
        page_size: integerSchema("Page size.", { enum: PAGE_SIZES }),
        search: stringSchema("Optional member search phrase.", {
          maxLength: 120,
        }),
      },
      ["segment_id"],
    ),
    category: "query",
    riskLevel: "safe",
    requiresConfirmation: false,
    allowedRoles: ALL_ROLES,
    allowedModes: QUERY_MODES,
  }),

  defineTool({
    name: "create_customer",
    description:
      "Create a new customer, contact, buyer, client, subscriber, or shopper record. Use only after checking for duplicates with query_customers when the user asks to add someone new.",
    parameters: objectSchema(customerWriteFields, ["email"]),
    category: "mutation",
    riskLevel: "low",
    requiresConfirmation: true,
    allowedRoles: STAFF_PLUS,
    allowedModes: STANDARD_REASONING,
  }),
  defineTool({
    name: "update_customer",
    description:
      "Update an existing customer/contact profile, including names, phone, location, channel preference, VIP flag, or non-destructive consent fields. Use when changing one known customer.",
    parameters: objectSchema(
      {
        customer_id: uuidSchema("Customer ID to update."),
        changes: objectSchema(customerWriteFields),
      },
      ["customer_id", "changes"],
    ),
    category: "mutation",
    riskLevel: "medium",
    requiresConfirmation: true,
    allowedRoles: STAFF_PLUS,
    allowedModes: STANDARD_REASONING,
  }),
  defineTool({
    name: "delete_customer",
    description:
      "Delete or remove a customer/contact from the CRM. Use only when the user clearly asks to delete, remove, archive, or purge a known customer; never use for filtering or unsubscribing.",
    parameters: objectSchema(
      {
        customer_id: uuidSchema("Customer ID to delete."),
        deletion_mode: stringSchema("Deletion mode.", {
          enum: ["soft_delete"],
        }),
      },
      ["customer_id", "deletion_mode"],
    ),
    category: "mutation",
    riskLevel: "high",
    requiresConfirmation: true,
    allowedRoles: ADMIN_ONLY,
    allowedModes: STANDARD_REASONING,
  }),
  defineTool({
    name: "create_product",
    description:
      "Create a new product, SKU, catalog item, plant, supply, or inventory record. Use when the user wants to add an item to the product catalog.",
    parameters: objectSchema(productWriteFields, ["name", "price"]),
    category: "mutation",
    riskLevel: "low",
    requiresConfirmation: true,
    allowedRoles: STAFF_PLUS,
    allowedModes: STANDARD_REASONING,
  }),
  defineTool({
    name: "update_product",
    description:
      "Update an existing product, SKU, price, category, inventory settings, visibility, or catalog text. Use when changing one known product.",
    parameters: objectSchema(
      {
        product_id: uuidSchema("Product ID to update."),
        changes: objectSchema(productWriteFields),
      },
      ["product_id", "changes"],
    ),
    category: "mutation",
    riskLevel: "medium",
    requiresConfirmation: true,
    allowedRoles: STAFF_PLUS,
    allowedModes: STANDARD_REASONING,
  }),
  defineTool({
    name: "toggle_product_status",
    description:
      "Change a product's active, draft, or archived status. Use when the user says publish, activate, hide, archive, unarchive, draft, or disable a known product.",
    parameters: objectSchema(
      {
        product_id: uuidSchema("Product ID to change."),
        status: stringSchema("New product status.", { enum: PRODUCT_STATUSES }),
      },
      ["product_id", "status"],
    ),
    category: "mutation",
    riskLevel: "medium",
    requiresConfirmation: true,
    allowedRoles: STAFF_PLUS,
    allowedModes: STANDARD_REASONING,
  }),
  defineTool({
    name: "create_campaign",
    description:
      "Create a new campaign, newsletter, email, SMS blast, promotion, announcement, or marketing message draft. Use when the user wants a campaign record created, not just content generated.",
    parameters: objectSchema(campaignWriteFields, ["name", "delivery_method"]),
    category: "mutation",
    riskLevel: "low",
    requiresConfirmation: true,
    allowedRoles: STAFF_PLUS,
    allowedModes: STANDARD_REASONING,
  }),
  defineTool({
    name: "update_campaign",
    description:
      "Update a campaign draft or scheduled campaign fields such as name, subject, preheader, content, target segment, or send timing. Use for editing one known campaign.",
    parameters: objectSchema(
      {
        campaign_id: uuidSchema("Campaign ID to update."),
        changes: objectSchema(campaignWriteFields),
      },
      ["campaign_id", "changes"],
    ),
    category: "mutation",
    riskLevel: "medium",
    requiresConfirmation: true,
    allowedRoles: STAFF_PLUS,
    allowedModes: STANDARD_REASONING,
  }),
  defineTool({
    name: "clone_campaign",
    description:
      "Duplicate, copy, reuse, or clone an existing campaign into a new draft. Use when the user wants another version based on a prior email, SMS, newsletter, or promotion.",
    parameters: objectSchema(
      {
        campaign_id: uuidSchema("Campaign ID to clone."),
        new_name: stringSchema("Name for the cloned campaign.", {
          maxLength: 180,
        }),
      },
      ["campaign_id"],
    ),
    category: "mutation",
    riskLevel: "low",
    requiresConfirmation: true,
    allowedRoles: STAFF_PLUS,
    allowedModes: STANDARD_REASONING,
  }),
  defineTool({
    name: "schedule_campaign",
    description:
      "Schedule a campaign, newsletter, email, or SMS to send later. Use when the user gives a future send time or asks to queue a campaign for a date.",
    parameters: objectSchema(
      {
        campaign_id: uuidSchema("Campaign ID to schedule."),
        scheduled_at: stringSchema("ISO timestamp for the scheduled send.", {
          format: "date-time",
        }),
      },
      ["campaign_id", "scheduled_at"],
    ),
    category: "mutation",
    riskLevel: "medium",
    requiresConfirmation: true,
    allowedRoles: STAFF_PLUS,
    allowedModes: STANDARD_REASONING,
  }),
  defineTool({
    name: "send_campaign",
    description:
      "Send a campaign now, launch a newsletter, blast an SMS, or immediately deliver a marketing message. Use only for explicit send-now requests; schedule_campaign is for future sends.",
    parameters: objectSchema(
      {
        campaign_id: uuidSchema("Campaign ID to send."),
        send_mode: stringSchema("Send mode.", { enum: ["now"] }),
      },
      ["campaign_id", "send_mode"],
    ),
    category: "mutation",
    riskLevel: "high",
    requiresConfirmation: true,
    allowedRoles: ADMIN_ONLY,
    allowedModes: STANDARD_REASONING,
  }),
  defineTool({
    name: "pause_resume_campaign",
    description:
      "Pause, resume, stop, restart, hold, or continue an active campaign send queue. Use for campaign delivery state changes, not for editing content.",
    parameters: objectSchema(
      {
        campaign_id: uuidSchema("Campaign ID to pause or resume."),
        action: stringSchema("Campaign queue action.", {
          enum: ["pause", "resume"],
        }),
      },
      ["campaign_id", "action"],
    ),
    category: "mutation",
    riskLevel: "medium",
    requiresConfirmation: true,
    allowedRoles: STAFF_PLUS,
    allowedModes: STANDARD_REASONING,
  }),
  defineTool({
    name: "create_segment",
    description:
      "Create a customer segment, audience, group, saved filter, dynamic list, or static list. Use when the user asks to make a new audience definition.",
    parameters: objectSchema(segmentWriteFields, ["name"]),
    category: "mutation",
    riskLevel: "low",
    requiresConfirmation: true,
    allowedRoles: STAFF_PLUS,
    allowedModes: STANDARD_REASONING,
  }),
  defineTool({
    name: "update_segment",
    description:
      "Update a segment's name, description, status, rules, filters, dynamic/static setting, or audience definition. Use for one known segment.",
    parameters: objectSchema(
      {
        segment_id: uuidSchema("Segment ID to update."),
        changes: objectSchema(segmentWriteFields),
      },
      ["segment_id", "changes"],
    ),
    category: "mutation",
    riskLevel: "medium",
    requiresConfirmation: true,
    allowedRoles: STAFF_PLUS,
    allowedModes: STANDARD_REASONING,
  }),
  defineTool({
    name: "assign_segment",
    description:
      "Add or remove customers from a static segment or audience. Use when assigning known customers to a group, moving customers into a list, or removing them from membership.",
    parameters: objectSchema(
      {
        segment_id: uuidSchema("Segment ID."),
        customer_ids: arraySchema(
          "Customer IDs to assign or remove.",
          stringSchema("Customer ID.", {
            pattern:
              "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
          }),
          { minItems: 1, maxItems: 250 },
        ),
        action: stringSchema("Membership action.", { enum: ["add", "remove"] }),
      },
      ["segment_id", "customer_ids", "action"],
    ),
    category: "mutation",
    riskLevel: "medium",
    requiresConfirmation: true,
    allowedRoles: STAFF_PLUS,
    allowedModes: STANDARD_REASONING,
  }),
  defineTool({
    name: "create_tag",
    description:
      "Create a CRM tag, customer label, or reusable audience tag definition. Use when the user wants a new tag available for future tagging workflows.",
    parameters: objectSchema(
      {
        name: stringSchema("Tag name.", { minLength: 1, maxLength: 80 }),
      },
      ["name"],
    ),
    category: "mutation",
    riskLevel: "low",
    requiresConfirmation: true,
    allowedRoles: STAFF_PLUS,
    allowedModes: STANDARD_REASONING,
  }),
  defineTool({
    name: "bulk_tag_customers",
    description:
      "Apply or remove a tag from many customers, contacts, buyers, subscribers, or audience members. Use for bulk tagging, mass labeling, VIP tagging, or cleanup across multiple records.",
    parameters: objectSchema(
      {
        tag_id: uuidSchema("Tag ID to apply or remove."),
        customer_ids: arraySchema(
          "Customer IDs to tag.",
          stringSchema("Customer ID.", {
            pattern:
              "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
          }),
          { minItems: 1, maxItems: 1000 },
        ),
        action: stringSchema("Tag action.", { enum: ["add", "remove"] }),
      },
      ["tag_id", "customer_ids", "action"],
    ),
    category: "mutation",
    riskLevel: "medium",
    requiresConfirmation: true,
    allowedRoles: STAFF_PLUS,
    allowedModes: STANDARD_REASONING,
  }),
  defineTool({
    name: "manage_consent",
    description:
      "Manage customer communication consent, opt-in, opt-out, unsubscribe, SMS permission, or email permission. Use for compliance preference changes, not deletion. Bloom records the source as bloom_assist.",
    parameters: objectSchema(
      {
        customer_id: uuidSchema("Customer ID."),
        channel: stringSchema("Consent channel.", { enum: ["email", "sms"] }),
        action: stringSchema("Consent action.", {
          enum: ["opt_in", "opt_out"],
        }),
      },
      ["customer_id", "channel", "action"],
    ),
    category: "mutation",
    riskLevel: "medium",
    requiresConfirmation: true,
    allowedRoles: STAFF_PLUS,
    allowedModes: STANDARD_REASONING,
  }),

  defineTool({
    name: "get_dashboard_summary",
    description:
      "Summarize dashboard KPIs, overview cards, sales snapshot, customer counts, campaign status, growth trends, and business health. Use for broad CRM summary questions and executive overviews.",
    parameters: objectSchema({
      comparison_period: stringSchema(
        "Comparison period for directional KPI indicators.",
        {
          enum: DASHBOARD_COMPARISON_PERIODS,
        },
      ),
      date_range: stringSchema(
        "Backward-compatible analytics date range. Dashboard summary defaults to this month.",
        {
          enum: ANALYTICS_RANGES,
        },
      ),
    }),
    category: "analytics",
    riskLevel: "safe",
    requiresConfirmation: false,
    allowedRoles: ALL_ROLES,
    allowedModes: QUERY_MODES,
  }),
  defineTool({
    name: "get_revenue_analytics",
    description:
      "Analyze revenue, sales, order totals, average order value, refunds, POS performance, Shopify revenue, and time-based sales trends. Use for numbers, trends, charts, or comparisons.",
    parameters: objectSchema({
      period: stringSchema(
        "Revenue period. Use custom with start_date and end_date.",
        { enum: REVENUE_PERIODS },
      ),
      date_range: stringSchema("Backward-compatible revenue date range.", {
        enum: ANALYTICS_RANGES,
      }),
      start_date: stringSchema("Custom range start date or ISO date-time."),
      end_date: stringSchema("Custom range end date or ISO date-time."),
      breakdown: stringSchema("Revenue breakdown mode.", {
        enum: REVENUE_BREAKDOWNS,
      }),
      comparison: booleanSchema(
        "Whether to compare against the same-length previous period.",
      ),
      source: stringSchema("Revenue source.", {
        enum: [...ORDER_SOURCES, "all"],
      }),
      metric: stringSchema("Revenue metric.", {
        enum: [
          "total_revenue",
          "order_count",
          "average_order_value",
          "refunds",
        ],
      }),
    }),
    category: "analytics",
    riskLevel: "safe",
    requiresConfirmation: false,
    allowedRoles: ALL_ROLES,
    allowedModes: QUERY_MODES,
  }),
  defineTool({
    name: "get_email_health",
    description:
      "Analyze email deliverability, domain health, bounces, spam complaints, sender reputation, warmup status, and 30-day email health. Use for email health questions, not campaign listing or SMS health.",
    parameters: objectSchema({
      domain: stringSchema("Optional sending domain name to inspect."),
      date_range: stringSchema(
        "Backward-compatible health date range. Email health always uses the 30-day deliverability window.",
        { enum: ANALYTICS_RANGES },
      ),
      channel: stringSchema("Health channel.", { enum: HEALTH_CHANNELS }),
    }),
    category: "analytics",
    riskLevel: "safe",
    requiresConfirmation: false,
    allowedRoles: ALL_ROLES,
    allowedModes: QUERY_MODES,
  }),
  defineTool({
    name: "get_customer_timeline",
    description:
      "Fetch a customer's chronological activity, purchases, campaign events, emails, SMS events, consent changes, and CRM timeline. Use for what happened with one customer over time.",
    parameters: objectSchema(
      {
        customer_id: uuidSchema("Customer ID."),
        date_range: stringSchema("Timeline date range.", {
          enum: ANALYTICS_RANGES,
        }),
        start_date: stringSchema(
          "Optional custom timeline start date or ISO date-time.",
        ),
        end_date: stringSchema(
          "Optional custom timeline end date or ISO date-time.",
        ),
        event_types: arraySchema(
          "Optional event categories or event types to include.",
          stringSchema("Timeline event type.", {
            enum: CUSTOMER_TIMELINE_EVENT_TYPES,
          }),
          { maxItems: 12 },
        ),
        activity_type: stringSchema("Activity type.", {
          enum: CUSTOMER_TIMELINE_EVENT_TYPES,
        }),
        limit: integerSchema("Maximum timeline events to return.", {
          minimum: 1,
          maximum: 100,
        }),
      },
      ["customer_id"],
    ),
    category: "analytics",
    riskLevel: "safe",
    requiresConfirmation: false,
    allowedRoles: ALL_ROLES,
    allowedModes: QUERY_MODES,
  }),
  defineTool({
    name: "get_campaign_analytics",
    description:
      "Analyze one or more campaigns, newsletters, email sends, SMS sends, opens, clicks, recipients, failures, delivery progress, and performance rates. Use for campaign results and post-send performance.",
    parameters: objectSchema({
      campaign_id: stringSchema("Optional campaign ID.", {
        pattern:
          "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
      }),
      campaign_ids: arraySchema(
        "Campaign IDs to compare side by side.",
        uuidSchema("Campaign ID."),
        { minItems: 2, maxItems: 5 },
      ),
      analysis_type: stringSchema("Analytics request shape.", {
        enum: CAMPAIGN_ANALYTICS_TYPES,
      }),
      date_range: stringSchema("Campaign analytics date range.", {
        enum: ANALYTICS_RANGES,
      }),
      start_date: stringSchema(
        "Start date or ISO timestamp for a time-series range.",
      ),
      end_date: stringSchema(
        "End date or ISO timestamp for a time-series range.",
      ),
      metric: stringSchema("Campaign metric.", {
        enum: CAMPAIGN_ANALYTICS_METRICS,
      }),
      sort_direction: stringSchema("Best/worst sort direction.", {
        enum: ANALYTICS_DIRECTIONS,
      }),
      limit: integerSchema(
        "Number of rows to return for best/worst analysis.",
        {
          minimum: 1,
          maximum: 10,
        },
      ),
    }),
    category: "analytics",
    riskLevel: "safe",
    requiresConfirmation: false,
    allowedRoles: ALL_ROLES,
    allowedModes: QUERY_MODES,
  }),
  defineTool({
    name: "get_integration_status",
    description:
      "Check integration connection health, POS sync status, provider state, account status, revoked tokens, last sync, and connected services such as Square, Clover, Shopify, Lightspeed, Mailchimp, Twilio, or Stripe.",
    parameters: objectSchema({
      provider: stringSchema("Integration provider.", {
        enum: [...INTEGRATION_PROVIDERS, "all"],
      }),
    }),
    category: "analytics",
    riskLevel: "safe",
    requiresConfirmation: false,
    allowedRoles: ALL_ROLES,
    allowedModes: QUERY_MODES,
  }),
  defineTool({
    name: "get_customer_insights",
    description:
      "Analyze one customer's behavior, engagement, repeat purchase patterns, channel preference, risk, and actionable CRM insights. Uses cached AI insights before generating fresh insights.",
    parameters: objectSchema(
      {
        customer_id: uuidSchema("Customer ID to inspect."),
        date_range: stringSchema("Customer insight date range.", {
          enum: ANALYTICS_RANGES,
        }),
        insight_type: stringSchema("Insight type.", {
          enum: [
            "vip",
            "lapsed",
            "engagement",
            "persona",
            "purchase",
            "consent",
            "all",
          ],
        }),
        filters: arraySchema(
          "Customer filters.",
          filterSchema("customer", CUSTOMER_FILTER_FIELDS),
          {
            maxItems: 12,
          },
        ),
      },
      ["customer_id"],
    ),
    category: "analytics",
    riskLevel: "safe",
    requiresConfirmation: false,
    allowedRoles: ALL_ROLES,
    allowedModes: QUERY_MODES,
  }),

  defineTool({
    name: "generate_content",
    description:
      "Generate marketing text, email copy, SMS copy, campaign copy, product descriptions, subject lines, social captions, or seasonal retail wording. Use for drafting content only, not saving or sending a campaign.",
    parameters: objectSchema(
      {
        content_type: stringSchema("Content type to generate.", {
          enum: CONTENT_TYPES,
        }),
        tone: stringSchema("Writing tone.", { enum: CONTENT_TONES }),
        prompt: stringSchema("Primary user prompt or content instructions.", {
          minLength: 1,
          maxLength: 2000,
        }),
        instructions: stringSchema(
          "Specific generation or refinement instructions.",
          {
            minLength: 1,
            maxLength: 2000,
          },
        ),
        topic: stringSchema(
          "Topic, product, season, or offer to write about.",
          {
            minLength: 1,
            maxLength: 300,
          },
        ),
        audience: stringSchema("Audience description.", { maxLength: 240 }),
        target_audience: stringSchema("Target audience description.", {
          maxLength: 240,
        }),
        target_persona: stringSchema("Persona name or description to target.", {
          maxLength: 180,
        }),
        persona_id: uuidSchema("Tenant persona ID to target."),
        persona_name: stringSchema("Tenant persona name to target.", {
          maxLength: 180,
        }),
        product_id: uuidSchema("Product ID to include as context."),
        product_context: { description: "Optional product context object." },
        campaign_id: uuidSchema("Campaign ID to include as context."),
        campaign_context: stringSchema("Optional campaign context text.", {
          maxLength: 4000,
        }),
        campaign_title: stringSchema(
          "Campaign title for email content generation.",
          { maxLength: 180 },
        ),
        length: stringSchema("Requested length.", {
          enum: ["short", "medium", "long"],
        }),
        refinement: objectSchema({
          previous_content: stringSchema(
            "Previous generated content to refine.",
            { maxLength: 20000 },
          ),
          original_content: stringSchema(
            "Original generated content to refine.",
            { maxLength: 20000 },
          ),
          instructions: stringSchema("Refinement instructions.", {
            maxLength: 2000,
          }),
          instruction: stringSchema("Refinement instruction.", {
            maxLength: 2000,
          }),
          prompt: stringSchema("Refinement prompt.", { maxLength: 2000 }),
        }),
        previous_content: stringSchema(
          "Previous generated content to refine.",
          { maxLength: 20000 },
        ),
        original_content: stringSchema(
          "Original generated content to refine.",
          { maxLength: 20000 },
        ),
        refinement_instructions: stringSchema("Refinement instructions.", {
          maxLength: 2000,
        }),
        max_chars: integerSchema("Maximum SMS characters to request.", {
          minimum: 80,
          maximum: 320,
        }),
        platform: stringSchema("Social platform for social posts.", {
          enum: CONTENT_PLATFORMS,
        }),
        social_content_type: stringSchema("Social post shape.", {
          enum: SOCIAL_CONTENT_TYPES,
        }),
        post_type: stringSchema("Legacy social/email post type.", {
          maxLength: 80,
        }),
        month: stringSchema("Month for social content, formatted YYYY-MM.", {
          pattern: "^[0-9]{4}-[0-9]{2}$",
        }),
        week_number: integerSchema(
          "Week number in the month for social content.",
          {
            minimum: 1,
            maximum: 5,
          },
        ),
        previous_blocks: arraySchema(
          "Previous email blocks for narrative continuity.",
          { description: "Previous generated block object." },
          { maxItems: 20 },
        ),
      },
      ["content_type"],
    ),
    category: "content",
    riskLevel: "safe",
    requiresConfirmation: false,
    allowedRoles: STAFF_PLUS,
    allowedModes: CONTENT_MODES,
  }),
  defineTool({
    name: "generate_image",
    description:
      "Generate an image, graphic, visual, product scene, seasonal display, social image, email header, or marketing creative. Use only when the user asks for a visual asset or image generation.",
    parameters: objectSchema(
      {
        prompt: stringSchema("Image prompt.", {
          minLength: 1,
          maxLength: 1000,
        }),
        style: stringSchema(
          "Optional image style. Defaults to photorealistic.",
          { enum: IMAGE_STYLES },
        ),
        aspect_ratio: stringSchema(
          "Optional image aspect ratio. Defaults to landscape.",
          { enum: IMAGE_ASPECT_RATIOS },
        ),
        context: jsonObjectSchema(
          "Optional campaign, product, or block context for prompt enrichment.",
        ),
        previous_image_url: stringSchema(
          "Previous generated image URL when refining an existing Bloom image.",
          {
            maxLength: 2000,
          },
        ),
        refinement_instruction: stringSchema(
          "User instruction for refining the previous generated image.",
          {
            maxLength: 1000,
          },
        ),
      },
      ["prompt"],
    ),
    category: "content",
    riskLevel: "safe",
    requiresConfirmation: false,
    allowedRoles: STAFF_PLUS,
    allowedModes: [...CONTENT_MODES, ...IMAGE_MODES],
  }),
  defineTool({
    name: "navigate_to",
    description:
      "Navigate the user to a CRM page, customer record, product detail, campaign, segment, integration, dashboard, analytics, or settings screen. Use for go to, open, show me page, take me to, or deep-link requests.",
    parameters: objectSchema(
      {
        target: stringSchema("Navigation target.", {
          enum: NAVIGATION_TARGETS,
        }),
        entity_id: stringSchema("Optional record ID for detail pages.", {
          pattern:
            "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$",
        }),
      },
      ["target"],
    ),
    category: "navigation",
    riskLevel: "safe",
    requiresConfirmation: false,
    allowedRoles: ALL_ROLES,
    allowedModes: NAVIGATION_MODES,
  }),
  defineTool({
    name: "export_data",
    description:
      "Export CRM data, download a list, produce CSV or JSON, or prepare a file for customers, products, campaigns, segments, or orders. Use only when the user asks to export or download records.",
    parameters: objectSchema(
      {
        entity: stringSchema("Entity to export.", {
          enum: EXPORT_ENTITIES,
        }),
        format: stringSchema("Export file format.", { enum: EXPORT_FORMATS }),
        filters: arraySchema("Export filters.", exportFilterSchema(), {
          maxItems: 12,
        }),
      },
      ["entity", "format"],
    ),
    category: "utility",
    riskLevel: "high",
    requiresConfirmation: true,
    allowedRoles: STAFF_PLUS,
    allowedModes: STANDARD_REASONING,
  }),
  defineTool({
    name: "compute_audience_size",
    description:
      "Estimate audience size, count matching customers, compute recipients, preview segment size, or count contacts before creating a segment or campaign. Use for counts only; use query_customers to list records.",
    parameters: objectSchema({
      segment_ids: arraySchema(
        "Segment IDs to include in the audience. Supports tenant segment UUIDs and known system segment IDs.",
        stringSchema("Segment ID."),
        { maxItems: 20 },
      ),
      segment_names: arraySchema(
        "Segment names to resolve in the current tenant or predefined system segment catalog.",
        stringSchema("Segment name.", { maxLength: 180 }),
        { maxItems: 20 },
      ),
      persona_ids: arraySchema(
        "Persona IDs to include in the audience. Supports tenant persona UUIDs and predefined persona IDs.",
        stringSchema("Persona ID."),
        { maxItems: 20 },
      ),
      persona_names: arraySchema(
        "Persona names to resolve in the current tenant or predefined persona catalog.",
        stringSchema("Persona name.", { maxLength: 180 }),
        { maxItems: 20 },
      ),
      additional_customer_ids: arraySchema(
        "Specific customer IDs to add to the resolved audience.",
        uuidSchema("Customer ID."),
        { maxItems: 250 },
      ),
      include_all_customers: booleanSchema(
        "Whether all tenant customers should be the base audience.",
      ),
      filters: arraySchema(
        "Customer filters for audience count.",
        filterSchema("customer", CUSTOMER_FILTER_FIELDS),
        {
          maxItems: 20,
        },
      ),
      include_suppressed: booleanSchema(
        "Whether suppressed customers should be included in the count.",
      ),
    }),
    category: "utility",
    riskLevel: "safe",
    requiresConfirmation: false,
    allowedRoles: ALL_ROLES,
    allowedModes: STANDARD_REASONING,
  }),
];

const INTENT_CATEGORY_MAP: Record<IntentClassification, ToolCategory[] | null> =
  {
    query: ["query", "utility"],
    mutation: ["query", "mutation", "utility"],
    analytics: ["query", "analytics", "utility"],
    content: ["content"],
    image: ["content"],
    navigation: ["navigation"],
    general: null,
  };

export function normalizeToolRole(userRole: string): ToolRole {
  const normalized = userRole.trim().toLowerCase();
  if (
    normalized === "admin" ||
    normalized === "owner" ||
    normalized === "master_admin" ||
    normalized === "super_admin"
  ) {
    return "admin";
  }

  if (
    normalized === "staff" ||
    normalized === "manager" ||
    normalized === "member"
  ) {
    return "staff";
  }

  return "viewer";
}

export function getRegisteredTool(name: string): ToolDefinition | null {
  return TOOL_REGISTRY.find((tool) => tool.function.name === name) ?? null;
}

export function isToolVisibleForRoleAndMode(
  tool: ToolDefinition,
  mode: BloomMode,
  userRole: string,
): boolean {
  const role = normalizeToolRole(userRole);
  return tool.allowed_roles.includes(role) && tool.allowed_modes.includes(mode);
}

export function filterRegisteredTools({
  mode,
  userRole,
  intent,
}: ToolDefinitionFilter): ToolDefinition[] {
  const categories = intent ? INTENT_CATEGORY_MAP[intent] : null;
  return TOOL_REGISTRY.filter((tool) => {
    if (!isToolVisibleForRoleAndMode(tool, mode, userRole)) {
      return false;
    }

    if (intent === "image") {
      return tool.function.name === "generate_image";
    }

    return categories ? categories.includes(tool.category) : true;
  });
}

export function toOpenAIToolDefinition(tool: ToolDefinition) {
  return {
    type: tool.type,
    function: tool.function,
  };
}

export function getToolDefinitions(mode: BloomMode, userRole: string) {
  return filterRegisteredTools({ mode, userRole }).map(toOpenAIToolDefinition);
}

export function getToolDefinitionsForIntent(
  mode: BloomMode,
  userRole: string,
  intent: IntentClassification | null,
) {
  return filterRegisteredTools({ mode, userRole, intent }).map(
    toOpenAIToolDefinition,
  );
}
