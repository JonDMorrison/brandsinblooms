import {
  customerDisplayName,
  formatCurrency,
  getValue,
  isRecord,
  normalizeToolResult,
  readString,
} from "@/components/bloom/content/cards/cardUtils";
import type { BloomStreamingBlock } from "@/hooks/bloom/useBloomStreaming";
import type {
  BloomTaskJsonObject,
  BloomTaskRiskLevel,
} from "@/hooks/bloom/taskPlanTypes";

export interface ResolvedCustomer {
  id: string;
  name: string;
  email?: string;
  totalSpent?: string;
}

export interface ResolvedSegment {
  id: string;
  name: string;
  type?: string;
  customerCount?: number;
}

export interface ResolvedProduct {
  id: string;
  name: string;
  price?: string;
  sku?: string;
}

export interface ResolvedCampaign {
  id: string;
  name: string;
  status?: string;
}

interface ResolvedTag {
  id: string;
  name: string;
  customerCount?: number;
}

export interface ResolvedApproval {
  title: string;
  description: string;
  customers?: ResolvedCustomer[];
  segments?: ResolvedSegment[];
  products?: ResolvedProduct[];
  campaigns?: ResolvedCampaign[];
  tags?: { name: string }[];
  riskLevel: BloomTaskRiskLevel;
  riskMessage?: string;
  isReversible: boolean;
  buttonLabel: string;
}

interface EntityLookup {
  customers: Map<string, ResolvedCustomer>;
  segments: Map<string, ResolvedSegment>;
  products: Map<string, ResolvedProduct>;
  campaigns: Map<string, ResolvedCampaign>;
  tags: Map<string, ResolvedTag>;
}

const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  count === 1 ? singular : plural;

const readParamString = (value: unknown): string | null => readString(value);

// Tool params can carry IDs either as a real array or as a JSON-encoded string
// (depending on how the model emitted the call). Normalize both to string IDs.
const parseIds = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => readString(entry))
      .filter((entry): entry is string => Boolean(entry));
  }

  const text = readString(value);
  if (!text) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed
        .map((entry) => readString(entry))
        .filter((entry): entry is string => Boolean(entry));
    }
  } catch {
    // Not JSON — treat the raw string as a single ID.
  }

  return [text];
};

const recordsFromBlock = (
  block: BloomStreamingBlock,
): Record<string, unknown>[] => {
  const normalized = normalizeToolResult({
    toolName: block.toolName,
    blockType: block.blockType,
    data: block.payload,
  });

  if (Array.isArray(normalized.data)) {
    return normalized.data.filter(isRecord);
  }

  return isRecord(normalized.data) ? [normalized.data] : [];
};

const indexTagCandidate = (
  lookup: EntityLookup,
  record: Record<string, unknown>,
  usePlainIdAndName: boolean,
) => {
  const explicitTagId = readString(getValue(record, ["tag_id", "tag.id"]));
  const explicitTagName = readString(
    getValue(record, ["tag_name", "tag.name"]),
  );
  const id =
    explicitTagId ??
    (usePlainIdAndName || explicitTagName ? readString(record.id) : null);
  const name =
    explicitTagName ??
    (usePlainIdAndName || explicitTagId ? readString(record.name) : null);

  if (!id || !name) {
    return;
  }

  const customerCount = getValue(record, ["customer_count"]);
  lookup.tags.set(id, {
    id,
    name,
    customerCount:
      typeof customerCount === "number" ? customerCount : undefined,
  });
};

const indexTagsFromRecord = (
  lookup: EntityLookup,
  record: Record<string, unknown>,
  toolName: string,
) => {
  const isTagRelatedTool = toolName.includes("tag");
  indexTagCandidate(lookup, record, isTagRelatedTool);

  for (const key of ["tag", "crm_tags"] as const) {
    const nested = record[key];
    if (isRecord(nested)) {
      indexTagCandidate(lookup, nested, true);
    }
  }

  const entity = record.entity;
  if (isTagRelatedTool && isRecord(entity)) {
    indexTagCandidate(lookup, entity, true);
  }

  if (Array.isArray(record.tags)) {
    for (const tag of record.tags) {
      if (isRecord(tag)) {
        indexTagCandidate(lookup, tag, true);
      }
    }
  }

  if (!Array.isArray(record.results)) {
    return;
  }

  for (const result of record.results) {
    if (!isRecord(result)) {
      continue;
    }

    const nestedResult = isRecord(result.result) ? result.result : null;
    const data =
      nestedResult && isRecord(nestedResult.data) ? nestedResult.data : null;
    if (data) {
      indexTagsFromRecord(lookup, data, toolName);
    }
  }
};

const buildLookup = (blocks: BloomStreamingBlock[]): EntityLookup => {
  const lookup: EntityLookup = {
    customers: new Map(),
    segments: new Map(),
    products: new Map(),
    campaigns: new Map(),
    tags: new Map(),
  };

  for (const block of blocks) {
    const toolName = (block.toolName ?? "").toLowerCase();
    const records = recordsFromBlock(block);

    for (const record of records) {
      const id = readString(record.id);
      indexTagsFromRecord(lookup, record, toolName);

      if (!id) {
        continue;
      }

      const hasEmail = Boolean(readString(record.email));
      if (toolName.includes("customer") || hasEmail) {
        const totalSpent =
          readString(record.total_spent) ??
          formatCurrency(getValue(record, ["lifetime_value"])) ??
          undefined;
        lookup.customers.set(id, {
          id,
          name: customerDisplayName(record),
          email: readString(record.email) ?? undefined,
          totalSpent: totalSpent ?? undefined,
        });
      }

      const hasSegmentShape =
        record.customer_count !== undefined ||
        record.segment_type !== undefined;
      if (toolName.includes("segment") || hasSegmentShape) {
        const customerCount = getValue(record, ["customer_count"]);
        lookup.segments.set(id, {
          id,
          name: readString(record.name) ?? "Unknown",
          type:
            readString(record.type) ??
            readString(record.segment_type) ??
            undefined,
          customerCount:
            typeof customerCount === "number" ? customerCount : undefined,
        });
      }

      if (toolName.includes("product") || readString(record.sku)) {
        lookup.products.set(id, {
          id,
          name: readString(getValue(record, ["name", "title"])) ?? "Unknown",
          price: formatCurrency(getValue(record, ["price"])) ?? undefined,
          sku: readString(record.sku) ?? undefined,
        });
      }

      if (toolName.includes("campaign")) {
        lookup.campaigns.set(id, {
          id,
          name: readString(getValue(record, ["name", "title"])) ?? "Unknown",
          status: readString(record.status) ?? undefined,
        });
      }
    }
  }

  return lookup;
};

const resolveCustomers = (
  ids: string[],
  lookup: EntityLookup,
): ResolvedCustomer[] =>
  ids.map(
    (id) =>
      lookup.customers.get(id) ?? {
        id,
        name: "Unknown",
      },
  );

const titleCase = (value: string): string =>
  value.replace(/\b\w/g, (character) => character.toUpperCase());

export function resolveApproval(
  task: { toolName: string; params: BloomTaskJsonObject },
  blocks: BloomStreamingBlock[],
): ResolvedApproval {
  const lookup = buildLookup(blocks);
  const p = task.params;

  switch (task.toolName) {
    case "assign_segment": {
      const custIds = parseIds(p.customer_ids);
      const seg = lookup.segments.get(readParamString(p.segment_id) ?? "");
      const customers = resolveCustomers(custIds, lookup);
      const action = readParamString(p.action) ?? "add";
      const isRemove = action === "remove";
      const verb = isRemove ? "Remove" : "Add";
      const prep = isRemove ? "from" : "to";
      return {
        title: `${verb} ${customers.length} ${pluralize(customers.length, "customer")} ${prep} "${seg?.name ?? "segment"}"`,
        description: `These customers will be ${isRemove ? "removed from" : "added to"} the segment.`,
        customers,
        segments: seg ? [seg] : undefined,
        riskLevel: "medium",
        riskMessage: isRemove
          ? "Customers will be removed from this segment and may lose access to segment-targeted campaigns"
          : "Customers will be added to this segment and may receive segment-targeted campaigns",
        isReversible: true,
        buttonLabel: `${verb} ${customers.length} ${pluralize(customers.length, "Customer")}`,
      };
    }

    case "bulk_tag_customers": {
      const custIds = parseIds(p.customer_ids);
      const customers = resolveCustomers(custIds, lookup);
      const tagId = readParamString(p.tag_id) ?? "";
      const tag = lookup.tags.get(tagId);
      const tagName = tag?.name ?? "the selected tag";
      const action = readParamString(p.action) ?? "add";
      const isRemove = action === "remove";
      return {
        title: isRemove
          ? `Remove "${tagName}" from ${customers.length} ${pluralize(customers.length, "customer")}`
          : `Tag ${customers.length} ${pluralize(customers.length, "customer")} with "${tagName}"`,
        description: `The tag "${tagName}" will be ${isRemove ? "removed from" : "applied to"} these customers.`,
        customers,
        tags: [{ name: tagName }],
        riskLevel: "medium",
        isReversible: false,
        buttonLabel: `${isRemove ? "Remove" : "Apply"} Tag`,
      };
    }

    case "delete_customer": {
      const cust = lookup.customers.get(
        readParamString(p.customer_id) ?? readParamString(p.id) ?? "",
      );
      return {
        title: `Delete customer "${cust?.name ?? "Unknown"}"`,
        description:
          "This customer will be soft-deleted. They will no longer appear in searches but their data is preserved.",
        customers: cust ? [cust] : undefined,
        riskLevel: "high",
        riskMessage:
          "This customer will be marked as deleted and hidden from the system",
        isReversible: false,
        buttonLabel: "Delete Customer",
      };
    }

    case "send_campaign": {
      const camp = lookup.campaigns.get(
        readParamString(p.campaign_id) ?? readParamString(p.id) ?? "",
      );
      return {
        title: `Send campaign "${camp?.name ?? "Unknown"}"`,
        description: "Emails will be sent immediately to all recipients.",
        campaigns: camp ? [camp] : undefined,
        riskLevel: "high",
        riskMessage: "Emails cannot be recalled after sending",
        isReversible: false,
        buttonLabel: "Send Campaign",
      };
    }

    case "create_segment": {
      const name = readParamString(p.name) ?? "New Segment";
      const type =
        readParamString(p.kind) ?? readParamString(p.type) ?? "static";
      return {
        title: `Create segment "${name}"`,
        description: `A ${type} segment will be created.`,
        riskLevel: "low",
        isReversible: true,
        buttonLabel: "Create Segment",
      };
    }

    case "create_customer": {
      const name = [readParamString(p.first_name), readParamString(p.last_name)]
        .filter((part): part is string => Boolean(part))
        .join(" ")
        .trim();
      return {
        title: `Create customer${name ? ` "${name}"` : ""}`,
        description: "A new customer record will be added to your CRM.",
        riskLevel: "low",
        isReversible: true,
        buttonLabel: "Create Customer",
      };
    }

    case "update_customer": {
      const cust = lookup.customers.get(
        readParamString(p.customer_id) ?? readParamString(p.id) ?? "",
      );
      return {
        title: `Update customer "${cust?.name ?? "Unknown"}"`,
        description: "The customer record will be modified.",
        customers: cust ? [cust] : undefined,
        riskLevel: "medium",
        isReversible: true,
        buttonLabel: "Update Customer",
      };
    }

    case "create_product":
    case "update_product":
    case "toggle_product_status": {
      const prod = lookup.products.get(
        readParamString(p.product_id) ?? readParamString(p.id) ?? "",
      );
      const action =
        task.toolName === "create_product"
          ? "Create"
          : task.toolName === "toggle_product_status"
            ? "Update status of"
            : "Update";
      const name = prod?.name ?? readParamString(p.name) ?? "Unknown";
      return {
        title: `${action} product "${name}"`,
        description:
          task.toolName === "create_product"
            ? "A new product will be added to the catalog."
            : task.toolName === "toggle_product_status"
              ? "The product status will be changed."
              : "The product details will be updated.",
        products: prod ? [prod] : undefined,
        riskLevel: task.toolName === "create_product" ? "low" : "medium",
        isReversible: true,
        buttonLabel:
          task.toolName === "toggle_product_status"
            ? "Update Product Status"
            : `${action} Product`,
      };
    }

    case "create_campaign":
    case "update_campaign":
    case "clone_campaign":
    case "schedule_campaign":
    case "pause_resume_campaign": {
      const camp = lookup.campaigns.get(
        readParamString(p.campaign_id) ?? readParamString(p.id) ?? "",
      );
      const pauseAction =
        readParamString(p.action) === "resume" ? "Resume" : "Pause";
      const actionMap: Record<string, string> = {
        create_campaign: "Create",
        update_campaign: "Update",
        clone_campaign: "Clone",
        schedule_campaign: "Schedule",
        pause_resume_campaign: pauseAction,
      };
      const descriptionMap: Record<string, string> = {
        create_campaign: "A new campaign draft will be created.",
        update_campaign: "The campaign details will be updated.",
        clone_campaign:
          "A new campaign draft will be created from this campaign.",
        schedule_campaign: "The campaign will be scheduled for later delivery.",
        pause_resume_campaign:
          pauseAction === "Resume"
            ? "The campaign send queue will resume."
            : "The campaign send queue will be paused.",
      };
      const riskMap: Record<string, BloomTaskRiskLevel> = {
        create_campaign: "low",
        update_campaign: "medium",
        clone_campaign: "low",
        schedule_campaign: "medium",
        pause_resume_campaign: "medium",
      };
      const action =
        actionMap[task.toolName] ??
        titleCase(task.toolName.replace("_campaign", "").replace(/_/g, " "));
      const name =
        camp?.name ??
        readParamString(p.new_name) ??
        readParamString(p.name) ??
        "Unknown";
      return {
        title: `${action} campaign "${name}"`,
        description:
          descriptionMap[task.toolName] ?? "The campaign will be updated.",
        campaigns: camp ? [camp] : undefined,
        riskLevel: riskMap[task.toolName] ?? "medium",
        isReversible: true,
        buttonLabel: `${action} Campaign`,
      };
    }

    case "update_segment": {
      const seg = lookup.segments.get(
        readParamString(p.segment_id) ?? readParamString(p.id) ?? "",
      );
      const changes = isRecord(p.changes) ? p.changes : null;
      const name =
        seg?.name ??
        readParamString(changes?.name) ??
        readParamString(p.name) ??
        "Unknown";
      return {
        title: `Update segment "${name}"`,
        description: "The segment definition will be updated.",
        segments: seg ? [seg] : undefined,
        riskLevel: "medium",
        isReversible: true,
        buttonLabel: "Update Segment",
      };
    }

    case "manage_consent": {
      const cust = lookup.customers.get(readParamString(p.customer_id) ?? "");
      const channel = readParamString(p.channel) ?? "email";
      const action = readParamString(p.action) ?? "opt_out";
      const isOptIn = action === "opt_in";
      return {
        title: `${isOptIn ? "Opt in" : "Opt out"} "${cust?.name ?? "Unknown"}" ${isOptIn ? "to" : "from"} ${channel.toUpperCase()}`,
        description: `${channel.toUpperCase()} communication preference will be updated.`,
        customers: cust ? [cust] : undefined,
        riskLevel: "medium",
        riskMessage: isOptIn
          ? undefined
          : "Customer will no longer receive marketing via this channel",
        isReversible: false,
        buttonLabel: isOptIn ? "Opt In" : "Opt Out",
      };
    }

    case "export_data": {
      const entity =
        readParamString(p.entity) ?? readParamString(p.entity_type) ?? "data";
      const format = readParamString(p.format) ?? "csv";
      const entityLabel = entity === "data" ? "data" : `${entity} data`;
      return {
        title: `Export ${entityLabel} as ${format.toUpperCase()}`,
        description: `A downloadable ${format.toUpperCase()} file will be generated with your ${entityLabel}.`,
        riskLevel: "high",
        riskMessage: "Export may contain sensitive customer data",
        isReversible: true,
        buttonLabel: `Export ${titleCase(entity)}`,
      };
    }

    case "create_tag": {
      const name = readParamString(p.name) ?? "tag";
      return {
        title: `Create tag "${name}"`,
        description: "A reusable CRM tag will be created.",
        riskLevel: "low",
        isReversible: true,
        buttonLabel: "Create Tag",
      };
    }

    default: {
      const humanName = titleCase(task.toolName.replace(/_/g, " "));
      return {
        title: humanName,
        description: `Bloom wants to ${task.toolName.replace(/_/g, " ")}.`,
        riskLevel: "medium",
        isReversible: true,
        buttonLabel: "Approve",
      };
    }
  }
}
