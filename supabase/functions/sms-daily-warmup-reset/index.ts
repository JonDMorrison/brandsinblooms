import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Health thresholds
const HEALTHY_FAILURE_RATE_THRESHOLD = 0.02; // 2% - considered healthy
const BAD_FAILURE_RATE_THRESHOLD = 0.05; // 5% - triggers downgrade
const MAX_WARMUP_STAGE = 4;
const MIN_WARMUP_STAGE = 0;

// Twilio error codes considered as "bounces" (undeliverable)
const BOUNCE_ERROR_CODES = ['30003', '30004', '30005', '30006', '30007', '21211', '21614'];

interface WarmupStageRule {
  stage: number;
  daily_limit: number;
  required_healthy_days: number;
}

interface SendingIdentity {
  id: string;
  tenant_id: string;
  phone_number: string;
  messaging_service_sid: string | null;
  warmup_stage: number;
  daily_sent_count: number;
  healthy_days_counter: number;
  last_reset_at: string | null;
  last_health_evaluated_at: string | null;
  last_stage_updated_at: string | null;
  failure_rate_30d: number | null;
  bounce_rate_30d: number | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();
    const todayUtc = now.toISOString().slice(0, 10); // 'YYYY-MM-DD'

    console.log(`[sms-daily-warmup-reset] Starting daily warmup reset for ${todayUtc}`);

    // Stats for logging
    let identitiesProcessed = 0;
    let dailyCountersReset = 0;
    let stageAdvancements = 0;
    let stageDowngrades = 0;
    let noDataIdentities = 0;

    // ============================================================
    // STEP 1: Reset daily_sent_count for identities not yet reset today
    // ============================================================
    const { data: resetResult, error: resetError } = await supabase
      .from('twilio_phone_numbers')
      .update({
        daily_sent_count: 0,
        last_reset_at: now.toISOString(),
      })
      .or(`last_reset_at.is.null,last_reset_at.lt.${todayUtc}`)
      .select('id');

    if (resetError) {
      console.error('[sms-daily-warmup-reset] Error resetting daily counters:', resetError);
    } else {
      dailyCountersReset = resetResult?.length || 0;
      console.log(`[sms-daily-warmup-reset] Reset daily_sent_count for ${dailyCountersReset} identities`);
    }

    // ============================================================
    // STEP 2: Load all sending identities that need health evaluation
    // ============================================================
    const { data: identities, error: identitiesError } = await supabase
      .from('twilio_phone_numbers')
      .select('*')
      .eq('is_active', true)
      .or(`last_health_evaluated_at.is.null,last_health_evaluated_at.lt.${todayUtc}`);

    if (identitiesError) {
      console.error('[sms-daily-warmup-reset] Error loading identities:', identitiesError);
      throw identitiesError;
    }

    if (!identities || identities.length === 0) {
      console.log('[sms-daily-warmup-reset] No identities need health evaluation today');
      return new Response(JSON.stringify({
        success: true,
        message: 'No identities need health evaluation today',
        stats: { dailyCountersReset, identitiesProcessed: 0 }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============================================================
    // STEP 3: Load warmup stage rules
    // ============================================================
    const { data: stageRules, error: rulesError } = await supabase
      .from('sms_warmup_stage_rules')
      .select('*')
      .order('stage', { ascending: true });

    if (rulesError) {
      console.error('[sms-daily-warmup-reset] Error loading stage rules:', rulesError);
      throw rulesError;
    }

    const stageRulesMap = new Map<number, WarmupStageRule>();
    for (const rule of stageRules || []) {
      stageRulesMap.set(rule.stage, rule);
    }

    // ============================================================
    // STEP 4: Compute 30-day metrics for all identities
    // ============================================================
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Get all phone numbers we need to query
    const phoneNumbers = identities.map(i => i.phone_number).filter(Boolean);

    // Query 30-day message stats grouped by from_phone
    const { data: messageStats, error: statsError } = await supabase
      .from('sms_messages')
      .select('from_phone, status, error_message')
      .in('from_phone', phoneNumbers)
      .gte('created_at', thirtyDaysAgo)
      .in('status', ['sent', 'delivered', 'failed']);

    if (statsError) {
      console.error('[sms-daily-warmup-reset] Error loading message stats:', statsError);
      // Continue processing with no data
    }

    // Aggregate stats by phone number
    const statsMap = new Map<string, { totalSent: number; totalFailed: number; totalBounced: number }>();
    for (const msg of messageStats || []) {
      if (!msg.from_phone) continue;
      
      const existing = statsMap.get(msg.from_phone) || { totalSent: 0, totalFailed: 0, totalBounced: 0 };
      existing.totalSent++;
      
      if (msg.status === 'failed') {
        existing.totalFailed++;
        
        // Check for bounce error codes in error_message
        const errorMsg = msg.error_message || '';
        const isBounce = BOUNCE_ERROR_CODES.some(code => errorMsg.includes(code));
        if (isBounce) {
          existing.totalBounced++;
        }
      }
      
      statsMap.set(msg.from_phone, existing);
    }

    // ============================================================
    // STEP 5: Process each identity for health evaluation and stage evolution
    // ============================================================
    for (const identity of identities as SendingIdentity[]) {
      identitiesProcessed++;

      const stats = statsMap.get(identity.phone_number);
      
      let failureRate: number | null = null;
      let bounceRate: number | null = null;

      if (stats && stats.totalSent > 0) {
        failureRate = stats.totalFailed / stats.totalSent;
        bounceRate = stats.totalBounced / stats.totalSent;
      } else {
        noDataIdentities++;
      }

      // Get current stage rule
      const currentRule = stageRulesMap.get(identity.warmup_stage);
      const requiredHealthyDays = currentRule?.required_healthy_days || 7;

      // Calculate new values
      let newHealthyDaysCounter = identity.healthy_days_counter;
      let newWarmupStage = identity.warmup_stage;
      let stageChanged = false;

      // Health evaluation
      if (failureRate !== null) {
        if (failureRate < HEALTHY_FAILURE_RATE_THRESHOLD) {
          // Healthy day - increment counter
          newHealthyDaysCounter++;
          console.log(`[sms-daily-warmup-reset] ${identity.phone_number}: Healthy day (failure rate: ${(failureRate * 100).toFixed(2)}%), counter: ${newHealthyDaysCounter}`);
        } else if (failureRate > BAD_FAILURE_RATE_THRESHOLD) {
          // Bad day - reset counter and potentially downgrade
          newHealthyDaysCounter = 0;
          console.log(`[sms-daily-warmup-reset] ${identity.phone_number}: Bad day (failure rate: ${(failureRate * 100).toFixed(2)}%), resetting counter`);

          // Downgrade stage if above minimum
          if (newWarmupStage > MIN_WARMUP_STAGE) {
            newWarmupStage--;
            stageChanged = true;
            stageDowngrades++;
            console.log(`[sms-daily-warmup-reset] ${identity.phone_number}: Downgrading to stage ${newWarmupStage}`);
          }
        }
        // If between thresholds, leave counter unchanged
      }

      // Stage advancement check (only if not already downgraded)
      if (!stageChanged && newHealthyDaysCounter >= requiredHealthyDays && newWarmupStage < MAX_WARMUP_STAGE) {
        newWarmupStage++;
        newHealthyDaysCounter = 0;
        stageChanged = true;
        stageAdvancements++;
        console.log(`[sms-daily-warmup-reset] ${identity.phone_number}: Advancing to stage ${newWarmupStage} after ${requiredHealthyDays} healthy days`);
      }

      // Update the identity
      const updateData: Record<string, unknown> = {
        failure_rate_30d: failureRate,
        bounce_rate_30d: bounceRate,
        healthy_days_counter: newHealthyDaysCounter,
        last_health_evaluated_at: now.toISOString(),
        updated_at: now.toISOString(),
      };

      if (stageChanged) {
        updateData.warmup_stage = newWarmupStage;
        updateData.last_stage_updated_at = now.toISOString();
      }

      const { error: updateError } = await supabase
        .from('twilio_phone_numbers')
        .update(updateData)
        .eq('id', identity.id);

      if (updateError) {
        console.error(`[sms-daily-warmup-reset] Error updating identity ${identity.phone_number}:`, updateError);
      }
    }

    // ============================================================
    // STEP 6: Log summary
    // ============================================================
    console.log('[sms-daily-warmup-reset] Daily warmup reset complete:', {
      dailyCountersReset,
      identitiesProcessed,
      stageAdvancements,
      stageDowngrades,
      noDataIdentities,
    });

    return new Response(JSON.stringify({
      success: true,
      stats: {
        dailyCountersReset,
        identitiesProcessed,
        stageAdvancements,
        stageDowngrades,
        noDataIdentities,
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[sms-daily-warmup-reset] Fatal error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
