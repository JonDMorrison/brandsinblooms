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
    const { prompt } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Prompt is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating keywords for prompt:', prompt);

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
            content: `You are a keyword generator for garden and nursery image searches.
IMPORTANT: All keywords must be related to: gardens, nurseries, flowers, plants, snow, leaves, trees, grass, soil, gardening tools, outdoor spaces, nature, seasons, botanical themes, landscaping, greenhouses, potted plants, and natural beauty.

Your task: Generate 4-6 highly specific and visual keywords that would find beautiful, professional garden/nursery images on Unsplash.
- Focus on visual elements (colors, textures, specific plant types)
- Include seasonal elements when relevant
- Be specific (e.g., "pink rose garden" instead of just "garden")
- Return ONLY the keywords as a comma-separated list, no other text.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_completion_tokens: 100,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      return new Response(
        JSON.stringify({ error: 'Failed to generate keywords' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const keywordsText = data.choices[0].message.content.trim();
    const keywords = keywordsText.split(',').map((k: string) => k.trim());

    console.log('Generated keywords:', keywords);

    return new Response(
      JSON.stringify({ keywords }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-image-keywords function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
