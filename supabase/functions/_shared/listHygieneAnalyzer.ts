import { canSendEmailBatch, type SkipReason } from "./canSendEmail.ts";
import { getEmailGovernanceRuntimeConfig } from "./emailGovernanceConfig.ts";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SUPPRESSED_REASONS: SkipReason[] = [
  'unsubscribed',
  'bounced',
  'complained',
  'globally_blocked',
];

export interface HygieneRecipient {
  customerId?: string;
  email?: string | null;
  createdAt?: string | null;
  lastOpenAt?: string | null;
  lastEmailClickedAt?: string | null;
}

export interface HygieneWarning {
  type: 'inactive_ratio' | 'high_bounce_history' | 'invalid_email_ratio';
  severity: 'warning';
  message: string;
  value: number;
  threshold: number;
}

export interface CampaignListHygieneAnalysis {
  audienceTotal: number;
  duplicateEmailsCount: number;
  invalidEmailsCount: number;
  invalidEmailsPct: number;
  suppressedCount: number;
  inactiveCount: number;
  inactivePct: number;
  blocked: boolean;
  blockReason: string | null;
  warnings: HygieneWarning[];
  deliverability: Record<string, unknown>;
  details: Record<string, unknown>;
}

function toPct(part: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Number(((part / total) * 100).toFixed(3));
}

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

function normalizeEmail(email?: string | null): string {
  return String(email || '').trim().toLowerCase();
}

function getLatestEngagementTimestamp(recipient: HygieneRecipient): number | null {
  const openedAt = recipient.lastOpenAt ? new Date(recipient.lastOpenAt).getTime() : NaN;
  const clickedAt = recipient.lastEmailClickedAt ? new Date(recipient.lastEmailClickedAt).getTime() : NaN;
  const createdAt = recipient.createdAt ? new Date(recipient.createdAt).getTime() : NaN;

  const candidates = [openedAt, clickedAt].filter((value) => Number.isFinite(value)) as number[];
  if (candidates.length > 0) {
    return Math.max(...candidates);
  }

  if (Number.isFinite(createdAt)) {
    return createdAt;
  }

  return null;
}

function isInactive(recipient: HygieneRecipient, nowMs: number, inactiveDays: number): boolean {
  const latest = getLatestEngagementTimestamp(recipient);
  if (latest === null) return true;
  const thresholdMs = inactiveDays * 24 * 60 * 60 * 1000;
  return nowMs - latest > thresholdMs;
}

export async function analyzeCampaignListHygiene(
  supabase: any,
  params: {
    tenantId: string;
    domainId?: string | null;
    recipients: HygieneRecipient[];
  }
): Promise<CampaignListHygieneAnalysis> {
  const { tenantId, domainId, recipients } = params;
  const governanceConfig = await getEmailGovernanceRuntimeConfig(supabase, tenantId);

  const invalidBlockThresholdPct = governanceConfig.list_hygiene.invalid_block_threshold_pct;
  const inactiveWarningThresholdPct = governanceConfig.list_hygiene.inactive_warning_threshold_pct;
  const bounceWarningThresholdPct = governanceConfig.list_hygiene.bounce_warning_threshold_pct;
  const inactiveDays = governanceConfig.list_hygiene.inactive_days;

  const audienceTotal = recipients.length;
  const nowMs = Date.now();

  const emailFrequency = new Map<string, number>();
  let invalidEmailsCount = 0;
  let inactiveCount = 0;

  const uniqueValidEmails = new Set<string>();

  for (const recipient of recipients) {
    const normalized = normalizeEmail(recipient.email);

    if (!normalized || !isValidEmail(normalized)) {
      invalidEmailsCount++;
    } else {
      uniqueValidEmails.add(normalized);
    }

    if (normalized) {
      emailFrequency.set(normalized, (emailFrequency.get(normalized) || 0) + 1);
    }

    if (isInactive(recipient, nowMs, inactiveDays)) {
      inactiveCount++;
    }
  }

  let duplicateEmailsCount = 0;
  for (const count of emailFrequency.values()) {
    if (count > 1) duplicateEmailsCount += count - 1;
  }

  let suppressedCount = 0;
  const suppressionReasonCounts: Record<string, number> = {};
  if (uniqueValidEmails.size > 0) {
    const eligibility = await canSendEmailBatch(supabase, {
      tenantId,
      recipients: Array.from(uniqueValidEmails).map((email) => ({ email })),
    });

    for (const email of uniqueValidEmails) {
      const result = eligibility.get(email);
      if (!result || result.allowed !== false) continue;
      if (!result.reason || !SUPPRESSED_REASONS.includes(result.reason)) continue;
      suppressedCount++;
      suppressionReasonCounts[result.reason] = (suppressionReasonCounts[result.reason] || 0) + 1;
    }
  }

  const invalidEmailsPct = toPct(invalidEmailsCount, audienceTotal);
  const inactivePct = toPct(inactiveCount, audienceTotal);

  const warnings: HygieneWarning[] = [];
  let deliverability: Record<string, unknown> = {};

  if (domainId) {
    const { data: deliverabilityStatus, error: deliverabilityError } = await supabase.rpc('get_deliverability_status', {
      p_domain_id: domainId,
    });

    if (!deliverabilityError && deliverabilityStatus && typeof deliverabilityStatus === 'object') {
      deliverability = deliverabilityStatus as Record<string, unknown>;
      const rates = (deliverabilityStatus as Record<string, any>)?.rates;
      const bounceRateRaw = rates?.bounce_rate;
      const bounceRate = Number(bounceRateRaw);
      if (Number.isFinite(bounceRate) && bounceRate > bounceWarningThresholdPct) {
        warnings.push({
          type: 'high_bounce_history',
          severity: 'warning',
          message: `Historical bounce rate is high at ${bounceRate.toFixed(2)}%.`,
          value: Number(bounceRate.toFixed(3)),
          threshold: bounceWarningThresholdPct,
        });
      }
    }
  }

  if (invalidEmailsPct > invalidBlockThresholdPct) {
    warnings.push({
      type: 'invalid_email_ratio',
      severity: 'warning',
      message: `${invalidEmailsCount} invalid email address${invalidEmailsCount === 1 ? '' : 'es'} will be skipped before sending.`,
      value: invalidEmailsPct,
      threshold: invalidBlockThresholdPct,
    });
  }

  if (inactivePct > inactiveWarningThresholdPct) {
    warnings.push({
      type: 'inactive_ratio',
      severity: 'warning',
      message: `Inactive users ratio is ${inactivePct.toFixed(2)}%, above ${inactiveWarningThresholdPct}%.`,
      value: inactivePct,
      threshold: inactiveWarningThresholdPct,
    });
  }

  // Product decision: invalid list hygiene should not hard-block the entire campaign.
  // The send pipeline skips invalid/suppressed recipients and sends to eligible contacts.
  const blocked = false;
  const blockReason = null;

  return {
    audienceTotal,
    duplicateEmailsCount,
    invalidEmailsCount,
    invalidEmailsPct,
    suppressedCount,
    inactiveCount,
    inactivePct,
    blocked,
    blockReason,
    warnings,
    deliverability,
    details: {
      thresholds: {
        invalidBlockPct: invalidBlockThresholdPct,
        inactiveWarningPct: inactiveWarningThresholdPct,
        bounceWarningPct: bounceWarningThresholdPct,
        inactiveDays,
      },
      suppressionReasonCounts,
    },
  };
}

export async function persistCampaignHygieneReport(
  supabase: any,
  params: {
    tenantId: string;
    campaignId: string;
    analysis: CampaignListHygieneAnalysis;
  }
): Promise<void> {
  const { tenantId, campaignId, analysis } = params;

  const payload = {
    tenant_id: tenantId,
    campaign_id: campaignId,
    audience_total: analysis.audienceTotal,
    duplicate_emails_count: analysis.duplicateEmailsCount,
    invalid_emails_count: analysis.invalidEmailsCount,
    invalid_emails_pct: analysis.invalidEmailsPct,
    suppressed_count: analysis.suppressedCount,
    inactive_count: analysis.inactiveCount,
    inactive_pct: analysis.inactivePct,
    deliverability: analysis.deliverability,
    warnings: analysis.warnings,
    blocked: analysis.blocked,
    block_reason: analysis.blockReason,
    details: analysis.details,
  };

  const { error } = await supabase
    .from('campaign_hygiene_reports')
    .insert(payload);

  if (error) {
    console.warn('[listHygieneAnalyzer] Failed to persist campaign hygiene report:', error.message);
  }
}