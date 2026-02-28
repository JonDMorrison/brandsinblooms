/**
 * Automation Email Execution Logging
 *
 * Provides per-recipient logging of automation email executions.
 * Every attempt creates an append-only row for visibility.
 */

import { createClient } from "npm:@supabase/supabase-js@2.7.1";
import { canSendEmail, type SkipReason } from './canSendEmail.ts';

type TenantSuppressionBypassState = {
  suppression_bypass_active: boolean;
  suppression_bypass_automation_mode: 'campaign_only' | 'campaign_and_automation';
};

async function getTenantSuppressionBypassState(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
): Promise<TenantSuppressionBypassState> {
  const { data, error } = await supabase.rpc('get_tenant_suppression_bypass_state', {
    p_tenant_id: tenantId,
  });

  if (error) {
    console.warn('[AutomationEmailExecution] Failed to fetch suppression bypass state:', error.message);
    return {
      suppression_bypass_active: false,
      suppression_bypass_automation_mode: 'campaign_only',
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const mode = String(row?.suppression_bypass_automation_mode || 'campaign_only')
    .toLowerCase() === 'campaign_and_automation'
    ? 'campaign_and_automation'
    : 'campaign_only';

  return {
    suppression_bypass_active: Boolean(row?.suppression_bypass_active),
    suppression_bypass_automation_mode: mode,
  };
}

export type ExecutionStatus = 'sent' | 'skipped' | 'failed';

export interface ExecutionLogEntry {
  tenant_id: string;
  automation_id: string;
  automation_node_id: string;
  customer_id?: string;
  email: string;
  status: ExecutionStatus;
  reason?: string;
  resend_message_id?: string;
  error?: string;
  outbox_id?: string;
}

/**
 * Log an automation email execution
 */
export async function logAutomationEmailExecution(
  supabase: ReturnType<typeof createClient>,
  entry: ExecutionLogEntry
): Promise<void> {
  const { error } = await supabase
    .from('automation_email_executions')
    .insert({
      tenant_id: entry.tenant_id,
      automation_id: entry.automation_id,
      automation_node_id: entry.automation_node_id,
      customer_id: entry.customer_id || null,
      email: entry.email,
      status: entry.status,
      reason: entry.reason || null,
      resend_message_id: entry.resend_message_id || null,
      error: entry.error || null,
      outbox_id: entry.outbox_id || null,
    });

  if (error) {
    console.error('[AutomationEmailExecution] Failed to log execution:', error);
  }
}

/**
 * Check if an email was already sent for this automation + node + customer
 * Returns true if a 'sent' execution exists.
 */
export async function checkAlreadySent(
  supabase: ReturnType<typeof createClient>,
  params: {
    automationId: string;
    automationNodeId: string;
    customerId: string;
  }
): Promise<boolean> {
  const { data } = await supabase
    .from('automation_email_executions')
    .select('id')
    .eq('automation_id', params.automationId)
    .eq('automation_node_id', params.automationNodeId)
    .eq('customer_id', params.customerId)
    .eq('status', 'sent')
    .limit(1)
    .maybeSingle();

  return !!data;
}

/**
 * Check suppression and opt-out status, log skip if needed
 * Returns { allowed: true } or { allowed: false, reason: string }
 */
export async function checkAndLogSuppression(
  supabase: ReturnType<typeof createClient>,
  params: {
    tenantId: string;
    automationId: string;
    automationNodeId: string;
    customerId?: string;
    email: string;
    outboxId?: string;
  }
): Promise<{ allowed: boolean; reason?: SkipReason }> {
  const bypassState = await getTenantSuppressionBypassState(supabase, params.tenantId);
  const bypassSuppressionTypes = (
    bypassState.suppression_bypass_active
    && bypassState.suppression_bypass_automation_mode === 'campaign_and_automation'
  )
    ? ['bounced', 'hard_bounce', 'complaint', 'complained']
    : [];

  const result = await canSendEmail(supabase, {
    tenantId: params.tenantId,
    customerId: params.customerId,
    email: params.email,
  }, {
    bypassSuppressionTypes,
  });

  if (!result.allowed && result.reason) {
    // Log the skip
    await logAutomationEmailExecution(supabase, {
      tenant_id: params.tenantId,
      automation_id: params.automationId,
      automation_node_id: params.automationNodeId,
      customer_id: params.customerId,
      email: params.email,
      status: 'skipped',
      reason: result.reason,
      outbox_id: params.outboxId,
    });
  }

  return result;
}

/**
 * Get execution stats for an automation node
 */
export async function getNodeExecutionStats(
  supabase: ReturnType<typeof createClient>,
  automationId: string,
  nodeId: string
): Promise<{
  sent: number;
  skipped: number;
  failed: number;
  byReason: Record<string, number>;
}> {
  const { data, error } = await supabase
    .from('automation_email_executions')
    .select('status, reason')
    .eq('automation_id', automationId)
    .eq('automation_node_id', nodeId);

  if (error || !data) {
    return { sent: 0, skipped: 0, failed: 0, byReason: {} };
  }

  const stats = {
    sent: 0,
    skipped: 0,
    failed: 0,
    byReason: {} as Record<string, number>,
  };

  for (const row of data) {
    if (row.status === 'sent') stats.sent++;
    else if (row.status === 'skipped') stats.skipped++;
    else if (row.status === 'failed') stats.failed++;

    if (row.reason) {
      stats.byReason[row.reason] = (stats.byReason[row.reason] || 0) + 1;
    }
  }

  return stats;
}

/**
 * Get failed executions for retry
 */
export async function getFailedExecutions(
  supabase: ReturnType<typeof createClient>,
  automationId: string,
  nodeId: string
): Promise<Array<{
  id: string;
  customer_id: string;
  email: string;
  error: string;
  created_at: string;
}>> {
  const { data, error } = await supabase
    .from('automation_email_executions')
    .select('id, customer_id, email, error, created_at')
    .eq('automation_id', automationId)
    .eq('automation_node_id', nodeId)
    .eq('status', 'failed')
    // Exclude suppression-related failures (those shouldn't be retried)
    .not('reason', 'in', '(suppressed,opt_out,unsubscribed,bounced,complained)')
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  // Deduplicate by customer_id, keep most recent failure
  const seen = new Set<string>();
  const result: typeof data = [];

  for (const row of data) {
    if (row.customer_id && !seen.has(row.customer_id)) {
      seen.add(row.customer_id);
      result.push(row);
    }
  }

  return result;
}
