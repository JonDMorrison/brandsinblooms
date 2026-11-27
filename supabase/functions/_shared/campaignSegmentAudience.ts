/**
 * Segment part of an email campaign audience.
 *
 * A campaign's segments are the union of every `campaign_segments` row for it
 * and the legacy single `crm_campaigns.segment_id`. The campaign editor saves
 * `segment_id` as the first selected segment and, when more than one is
 * selected, writes all of them to `campaign_segments`
 * (src/lib/crm/campaignDraftPersistence.ts, src/lib/crm/campaignEditor.ts
 * syncCampaignSegments); older saves (src/utils/crmCampaignService.ts) clear
 * `segment_id` and keep only the link rows. Reading both covers every shape.
 *
 * Members are the union of `customer_segments` rows across those segments,
 * counted only through a live `crm_segments` row in the campaign's tenant.
 * private.email_campaign_audience_contacts applies the same rule in SQL
 * (docs/email-eligibility.md).
 */

export interface SegmentAudienceQueryError {
  message: string;
}

interface SegmentAudienceQueryResult {
  data?: unknown;
  error?: SegmentAudienceQueryError | null;
}

function toRows(data: unknown): unknown[] {
  return Array.isArray(data) ? data : [];
}

interface SegmentAudienceFilterBuilder
  extends PromiseLike<SegmentAudienceQueryResult> {
  eq(column: string, value: string): SegmentAudienceFilterBuilder;
  is(column: string, value: null): SegmentAudienceFilterBuilder;
  in(column: string, values: string[]): SegmentAudienceFilterBuilder;
  order(
    column: string,
    options?: { ascending?: boolean },
  ): SegmentAudienceFilterBuilder;
  range(from: number, to: number): SegmentAudienceFilterBuilder;
}

/**
 * The slice of a Supabase client these reads use. `select` is left as
 * `unknown` (as in webhookDispatch.ts): matching the full postgrest builder
 * types structurally exceeds the compiler's instantiation depth, so the
 * chain is narrowed to SegmentAudienceFilterBuilder where it is used.
 */
export interface SegmentAudienceClient {
  from: (table: string) => {
    select: (columns: string) => unknown;
  };
}

function selectFrom(
  supabase: SegmentAudienceClient,
  table: string,
  columns: string,
): SegmentAudienceFilterBuilder {
  return supabase.from(table).select(columns) as SegmentAudienceFilterBuilder;
}

export type SegmentAudienceResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: SegmentAudienceQueryError };

function readStringField(row: unknown, field: string): string | null {
  if (!row || typeof row !== "object") return null;
  const value = (row as Record<string, unknown>)[field];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Every segment the campaign targets: `campaign_segments` rows plus the
 * legacy `segment_id`, de-duplicated, legacy id first.
 */
export async function resolveCampaignSegmentIds(
  supabase: SegmentAudienceClient,
  params: { campaignId: string; legacySegmentId: string | null | undefined },
): Promise<SegmentAudienceResult<string[]>> {
  const ids = new Set<string>();
  const legacy =
    typeof params.legacySegmentId === "string"
      ? params.legacySegmentId.trim()
      : "";
  if (legacy) ids.add(legacy);

  const { data, error } = await selectFrom(
    supabase,
    "campaign_segments",
    "segment_id",
  ).eq("campaign_id", params.campaignId);
  if (error) return { ok: false, error };

  for (const row of toRows(data)) {
    const segmentId = readStringField(row, "segment_id");
    if (segmentId) ids.add(segmentId);
  }

  return { ok: true, value: Array.from(ids) };
}

/**
 * Customers in any of the segments, through live segments of the tenant only.
 * Pages are ordered so a customer in several segments is never skipped.
 */
export async function resolveSegmentAudienceCustomerIds(
  supabase: SegmentAudienceClient,
  params: { tenantId: string; segmentIds: string[]; pageSize?: number },
): Promise<SegmentAudienceResult<string[]>> {
  const segmentIds = Array.from(new Set(params.segmentIds));
  const customerIds = new Set<string>();
  if (segmentIds.length === 0) return { ok: true, value: [] };

  const pageSize = params.pageSize ?? 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await selectFrom(
      supabase,
      "customer_segments",
      "customer_id, crm_segments!inner(id)",
    )
      .eq("crm_segments.tenant_id", params.tenantId)
      .is("crm_segments.deleted_at", null)
      .in("segment_id", segmentIds)
      .order("customer_id", { ascending: true })
      .order("segment_id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) return { ok: false, error };

    const rows = toRows(data);
    for (const row of rows) {
      const customerId = readStringField(row, "customer_id");
      if (customerId && UUID_RE.test(customerId)) customerIds.add(customerId);
    }
    if (rows.length < pageSize) break;
  }

  return { ok: true, value: Array.from(customerIds) };
}
