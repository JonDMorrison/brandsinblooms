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
    warmup_stage: number;
  };
  sender?: {
    from_name: string;
    from_email: string;
  };
  limits?: {
    daily_limit: number;
    hourly_limit: number;
    daily_used: number;
    hourly_used: number;
  };
  using_fallback?: boolean;
}

export interface WarmupSchedule {
  stage: number;
  minDays: number;
  dailyLimit: number;
  hourlyLimit: number;
}

// Warmup schedule configuration
export const WARMUP_SCHEDULE: WarmupSchedule[] = [
  { stage: 1, minDays: 0, dailyLimit: 50, hourlyLimit: 25 },
  { stage: 2, minDays: 4, dailyLimit: 150, hourlyLimit: 40 },
  { stage: 3, minDays: 8, dailyLimit: 500, hourlyLimit: 125 },
  { stage: 4, minDays: 15, dailyLimit: 2000, hourlyLimit: 500 },
];

// Reputation thresholds
export const REPUTATION_THRESHOLDS = {
  BOUNCE_WARNING: 0.03,      // 3% - warning
  BOUNCE_CRITICAL: 0.05,     // 5% - block sends
  BOUNCE_AUTO_PAUSE: 0.08,   // 8% - auto-pause domain
  COMPLAINT_WARNING: 0.001,  // 0.1% - warning
  COMPLAINT_CRITICAL: 0.002, // 0.2% - block sends
  COMPLAINT_AUTO_PAUSE: 0.005, // 0.5% - auto-pause domain
};

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
 * Get the active sender for an account (custom domain or fallback)
 */
export async function getActiveOrFallbackSender(tenantId: string): Promise<{
  fromName: string;
  fromEmail: string;
  domainId?: string;
  usingFallback: boolean;
}> {
  // Prefer Entri-managed domains first, then any verified domain
  const { data: domains, error } = await supabase
    .from('email_domains')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('status', ['warming_up', 'active'])
    .eq('manual_pause', false)
    .order('is_entri_managed', { ascending: false }) // Entri-managed first
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !domains || domains.length === 0) {
    return {
      fromName: 'BloomSuite',
      fromEmail: 'noreply@bloomsuite.app',
      usingFallback: true,
    };
  }

  const domain = domains[0] as EmailDomain;
  
  if (domain.default_from_email) {
    return {
      fromName: domain.default_from_name || 'BloomSuite',
      fromEmail: domain.default_from_email,
      domainId: domain.id,
      usingFallback: false,
    };
  }

  return {
    fromName: 'BloomSuite',
    fromEmail: 'noreply@bloomsuite.app',
    usingFallback: true,
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
      return { label: 'Warming Up', variant: 'outline', color: 'text-orange-600' };
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
 * Get warmup progress percentage
 */
export function getWarmupProgress(domain: EmailDomain): number {
  if (domain.status === 'active') return 100;
  if (domain.warmup_stage === 0) return 0;
  return Math.min(100, (domain.warmup_stage / 4) * 100);
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
  const bounceWarning = domain.bounce_rate_30d > REPUTATION_THRESHOLDS.BOUNCE_WARNING;
  const complaintWarning = domain.complaint_rate_30d > REPUTATION_THRESHOLDS.COMPLAINT_WARNING;
  
  return {
    healthy: !bounceWarning && !complaintWarning,
    bounceWarning,
    complaintWarning,
  };
}
