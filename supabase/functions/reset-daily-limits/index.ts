import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Thresholds for health assessment
const BOUNCE_RATE_WARNING = 0.02; // 2%
const BOUNCE_RATE_CRITICAL = 0.05; // 5%
const COMPLAINT_RATE_WARNING = 0.001; // 0.1%
const COMPLAINT_RATE_CRITICAL = 0.002; // 0.2%

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Starting nightly domain limit reset and warmup stage evaluation...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all active domains with their current stats
    const { data: domains, error: domainsError } = await supabase
      .from('email_domains')
      .select(`
        id,
        domain,
        tenant_id,
        status,
        warmup_stage,
        daily_limit,
        daily_sent_count,
        healthy_days_counter,
        last_stage_updated_at,
        last_daily_reset_at
      `)
      .in('status', ['active', 'warming_up']);

    if (domainsError) {
      console.error('Error fetching domains:', domainsError);
      throw domainsError;
    }

    console.log(`📊 Processing ${domains?.length || 0} active/warming domains`);

    const results = {
      processed: 0,
      advanced: 0,
      downgraded: 0,
      maintained: 0,
      errors: 0
    };

    for (const domain of domains || []) {
      try {
        console.log(`\n📧 Processing domain: ${domain.domain} (stage ${domain.warmup_stage})`);

        // Get 30-day stats for this domain
        const { data: stats, error: statsError } = await supabase
          .from('email_domain_stats_30d')
          .select('*')
          .eq('domain_id', domain.id)
          .single();

        if (statsError && statsError.code !== 'PGRST116') {
          console.error(`Error fetching stats for ${domain.domain}:`, statsError);
        }

        const bounceRate = stats?.bounce_rate_30d || 0;
        const complaintRate = stats?.complaint_rate_30d || 0;
        const sentToday = domain.daily_sent_count || 0;

        console.log(`  Stats: sent_today=${sentToday}, bounce_rate=${(bounceRate * 100).toFixed(2)}%, complaint_rate=${(complaintRate * 100).toFixed(3)}%`);

        // Get warmup rules for current and next stage
        const { data: currentRule } = await supabase
          .from('warmup_stage_rules')
          .select('*')
          .eq('stage', domain.warmup_stage)
          .single();

        const { data: nextRule } = await supabase
          .from('warmup_stage_rules')
          .select('*')
          .eq('stage', domain.warmup_stage + 1)
          .single();

        const { data: prevRule } = await supabase
          .from('warmup_stage_rules')
          .select('*')
          .eq('stage', Math.max(0, domain.warmup_stage - 1))
          .single();

        // Determine health status
        let isHealthyDay = true;
        let downgradeReason = null;

        // Check for critical issues that warrant downgrade
        if (complaintRate >= COMPLAINT_RATE_CRITICAL) {
          isHealthyDay = false;
          downgradeReason = `Critical complaint rate: ${(complaintRate * 100).toFixed(3)}%`;
        } else if (bounceRate >= BOUNCE_RATE_CRITICAL) {
          isHealthyDay = false;
          downgradeReason = `Critical bounce rate: ${(bounceRate * 100).toFixed(2)}%`;
        } else if (bounceRate >= BOUNCE_RATE_WARNING || complaintRate >= COMPLAINT_RATE_WARNING) {
          isHealthyDay = false;
          downgradeReason = `Warning thresholds exceeded`;
        }

        // Calculate new healthy days counter
        let newHealthyDays = isHealthyDay 
          ? (domain.healthy_days_counter || 0) + 1 
          : 0; // Reset if unhealthy

        // Determine stage changes
        let newStage = domain.warmup_stage;
        let stageChange = null;

        // Check for downgrade (critical issues)
        if (downgradeReason && domain.warmup_stage > 0) {
          newStage = Math.max(0, domain.warmup_stage - 1);
          stageChange = 'downgrade';
          newHealthyDays = 0;
          console.log(`  ⚠️ DOWNGRADE: ${downgradeReason}`);
          results.downgraded++;
        }
        // Check for advancement
        else if (
          nextRule &&
          currentRule &&
          isHealthyDay &&
          newHealthyDays >= currentRule.required_healthy_days
        ) {
          newStage = domain.warmup_stage + 1;
          stageChange = 'advance';
          newHealthyDays = 0; // Reset counter after advancement
          console.log(`  🎉 ADVANCE: ${currentRule.required_healthy_days} healthy days reached, moving to stage ${newStage}`);
          results.advanced++;
        } else {
          results.maintained++;
          console.log(`  ✅ MAINTAIN: ${newHealthyDays}/${currentRule?.required_healthy_days || '?'} healthy days`);
        }

        // Get new daily limit from rules
        const { data: newStageRule } = await supabase
          .from('warmup_stage_rules')
          .select('daily_limit')
          .eq('stage', newStage)
          .single();

        const newDailyLimit = newStageRule?.daily_limit || domain.daily_limit;

        // Update domain
        const updateData: any = {
          daily_sent_count: 0, // Reset daily counter
          healthy_days_counter: newHealthyDays,
          last_daily_reset_at: new Date().toISOString()
        };

        if (stageChange) {
          updateData.warmup_stage = newStage;
          updateData.daily_limit = newDailyLimit;
          updateData.last_stage_updated_at = new Date().toISOString();
        }

        const { error: updateError } = await supabase
          .from('email_domains')
          .update(updateData)
          .eq('id', domain.id);

        if (updateError) {
          console.error(`Error updating domain ${domain.domain}:`, updateError);
          results.errors++;
        } else {
          results.processed++;
          console.log(`  📝 Updated: stage=${newStage}, daily_limit=${newDailyLimit}, healthy_days=${newHealthyDays}`);
        }

        // Log significant events
        if (stageChange) {
          await supabase
            .from('domain_send_log')
            .insert({
              domain_id: domain.id,
              emails_sent: 0,
              warmup_stage: newStage,
              daily_limit_at_send: newDailyLimit,
              campaign_id: null
            });
        }

      } catch (domainError: any) {
        console.error(`Error processing domain ${domain.domain}:`, domainError);
        results.errors++;
      }
    }

    console.log('\n✅ Nightly reset complete:', results);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Nightly domain reset complete',
        results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Critical error in reset-daily-limits:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
