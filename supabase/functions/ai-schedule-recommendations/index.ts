import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AIRecommendationRequest {
  contentType: string;
  platform: string;
  targetAudience: string;
  urgency: 'low' | 'medium' | 'high';
  timezone: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const body: AIRecommendationRequest = await req.json();
    
    // Get user's historical data for context
    const { data: analyticsData } = await supabaseClient
      .from('analytics_data')
      .select(`
        *,
        social_connections!inner(platform)
      `)
      .eq('social_connections.platform', body.platform.toUpperCase())
      .gte('date_collected', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .limit(100);

    // Get user's company profile for context
    const { data: profile } = await supabaseClient
      .from('company_profiles')
      .select('target_audience, location_info')
      .eq('user_id', user.id)
      .single();

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Create AI prompt with user context
    const prompt = `
You are an AI social media scheduling expert. Analyze the following data and recommend optimal posting times.

Content Details:
- Type: ${body.contentType}
- Platform: ${body.platform}
- Target Audience: ${body.targetAudience}
- Urgency: ${body.urgency}
- Timezone: ${body.timezone}

User Context:
- Business Target Audience: ${profile?.target_audience || 'Not specified'}
- Location: ${profile?.location_info || 'Not specified'}

Historical Analytics: ${analyticsData ? JSON.stringify(analyticsData.slice(0, 10)) : 'No historical data available'}

Based on this information, recommend 3 optimal posting times for the next 7 days. For each recommendation, provide:
1. Exact datetime (ISO format)
2. Confidence score (0-1)
3. Brief reasoning
4. Key factors considered

Consider:
- Platform-specific best practices
- Target audience behavior patterns
- Content type optimization
- Urgency level
- Historical performance data
- Day of week patterns
- Time zone considerations

Respond in JSON format with array of recommendations.
`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
            content: 'You are an expert social media timing strategist. Always respond with valid JSON containing an array of time recommendations.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const aiContent = aiResponse.choices[0].message.content;

    let recommendations;
    try {
      // Try to parse the AI response as JSON
      const parsed = JSON.parse(aiContent);
      recommendations = Array.isArray(parsed) ? parsed : parsed.recommendations || [];
    } catch {
      // Fallback if AI response isn't valid JSON
      recommendations = generateFallbackRecommendations(body);
    }

    // Ensure all recommendations have required fields
    const validRecommendations = recommendations.map((rec: any, index: number) => ({
      datetime: rec.datetime || new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000).toISOString(),
      confidence: Math.min(Math.max(rec.confidence || 0.7, 0), 1),
      reasoning: rec.reasoning || 'AI-generated recommendation based on best practices',
      platform: body.platform,
      factors: Array.isArray(rec.factors) ? rec.factors : ['Platform best practices', 'Audience behavior']
    }));

    return new Response(
      JSON.stringify({ 
        recommendations: validRecommendations.slice(0, 3),
        generated_at: new Date().toISOString(),
        user_context: {
          platform: body.platform,
          contentType: body.contentType,
          urgency: body.urgency
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in ai-schedule-recommendations:', error);
    
    // Return fallback recommendations on error
    const body = await req.json().catch(() => ({ platform: 'facebook', contentType: 'post', urgency: 'medium' }));
    const fallback = generateFallbackRecommendations(body);
    
    return new Response(
      JSON.stringify({ 
        recommendations: fallback,
        error: 'AI recommendations unavailable, using fallback',
        generated_at: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateFallbackRecommendations(params: Partial<AIRecommendationRequest>) {
  const now = new Date();
  const platform = params.platform || 'facebook';
  
  // Platform-specific optimal times
  const platformTimes = {
    facebook: ['09:00', '13:00', '19:00'],
    instagram: ['11:00', '14:00', '20:00'],
    twitter: ['08:00', '12:00', '17:00']
  };
  
  const times = platformTimes[platform as keyof typeof platformTimes] || platformTimes.facebook;
  
  return times.map((time, index) => {
    const [hours, minutes] = time.split(':').map(Number);
    const recommendedDate = new Date(now);
    recommendedDate.setDate(recommendedDate.getDate() + index + 1);
    recommendedDate.setHours(hours, minutes, 0, 0);
    
    return {
      datetime: recommendedDate.toISOString(),
      confidence: 0.7,
      reasoning: `Optimal ${platform} posting time based on general audience activity patterns`,
      platform: platform,
      factors: ['Platform best practices', 'General audience patterns']
    };
  });
}