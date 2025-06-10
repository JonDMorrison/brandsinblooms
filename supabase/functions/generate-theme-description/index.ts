
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
    const { theme, userId } = await req.json();

    if (!theme) {
      throw new Error('Theme is required');
    }

    // Build context based on whether we have user info for regional considerations
    let regionalContext = '';
    if (userId) {
      regionalContext = `
REGIONAL CONSIDERATIONS:
- Consider that different regions have different growing seasons, climate challenges, and plant preferences
- Think about how this theme would be relevant across various geographic locations (desert southwest, humid southeast, cold northern regions, temperate coastal areas, etc.)
- Include seasonal timing considerations that can be adapted for different climate zones
- Reference the importance of local climate conditions and hardiness zones when relevant
- Consider regional gardening challenges like drought, humidity, frost, soil conditions, or local pests
`;
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
          { 
            role: 'system', 
            content: `You are a marketing content strategist for garden centers with deep knowledge of regional gardening differences across various climate zones. Create a brief, focused content description (2-3 sentences max) that explains what this week's marketing content will cover. The description should:
            - Be specific and actionable
            - Focus on customer benefits
            - Mention seasonal relevance when appropriate and consider regional variations
            - Reference the garden center's expertise and products
            - Be professional but approachable
            - Avoid repetitive phrasing
            - Write in flowing sentences, NEVER use bullet points or lists
            - Consider regional gardening differences and climate-specific advice when relevant
            - Start with engaging language that sparks interest
            - Use visually suggestive words that help readers picture scenarios
            - Sound conversational like a local expert
            - Avoid generic openings and cliché phrases
            
            Keep it concise and compelling - this will guide all content creation for the week including social media, newsletters, and videos.`
          },
          { 
            role: 'user', 
            content: `Generate a content focus description for this theme: "${theme}"

${regionalContext}

Create a description that can guide region-specific content creation, considering how this theme would be relevant across different geographic locations and climate zones. Use engaging, visually suggestive language that sparks curiosity and sounds conversational like a local garden center expert speaking to their community.`
          }
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to generate description');
    }

    const data = await response.json();
    const description = data.choices[0].message.content.trim();

    return new Response(JSON.stringify({ description }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-theme-description function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
