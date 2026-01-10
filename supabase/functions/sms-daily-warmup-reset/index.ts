import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * SMS Daily Reset Function
 * 
 * This function now only resets daily counters and updates health metrics.
 * Warmup stage progression has been removed - all numbers operate at full capacity.
 */

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

    console.log(`[sms-daily-reset] Starting daily reset for ${todayUtc}`);

    // Stats for logging
    let dailyCountersReset = 0;

    // Reset daily_sent_count for all identities not yet reset today
    const { data: resetResult, error: resetError } = await supabase
      .from('twilio_phone_numbers')
      .update({
        daily_sent_count: 0,
        last_reset_at: now.toISOString(),
      })
      .or(`last_reset_at.is.null,last_reset_at.lt.${todayUtc}`)
      .select('id');

    if (resetError) {
      console.error('[sms-daily-reset] Error resetting daily counters:', resetError);
    } else {
      dailyCountersReset = resetResult?.length || 0;
      console.log(`[sms-daily-reset] Reset daily_sent_count for ${dailyCountersReset} identities`);
    }

    // Update all identities to max warmup stage (4) if they're not already
    // This ensures any legacy identities are brought to full capacity
    const { data: upgraded, error: upgradeError } = await supabase
      .from('twilio_phone_numbers')
      .update({
        warmup_stage: 4,
        updated_at: now.toISOString(),
      })
      .lt('warmup_stage', 4)
      .eq('is_active', true)
      .select('id');

    if (upgradeError) {
      console.error('[sms-daily-reset] Error upgrading warmup stages:', upgradeError);
    } else if (upgraded && upgraded.length > 0) {
      console.log(`[sms-daily-reset] Upgraded ${upgraded.length} identities to full capacity`);
    }

    console.log('[sms-daily-reset] Daily reset complete:', {
      dailyCountersReset,
      identitiesUpgraded: upgraded?.length || 0,
    });

    return new Response(JSON.stringify({
      success: true,
      stats: {
        dailyCountersReset,
        identitiesUpgraded: upgraded?.length || 0,
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[sms-daily-reset] Fatal error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});