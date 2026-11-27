// From-header display name for tenant email sent by edge functions
// (automations, sender resolution). Same sources as campaigns and the
// dashboard sender settings: the sending domain's default_from_name, then
// the business profile (company_profiles.company_name), then tenants.name,
// then tenants.fallback_from_name. Placeholder names ("Your Business",
// "Your Company", ...) count as unset, so one is never emitted. "" means
// nothing real is configured: send with the bare address, never a
// placeholder.

import { realBusinessName } from "../../../src/lib/studio/businessPlaceholders.ts";
import { resolveBusinessProfileUserId } from "./businessProfileUserId.ts";

export interface SenderDisplayNameSources {
  domainFromName?: string | null;
  companyProfileName?: string | null;
  tenantName?: string | null;
  tenantFallbackFromName?: string | null;
}

/** The first real name from the sources, or "" when none is set. */
export function pickSenderDisplayName(sources: SenderDisplayNameSources): string {
  return (
    realBusinessName(sources.domainFromName) ||
    realBusinessName(sources.companyProfileName) ||
    realBusinessName(sources.tenantName) ||
    realBusinessName(sources.tenantFallbackFromName)
  );
}

type QueryResult = PromiseLike<{ data: unknown; error: unknown }>;

interface FilterChain {
  eq(column: string, value: string): FilterChain;
  limit(count: number): FilterChain;
  maybeSingle(): QueryResult;
}

// Structural so npm:, jsr: and esm.sh Supabase clients are all accepted.
// The builder is typed as unknown here (matching the generic Postgrest
// builder structurally is too deep for tsc) and narrowed in select().
export interface SenderNameClient {
  from(table: string): { select(columns: string): unknown };
  rpc(fn: string, args?: Record<string, unknown>): unknown;
}

function select(supabase: SenderNameClient, table: string, columns: string): FilterChain {
  return supabase.from(table).select(columns) as FilterChain;
}

function stringField(row: unknown, key: string): string | null {
  if (!row || typeof row !== "object") return null;
  const value = (row as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

async function readRow(query: QueryResult): Promise<unknown> {
  try {
    const { data, error } = await query;
    return error ? null : data;
  } catch {
    return null;
  }
}

/** company_profiles.company_name for the tenant's business, or null. */
async function lookupTenantProfileName(
  supabase: SenderNameClient,
  tenantId: string,
): Promise<string | null> {
  const member = await readRow(
    select(supabase, "users", "id").eq("tenant_id", tenantId).limit(1).maybeSingle(),
  );
  const memberId = stringField(member, "id");
  if (!memberId) return null;

  const profileUserId = await resolveBusinessProfileUserId(supabase, memberId);
  const profile = await readRow(
    select(supabase, "company_profiles", "company_name").eq("user_id", profileUserId).maybeSingle(),
  );
  return stringField(profile, "company_name");
}

export interface ResolveTenantSenderNameOptions {
  domainFromName?: string | null;
  // Pass when the caller already loaded the business profile, to skip the
  // lookup. undefined means "not loaded"; null means "loaded, none".
  companyProfileName?: string | null;
}

/**
 * The From display name for `tenantId`. Reads only what it needs: a real
 * domain default returns without a query. Lookup failures fall through to
 * the next source; the result is a real name or "".
 */
export async function resolveTenantSenderName(
  supabase: SenderNameClient,
  tenantId: string,
  options: ResolveTenantSenderNameOptions = {},
): Promise<string> {
  const fromDomain = realBusinessName(options.domainFromName);
  if (fromDomain) return fromDomain;

  const profileName = options.companyProfileName !== undefined
    ? options.companyProfileName
    : tenantId
    ? await lookupTenantProfileName(supabase, tenantId)
    : null;
  const fromProfile = realBusinessName(profileName);
  if (fromProfile || !tenantId) return fromProfile;

  const tenant = await readRow(
    select(supabase, "tenants", "name, fallback_from_name").eq("id", tenantId).maybeSingle(),
  );
  return pickSenderDisplayName({
    tenantName: stringField(tenant, "name"),
    tenantFallbackFromName: stringField(tenant, "fallback_from_name"),
  });
}

/** "Name <email>", or the bare address when there is no real name. */
export function formatFromAddress(fromName: string | null | undefined, fromEmail: string): string {
  const name = realBusinessName(fromName).replace(/[<>"\r\n]/g, "").trim();
  return name ? `${name} <${fromEmail}>` : fromEmail;
}
