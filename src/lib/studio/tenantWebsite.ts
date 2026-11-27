// The website a tenant's email footer links to.
//
// One resolver for every renderer: the Studio canvas and campaign editor
// preview (via useCompanyInfo → design system) and the server send, test and
// preview paths (supabase/functions/*, which import this file directly).
// Relative, extension-bearing imports only, so Deno can load it.
//
// The website is the tenant's own, first non-empty of:
//   1. tenants.settings (website / website_url / websiteUrl /
//      company_website / companyWebsite), then tenants.website
//   2. the tenant's business profile, as saved by Contact & Footer settings
//      (company_profiles.website_url, then
//      company_profiles.feature_flags.footer_settings.websiteUrl)
//   3. the linked BloomSites site: a verified custom domain (public.domains)
//      first, then the active connected site's public origin
//      (crm_connected_websites.site_origin)
// A platform address (getclear.ca, bloomsuite.*, ...) is never a tenant's
// website and is skipped at every step. An operator domain that is also one
// tenant's real website (brandsinblooms.com) is that tenant's only: the
// resolver skips it for every other tenant. With no website the footer shows
// no website link: there is no default.
import { pickVerifiedSiteDomain, type SiteDomainRow } from "../siteDomain.ts";

/**
 * Domains that belong to the platform or its operators. Any host equal to
 * one of these or under it is rejected.
 */
export const PLATFORM_WEBSITE_DOMAINS: readonly string[] = [
  "getclear.ca",
  "bloomsuite.app",
  "bloomsuite.com",
  "bloomsuite.io",
  "supabase.co",
  "supabase.in",
];

/** The Brands in Blooms tenant, whose own website is brandsinblooms.com. */
export const BRANDS_IN_BLOOMS_TENANT_ID = "0a626809-3f46-45d8-b325-55de9c4ba576";

/**
 * Operator domains that are one tenant's real website. The resolver accepts
 * one only for its owning tenant, so another tenant's footer never links to
 * it (a master admin's profile or a copied draft carried it into clients'
 * emails). Downstream renderers receive the resolver's output, so they
 * accept these hosts.
 */
export const TENANT_RESERVED_WEBSITE_DOMAINS: Readonly<Record<string, string>> = {
  "brandsinblooms.com": BRANDS_IN_BLOOMS_TENANT_ID,
};

/**
 * BloomSites serves each tenant's site at {subdomain}.bloomsites.app, which is
 * the tenant's own website. Only the platform's own hosts there are rejected.
 */
const BLOOMSITES_ROOT = "bloomsites.app";
const BLOOMSITES_PLATFORM_HOSTS = new Set([
  BLOOMSITES_ROOT,
  `www.${BLOOMSITES_ROOT}`,
  `app.${BLOOMSITES_ROOT}`,
  `api.${BLOOMSITES_ROOT}`,
]);

const TENANT_SETTINGS_WEBSITE_KEYS = [
  "website",
  "website_url",
  "websiteUrl",
  "company_website",
  "companyWebsite",
] as const;

function parseWebsite(value: unknown): URL | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    ? trimmed
    : `https://${trimmed.replace(/^\/+/, "")}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.toLowerCase();
    // A real public host: at least one dot, not an IP literal.
    if (!host.includes(".") || /^[\d.]+$/.test(host) || host.startsWith("[")) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

/** True when the address is on a platform domain, never a tenant's website. */
export function isPlatformWebsite(value: unknown): boolean {
  const url = parseWebsite(value);
  if (!url) return false;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (BLOOMSITES_PLATFORM_HOSTS.has(host)) return true;
  return PLATFORM_WEBSITE_DOMAINS.some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  );
}

/**
 * True when the address is on an operator domain reserved for a tenant other
 * than tenantId (or when tenantId is unknown, so ownership can't be shown).
 */
export function isWebsiteReservedForAnotherTenant(
  value: unknown,
  tenantId: string | null | undefined,
): boolean {
  const url = parseWebsite(value);
  if (!url) return false;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const owner = Object.entries(TENANT_RESERVED_WEBSITE_DOMAINS).find(
    ([domain]) => host === domain || host.endsWith(`.${domain}`),
  )?.[1];
  if (!owner) return false;
  return !tenantId || tenantId.toLowerCase() !== owner;
}

/**
 * A usable tenant website as an absolute http(s) URL ("northfield.ca" →
 * "https://northfield.ca"), or "" when the value is empty, malformed or a
 * platform address.
 */
export function normalizeTenantWebsite(value: unknown): string {
  const url = parseWebsite(value);
  if (!url || isPlatformWebsite(url.href)) return "";
  const raw = typeof value === "string" ? value.trim() : "";
  // Keep what the tenant typed when it already had a scheme; otherwise the
  // https form. A bare origin is written without a trailing slash.
  if (/^https?:\/\//i.test(raw)) return raw;
  return url.pathname === "/" && !url.search && !url.hash
    ? url.origin
    : url.href;
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export interface TenantWebsiteTenantFacts {
  website?: string | null;
  settings?: unknown;
}

export interface TenantWebsiteProfileFacts {
  website_url?: string | null;
  feature_flags?: unknown;
}

export interface TenantWebsiteSiteFacts {
  /** public.domains rows for the tenant (BloomSites custom domains). */
  domains?: ReadonlyArray<SiteDomainRow> | null;
  /** Active crm_connected_websites.site_origin values, newest link first. */
  connectedSiteOrigins?: ReadonlyArray<string | null | undefined> | null;
}

export interface TenantWebsiteSources {
  /** The tenant being resolved; needed to accept its reserved domain. */
  tenantId?: string | null;
  tenant?: TenantWebsiteTenantFacts | null;
  profile?: TenantWebsiteProfileFacts | null;
  site?: TenantWebsiteSiteFacts | null;
}

/** Every candidate in priority order (raw values, before validation). */
export function tenantWebsiteCandidates(sources: TenantWebsiteSources): unknown[] {
  const settings = recordValue(sources.tenant?.settings);
  const footerSettings = recordValue(
    recordValue(sources.profile?.feature_flags)?.footer_settings,
  );
  const verifiedDomain = pickVerifiedSiteDomain(sources.site?.domains ?? []);
  return [
    ...TENANT_SETTINGS_WEBSITE_KEYS.map((key) => settings?.[key]),
    sources.tenant?.website,
    sources.profile?.website_url,
    footerSettings?.websiteUrl,
    verifiedDomain,
    ...(sources.site?.connectedSiteOrigins ?? []),
  ];
}

/**
 * The tenant's footer website: the first usable candidate, or "" when the
 * tenant has none (the footer then shows no website link).
 */
export function resolveTenantWebsite(sources: TenantWebsiteSources): string {
  for (const candidate of tenantWebsiteCandidates(sources)) {
    if (isWebsiteReservedForAnotherTenant(candidate, sources.tenantId)) continue;
    const website = normalizeTenantWebsite(candidate);
    if (website) return website;
  }
  return "";
}

// ---------------------------------------------------------------------------
// Loading the tenant and BloomSites facts. Structural client so the browser
// client and the edge functions' clients (npm:, jsr:, esm.sh) all fit.

interface QueryResult {
  data?: unknown;
  error?: unknown;
}

interface FilterBuilder extends PromiseLike<QueryResult> {
  eq(column: string, value: string): FilterBuilder;
  order(column: string, options?: { ascending?: boolean }): FilterBuilder;
  maybeSingle(): PromiseLike<QueryResult>;
}

export interface TenantWebsiteClient {
  from: (table: string) => { select: (columns: string) => unknown };
}

function select(
  client: TenantWebsiteClient,
  table: string,
  columns: string,
): FilterBuilder {
  return client.from(table).select(columns) as FilterBuilder;
}

function rows(result: QueryResult): Record<string, unknown>[] {
  if (result.error || !Array.isArray(result.data)) return [];
  return result.data.filter(
    (row): row is Record<string, unknown> => !!row && typeof row === "object",
  );
}

function text(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

async function settle<T>(work: () => PromiseLike<T>, fallback: T): Promise<T> {
  try {
    return await work();
  } catch {
    return fallback;
  }
}

/**
 * Reads tenants.website/settings, the tenant's BloomSites custom domains and
 * its active connected website. Best effort: a failed read contributes
 * nothing (never another tenant's or a platform value).
 */
export async function loadTenantWebsiteFacts(
  client: TenantWebsiteClient,
  tenantId: string | null | undefined,
): Promise<{ tenant: TenantWebsiteTenantFacts | null; site: TenantWebsiteSiteFacts }> {
  if (!tenantId) return { tenant: null, site: {} };
  const empty: QueryResult = { data: null, error: null };
  const [tenantResult, domainResult, connectedResult] = await Promise.all([
    settle(
      () => select(client, "tenants", "website, settings").eq("id", tenantId).maybeSingle(),
      empty,
    ),
    settle(
      () =>
        select(client, "domains", "domain, type, status, verified_at, is_primary")
          .eq("tenant_id", tenantId)
          .eq("type", "custom"),
      empty,
    ),
    settle(
      () =>
        select(client, "crm_connected_websites", "site_origin, linked_at")
          .eq("tenant_id", tenantId)
          .eq("status", "active")
          .order("linked_at", { ascending: false }),
      empty,
    ),
  ]);

  const tenantRow = tenantResult.error ? null : recordValue(tenantResult.data);
  const domains: SiteDomainRow[] = rows(domainResult)
    .filter((row) => typeof row.domain === "string")
    .map((row) => ({
      domain: row.domain as string,
      type: text(row.type),
      status: text(row.status),
      verified_at: text(row.verified_at),
      is_primary: typeof row.is_primary === "boolean" ? row.is_primary : null,
    }));
  return {
    tenant: tenantRow
      ? { website: text(tenantRow.website), settings: tenantRow.settings }
      : null,
    site: {
      domains,
      connectedSiteOrigins: rows(connectedResult).map((row) => text(row.site_origin)),
    },
  };
}

/** Load the tenant facts and resolve the website with the given profile. */
export async function loadTenantWebsite(
  client: TenantWebsiteClient,
  tenantId: string | null | undefined,
  profile: TenantWebsiteProfileFacts | null | undefined,
): Promise<string> {
  const { tenant, site } = await loadTenantWebsiteFacts(client, tenantId);
  return resolveTenantWebsite({ tenantId, tenant, profile: profile ?? null, site });
}

/**
 * The business profile with website_url set to the resolved tenant website
 * (null when there is none), so the footer, the design system and the
 * {{company.website}} merge tag all read the same value. A tenant without a
 * profile row but with a website gets a profile carrying only that website.
 */
export function withTenantWebsite<T extends { website_url?: string | null }>(
  profile: T | null | undefined,
  website: string,
): Partial<T> | null {
  if (!profile) {
    if (!website) return null;
    const websiteOnly: Partial<T> = {};
    return Object.assign(websiteOnly, { website_url: website });
  }
  return { ...profile, website_url: website || null };
}

/**
 * Server send/test/preview paths: the tenant's business profile row with its
 * footer website resolved (loadTenantWebsite + withTenantWebsite).
 */
export async function profileWithTenantWebsite<
  T extends TenantWebsiteProfileFacts & { website_url?: string | null },
>(
  client: TenantWebsiteClient,
  tenantId: string | null | undefined,
  profile: T | null | undefined,
): Promise<Partial<T> | null> {
  const website = await loadTenantWebsite(client, tenantId, profile);
  return withTenantWebsite(profile, website);
}
