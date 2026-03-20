import { supabase } from '@/integrations/supabase/client';

export type SMSConsentStatus = 'unknown' | 'opted_in' | 'opted_out';

export type SMSConsentEventType = 
  | 'opt_in' 
  | 'opt_out' 
  | 'keyword_start' 
  | 'keyword_stop' 
  | 'imported_unknown' 
  | 'updated_by_admin';

export interface SMSConsentEvent {
  id: string;
  tenant_id: string;
  customer_id: string;
  phone: string;
  event_type: SMSConsentEventType;
  source: string;
  user_agent?: string | null;
  ip_address?: string | null;
  created_at: string;
}

/**
 * Get the SMS consent status from a customer's sms_opt_in value
 */
export function getSMSConsentStatus(customer: { sms_opt_in: boolean | null }): SMSConsentStatus {
  if (customer.sms_opt_in === true) return 'opted_in';
  if (customer.sms_opt_in === false) return 'opted_out';
  return 'unknown';
}

/**
 * Get human-readable label for SMS consent status
 */
export function getSMSConsentStatusLabel(status: SMSConsentStatus): string {
  switch (status) {
    case 'opted_in': return 'Opted In';
    case 'opted_out': return 'Opted Out';
    case 'unknown': return 'Unknown';
  }
}

/**
 * Get badge color variant for SMS consent status
 */
export function getSMSConsentStatusColor(status: SMSConsentStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'opted_in': return 'default';
    case 'opted_out': return 'destructive';
    case 'unknown': return 'secondary';
  }
}

/**
 * Record an SMS consent event in the audit log
 */
export async function recordSMSConsentEvent(params: {
  tenantId: string;
  customerId: string;
  phone: string;
  eventType: SMSConsentEventType;
  source: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('crm_sms_consent_events')
      .insert({
        tenant_id: params.tenantId,
        customer_id: params.customerId,
        phone: params.phone,
        event_type: params.eventType,
        source: params.source,
        ip_address: params.ipAddress || null,
        user_agent: params.userAgent || null,
      });

    if (error) {
      console.error('Failed to record SMS consent event:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('Error recording SMS consent event:', err);
    return { success: false, error: 'Failed to record SMS consent event' };
  }
}

/**
 * Calculate the preferred channel based on opt-in status
 */
function calculatePreferredChannel(customer: {
  email_opt_in: boolean | null;
  sms_opt_in: boolean | null;
}): 'email' | 'sms' | 'both' | 'none' {
  const hasEmail = customer.email_opt_in === true;
  const hasSMS = customer.sms_opt_in === true;

  if (hasEmail && hasSMS) return 'both';
  if (hasEmail) return 'email';
  if (hasSMS) return 'sms';
  return 'none';
}

/**
 * Update a customer's SMS consent status and record the event
 */
// FIX: [issue #51] - TODO: Wrap SMS consent update in a database transaction (RPC) to ensure atomicity
export async function updateCustomerSMSConsent(params: {
  tenantId: string;
  customerId: string;
  phone: string;
  optIn: boolean;
  source: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const now = new Date().toISOString();
    
    // Build update data with opt-in/opt-out timestamps
    const updateData: Record<string, any> = {
      sms_opt_in: params.optIn,
      sms_consent_source: params.source,
      opt_out: !params.optIn,
      updated_at: now,
    };

    if (params.optIn) {
      updateData.sms_opt_in_at = now;
      updateData.sms_opt_out_at = null; // Clear opt-out timestamp
    } else {
      updateData.sms_opt_out_at = now;
      // Keep sms_opt_in_at for historical purposes
    }

    // Update the customer record
    const { error: updateError } = await supabase
      .from('crm_customers')
      .update(updateData)
      .eq('id', params.customerId);

    if (updateError) {
      console.error('Failed to update customer SMS consent:', updateError);
      return { success: false, error: updateError.message };
    }

    // Also update preferred_channel based on new consent status
    try {
      const { data: customer } = await supabase
        .from('crm_customers')
        .select('email_opt_in, sms_opt_in')
        .eq('id', params.customerId)
        .single();

      if (customer) {
        const preferredChannel = calculatePreferredChannel({
          email_opt_in: customer.email_opt_in,
          sms_opt_in: params.optIn, // Use the new value
        });

        await supabase
          .from('crm_customers')
          .update({ preferred_channel: preferredChannel })
          .eq('id', params.customerId);
      }
    } catch (channelError) {
      console.warn('Failed to update preferred channel:', channelError);
    }

    // Record the consent event
    await recordSMSConsentEvent({
      tenantId: params.tenantId,
      customerId: params.customerId,
      phone: params.phone,
      eventType: params.optIn ? 'opt_in' : 'opt_out',
      source: params.source,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    return { success: true };
  } catch (err) {
    console.error('Error updating customer SMS consent:', err);
    return { success: false, error: 'Failed to update SMS consent' };
  }
}

/**
 * Get SMS consent history for a customer
 */
export async function getCustomerSMSConsentHistory(
  customerId: string
): Promise<SMSConsentEvent[]> {
  try {
    const { data, error } = await supabase
      .from('crm_sms_consent_events')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to get SMS consent history:', error);
      return [];
    }

    return (data || []) as SMSConsentEvent[];
  } catch (err) {
    console.error('Error getting SMS consent history:', err);
    return [];
  }
}
