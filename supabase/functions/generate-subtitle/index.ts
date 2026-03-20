import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, handleCorsPrelight, corsJsonResponse } from '../_shared/cors.ts';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

serve(async (req) => {
  // Handle CORS preflight
  const preflightResponse = handleCorsPrelight(req);
  if (preflightResponse) {
    return preflightResponse;
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
    const { contentContext, campaignTitle } = await req.json();

    if (!contentContext) {
      throw new Error('Content context is required');
    }

    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    console.log('📝 Generating subtitle for campaign:', campaignTitle);

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
            content: `You are a marketing copywriter creating compelling newsletter subtitles. Generate ONLY a short, punchy subtitle of exactly 5-9 words that captures the key theme. Output ONLY the subtitle text with no punctuation, quotes, or additional commentary.`
          },
          {
            role: 'user',
            content: `Campaign title: "${campaignTitle}"\n\nContent context: ${contentContext.substring(0, 500)}\n\nGenerate a 5-9 word subtitle:`
          }
        ],
        max_tokens: 30,
        temperature: 0.7,
        stream: false
      }),
    });

    console.log('📡 Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return corsJsonResponse(
          { error: 'Rate limit exceeded. Please try again later.' },
          { status: 429 }
        );
      }
      
      if (response.status === 402) {
        return corsJsonResponse(
          { error: 'Payment required. Please add credits to your workspace.' },
          { status: 402 }
        );
      }
      
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const subtitle = (data.choices?.[0]?.message?.content || '').trim();

    console.log('✅ Subtitle generated:', subtitle);

    return corsJsonResponse({ subtitle });
    
  } catch (error) {
    console.error('❌ Error in generate-subtitle:', error);
    return corsJsonResponse(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
});
