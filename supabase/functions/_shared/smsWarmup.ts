/**
 * SMS Warmup Helper Module
 * Provides centralized warmup logic for SMS sending identities
 */

import { SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface SmsWarmupInfo {
  sendingIdentityId: string;
  fromPhone: string | null;
  messagingServiceSid: string | null;
  warmupStage: number;
  dailyLimit: number;
  dailySentCount: number;
  remainingToday: number;
  healthyDaysCounter: number;
  lastStageUpdatedAt: string | null;
  lastResetAt: string | null;
}

export interface GetSmsWarmupInfoOptions {
  fromPhone?: string | null;
  messagingServiceSid?: string | null;
}

export interface SmsWarmupStageRule {
  stage: number;
  dailyLimit: number;
  requiredHealthyDays: number;
}

/**
 * Get SMS warmup info by phone number or messaging service SID
 */
export async function getSmsWarmupInfoByPhoneOrMessagingService(
  supabase: SupabaseClient,
  opts: GetSmsWarmupInfoOptions
): Promise<SmsWarmupInfo> {
  if (!opts.fromPhone && !opts.messagingServiceSid) {
    throw new Error('Either fromPhone or messagingServiceSid must be provided');
  }

  // Call the SQL function
  const { data, error } = await supabase.rpc('get_sms_warmup_info', {
    p_phone_number: opts.fromPhone || null,
    p_messaging_service_sid: opts.messagingServiceSid || null,
  });

  if (error) {
    throw new Error(`Failed to get SMS warmup info: ${error.message}`);
  }

  if (!data || data.length === 0) {
    const identifier = opts.fromPhone 
      ? `phone: ${opts.fromPhone}` 
      : `messaging_service_sid: ${opts.messagingServiceSid}`;
    throw new Error(`No SMS sending identity found for ${identifier}`);
  }

  const row = data[0];
  
  return {
    sendingIdentityId: row.sending_identity_id,
    fromPhone: row.phone_number,
    messagingServiceSid: row.messaging_service_sid,
    warmupStage: row.warmup_stage,
    dailyLimit: row.daily_limit,
    dailySentCount: row.daily_sent_count,
    remainingToday: row.remaining_today,
    healthyDaysCounter: row.healthy_days_counter,
    lastStageUpdatedAt: row.last_stage_updated_at,
    lastResetAt: row.last_reset_at,
  };
}

/**
 * Ensure a warmup row exists for a Messaging Service SID
 * Creates one with default values if not found
 */
export async function ensureSmsWarmupRowForMessagingServiceIfNeeded(
  supabase: SupabaseClient,
  messagingServiceSid: string,
  tenantId: string
): Promise<SmsWarmupInfo> {
  // First, try to find existing row
  const { data: existing, error: findError } = await supabase
    .from('twilio_phone_numbers')
    .select('*')
    .eq('messaging_service_sid', messagingServiceSid)
    .maybeSingle();

  if (findError) {
    throw new Error(`Failed to check for existing SMS identity: ${findError.message}`);
  }

  if (existing) {
    // Return existing row's warmup info
    return getSmsWarmupInfoByPhoneOrMessagingService(supabase, { messagingServiceSid });
  }

  // Create new row with high limits (warmup removed)
  const { error: insertError } = await supabase
    .from('twilio_phone_numbers')
    .insert({
      tenant_id: tenantId,
      messaging_service_sid: messagingServiceSid,
      phone_number: `MSG_SVC_${messagingServiceSid.substring(0, 8)}`,
      friendly_name: `Messaging Service ${messagingServiceSid.substring(0, 8)}`,
      warmup_stage: 4,  // Start at max stage
      daily_sent_count: 0,
      healthy_days_counter: 0,
      is_active: true,
    });

  if (insertError) {
    throw new Error(`Failed to create SMS warmup row: ${insertError.message}`);
  }

  // Fetch warmup info for the new row
  return getSmsWarmupInfoByPhoneOrMessagingService(supabase, { messagingServiceSid });
}

/**
 * Get all SMS warmup stage rules
 */
export async function getSmsWarmupStageRules(
  supabase: SupabaseClient
): Promise<SmsWarmupStageRule[]> {
  const { data, error } = await supabase
    .from('sms_warmup_stage_rules')
    .select('*')
    .order('stage', { ascending: true });

  if (error) {
    throw new Error(`Failed to get SMS warmup stage rules: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error('SMS warmup stage rules not found. Database may not be properly seeded.');
  }

  return data.map(rule => ({
    stage: rule.stage,
    dailyLimit: rule.daily_limit,
    requiredHealthyDays: rule.required_healthy_days,
  }));
}

/**
 * Check if sending count SMS messages would exceed warmup limit
 * Note: Warmup limits have been removed - this always returns false
 */
export function wouldExceedWarmupLimit(
  warmupInfo: SmsWarmupInfo,
  requestedCount: number
): boolean {
  // Warmup limits removed - never block sending
  return false;
}

/**
 * Get a human-readable warmup stage name
 */
export function getWarmupStageName(stage: number): string {
  const stageNames: Record<number, string> = {
    0: 'Initial',
    1: 'Building',
    2: 'Growing',
    3: 'Established',
    4: 'Full Capacity',
  };
  return stageNames[stage] || `Stage ${stage}`;
}
