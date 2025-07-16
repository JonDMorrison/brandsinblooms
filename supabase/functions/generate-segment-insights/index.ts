import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { segmentId, segment_id, segmentData, personas = [] } = await req.json();
    
    const actualSegmentId = segmentId || segment_id;
    if (!actualSegmentId) {
      throw new Error('Segment ID is required');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    // Fetch segment data
    const { data: segment, error: segmentError } = await supabase
      .from('crm_segments')
      .select('*')
      .eq('id', actualSegmentId)
      .single();

    if (segmentError || !segment) {
      throw new Error('Segment not found');
    }

    // Fetch customers in this segment
    const { data: customers, error: customersError } = await supabase
      .from('crm_customers')
      .select('*')
      .eq('user_id', user.id)
      .limit(100); // Sample for analysis

    if (customersError) {
      throw new Error('Failed to fetch customers');
    }

    // Use provided segment data or fetch from database
    const segmentSummary = segmentData || {
      name: segment.name,
      description: segment.description,
      customer_count: segment.customer_count,
      conditions: segment.conditions,
      sample_customers: customers.slice(0, 10).map(c => ({
        tags: c.tags,
        total_spent: c.total_spent,
        pos_source: c.pos_source,
        product_tags: c.product_tags,
        last_purchase_date: c.last_purchase_date
      }))
    };

    // Build persona context for enhanced insights
    const personaContext = personas.length > 0 
      ? `\n\nAvailable Customer Personas for reference:\n${personas.map(p => `
- ${p.name}: ${p.description}
  Tone: ${p.tone}
  Buying Triggers: ${p.buying_triggers?.join(', ') || 'None'}
  Sample Phrases: ${p.sample_phrases?.join(', ') || 'None'}
  Ideal Products: ${p.ideal_products?.join(', ') || 'None'}
`).join('')}\n\nUse these personas to inform your recommendations and tailor the content suggestions.`
      : '';

    // Generate subject line suggestions
    const subjectLinesResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a garden center marketing strategist. Generate engaging email subject lines.'
          },
          {
            role: 'user',
            content: `Act as a garden center marketing strategist. Given this customer segment: ${JSON.stringify(segmentSummary)}${personaContext}, generate 3 subject lines for an email campaign they'll love. Use persona tone guidance if applicable. Return as a JSON array of strings.`
          }
        ],
        temperature: 0.7,
      }),
    });

    // Generate SMS tone recommendation
    const smsToneResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a marketing expert specializing in SMS communication.'
          },
          {
            role: 'user',
            content: `Based on this segment profile: ${JSON.stringify(segmentSummary)}${personaContext}, what SMS tone would likely work best? Consider persona communication styles if applicable. Return 1-2 words (e.g., "friendly & urgent").`
          }
        ],
        temperature: 0.5,
      }),
    });

    // Generate campaign recommendations
    const campaignResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a garden center marketing strategist focused on seasonal campaigns.'
          },
          {
            role: 'user',
            content: `Suggest 2 campaign ideas (email or SMS) for a garden center to engage this customer segment: ${JSON.stringify(segmentSummary)}${personaContext}. Focus on seasonal products or care tips and align with persona interests if applicable. Return as a JSON array of campaign objects with title and description.`
          }
        ],
        temperature: 0.7,
      }),
    });

    const [subjectLinesData, smsToneData, campaignData] = await Promise.all([
      subjectLinesResponse.json(),
      smsToneResponse.json(),
      campaignResponse.json()
    ]);

    // Parse AI responses
    let subjectLines = [];
    let smsTone = "friendly";
    let campaigns = [];

    try {
      const subjectLinesContent = subjectLinesData.choices[0].message.content;
      subjectLines = JSON.parse(subjectLinesContent);
    } catch (e) {
      subjectLines = [
        "🌱 Spring into action with these garden essentials!",
        "Your plants are calling - don't keep them waiting!",
        "Seasonal favorites just arrived at your garden center"
      ];
    }

    try {
      smsTone = smsToneData.choices[0].message.content.trim();
    } catch (e) {
      smsTone = "friendly & informative";
    }

    try {
      const campaignContent = campaignData.choices[0].message.content;
      campaigns = JSON.parse(campaignContent);
    } catch (e) {
      campaigns = [
        { title: "Seasonal Plant Care Tips", description: "Send weekly care tips based on current season and customer's plant preferences" },
        { title: "New Arrivals Alert", description: "Notify customers when new seasonal plants arrive that match their purchase history" }
      ];
    }

    // Calculate engagement score based on customer data
    const engagementScore = Math.round(
      (customers.filter(c => c.total_spent > 50).length / customers.length) * 100
    );

    // Get top products from customer purchase history
    const topProducts = [...new Set(
      customers.flatMap(c => c.product_tags || [])
    )].slice(0, 5);

    const insights = {
      top_products: topProducts,
      engagement_score: engagementScore,
      subject_line_suggestions: subjectLines,
      sms_tone_recommendation: smsTone,
      best_time_to_send: "Tuesday-Thursday, 10-11 AM",
      campaign_recommendations: campaigns
    };

    return new Response(JSON.stringify({ insights }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-segment-insights function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});