/**
 * Unified Sender Resolution Module
 * 
 * This module provides a consistent way to resolve the sender email address
 * for all email-sending edge functions. It implements a three-tier priority system:
 * 
 * 1. Custom Domain (Priority 1): If the tenant has a verified custom domain, use it
 * 2. Platform Email (Priority 2): If no custom domain, use the tenant's fallback platform email
 * 3. Generic Platform (Priority 3): Last resort - use the generic BloomSuite sender
 */

import { SupabaseClient } from "npm:@supabase/supabase-js@2.7.1";

export interface SenderConfig {
  fromEmail: string;
  fromName: string;
  deliveryMethod: 'custom_domain' | 'tenant_platform' | 'generic_platform';
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
 * 1. Custom verified domain (from email_domains table)
 * 2. Tenant's platform fallback email (from tenants table)
 * 3. Generic BloomSuite sender (noreply@bloomsuite.app)
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
      .select('id, domain, status, default_from_email, default_from_name, default_reply_to')
      .eq('id', preferredDomainId)
      .in('status', validStatuses)
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
    .select('id, domain, status, default_from_email, default_from_name, default_reply_to')
    .eq('tenant_id', tenantId)
    .in('status', validStatuses)
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

  // Step 3: Check tenant for fallback platform email
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('fallback_sender_email, fallback_from_name, name')
    .eq('id', tenantId)
    .single();

  if (!tenantError && tenant?.fallback_sender_email) {
    console.log(`[SenderResolver] Using tenant platform email: ${tenant.fallback_sender_email}`);
    return {
      fromEmail: tenant.fallback_sender_email,
      fromName: tenant.fallback_from_name || tenant.name || 'BloomSuite',
      deliveryMethod: 'tenant_platform'
    };
  }

  // Step 4: If we have a userId, try to get company name from company_profiles
  let companyName = 'BloomSuite';
  if (userId) {
    const { data: profile } = await supabase
      .from('company_profiles')
      .select('company_name')
      .eq('user_id', userId)
      .single();
    
    if (profile?.company_name) {
      companyName = profile.company_name;
    }
  }

  // Step 5: Last resort - generic platform sender
  console.log(`[SenderResolver] Using generic platform sender: noreply@bloomsuite.app`);
  return {
    fromEmail: 'noreply@bloomsuite.app',
    fromName: companyName,
    deliveryMethod: 'generic_platform'
  };
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
