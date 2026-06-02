import type { Database } from "../../../../../src/integrations/supabase/types.ts";
import type { JsonObject, JsonValue } from "../../types.ts";
import type {
  ToolExecutionContext,
  ToolImplementation,
  ToolName,
  ToolResult,
} from "../types.ts";
import { getQueryClient } from "./shared.ts";

type NavigateTarget =
  | "dashboard"
  | "customers"
  | "customer_detail"
  | "products"
  | "product_detail"
  | "campaigns"
  | "campaign_detail"
  | "segments"
  | "segment_detail"
  | "integrations"
  | "analytics"
  | "settings";

type CustomerNavigationRow = Pick<
  Database["public"]["Tables"]["crm_customers"]["Row"],
  "id" | "tenant_id" | "first_name" | "last_name" | "email"
>;
type ProductNavigationRow = Pick<
  Database["public"]["Tables"]["products"]["Row"],
  "id" | "tenant_id" | "name"
>;
type CampaignNavigationRow = Pick<
  Database["public"]["Tables"]["crm_campaigns"]["Row"],
  "id" | "tenant_id" | "name"
>;
type SegmentNavigationRow = Pick<
  Database["public"]["Tables"]["crm_segments"]["Row"],
  "id" | "tenant_id" | "name"
>;

type NavigationTargetConfig = {
  defaultLabel: string;
  description: string;
  requiresEntityId: boolean;
  path: (entityId: string | null) => string | null;
};

const NAVIGATION_TARGETS: Record<NavigateTarget, NavigationTargetConfig> = {
  dashboard: {
    defaultLabel: "Dashboard",
    description: "Open the dashboard overview.",
    requiresEntityId: false,
    path: () => "/dashboard",
  },
  customers: {
    defaultLabel: "Customers",
    description: "Open the customer list.",
    requiresEntityId: false,
    path: () => "/crm/customers",
  },
  customer_detail: {
    defaultLabel: "Customer",
    description: "Open a customer profile.",
    requiresEntityId: true,
    path: (entityId) => (entityId ? `/crm/customers/${entityId}` : null),
  },
  products: {
    defaultLabel: "Products",
    description: "Open the product catalog.",
    requiresEntityId: false,
    path: () => "/products",
  },
  product_detail: {
    defaultLabel: "Product",
    description: "Open a product detail page.",
    requiresEntityId: true,
    path: (entityId) => (entityId ? `/products/${entityId}` : null),
  },
  campaigns: {
    defaultLabel: "Campaigns",
    description: "Open the campaign list.",
    requiresEntityId: false,
    path: () => "/crm/campaigns",
  },
  campaign_detail: {
    defaultLabel: "Campaign",
    description: "Open a campaign editor.",
    requiresEntityId: true,
    path: (entityId) => (entityId ? `/crm/campaigns/${entityId}` : null),
  },
  segments: {
    defaultLabel: "Segments",
    description: "Open the segment list.",
    requiresEntityId: false,
    path: () => "/crm/segments",
  },
  segment_detail: {
    defaultLabel: "Segment",
    description: "Open a segment detail page.",
    requiresEntityId: true,
    path: (entityId) => (entityId ? `/crm/segments/${entityId}` : null),
  },
  integrations: {
    defaultLabel: "Integrations",
    description: "Open the integrations hub.",
    requiresEntityId: false,
    path: () => "/integrations",
  },
  analytics: {
    defaultLabel: "Analytics",
    description: "Open the analytics dashboard.",
    requiresEntityId: false,
    path: () => "/analytics",
  },
  settings: {
    defaultLabel: "Settings",
    description: "Open account settings.",
    requiresEntityId: false,
    path: () => "/settings",
  },
};

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function createResult(args: {
  success: boolean;
  message: string;
  data?: JsonValue | null;
  count?: number | null;
  error?: string | null;
  blockType?: ToolResult["block_type"];
}): ToolResult {
  return {
    success: args.success,
    data: args.data ?? null,
    count: args.count ?? null,
    message: args.message,
    error: args.error ?? null,
    block_type: args.blockType ?? "text",
    confirmation_required: false,
    confirmation_details: null,
  };
}

function errorResult(message: string, error = "navigation_error"): ToolResult {
  return createResult({
    success: false,
    message,
    error,
    blockType: "text",
  });
}

function formatTargetLabel(target: string): string {
  return target
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function customerDisplayName(row: CustomerNavigationRow): string {
  const name = [row.first_name, row.last_name]
    .filter(
      (part): part is string =>
        typeof part === "string" && part.trim().length > 0,
    )
    .join(" ")
    .trim();

  return name || row.email;
}

async function loadEntityNavigationLabel(args: {
  target: NavigateTarget;
  entityId: string;
  context: ToolExecutionContext;
}): Promise<string | null> {
  const client = getQueryClient(args.context);

  switch (args.target) {
    case "customer_detail": {
      const { data, error } = await client
        .from("crm_customers")
        .select("id, tenant_id, first_name, last_name, email")
        .eq("tenant_id", args.context.tenantId)
        .eq("id", args.entityId)
        .is("deleted_at", null)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const row = data as CustomerNavigationRow | null;
      return row ? customerDisplayName(row) : null;
    }
    case "product_detail": {
      const { data, error } = await client
        .from("products")
        .select("id, tenant_id, name")
        .eq("tenant_id", args.context.tenantId)
        .eq("id", args.entityId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const row = data as ProductNavigationRow | null;
      return row?.name ?? null;
    }
    case "campaign_detail": {
      const { data, error } = await client
        .from("crm_campaigns")
        .select("id, tenant_id, name")
        .eq("tenant_id", args.context.tenantId)
        .eq("id", args.entityId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const row = data as CampaignNavigationRow | null;
      return row?.name ?? null;
    }
    case "segment_detail": {
      const { data, error } = await client
        .from("crm_segments")
        .select("id, tenant_id, name")
        .eq("tenant_id", args.context.tenantId)
        .eq("id", args.entityId)
        .is("deleted_at", null)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const row = data as SegmentNavigationRow | null;
      return row?.name ?? null;
    }
    default:
      return null;
  }
}

const navigateTo: ToolImplementation = async (
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> => {
  const target = readString(params.target) as NavigateTarget | null;
  const entityId = readString(params.entity_id);

  if (!target || !(target in NAVIGATION_TARGETS)) {
    return errorResult(
      `Unknown navigation target. Available targets: ${Object.keys(NAVIGATION_TARGETS).join(", ")}.`,
      "unknown_navigation_target",
    );
  }

  const config = NAVIGATION_TARGETS[target];
  if (config.requiresEntityId && !entityId) {
    return errorResult(
      `${formatTargetLabel(target)} requires an entity_id before Bloom can build a navigation link.`,
      "missing_entity_id",
    );
  }

  const path = config.path(entityId);
  if (!path) {
    return errorResult(
      `Bloom could not resolve a path for ${formatTargetLabel(target)}.`,
      "navigation_path_error",
    );
  }

  const entityLabel = entityId
    ? await loadEntityNavigationLabel({
        target,
        entityId,
        context,
      })
    : null;

  if (config.requiresEntityId && !entityLabel) {
    return errorResult(
      `${config.defaultLabel} not found for this tenant.`,
      "not_found",
    );
  }

  const label = entityLabel ?? config.defaultLabel;

  return createResult({
    success: true,
    message: `Here is a link to ${label}.`,
    data: {
      tenant_id: context.tenantId,
      target,
      path,
      label,
      description: config.description,
      entity_id: entityId,
      auto_navigate: false,
    },
    count: 1,
    blockType: "navigation",
  });
};

export function navigateToImplementation(
  toolName: ToolName,
): ToolImplementation | null {
  return toolName === "navigate_to" ? navigateTo : null;
}
