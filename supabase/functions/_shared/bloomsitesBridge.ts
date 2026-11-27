// Read-only BloomSites bridge for newsletter assets.
//
// For a CRM tenant linked to a BloomSites site (the existing
// public.newsletter_storefront_connections link), returns the site's brand,
// products and upcoming events. Every BloomSites call is an HTTP GET:
//   - products come from the public catalogue at bloomsites.app
//     (/api/connected-content/catalog), which applies the storefront's own
//     visibility rules, enriched with stock, primary image and collection
//     membership read from BloomSites REST;
//   - brand and events are read from BloomSites REST with its publishable
//     (anon) key and the x-site-id header its public RLS requires.
// Nothing here can write to BloomSites. Tenant membership is checked with
// the caller's JWT (bloom_can_access_tenant) before anything is read.

export const BLOOMSITES_API_ORIGIN = "https://bloomsites.app";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX = /^#[0-9a-f]{3,8}$/i;

export class BloomSitesBridgeError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message = code,
  ) {
    super(message);
  }
}

type Result<T> = PromiseLike<{ data: T | null; error: unknown }>;

/** The caller's JWT-scoped CRM client (membership check). */
export interface BridgeUserClient {
  rpc(fn: "bloom_can_access_tenant", args: { p_tenant_id: string }): Result<unknown>;
}

interface ConnectionQuery {
  eq(column: string, value: string): ConnectionQuery;
  order(column: string, options: { ascending: boolean }): ConnectionQuery;
  limit(count: number): ConnectionQuery;
  maybeSingle(): Result<{ site_id: string; origin: string }>;
}

/** CRM service client: reads the link and the BloomSites public config. */
export interface BridgeServiceClient {
  from(table: "newsletter_storefront_connections"): { select(columns: string): ConnectionQuery };
  rpc(fn: "bloomsites_public_config"): Result<{ url?: string | null; anon_key?: string | null }>;
}

export interface BloomSitesBridgeDeps {
  userClient: BridgeUserClient;
  serviceClient: BridgeServiceClient;
  fetch?: typeof fetch;
  now?: () => Date;
}

export interface BloomSitesBrand {
  siteId: string;
  name: string | null;
  logoUrl: string | null;
  colors: Record<string, string>;
  fonts: {
    heading: string | null;
    body: string | null;
    headingWeight: string | null;
    bodyWeight: string | null;
    brandHeading: string | null;
    brandBody: string | null;
  };
}

export interface BloomSitesProduct {
  id: string;
  name: string;
  price: number | null;
  url: string;
  imageUrl: string | null;
  inStock: boolean | null;
}

export interface BloomSitesEvent {
  id: string;
  title: string;
  nextOccurrence: string;
  timezone: string | null;
  location: string | null;
  imageUrl: string | null;
  url: string;
}

export interface BloomSitesBridge {
  tenantId: string;
  siteId: string;
  origin: string;
  getBrand(): Promise<BloomSitesBrand>;
  getProducts(options?: { collection?: string; search?: string; limit?: number }): Promise<BloomSitesProduct[]>;
  getEvents(options?: { search?: string; limit?: number }): Promise<BloomSitesEvent[]>;
}

function https(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function clampLimit(value: unknown, fallback: number, max: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? Math.min(n, max) : fallback;
}

/** Keep a search or collection term to letters, digits, spaces and hyphens. */
function cleanTerm(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase().replace(/[^a-z0-9 -]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) : "";
}

function safeSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const segments = value.replace(/^\/+|\/+$/g, "").split("/");
  if (!segments.length || segments.some((s) => !s || s === "." || s === "..")) return null;
  return segments.map((s) => encodeURIComponent(s)).join("/");
}

/**
 * Check membership, resolve the tenant's linked site and its BloomSites
 * config. Throws BloomSitesBridgeError (400/403/404/503) when it cannot.
 */
export async function openBloomSitesBridge(
  tenantId: string,
  deps: BloomSitesBridgeDeps,
): Promise<BloomSitesBridge> {
  if (!UUID.test(tenantId)) throw new BloomSitesBridgeError("invalid_tenant", 400);

  // Membership first: nothing is read for a caller outside the tenant.
  const access = await deps.userClient.rpc("bloom_can_access_tenant", { p_tenant_id: tenantId });
  if (access.error || access.data !== true) {
    throw new BloomSitesBridgeError("tenant_membership_required", 403);
  }

  const link = await deps.serviceClient
    .from("newsletter_storefront_connections")
    .select("site_id, origin")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const siteId = link.data?.site_id ?? "";
  const origin = https(link.data?.origin)?.replace(/\/+$/, "") ?? null;
  if (link.error || !UUID.test(siteId) || !origin) {
    throw new BloomSitesBridgeError("site_not_linked", 404);
  }

  const config = await deps.serviceClient.rpc("bloomsites_public_config");
  const restUrl = https(config.data?.url)?.replace(/\/+$/, "") ?? null;
  const anonKey = text(config.data?.anon_key);
  if (config.error || !restUrl || !anonKey) {
    throw new BloomSitesBridgeError("bloomsites_not_configured", 503);
  }

  const doFetch = deps.fetch ?? fetch;
  const now = deps.now ?? (() => new Date());

  async function getJson(url: string, headers: Record<string, string>): Promise<unknown> {
    const response = await doFetch(url, {
      method: "GET",
      headers: { Accept: "application/json", ...headers },
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new BloomSitesBridgeError("bloomsites_unavailable", 502);
    return await response.json();
  }

  /** GET one BloomSites REST table, gated to this site by x-site-id. */
  async function rest(table: string, params: Record<string, string>): Promise<Record<string, unknown>[]> {
    const query = new URLSearchParams(params);
    const rows = await getJson(`${restUrl}/rest/v1/${table}?${query}`, {
      apikey: anonKey!,
      Authorization: `Bearer ${anonKey}`,
      "x-site-id": siteId,
    });
    return Array.isArray(rows) ? rows.map(record) : [];
  }

  async function catalog(params: Record<string, string>): Promise<Record<string, unknown>[]> {
    const url = new URL(`${BLOOMSITES_API_ORIGIN}/api/connected-content/catalog`);
    url.searchParams.set("siteId", siteId);
    url.searchParams.set("type", "products");
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const payload = record(await getJson(url.toString(), {}));
    if (payload.siteId !== siteId || !Array.isArray(payload.items)) return [];
    return payload.items.map(record).filter((item) => item.siteId === siteId && item.type === "product");
  }

  const inList = (ids: string[]) => `in.(${ids.join(",")})`;

  return {
    tenantId,
    siteId,
    origin,

    async getBrand() {
      const [site] = await rest("sites", {
        select: "id,name,logo_url,logo_cdn_url,theme_settings",
        id: `eq.${siteId}`,
        deleted_at: "is.null",
        limit: "1",
      });
      if (!site || site.id !== siteId) throw new BloomSitesBridgeError("site_not_published", 404);
      const theme = record(site.theme_settings);
      const colors: Record<string, string> = {};
      for (const [key, value] of Object.entries(record(theme.colors))) {
        if (typeof value === "string" && HEX.test(value)) colors[key] = value.toUpperCase();
      }
      const typography = record(theme.typography);
      const brandTypography = record(record(theme.brandGuide).typography);
      return {
        siteId,
        name: text(site.name),
        logoUrl: https(site.logo_cdn_url) ?? https(site.logo_url) ?? https(record(theme.logo).url),
        colors,
        fonts: {
          heading: text(typography.headingFont),
          body: text(typography.bodyFont),
          headingWeight: text(typography.headingWeight),
          bodyWeight: text(typography.bodyWeight),
          brandHeading: text(brandTypography.brandHeading),
          brandBody: text(brandTypography.brandBody),
        },
      };
    },

    async getProducts(options = {}) {
      const limit = clampLimit(options.limit, 12, 24);
      const search = cleanTerm(options.search);
      const collection = cleanTerm(options.collection);
      let items: Record<string, unknown>[];

      if (collection) {
        const slug = collection.replace(/\s+/g, "-");
        const [found] = await rest("product_collections", {
          select: "id,slug,name",
          site_id: `eq.${siteId}`,
          status: "eq.active",
          or: `(slug.eq.${slug},name.ilike."${collection}")`,
          limit: "1",
        });
        const collectionId = typeof found?.id === "string" ? found.id : "";
        if (!UUID.test(collectionId)) return [];
        const members = await rest("product_collection_products", {
          select: "product_id,sort_order",
          collection_id: `eq.${collectionId}`,
          order: "sort_order.asc",
          limit: String(limit * 3),
        });
        const ids = members.map((m) => m.product_id).filter((id): id is string => typeof id === "string" && UUID.test(id));
        // Each product passes the storefront's visibility rules on its own.
        const results = await Promise.all(ids.map((itemId) => catalog({ itemId, limit: "1" })));
        items = results.flat();
        if (search) {
          items = items.filter((item) => `${item.title ?? ""} ${item.description ?? ""}`.toLowerCase().includes(search));
        }
      } else {
        items = await catalog({ limit: String(Math.min(50, limit)), ...(search ? { q: search } : {}) });
      }
      items = items.slice(0, limit);

      const ids = items.map((item) => item.id).filter((id): id is string => typeof id === "string" && UUID.test(id));
      if (!ids.length) return [];
      const [stockRows, imageRows] = await Promise.all([
        rest("products", { select: "id,in_stock", id: inList(ids) }),
        rest("product_images", {
          select: "product_id,url,cdn_url,is_primary,position",
          product_id: inList(ids),
          order: "is_primary.desc,position.asc",
        }),
      ]);
      const stock = new Map(stockRows.map((row) => [row.id, typeof row.in_stock === "boolean" ? row.in_stock : null]));
      const primary = new Map<unknown, string>();
      for (const row of imageRows) {
        const image = https(row.cdn_url) ?? https(row.url);
        if (image && !primary.has(row.product_id)) primary.set(row.product_id, image);
      }

      const products: BloomSitesProduct[] = [];
      for (const item of items) {
        const id = item.id as string;
        const url = https(item.publicUrl);
        const name = text(item.title);
        if (!UUID.test(id) || !url || !name) continue;
        products.push({
          id,
          name,
          price: typeof item.price === "number" ? item.price : null,
          url,
          imageUrl: primary.get(id) ?? https(item.imageUrl),
          inStock: stock.get(id) ?? null,
        });
      }
      return products;
    },

    async getEvents(options = {}) {
      const limit = clampLimit(options.limit, 6, 24);
      const search = cleanTerm(options.search);
      const nowMs = now().getTime();
      const events = await rest("events", {
        select: "id,title,slug,start_datetime,location,venue_name,timezone",
        site_id: `eq.${siteId}`,
        status: "eq.published",
        deleted_at: "is.null",
        order: "start_datetime.asc",
        limit: "120",
      });
      const ids = events.map((e) => e.id).filter((id): id is string => typeof id === "string" && UUID.test(id));
      if (!ids.length) return [];
      const [occurrences, media] = await Promise.all([
        rest("event_occurrences", {
          select: "event_id,start_datetime,location",
          event_id: inList(ids),
          deleted_at: "is.null",
          order: "start_datetime.asc",
        }),
        rest("event_media", {
          select: "event_id,media_url,sort_order",
          event_id: inList(ids),
          media_type: "eq.image",
          deleted_at: "is.null",
          order: "sort_order.asc",
        }),
      ]);
      const hasOccurrences = new Set(occurrences.map((o) => o.event_id));
      const next = new Map<unknown, Record<string, unknown>>();
      for (const occurrence of occurrences) {
        const start = Date.parse(String(occurrence.start_datetime));
        if (Number.isFinite(start) && start > nowMs && !next.has(occurrence.event_id)) {
          next.set(occurrence.event_id, occurrence);
        }
      }
      const images = new Map<unknown, string>();
      for (const row of media) {
        const image = https(row.media_url);
        if (image && !images.has(row.event_id)) images.set(row.event_id, image);
      }

      const upcoming: BloomSitesEvent[] = [];
      for (const event of events) {
        const id = event.id as string;
        const title = text(event.title);
        const slug = safeSlug(event.slug);
        if (!UUID.test(id) || !title || !slug) continue;
        if (search && !title.toLowerCase().includes(search)) continue;
        // An event with dates uses its next future date; one without dates
        // uses its own start. Past dates never count.
        const occurrence = next.get(id);
        const start = occurrence
          ? String(occurrence.start_datetime)
          : hasOccurrences.has(id) ? null : text(event.start_datetime);
        if (!start || !(Date.parse(start) > nowMs)) continue;
        upcoming.push({
          id,
          title,
          nextOccurrence: new Date(start).toISOString(),
          timezone: text(event.timezone),
          location: text(occurrence?.location) ?? text(event.location) ?? text(event.venue_name),
          imageUrl: images.get(id) ?? null,
          url: `${origin}/events/${slug}`,
        });
      }
      upcoming.sort((a, b) => Date.parse(a.nextOccurrence) - Date.parse(b.nextOccurrence));
      return upcoming.slice(0, limit);
    },
  };
}
