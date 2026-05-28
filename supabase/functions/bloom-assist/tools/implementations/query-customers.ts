import { SYSTEM_PERSONAS } from "../../../../../src/config/systemPersonas.ts";
import type { Database } from "../../../../../src/integrations/supabase/types.ts";
import type { JsonObject, JsonValue } from "../../types.ts";
import { applyFilters } from "../filter-engine.ts";
import type {
  JunctionFilterValue,
  ToolExecutionContext,
  ToolFilter,
  ToolImplementation,
  ToolResult,
} from "../types.ts";
import {
  asJsonObject,
  createListResult,
  formatCurrency,
  getQueryClient,
  isJunctionOperator,
  normalizeSortBy,
  paginationRange,
  parseListQueryParams,
  sanitizePostgrestSearch,
  toNumberOrNull,
  uniqueStrings,
  type BloomQueryClient,
} from "./shared.ts";

type CustomerRow = Pick<
  Database["public"]["Tables"]["crm_customers"]["Row"],
  | "id"
  | "first_name"
  | "last_name"
  | "email"
  | "phone"
  | "total_spent"
  | "last_purchase_date"
  | "created_at"
  | "persona"
  | "persona_id"
> & {
  customer_personas?: Array<{
    persona_id: string | null;
    predefined_persona_id: string | null;
  }> | null;
  customer_segments?: Array<{
    segment_id: string;
    crm_segments?: { id: string; name: string } | null;
  }> | null;
  customer_tags?: Array<{
    tag_id: string;
    crm_tags?: { id: string; name: string } | null;
  }> | null;
};

type CustomerPersonaLookupRow = Pick<
  Database["public"]["Tables"]["crm_customers"]["Row"],
  "id" | "persona" | "persona_id"
> & {
  customer_personas?: Array<{
    persona_id: string | null;
    predefined_persona_id: string | null;
  }> | null;
};

const CUSTOMER_SELECT = `
  id,
  first_name,
  last_name,
  email,
  phone,
  total_spent,
  last_purchase_date,
  created_at,
  persona,
  persona_id,
  customer_personas(
    persona_id,
    predefined_persona_id
  ),
  customer_segments(
    segment_id,
    crm_segments(
      id,
      name
    )
  ),
  customer_tags(
    tag_id,
    crm_tags(
      id,
      name
    )
  )
`;

const CUSTOMER_SORT_FIELDS = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "total_spent",
  "last_purchase_date",
  "created_at",
  "sms_opt_in",
  "email_opt_in",
  "signup_source",
  "preferred_channel",
  "city",
  "state_region",
  "postal_code",
] as const;

function parseJunctionValue(filter: ToolFilter): JunctionFilterValue | null {
  const value = asJsonObject(filter.value);
  if (!value) {
    return null;
  }

  const relationship = value.relationship;
  const matchField = value.match_field;
  if (
    relationship !== "segment" &&
    relationship !== "tag" &&
    relationship !== "persona"
  ) {
    return null;
  }

  if (matchField !== "id" && matchField !== "name") {
    return null;
  }

  return {
    relationship,
    match_field: matchField,
    match_value: value.match_value,
    count:
      typeof value.count === "number" && Number.isFinite(value.count)
        ? value.count
        : undefined,
  };
}

function withMatchingIds(
  filter: ToolFilter,
  junction: JunctionFilterValue,
  ids: string[],
): ToolFilter {
  return {
    ...filter,
    value: {
      relationship: junction.relationship,
      match_field: junction.match_field,
      match_value: junction.match_value,
      matching_ids: ids,
      ...(junction.count !== undefined ? { count: junction.count } : {}),
    },
  };
}

async function fetchTenantCustomerIds(
  client: BloomQueryClient,
  tenantId: string,
): Promise<string[]> {
  const { data, error } = await client
    .from("crm_customers")
    .select("id")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => row.id);
}

function idsByExactCount(
  allTenantIds: string[],
  linkedIds: string[],
  expectedCount: number,
): string[] {
  const counts = new Map<string, number>();
  for (const id of linkedIds) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return allTenantIds.filter((id) => (counts.get(id) ?? 0) === expectedCount);
}

function readStringMatchValue(value: JsonValue): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

async function resolveTenantSegmentIds(
  client: BloomQueryClient,
  tenantId: string,
  junction: JunctionFilterValue,
): Promise<string[]> {
  if (junction.match_field === "id") {
    const id = readStringMatchValue(junction.match_value);
    if (!id) {
      return [];
    }

    const { data, error } = await client
      .from("crm_segments")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .is("deleted_at", null)
      .limit(1);

    if (error) {
      throw error;
    }

    return (data ?? []).map((row) => row.id);
  }

  const name = readStringMatchValue(junction.match_value);
  if (!name) {
    return [];
  }

  const { data, error } = await client
    .from("crm_segments")
    .select("id")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .ilike("name", name);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => row.id);
}

async function resolveTenantTagIds(
  client: BloomQueryClient,
  tenantId: string,
  junction: JunctionFilterValue,
): Promise<string[]> {
  if (junction.match_field === "id") {
    const id = readStringMatchValue(junction.match_value);
    if (!id) {
      return [];
    }

    const { data, error } = await client
      .from("crm_tags")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .limit(1);

    if (error) {
      throw error;
    }

    return (data ?? []).map((row) => row.id);
  }

  const name = readStringMatchValue(junction.match_value);
  if (!name) {
    return [];
  }

  const { data, error } = await client
    .from("crm_tags")
    .select("id")
    .eq("tenant_id", tenantId)
    .ilike("name", name);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => row.id);
}

function matchSystemPersonaIds(junction: JunctionFilterValue): string[] {
  const matchValue = readStringMatchValue(junction.match_value);
  if (!matchValue) {
    return [];
  }

  const normalized = matchValue.toLowerCase();
  return SYSTEM_PERSONAS.filter((persona) => {
    if (junction.match_field === "id") {
      return persona.id === matchValue;
    }

    const aliases = persona.legacyAliases ?? [];
    return [persona.persona_name, ...aliases]
      .map((candidate) => candidate.toLowerCase())
      .includes(normalized);
  }).map((persona) => persona.id);
}

async function resolveCustomPersonaIds(
  client: BloomQueryClient,
  tenantId: string,
  junction: JunctionFilterValue,
): Promise<string[]> {
  const matchValue = readStringMatchValue(junction.match_value);
  if (!matchValue) {
    return [];
  }

  const query = client
    .from("crm_personas")
    .select("id")
    .eq("tenant_id", tenantId);

  const filtered =
    junction.match_field === "id"
      ? query.eq("id", matchValue)
      : query.ilike("persona_name", matchValue);

  const { data, error } = await filtered;
  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => row.id);
}

function customerHasPersona(
  customer: CustomerPersonaLookupRow,
  customPersonaIds: Set<string>,
  systemPersonaIds: Set<string>,
  matchName: string | null,
): boolean {
  if (
    customer.persona_id &&
    (customPersonaIds.has(customer.persona_id) ||
      systemPersonaIds.has(customer.persona_id))
  ) {
    return true;
  }

  if (
    matchName &&
    customer.persona?.trim().toLowerCase() === matchName.toLowerCase()
  ) {
    return true;
  }

  return (customer.customer_personas ?? []).some((assignment) => {
    const customMatch = assignment.persona_id
      ? customPersonaIds.has(assignment.persona_id)
      : false;
    const systemMatch = assignment.predefined_persona_id
      ? systemPersonaIds.has(assignment.predefined_persona_id)
      : false;
    return customMatch || systemMatch;
  });
}

function customerPersonaCount(customer: CustomerPersonaLookupRow): number {
  const personaIds = new Set<string>();
  if (customer.persona_id) {
    personaIds.add(customer.persona_id);
  }
  if (customer.persona) {
    personaIds.add(customer.persona.trim().toLowerCase());
  }

  for (const assignment of customer.customer_personas ?? []) {
    if (assignment.persona_id) {
      personaIds.add(assignment.persona_id);
    }
    if (assignment.predefined_persona_id) {
      personaIds.add(assignment.predefined_persona_id);
    }
  }

  return personaIds.size;
}

async function resolvePersonaCustomerIds(
  client: BloomQueryClient,
  tenantId: string,
  junction: JunctionFilterValue,
): Promise<string[]> {
  const { data, error } = await client
    .from("crm_customers")
    .select(
      `
      id,
      persona,
      persona_id,
      customer_personas(
        persona_id,
        predefined_persona_id
      )
    `,
    )
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as CustomerPersonaLookupRow[];
  if (junction.count !== undefined) {
    return rows
      .filter((customer) => customerPersonaCount(customer) === junction.count)
      .map((customer) => customer.id);
  }

  const systemPersonaIds = new Set(matchSystemPersonaIds(junction));
  const customPersonaIds = new Set(
    await resolveCustomPersonaIds(client, tenantId, junction),
  );
  const matchName =
    junction.match_field === "name"
      ? readStringMatchValue(junction.match_value)
      : null;

  return rows
    .filter((customer) =>
      customerHasPersona(
        customer,
        customPersonaIds,
        systemPersonaIds,
        matchName,
      ),
    )
    .map((customer) => customer.id);
}

async function resolveSegmentCustomerIds(
  client: BloomQueryClient,
  tenantId: string,
  junction: JunctionFilterValue,
): Promise<string[]> {
  let segmentIds: string[];
  if (junction.count === undefined) {
    segmentIds = await resolveTenantSegmentIds(client, tenantId, junction);
  } else {
    const { data: tenantSegments, error: tenantSegmentsError } = await client
      .from("crm_segments")
      .select("id")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null);

    if (tenantSegmentsError) {
      throw tenantSegmentsError;
    }

    segmentIds = (tenantSegments ?? []).map((row) => row.id);
  }

  if (segmentIds.length === 0) {
    return junction.count === 0
      ? await fetchTenantCustomerIds(client, tenantId)
      : [];
  }

  const { data, error } = await client
    .from("customer_segments")
    .select("customer_id")
    .in("segment_id", segmentIds);

  if (error) {
    throw error;
  }

  const linkedIds = (data ?? []).map((row) => row.customer_id);
  if (junction.count === undefined) {
    return uniqueStrings(linkedIds);
  }

  return idsByExactCount(
    await fetchTenantCustomerIds(client, tenantId),
    linkedIds,
    junction.count,
  );
}

async function resolveTagCustomerIds(
  client: BloomQueryClient,
  tenantId: string,
  junction: JunctionFilterValue,
): Promise<string[]> {
  let tagIds: string[];
  if (junction.count === undefined) {
    tagIds = await resolveTenantTagIds(client, tenantId, junction);
  } else {
    const { data: tenantTags, error: tenantTagsError } = await client
      .from("crm_tags")
      .select("id")
      .eq("tenant_id", tenantId);

    if (tenantTagsError) {
      throw tenantTagsError;
    }

    tagIds = (tenantTags ?? []).map((row) => row.id);
  }

  if (tagIds.length === 0) {
    return junction.count === 0
      ? await fetchTenantCustomerIds(client, tenantId)
      : [];
  }

  const { data, error } = await client
    .from("customer_tags")
    .select("contact_id")
    .in("tag_id", tagIds);

  if (error) {
    throw error;
  }

  const linkedIds = (data ?? []).map((row) => row.contact_id);
  if (junction.count === undefined) {
    return uniqueStrings(linkedIds);
  }

  return idsByExactCount(
    await fetchTenantCustomerIds(client, tenantId),
    linkedIds,
    junction.count,
  );
}

async function resolveCustomerJunctionFilter(
  client: BloomQueryClient,
  tenantId: string,
  filter: ToolFilter,
): Promise<ToolFilter> {
  if (!isJunctionOperator(filter.operator)) {
    return filter;
  }

  const junction = parseJunctionValue(filter);
  if (!junction) {
    return filter;
  }

  const matchingIds =
    junction.relationship === "segment"
      ? await resolveSegmentCustomerIds(client, tenantId, junction)
      : junction.relationship === "tag"
        ? await resolveTagCustomerIds(client, tenantId, junction)
        : await resolvePersonaCustomerIds(client, tenantId, junction);

  return withMatchingIds(filter, junction, matchingIds);
}

async function resolveCustomerJunctionFilters(
  client: BloomQueryClient,
  tenantId: string,
  filters: ToolFilter[],
): Promise<ToolFilter[]> {
  const resolved: ToolFilter[] = [];
  for (const filter of filters) {
    resolved.push(
      await resolveCustomerJunctionFilter(client, tenantId, filter),
    );
  }
  return resolved;
}

function personaNameFromId(
  personaId: string | null | undefined,
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
): Promise<Map<string, string>> {
  const { data, error } = await client
    .from("crm_personas")
    .select("id, persona_name")
    .eq("tenant_id", tenantId);

  if (error) {
    throw error;
  }

  return new Map(
    (data ?? []).map((persona) => [persona.id, persona.persona_name]),
  );
}

function mapCustomer(
  row: CustomerRow,
  customPersonas: Map<string, string>,
): JsonObject {
  const assignedPersonaNames = uniqueStrings([
    personaNameFromId(row.persona_id, customPersonas),
    row.persona,
    ...(row.customer_personas ?? []).map((assignment) =>
      personaNameFromId(
        assignment.persona_id ?? assignment.predefined_persona_id,
        customPersonas,
      ),
    ),
  ]);
  const segmentNames = uniqueStrings(
    (row.customer_segments ?? []).map(
      (assignment) => assignment.crm_segments?.name ?? null,
    ),
  );
  const tagNames = uniqueStrings(
    (row.customer_tags ?? []).map(
      (assignment) => assignment.crm_tags?.name ?? null,
    ),
  );

  return {
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    phone: row.phone,
    total_spent: formatCurrency(toNumberOrNull(row.total_spent)),
    last_purchase_date: row.last_purchase_date,
    created_at: row.created_at,
    persona_name: assignedPersonaNames[0] ?? null,
    persona_names: assignedPersonaNames,
    segment_names: segmentNames,
    tag_names: tagNames,
  };
}

function normalizeRelationshipOperator(
  operator: ToolFilter["operator"],
): ToolFilter["operator"] {
  if (
    operator === "not_equals" ||
    operator === "not_in" ||
    operator === "has_not"
  ) {
    return "has_not";
  }

  if (operator === "has_count") {
    return "has_count";
  }

  return "has";
}

function normalizeCustomerFilter(filter: ToolFilter): ToolFilter {
  if (
    filter.field === "persona" ||
    filter.field === "segment" ||
    filter.field === "tag"
  ) {
    const value = asJsonObject(filter.value);
    return {
      ...filter,
      operator: normalizeRelationshipOperator(filter.operator),
      value: value ?? {
        relationship: filter.field,
        match_field: "name",
        match_value: filter.value,
      },
    };
  }

  return filter;
}

export const queryCustomers: ToolImplementation = async (
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> => {
  const client = getQueryClient(context);
  const queryParams = parseListQueryParams(params, "created_at");
  const sortBy = normalizeSortBy(
    queryParams.sortBy,
    CUSTOMER_SORT_FIELDS,
    "created_at",
  );
  const [from, to] = paginationRange(queryParams.page, queryParams.pageSize);
  const filters = await resolveCustomerJunctionFilters(
    client,
    context.tenantId,
    queryParams.filters.map(normalizeCustomerFilter),
  );

  let query = client
    .from("crm_customers")
    .select(CUSTOMER_SELECT, { count: "exact" })
    .eq("tenant_id", context.tenantId)
    .is("deleted_at", null);

  if (queryParams.search) {
    const search = sanitizePostgrestSearch(queryParams.search);
    if (search) {
      query = query.or(
        `email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`,
      );
    }
  }

  query = applyFilters(query, filters, {
    entity: "customer",
    timezone: context.timezone,
  })
    .order(sortBy, { ascending: queryParams.sortOrder === "asc" })
    .range(from, to);

  const { data, error, count } = await query;
  if (error) {
    throw error;
  }

  const customPersonas = await loadCustomPersonaNames(client, context.tenantId);
  const items = ((data ?? []) as CustomerRow[]).map(
    (row) => mapCustomer(row, customPersonas) as JsonValue,
  );

  return createListResult({ entityLabel: "customer", items, count });
};
