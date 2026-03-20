import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Customer {
  id: string;
  tenant_id: string;
  email: string;
  email_opt_in: boolean;
  sms_opt_in: boolean;
  email_opt_out_at: string | null;
  sms_opt_out_at: string | null;
  total_emails_sent: number;
  total_emails_opened: number;
  total_emails_clicked: number;
  total_emails_bounced: number;
  total_hard_bounces: number;
  total_soft_bounces: number;
  total_unsubscribes: number;
  last_email_sent_at: string | null;
  last_open_at: string | null;
  last_email_clicked_at: string | null;
  last_purchase_date: string | null;
  total_spent: number;
  created_at: string;
}

interface RiskSignal {
  customer_id: string;
  tenant_id: string;
  rapid_opt_out_score: number;
  message_ignore_streak: number;
  coupon_abuse_flag: boolean;
  coupon_abuse_count: number;
  hard_bounce_count: number;
  soft_bounce_count: number;
  inactivity_days: number;
  complaint_count: number;
  overall_risk_score: number;
  churn_probability: number;
  engagement_decay_rate: number;
  risk_factors: string[];
  last_calculated_at: string;
  calculation_version: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // SECURITY: E13 - Add JWT authentication to prevent unauthenticated access
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Authorization required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const token = authHeader.replace('Bearer ', '');
  const supabaseAuth = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const startTime = Date.now();
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { tenant_id, customer_id } = await req.json().catch(() => ({}));

    console.log(`[calculate-risk-signals] Starting for tenant: ${tenant_id || 'all'}, customer: ${customer_id || 'all'}`);

    // Build customer query
    let customersQuery = supabase
      .from('crm_customers')
      .select('*')
      .eq('suppressed', false);

    if (tenant_id) {
      customersQuery = customersQuery.eq('tenant_id', tenant_id);
    }
    if (customer_id) {
      customersQuery = customersQuery.eq('id', customer_id);
    }

    const { data: customers, error: customersError } = await customersQuery;

    if (customersError) {
      console.error('[calculate-risk-signals] Error fetching customers:', customersError);
      throw customersError;
    }

    if (!customers || customers.length === 0) {
      console.log('[calculate-risk-signals] No customers to process');
      return new Response(
        JSON.stringify({ success: true, message: 'No customers to process', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[calculate-risk-signals] Processing ${customers.length} customers`);

    const riskSignals: Partial<RiskSignal>[] = [];

    for (const customer of customers as Customer[]) {
      const riskSignal = calculateRiskSignals(customer);
      riskSignals.push(riskSignal);
    }

    // Batch upsert risk signals
    const { error: upsertError } = await supabase
      .from('customer_risk_signals')
      .upsert(riskSignals, { 
        onConflict: 'customer_id',
        ignoreDuplicates: false 
      });

    if (upsertError) {
      console.error('[calculate-risk-signals] Error upserting risk signals:', upsertError);
      throw upsertError;
    }

    const duration = Date.now() - startTime;
    console.log(`[calculate-risk-signals] Completed in ${duration}ms for ${riskSignals.length} customers`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: riskSignals.length,
        duration_ms: duration
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[calculate-risk-signals] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Calculate risk signals for a customer
 */
function calculateRiskSignals(customer: Customer): Partial<RiskSignal> {
  const now = new Date();
  const riskFactors: string[] = [];
  
  // Calculate inactivity days
  const lastEngagementDate = getLatestDate([
    customer.last_open_at,
    customer.last_email_clicked_at,
    customer.last_purchase_date
  ]);
  const inactivityDays = lastEngagementDate 
    ? Math.floor((now.getTime() - new Date(lastEngagementDate).getTime()) / (1000 * 60 * 60 * 24))
    : Math.floor((now.getTime() - new Date(customer.created_at).getTime()) / (1000 * 60 * 60 * 24));

  // Rapid opt-out score (if opted out within 7 days of signup)
  let rapidOptOutScore = 0;
  if (customer.email_opt_out_at) {
    const daysToOptOut = Math.floor(
      (new Date(customer.email_opt_out_at).getTime() - new Date(customer.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysToOptOut <= 7) {
      rapidOptOutScore = Math.max(0, 100 - (daysToOptOut * 10));
      riskFactors.push('rapid_email_optout');
    }
  }
  if (customer.sms_opt_out_at) {
    const daysToOptOut = Math.floor(
      (new Date(customer.sms_opt_out_at).getTime() - new Date(customer.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysToOptOut <= 7) {
      rapidOptOutScore = Math.max(rapidOptOutScore, 100 - (daysToOptOut * 10));
      riskFactors.push('rapid_sms_optout');
    }
  }

  // Message ignore streak (emails sent but not opened)
  let messageIgnoreStreak = 0;
  if (customer.total_emails_sent > 0 && customer.total_emails_opened === 0) {
    messageIgnoreStreak = customer.total_emails_sent;
    if (messageIgnoreStreak >= 5) {
      riskFactors.push('high_ignore_streak');
    }
  }

  // Bounce analysis
  const hardBounceCount = customer.total_hard_bounces || 0;
  const softBounceCount = customer.total_soft_bounces || 0;
  if (hardBounceCount > 0) {
    riskFactors.push('hard_bounce_history');
  }
  if (softBounceCount >= 3) {
    riskFactors.push('recurring_soft_bounces');
  }

  // Inactivity risk
  if (inactivityDays > 90) {
    riskFactors.push('long_term_inactive');
  } else if (inactivityDays > 30) {
    riskFactors.push('recently_inactive');
  }

  // Engagement decay rate (simplified)
  let engagementDecayRate = 0;
  if (customer.total_emails_sent > 5) {
    const openRate = customer.total_emails_sent > 0 
      ? customer.total_emails_opened / customer.total_emails_sent 
      : 0;
    if (openRate < 0.1) {
      engagementDecayRate = 0.8;
      riskFactors.push('very_low_engagement');
    } else if (openRate < 0.2) {
      engagementDecayRate = 0.5;
      riskFactors.push('low_engagement');
    }
  }

  // Churn probability calculation
  let churnProbability = 0;
  
  // Factor 1: Inactivity (0-40 points)
  if (inactivityDays > 180) {
    churnProbability += 0.40;
  } else if (inactivityDays > 90) {
    churnProbability += 0.25;
  } else if (inactivityDays > 30) {
    churnProbability += 0.10;
  }

  // Factor 2: Engagement (0-30 points)
  if (customer.total_emails_sent > 3) {
    const openRate = customer.total_emails_opened / customer.total_emails_sent;
    if (openRate < 0.05) {
      churnProbability += 0.30;
    } else if (openRate < 0.15) {
      churnProbability += 0.15;
    }
  }

  // Factor 3: Opt-out signals (0-20 points)
  if (!customer.email_opt_in && !customer.sms_opt_in) {
    churnProbability += 0.20;
  } else if (!customer.email_opt_in || !customer.sms_opt_in) {
    churnProbability += 0.10;
  }

  // Factor 4: Bounces (0-10 points)
  if (hardBounceCount > 0) {
    churnProbability += 0.10;
  }

  // Cap at 1.0
  churnProbability = Math.min(1, churnProbability);

  // Overall risk score (0-100)
  let overallRiskScore = 0;
  overallRiskScore += Math.min(25, inactivityDays / 7); // Up to 25 for inactivity
  overallRiskScore += Math.min(20, messageIgnoreStreak * 4); // Up to 20 for ignoring
  overallRiskScore += Math.min(15, rapidOptOutScore / 6.67); // Up to 15 for rapid opt-out
  overallRiskScore += Math.min(20, hardBounceCount * 20); // Up to 20 for bounces
  overallRiskScore += engagementDecayRate * 20; // Up to 20 for decay

  overallRiskScore = Math.min(100, Math.round(overallRiskScore * 100) / 100);

  return {
    customer_id: customer.id,
    tenant_id: customer.tenant_id,
    rapid_opt_out_score: rapidOptOutScore,
    message_ignore_streak: messageIgnoreStreak,
    coupon_abuse_flag: false, // Would need order data to calculate
    coupon_abuse_count: 0,
    hard_bounce_count: hardBounceCount,
    soft_bounce_count: softBounceCount,
    inactivity_days: inactivityDays,
    complaint_count: customer.total_unsubscribes || 0,
    overall_risk_score: overallRiskScore,
    churn_probability: Math.round(churnProbability * 10000) / 10000,
    engagement_decay_rate: Math.round(engagementDecayRate * 10000) / 10000,
    risk_factors: riskFactors,
    last_calculated_at: now.toISOString(),
    calculation_version: 1
  };
}

/**
 * Get the latest date from an array of date strings
 */
function getLatestDate(dates: (string | null)[]): string | null {
  const validDates = dates
    .filter(d => d !== null)
    .map(d => new Date(d!))
    .filter(d => !isNaN(d.getTime()));
  
  if (validDates.length === 0) return null;
  
  return validDates.reduce((latest, current) => 
    current > latest ? current : latest
  ).toISOString();
}