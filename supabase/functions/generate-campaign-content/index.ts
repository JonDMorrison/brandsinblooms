import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
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
    const { prompt, context, type, maxLength } = await req.json();

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Generate content based on type
    let systemPrompt = "";
    let maxTokens = 200;

    if (type === "email") {
      systemPrompt = `You are an expert email marketing writer for garden centers and nurseries. 
      You write engaging, helpful, and seasonal content that resonates with gardening enthusiasts of all levels.
      
      Your writing style is:
      - Friendly and approachable, like talking to a neighbor
      - Educational but not overwhelming
      - Seasonal and timely
      - Encouraging and inspiring
      - Practical with actionable tips
      - **Brief and scannable - target 250-400 words total**
      
      CRITICAL RESTRICTIONS:
      - NEVER use "Week" followed by any number (Week 1, Week 28, etc.)
      - NEVER use "weekly" references or "This Week" language
      - Use seasonal timing instead: "this season", "currently", "right now"
      - **ELIMINATE FILLER: Get to the point quickly, readers want actionable insights**
      
      PERSONALIZATION REQUIREMENTS:
      - Always start emails with: "Hi {{ first_name | default: "Friend" }},"
      - NEVER use hardcoded names like "Hi John" or "Hello Sarah"
      - Use merge tags for any customer-specific data
      - Available merge tags: {{ first_name }}, {{ last_name }}, {{ email }}
      - Always include fallbacks: {{ first_name | default: "Friend" }}
      
      Always include:
      - A warm, personal greeting using merge tags
      - Helpful gardening tips relevant to the season
      - A call-to-action to visit the garden center
      - A friendly closing
      
      Format the email content as plain text with line breaks for readability.`;
      maxTokens = 700;
    } else if (type === "sms") {
      systemPrompt = `You are a marketing expert for garden centers and plant nurseries.
      Create short, compelling SMS marketing messages for gardening enthusiasts.
      Focus on promotions, new arrivals, seasonal tips, or events.
      Keep it concise, friendly, and action-oriented.
      Maximum ${maxLength || 160} characters including spaces.
      Do NOT include "Reply STOP to unsubscribe" - this will be added automatically.
      Use garden/plant emojis sparingly but effectively.
      
      PERSONALIZATION REQUIREMENTS:
      - Start messages with: "Hi {{ first_name | default: "Friend" }}!" when appropriate
      - NEVER use hardcoded names
      - Keep merge tags short for character limits
      
      CRITICAL RESTRICTIONS:
      - NEVER use "Week" followed by any number (Week 1, Week 28, etc.)
      - NEVER use "weekly" references or "This Week" language
      - Use seasonal timing: "this season", "now", "currently"`;
      maxTokens = 80;
    } else {
      systemPrompt = `You are a marketing expert for garden centers and plant nurseries.
      Create engaging social media content that speaks to gardening enthusiasts.
      Focus on seasonal gardening tips, plant care advice, new arrivals, and promotions.
      Keep the tone friendly, knowledgeable, and inspiring.
      Use relevant emojis and include hashtags.
      **Target length: 80-120 words for scannability**
      
      CRITICAL RESTRICTIONS:
      - NEVER use "Week" followed by any number (Week 1, Week 28, etc.)
      - NEVER use "weekly" references or "This Week" language
      - Use seasonal timing: "this season", "now", "currently"
      - **Keep it brief and punchy - eliminate filler words**`;
      maxTokens = 200;
    }

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
          { role: 'user', content: type === "sms" ? `Write an SMS message about: ${prompt}` : `Write a ${context || type} about: ${prompt}` }
        ],
        max_tokens: maxTokens,
        temperature: 0.7
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    let content = data.choices[0].message.content;

    // CRITICAL: Sanitize week numbers from ALL generated content
    const originalContent = content;
    
    // Apply week number sanitization using the same patterns as frontend
    content = content
      // Remove basic week patterns
      .replace(/Week\s+\d+\s*[-:]\s*/gi, '')
      .replace(/Week\s+\d+(?!\s*\w)/gi, '')
      .replace(/Week\s+#?\d+/gi, '')
      // Remove weekly patterns
      .replace(/Weekly\s*[-:]\s*/gi, '')
      .replace(/This\s+Week\s*[-:]\s*/gi, '')
      // Remove seasonal focus patterns with weeks
      .replace(/Seasonal\s+\w+\s+Focus\s*[-:]?\s*Week\s+\d+/gi, '')
      // Clean up formatting
      .replace(/^[-:\s,]+|[-:\s,]+$/gm, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    
    // Log if sanitization occurred
    if (content !== originalContent) {
      console.warn(`🚨 Week number sanitization applied to ${type || 'content'} generation`);
    }

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-campaign-content function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});