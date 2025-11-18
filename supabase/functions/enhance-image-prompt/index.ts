import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();

    if (!prompt) {
      throw new Error('Prompt is required');
    }

    console.log('Enhancing prompt:', prompt);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-mini-2025-08-07',
        messages: [
          {
            role: 'system',
            content: `You are an expert at enhancing image generation prompts for garden photography.
Your enhanced prompts must focus on GARDENS, PLANTS, FLOWERS, TREES, and NATURAL GARDEN ELEMENTS as the primary subjects.
Transform simple prompts into detailed, vivid descriptions that will generate beautiful garden images.
Focus on: plant varieties, garden settings, seasonal context, natural lighting, colors, composition, and mood.

CRITICAL RULES:
- Primary subjects MUST be gardens, plants, flowers, trees, or garden elements
- NEVER suggest garden center stores, retail buildings, or commercial settings
- Always specify the season and appropriate seasonal plants
- Include natural outdoor garden environments
- Describe specific plant types, colors, and garden features

Output only the enhanced prompt, nothing else.`
          },
          {
            role: 'user',
            content: `Enhance this image prompt: "${prompt}"`
          }
        ],
        max_completion_tokens: 200,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const enhancedPrompt = data.choices[0].message.content.trim();

    console.log('Enhanced prompt:', enhancedPrompt);

    return new Response(
      JSON.stringify({ enhancedPrompt }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in enhance-image-prompt:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
