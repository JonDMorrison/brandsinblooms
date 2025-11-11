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

    console.log('Generating thinking text for prompt:', prompt);

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
            content: `You are generating "thinking steps" that show the AI's reasoning process when creating an image.
Generate exactly 3 short, conversational thinking steps (each 5-10 words).
Focus on: analyzing the prompt → considering visual elements → planning the enhancement.
Output ONLY a JSON array of 3 strings, nothing else.
Example: ["Analyzing your image request...", "Considering visual composition and style...", "Enhancing prompt for optimal results..."]`
          },
          {
            role: 'user',
            content: `Generate thinking steps for: "${prompt}"`
          }
        ],
        max_completion_tokens: 150,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    
    // Parse the JSON array from the response
    let thinkingSteps: string[];
    try {
      thinkingSteps = JSON.parse(content);
      if (!Array.isArray(thinkingSteps) || thinkingSteps.length === 0) {
        throw new Error('Invalid response format');
      }
    } catch (parseError) {
      console.error('Failed to parse thinking steps:', content);
      // Fallback to default thinking steps
      thinkingSteps = [
        'Analyzing your image request...',
        'Considering visual composition and garden aesthetics...',
        'Enhancing prompt for optimal image generation...'
      ];
    }

    console.log('Generated thinking steps:', thinkingSteps);

    return new Response(
      JSON.stringify({ thinkingSteps }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-thinking-text:', error);
    // Return fallback thinking steps on error
    return new Response(
      JSON.stringify({
        thinkingSteps: [
          'Analyzing your image request...',
          'Considering visual composition and garden aesthetics...',
          'Enhancing prompt for optimal image generation...'
        ]
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
