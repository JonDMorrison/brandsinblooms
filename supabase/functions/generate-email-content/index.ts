import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

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
    const { prompt, persona, type } = await req.json();

    // Get OpenAI API key
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get persona details if provided
    let personaContext = '';
    if (persona) {
      const { data: personaData } = await supabase
        .from('personas')
        .select('*')
        .eq('name', persona)
        .single();
      
      if (personaData) {
        personaContext = `
        Write in the tone and style for "${personaData.name}": ${personaData.description}
        Tone: ${personaData.tone}
        Sample phrases: ${personaData.sample_phrases?.join(', ')}
        Buying triggers: ${personaData.buying_triggers?.join(', ')}
        `;
      }
    }

    // Create system prompt based on type
    const systemPrompt = type === 'email_block' 
      ? `You are an expert email marketing copywriter specializing in garden and plant content. 
         Create compelling, actionable email content blocks that drive engagement and conversions.
         ${personaContext}
         
         Return your response as JSON with these fields:
         - title: A compelling headline (max 60 characters)
         - content: Main body content (2-3 paragraphs, engaging and informative)
         - cta_text: Call-to-action button text (max 25 characters)
         - cta_url: Suggested URL path (can be placeholder like "/shop/tools")
         
         Make it conversion-focused, seasonally appropriate, and valuable to garden enthusiasts.`
      : `You are a helpful content generator. Create content based on the user's request.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const generatedText = data.choices[0].message.content;

    // Try to parse as JSON, fallback to plain text
    let result;
    try {
      result = JSON.parse(generatedText);
    } catch {
      // If not JSON, create structured response
      result = {
        title: 'AI Generated Content',
        content: generatedText,
        cta_text: 'Learn More',
        cta_url: '#'
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-email-content function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      title: 'Error',
      content: 'Sorry, there was an error generating content. Please try again.',
      cta_text: 'Try Again',
      cta_url: '#'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});