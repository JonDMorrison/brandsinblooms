
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      original_content,
      campaign_title,
      business_context,
      regeneration_options,
      seasonal_context
    } = await req.json();

    const systemPrompt = `You are an expert email marketing copywriter specializing in garden centers and seasonal marketing. Your task is to regenerate email content that is engaging, relevant, and optimized for garden center customers.

Business Context:
- Company: ${business_context.company_name}
- Brand Voice: ${business_context.brand_voice}
- Target Audience: ${business_context.target_audience}
- Specializations: ${business_context.specializations}

Regeneration Guidelines:
- Tone: ${regeneration_options.tone}
- Focus: ${regeneration_options.focus}
- Target Persona: ${regeneration_options.persona_tag || 'general gardener'}
- Preserve Structure: ${regeneration_options.preserve_structure}

Seasonal Context:
- Current Season: ${seasonal_context?.current_season}
- Upcoming Tasks: ${seasonal_context?.garden_tasks?.join(', ')}
- Holiday Context: ${seasonal_context?.upcoming_holidays?.map(h => h.holiday_name).join(', ')}

Please regenerate the content to be more engaging, season-appropriate, and conversion-focused while maintaining the core message.`;

    const userPrompt = `Campaign Title: ${campaign_title}

Original Content:
${original_content}

Please regenerate this email content following the guidelines above. Also provide:
1. 3 alternative subject line variations
2. 2 call-to-action variations
3. Brief tone analysis
4. 2 improvement suggestions

Format your response as JSON with these keys:
- regenerated_content
- subject_variations (array)
- cta_variations (array)
- tone_analysis (string)
- improvement_suggestions (array)`;

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
        temperature: 0.7,
        max_tokens: 2000
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'OpenAI API error');
    }

    const aiResponse = data.choices[0].message.content;
    
    // Try to parse JSON response, fallback to plain text if needed
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(aiResponse);
    } catch {
      parsedResponse = {
        regenerated_content: aiResponse,
        subject_variations: [],
        cta_variations: [],
        tone_analysis: 'Content regenerated successfully',
        improvement_suggestions: []
      };
    }

    return new Response(JSON.stringify(parsedResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in regenerate-email-content function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
