
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
      block_data,
      campaign_context,
      regeneration_options
    } = await req.json();

    const systemPrompt = `You are an expert email marketing copywriter. Regenerate the specific content block to be more engaging and conversion-focused.

Block Type: ${block_data.type}
Regeneration Options: ${JSON.stringify(regeneration_options)}
Campaign Context: ${campaign_context}

Focus on making this ${block_data.type} block more compelling while maintaining relevance to the overall campaign.`;

    const userPrompt = `Current ${block_data.type} block:
Title: ${block_data.title || 'N/A'}
Content: ${block_data.content || 'N/A'}
CTA: ${block_data.cta_text || 'N/A'}

Please regenerate this block to be more engaging. Provide:
1. Regenerated content
2. 2 alternative variations
3. Performance prediction (high/medium/low engagement expected)

Format as JSON with keys: regenerated_block, variations, performance_prediction`;

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
        temperature: 0.8,
        max_tokens: 1000
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'OpenAI API error');
    }

    let aiResponse = data.choices[0].message.content;
    
    // Clean up code fences and extract JSON
    aiResponse = aiResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(aiResponse);
    } catch {
      // If parsing fails, wrap in expected structure
      parsedResponse = {
        regenerated_block: {
          ...block_data,
          content: aiResponse
        },
        variations: [],
        performance_prediction: 'medium'
      };
    }

    return new Response(JSON.stringify(parsedResponse), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in regenerate-content-block function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
