import type { Database } from "../../../../../src/integrations/supabase/types.ts";
import type { JsonObject, JsonValue } from "../../types.ts";
import type {
  ToolExecutionContext,
  ToolImplementation,
  ToolName,
  ToolResult,
} from "../types.ts";
import {
  type BloomQueryClient,
  createListResult,
  getQueryClient,
  isRecord,
  paginationRange,
  parseListQueryParams,
  sanitizePostgrestSearch,
  uniqueStrings,
} from "./shared.ts";

type TagRow = Pick<
  Database["public"]["Tables"]["crm_tags"]["Row"],
  "id" | "name" | "created_at"
>;
type TagInsert = Database["public"]["Tables"]["crm_tags"]["Insert"];
type CustomerTagInsert =
  Database["public"]["Tables"]["customer_tags"]["Insert"];
type CustomerRow = Pick<
  Database["public"]["Tables"]["crm_customers"]["Row"],
  | "id"
  | "tenant_id"
  | "first_name"
  | "last_name"
  | "email"
  | "phone"
  | "email_opt_in"
  | "sms_opt_in"
>;
type TagToolName =
  | "query_tags"
  | "create_tag"
  | "bulk_tag_customers"
  | "manage_consent";

const TAG_SELECT = "id, name, created_at";

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(readString).filter((item): item is string => Boolean(item))
    : [];
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

function errorResult(message: string, error: string): ToolResult {
  return createResult({
    success: false,
    message,
    error,
    blockType: "text",
  });
}

function mapTag(row: TagRow, customerCount: number): JsonObject {
  return {
    id: row.id,
    name: row.name,
    customer_count: customerCount,
    created_at: row.created_at,
  };
}

function customerDisplayName(customer: CustomerRow): string {
  const name = [customer.first_name, customer.last_name]
    .filter(
      (part): part is string =>
        typeof part === "string" && part.trim().length > 0,
    )
    .join(" ")
    .trim();

  return name || customer.email || customer.phone || "Customer";
}

function createCompletedDataCardResult(args: {
  toolName: TagToolName;
  message: string;
  count: number | null;
  resultData: JsonObject;
  warnings?: string[];
}): ToolResult {
  return createResult({
    success: true,
    message: args.message,
    count: args.count,
    blockType: "data_card",
    data: {
      summary: {
        completed_count: 1,
        skipped_count: 0,
        failed_count: 0,
        blocked_count: 0,
      },
      results: [
        {
          task_id: `${args.toolName}-1`,
          tool_name: args.toolName,
          status: "completed",
          message: args.message,
          result: {
            success: true,
            message: args.message,
            error: null,
            block_type: "data_card",
            count: args.count,
            data: args.resultData,
            confirmation_required: false,
            confirmation_details: null,
          },
        },
      ],
      warnings: args.warnings ?? [],
    },
  });
}

async function queryTags(
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const client = getQueryClient(context);
  const queryParams = parseListQueryParams(params, "name");
  const [from, to] = paginationRange(queryParams.page, queryParams.pageSize);

  let query = client
    .from("crm_tags")
    .select(TAG_SELECT, { count: "exact" })
    .eq("tenant_id", context.tenantId)
    .order("name", { ascending: true })
    .range(from, to);

  if (queryParams.search) {
    const search = sanitizePostgrestSearch(queryParams.search);
    if (search) {
      query = query.ilike("name", `%${search}%`);
    }
  }

  const { data, error, count } = await query;
  if (error) {
    throw error;
  }

  const tags = (data ?? []) as TagRow[];
  const tagIds = tags.map((tag) => tag.id);
  const countsByTagId = new Map<string, number>();

  if (tagIds.length > 0) {
    const { data: links, error: linksError } = await client
      .from("customer_tags")
      .select("tag_id, contact_id")
      .in("tag_id", tagIds);

    if (linksError) {
      throw linksError;
    }

    for (const link of links ?? []) {
      countsByTagId.set(link.tag_id, (countsByTagId.get(link.tag_id) ?? 0) + 1);
    }
  }

  const items = tags.map(
    (tag) => mapTag(tag, countsByTagId.get(tag.id) ?? 0) as JsonValue,
  );

  return createListResult({ entityLabel: "tag", items, count });
}

async function createTag(
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const client = getQueryClient(context);
  const name = readString(params.name);

  if (!name) {
    return errorResult("Tag name is required.", "validation_error");
  }

  const { data: existingTags, error: existingError } = await client
    .from("crm_tags")
    .select(TAG_SELECT)
    .eq("tenant_id", context.tenantId);

  if (existingError) {
    throw existingError;
  }

  const duplicate = ((existingTags ?? []) as TagRow[]).find(
    (tag) => tag.name.trim().toLowerCase() === name.toLowerCase(),
  );

  if (duplicate) {
    return createResult({
      success: false,
      message: `A tag named \"${duplicate.name}\" already exists for this tenant.`,
      error: "duplicate_tag",
      blockType: "text",
      data: {
        existing_tag: mapTag(duplicate, 0),
      },
    });
  }

  const insertPayload: TagInsert = {
    tenant_id: context.tenantId,
    name,
  };

  const { data: insertedTag, error: insertError } = await client
    .from("crm_tags")
    .insert(insertPayload)
    .select(TAG_SELECT)
    .single();

  if (insertError) {
    throw insertError;
  }

  const tag = insertedTag as TagRow;

  return createCompletedDataCardResult({
    toolName: "create_tag",
    message: `Created the \"${tag.name}\" tag.`,
    count: 1,
    resultData: {
      entity: mapTag(tag, 0),
    },
  });
}

async function bulkTagCustomers(
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const client = getQueryClient(context);
  const tagId = readString(params.tag_id);
  const action = readString(params.action);
  const customerIds = uniqueStrings(readStringArray(params.customer_ids));

  if (!tagId || (action !== "add" && action !== "remove")) {
    return errorResult(
      "Tag ID and a valid bulk tag action are required.",
      "validation_error",
    );
  }

  const { data: tagRecord, error: tagError } = await client
    .from("crm_tags")
    .select(TAG_SELECT)
    .eq("tenant_id", context.tenantId)
    .eq("id", tagId)
    .maybeSingle();

  if (tagError) {
    throw tagError;
  }

  if (!tagRecord) {
    return errorResult(
      "The requested tag was not found for this tenant.",
      "tag_not_found",
    );
  }

  const { data: customers, error: customerError } = await client
    .from("crm_customers")
    .select("id")
    .eq("tenant_id", context.tenantId)
    .in("id", customerIds);

  if (customerError) {
    throw customerError;
  }

  const scopedCustomerIds = (customers ?? []).map((customer) => customer.id);
  if (scopedCustomerIds.length !== customerIds.length) {
    const missingCount = customerIds.length - scopedCustomerIds.length;
    return errorResult(
      `${missingCount} customer ${missingCount === 1 ? "ID was" : "IDs were"} not found in this tenant.`,
      "customer_scope_error",
    );
  }

  const { data: existingLinks, error: existingLinksError } = await client
    .from("customer_tags")
    .select("contact_id")
    .eq("tag_id", tagId)
    .in("contact_id", customerIds);

  if (existingLinksError) {
    throw existingLinksError;
  }

  const existingCustomerIds = new Set(
    (existingLinks ?? []).map((row) => row.contact_id),
  );
  let affectedCustomerIds: string[] = [];
  const warnings: string[] = [];

  if (action === "add") {
    affectedCustomerIds = customerIds.filter(
      (customerId) => !existingCustomerIds.has(customerId),
    );

    if (affectedCustomerIds.length > 0) {
      const inserts: CustomerTagInsert[] = affectedCustomerIds.map(
        (customerId) => ({
          contact_id: customerId,
          tag_id: tagId,
        }),
      );

      const { error: insertError } = await client
        .from("customer_tags")
        .insert(inserts);

      if (insertError) {
        throw insertError;
      }
    }

    if (affectedCustomerIds.length !== customerIds.length) {
      warnings.push(
        `${customerIds.length - affectedCustomerIds.length} selected customer${customerIds.length - affectedCustomerIds.length === 1 ? " already had" : "s already had"} the \"${tagRecord.name}\" tag.`,
      );
    }
  } else {
    affectedCustomerIds = customerIds.filter((customerId) =>
      existingCustomerIds.has(customerId),
    );

    if (affectedCustomerIds.length > 0) {
      const { error: deleteError } = await client
        .from("customer_tags")
        .delete()
        .eq("tag_id", tagId)
        .in("contact_id", affectedCustomerIds);

      if (deleteError) {
        throw deleteError;
      }
    }

    if (affectedCustomerIds.length !== customerIds.length) {
      warnings.push(
        `${customerIds.length - affectedCustomerIds.length} selected customer${customerIds.length - affectedCustomerIds.length === 1 ? " did" : "s did"} not currently have the \"${tagRecord.name}\" tag.`,
      );
    }
  }

  const affectedCount = affectedCustomerIds.length;
  const message =
    action === "add"
      ? affectedCount > 0
        ? `Added the \"${tagRecord.name}\" tag to ${affectedCount} customer${affectedCount === 1 ? "" : "s"}.`
        : `All selected customers already had the \"${tagRecord.name}\" tag.`
      : affectedCount > 0
        ? `Removed the \"${tagRecord.name}\" tag from ${affectedCount} customer${affectedCount === 1 ? "" : "s"}.`
        : `None of the selected customers currently had the \"${tagRecord.name}\" tag.`;

  return createCompletedDataCardResult({
    toolName: "bulk_tag_customers",
    message,
    count: affectedCount,
    warnings,
    resultData: {
      tag: mapTag(tagRecord as TagRow, 0),
      action,
      selected_customer_count: customerIds.length,
      affected_customer_count: affectedCount,
      affected_customer_ids: affectedCustomerIds,
    },
  });
}

/**
 * Consent sources the atomic consent writer accepts. Bloom never invents a
 * source of its own: the staff member says how the change was requested.
 */
const CONSENT_SOURCES = new Set([
  "in_store",
  "web_form",
  "written_request",
  "phone_request",
  "customer_service",
  "admin_correction",
]);
const DEFAULT_OPT_OUT_SOURCE = "admin_correction";
const MIN_EVIDENCE_LENGTH = 10;
const BLOOM_EVIDENCE_PREFIX = "Recorded via Bloom Assist";

type ConsentRpcResult = {
  statusChanged: boolean | null;
  cancelledQueuedMessages: number;
  recordedAt: string | null;
};

function readConsentRpcResult(value: unknown): ConsentRpcResult {
  if (!isRecord(value)) {
    return { statusChanged: null, cancelledQueuedMessages: 0, recordedAt: null };
  }
  return {
    statusChanged:
      typeof value.statusChanged === "boolean" ? value.statusChanged : null,
    cancelledQueuedMessages:
      typeof value.cancelledQueuedMessages === "number"
        ? value.cancelledQueuedMessages
        : 0,
    recordedAt: typeof value.recordedAt === "string" ? value.recordedAt : null,
  };
}

/**
 * Changes one channel's consent through set_customer_marketing_consent_authorized,
 * the same guarded, atomic writer the customer consent card uses. It runs as
 * the signed-in user (role and store-location checks, actor recorded) and
 * writes only the chosen channel: an SMS change never touches the email
 * unsubscribe state (opt_out, email_opt_in, email_opt_out_at).
 */
async function manageConsent(
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const customerId = readString(params.customer_id);
  const channel = readString(params.channel);
  const action = readString(params.action);

  if (!customerId || (channel !== "email" && channel !== "sms")) {
    return errorResult(
      "Customer ID and a valid consent channel are required.",
      "validation_error",
    );
  }

  if (action !== "opt_in" && action !== "opt_out") {
    return errorResult(
      "Consent action must be opt_in or opt_out.",
      "validation_error",
    );
  }

  const optIn = action === "opt_in";
  const source =
    readString(params.source)?.toLowerCase() ??
    (optIn ? null : DEFAULT_OPT_OUT_SOURCE);
  if (!source || !CONSENT_SOURCES.has(source)) {
    return errorResult(
      "Say how this consent change was requested: in store, web form, written request, phone request, customer service, or an admin correction.",
      "validation_error",
    );
  }

  const consentBasis = readString(params.consent_basis)?.toLowerCase() ?? null;
  const evidence = readString(params.evidence);
  if (
    optIn &&
    ((consentBasis !== "express" && consentBasis !== "implied") ||
      (evidence?.length ?? 0) < MIN_EVIDENCE_LENGTH)
  ) {
    return errorResult(
      "Opting a customer in needs the consent basis (express or implied) and a short note of how the customer gave consent.",
      "validation_error",
    );
  }

  // The consent writer authorizes the signed-in user, so it must run on the
  // user's own client. The service client has no user and is never used here.
  if (!context.dataClient) {
    return errorResult(
      "Bloom could not confirm your access to change customer consent.",
      "forbidden",
    );
  }
  const client = context.dataClient as unknown as BloomQueryClient;

  const { data: customerRecord, error: customerError } = await client
    .from("crm_customers")
    .select(
      "id, tenant_id, first_name, last_name, email, phone, email_opt_in, sms_opt_in",
    )
    .eq("tenant_id", context.tenantId)
    .eq("id", customerId)
    .is("deleted_at", null)
    .maybeSingle();

  if (customerError) {
    throw customerError;
  }

  if (!customerRecord) {
    return errorResult(
      "The requested customer was not found for this tenant.",
      "customer_not_found",
    );
  }

  const customer = customerRecord as CustomerRow;
  const email = readString(customer.email);
  const phone = readString(customer.phone);

  if (channel === "email" && !email) {
    return errorResult(
      "This customer does not have an email address, so email consent cannot be updated.",
      "missing_email",
    );
  }

  if (channel === "sms" && !phone) {
    return errorResult(
      "This customer does not have a phone number, so SMS consent cannot be updated.",
      "missing_phone",
    );
  }

  const { data: rpcData, error: rpcError } = await client.rpc(
    "set_customer_marketing_consent_authorized",
    {
      p_customer_id: customer.id,
      p_channel: channel,
      p_opt_in: optIn,
      p_source: source,
      p_consent_basis: optIn ? consentBasis : null,
      p_evidence: evidence
        ? `${BLOOM_EVIDENCE_PREFIX}: ${evidence}`
        : BLOOM_EVIDENCE_PREFIX,
      p_ip_address: null,
      p_user_agent: null,
    },
  );

  if (rpcError) {
    return errorResult(
      `Consent was not changed: ${rpcError.message}`,
      rpcError.code === "42501" ? "forbidden" : "consent_not_changed",
    );
  }

  const outcome = readConsentRpcResult(rpcData);
  const channelLabel = channel === "sms" ? "SMS" : "email";
  const cancelledNote =
    outcome.cancelledQueuedMessages > 0
      ? ` ${outcome.cancelledQueuedMessages} queued message${outcome.cancelledQueuedMessages === 1 ? " was" : "s were"} cancelled.`
      : "";

  return createCompletedDataCardResult({
    toolName: "manage_consent",
    message: `Recorded ${action.replace("_", " ")} for ${customerDisplayName(customer)} on the ${channelLabel} channel.${cancelledNote}`,
    count: 1,
    resultData: {
      customer: {
        id: customer.id,
        name: customerDisplayName(customer),
        ...(channel === "sms" ? { phone } : { email }),
        email_opt_in: channel === "email" ? optIn : customer.email_opt_in,
        sms_opt_in: channel === "sms" ? optIn : customer.sms_opt_in,
      },
      channel,
      action,
      source,
      consent_basis: optIn ? consentBasis : "revoked",
      status_changed: outcome.statusChanged,
      cancelled_queued_messages: outcome.cancelledQueuedMessages,
      recorded_at: outcome.recordedAt,
    },
  });
}

export function tagConsentImplementation(
  toolName: ToolName,
): ToolImplementation | null {
  switch (toolName) {
    case "query_tags":
      return queryTags;
    case "create_tag":
      return createTag;
    case "bulk_tag_customers":
      return bulkTagCustomers;
    case "manage_consent":
      return manageConsent;
    default:
      return null;
  }
}
