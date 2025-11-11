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
      throw new Error('Prompt is required');
    }

    console.log('🤔 Streaming thinking text for prompt:', prompt);

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
            content: `You are an AI assistant explaining your thought process for generating garden images.
When a user gives you a prompt, explain in 5-11 conversational lines what you understand from their request.
Break down what they want, what visual elements you'll focus on, colors, lighting, composition, mood, and seasonal context.
Be detailed but natural and conversational. Write as a continuous narrative.
Focus on garden and nature photography aesthetics. Keep each thought flowing naturally.`
          },
          {
            role: 'user',
            content: `User prompt: "${prompt}"\n\nExplain your thinking process for creating this image in 5-11 detailed lines:`
          }
        ],
        max_completion_tokens: 300,
        stream: true
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    console.log('✅ Streaming thinking text started');

    // Return the stream directly with proper SSE headers
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('❌ Error in stream-thinking-text:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
