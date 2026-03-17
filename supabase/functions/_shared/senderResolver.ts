/**
 * Unified Sender Resolution Module
 *
 * Milestone 2: Fallback sending is disabled.
 *
 * This resolver now requires an operational custom domain (status active|warming_up).
 * If none exists, it throws and the calling function must not send.
 */

import { SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface SenderConfig {
  fromEmail: string;
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

/**
 * Resolves the sender configuration for a tenant.
 *
 * Priority order:
 * 1. Custom operational domain (from email_domains table)
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
        fromName: domain.default_from_name || 'Your Business',
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
      fromName: domain.default_from_name || 'Your Business',
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
 * @returns Formatted from address string like "Company Name <email@domain.com>"
 */
export function buildFromAddress(config: SenderConfig): string {
  return `${config.fromName} <${config.fromEmail}>`;
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
