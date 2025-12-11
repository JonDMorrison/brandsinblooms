import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Stage labels and descriptions
const STAGE_INFO: Record<number, { label: string; description: string }> = {
  0: { 
    label: 'New Domain', 
    description: 'Building initial reputation. Send volume is limited to protect deliverability.' 
  },
  1: { 
    label: 'Early Warmup', 
    description: 'Your domain is gaining trust. Gradually increasing send limits.' 
  },
  2: { 
    label: 'Growing', 
    description: 'Good progress! Email providers are recognizing your domain.' 
  },
  3: { 
    label: 'Established', 
    description: 'Strong reputation. Higher volume unlocked.' 
  },
  4: { 
    label: 'Fully Warmed', 
    description: 'Maximum sending capacity reached. Maintain good practices.' 
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header and extract user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's tenant
    const { data: userData } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!userData?.tenant_id) {
      return new Response(
        JSON.stringify({ error: 'No tenant found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = userData.tenant_id;

    // Get all active domains for the tenant
    const { data: domains, error: domainsError } = await supabase
      .from('email_domains')
      .select(`
        id,
        domain,
        status,
        warmup_stage,
        daily_limit,
        daily_used,
        daily_sent_count,
        healthy_days_counter,
        last_stage_updated_at,
        last_daily_reset_at,
        is_entri_managed
      `)
      .eq('tenant_id', tenantId)
      .in('status', ['active', 'warming_up', 'pending_dns', 'verifying']);

    if (domainsError) {
      console.error('Error fetching domains:', domainsError);
      throw domainsError;
    }

    // Get warmup rules
    const { data: rules } = await supabase
      .from('warmup_stage_rules')
      .select('*')
      .order('stage', { ascending: true });

    const rulesMap = new Map(rules?.map(r => [r.stage, r]) || []);

    // Build response for each domain
    const domainStatuses = await Promise.all((domains || []).map(async (domain) => {
      const currentRule = rulesMap.get(domain.warmup_stage);
      const nextRule = rulesMap.get(domain.warmup_stage + 1);
      
      const dailyLimit = currentRule?.daily_limit || domain.daily_limit || 50;
      const dailySent = domain.daily_sent_count || domain.daily_used || 0;
      const remaining = Math.max(0, dailyLimit - dailySent);
      const usagePercent = dailyLimit > 0 ? (dailySent / dailyLimit) * 100 : 0;
      
      // Get 30-day stats
      const { data: stats } = await supabase
        .from('email_domain_stats_30d')
        .select('bounce_rate_30d, complaint_rate_30d, open_rate_30d, emails_sent_30d')
        .eq('domain_id', domain.id)
        .single();

      // Determine progress to next stage
      const healthyDays = domain.healthy_days_counter || 0;
      const requiredDays = currentRule?.required_healthy_days || 0;
      const stageProgress = requiredDays > 0 ? Math.min(100, (healthyDays / requiredDays) * 100) : 100;

      // Build reason for current stage
      let stageReason = '';
      if (domain.warmup_stage === 0) {
        stageReason = 'Domain is new and building initial reputation.';
      } else if (domain.warmup_stage === 4) {
        stageReason = 'Domain has reached maximum warmup. Maintain good sending practices.';
      } else if (healthyDays > 0) {
        stageReason = `${healthyDays} of ${requiredDays} healthy days completed for next stage.`;
      } else if (stats?.bounce_rate_30d > 0.02 || stats?.complaint_rate_30d > 0.001) {
        stageReason = 'Recent bounce or complaint rates are elevated. Healthy day counter reset.';
      } else {
        stageReason = 'Building reputation. Keep sending quality emails.';
      }

      // Warning level
      let warningLevel: 'none' | 'approaching' | 'critical' = 'none';
      if (usagePercent >= 90) {
        warningLevel = 'critical';
      } else if (usagePercent >= 75) {
        warningLevel = 'approaching';
      }

      const stageInfo = STAGE_INFO[domain.warmup_stage] || STAGE_INFO[0];

      return {
        domain_id: domain.id,
        domain_name: domain.domain,
        status: domain.status,
        is_entri_managed: domain.is_entri_managed,
        
        // Warmup stage info
        warmup_stage: domain.warmup_stage,
        stage_label: stageInfo.label,
        stage_description: stageInfo.description,
        stage_reason: stageReason,
        
        // Progress to next stage
        healthy_days: healthyDays,
        required_healthy_days: requiredDays,
        stage_progress_percent: Math.round(stageProgress),
        next_stage: nextRule ? domain.warmup_stage + 1 : null,
        next_stage_limit: nextRule?.daily_limit || null,
        
        // Today's limits
        daily_limit: dailyLimit,
        daily_sent: dailySent,
        remaining_today: remaining,
        usage_percent: Math.round(usagePercent),
        warning_level: warningLevel,
        
        // Health metrics
        bounce_rate_30d: stats?.bounce_rate_30d || 0,
        complaint_rate_30d: stats?.complaint_rate_30d || 0,
        open_rate_30d: stats?.open_rate_30d || 0,
        emails_sent_30d: stats?.emails_sent_30d || 0,
        
        // Timestamps
        last_stage_updated_at: domain.last_stage_updated_at,
        last_daily_reset_at: domain.last_daily_reset_at
      };
    }));

    // Also return fallback/shared sender status if no custom domains
    const hasDomains = domainStatuses.length > 0;

    return new Response(
      JSON.stringify({
        success: true,
        has_custom_domain: hasDomains,
        domains: domainStatuses,
        warmup_stages: rules?.map(r => ({
          stage: r.stage,
          daily_limit: r.daily_limit,
          required_healthy_days: r.required_healthy_days,
          label: STAGE_INFO[r.stage]?.label || `Stage ${r.stage}`,
          description: STAGE_INFO[r.stage]?.description || ''
        })) || []
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in get-warmup-status:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
