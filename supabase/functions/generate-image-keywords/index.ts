import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Generate channel-specific system prompts with strict garden validation
 */
function getSystemPrompt(channel: string): string {
  const basePrompt = `You are an expert garden center image curator generating Unsplash search keywords.

🌱 MANDATORY GARDEN FOCUS:
ALL keywords MUST relate to:
- Plants: flowers, vegetables, herbs, trees, shrubs, houseplants
- Garden elements: soil, pots, tools, greenhouse, nursery, display
- Garden activities: planting, pruning, watering, harvesting
- Seasons: spring, summer, fall, winter, seasonal
- Nature: leaves, blooms, foliage, growth, botanical

FORBIDDEN TOPICS:
❌ Food (unless it's growing plants)
❌ People alone (must include plants/garden)
❌ Abstract concepts without visual elements
❌ Indoor spaces without plants
❌ Tools alone without plants/garden
❌ Week numbers, dates, generic terms`;

  const channelRequirements: Record<string, string> = {
    facebook: `
FACEBOOK REQUIREMENTS:
- MUST show CUSTOMERS or PEOPLE interacting with plants
- MUST show garden center RETAIL environment
- MUST include specific plant type + action
- Examples:
  ✅ ["customers browsing", "pink petunia", "hanging baskets", "greenhouse"]
  ✅ ["shoppers selecting", "vegetable seedlings", "spring", "nursery"]
  ✅ ["people viewing", "flowering perennials", "garden center", "display"]
  ❌ ["flowers"] (too generic)
  ❌ ["petunia"] (no retail context or people)`,

    instagram: `
INSTAGRAM REQUIREMENTS:
- MUST show CLOSE-UP of specific plant variety with COLOR
- MUST show retail/display context (pots, tags, shelves)
- MUST be visually stunning (vibrant, detailed, textured)
- Examples:
  ✅ ["vibrant orange", "marigolds", "potted", "garden center", "display"]
  ✅ ["purple echinacea", "flower", "close", "nursery", "pot", "label"]
  ✅ ["red heirloom", "tomato seedlings", "greenhouse", "tray"]
  ❌ ["flowers"] (too generic)
  ❌ ["marigold plant"] (no color, no retail context)`,

    blog: `
BLOG REQUIREMENTS:
- MUST show HANDS or TOOLS performing technique
- MUST show specific plant + gardening action
- MUST demonstrate the "how-to" visually
- Examples:
  ✅ ["hands transplanting", "basil seedlings", "soil", "trowel"]
  ✅ ["pruning", "tomato suckers", "fingers", "garden", "technique"]
  ✅ ["mulching", "rose bed", "hands", "spreading", "wood chips"]
  ❌ ["rose garden"] (no action shown)
  ❌ ["pruning tools"] (no hands or specific plant)`,

    newsletter: `
NEWSLETTER REQUIREMENTS:
- MUST show SEASONAL context
- MUST show garden center INVENTORY or featured products
- MUST include specific plant varieties for that season
- Examples:
  ✅ ["spring", "seedling trays", "greenhouse", "nursery", "display", "variety"]
  ✅ ["autumn mums", "chrysanthemum", "garden center", "fall", "selection"]
  ✅ ["winter houseplants", "tropical", "indoor", "plant shop", "inventory"]
  ❌ ["seasonal plants"] (not specific)
  ❌ ["plant variety"] (too generic)`,

    video: `
VIDEO REQUIREMENTS:
- MUST show ACTION or DEMONSTRATION
- MUST show hands/people performing technique
- MUST include specific plant + context
- Examples:
  ✅ ["demonstrating", "plant care", "garden center", "customer", "tutorial"]
  ✅ ["hands planting", "tomato", "raised bed", "technique"]
  ✅ ["pruning demo", "rose bush", "garden shop", "shears"]
  ❌ ["gardening video"] (too generic)`
  };

  return `${basePrompt}

${channelRequirements[channel] || channelRequirements.instagram}

RESPONSE FORMAT:
Generate 4-6 keywords as an array, plus a primaryQuery (5-7 words combining the best keywords).
Focus on VISUAL, PHOTOGRAPHIC elements that a professional garden photographer would capture.`;
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
            content: prompt
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_image_keywords",
            description: `Generate garden-focused image search keywords for ${channel}`,
            parameters: {
              type: "object",
              properties: {
                keywords: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 4,
                  maxItems: 6,
                  description: "4-6 garden-related keywords"
                },
                primaryQuery: {
                  type: "string",
                  description: "5-7 word Unsplash query combining best keywords"
                }
              },
              required: ["keywords", "primaryQuery"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "generate_image_keywords" } },
        max_tokens: 200,
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
      // Fallback to channel default
      const fallback = getChannelFallback(channel);
      return new Response(
        JSON.stringify({ 
          keywords: fallback.split(' '), 
          primaryQuery: fallback,
          validationPassed: false,
          fallbackUsed: true
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = JSON.parse(toolCall.function.arguments);
    const { keywords, primaryQuery } = result;

    console.log('✅ AI Generated:', { keywords, primaryQuery });

    // === VALIDATE KEYWORDS ===
    const { validateGardenKeywords, getChannelFallback } = await import('../_shared/enhanced-keyword-validator.ts');
    
    const validation = validateGardenKeywords(keywords, channel);
    
    console.log('🔍 Validation Results:', {
      score: validation.score,
      isValid: validation.isValid,
      issues: validation.issues
    });

    let finalKeywords = keywords;
    let finalQuery = primaryQuery;
    let retryAttempted = false;

    // If validation fails and score is poor, retry once with stronger constraints
    if (validation.score < 70 && !retryAttempted) {
      console.warn('⚠️ Low quality keywords, retrying with enhanced constraints...');
      retryAttempted = true;
      
      // Use fixed keywords if available
      if (validation.fixedKeywords) {
        finalKeywords = validation.fixedKeywords;
        finalQuery = validation.fixedKeywords.join(' ');
      } else {
        // Use channel fallback
        const fallback = getChannelFallback(channel, prompt);
        finalKeywords = fallback.split(' ');
        finalQuery = fallback;
      }
      
      console.log('🔄 Using fallback:', { finalKeywords, finalQuery });
    }

    return new Response(
      JSON.stringify({ 
        keywords: finalKeywords, 
        primaryQuery: finalQuery,
        channel,
        validationScore: validation.score,
        validationPassed: validation.isValid,
        issues: validation.issues,
        suggestions: validation.suggestions
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
