import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

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
    const { prompt } = await req.json();
    
    if (!prompt) {
      throw new Error('Prompt is required');
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    console.log('🤖 Generating newsletter ideas for prompt:', prompt);

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
            content: `You are a newsletter content expert. Generate 3-5 newsletter ideas based on the user's prompt. Return a JSON object with an "ideas" array. Each idea should have:
            - id: unique identifier (kebab-case)
            - title: catchy newsletter title
            - description: 2-3 sentence description
            - category: one of "holiday", "seasonal", "product", "ai-generated", "general"
            - badge: short label for the category
            - templateBlocks: array of content blocks (header, image-text, text, button, etc.)
            - heroQuery: Unsplash search query for hero image
            - estimatedReadTime: reading time estimate

            Focus on practical, engaging newsletter ideas that would be useful for businesses. Make the content professional but approachable.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.8,
        max_tokens: 2000
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    console.log('🤖 Generated content:', content);

    // Parse the JSON response from OpenAI
    let parsedContent;
    try {
      parsedContent = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', content);
      throw new Error('Invalid response format from AI');
    }

    if (!parsedContent.ideas || !Array.isArray(parsedContent.ideas)) {
      throw new Error('AI response does not contain valid ideas array');
    }

    // Ensure all ideas have required fields
    const ideas = parsedContent.ideas.map((idea: any, index: number) => ({
      id: idea.id || `ai-idea-${Date.now()}-${index}`,
      title: idea.title || 'Untitled Newsletter',
      description: idea.description || 'AI-generated newsletter idea',
      category: 'ai-generated',
      badge: 'AI Generated',
      templateBlocks: idea.templateBlocks || [
        { type: 'header', title: idea.title || 'Newsletter' },
        { type: 'text', content: idea.description || 'Newsletter content...' }
      ],
      heroQuery: idea.heroQuery || 'newsletter business',
      estimatedReadTime: idea.estimatedReadTime || '5 min'
    }));

    console.log('✅ Successfully generated', ideas.length, 'newsletter ideas');

    return new Response(JSON.stringify({ ideas }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in generate-newsletter-ideas function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        ideas: [] // Return empty array as fallback
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});