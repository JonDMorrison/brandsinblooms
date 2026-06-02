import { SYSTEM_PERSONAS } from "../../../../../src/config/systemPersonas.ts";
import type { Database } from "../../../../../src/integrations/supabase/types.ts";
import type { JsonObject, JsonValue } from "../../types.ts";
import type {
  ToolExecutionContext,
  ToolImplementation,
  ToolResult,
} from "../types.ts";
import {
  formatCurrency,
  getQueryClient,
  paginationRange,
  toNumberOrNull,
  uniqueStrings,
  type BloomQueryClient,
} from "./shared.ts";

type SegmentValidationRow = Pick<
  Database["public"]["Tables"]["crm_segments"]["Row"],
  "id" | "name"
>;
type SegmentMemberCustomer = Pick<
  Database["public"]["Tables"]["crm_customers"]["Row"],
  | "id"
  | "first_name"
  | "last_name"
  | "email"
  | "phone"
  | "total_spent"
  | "last_purchase_date"
  | "created_at"
  | "updated_at"
  | "last_email_clicked_at"
  | "last_open_at"
  | "preferred_channel"
  | "persona"
  | "persona_id"
>;
type MembershipRow = Pick<
  Database["public"]["Tables"]["customer_segments"]["Row"],
  "id" | "customer_id" | "assigned_at" | "assigned_by_user_id"
> & {
  crm_customers?: SegmentMemberCustomer | null;
};
type CustomerPersonaRow = Pick<
  Database["public"]["Tables"]["customer_personas"]["Row"],
  "customer_id" | "persona_id" | "predefined_persona_id"
>;
type CustomPersonaRow = Pick<
  Database["public"]["Tables"]["crm_personas"]["Row"],
  "id" | "persona_name"
>;
type CustomerSegmentRow = Pick<
  Database["public"]["Tables"]["customer_segments"]["Row"],
  "customer_id" | "segment_id"
>;
type SegmentRow = Pick<
  Database["public"]["Tables"]["crm_segments"]["Row"],
  "id" | "name"
>;
type CustomerTagRow = Pick<
  Database["public"]["Tables"]["customer_tags"]["Row"],
  "contact_id" | "tag_id"
>;
type TagRow = Pick<
  Database["public"]["Tables"]["crm_tags"]["Row"],
  "id" | "name"
>;

type CustomerRelationshipSummary = {
  personaNames: string[];
  segmentNames: string[];
  tagNames: string[];
};

const MEMBER_CUSTOMER_SELECT = `
  id,
  customer_id,
  assigned_at,
  assigned_by_user_id,
  crm_customers!inner(
    id,
    first_name,
    last_name,
    email,
    phone,
    total_spent,
    last_purchase_date,
    created_at,
    updated_at,
    last_email_clicked_at,
    last_open_at,
    preferred_channel,
    persona,
    persona_id
  )
`;

function readId(params: JsonObject, key: string): string | null {
  const value = params[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readPositiveInteger(
  value: JsonValue | undefined,
  fallback: number,
): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

function readSearch(params: JsonObject): string | null {
  const value = params.search;
  return typeof value === "string" && value.trim().length > 0
    ? value.trim().toLowerCase()
    : null;
}

function createNotFoundResult(message: string): ToolResult {
  return {
    success: false,
    data: null,
    count: 0,
    message,
    error: "not_found",
    block_type: "data_table",
    confirmation_required: false,
    confirmation_details: null,
  };
}

function createMembersResult(
  segment: SegmentValidationRow,
  items: JsonValue[],
  count: number,
): ToolResult {
  return {
    success: true,
    data: items,
    count,
    message: `Found ${count.toLocaleString()} members in ${segment.name}.`,
    error: null,
    block_type: "data_table",
    confirmation_required: false,
    confirmation_details: null,
  };
}

function customerName(customer: SegmentMemberCustomer): string {
  const fullName = [customer.first_name, customer.last_name]
    .filter(
      (part): part is string =>
        typeof part === "string" && part.trim().length > 0,
    )
    .join(" ")
    .trim();

  return fullName || customer.email || "Unnamed customer";
}

function lastActivityAt(customer: SegmentMemberCustomer): string | null {
  return (
    customer.last_purchase_date ??
    customer.last_email_clicked_at ??
    customer.last_open_at ??
    customer.updated_at ??
    customer.created_at
  );
}

function lifecycleStage(customer: SegmentMemberCustomer): string {
  const totalSpent = toNumberOrNull(customer.total_spent);
  if (totalSpent !== null && totalSpent > 0) {
    return "customer";
  }

  return "lead";
}

function personaNameFromId(
  personaId: string | null,
  customPersonas: Map<string, string>,
): string | null {
  if (!personaId) {
    return null;
  }

  return (
    customPersonas.get(personaId) ??
    SYSTEM_PERSONAS.find((persona) => persona.id === personaId)?.persona_name ??
    null
  );
}

async function loadCustomPersonaNames(
  client: BloomQueryClient,
  tenantId: string,
  personaIds: string[],
): Promise<Map<string, string>> {
  if (personaIds.length === 0) {
    return new Map();
  }

  const { data, error } = await client
    .from("crm_personas")
    .select("id, persona_name")
    .eq("tenant_id", tenantId)
    .in("id", personaIds);

  if (error) {
    throw error;
  }

  return new Map(
    ((data ?? []) as CustomPersonaRow[]).map((persona) => [
      persona.id,
      persona.persona_name,
    ]),
  );
}

async function loadRelationshipSummaries(
  client: BloomQueryClient,
  tenantId: string,
  customers: SegmentMemberCustomer[],
): Promise<Map<string, CustomerRelationshipSummary>> {
  const customerIds = uniqueStrings(customers.map((customer) => customer.id));
  const summaries = new Map<string, CustomerRelationshipSummary>(
    customerIds.map((customerId) => [
      customerId,
      {
        personaNames: [],
        segmentNames: [],
        tagNames: [],
      },
    ]),
  );

  if (customerIds.length === 0) {
    return summaries;
  }

  const [personaResponse, segmentMembershipResponse, tagAssignmentResponse] =
    await Promise.all([
      client
        .from("customer_personas")
        .select("customer_id, persona_id, predefined_persona_id")
        .in("customer_id", customerIds),
      client
        .from("customer_segments")
        .select("customer_id, segment_id")
        .in("customer_id", customerIds),
      client
        .from("customer_tags")
        .select("contact_id, tag_id")
        .in("contact_id", customerIds),
    ]);

  if (personaResponse.error) {
    throw personaResponse.error;
  }
  if (segmentMembershipResponse.error) {
    throw segmentMembershipResponse.error;
  }
  if (tagAssignmentResponse.error) {
    throw tagAssignmentResponse.error;
  }

  const personaRows = (personaResponse.data ?? []) as CustomerPersonaRow[];
  const customPersonaIds = uniqueStrings([
    ...customers.map((customer) => customer.persona_id),
    ...personaRows.map((row) => row.persona_id),
  ]);
  const customPersonas = await loadCustomPersonaNames(
    client,
    tenantId,
    customPersonaIds,
  );

  for (const customer of customers) {
    const summary = summaries.get(customer.id);
    if (!summary) {
      continue;
    }

    summary.personaNames = uniqueStrings([
      personaNameFromId(customer.persona_id, customPersonas),
      customer.persona,
      ...personaRows
        .filter((row) => row.customer_id === customer.id)
        .map((row) =>
          personaNameFromId(
            row.persona_id ?? row.predefined_persona_id,
            customPersonas,
          ),
        ),
    ]);
  }

  const segmentMemberships = (segmentMembershipResponse.data ??
    []) as CustomerSegmentRow[];
  const segmentIds = uniqueStrings(
    segmentMemberships.map((row) => row.segment_id),
  );
  if (segmentIds.length > 0) {
    const { data, error } = await client
      .from("crm_segments")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .in("id", segmentIds);

    if (error) {
      throw error;
    }

    const segments = new Map(
      ((data ?? []) as SegmentRow[]).map((segment) => [
        segment.id,
        segment.name,
      ]),
    );
    for (const membership of segmentMemberships) {
      const summary = summaries.get(membership.customer_id);
      const name = segments.get(membership.segment_id);
      if (summary && name) {
        summary.segmentNames = uniqueStrings([...summary.segmentNames, name]);
      }
    }
  }

  const tagAssignments = (tagAssignmentResponse.data ?? []) as CustomerTagRow[];
  const tagIds = uniqueStrings(tagAssignments.map((row) => row.tag_id));
  if (tagIds.length > 0) {
    const { data, error } = await client
      .from("crm_tags")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .in("id", tagIds);

    if (error) {
      throw error;
    }

    const tags = new Map(
      ((data ?? []) as TagRow[]).map((tag) => [tag.id, tag.name]),
    );
    for (const assignment of tagAssignments) {
      const summary = summaries.get(assignment.contact_id);
      const name = tags.get(assignment.tag_id);
      if (summary && name) {
        summary.tagNames = uniqueStrings([...summary.tagNames, name]);
      }
    }
  }

  return summaries;
}

function mapMember(
  membership: MembershipRow,
  customer: SegmentMemberCustomer,
  summaries: Map<string, CustomerRelationshipSummary>,
): JsonObject {
  const summary = summaries.get(customer.id) ?? {
    personaNames: [],
    segmentNames: [],
    tagNames: [],
  };

  return {
    membership_id: membership.id,
    customer_id: customer.id,
    id: customer.id,
    name: customerName(customer),
    first_name: customer.first_name,
    last_name: customer.last_name,
    email: customer.email,
    phone: customer.phone,
    lifecycle_stage: lifecycleStage(customer),
    preferred_channel: customer.preferred_channel,
    total_spent: formatCurrency(toNumberOrNull(customer.total_spent)),
    last_purchase_date: customer.last_purchase_date,
    last_activity_at: lastActivityAt(customer),
    created_at: customer.created_at,
    added_at: membership.assigned_at,
    added_by_user_id: membership.assigned_by_user_id,
    persona_name: summary.personaNames[0] ?? null,
    persona_names: summary.personaNames,
    segment_names: summary.segmentNames,
    tag_names: summary.tagNames,
  };
}

function matchesSearch(member: JsonObject, search: string | null): boolean {
  if (!search) {
    return true;
  }

  const fields = [member.name, member.email, member.phone];
  return fields.some(
    (value) =>
      typeof value === "string" && value.toLowerCase().includes(search),
  );
}

export const getSegmentMembers: ToolImplementation = async (
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> => {
  const segmentId = readId(params, "segment_id");
  if (!segmentId) {
    return createNotFoundResult("No segment ID was provided.");
  }

  const client = getQueryClient(context);
  const { data: segment, error: segmentError } = await client
    .from("crm_segments")
    .select("id, name")
    .eq("tenant_id", context.tenantId)
    .eq("id", segmentId)
    .is("deleted_at", null)
    .maybeSingle();

  if (segmentError) {
    throw segmentError;
  }

  if (!segment) {
    return createNotFoundResult("No segment found with that ID.");
  }

  const page = readPositiveInteger(params.page, 1);
  const pageSize = Math.min(readPositiveInteger(params.page_size, 10), 50);
  const [from, to] = paginationRange(page, pageSize);
  const search = readSearch(params);

  const { data, error } = await client
    .from("customer_segments")
    .select(MEMBER_CUSTOMER_SELECT)
    .eq("segment_id", segmentId)
    .eq("crm_customers.tenant_id", context.tenantId)
    .is("crm_customers.deleted_at", null)
    .order("assigned_at", { ascending: false });

  if (error) {
    throw error;
  }

  const memberships = ((data ?? []) as MembershipRow[]).filter(
    (membership) => membership.crm_customers,
  );
  const customers = memberships
    .map((membership) => membership.crm_customers)
    .filter((customer): customer is SegmentMemberCustomer => Boolean(customer));
  const summaries = await loadRelationshipSummaries(
    client,
    context.tenantId,
    customers,
  );
  const mapped = memberships
    .flatMap((membership) => {
      const customer = membership.crm_customers;
      return customer ? [mapMember(membership, customer, summaries)] : [];
    })
    .filter((member) => matchesSearch(member, search));
  const items = mapped.slice(from, to + 1).map((member) => member as JsonValue);

  return createMembersResult(
    segment as SegmentValidationRow,
    items,
    mapped.length,
  );
};
