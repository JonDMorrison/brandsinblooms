import type { Database } from "../../../../../src/integrations/supabase/types.ts";
import { deriveCampaignDisplayName } from "../../../../../src/lib/crm/campaignDisplayName.ts";
import {
  reviewCampaignContent,
  type ReviewableBlock,
} from "../../../../../src/lib/crm/campaignContentReview.ts";
import {
  classifySender,
  type SenderDomainLike,
  type SenderDomainStatus,
} from "../../../../../src/lib/crm/senderSeverity.ts";
import type { JsonObject, JsonValue } from "../../types.ts";
import { applyFilters } from "../filter-engine.ts";
import type {
  ToolExecutionContext,
  ToolFilter,
  ToolImplementation,
  ToolResult,
} from "../types.ts";
import {
  asJsonObject,
  createListResult,
  getQueryClient,
  isJunctionOperator,
  loadSharedCampaignRollups,
  type SharedCampaignRollup,
  isRecord,
  normalizeSortBy,
  paginationRange,
  parseListQueryParams,
  sanitizePostgrestSearch,
  toNumberOrNull,
  uniqueStrings,
  type BloomQueryClient,
} from "./shared.ts";

type CampaignRow = Pick<
  Database["public"]["Tables"]["crm_campaigns"]["Row"],
  | "id"
  | "name"
  | "subject_line"
  | "status"
  | "scheduled_at"
  | "sent_at"
  | "created_at"
  | "segment_id"
  | "metrics"
  | "open_rate"
  | "click_rate"
  | "total_sent"
  | "total_recipients"
  | "messages_sent"
  | "sender_email"
  | "sender_name"
>;

type CampaignSegmentRow = Pick<
  Database["public"]["Tables"]["campaign_segments"]["Row"],
  "campaign_id" | "segment_id"
>;

const CAMPAIGN_SELECT = `
  id,
  name,
  subject_line,
  status,
  scheduled_at,
  sent_at,
  created_at,
  segment_id,
  metrics,
  open_rate,
  click_rate,
  total_sent,
  total_recipients,
  messages_sent,
  sender_email,
  sender_name
`;

const CAMPAIGN_SORT_FIELDS = [
  "name",
  "subject_line",
  "status",
  "created_at",
  "scheduled_at",
  "sent_at",
  "segment_id",
  "open_rate",
  "click_rate",
  "total_sent",
  "messages_sent",
  "messages_failed",
  "total_recipients",
  "auto_send_enabled",
] as const;

function readMetric(metrics: unknown, names: string[]): number | null {
  if (!isRecord(metrics)) {
    return null;
  }

  for (const name of names) {
    const value = metrics[name];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function campaignIdsFromSegments(
  rows: CampaignRow[],
  campaignSegments: CampaignSegmentRow[],
  segmentIds: Set<string>,
): string[] {
  return uniqueStrings([
    ...rows
      .filter((row) =>
        row.segment_id ? segmentIds.has(row.segment_id) : false,
      )
      .map((row) => row.id),
    ...campaignSegments
      .filter((row) => segmentIds.has(row.segment_id))
      .map((row) => row.campaign_id),
  ]);
}

async function resolveTenantSegmentIds(
  client: BloomQueryClient,
  tenantId: string,
  filter: ToolFilter,
): Promise<string[]> {
  const value = asJsonObject(filter.value);
  const matchValue = value?.match_value ?? filter.value;
  const matchField = value?.match_field === "name" ? "name" : "id";

  if (Array.isArray(matchValue)) {
    const ids = matchValue.filter(
      (item): item is string => typeof item === "string",
    );
    if (ids.length === 0) {
      return [];
    }

    const { data, error } = await client
      .from("crm_segments")
      .select("id")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .in("id", ids);

    if (error) {
      throw error;
    }

    return (data ?? []).map((row) => row.id);
  }

  if (typeof matchValue !== "string" || !matchValue.trim()) {
    return [];
  }

  const query = client
    .from("crm_segments")
    .select("id")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null);

  const filtered =
    matchField === "name"
      ? query.ilike("name", matchValue.trim())
      : query.eq("id", matchValue.trim());

  const { data, error } = await filtered;
  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => row.id);
}

async function resolveCampaignSegmentFilter(
  client: BloomQueryClient,
  tenantId: string,
  filter: ToolFilter,
): Promise<ToolFilter> {
  if (filter.field !== "segment_id" && !isJunctionOperator(filter.operator)) {
    return filter;
  }

  if (filter.field !== "segment_id") {
    return filter;
  }

  const segmentIds = await resolveTenantSegmentIds(client, tenantId, filter);
  const { data: campaigns, error: campaignError } = await client
    .from("crm_campaigns")
    .select("id, segment_id")
    .eq("tenant_id", tenantId);

  if (campaignError) {
    throw campaignError;
  }

  const campaignRows = (campaigns ?? []) as CampaignRow[];
  const campaignIds = campaignRows.map((row) => row.id);
  const { data: campaignSegments, error: segmentError } =
    campaignIds.length > 0
      ? await client
          .from("campaign_segments")
          .select("campaign_id, segment_id")
          .in("campaign_id", campaignIds)
      : { data: [] as CampaignSegmentRow[], error: null };

  if (segmentError) {
    throw segmentError;
  }

  const matchingIds = campaignIdsFromSegments(
    campaignRows,
    (campaignSegments ?? []) as CampaignSegmentRow[],
    new Set(segmentIds),
  );
  const nextOperator =
    filter.operator === "has_not" ||
    filter.operator === "not_equals" ||
    filter.operator === "not_in"
      ? "has_not"
      : "has";

  return {
    ...filter,
    operator: nextOperator,
    value: {
      relationship: "segment",
      match_field: "id",
      match_value: segmentIds,
      matching_ids: matchingIds,
    },
  };
}

async function resolveCampaignFilters(
  client: BloomQueryClient,
  tenantId: string,
  filters: ToolFilter[],
): Promise<ToolFilter[]> {
  const resolved: ToolFilter[] = [];
  for (const filter of filters) {
    resolved.push(await resolveCampaignSegmentFilter(client, tenantId, filter));
  }
  return resolved;
}

function normalizeCampaignFilter(filter: ToolFilter): ToolFilter {
  if (filter.field === "subject") {
    return { ...filter, field: "subject_line" };
  }

  if (filter.field === "delivered_count") {
    return { ...filter, field: "total_sent" };
  }

  return filter;
}

async function loadCampaignSegmentNames(
  client: BloomQueryClient,
  tenantId: string,
  rows: CampaignRow[],
): Promise<Map<string, string[]>> {
  const campaignIds = rows.map((row) => row.id);
  const directSegmentIds = rows
    .map((row) => row.segment_id)
    .filter((id): id is string => Boolean(id));
  const { data: links, error: linksError } =
    campaignIds.length > 0
      ? await client
          .from("campaign_segments")
          .select("campaign_id, segment_id")
          .in("campaign_id", campaignIds)
      : { data: [] as CampaignSegmentRow[], error: null };

  if (linksError) {
    throw linksError;
  }

  const allSegmentIds = uniqueStrings([
    ...directSegmentIds,
    ...((links ?? []) as CampaignSegmentRow[]).map((link) => link.segment_id),
  ]);
  const { data: segments, error: segmentsError } =
    allSegmentIds.length > 0
      ? await client
          .from("crm_segments")
          .select("id, name")
          .eq("tenant_id", tenantId)
          .in("id", allSegmentIds)
      : { data: [] as Array<{ id: string; name: string }>, error: null };

  if (segmentsError) {
    throw segmentsError;
  }

  const segmentNamesById = new Map<string, string>(
    (segments ?? []).map((segment) => [segment.id, segment.name]),
  );
  const segmentNamesByCampaign = new Map<string, string[]>();

  for (const row of rows) {
    const names = uniqueStrings([
      row.segment_id ? segmentNamesById.get(row.segment_id) : null,
      ...((links ?? []) as CampaignSegmentRow[])
        .filter((link) => link.campaign_id === row.id)
        .map((link) => segmentNamesById.get(link.segment_id)),
    ]);
    segmentNamesByCampaign.set(row.id, names);
  }

  return segmentNamesByCampaign;
}

const SENT_STATUSES = new Set(["sent", "sent_with_errors"]);
const STATUS_LABELS: Record<string, string> = {
  draft: "Draft (not sent)",
  scheduled: "Scheduled (not sent yet)",
  queued: "Queued to send",
  partially_queued: "Queued to send",
  sending: "Sending now",
  paused: "Paused (not sent)",
  sent: "Sent",
  sent_with_errors: "Sent, with some failures",
  failed: "Failed (not sent)",
};

export interface DraftReviewInput {
  subjectLine: string | null;
  senderEmail: string | null;
  senderName: string | null;
  blocks: ReviewableBlock[];
  emailDomains: SenderDomainLike[];
}

/**
 * The Review & Send checks for one draft: subject line, the content review
 * (empty image blocks, buttons without links, sample links) and the sender
 * check, plus one short recommendation.
 */
export function reviewDraft(input: DraftReviewInput): JsonObject {
  const subject = (input.subjectLine ?? "").trim();
  const visibleBlocks = input.blocks.filter((block) => block.visible !== false);
  const contentIssues = reviewCampaignContent(visibleBlocks).map((issue) => issue.message);
  const sender = classifySender({
    senderEmail: input.senderEmail ?? "",
    senderName: input.senderName ?? "",
    emailDomains: input.emailDomains,
    campaignType: "email",
  });

  const checks: JsonObject[] = [
    {
      check: "Subject line",
      ok: subject.length > 0,
      detail: subject ? subject : "No subject line yet.",
    },
    {
      check: "Content",
      ok: visibleBlocks.length > 0 && contentIssues.length === 0,
      detail:
        visibleBlocks.length === 0
          ? "The email has no content blocks."
          : contentIssues.length
            ? contentIssues.join(" ")
            : "No empty image blocks or unfinished links.",
    },
    {
      check: "Sender",
      ok: sender.status === "ready",
      detail: sender.status === "ready" ? "Sender is set up." : sender.message,
    },
  ];

  const issueCount = contentIssues.length;
  const recommendation = !subject
    ? "Add a subject line, then review the content before sending."
    : visibleBlocks.length === 0
      ? "Add content to this draft before sending."
      : issueCount
        ? "Fix " + issueCount + " content issue" + (issueCount === 1 ? "" : "s") + " first (" + contentIssues[0] + ")."
        : sender.status === "blocked"
          ? "Set up the sender in Settings before this can be sent."
          : sender.status === "warning"
            ? "Ready to send once you are happy with the sender warning."
            : "Looks ready: open it, preview, and send or schedule.";

  return { subject_line: subject || null, checks, recommendation };
}

export function mapCampaign(
  row: CampaignRow,
  segmentNames: string[],
  draftReview: JsonObject | null,
  rollup: SharedCampaignRollup | null = null,
): JsonObject {
  const status = String(row.status ?? "draft");
  const hasBeenSent = SENT_STATUSES.has(status);
  const stats = hasBeenSent ? rollup?.stats ?? null : null;
  // Only sent campaigns have deliveries. A draft's audience size is not a
  // send count, so drafts never report a delivered number.
  const deliveredCount = hasBeenSent
    ? readMetric(row.metrics, ["delivered_count", "delivered", "sent"]) ??
      toNumberOrNull(row.total_sent) ??
      toNumberOrNull(row.messages_sent) ??
      null
    : null;

  return {
    id: row.id,
    // Shared display-name rule: name, then subject, then "Draft, <date>"
    // for drafts or "Campaign, <date>" otherwise; merge tags removed.
    name: deriveCampaignDisplayName({
      name: row.name,
      subjectLine: row.subject_line,
      date: row.created_at,
      status,
      sentAt: row.sent_at,
      scheduledAt: row.scheduled_at,
    }),
    subject_line: row.subject_line,
    status,
    status_label: STATUS_LABELS[status] ?? status,
    has_been_sent: hasBeenSent,
    scheduled_at: row.scheduled_at,
    sent_at: hasBeenSent ? row.sent_at : null,
    // Sent campaigns use the shared rollup (the numbers the campaign list,
    // report and dashboard show). The stored columns are only a fallback
    // when the rollup could not be loaded.
    metrics_summary: stats
      ? {
          recipients: stats.recipients,
          delivered_count: stats.delivered,
          opens: stats.opens,
          clicks: stats.clicks,
          open_rate: stats.openRate,
          click_rate: stats.clickRate,
          estimated: stats.estimated,
        }
      : hasBeenSent
      ? {
          open_rate:
            toNumberOrNull(row.open_rate) ??
            readMetric(row.metrics, ["open_rate", "opened_rate"]),
          click_rate:
            toNumberOrNull(row.click_rate) ??
            readMetric(row.metrics, ["click_rate", "clicked_rate"]),
          delivered_count: deliveredCount,
        }
      : null,
    ...(draftReview ? { draft_review: draftReview } : {}),
    segment_names: segmentNames,
    created_at: row.created_at,
  };
}

const REVIEWABLE_STATUSES = new Set(["draft", "paused", "scheduled"]);

type CampaignBlockRow = {
  campaign_id: string;
  order_index: number;
  block_type: string;
  content: unknown;
  image_url: string | null;
};

export function toReviewableBlock(block: CampaignBlockRow): ReviewableBlock {
  const content = isRecord(block.content) ? block.content : {};
  return {
    ...content,
    id: typeof content.id === "string" ? content.id : block.campaign_id + ":" + block.order_index,
    type: typeof content.type === "string" ? content.type : block.block_type,
    visible: content.visible === false ? false : undefined,
    imageUrl:
      typeof content.imageUrl === "string" ? content.imageUrl : (block.image_url ?? undefined),
  };
}

async function loadDraftReviews(
  client: BloomQueryClient,
  tenantId: string,
  rows: CampaignRow[],
): Promise<Map<string, JsonObject>> {
  const drafts = rows.filter((row) => REVIEWABLE_STATUSES.has(String(row.status)));
  const reviews = new Map<string, JsonObject>();
  if (drafts.length === 0) return reviews;

  const [blocksResult, domainsResult] = await Promise.all([
    client
      .from("campaign_blocks")
      .select("campaign_id, order_index, block_type, content, image_url")
      .in("campaign_id", drafts.map((row) => row.id))
      .order("order_index", { ascending: true }),
    client
      .from("email_domains")
      .select("domain, default_from_email, status")
      .eq("tenant_id", tenantId),
  ]);
  if (blocksResult.error) throw blocksResult.error;
  if (domainsResult.error) throw domainsResult.error;

  const blocksByCampaign = new Map<string, ReviewableBlock[]>();
  for (const block of (blocksResult.data ?? []) as CampaignBlockRow[]) {
    const list = blocksByCampaign.get(block.campaign_id) ?? [];
    list.push(toReviewableBlock(block));
    blocksByCampaign.set(block.campaign_id, list);
  }

  const emailDomains: SenderDomainLike[] = (
    (domainsResult.data ?? []) as Array<{
      domain: string;
      default_from_email: string | null;
      status: string;
    }>
  ).map((domain) => ({
    domain: domain.domain,
    default_from_email: domain.default_from_email,
    status: domain.status as SenderDomainStatus,
  }));

  for (const row of drafts) {
    reviews.set(
      row.id,
      reviewDraft({
        subjectLine: row.subject_line,
        senderEmail: row.sender_email,
        senderName: row.sender_name,
        blocks: blocksByCampaign.get(row.id) ?? [],
        emailDomains,
      }),
    );
  }
  return reviews;
}

export const queryCampaigns: ToolImplementation = async (
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> => {
  const client = getQueryClient(context);
  const queryParams = parseListQueryParams(params, "created_at");
  const sortBy = normalizeSortBy(
    queryParams.sortBy,
    CAMPAIGN_SORT_FIELDS,
    "created_at",
    {
      subject: "subject_line",
      delivered_count: "total_sent",
    },
  );
  const [from, to] = paginationRange(queryParams.page, queryParams.pageSize);
  const filters = await resolveCampaignFilters(
    client,
    context.tenantId,
    queryParams.filters.map(normalizeCampaignFilter),
  );

  let query = client
    .from("crm_campaigns")
    .select(CAMPAIGN_SELECT, { count: "exact" })
    .eq("tenant_id", context.tenantId);

  if (queryParams.search) {
    const search = sanitizePostgrestSearch(queryParams.search);
    if (search) {
      query = query.or(`name.ilike.%${search}%,subject_line.ilike.%${search}%`);
    }
  }

  query = applyFilters(query, filters, {
    entity: "campaign",
    timezone: context.timezone,
    allowedFields: [...CAMPAIGN_SORT_FIELDS, "id"],
  })
    .order(sortBy, { ascending: queryParams.sortOrder === "asc" })
    .range(from, to);

  const { data, error, count } = await query;
  if (error) {
    throw error;
  }

  const rows = (data ?? []) as CampaignRow[];
  const segmentNames = await loadCampaignSegmentNames(
    client,
    context.tenantId,
    rows,
  );
  const draftReviews = await loadDraftReviews(client, context.tenantId, rows);
  const rollups = await loadSharedCampaignRollups(
    client,
    rows.filter((row) => SENT_STATUSES.has(String(row.status))).map((row) => row.id),
  );
  const items = rows.map(
    (row) =>
      mapCampaign(
        row,
        segmentNames.get(row.id) ?? [],
        draftReviews.get(row.id) ?? null,
        rollups.get(row.id) ?? null,
      ) as JsonValue,
  );

  return createListResult({ entityLabel: "campaign", items, count });
};
