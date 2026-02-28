// Email Domain Provisioning Service - Handles Entri + Resend integration
import { supabase } from '@/integrations/supabase/client';
import type { EmailDomain } from './domainService';

export interface EntriCallbackParams {
  accountId: string;
  domain: string;
  entriConnectionId: string;
  entriProvider: string;
}

export interface ProvisioningResult {
  success: boolean;
  data?: EmailDomain;
  error?: string;
}

/**
 * Ensure a Resend domain exists for the given email domain
 * If resend_domain_id is null, creates one via the edge function
 */
export async function ensureResendDomainForEmailDomain(
  emailDomainId: string
): Promise<ProvisioningResult> {
  try {
    // Fetch the current domain record
    const { data: domain, error: fetchError } = await supabase
      .from('email_domains')
      .select('*')
      .eq('id', emailDomainId)
      .single();

    if (fetchError || !domain) {
      return { success: false, error: 'Domain not found' };
    }

    // If already has a Resend domain ID, just return success
    if (domain.resend_domain_id) {
      return { success: true, data: domain as unknown as EmailDomain };
    }

    // Call the email-domain-create function to provision in Resend
    const { data, error } = await supabase.functions.invoke('email-domain-create', {
      body: {
        tenantId: domain.tenant_id,
        domain: domain.domain,
        provider: domain.is_entri_managed ? 'entri' : 'manual'
      }
    });

    if (error) {
      console.error('Error provisioning Resend domain:', error);
      return { success: false, error: error.message };
    }

    // Refetch the updated domain
    const { data: updatedDomain, error: refetchError } = await supabase
      .from('email_domains')
      .select('*')
      .eq('id', emailDomainId)
      .single();

    if (refetchError) {
      return { success: false, error: refetchError.message };
    }

    return { success: true, data: updatedDomain as unknown as EmailDomain };
  } catch (err: any) {
    console.error('Error in ensureResendDomainForEmailDomain:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Refresh verification status from Resend
 * Updates domain status based on Resend's verification state
 */
export async function refreshResendVerificationStatus(
  emailDomainId: string
): Promise<ProvisioningResult> {
  try {
    const { data, error } = await supabase.functions.invoke('email-domain-verify', {
      body: { email_domain_id: emailDomainId }
    });

    if (error) {
      console.error('Error refreshing verification status:', error);
      return { success: false, error: error.message };
    }

    // Refetch the updated domain
    const { data: updatedDomain, error: fetchError } = await supabase
      .from('email_domains')
      .select('*')
      .eq('id', emailDomainId)
      .single();

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    return {
      success: true,
      data: updatedDomain as unknown as EmailDomain
    };
  } catch (err: any) {
    console.error('Error in refreshResendVerificationStatus:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Upsert email domain from Entri callback
 * Called when Entri successfully configures DNS
 */
export async function upsertEmailDomainFromEntriCallback(
  params: EntriCallbackParams
): Promise<ProvisioningResult> {
  const { accountId, domain, entriConnectionId, entriProvider } = params;

  try {
    // Check if domain already exists for this tenant
    const { data: existingDomain, error: fetchError } = await supabase
      .from('email_domains')
      .select('*')
      .eq('tenant_id', accountId)
      .eq('domain', domain.toLowerCase())
      .maybeSingle();

    if (fetchError) {
      console.error('Error checking existing domain:', fetchError);
      return { success: false, error: fetchError.message };
    }

    let domainId: string;

    if (existingDomain) {
      // Update existing domain with Entri info
      const { error: updateError } = await supabase
        .from('email_domains')
        .update({
          entri_connection_id: entriConnectionId,
          entri_provider: entriProvider,
          is_entri_managed: true,
          status: 'verifying',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingDomain.id);

      if (updateError) {
        console.error('Error updating domain with Entri info:', updateError);
        return { success: false, error: updateError.message };
      }

      domainId = existingDomain.id;
    } else {
      // Insert new domain
      const { data: newDomain, error: insertError } = await supabase
        .from('email_domains')
        .insert({
          tenant_id: accountId,
          domain: domain.toLowerCase(),
          entri_connection_id: entriConnectionId,
          entri_provider: entriProvider,
          is_entri_managed: true,
          status: 'verifying',
          total_sent_30d: 0,
          total_bounces_30d: 0,
          total_complaints_30d: 0,
          bounce_rate_30d: 0,
          complaint_rate_30d: 0,
          manual_pause: false
        })
        .select()
        .single();

      if (insertError || !newDomain) {
        console.error('Error inserting new domain:', insertError);
        return { success: false, error: insertError?.message || 'Failed to create domain' };
      }

      domainId = newDomain.id;
    }

    // Ensure Resend domain is provisioned and DNS records are fetched
    const provisionResult = await ensureResendDomainForEmailDomain(domainId);

    if (!provisionResult.success) {
      console.warn('Warning: Resend domain provisioning issue:', provisionResult.error);
      // Don't fail the whole operation - domain is created, Resend can be retried
    }

    // Fetch final domain state
    const { data: finalDomain, error: finalError } = await supabase
      .from('email_domains')
      .select('*')
      .eq('id', domainId)
      .single();

    if (finalError) {
      return { success: false, error: finalError.message };
    }

    return { success: true, data: finalDomain as unknown as EmailDomain };
  } catch (err: any) {
    console.error('Error in upsertEmailDomainFromEntriCallback:', err);
    return { success: false, error: err.message };
  }
}
