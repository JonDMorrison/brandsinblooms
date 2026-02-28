// Email Domain Management Service
import { supabase } from '@/integrations/supabase/client';

export interface EmailDomain {
  id: string;
  tenant_id: string;
  domain: string;
  resend_domain_id?: string;
  status: 'pending_dns' | 'verifying' | 'warming_up' | 'active' | 'paused' | 'blocked' | 'failed';
  default_from_name?: string;
  default_from_email?: string;
  warmup_stage: number;
  warmup_started_at?: string;
  daily_limit: number;
  hourly_limit: number;
  total_sent_30d: number;
  total_bounces_30d: number;
  total_complaints_30d: number;
  bounce_rate_30d: number;
  complaint_rate_30d: number;
  manual_pause: boolean;
  notes?: string;
  dns_records?: DnsRecords;
  // Entri integration fields
  entri_connection_id?: string;
  entri_provider?: string;
  is_entri_managed: boolean;
  created_at: string;
  updated_at: string;
}

export interface DnsRecords {
  dkim?: DnsRecord[];
  spf?: DnsRecord[];
  return_path?: DnsRecord;
}

export interface DnsRecord {
  type: 'TXT' | 'CNAME' | 'MX';
  name: string;
  value: string;
  ttl?: number;
}

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  message?: string;
  domain?: {
    id: string;
    domain: string;
    status: string;
  };
  sender?: {
    from_name: string;
    from_email: string;
  };
}

/**
 * Check if sending is allowed for a campaign
 */
export async function canSendCampaign(
  tenantId: string,
  domainId: string | null,
  recipientCount: number
): Promise<QuotaCheckResult> {
  const { data, error } = await supabase.rpc('check_send_quota', {
    p_tenant_id: tenantId,
    p_domain_id: domainId,
    p_recipient_count: recipientCount,
  });

  if (error) {
    console.error('Error checking send quota:', error);
    return {
      allowed: false,
      reason: 'check_failed',
      message: 'Failed to check sending quota. Please try again.',
    };
  }

  return data as unknown as QuotaCheckResult;
}

/**
 * Get the operational sender for an account (custom domain only).
 *
 * Milestone 2: There is no fallback sender.
 */
export async function getOperationalSender(tenantId: string): Promise<{
  fromName: string;
  fromEmail: string;
  domainId: string;
} | null> {
  const { data: domains, error } = await supabase
    .from('email_domains')
    .select('id, domain, status, default_from_email, default_from_name, is_entri_managed, created_at')
    .eq('tenant_id', tenantId)
    .in('status', ['warming_up', 'active'])
    .order('is_entri_managed', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !domains || domains.length === 0) {
    return null;
  }

  const domain = domains[0] as any;
  const fromEmail = String(domain.default_from_email || `mail@${domain.domain}`);

  return {
    fromName: String(domain.default_from_name || 'BloomSuite'),
    fromEmail,
    domainId: String(domain.id),
  };
}

/**
 * Get status badge configuration
 */
export function getDomainStatusConfig(status: EmailDomain['status']): {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  color: string;
} {
  switch (status) {
    case 'pending_dns':
      return { label: 'Waiting for DNS', variant: 'secondary', color: 'text-yellow-600' };
    case 'verifying':
      return { label: 'Verifying', variant: 'secondary', color: 'text-blue-600' };
    case 'warming_up':
      // Treat warming_up same as active since warmup is removed
      return { label: 'Ready', variant: 'default', color: 'text-green-600' };
    case 'active':
      return { label: 'Ready', variant: 'default', color: 'text-green-600' };
    case 'paused':
      return { label: 'Paused', variant: 'destructive', color: 'text-red-600' };
    case 'blocked':
      return { label: 'Blocked', variant: 'destructive', color: 'text-red-800' };
    case 'failed':
      return { label: 'Failed', variant: 'destructive', color: 'text-red-600' };
    default:
      return { label: status, variant: 'secondary', color: 'text-muted-foreground' };
  }
}

/**
 * Format reputation rate as percentage
 */
export function formatReputationRate(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}

/**
 * Check if reputation is healthy
 */
export function isReputationHealthy(domain: EmailDomain): {
  healthy: boolean;
  bounceWarning: boolean;
  complaintWarning: boolean;
} {
  return isReputationHealthyWithThresholds(domain, {
    bounceWarningRate: Number.POSITIVE_INFINITY,
    complaintWarningRate: Number.POSITIVE_INFINITY,
  });
}

export function isReputationHealthyWithThresholds(
  domain: EmailDomain,
  thresholds: {
    bounceWarningRate: number;
    complaintWarningRate: number;
  },
): {
  healthy: boolean;
  bounceWarning: boolean;
  complaintWarning: boolean;
} {
  const bounceWarning = domain.bounce_rate_30d > thresholds.bounceWarningRate;
  const complaintWarning = domain.complaint_rate_30d > thresholds.complaintWarningRate;

  return {
    healthy: !bounceWarning && !complaintWarning,
    bounceWarning,
    complaintWarning,
  };
}
