import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // SECURITY: [JWT auth] - Require authenticated user for AI function access
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
  const { error: authError } = await supabase.auth.getUser();
  if (authError) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const { blocks, campaignTitle } = await req.json();
    console.log('[HEADER-KEYWORDS] Processing request for campaign:', campaignTitle);

    if (!blocks || blocks.length === 0) {
      throw new Error('No blocks provided for keyword generation');
    }

    // Extract content from all blocks
    const allContent = blocks
      .map((block: any) => {
        const parts = [];
        if (block.content?.title) parts.push(block.content.title);
        if (block.content?.subtitle) parts.push(block.content.subtitle);
        if (block.content?.content) parts.push(block.content.content);
        if (block.content?.text) parts.push(block.content.text);
        return parts.join(' ');
      })
      .join(' ')
      .trim();

    console.log('[HEADER-KEYWORDS] Aggregated content length:', allContent.length);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Generate keywords using Lovable AI
    const aiPrompt = `Analyze the following newsletter content and generate 3-5 keywords optimized for finding a perfect header background image on Unsplash.

Campaign Title: ${campaignTitle}

Newsletter Content:
${allContent.substring(0, 2000)}

Requirements:
- Focus on visual, tangible concepts (e.g., "spring garden blooming flowers" not "tips advice")
- Prefer specific plants, seasons, or garden activities
- Keep it natural and descriptive (3-5 words total)
- Optimize for image search relevance
- Consider the overall theme and mood

Return ONLY the keywords as a single phrase, nothing else.`;

    console.log('[HEADER-KEYWORDS] Calling Lovable AI...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at generating image search keywords. Return only the keywords, nothing else.'
          },
          {
            role: 'user',
            content: aiPrompt
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[HEADER-KEYWORDS] AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const keywords = aiData.choices?.[0]?.message?.content?.trim() || 'garden center plants flowers';

    console.log('[HEADER-KEYWORDS] Generated keywords:', keywords);

    // Generate a brief summary for alt text
    const summary = `${campaignTitle} - ${keywords}`;

    return new Response(
      JSON.stringify({
        keywords,
        summary,
        source: 'ai-generated'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[HEADER-KEYWORDS] Error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        keywords: 'garden center plants', // Fallback keywords
        summary: 'Garden center',
        source: 'fallback'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
