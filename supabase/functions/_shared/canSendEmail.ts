/**
 * Unified email send permission checker
 *
 * Milestone 5: suppression_list is the single source of truth.
 * Only explicitly suppressed recipients are blocked.
 */

export type SkipReason =
  | 'bounced'
  | 'complained'
  | 'unsubscribed'
  | 'globally_blocked'
  | 'role_based'
  | 'invalid_email'
  | 'missing_email';

export interface CanSendResult {
  allowed: boolean;
  reason?: SkipReason;
  suppressionType?: string;
}

export interface SuppressionBypassOptions {
  bypassSuppressionTypes?: string[];
  forceBypassConsent?: boolean;
  forceBypassSoftSuppression?: boolean;
}

// Basic email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMAIL_SUPPRESSION_TYPES = [
  'unsubscribed',
  'bounced',
  'complaint',
  'blocked',
  'global_block',
  // Legacy synonyms we still honor for safety.
  'complained',
  'hard_bounce',
] as const;

const FORCE_SEND_SOFT_SUPPRESSION_TYPES = ['bounced', 'inactive'] as const;

const DEFAULT_ROLE_BASED_LOCALPARTS = [
  'admin',
  'support',
  'info',
  'sales',
  'billing',
  'contact',
  'help',
  'team',
  'office',
  'noreply',
  'no-reply',
  'donotreply',
  'do-not-reply',
  'postmaster',
  'abuse',
  'webmaster',
  'security',
  'compliance',
  'marketing',
  'hello',
] as const;

function isTruthyEnv(value: string | undefined): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function getRoleBasedLocalparts(): Set<string> {
  const raw = String(Deno.env.get('ROLE_BASED_LOCALPARTS') || '').trim();
  if (!raw) {
    return new Set(DEFAULT_ROLE_BASED_LOCALPARTS);
  }

  const list = raw
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  return new Set(list.length > 0 ? list : DEFAULT_ROLE_BASED_LOCALPARTS);
}

function isRoleBasedEmail(email: string): boolean {
  const localpart = String(email.split('@')[0] || '').trim().toLowerCase();
  if (!localpart) return false;
  return getRoleBasedLocalparts().has(localpart);
}

function suppressionTypeToReason(suppressionType: string): SkipReason | null {
  const t = String(suppressionType || '').toLowerCase();
  if (t === 'unsubscribed') return 'unsubscribed';
  if (t === 'bounced' || t === 'hard_bounce') return 'bounced';
  if (t === 'complaint' || t === 'complained') return 'complained';
  if (t === 'blocked' || t === 'global_block') return 'globally_blocked';
  return null;
}

function normalizeSuppressionType(value: string): string {
  return String(value || '').trim().toLowerCase();
}

function buildBypassTypeSet(options?: SuppressionBypassOptions): Set<string> {
  const bypassTypes = [
    ...(options?.bypassSuppressionTypes || []),
    ...(options?.forceBypassSoftSuppression
      ? [...FORCE_SEND_SOFT_SUPPRESSION_TYPES]
      : []),
  ];

  return new Set(bypassTypes.map(normalizeSuppressionType).filter(Boolean));
}

function pickMostSevereReason(reasons: Array<SkipReason | null | undefined>): SkipReason | undefined {
  // Deterministic priority: global_block > complaint > bounce > unsubscribe.
  const set = new Set(reasons.filter(Boolean) as SkipReason[]);
  if (set.has('globally_blocked')) return 'globally_blocked';
  if (set.has('complained')) return 'complained';
  if (set.has('bounced')) return 'bounced';
  if (set.has('unsubscribed')) return 'unsubscribed';
  return undefined;
}

async function isGloballySuppressed(supabase: any, email: string): Promise<boolean> {
  const nowIso = new Date().toISOString();
  const { data: globalSuppressions } = await supabase
    .from('global_email_suppression_list')
    .select('id')
    .eq('email', email)
    .is('lifted_at', null)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .limit(1);

  return Array.isArray(globalSuppressions) && globalSuppressions.length > 0;
}

/**
 * Check if an email can be sent to a recipient
 */
export async function canSendEmail(
  supabase: any,
  params: {
    tenantId: string;
    customerId?: string;
    email?: string;
  },
  options?: SuppressionBypassOptions
): Promise<CanSendResult> {
  const { tenantId, customerId, email } = params;

  // 1. Check if email is provided
  if (!email || !email.trim()) {
    return { allowed: false, reason: 'missing_email' };
  }

  const normalizedEmail = email.toLowerCase().trim();
  const nowIso = new Date().toISOString();

  const roleBasedBlockingEnabled = isTruthyEnv(Deno.env.get('BLOCK_ROLE_BASED_EMAILS'));
  if (roleBasedBlockingEnabled && isRoleBasedEmail(normalizedEmail)) {
    return { allowed: false, reason: 'role_based', suppressionType: 'role_based' };
  }

  if (await isGloballySuppressed(supabase, normalizedEmail)) {
    return { allowed: false, reason: 'globally_blocked', suppressionType: 'global_block' };
  }

  // 2. Validate email format
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    return { allowed: false, reason: 'invalid_email' };
  }

  // 3. Check suppression_list table (tenant-scoped, email channel)
  // Only block on explicit suppression types.
  const { data: suppressions } = await supabase
    .from('suppression_list')
    .select('suppression_type')
    .eq('tenant_id', tenantId)
    .eq('email', normalizedEmail)
    .in('channel', ['email', 'all'])
    .is('lifted_at', null)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .in('suppression_type', EMAIL_SUPPRESSION_TYPES as unknown as string[])
    .limit(10);

  if (Array.isArray(suppressions) && suppressions.length > 0) {
    const bypassTypeSet = buildBypassTypeSet(options);
    const effectiveSuppressions = suppressions.filter((s: any) => {
      const suppressionType = normalizeSuppressionType(String(s?.suppression_type || ''));
      return !bypassTypeSet.has(suppressionType);
    });

    if (effectiveSuppressions.length === 0) {
      return { allowed: true };
    }

    const reason = pickMostSevereReason(
      effectiveSuppressions.map((s: any) => suppressionTypeToReason(s?.suppression_type))
    ) || 'unsubscribed';
    return {
      allowed: false,
      reason,
      suppressionType: String(effectiveSuppressions[0]?.suppression_type || '')
    };
  }

  return { allowed: true };
}

/**
 * Batch check multiple emails for send eligibility
 * More efficient than individual checks for campaigns
 */
export async function canSendEmailBatch(
  supabase: any,
  params: {
    tenantId: string;
    recipients: Array<{ customerId?: string; email: string }>;
  },
  options?: SuppressionBypassOptions
): Promise<Map<string, CanSendResult>> {
  const { tenantId, recipients } = params;
  const results = new Map<string, CanSendResult>();
  const nowIso = new Date().toISOString();
  const roleBasedBlockingEnabled = isTruthyEnv(Deno.env.get('BLOCK_ROLE_BASED_EMAILS'));

  // Collect all emails
  const emails = recipients
    .map(r => r.email?.toLowerCase().trim())
    .filter(Boolean);

  const uniqueEmails = Array.from(new Set(emails));

  if (uniqueEmails.length === 0) {
    return results;
  }

  const globalSuppressedEmails = new Set<string>();
  const GLOBAL_IN_CHUNK = 200;
  for (let i = 0; i < uniqueEmails.length; i += GLOBAL_IN_CHUNK) {
    const chunk = uniqueEmails.slice(i, i + GLOBAL_IN_CHUNK);
    const { data: globalSuppressions, error: globalError } = await supabase
      .from('global_email_suppression_list')
      .select('email')
      .is('lifted_at', null)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .in('email', chunk);

    if (globalError) {
      console.warn('[canSendEmailBatch] Failed to fetch global suppression chunk:', globalError.message);
      continue;
    }

    for (const s of globalSuppressions || []) {
      const key = String(s.email || '').toLowerCase();
      if (key) globalSuppressedEmails.add(key);
    }
  }

  // Batch fetch suppressions (chunked to avoid large IN lists)
  const suppressionMap = new Map<string, string[]>();
  const IN_CHUNK = 200;
  for (let i = 0; i < uniqueEmails.length; i += IN_CHUNK) {
    const chunk = uniqueEmails.slice(i, i + IN_CHUNK);
    const { data: suppressions, error } = await supabase
      .from('suppression_list')
      .select('email, suppression_type')
      .eq('tenant_id', tenantId)
      .in('channel', ['email', 'all'])
      .is('lifted_at', null)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .in('suppression_type', EMAIL_SUPPRESSION_TYPES as unknown as string[])
      .in('email', chunk);

    if (error) {
      console.warn('[canSendEmailBatch] Failed to fetch suppression_list chunk:', error.message);
      continue;
    }

    for (const s of suppressions || []) {
      const key = String(s.email || '').toLowerCase();
      const arr = suppressionMap.get(key) || [];
      arr.push(String(s.suppression_type || ''));
      suppressionMap.set(key, arr);
    }
  }

  const bypassTypeSet = buildBypassTypeSet(options);

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

    if (roleBasedBlockingEnabled && isRoleBasedEmail(email)) {
      results.set(email, {
        allowed: false,
        reason: 'role_based',
        suppressionType: 'role_based'
      });
      continue;
    }

    if (globalSuppressedEmails.has(email)) {
      results.set(email, {
        allowed: false,
        reason: 'globally_blocked',
        suppressionType: 'global_block'
      });
      continue;
    }

    // Check suppression
    const suppressionTypes = suppressionMap.get(email);
    const effectiveSuppressionTypes = (suppressionTypes || []).filter(
      (suppressionType) => !bypassTypeSet.has(normalizeSuppressionType(suppressionType))
    );

    if (effectiveSuppressionTypes.length > 0) {
      const reason = pickMostSevereReason(effectiveSuppressionTypes.map(suppressionTypeToReason));
      results.set(email, {
        allowed: false,
        reason: reason || 'unsubscribed',
        suppressionType: effectiveSuppressionTypes[0]
      });
      continue;
    }

    results.set(email, { allowed: true });
  }

  return results;
}

/**
 * Log skipped sends to email_send_skips table
 */
export async function logSkippedSends(
  supabase: any,
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
