import type { Database } from "../../../../../src/integrations/supabase/types.ts";
import type { JsonObject, JsonValue } from "../../types.ts";
import type {
  ToolExecutionContext,
  ToolImplementation,
  ToolName,
  ToolResult,
} from "../types.ts";
import { getQueryClient, isRecord, uniqueStrings } from "./shared.ts";

type CustomerInsert = Database["public"]["Tables"]["crm_customers"]["Insert"];
type CustomerUpdate = Database["public"]["Tables"]["crm_customers"]["Update"];
type CustomerRow = Pick<
  Database["public"]["Tables"]["crm_customers"]["Row"],
  | "id"
  | "tenant_id"
  | "first_name"
  | "last_name"
  | "email"
  | "phone"
  | "city"
  | "state_region"
  | "postal_code"
  | "preferred_channel"
  | "email_opt_in"
  | "sms_opt_in"
  | "is_vip"
  | "tags"
  | "created_at"
  | "updated_at"
  | "deleted_at"
>;
type TagRow = Pick<
  Database["public"]["Tables"]["crm_tags"]["Row"],
  "id" | "name"
>;
type TagInsert = Database["public"]["Tables"]["crm_tags"]["Insert"];
type CustomerTagInsert =
  Database["public"]["Tables"]["customer_tags"]["Insert"];
type CustomerMutationToolName =
  | "create_customer"
  | "update_customer"
  | "delete_customer";

const CUSTOMER_CARD_SELECT =
  "id, tenant_id, first_name, last_name, email, phone, city, state_region, postal_code, preferred_channel, email_opt_in, sms_opt_in, is_vip, tags, created_at, updated_at, deleted_at";

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readNullableString(value: unknown): string | null {
  return readString(value);
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(readString).filter((item): item is string => Boolean(item))
    : [];
}

function normalizeEmail(value: unknown): string | null {
  const email = readString(value);
  return email ? email.toLowerCase() : null;
}

function hasOwnProperty(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
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

function errorResult(
  message: string,
  error: string,
  data?: JsonValue | null,
): ToolResult {
  return createResult({
    success: false,
    message,
    error,
    data,
    blockType: "text",
  });
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

function calculatePreferredChannel(
  emailOptIn: boolean,
  smsOptIn: boolean,
): "email" | "sms" | "both" | "none" {
  if (emailOptIn && smsOptIn) {
    return "both";
  }
  if (emailOptIn) {
    return "email";
  }
  if (smsOptIn) {
    return "sms";
  }
  return "none";
}

function resolvePreferredChannel(
  explicitValue: string | null,
  emailOptIn: boolean,
  smsOptIn: boolean,
): string {
  return explicitValue ?? calculatePreferredChannel(emailOptIn, smsOptIn);
}

function mapCustomerCard(row: CustomerRow, tenantId: string): JsonObject {
  return {
    id: row.id,
    tenant_id: row.tenant_id ?? tenantId,
    first_name: row.first_name,
    last_name: row.last_name,
    full_name: customerDisplayName(row),
    email: row.email,
    phone: row.phone,
    city: row.city,
    state_region: row.state_region,
    postal_code: row.postal_code,
    preferred_channel: row.preferred_channel,
    email_opt_in: row.email_opt_in,
    sms_opt_in: row.sms_opt_in,
    is_vip: row.is_vip,
    tags: row.tags ?? [],
    tag_names: row.tags ?? [],
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
    status: row.deleted_at ? "deleted" : "active",
  };
}

async function loadCustomerById(args: {
  customerId: string;
  tenantId: string;
  includeDeleted: boolean;
  context: ToolExecutionContext;
}): Promise<CustomerRow | null> {
  const client = getQueryClient(args.context);
  let query = client
    .from("crm_customers")
    .select(CUSTOMER_CARD_SELECT)
    .eq("tenant_id", args.tenantId)
    .eq("id", args.customerId);

  if (!args.includeDeleted) {
    query = query.is("deleted_at", null);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw error;
  }

  return (data as CustomerRow | null) ?? null;
}

async function findCustomerByEmail(args: {
  email: string;
  tenantId: string;
  context: ToolExecutionContext;
}): Promise<CustomerRow | null> {
  const client = getQueryClient(args.context);
  const { data, error } = await client
    .from("crm_customers")
    .select(CUSTOMER_CARD_SELECT)
    .eq("tenant_id", args.tenantId)
    .ilike("email", args.email)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as CustomerRow | null) ?? null;
}

async function ensureTenantTags(args: {
  tagNames: string[];
  tenantId: string;
  context: ToolExecutionContext;
}): Promise<TagRow[]> {
  if (args.tagNames.length === 0) {
    return [];
  }

  const client = getQueryClient(args.context);
  const { data: existingData, error: existingError } = await client
    .from("crm_tags")
    .select("id, name")
    .eq("tenant_id", args.tenantId);

  if (existingError) {
    throw existingError;
  }

  const tagsByLowerName = new Map<string, TagRow>(
    ((existingData ?? []) as TagRow[]).map((tag) => [
      tag.name.trim().toLowerCase(),
      tag,
    ]),
  );

  const missingNames = args.tagNames.filter(
    (name) => !tagsByLowerName.has(name.toLowerCase()),
  );

  if (missingNames.length > 0) {
    const inserts: TagInsert[] = missingNames.map((name) => ({
      tenant_id: args.tenantId,
      name,
    }));

    const { data: insertedData, error: insertError } = await client
      .from("crm_tags")
      .insert(inserts)
      .select("id, name");

    if (insertError) {
      throw insertError;
    }

    for (const tag of (insertedData ?? []) as TagRow[]) {
      tagsByLowerName.set(tag.name.trim().toLowerCase(), tag);
    }
  }

  return args.tagNames
    .map((name) => tagsByLowerName.get(name.toLowerCase()) ?? null)
    .filter((tag): tag is TagRow => Boolean(tag));
}

async function syncCustomerTags(args: {
  customerId: string;
  tenantId: string;
  tagNames: string[];
  context: ToolExecutionContext;
}): Promise<void> {
  const client = getQueryClient(args.context);
  const ensuredTags = await ensureTenantTags({
    tagNames: args.tagNames,
    tenantId: args.tenantId,
    context: args.context,
  });

  const { error: deleteError } = await client
    .from("customer_tags")
    .delete()
    .eq("contact_id", args.customerId);

  if (deleteError) {
    throw deleteError;
  }

  if (ensuredTags.length === 0) {
    return;
  }

  const inserts: CustomerTagInsert[] = ensuredTags.map((tag) => ({
    contact_id: args.customerId,
    tag_id: tag.id,
  }));

  const { error: insertError } = await client
    .from("customer_tags")
    .insert(inserts);

  if (insertError) {
    throw insertError;
  }
}

function buildCreatePayload(
  params: JsonObject,
  context: ToolExecutionContext,
): { payload: CustomerInsert; tagNames: string[] } | null {
  const email = normalizeEmail(params.email);
  if (!email) {
    return null;
  }

  const now = new Date().toISOString();
  const emailOptIn = params.email_opt_in === true;
  const smsOptIn = params.sms_opt_in === true;
  const tagNames = uniqueStrings(readStringArray(params.tags));
  const payload: CustomerInsert = {
    tenant_id: context.tenantId,
    user_id: context.userId,
    email,
    first_name: readNullableString(params.first_name),
    last_name: readNullableString(params.last_name),
    phone: readNullableString(params.phone),
    city: readNullableString(params.city),
    state_region: readNullableString(params.state_region),
    postal_code: readNullableString(params.postal_code),
    preferred_channel: resolvePreferredChannel(
      readString(params.preferred_channel),
      emailOptIn,
      smsOptIn,
    ),
    email_opt_in: emailOptIn,
    sms_opt_in: smsOptIn,
    is_vip: params.is_vip === true,
    tags: tagNames.length > 0 ? tagNames : null,
    email_opt_in_at: emailOptIn ? now : null,
    sms_opt_in_at: smsOptIn ? now : null,
    updated_at: now,
  };

  return { payload, tagNames };
}

function buildUpdatePayload(
  changes: JsonObject,
  existingCustomer: CustomerRow,
): {
  payload: CustomerUpdate;
  normalizedEmail: string | null;
  tagNames: string[] | null;
} {
  const payload: CustomerUpdate = {
    updated_at: new Date().toISOString(),
  };
  let normalizedEmail: string | null = null;
  let tagNames: string[] | null = null;

  if (hasOwnProperty(changes, "first_name")) {
    payload.first_name = readNullableString(changes.first_name);
  }

  if (hasOwnProperty(changes, "last_name")) {
    payload.last_name = readNullableString(changes.last_name);
  }

  if (hasOwnProperty(changes, "email")) {
    normalizedEmail = normalizeEmail(changes.email);
    payload.email = normalizedEmail ?? "";
  }

  if (hasOwnProperty(changes, "phone")) {
    payload.phone = readNullableString(changes.phone);
  }

  if (hasOwnProperty(changes, "city")) {
    payload.city = readNullableString(changes.city);
  }

  if (hasOwnProperty(changes, "state_region")) {
    payload.state_region = readNullableString(changes.state_region);
  }

  if (hasOwnProperty(changes, "postal_code")) {
    payload.postal_code = readNullableString(changes.postal_code);
  }

  if (hasOwnProperty(changes, "email_opt_in")) {
    payload.email_opt_in = changes.email_opt_in === true;
  }

  if (hasOwnProperty(changes, "sms_opt_in")) {
    payload.sms_opt_in = changes.sms_opt_in === true;
  }

  if (hasOwnProperty(changes, "is_vip")) {
    payload.is_vip = changes.is_vip === true;
  }

  if (hasOwnProperty(changes, "tags")) {
    tagNames = uniqueStrings(readStringArray(changes.tags));
    payload.tags = tagNames.length > 0 ? tagNames : null;
  }

  if (
    hasOwnProperty(changes, "preferred_channel") ||
    hasOwnProperty(changes, "email_opt_in") ||
    hasOwnProperty(changes, "sms_opt_in")
  ) {
    const explicitPreferredChannel = hasOwnProperty(
      changes,
      "preferred_channel",
    )
      ? readString(changes.preferred_channel)
      : null;
    const emailOptIn = hasOwnProperty(changes, "email_opt_in")
      ? payload.email_opt_in === true
      : existingCustomer.email_opt_in === true;
    const smsOptIn = hasOwnProperty(changes, "sms_opt_in")
      ? payload.sms_opt_in === true
      : existingCustomer.sms_opt_in === true;

    payload.preferred_channel = resolvePreferredChannel(
      explicitPreferredChannel,
      emailOptIn,
      smsOptIn,
    );
  }

  return { payload, normalizedEmail, tagNames };
}

async function createCustomer(
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const client = getQueryClient(context);
  const built = buildCreatePayload(params, context);

  if (!built) {
    return errorResult("Customer email is required.", "validation_error");
  }

  const existingCustomer = await findCustomerByEmail({
    email: built.payload.email,
    tenantId: context.tenantId,
    context,
  });

  if (existingCustomer) {
    const duplicateMessage = existingCustomer.deleted_at
      ? `A soft-deleted customer with email \"${built.payload.email}\" already exists for this tenant. Bloom will not create a second record because crm_customers is unique on tenant_id + email.`
      : `A customer with email \"${built.payload.email}\" already exists for this tenant.`;

    return errorResult(duplicateMessage, "duplicate_customer", {
      existing_customer: mapCustomerCard(existingCustomer, context.tenantId),
    });
  }

  const { data, error } = await client
    .from("crm_customers")
    .insert(built.payload)
    .select(CUSTOMER_CARD_SELECT)
    .single();

  if (error) {
    throw error;
  }

  const customer = data as CustomerRow;
  await syncCustomerTags({
    customerId: customer.id,
    tenantId: context.tenantId,
    tagNames: built.tagNames,
    context,
  });

  return createResult({
    success: true,
    message: `Created ${customerDisplayName(customer)}.`,
    data: mapCustomerCard(customer, context.tenantId),
    count: 1,
    blockType: "data_card",
  });
}

async function updateCustomer(
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const customerId = readString(params.customer_id);
  const changes = isRecord(params.changes)
    ? (params.changes as JsonObject)
    : null;

  if (!customerId || !changes) {
    return errorResult(
      "Customer ID and a changes object are required.",
      "validation_error",
    );
  }

  const existingCustomer = await loadCustomerById({
    customerId,
    tenantId: context.tenantId,
    includeDeleted: false,
    context,
  });

  if (!existingCustomer) {
    return errorResult(
      "The requested customer was not found for this tenant.",
      "customer_not_found",
    );
  }

  const { payload, normalizedEmail, tagNames } = buildUpdatePayload(
    changes,
    existingCustomer,
  );

  if (!normalizedEmail && hasOwnProperty(changes, "email")) {
    return errorResult(
      "Customer email must be a non-empty address.",
      "validation_error",
    );
  }

  if (Object.keys(payload).length === 1) {
    return errorResult(
      "No supported customer fields were provided to update.",
      "validation_error",
    );
  }

  if (normalizedEmail) {
    const duplicateCustomer = await findCustomerByEmail({
      email: normalizedEmail,
      tenantId: context.tenantId,
      context,
    });

    if (duplicateCustomer && duplicateCustomer.id !== customerId) {
      return errorResult(
        `A customer with email \"${normalizedEmail}\" already exists for this tenant.`,
        "duplicate_customer",
        {
          existing_customer: mapCustomerCard(
            duplicateCustomer,
            context.tenantId,
          ),
        },
      );
    }
  }

  const client = getQueryClient(context);
  const { data, error } = await client
    .from("crm_customers")
    .update(payload)
    .eq("tenant_id", context.tenantId)
    .eq("id", customerId)
    .is("deleted_at", null)
    .select(CUSTOMER_CARD_SELECT)
    .single();

  if (error) {
    throw error;
  }

  const customer = data as CustomerRow;
  if (tagNames !== null) {
    await syncCustomerTags({
      customerId: customer.id,
      tenantId: context.tenantId,
      tagNames,
      context,
    });
  }

  return createResult({
    success: true,
    message: `Updated ${customerDisplayName(customer)}.`,
    data: mapCustomerCard(customer, context.tenantId),
    count: 1,
    blockType: "data_card",
  });
}

async function deleteCustomer(
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  const customerId = readString(params.customer_id);
  const deletionMode = readString(params.deletion_mode);

  if (!customerId || deletionMode !== "soft_delete") {
    return errorResult(
      "Customer ID and deletion_mode=soft_delete are required.",
      "validation_error",
    );
  }

  const existingCustomer = await loadCustomerById({
    customerId,
    tenantId: context.tenantId,
    includeDeleted: true,
    context,
  });

  if (!existingCustomer) {
    return errorResult(
      "The requested customer was not found for this tenant.",
      "customer_not_found",
    );
  }

  if (existingCustomer.deleted_at) {
    return createResult({
      success: true,
      message: `${customerDisplayName(existingCustomer)} is already soft-deleted.`,
      data: mapCustomerCard(existingCustomer, context.tenantId),
      count: 1,
      blockType: "data_card",
    });
  }

  const client = getQueryClient(context);
  const deletedAt = new Date().toISOString();
  const { data, error } = await client
    .from("crm_customers")
    .update({
      deleted_at: deletedAt,
      updated_at: deletedAt,
    })
    .eq("tenant_id", context.tenantId)
    .eq("id", customerId)
    .is("deleted_at", null)
    .select(CUSTOMER_CARD_SELECT)
    .single();

  if (error) {
    throw error;
  }

  const customer = data as CustomerRow;

  return createResult({
    success: true,
    message: `Soft-deleted ${customerDisplayName(customer)}.`,
    data: mapCustomerCard(customer, context.tenantId),
    count: 1,
    blockType: "data_card",
  });
}

export function customerMutationImplementation(
  toolName: ToolName,
): ToolImplementation | null {
  switch (toolName) {
    case "create_customer":
      return createCustomer;
    case "update_customer":
      return updateCustomer;
    case "delete_customer":
      return deleteCustomer;
    default:
      return null;
  }
}
