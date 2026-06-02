/**
 * Resource Form Registry
 *
 * Declarative field schemas for the interactive "create a resource" forms that
 * Bloom surfaces in the approval bar when the assistant would otherwise list
 * fields as plain text. Each schema's field `name` values match the server-side
 * tool parameter contracts in
 * `supabase/functions/bloom-assist/tools/registry.ts` so the natural-language
 * message built on submit maps cleanly back onto the create_* tools.
 */

import type { DetectedFormField } from "@/components/bloom/utils/contentGate";

export interface ResourceFormSchema {
  resourceType: string;
  toolName: string;
  title: string;
  description: string;
  /** lucide-react icon name. */
  icon: string;
  submitLabel: string;
  fields: DetectedFormField[];
}

export type TransformedFormValue = string | number | boolean | string[];
export type TransformedFormValues = Record<string, TransformedFormValue>;

/**
 * A form the assistant requested, surfaced for interactive completion in the
 * approval bar. `fields`/`prefilledValues` come from the content gate's
 * `intercept_form` detection.
 */
export interface PendingResourceForm {
  messageId: string;
  resourceType: string;
  fields: DetectedFormField[];
  prefilledValues: Record<string, string>;
}

/**
 * The serialized snapshot of an in-progress creation form persisted on the
 * owning conversation (`bloom_conversations.metadata.pending_form_state`) so it
 * survives a page reload. `values` holds the user's latest in-progress edits.
 */
export interface PersistedResourceFormState {
  messageId: string;
  resourceType: string;
  fields: DetectedFormField[];
  prefilledValues: Record<string, string>;
  values: Record<string, string>;
  savedAt: string;
}

/**
 * Narrow an untyped metadata value (from the conversation row) into a
 * `PersistedResourceFormState`. Returns null when the shape is missing or
 * malformed so a corrupt record never crashes the form restore path.
 */
export function parsePersistedFormState(
  value: unknown,
): PersistedResourceFormState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.resourceType !== "string" ||
    typeof record.messageId !== "string" ||
    !Array.isArray(record.fields) ||
    record.fields.length === 0
  ) {
    return null;
  }
  const toStringMap = (input: unknown): Record<string, string> => {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return {};
    }
    const out: Record<string, string> = {};
    for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
      if (typeof raw === "string") {
        out[key] = raw;
      }
    }
    return out;
  };
  return {
    messageId: record.messageId,
    resourceType: record.resourceType,
    fields: record.fields as DetectedFormField[],
    prefilledValues: toStringMap(record.prefilledValues),
    values: toStringMap(record.values),
    savedAt: typeof record.savedAt === "string" ? record.savedAt : "",
  };
}

const BOOLEAN_TRUE_VALUES = new Set(["true", "yes", "1", "on"]);
const BOOLEAN_FALSE_VALUES = new Set(["false", "no", "0", "off"]);

function transformBooleanValue(value: string): boolean | null {
  const normalized = value.trim().toLowerCase();
  if (BOOLEAN_TRUE_VALUES.has(normalized)) {
    return true;
  }
  if (BOOLEAN_FALSE_VALUES.has(normalized)) {
    return false;
  }
  return null;
}

function transformNumericValue(value: string): number | null {
  const numeric = Number(value.trim().replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

export function transformFormValues(
  values: Record<string, string>,
  fields: DetectedFormField[],
): TransformedFormValues {
  const transformed: TransformedFormValues = {};

  for (const field of fields) {
    const rawValue = values[field.name]?.trim() ?? "";
    if (!rawValue) {
      continue;
    }

    const transform =
      field.transform ?? (field.type === "boolean" ? "to_boolean" : undefined);
    switch (transform) {
      case "to_number": {
        const numericValue = transformNumericValue(rawValue);
        if (numericValue !== null) {
          transformed[field.name] = numericValue;
        }
        break;
      }
      case "to_integer": {
        const numericValue = transformNumericValue(rawValue);
        if (numericValue !== null && Number.isInteger(numericValue)) {
          transformed[field.name] = numericValue;
        }
        break;
      }
      case "comma_to_array": {
        const arrayValue = rawValue
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
        if (arrayValue.length > 0) {
          transformed[field.name] = arrayValue;
        }
        break;
      }
      case "to_boolean": {
        const booleanValue = transformBooleanValue(rawValue);
        if (booleanValue !== null) {
          transformed[field.name] = booleanValue;
        }
        break;
      }
      default:
        transformed[field.name] = rawValue;
        break;
    }
  }

  return transformed;
}

export const RESOURCE_FORM_SCHEMAS: Record<string, ResourceFormSchema> = {
  customer: {
    resourceType: "customer",
    toolName: "create_customer",
    title: "Create New Customer",
    description: "Add a new customer to your CRM",
    icon: "UserPlus",
    submitLabel: "Create Customer",
    fields: [
      {
        name: "email",
        label: "Email",
        type: "email",
        required: true,
        placeholder: "jessica@bloomshop.com",
      },
      {
        name: "first_name",
        label: "First Name",
        type: "text",
        required: false,
        placeholder: "Jessica",
      },
      {
        name: "last_name",
        label: "Last Name",
        type: "text",
        required: false,
        placeholder: "Taylor",
      },
      {
        name: "phone",
        label: "Phone Number",
        type: "phone",
        required: false,
        placeholder: "+1-555-000-0000",
      },
      {
        name: "city",
        label: "City",
        type: "text",
        required: false,
        placeholder: "Portland",
      },
      {
        name: "state_region",
        label: "State / Region",
        type: "text",
        required: false,
        placeholder: "Oregon",
      },
      {
        name: "postal_code",
        label: "Postal Code",
        type: "text",
        required: false,
        placeholder: "97201",
      },
      {
        name: "preferred_channel",
        label: "Preferred Communication",
        type: "select",
        required: false,
        options: ["email", "sms", "both", "none"],
      },
      {
        name: "email_opt_in",
        label: "Email Opt-in",
        type: "boolean",
        required: false,
      },
      {
        name: "sms_opt_in",
        label: "SMS Opt-in",
        type: "boolean",
        required: false,
      },
      {
        name: "is_vip",
        label: "VIP Customer",
        type: "boolean",
        required: false,
      },
      {
        name: "tags",
        label: "Tags",
        type: "text",
        required: false,
        placeholder: "Loyal Customer, Newsletter Subscriber",
        transform: "comma_to_array",
      },
    ],
  },

  product: {
    resourceType: "product",
    toolName: "create_product",
    title: "Create New Product",
    description: "Add a new product to your catalog",
    icon: "Package",
    submitLabel: "Create Product",
    fields: [
      {
        name: "name",
        label: "Product Name",
        type: "text",
        required: true,
        placeholder: "Organic Rose Bouquet",
      },
      {
        name: "description",
        label: "Description",
        type: "textarea",
        required: false,
        placeholder: "A beautiful arrangement of organic roses...",
      },
      {
        name: "price",
        label: "Price",
        type: "text",
        required: true,
        placeholder: "29.99",
        transform: "to_number",
      },
      {
        name: "sku",
        label: "SKU",
        type: "text",
        required: false,
        placeholder: "ROSE-ORG-001",
      },
      {
        name: "barcode",
        label: "Barcode",
        type: "text",
        required: false,
        placeholder: "012345678905",
      },
      {
        name: "cost_price",
        label: "Cost Price",
        type: "text",
        required: false,
        placeholder: "18.50",
        transform: "to_number",
      },
      {
        name: "compare_at_price",
        label: "Compare at Price",
        type: "text",
        required: false,
        placeholder: "39.99",
        transform: "to_number",
      },
      {
        name: "currency",
        label: "Currency",
        type: "text",
        required: false,
        placeholder: "USD",
      },
      {
        name: "category",
        label: "Category",
        type: "text",
        required: false,
        placeholder: "Bouquets",
      },
      {
        name: "subcategory",
        label: "Subcategory",
        type: "text",
        required: false,
        placeholder: "Roses",
      },
      {
        name: "inventory_count",
        label: "Initial Stock",
        type: "text",
        required: false,
        placeholder: "50",
        transform: "to_integer",
      },
      {
        name: "track_inventory",
        label: "Track Inventory",
        type: "boolean",
        required: false,
        defaultValue: "true",
      },
      {
        name: "low_stock_threshold",
        label: "Low Stock Threshold",
        type: "text",
        required: false,
        placeholder: "5",
        transform: "to_integer",
      },
      {
        name: "status",
        label: "Status",
        type: "select",
        required: false,
        options: ["active", "draft", "archived"],
        defaultValue: "active",
      },
      {
        name: "is_visible",
        label: "Visible in store",
        type: "boolean",
        required: false,
        defaultValue: "true",
      },
      {
        name: "tags",
        label: "Tags",
        type: "text",
        required: false,
        placeholder: "seasonal, bouquet, premium",
        transform: "comma_to_array",
      },
      {
        name: "source",
        label: "Source",
        type: "select",
        required: false,
        options: [
          "platform",
          "square",
          "stripe",
          "shopify",
          "lightspeed",
          "import",
        ],
        defaultValue: "platform",
      },
    ],
  },

  segment: {
    resourceType: "segment",
    toolName: "create_segment",
    title: "Create New Segment",
    description: "Define a customer segment",
    icon: "Users",
    submitLabel: "Create Segment",
    fields: [
      {
        name: "name",
        label: "Segment Name",
        type: "text",
        required: true,
        placeholder: "Top Buyers Q2",
      },
      {
        name: "kind",
        label: "Kind",
        type: "select",
        required: true,
        options: ["dynamic", "static"],
      },
      {
        name: "description",
        label: "Description",
        type: "textarea",
        required: false,
        placeholder: "Customers who spent over $500 this quarter",
      },
      {
        name: "status",
        label: "Status",
        type: "select",
        required: false,
        options: ["draft", "active", "paused", "archived"],
        defaultValue: "active",
      },
      {
        name: "include_all_customers",
        label: "Include All Customers",
        type: "boolean",
        required: false,
      },
      {
        name: "auto_update",
        label: "Auto Update",
        type: "boolean",
        required: false,
      },
    ],
  },

  campaign: {
    resourceType: "campaign",
    toolName: "create_campaign",
    title: "Create New Campaign",
    description: "Set up a marketing campaign",
    icon: "Megaphone",
    submitLabel: "Create Campaign",
    fields: [
      {
        name: "name",
        label: "Campaign Name",
        type: "text",
        required: true,
        placeholder: "Spring Sale 2026",
      },
      {
        name: "delivery_method",
        label: "Delivery Method",
        type: "select",
        required: true,
        options: ["email", "sms"],
      },
      {
        name: "subject_line",
        label: "Subject Line",
        type: "text",
        required: false,
        placeholder: "Don't miss our spring collection!",
      },
      {
        name: "preheader_text",
        label: "Preheader Text",
        type: "text",
        required: false,
        placeholder: "Fresh seasonal favorites are here",
      },
      {
        name: "content",
        label: "Content",
        type: "textarea",
        required: false,
        placeholder: "Campaign targeting repeat customers...",
      },
      {
        name: "include_all_customers",
        label: "Include All Customers",
        type: "boolean",
        required: false,
      },
      {
        name: "status",
        label: "Status",
        type: "select",
        required: false,
        options: ["draft", "scheduled"],
        defaultValue: "draft",
      },
      {
        name: "segment_id",
        label: "Segment ID",
        type: "text",
        required: false,
        placeholder: "123e4567-e89b-12d3-a456-426614174000",
      },
      {
        name: "scheduled_at",
        label: "Scheduled At",
        type: "text",
        required: false,
        placeholder: "2026-06-15T14:00:00Z",
      },
    ],
  },

  tag: {
    resourceType: "tag",
    toolName: "create_tag",
    title: "Create New Tag",
    description: "Add a customer tag",
    icon: "Tag",
    submitLabel: "Create Tag",
    fields: [
      {
        name: "name",
        label: "Tag Name",
        type: "text",
        required: true,
        placeholder: "VIP",
      },
    ],
  },
};

const capitalize = (value: string): string =>
  value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Look up the form schema for a resource type, merging in any AI-detected
 * defaults and prefilled values so the rendered form reflects what the user
 * already asked for. Unknown resource types fall back to the detected fields.
 */
export function getFormSchema(
  resourceType: string,
  detectedFields?: DetectedFormField[],
  prefilledValues?: Record<string, string>,
): ResourceFormSchema {
  const schema = RESOURCE_FORM_SCHEMAS[resourceType];

  if (!schema) {
    return {
      resourceType,
      toolName: `create_${resourceType}`,
      title: `Create ${capitalize(resourceType)}`,
      description: `Provide the details to create a new ${resourceType}`,
      icon: "Plus",
      submitLabel: "Create",
      fields: detectedFields ?? [],
    };
  }

  const mergedFields = schema.fields.map((field) => {
    const detected = detectedFields?.find(
      (candidate) =>
        candidate.name === field.name ||
        candidate.label.toLowerCase() === field.label.toLowerCase(),
    );
    const prefilled = prefilledValues?.[field.name];

    return {
      ...field,
      defaultValue: prefilled ?? detected?.defaultValue ?? field.defaultValue,
      placeholder: detected?.placeholder ?? field.placeholder,
    };
  });

  return { ...schema, fields: mergedFields };
}
