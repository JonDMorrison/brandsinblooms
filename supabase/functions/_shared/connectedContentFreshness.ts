/** Server-side publication checks shared by email and SMS dispatchers. */
type Source = {
  siteId: string;
  itemId: string;
  type: "event" | "page" | "product" | "blog" | "fundraiser";
  updatedAt: string;
  publicUrl: string;
  startAt?: unknown;
  sourceTitle?: unknown;
  sourceDescription?: unknown;
  sourceImageUrl?: unknown;
  upcomingDateCount?: unknown;
};
export type ContentFreshnessResult = {
  decision: "fresh" | "review_required" | "retry";
  reason: string | null;
};
interface ConnectionQuery extends PromiseLike<{ data: unknown; error: unknown }> {
  eq(column: string, value: string): ConnectionQuery;
  in(column: string, values: string[]): ConnectionQuery;
}
interface ConnectionClient {
  from(table: "crm_connected_websites"): {
    select(columns: string): ConnectionQuery;
  };
}
const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const kinds = { event: "events", page: "pages", product: "products", blog: "blogs", fundraiser: "fundraisers" };
const fresh: ContentFreshnessResult = { decision: "fresh", reason: null };
const review = (reason: string): ContentFreshnessResult => ({ decision: "review_required", reason });
const retry = (): ContentFreshnessResult => ({ decision: "retry", reason: "Website content could not be checked. Delivery will retry before sending." });
function secureUrl(value: unknown): URL | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url : null;
  } catch { return null; }
}
function source(value: unknown): Source | null {
  const row = record(value);
  if (!row || typeof row.siteId !== "string" || !uuid.test(row.siteId) ||
      typeof row.itemId !== "string" || !uuid.test(row.itemId) ||
      typeof row.type !== "string" || !Object.hasOwn(kinds, row.type) ||
      typeof row.updatedAt !== "string" || !Number.isFinite(Date.parse(row.updatedAt)) ||
      !secureUrl(row.publicUrl)) return null;
  return row as Source;
}

/** Hidden email blocks are not promoted. Malformed manifests remain blockers. */
export function extractConnectedContentSources(metadata: unknown): unknown[] {
  const value = record(metadata);
  if (!value) return [];
  const sources: unknown[] = [];
  if (value.connectedContentSources !== undefined) {
    sources.push(...(Array.isArray(value.connectedContentSources)
      ? value.connectedContentSources : [null]));
  }
  if (Array.isArray(value.contentBlocks)) {
    for (const block of value.contentBlocks) {
      const item = record(block);
      if (item && item.visible !== false && item.connectedContent !== undefined) {
        sources.push(item.connectedContent);
      }
    }
  }
  return sources;
}

export async function checkConnectedContentFreshness(
  db: ConnectionClient,
  tenantId: string,
  sources: unknown[],
  fetcher: typeof fetch = fetch,
): Promise<ContentFreshnessResult> {
  if (sources.length === 0) return fresh;
  if (sources.length > 50 || !uuid.test(tenantId)) {
    return review("Linked website content needs review before delivery.");
  }
  const parsed = sources.map(source);
  if (parsed.some(item => !item)) return review("A linked content reference is incomplete. Reinsert it from Connected Content before sending.");
  const valid = parsed.filter((item): item is Source => item !== null);
  const siteIds = [...new Set(valid.map(item => item.siteId))];
  try {
    const { data, error } = await db.from("crm_connected_websites")
      .select("cms_site_id").eq("tenant_id", tenantId).eq("status", "active")
      .in("cms_site_id", siteIds);
    if (error || !Array.isArray(data)) return retry();
    const connected = new Set(data.map(row => record(row)?.cms_site_id));
    if (siteIds.some(id => !connected.has(id))) return review("A promoted website is no longer connected to this business.");
  } catch { return retry(); }

  async function check(item: Source): Promise<ContentFreshnessResult> {
    // Never fetch a URL from campaign metadata or a merchant's custom domain.
    const endpoint = new URL("https://bloomsites.app/api/connected-content/catalog");
    endpoint.searchParams.set("siteId", item.siteId);
    endpoint.searchParams.set("type", kinds[item.type]);
    endpoint.searchParams.set("itemId", item.itemId);
    endpoint.searchParams.set("limit", "1");
    try {
      const response = await fetcher(endpoint, {
        headers: { Accept: "application/json", "Cache-Control": "no-cache" },
        cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
      });
      if (response.status === 404 || response.status === 409) {
        return review("Promoted website content is no longer publicly available.");
      }
      if (!response.ok) return retry();
      const payload = record(await response.json());
      const origin = secureUrl(payload?.siteOrigin);
      if (!payload || payload.siteId !== item.siteId || !origin || !Array.isArray(payload.items)) return retry();
      if (payload.items.length === 0) return review("Promoted content is no longer published or available. Review the campaign before sending.");
      if (payload.items.length !== 1) return retry();
      const current = record(payload.items[0]);
      if (!current || current.id !== item.itemId || current.siteId !== item.siteId ||
          current.type !== item.type || secureUrl(current.publicUrl)?.origin !== origin.origin) return retry();
      if (item.type === "event") {
        if (current.eventStatus === "cancelled" || current.eventStatus === "sold_out") {
          return review("A promoted event is cancelled or sold out. Review the campaign before sending.");
        }
        if (current.eventStatus !== "available") return retry();
        if (item.startAt === undefined) return review("A promoted event has no saved date reference. Reinsert it before sending.");
      }
      if (current.updatedAt !== item.updatedAt || current.publicUrl !== item.publicUrl ||
          (item.startAt !== undefined && (current.startAt ?? null) !== item.startAt) ||
          (item.sourceTitle !== undefined && current.title !== item.sourceTitle) ||
          (item.sourceDescription !== undefined && current.description !== item.sourceDescription) ||
          (item.sourceImageUrl !== undefined && current.imageUrl !== item.sourceImageUrl) ||
          (item.upcomingDateCount !== undefined && current.upcomingDateCount !== item.upcomingDateCount)) {
        return review("Promoted website details changed. Review and refresh the linked content before sending.");
      }
      return fresh;
    } catch { return retry(); }
  }
  // Bounded concurrency; identical snapshots need only one publication lookup.
  const unique = [...new Map(valid.map(item => [JSON.stringify(item), item])).values()];
  for (let offset = 0; offset < unique.length; offset += 5) {
    const results = await Promise.all(unique.slice(offset, offset + 5).map(check));
    const blocked = results.find(result => result.decision === "review_required") ??
      results.find(result => result.decision === "retry");
    if (blocked) return blocked;
  }
  return fresh;
}

/** A pre-provider hold is distinct from an uncertain provider response. */
export class ContentFreshnessHold extends Error {
  readonly decision: "review_required" | "retry";
  constructor(decision: "review_required" | "retry", reason: string) {
    super(`${decision === "retry" ? "CONTENT_CHECK_RETRY" : "CONTENT_REVIEW_REQUIRED"}: ${reason}`);
    this.decision = decision;
  }
}

export function emailContentSources(saved: unknown, rendered: unknown[] | null): unknown[] {
  if (saved === null || saved === undefined) {
    if (rendered === null) throw new ContentFreshnessHold("retry", "Legacy campaign sources could not be checked.");
    if (rendered.length) throw new ContentFreshnessHold("review_required", "This older queued email has no saved website version. Create a reviewed draft before sending.");
    return [];
  }
  if (!Array.isArray(saved)) throw new ContentFreshnessHold("review_required", "The queued website reference is invalid.");
  if (rendered !== null && JSON.stringify(saved) !== JSON.stringify(rendered)) {
    throw new ContentFreshnessHold("review_required", "The email source changed after recipients were queued. Create a reviewed draft before sending.");
  }
  return saved;
}

export function uniqueContentSources(sources: unknown[]): unknown[] {
  return [...new Map(sources.map(source => [JSON.stringify(source), source])).values()];
}
