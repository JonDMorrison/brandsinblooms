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
  const basePrompt = `You are an expert garden center image curator. Your ONE JOB: Generate SPECIFIC plant-focused Unsplash search keywords.

🚨 ABSOLUTE REQUIREMENTS - NO EXCEPTIONS:
1. EVERY query MUST include SPECIFIC plant names (rose, tomato, basil, petunia, succulent, maple tree, etc.)
2. EVERY query MUST include COLOR (pink, red, purple, yellow, green, vibrant, etc.)
3. EVERY query MUST include garden retail context (greenhouse, nursery, garden center, potted, display, shelves)
4. EXTRACT plant names from the user's content - use those EXACT plants

✅ CORRECT EXAMPLES:
- "pink petunia hanging baskets greenhouse customers"
- "red tomato seedlings potted nursery display"
- "purple lavender plants garden center shelves"
- "orange marigold flowers potted display customers browsing"

❌ FORBIDDEN - These will be REJECTED:
- "beautiful flowers" (no specific plant)
- "garden plants" (no specific plant or color)
- "seasonal display" (no plant names)
- "flowering plants" (not specific enough)
- "colorful blooms" (what plant? what color specifically?)
- Generic terms without plant variety names

🌱 APPROVED PLANT CATEGORIES:
- Flowers: rose, petunia, marigold, zinnia, sunflower, dahlia, tulip, geranium
- Vegetables: tomato, pepper, cucumber, lettuce, basil, cilantro, kale
- Herbs: basil, rosemary, thyme, mint, oregano, parsley
- Shrubs: hydrangea, azalea, boxwood, rhododendron
- Houseplants: pothos, monstera, succulent, fern, spider plant
- Trees: maple, oak, pine, fruit trees (apple, pear, cherry)

EXTRACT & USE: Read the user's content carefully and identify the specific plants mentioned. Use those EXACT plant names in your keywords.`;

  const channelRequirements: Record<string, string> = {
    facebook: `
FACEBOOK - Social Engagement Focus:
MANDATORY: 
- Specific plant name + color (e.g., "pink petunia", "red geranium")
- Customers/shoppers/people interacting
- Retail setting (greenhouse/garden center/nursery)

✅ CORRECT FORMAT: "customers selecting red geranium hanging baskets greenhouse"
✅ CORRECT FORMAT: "shoppers browsing purple hydrangea potted display nursery"
❌ WRONG: "people shopping for flowers" (no specific plant/color)
❌ WRONG: "garden center customers" (no plant mentioned)`,

    instagram: `
INSTAGRAM - Visual Impact Focus:
MANDATORY:
- Specific plant name + vibrant color descriptor (e.g., "vibrant orange marigold", "deep purple lavender")
- Close-up/detailed shot emphasis
- Potted/display context

✅ CORRECT FORMAT: "vibrant orange marigold flowers potted display close-up"
✅ CORRECT FORMAT: "deep purple lavender plants garden center shelves"
❌ WRONG: "colorful flowers display" (no specific plant)
❌ WRONG: "beautiful blooms" (too generic)`,

    blog: `
BLOG - Educational How-To Focus:
MANDATORY:
- Specific plant name being worked on
- Hands/tools showing technique
- Action verb (pruning, planting, transplanting, etc.)

✅ CORRECT FORMAT: "hands pruning red rose bush garden shears technique"
✅ CORRECT FORMAT: "transplanting basil seedlings hands trowel soil"
❌ WRONG: "gardening techniques" (no specific plant)
❌ WRONG: "pruning demonstration" (no plant specified)`,

    newsletter: `
NEWSLETTER - Product Showcase Focus:
MANDATORY:
- Seasonal context word (spring, summer, fall, winter)
- Specific plant varieties for that season
- Garden center inventory/display context

✅ CORRECT FORMAT: "spring vegetable seedlings tomato pepper greenhouse trays"
✅ CORRECT FORMAT: "fall mum chrysanthemum plants garden center display"
❌ WRONG: "seasonal display" (no specific plants)
❌ WRONG: "spring plants available" (too generic)`,

    video: `
VIDEO - Action/Demo Focus:
MANDATORY:
- Action verb (demonstrating, showing, planting, etc.)
- Specific plant name
- Hands/person performing task

✅ CORRECT FORMAT: "hands demonstrating tomato plant pruning technique garden"
✅ CORRECT FORMAT: "planting petunia seedlings raised bed tutorial"
❌ WRONG: "gardening tutorial" (no specific plant)
❌ WRONG: "plant care video" (too generic)`
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
            content: `CONTENT TO ANALYZE: ${prompt}

TASK: Generate Unsplash search keywords by:
1. IDENTIFYING specific plant names mentioned in the content above (tomato, rose, basil, petunia, etc.)
2. EXTRACTING color descriptors or adding appropriate ones (pink, red, purple, vibrant, etc.)
3. ADDING garden retail context (greenhouse, nursery, garden center, potted, display)
4. COMBINING into a 5-7 word search query

REMEMBER: Use the ACTUAL PLANT NAMES from the content. If the content mentions "Christmas Collection" or "Holiday Plants", specify which plants (e.g., poinsettia, holly, evergreen). If it mentions "Summer Flowers", specify which flowers (e.g., petunia, marigold, zinnia).

Extract and use SPECIFIC plant varieties from the content above.`
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
                  description: "5-7 word Unsplash query. MUST include: 1) SPECIFIC plant name extracted from content, 2) COLOR word, 3) Retail context (greenhouse/nursery/garden center/potted/display). Example: 'vibrant red poinsettia potted greenhouse display' NOT 'holiday plants display'"
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
