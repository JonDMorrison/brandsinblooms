/**
 * Unified Sender Resolution Module
 *
 * Milestone 2: Fallback sending is disabled.
 *
 * This resolver now requires an operational custom domain (status active|warming_up).
 * If none exists, it throws and the calling function must not send.
 */

import { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { resolveCampaignSenderDisplayName } from "./campaignFromHeader.ts";
import { resolveBusinessProfileUserId } from "./businessProfileUserId.ts";

export interface SenderConfig {
  fromEmail: string;
  // The tenant's real business name, or "" when none exists (never a
  // placeholder such as "Your Business"). With "", buildFromAddress sends
  // from the bare verified address.
  fromName: string;
  deliveryMethod: 'custom_domain';
  replyTo?: string;
  domainId?: string;
  domain?: string;
}

export interface SenderResolutionOptions {
  preferredDomainId?: string | null;
  userId?: string | null;
}

// Structural so the npm: client and test doubles are both accepted.
interface MaybeSingleQuery {
  eq(column: string, value: string): MaybeSingleQuery;
  limit(count: number): MaybeSingleQuery;
  maybeSingle(): PromiseLike<{ data: unknown; error: unknown }>;
}
export interface SenderNameClient {
  from(table: string): { select(columns: string): MaybeSingleQuery };
  rpc(fn: string, args?: Record<string, unknown>): unknown;
}

function stringField(row: unknown, key: string): string | null {
  if (!row || typeof row !== "object") return null;
  const value = (row as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

/**
 * The From display name for a tenant's automation and transactional email,
 * in the campaign order (_shared/campaignFromHeader.ts):
 * 1. the sending domain's default_from_name
 * 2. the tenant business profile's company_name (profile_user_id_for)
 * 3. tenants.name
 * 4. tenants.fallback_from_name
 * Placeholders ("Your Business", "Your Company", ...) count as unset at
 * every step. Returns "" when nothing real exists; callers then send from
 * the bare verified address rather than inventing a name.
 */
export async function resolveTenantSenderName(
  supabase: SenderNameClient | SupabaseClient,
  tenantId: string,
  domainFromName?: string | null,
): Promise<string> {
  const client = supabase as unknown as SenderNameClient;
  const fromDomain = resolveCampaignSenderDisplayName({
    domainFromName,
    finalFallback: "",
  });
  if (fromDomain) return fromDomain;

  let companyProfileName: string | null = null;
  let tenantName: string | null = null;
  let tenantFallbackFromName: string | null = null;

  try {
    const { data: member } = await client
      .from("users")
      .select("id")
      .eq("tenant_id", tenantId)
      .limit(1)
      .maybeSingle();
    const memberId = stringField(member, "id");
    if (memberId) {
      const profileUserId = await resolveBusinessProfileUserId(client, memberId);
      const { data: profile } = await client
        .from("company_profiles")
        .select("company_name")
        .eq("user_id", profileUserId)
        .limit(1)
        .maybeSingle();
      companyProfileName = stringField(profile, "company_name");
    }
  } catch (error) {
    console.warn(`[SenderResolver] Business profile lookup failed for tenant ${tenantId}:`, error);
  }

  try {
    const { data: tenant } = await client
      .from("tenants")
      .select("name, fallback_from_name")
      .eq("id", tenantId)
      .limit(1)
      .maybeSingle();
    tenantName = stringField(tenant, "name");
    tenantFallbackFromName = stringField(tenant, "fallback_from_name");
  } catch (error) {
    console.warn(`[SenderResolver] Tenant lookup failed for tenant ${tenantId}:`, error);
  }

  const name = resolveCampaignSenderDisplayName({
    companyProfileName,
    tenantName,
    tenantFallbackFromName,
    finalFallback: "",
  });
  if (!name) {
    console.warn(`[SenderResolver] No real business name for tenant ${tenantId}; sending from the bare address`);
  }
  return name;
}

/**
 * Resolves the sender configuration for a tenant.
 *
 * Priority order:
 * 1. Custom operational domain (from email_domains table)
 *
 * The display name follows resolveTenantSenderName (same order as campaigns).
 *
 * @param supabase - Supabase client instance
 * @param tenantId - The tenant ID to resolve sender for
 * @param options - Optional configuration like preferred domain ID or user ID
 * @returns SenderConfig with resolved email, display name, and delivery method
 */
export async function resolveSender(
  supabase: SupabaseClient,
  tenantId: string,
  options: SenderResolutionOptions = {}
): Promise<SenderConfig> {
  const { preferredDomainId, userId } = options;

  console.log(`[SenderResolver] Resolving sender for tenant: ${tenantId}, preferredDomainId: ${preferredDomainId || 'none'}`);

  // Valid statuses for sending emails (active or warming_up)
  const validStatuses = ['active', 'warming_up'];

  // Step 1: Check for preferred domain first (if specified)
  if (preferredDomainId) {
    const { data: domain, error: domainError } = await supabase
      .from('email_domains')
      .select('id, domain, status, default_from_email, default_from_name, default_reply_to, manual_pause, investigation_mode')
      .eq('id', preferredDomainId)
      .in('status', validStatuses)
      .eq('manual_pause', false)
      .eq('investigation_mode', false)
      .single();

    if (!domainError && domain) {
      console.log(`[SenderResolver] Using preferred custom domain: ${domain.domain} (status: ${domain.status})`);
      const fromEmail = domain.default_from_email || `mail@${domain.domain}`;
      return {
        fromEmail,
        fromName: await resolveTenantSenderName(supabase, tenantId, domain.default_from_name),
        deliveryMethod: 'custom_domain',
        // Reply-to: prefer explicit setting, fallback to sender email
        replyTo: domain.default_reply_to || fromEmail,
        domainId: domain.id,
        domain: domain.domain
      };
    }
    console.log(`[SenderResolver] Preferred domain not found or not in valid status, checking for any usable domain`);
  }

  // Step 2: Check for any usable custom domain for the tenant (active or warming_up)
  const { data: usableDomains, error: usableError } = await supabase
    .from('email_domains')
    .select('id, domain, status, default_from_email, default_from_name, default_reply_to, manual_pause, investigation_mode')
    .eq('tenant_id', tenantId)
    .in('status', validStatuses)
    .eq('manual_pause', false)
    .eq('investigation_mode', false)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!usableError && usableDomains && usableDomains.length > 0) {
    const domain = usableDomains[0];
    console.log(`[SenderResolver] Using custom domain: ${domain.domain} (status: ${domain.status})`);
    const fromEmail = domain.default_from_email || `mail@${domain.domain}`;
    return {
      fromEmail,
      fromName: await resolveTenantSenderName(supabase, tenantId, domain.default_from_name),
      deliveryMethod: 'custom_domain',
      // Reply-to: prefer explicit setting, fallback to sender email
      replyTo: domain.default_reply_to || fromEmail,
      domainId: domain.id,
      domain: domain.domain
    };
  }

  const companyNameHint = userId ? ` (user_id=${userId})` : '';
  throw new Error(`SENDER_DOMAIN_REQUIRED: No operational sending domain for tenant ${tenantId}${companyNameHint}`);
}

/**
 * Builds the "From" address string for email sending
 *
 * @param config - The sender configuration
 * @returns "Company Name <email@domain.com>", or the bare address when there
 *   is no real name
 */
export function buildFromAddress(config: SenderConfig): string {
  const name = resolveCampaignSenderDisplayName({
    domainFromName: config.fromName,
    finalFallback: "",
  });
  return name ? `${name} <${config.fromEmail}>` : config.fromEmail;
}

/**
 * Determines if the sender is using a verified custom domain
 *
 * @param config - The sender configuration
 * @returns true if using a custom domain
 */
export function isCustomDomain(config: SenderConfig): boolean {
  return config.deliveryMethod === 'custom_domain';
}

/**
 * Gets a suffix for the from name when using shared/platform senders
 * This helps recipients understand the email is being sent on behalf of a business
 *
 * @param config - The sender configuration
 * @param companyName - The company name to use
 * @returns Modified from name with appropriate suffix
 */
export function getFromNameWithSuffix(config: SenderConfig, companyName: string): string {
  // Always return just the company name without any suffix
  return companyName;
}
