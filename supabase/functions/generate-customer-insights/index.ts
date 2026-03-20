import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

interface CustomerData {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  created_at: string;
  tenant_id: string;
}

interface AIInsightResponse {
  keyInsight: string;
  patterns: string[];
  actions: Array<{
    title: string;
    description: string;
    confidence: number;
    actionType: string;
    priority: string;
  }>;
  hasSufficientData: boolean;
  generatedAt: string;
  expiresAt: string;
  cached: boolean;
  modelUsed: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { customer_id, force_regenerate = false } = await req.json();

    if (!customer_id) {
      return new Response(
        JSON.stringify({ error: 'customer_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!openAIApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // FIX: [issue #22] - Validate auth header instead of just reading it
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || (authHeader !== `Bearer ${supabaseServiceKey}` && !authHeader.startsWith('Bearer '))) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (authHeader !== `Bearer ${supabaseServiceKey}`) {
      const token = authHeader.replace('Bearer ', '');
      const { error: authErr } = await supabase.auth.getUser(token);
      if (authErr) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Check cache first (unless force_regenerate is true)
    if (!force_regenerate) {
      const { data: cached, error: cacheError } = await supabase
        .from('customer_ai_insights')
        .select('*')
        .eq('customer_id', customer_id)
        .gte('expires_at', new Date().toISOString())
        .maybeSingle();

      if (!cacheError && cached) {
        console.log(`📦 Returning cached insights for customer ${customer_id}`);
        return new Response(
          JSON.stringify({
            keyInsight: cached.key_insight,
            patterns: cached.behavioral_patterns || [],
            actions: cached.recommended_actions || [],
            hasSufficientData: cached.has_sufficient_data,
            generatedAt: cached.generated_at,
            expiresAt: cached.expires_at,
            cached: true,
            modelUsed: cached.model_used,
          } as AIInsightResponse),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(`🤖 Generating fresh AI insights for customer ${customer_id}`);

    // Fetch customer data
    const { data: customer, error: customerError } = await supabase
      .from('crm_customers')
      .select('*')
      .eq('id', customer_id)
      .maybeSingle();

    if (customerError || !customer) {
      return new Response(
        JSON.stringify({ error: 'Customer not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch enriched customer data
    const { data: enriched } = await supabase
      .from('customer_360_enriched')
      .select('*')
      .eq('id', customer_id)
      .maybeSingle();

    // Fetch cross-channel metrics
    const { data: crossChannel } = await supabase
      .from('customer_cross_channel_metrics')
      .select('*')
      .eq('customer_id', customer_id)
      .maybeSingle();

    // Fetch purchase metrics
    const { data: purchaseMetrics } = await supabase
      .from('customer_purchase_metrics')
      .select('*')
      .eq('customer_id', customer_id)
      .maybeSingle();

    // Fetch risk signals
    const { data: riskSignals } = await supabase
      .from('customer_risk_signals')
      .select('*')
      .eq('customer_id', customer_id)
      .maybeSingle();

    // Fetch lifecycle metrics
    const { data: lifecycleMetrics } = await supabase
      .from('customer_lifecycle_metrics')
      .select('*')
      .eq('customer_id', customer_id)
      .maybeSingle();

    // Fetch content intent metrics
    const { data: contentIntent } = await supabase
      .from('customer_content_intent_metrics')
      .select('*')
      .eq('customer_id', customer_id)
      .maybeSingle();

    // Determine if we have sufficient data
    const hasSufficientData = !!(
      enriched?.engagement_overall_score ||
      crossChannel ||
      purchaseMetrics?.lifetime_value ||
      (enriched?.email_total_sent && enriched.email_total_sent > 0) ||
      (enriched?.sms_total_sent && enriched.sms_total_sent > 0)
    );

    // Build the prompt based on data availability
    let systemPrompt: string;
    let userPrompt: string;

    if (hasSufficientData) {
      systemPrompt = `You are an expert CRM analyst. Analyze customer data and provide actionable insights for a marketing/sales team. Be specific, data-driven, and actionable. Focus on patterns that can drive revenue and engagement.`;
      
      userPrompt = `Analyze this customer and provide insights:

**Customer Profile:**
- Name: ${customer.first_name || ''} ${customer.last_name || ''} (${customer.email})
- Customer since: ${customer.created_at}
- Lifecycle stage: ${lifecycleMetrics?.lifecycle_stage || 'Unknown'}

**Engagement Metrics:**
- Overall engagement score: ${enriched?.engagement_overall_score || 'N/A'}
- Email engagement score: ${enriched?.engagement_email_score || 'N/A'}
- SMS engagement score: ${enriched?.engagement_sms_score || 'N/A'}
- Purchase engagement score: ${enriched?.engagement_purchase_score || 'N/A'}
- Engagement tier: ${enriched?.engagement_tier || 'N/A'}

**Email Performance:**
- Total sent: ${enriched?.email_total_sent || 0}
- Open rate: ${enriched?.email_open_rate ? (enriched.email_open_rate * 100).toFixed(1) + '%' : 'N/A'}
- Click rate: ${enriched?.email_click_rate ? (enriched.email_click_rate * 100).toFixed(1) + '%' : 'N/A'}

**SMS Performance:**
- Total sent: ${enriched?.sms_total_sent || 0}
- Delivery rate: ${enriched?.sms_delivery_rate ? (enriched.sms_delivery_rate * 100).toFixed(1) + '%' : 'N/A'}
- Click rate: ${enriched?.sms_click_rate ? (enriched.sms_click_rate * 100).toFixed(1) + '%' : 'N/A'}

**Cross-Channel:**
- Preferred channel: ${crossChannel?.preferred_channel || enriched?.preferred_channel || 'Unknown'}
- Multi-channel score: ${crossChannel?.multi_channel_score || 'N/A'}
- Fatigue status: ${crossChannel?.fatigue_status || 'Normal'}

**Purchase Behavior:**
- Lifetime value: ${purchaseMetrics?.lifetime_value ? '$' + purchaseMetrics.lifetime_value.toFixed(2) : 'N/A'}
- Total orders: ${purchaseMetrics?.total_orders || 0}
- Average order value: ${purchaseMetrics?.average_order_value ? '$' + purchaseMetrics.average_order_value.toFixed(2) : 'N/A'}
- Days since last purchase: ${purchaseMetrics?.days_since_last_purchase || 'N/A'}

**Content Preferences:**
- Intent score: ${contentIntent?.intent_score || 'N/A'}
- Content preference: ${contentIntent?.content_preference || 'Unknown'}
- Discount ratio: ${contentIntent?.discount_redemption_ratio ? (contentIntent.discount_redemption_ratio * 100).toFixed(0) + '%' : 'N/A'}

**Risk Indicators:**
- Risk score: ${riskSignals?.risk_score || 'N/A'}
- Churn probability: ${riskSignals?.churn_probability ? (riskSignals.churn_probability * 100).toFixed(0) + '%' : 'N/A'}
- Risk factors: ${riskSignals?.risk_factors?.join(', ') || 'None identified'}

Provide your analysis in the following JSON format. Be specific and actionable:`;
    } else {
      systemPrompt = `You are an expert CRM analyst helping onboard a new customer. Since there's limited data, focus on recommending initial engagement strategies and data collection approaches.`;
      
      userPrompt = `This is a new or low-engagement customer with limited data:

**Customer Profile:**
- Name: ${customer.first_name || ''} ${customer.last_name || ''} (${customer.email})
- Phone: ${customer.phone || 'Not provided'}
- Customer since: ${customer.created_at}

There's no engagement or purchase history available yet.

Provide recommendations for:
1. How to build a relationship with this customer
2. What initial engagement strategies to try
3. How to gather more data about their preferences

Provide your analysis in the following JSON format:`;
    }

    // Call OpenAI API with function calling for structured output
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'provide_customer_insights',
              description: 'Provide structured customer insights and recommended actions',
              parameters: {
                type: 'object',
                properties: {
                  keyInsight: {
                    type: 'string',
                    description: 'A 2-3 sentence key insight about this customer that is specific and actionable'
                  },
                  patterns: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'List of 3-5 behavioral patterns observed (be specific with data references)'
                  },
                  actions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string', description: 'Short action title (max 60 chars)' },
                        description: { type: 'string', description: 'Brief explanation of why this action matters' },
                        confidence: { type: 'number', description: 'Confidence score 0-100' },
                        actionType: { 
                          type: 'string', 
                          enum: ['sms', 'email', 'schedule', 'monitor', 'suppress'],
                          description: 'Type of action to take' 
                        },
                        priority: { 
                          type: 'string', 
                          enum: ['high', 'medium', 'low'],
                          description: 'Priority level' 
                        }
                      },
                      required: ['title', 'description', 'confidence', 'actionType', 'priority']
                    },
                    description: 'List of 3 recommended next-best-actions'
                  }
                },
                required: ['keyInsight', 'patterns', 'actions']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'provide_customer_insights' } },
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to generate AI insights', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('OpenAI response:', JSON.stringify(data, null, 2));

    // Extract the function call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'provide_customer_insights') {
      return new Response(
        JSON.stringify({ error: 'Unexpected AI response format' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const insights = JSON.parse(toolCall.function.arguments);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    // Cache the insights in the database
    const { error: upsertError } = await supabase
      .from('customer_ai_insights')
      .upsert({
        customer_id: customer_id,
        tenant_id: customer.tenant_id,
        key_insight: insights.keyInsight,
        behavioral_patterns: insights.patterns,
        recommended_actions: insights.actions,
        has_sufficient_data: hasSufficientData,
        model_used: 'gpt-4o-mini',
        prompt_tokens: data.usage?.prompt_tokens || null,
        completion_tokens: data.usage?.completion_tokens || null,
        generated_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      }, {
        onConflict: 'customer_id'
      });

    if (upsertError) {
      console.error('Failed to cache insights:', upsertError);
      // Continue anyway - caching failure shouldn't block the response
    }

    const result: AIInsightResponse = {
      keyInsight: insights.keyInsight,
      patterns: insights.patterns,
      actions: insights.actions,
      hasSufficientData,
      generatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      cached: false,
      modelUsed: 'gpt-4o-mini',
    };

    console.log(`✅ Generated and cached insights for customer ${customer_id}`);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-customer-insights:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
