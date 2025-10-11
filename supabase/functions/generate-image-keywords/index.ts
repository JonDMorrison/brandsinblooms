import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Generate channel-specific guidance for faceted query composition
 */
function getChannelGuidance(channel: string): string {
  const channelGuidance: Record<string, string> = {
    facebook: `FACEBOOK GUIDANCE:
- Include "customers" or "shoppers" in setting when appropriate
- Emphasize social/retail context (nursery, garden center)
- Consider people interacting with plants
- Focus on community and engagement aspects`,

    instagram: `INSTAGRAM GUIDANCE:
- Prioritize visual impact and aesthetic appeal
- Use vibrant color descriptors (vivid, bright, colorful)
- Focus on close-ups and detail shots
- Emphasize mood and style (professional, artistic, natural)`,

    blog: `BLOG GUIDANCE:
- Include action words (planting, pruning, growing)
- Educational and how-to context
- Hands-on demonstrations
- Practical gardening activities`,

    newsletter: `NEWSLETTER GUIDANCE:
- Emphasize seasonal context (spring, summer, fall, winter)
- Product showcase and inventory display
- Garden center setting
- Professional presentation`,

    video: `VIDEO GUIDANCE:
- Action-oriented (demonstrating, showing, tutorial)
- Process and technique focus
- Hands performing tasks
- Step-by-step context`
  };

  return channelGuidance[channel] || channelGuidance.instagram;
}

/**
 * Generate the system prompt for OpenAI
 */
function getSystemPrompt(channel: string): string {
  return `You are a query composer for Unsplash image search, specialized in garden center and plant photography.

Given content TEXT, analyze it and return a JSON structure with these facets:

FACET DEFINITIONS:
- theme: 1-3 words describing the main subject (e.g., "pink petunia", "tomato seedlings", "succulent collection")
- action: 0-2 words for activity/state (e.g., "blooming", "growing", "displayed") - OPTIONAL
- setting: 0-2 words for location context (e.g., "greenhouse", "nursery", "garden center") - OPTIONAL
- season_time: 0-2 words for temporal context (e.g., "spring", "morning light") - OPTIONAL
- mood_style: 0-2 words for aesthetic (e.g., "vibrant", "close-up", "professional") - OPTIONAL
- exclusions: Array of 0-2 simple words to exclude (e.g., ["people", "text", "logos"]) - OPTIONAL
- variants: 3-5 natural search queries (2-5 words each) that mix the above facets naturally

CONSTRAINTS:
- No underscores, commas, or punctuation in queries
- Prefer common words over niche jargon
- Each variant should feel natural, like a human would search
- Avoid repetition across variants
- Focus on VISUAL, PHOTOGRAPHIC elements
- Always include at least one plant-specific or garden-related term

CHANNEL GUIDANCE:
${getChannelGuidance(channel)}

EXAMPLES:

Content: "Beautiful red poinsettias perfect for Christmas decorating"
Response:
{
  "theme": "red poinsettia",
  "action": "displayed",
  "setting": "nursery",
  "season_time": "christmas",
  "mood_style": "festive vibrant",
  "exclusions": ["people", "text"],
  "variants": [
    "red poinsettia christmas display",
    "vibrant poinsettia potted nursery",
    "festive red poinsettia closeup",
    "christmas poinsettia plants greenhouse",
    "red holiday poinsettia flowers"
  ]
}

Content: "Spring vegetable garden seedlings ready to plant"
Response:
{
  "theme": "vegetable seedlings",
  "action": "ready planting",
  "setting": "greenhouse",
  "season_time": "spring",
  "mood_style": "fresh green",
  "exclusions": ["text"],
  "variants": [
    "spring vegetable seedlings greenhouse",
    "fresh green seedling trays",
    "vegetable plants ready planting",
    "tomato pepper seedlings nursery",
    "spring garden starter plants"
  ]
}

Generate natural, visual search queries that will find relevant garden and plant images on Unsplash.`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, channel = 'instagram', useAI = true } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Prompt is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🎨 Generating keywords for ${channel}:`, prompt.substring(0, 100));

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
            content: getSystemPrompt(channel)
          },
          {
            role: 'user',
            content: `CONTENT TO ANALYZE: ${prompt}

Generate faceted search queries for Unsplash. Focus on creating natural, visual queries that will return high-quality garden and plant images.`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "compose_unsplash_query",
            description: "Generate faceted search queries for Unsplash",
            parameters: {
              type: "object",
              properties: {
                theme: {
                  type: "string",
                  description: "Main subject, 1-3 words (e.g., 'pink petunia', 'tomato plants')"
                },
                action: {
                  type: "string",
                  description: "Activity or state, 0-2 words (optional)"
                },
                setting: {
                  type: "string",
                  description: "Location context, 0-2 words (optional)"
                },
                season_time: {
                  type: "string",
                  description: "Temporal context, 0-2 words (optional)"
                },
                mood_style: {
                  type: "string",
                  description: "Aesthetic quality, 0-2 words (optional)"
                },
                exclusions: {
                  type: "array",
                  items: { type: "string" },
                  description: "Words to exclude, 0-2 items (optional)"
                },
                variants: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 3,
                  maxItems: 5,
                  description: "3-5 natural search queries mixing facets"
                }
              },
              required: ["theme", "variants"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "compose_unsplash_query" } },
        max_tokens: 300,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', response.status, errorData);
      return new Response(
        JSON.stringify({ error: 'Failed to generate keywords', details: errorData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    
    // Extract tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      console.error('❌ No structured output from OpenAI:', JSON.stringify(data, null, 2));
      return new Response(
        JSON.stringify({ 
          error: 'Failed to generate keywords from AI',
          details: 'OpenAI did not return structured output. Please try again or use manual search.',
          retryable: true
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = JSON.parse(toolCall.function.arguments);
    const { theme, action, setting, season_time, mood_style, exclusions, variants } = result;

    console.log('✅ AI Generated faceted query:', {
      theme,
      action,
      setting,
      season_time,
      mood_style,
      exclusions,
      variants
    });

    // Validate that we have at least the required fields
    if (!theme || !variants || variants.length < 3) {
      console.error('❌ Invalid faceted response:', result);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to generate valid query variants',
          details: 'AI did not return sufficient query variants. Please try again or use manual search.',
          retryable: true
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        theme,
        action,
        setting,
        season_time,
        mood_style,
        exclusions,
        variants,
        channel
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-image-keywords function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
