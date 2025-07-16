import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
      
      Always include:
      - A warm, personal greeting
      - Helpful gardening tips relevant to the season
      - A call-to-action to visit the garden center
      - A friendly closing
      
      Format the email content as plain text with line breaks for readability.`;
      maxTokens = 1000;
    } else if (type === "sms") {
      systemPrompt = `You are a marketing expert for garden centers and plant nurseries.
      Create short, compelling SMS marketing messages for gardening enthusiasts.
      Focus on promotions, new arrivals, seasonal tips, or events.
      Keep it concise, friendly, and action-oriented.
      Maximum ${maxLength || 250} characters including spaces.
      Do NOT include "Reply STOP to unsubscribe" - this will be added automatically.
      Use garden/plant emojis sparingly but effectively.`;
      maxTokens = 100;
    } else {
      systemPrompt = `You are a marketing expert for garden centers and plant nurseries.
      Create engaging social media content that speaks to gardening enthusiasts.
      Focus on seasonal gardening tips, plant care advice, new arrivals, and promotions.
      Keep the tone friendly, knowledgeable, and inspiring.
      Use relevant emojis and include hashtags.`;
      maxTokens = 300;
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
    const content = data.choices[0].message.content;

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