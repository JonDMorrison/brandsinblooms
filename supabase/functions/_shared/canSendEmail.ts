/**
 * Unified email send permission checker
 * 
 * Checks suppression list, opt-out status, email validity
 * before allowing any email send.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export type SkipReason = 
  | 'opt_out' 
  | 'suppressed' 
  | 'bounced'
  | 'complained'
  | 'unsubscribed'
  | 'invalid_email' 
  | 'missing_email';

export interface CanSendResult {
  allowed: boolean;
  reason?: SkipReason;
  suppressionType?: string;
}

// Basic email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Engagement-based suppression reasons that should be bypassed
const ENGAGEMENT_SUPPRESSION_PATTERNS = [
  'no email opens',
  'inactivity',
  'engagement',
  '180 days',
];

function isEngagementSuppression(reason?: string | null): boolean {
  if (!reason) return false;
  const lower = reason.toLowerCase();
  return ENGAGEMENT_SUPPRESSION_PATTERNS.some(p => lower.includes(p));
}

/**
 * Check if an email can be sent to a recipient
 */
export async function canSendEmail(
  supabase: ReturnType<typeof createClient>,
  params: {
    tenantId: string;
    customerId?: string;
    email?: string;
  }
): Promise<CanSendResult> {
  const { tenantId, customerId, email } = params;

  // 1. Check if email is provided
  if (!email || !email.trim()) {
    return { allowed: false, reason: 'missing_email' };
  }

  const normalizedEmail = email.toLowerCase().trim();

  // 2. Validate email format
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    return { allowed: false, reason: 'invalid_email' };
  }

  // 3. Check suppression_list table (tenant-scoped, email channel)
  const { data: suppression } = await supabase
    .from('suppression_list')
    .select('suppression_type, reason')
    .eq('tenant_id', tenantId)
    .eq('email', normalizedEmail)
    .eq('channel', 'email')
    .is('lifted_at', null)
    .maybeSingle();

  if (suppression) {
    // Map suppression type to reason
    const typeToReason: Record<string, SkipReason> = {
      'bounced': 'bounced',
      'hard_bounce': 'bounced',
      'complaint': 'complained',
      'complained': 'complained',
      'unsubscribed': 'unsubscribed',
      'manual': 'suppressed',
      'invalid': 'invalid_email'
    };

    const reason = typeToReason[suppression.suppression_type] || 'suppressed';
    return { 
      allowed: false, 
      reason,
      suppressionType: suppression.suppression_type 
    };
  }

  // 4. Check customer record if customerId provided
  if (customerId) {
    const { data: customer } = await supabase
      .from('crm_customers')
      .select('opt_out, suppressed, suppressed_reason, email_opt_in')
      .eq('id', customerId)
      .single();

    if (customer) {
      // Check opt_out flag
      if (customer.opt_out === true) {
        return { allowed: false, reason: 'opt_out' };
      }

      // Check suppressed flag — but bypass engagement-based suppression
      if (customer.suppressed === true) {
        const isEngagementBased = isEngagementSuppression(customer.suppressed_reason);
        if (!isEngagementBased) {
          return { allowed: false, reason: 'suppressed' };
        }
        // Engagement-based suppression is bypassed — allow send
        console.log(`[canSendEmail] Bypassing engagement-based suppression for customer ${customerId}`);
      }

      // Check email_opt_in (if explicitly false, skip)
      if (customer.email_opt_in === false) {
        return { allowed: false, reason: 'unsubscribed' };
      }
    }
  } else {
    // No customerId - try to find customer by email and tenant
    const { data: customer } = await supabase
      .from('crm_customers')
      .select('opt_out, suppressed, suppressed_reason, email_opt_in')
      .eq('tenant_id', tenantId)
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (customer) {
      if (customer.opt_out === true) {
        return { allowed: false, reason: 'opt_out' };
      }
      if (customer.suppressed === true) {
        const isEngagementBased = isEngagementSuppression(customer.suppressed_reason);
        if (!isEngagementBased) {
          return { allowed: false, reason: 'suppressed' };
        }
        console.log(`[canSendEmail] Bypassing engagement-based suppression for ${normalizedEmail}`);
      }
      if (customer.email_opt_in === false) {
        return { allowed: false, reason: 'unsubscribed' };
      }
    }
  }

  return { allowed: true };
}

/**
 * Batch check multiple emails for send eligibility
 * More efficient than individual checks for campaigns
 */
export async function canSendEmailBatch(
  supabase: ReturnType<typeof createClient>,
  params: {
    tenantId: string;
    recipients: Array<{ customerId?: string; email: string }>;
  }
): Promise<Map<string, CanSendResult>> {
  const { tenantId, recipients } = params;
  const results = new Map<string, CanSendResult>();

  // Collect all emails
  const emails = recipients
    .map(r => r.email?.toLowerCase().trim())
    .filter(Boolean);

  if (emails.length === 0) {
    return results;
  }

  // Batch fetch suppressions
  const { data: suppressions } = await supabase
    .from('suppression_list')
    .select('email, suppression_type')
    .eq('tenant_id', tenantId)
    .eq('channel', 'email')
    .is('lifted_at', null)
    .in('email', emails);

  const suppressionMap = new Map<string, string>();
  for (const s of suppressions || []) {
    suppressionMap.set(s.email.toLowerCase(), s.suppression_type);
  }

  // Batch fetch customer flags
  const customerIds = recipients.map(r => r.customerId).filter(Boolean);
  const customerMap = new Map<string, any>();

  if (customerIds.length > 0) {
    const { data: customers } = await supabase
      .from('crm_customers')
      .select('id, email, opt_out, suppressed, suppressed_reason, email_opt_in')
      .in('id', customerIds);

    for (const c of customers || []) {
      customerMap.set(c.id, c);
      if (c.email) {
        customerMap.set(c.email.toLowerCase(), c);
      }
    }
  }

  // Also fetch by email for recipients without customerId
  const emailsWithoutCustomerId = recipients
    .filter(r => !r.customerId)
    .map(r => r.email?.toLowerCase().trim())
    .filter(Boolean);

  if (emailsWithoutCustomerId.length > 0) {
    const { data: customersByEmail } = await supabase
      .from('crm_customers')
      .select('id, email, opt_out, suppressed, suppressed_reason, email_opt_in')
      .eq('tenant_id', tenantId)
      .in('email', emailsWithoutCustomerId);

    for (const c of customersByEmail || []) {
      if (c.email && !customerMap.has(c.email.toLowerCase())) {
        customerMap.set(c.email.toLowerCase(), c);
      }
    }
  }

  // Process each recipient
  for (const recipient of recipients) {
    const email = recipient.email?.toLowerCase().trim();
    
    if (!email) {
      results.set(recipient.email || '', { allowed: false, reason: 'missing_email' });
      continue;
    }

    if (!EMAIL_REGEX.test(email)) {
      results.set(email, { allowed: false, reason: 'invalid_email' });
      continue;
    }

    // Check suppression
    const suppressionType = suppressionMap.get(email);
    if (suppressionType) {
      const typeToReason: Record<string, SkipReason> = {
        'bounced': 'bounced',
        'hard_bounce': 'bounced',
        'complaint': 'complained',
        'complained': 'complained',
        'unsubscribed': 'unsubscribed',
        'manual': 'suppressed',
        'invalid': 'invalid_email'
      };
      results.set(email, { 
        allowed: false, 
        reason: typeToReason[suppressionType] || 'suppressed',
        suppressionType 
      });
      continue;
    }

    // Check customer flags
    const customer = recipient.customerId 
      ? customerMap.get(recipient.customerId) 
      : customerMap.get(email);

    if (customer) {
      if (customer.opt_out === true) {
        results.set(email, { allowed: false, reason: 'opt_out' });
        continue;
      }
      if (customer.suppressed === true) {
        const isEngBased = isEngagementSuppression(customer.suppressed_reason);
        if (!isEngBased) {
          results.set(email, { allowed: false, reason: 'suppressed' });
          continue;
        }
      }
      if (customer.email_opt_in === false) {
        results.set(email, { allowed: false, reason: 'unsubscribed' });
        continue;
      }
    }

    results.set(email, { allowed: true });
  }

  return results;
}

/**
 * Log skipped sends to email_send_skips table
 */
export async function logSkippedSends(
  supabase: ReturnType<typeof createClient>,
  skips: Array<{
    tenantId: string;
    campaignId?: string;
    automationId?: string;
    automationNodeId?: string;
    customerId?: string;
    email: string;
    reason: SkipReason;
  }>
): Promise<void> {
  if (skips.length === 0) return;

  const records = skips.map(skip => ({
    tenant_id: skip.tenantId,
    campaign_id: skip.campaignId || null,
    automation_id: skip.automationId || null,
    automation_node_id: skip.automationNodeId || null,
    customer_id: skip.customerId || null,
    email: skip.email,
    reason: skip.reason
  }));

  const { error } = await supabase
    .from('email_send_skips')
    .insert(records);

  if (error) {
    console.error('[canSendEmail] Failed to log skipped sends:', error);
  }
}
