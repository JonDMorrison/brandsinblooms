import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { theme, weekNumber, date, type = 'summary' } = await req.json();

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    let systemPrompt = '';
    let userPrompt = '';

    if (type === 'headline') {
      systemPrompt = `You are a creative marketing headline writer for garden centers. Create compelling, attention-grabbing headlines from weekly themes. The headlines should:
      - Be ONE sentence only
      - Be engaging and exciting (like magazine headlines)
      - Use action words and emotional language
      - Be 3-8 words maximum
      - Appeal to gardening enthusiasts
      - Feel fresh and modern
      - Avoid generic phrases and clichés
      - Focus on benefits and excitement
      
      Transform boring theme names into headlines that make customers excited to engage.
      Return ONLY the headline, no quotes or extra text. Keep it to ONE sentence.`;
      
      userPrompt = `Create an exciting single-sentence marketing headline for this garden center theme: "${theme}"`;
    } else {
      systemPrompt = `You are a marketing content strategist for garden centers. Create an engaging, exciting summary for an upcoming marketing campaign week. The summary should:
      - Be 1-2 sentences maximum
      - Sound exciting and compelling
      - Focus on customer benefits and engagement
      - Use action-oriented language
      - Be specific about what customers can expect
      - Avoid generic phrases and clichés
      - Feel fresh and modern
      
      Write in a tone that builds anticipation and makes customers excited about what's coming.`;
      
      userPrompt = `Create an exciting summary for Week ${weekNumber} (starting ${date}) with the theme: "${theme}"`;
    }

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
        max_tokens: type === 'headline' ? 30 : 100,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const summary = data.choices[0].message.content.trim();

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-weekly-summary function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
