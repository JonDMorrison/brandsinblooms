import { SYSTEM_PERSONAS } from "../../../../../src/config/systemPersonas.ts";
import type { Database } from "../../../../../src/integrations/supabase/types.ts";
import type { JsonObject, JsonValue } from "../../types.ts";
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
  uniqueStrings,
  type BloomQueryClient,
} from "./shared.ts";

type CustomerRow = Pick<
  Database["public"]["Tables"]["crm_customers"]["Row"],
  | "id"
  | "email"
  | "first_name"
  | "last_name"
  | "phone"
  | "city"
  | "state_region"
  | "postal_code"
  | "country_code"
  | "lat"
  | "lon"
  | "store_id"
  | "store_name"
  | "timezone"
  | "custom_fields"
  | "email_opt_in"
  | "email_opt_in_at"
  | "email_opt_out_at"
  | "email_consent_source"
  | "email_consent_method"
  | "sms_opt_in"
  | "sms_opt_in_at"
  | "sms_opt_out_at"
  | "sms_consent_source"
  | "sms_consent_method"
  | "preferred_channel"
  | "total_spent"
  | "lifetime_value"
  | "pos_order_count"
  | "pos_total_spent"
  | "first_purchase_date"
  | "last_purchase_date"
  | "order_history"
  | "persona"
  | "persona_id"
  | "is_vip"
  | "suppressed"
  | "signup_source"
  | "signup_campaign"
  | "created_at"
  | "updated_at"
>;

type CustomerPersonaRow =
  Database["public"]["Tables"]["customer_personas"]["Row"];
type CustomPersonaRow = Pick<
  Database["public"]["Tables"]["crm_personas"]["Row"],
  | "id"
  | "persona_name"
  | "persona_description"
  | "is_custom"
  | "metadata"
  | "created_at"
  | "updated_at"
>;
type CustomerSegmentRow = Pick<
  Database["public"]["Tables"]["customer_segments"]["Row"],
  "id" | "segment_id" | "assigned_at" | "assigned_by_user_id"
>;
type SegmentRow = Pick<
  Database["public"]["Tables"]["crm_segments"]["Row"],
  "id" | "name" | "description" | "status" | "customer_count" | "auto_update"
>;
type CustomerTagRow = Pick<
  Database["public"]["Tables"]["customer_tags"]["Row"],
  "contact_id" | "tag_id" | "created_at"
>;
type TagRow = Pick<
  Database["public"]["Tables"]["crm_tags"]["Row"],
  "id" | "name" | "created_at"
>;
type EmailConsentEventRow = Pick<
  Database["public"]["Tables"]["crm_email_consent_events"]["Row"],
  "id" | "email" | "event_type" | "source" | "created_at"
>;
type SmsConsentEventRow = Pick<
  Database["public"]["Tables"]["crm_sms_consent_events"]["Row"],
  "id" | "phone" | "event_type" | "source" | "created_at"
>;
type TimelineRow = Pick<
  Database["public"]["Tables"]["customer_timeline"]["Row"],
  | "id"
  | "activity_type"
  | "campaign_id"
  | "campaign_name"
  | "product_name"
  | "purchase_amount"
  | "metadata"
  | "created_at"
>;
type Customer360Row = Pick<
  Database["public"]["Views"]["customer_360_enriched"]["Row"],
  | "engagement_overall_score"
  | "engagement_tier"
  | "engagement_email_score"
  | "engagement_sms_score"
  | "engagement_purchase_score"
  | "engagement_last_calculated_at"
  | "email_total_sent"
  | "email_total_opened"
  | "email_total_clicked"
  | "email_open_rate"
  | "email_click_rate"
  | "sms_total_sent"
  | "sms_total_delivered"
  | "sms_total_replied"
  | "sms_reply_rate"
>;

const CUSTOMER_DETAIL_SELECT = `
  id,
  email,
  first_name,
  last_name,
  phone,
  city,
  state_region,
  postal_code,
  country_code,
  lat,
  lon,
  store_id,
  store_name,
  timezone,
  custom_fields,
  email_opt_in,
  email_opt_in_at,
  email_opt_out_at,
  email_consent_source,
  email_consent_method,
  sms_opt_in,
  sms_opt_in_at,
  sms_opt_out_at,
  sms_consent_source,
  sms_consent_method,
  preferred_channel,
  total_spent,
  lifetime_value,
  pos_order_count,
  pos_total_spent,
  first_purchase_date,
  last_purchase_date,
  order_history,
  persona,
  persona_id,
  is_vip,
  suppressed,
  signup_source,
  signup_campaign,
  created_at,
  updated_at
`;

const CUSTOMER_360_SELECT = `
  engagement_overall_score,
  engagement_tier,
  engagement_email_score,
  engagement_sms_score,
  engagement_purchase_score,
  engagement_last_calculated_at,
  email_total_sent,
  email_total_opened,
  email_total_clicked,
  email_open_rate,
  email_click_rate,
  sms_total_sent,
  sms_total_delivered,
  sms_total_replied,
  sms_reply_rate
`;

function readId(params: JsonObject, key: string): string | null {
  const value = params[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function jsonOrNull(value: unknown): JsonValue | null {
  return isJsonValue(value) ? value : null;
}

function consentStatus(value: boolean | null): string {
  if (value === true) {
    return "opted_in";
  }
  if (value === false) {
    return "opted_out";
  }
  return "unknown";
}

function createDetailResult(data: JsonObject): ToolResult {
  return {
    success: true,
    data,
    count: 1,
    message: "Found the requested customer.",
    error: null,
    block_type: "data_card",
    confirmation_required: false,
    confirmation_details: null,
  };
}

function createNotFoundResult(message: string): ToolResult {
  return {
    success: false,
    data: null,
    count: 0,
    message,
    error: "not_found",
    block_type: "data_card",
    confirmation_required: false,
    confirmation_details: null,
  };
}

function readNotes(customFields: JsonValue | null): string | null {
  if (!isRecord(customFields)) {
    return null;
  }

  const value = customFields.notes ?? customFields.note;
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function orderHistoryCount(value: JsonValue | null): number | null {
  return Array.isArray(value) ? value.length : null;
}

function averageOrderValue(
  total: number | null,
  orderCount: number | null,
): number | null {
  if (total === null || orderCount === null || orderCount <= 0) {
    return null;
  }
  return total / orderCount;
}

function systemPersonaById(
  personaId: string | null,
): (typeof SYSTEM_PERSONAS)[number] | null {
  return personaId
    ? (SYSTEM_PERSONAS.find((persona) => persona.id === personaId) ?? null)
    : null;
}

function systemPersonaByName(
  name: string | null,
): (typeof SYSTEM_PERSONAS)[number] | null {
  if (!name) {
    return null;
  }

  const normalized = name.trim().toLowerCase();
  return (
    SYSTEM_PERSONAS.find((persona) => {
      const aliases = persona.legacyAliases ?? [];
      return [persona.persona_name, ...aliases]
        .map((candidate) => candidate.toLowerCase())
        .includes(normalized);
    }) ?? null
  );
}

function mapSystemPersona(
  persona: (typeof SYSTEM_PERSONAS)[number],
): JsonObject {
  return {
    id: persona.id,
    persona_name: persona.persona_name,
    persona_description: persona.persona_description ?? null,
    is_custom: false,
    metadata: jsonOrNull(persona.metadata ?? null),
    source: "system",
  };
}

function mapCustomPersona(persona: CustomPersonaRow): JsonObject {
  return {
    id: persona.id,
    persona_name: persona.persona_name,
    persona_description: persona.persona_description,
    is_custom: persona.is_custom,
    metadata: jsonOrNull(persona.metadata),
    source: "custom",
    created_at: persona.created_at,
    updated_at: persona.updated_at,
  };
}

function mapLegacyPersona(name: string): JsonObject {
  return {
    id: null,
    persona_name: name,
    persona_description: null,
    is_custom: false,
    metadata: null,
    source: "legacy",
  };
}

function resolvePersona(
  personaId: string | null,
  personaName: string | null,
  customPersonas: Map<string, CustomPersonaRow>,
): JsonObject | null {
  if (personaId) {
    const customPersona = customPersonas.get(personaId);
    if (customPersona) {
      return mapCustomPersona(customPersona);
    }

    const systemPersona = systemPersonaById(personaId);
    if (systemPersona) {
      return mapSystemPersona(systemPersona);
    }
  }

  const systemByName = systemPersonaByName(personaName);
  if (systemByName) {
    return mapSystemPersona(systemByName);
  }

  return personaName ? mapLegacyPersona(personaName) : null;
}

function collectPersonaIds(
  customer: CustomerRow,
  assignments: CustomerPersonaRow[],
): string[] {
  return uniqueStrings([
    customer.persona_id,
    ...assignments.map((assignment) => assignment.persona_id),
  ]);
}

async function loadCustomPersonas(
  client: BloomQueryClient,
  tenantId: string,
  personaIds: string[],
): Promise<Map<string, CustomPersonaRow>> {
  if (personaIds.length === 0) {
    return new Map();
  }

  const { data, error } = await client
    .from("crm_personas")
    .select(
      "id, persona_name, persona_description, is_custom, metadata, created_at, updated_at",
    )
    .eq("tenant_id", tenantId)
    .in("id", personaIds);

  if (error) {
    throw error;
  }

  return new Map(
    ((data ?? []) as CustomPersonaRow[]).map((persona) => [
      persona.id,
      persona,
    ]),
  );
}

function mapPersonas(
  customer: CustomerRow,
  assignments: CustomerPersonaRow[],
  customPersonas: Map<string, CustomPersonaRow>,
): JsonObject[] {
  const mapped = new Map<string, JsonObject>();
  const primary = resolvePersona(
    customer.persona_id,
    customer.persona,
    customPersonas,
  );
  if (primary) {
    const key =
      typeof primary.id === "string"
        ? primary.id
        : String(primary.persona_name);
    mapped.set(key, primary);
  }

  for (const assignment of assignments) {
    const persona = resolvePersona(
      assignment.persona_id ?? assignment.predefined_persona_id,
      null,
      customPersonas,
    );
    if (persona) {
      const key =
        typeof persona.id === "string"
          ? persona.id
          : String(persona.persona_name);
      mapped.set(key, {
        ...persona,
        assignment_id: assignment.id,
        assigned_at: assignment.created_at,
      });
    }
  }

  return Array.from(mapped.values());
}

function mapSegments(
  memberships: CustomerSegmentRow[],
  segments: Map<string, SegmentRow>,
): JsonObject[] {
  return memberships.flatMap((membership) => {
    const segment = segments.get(membership.segment_id);
    if (!segment) {
      return [];
    }

    return [
      {
        membership_id: membership.id,
        id: segment.id,
        name: segment.name,
        description: segment.description,
        status: segment.status,
        type: segment.auto_update ? "dynamic" : "static",
        customer_count: segment.customer_count ?? 0,
        assigned_at: membership.assigned_at,
        assigned_by_user_id: membership.assigned_by_user_id,
      },
    ];
  });
}

function mapTags(
  assignments: CustomerTagRow[],
  tags: Map<string, TagRow>,
): JsonObject[] {
  return assignments.flatMap((assignment) => {
    const tag = tags.get(assignment.tag_id);
    return tag
      ? [
          {
            id: tag.id,
            name: tag.name,
            assigned_at: assignment.created_at,
          },
        ]
      : [];
  });
}

function mapTimelineSummary(
  rows: TimelineRow[],
  count: number | null,
): JsonObject {
  const recentEvents = rows.map((row) => ({
    id: row.id,
    activity_type: row.activity_type,
    campaign_id: row.campaign_id,
    campaign_name: row.campaign_name,
    product_name: row.product_name,
    purchase_amount: row.purchase_amount,
    metadata: jsonOrNull(row.metadata),
    created_at: row.created_at,
  }));

  return {
    total_events: count ?? rows.length,
    last_activity_at: rows[0]?.created_at ?? null,
    recent_activity_types: uniqueStrings(rows.map((row) => row.activity_type)),
    recent_events: recentEvents as JsonValue[],
  };
}

function mapEngagementSummary(row: Customer360Row | null): JsonObject {
  return {
    overall_score: row?.engagement_overall_score ?? null,
    tier: row?.engagement_tier ?? null,
    email_score: row?.engagement_email_score ?? null,
    sms_score: row?.engagement_sms_score ?? null,
    purchase_score: row?.engagement_purchase_score ?? null,
    last_calculated_at: row?.engagement_last_calculated_at ?? null,
    email: {
      total_sent: row?.email_total_sent ?? null,
      total_opened: row?.email_total_opened ?? null,
      total_clicked: row?.email_total_clicked ?? null,
      open_rate: row?.email_open_rate ?? null,
      click_rate: row?.email_click_rate ?? null,
    },
    sms: {
      total_sent: row?.sms_total_sent ?? null,
      total_delivered: row?.sms_total_delivered ?? null,
      total_replied: row?.sms_total_replied ?? null,
      reply_rate: row?.sms_reply_rate ?? null,
    },
  };
}

async function loadCustomerSegments(
  client: BloomQueryClient,
  tenantId: string,
  customerId: string,
): Promise<{
  memberships: CustomerSegmentRow[];
  segments: Map<string, SegmentRow>;
}> {
  const { data: membershipsData, error: membershipsError } = await client
    .from("customer_segments")
    .select("id, segment_id, assigned_at, assigned_by_user_id")
    .eq("customer_id", customerId)
    .order("assigned_at", { ascending: false });

  if (membershipsError) {
    throw membershipsError;
  }

  const memberships = (membershipsData ?? []) as CustomerSegmentRow[];
  const segmentIds = uniqueStrings(
    memberships.map((membership) => membership.segment_id),
  );
  if (segmentIds.length === 0) {
    return { memberships, segments: new Map() };
  }

  const { data: segmentsData, error: segmentsError } = await client
    .from("crm_segments")
    .select("id, name, description, status, customer_count, auto_update")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .in("id", segmentIds);

  if (segmentsError) {
    throw segmentsError;
  }

  return {
    memberships,
    segments: new Map(
      ((segmentsData ?? []) as SegmentRow[]).map((segment) => [
        segment.id,
        segment,
      ]),
    ),
  };
}

async function loadCustomerTags(
  client: BloomQueryClient,
  tenantId: string,
  customerId: string,
): Promise<{ assignments: CustomerTagRow[]; tags: Map<string, TagRow> }> {
  const { data: assignmentsData, error: assignmentsError } = await client
    .from("customer_tags")
    .select("contact_id, tag_id, created_at")
    .eq("contact_id", customerId);

  if (assignmentsError) {
    throw assignmentsError;
  }

  const assignments = (assignmentsData ?? []) as CustomerTagRow[];
  const tagIds = uniqueStrings(
    assignments.map((assignment) => assignment.tag_id),
  );
  if (tagIds.length === 0) {
    return { assignments, tags: new Map() };
  }

  const { data: tagsData, error: tagsError } = await client
    .from("crm_tags")
    .select("id, name, created_at")
    .eq("tenant_id", tenantId)
    .in("id", tagIds);

  if (tagsError) {
    throw tagsError;
  }

  return {
    assignments,
    tags: new Map(((tagsData ?? []) as TagRow[]).map((tag) => [tag.id, tag])),
  };
}

function mapCustomerDetail(args: {
  customer: CustomerRow;
  personas: JsonObject[];
  segments: JsonObject[];
  tags: JsonObject[];
  emailConsentEvent: EmailConsentEventRow | null;
  smsConsentEvent: SmsConsentEventRow | null;
  engagementSummary: JsonObject;
  timelineSummary: JsonObject;
}): JsonObject {
  const customFields = jsonOrNull(args.customer.custom_fields);
  const orderHistory = jsonOrNull(args.customer.order_history);
  const orderCount =
    toNumberOrNull(args.customer.pos_order_count) ??
    orderHistoryCount(orderHistory);
  const lifetimeValue =
    toNumberOrNull(args.customer.lifetime_value) ??
    toNumberOrNull(args.customer.total_spent);
  const totalSpent = toNumberOrNull(args.customer.total_spent);

  return {
    id: args.customer.id,
    first_name: args.customer.first_name,
    last_name: args.customer.last_name,
    email: args.customer.email,
    phone: args.customer.phone,
    address: {
      city: args.customer.city,
      state_region: args.customer.state_region,
      postal_code: args.customer.postal_code,
      country_code: args.customer.country_code,
      lat: args.customer.lat,
      lon: args.customer.lon,
      store_id: args.customer.store_id,
      store_name: args.customer.store_name,
      timezone: args.customer.timezone,
    },
    preferred_channel: args.customer.preferred_channel,
    signup_source: args.customer.signup_source,
    signup_campaign: args.customer.signup_campaign,
    is_vip: args.customer.is_vip,
    suppressed: args.customer.suppressed,
    notes: readNotes(customFields),
    custom_fields: customFields,
    email_consent: {
      status: consentStatus(args.customer.email_opt_in),
      status_date:
        args.emailConsentEvent?.created_at ??
        args.customer.email_opt_in_at ??
        args.customer.email_opt_out_at,
      opt_in_at: args.customer.email_opt_in_at,
      opt_out_at: args.customer.email_opt_out_at,
      source: args.customer.email_consent_source,
      method: args.customer.email_consent_method,
      latest_event: args.emailConsentEvent
        ? {
            id: args.emailConsentEvent.id,
            email: args.emailConsentEvent.email,
            event_type: args.emailConsentEvent.event_type,
            source: args.emailConsentEvent.source,
            created_at: args.emailConsentEvent.created_at,
          }
        : null,
    },
    sms_consent: {
      status: consentStatus(args.customer.sms_opt_in),
      status_date:
        args.smsConsentEvent?.created_at ??
        args.customer.sms_opt_in_at ??
        args.customer.sms_opt_out_at,
      opt_in_at: args.customer.sms_opt_in_at,
      opt_out_at: args.customer.sms_opt_out_at,
      source: args.customer.sms_consent_source,
      method: args.customer.sms_consent_method,
      latest_event: args.smsConsentEvent
        ? {
            id: args.smsConsentEvent.id,
            phone: args.smsConsentEvent.phone,
            event_type: args.smsConsentEvent.event_type,
            source: args.smsConsentEvent.source,
            created_at: args.smsConsentEvent.created_at,
          }
        : null,
    },
    purchase_metrics: {
      order_count: orderCount,
      average_order_value: averageOrderValue(
        lifetimeValue ?? totalSpent,
        orderCount,
      ),
      lifetime_value: lifetimeValue,
      total_spent: totalSpent,
      pos_total_spent: args.customer.pos_total_spent,
      first_purchase_date: args.customer.first_purchase_date,
      last_purchase_date: args.customer.last_purchase_date,
      order_history: orderHistory,
    },
    persona: args.personas[0] ?? null,
    personas: args.personas as JsonValue[],
    segments: args.segments as JsonValue[],
    tags: args.tags as JsonValue[],
    segment_names: args.segments
      .map((segment) => String(segment.name ?? ""))
      .filter((name) => name.length > 0),
    tag_names: args.tags
      .map((tag) => String(tag.name ?? ""))
      .filter((name) => name.length > 0),
    engagement_summary: args.engagementSummary,
    engagement_timeline_summary: args.timelineSummary,
    created_at: args.customer.created_at,
    updated_at: args.customer.updated_at,
  };
}

export const getCustomerDetail: ToolImplementation = async (
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> => {
  const customerId = readId(params, "customer_id");
  if (!customerId) {
    return createNotFoundResult("No customer ID was provided.");
  }

  const client = getQueryClient(context);
  const { data: customerData, error: customerError } = await client
    .from("crm_customers")
    .select(CUSTOMER_DETAIL_SELECT)
    .eq("tenant_id", context.tenantId)
    .eq("id", customerId)
    .is("deleted_at", null)
    .maybeSingle();

  if (customerError) {
    throw customerError;
  }

  if (!customerData) {
    return createNotFoundResult("No customer found with that ID.");
  }

  const customer = customerData as CustomerRow;
  const [
    personaResponse,
    segmentBundle,
    tagBundle,
    emailConsentResponse,
    smsConsentResponse,
    timelineResponse,
    customer360Response,
  ] = await Promise.all([
    client
      .from("customer_personas")
      .select(
        "id, customer_id, persona_id, predefined_persona_id, created_at, updated_at",
      )
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false }),
    loadCustomerSegments(client, context.tenantId, customerId),
    loadCustomerTags(client, context.tenantId, customerId),
    client
      .from("crm_email_consent_events")
      .select("id, email, event_type, source, created_at")
      .eq("tenant_id", context.tenantId)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(1),
    client
      .from("crm_sms_consent_events")
      .select("id, phone, event_type, source, created_at")
      .eq("tenant_id", context.tenantId)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(1),
    client
      .from("customer_timeline")
      .select(
        "id, activity_type, campaign_id, campaign_name, product_name, purchase_amount, metadata, created_at",
        { count: "exact" },
      )
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(10),
    client
      .from("customer_360_enriched")
      .select(CUSTOMER_360_SELECT)
      .eq("tenant_id", context.tenantId)
      .eq("id", customerId)
      .maybeSingle(),
  ]);

  if (personaResponse.error) {
    throw personaResponse.error;
  }
  if (emailConsentResponse.error) {
    throw emailConsentResponse.error;
  }
  if (smsConsentResponse.error) {
    throw smsConsentResponse.error;
  }
  if (timelineResponse.error) {
    throw timelineResponse.error;
  }
  if (customer360Response.error) {
    throw customer360Response.error;
  }

  const personaAssignments = (personaResponse.data ??
    []) as CustomerPersonaRow[];
  const customPersonas = await loadCustomPersonas(
    client,
    context.tenantId,
    collectPersonaIds(customer, personaAssignments),
  );

  return createDetailResult(
    mapCustomerDetail({
      customer,
      personas: mapPersonas(customer, personaAssignments, customPersonas),
      segments: mapSegments(segmentBundle.memberships, segmentBundle.segments),
      tags: mapTags(tagBundle.assignments, tagBundle.tags),
      emailConsentEvent:
        ((emailConsentResponse.data ?? []) as EmailConsentEventRow[])[0] ??
        null,
      smsConsentEvent:
        ((smsConsentResponse.data ?? []) as SmsConsentEventRow[])[0] ?? null,
      engagementSummary: mapEngagementSummary(
        customer360Response.data as Customer360Row | null,
      ),
      timelineSummary: mapTimelineSummary(
        (timelineResponse.data ?? []) as TimelineRow[],
        timelineResponse.count,
      ),
    }),
  );
};
