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
  const basePrompt = `You are an expert garden center image curator. Your ONE JOB: Generate SPECIFIC plant-focused Unsplash search keywords that GUARANTEE garden-relevant images.

🚨 CRITICAL PREFIX REQUIREMENT: Every keyword MUST start with "garden_" to ensure Unsplash returns garden images.

🚨 ABSOLUTE REQUIREMENTS - QUERIES WITHOUT THESE WILL RETURN WRONG IMAGES:
1. MANDATORY "garden_" prefix on EVERY keyword (garden_pink, garden_petunia, garden_nursery)
2. SPECIFIC plant name (rose, tomato, basil, petunia, succulent, NOT "plants" or "flowers")
3. COLOR descriptor (pink, red, purple, yellow, vibrant, NOT "colorful" or "beautiful")
4. Garden retail context (greenhouse, nursery, garden_center, potted, display, shelves)
5. EXTRACT plant names from content - use EXACT plants mentioned

WHY PREFIX MATTERS: Without "garden_" prefix, generic queries return architecture/fashion/people instead of plants!
- "Week" → returns buildings and Louis Vuitton stores ❌
- "garden" alone → returns architecture ❌
- "plants" alone → returns random objects ❌
- "pink petunia" → returns fashion and random objects ❌

✅ CORRECT EXAMPLES (with garden_ prefix - these return garden images):
- "garden_pink garden_petunia garden_hanging_baskets garden_greenhouse garden_customers"
- "garden_red garden_tomato garden_seedlings garden_potted garden_nursery garden_display"
- "garden_purple garden_lavender garden_plants garden_center garden_shelves"
- "garden_orange garden_marigold garden_flowers garden_potted garden_display garden_closeup"

❌ FORBIDDEN (missing garden_ prefix - these return non-garden images):
- "beautiful flowers" → returns abstract art
- "pink petunia hanging baskets" → returns fashion/people
- "garden plants" → returns architecture
- "seasonal display" → returns store interiors
- "flowering plants" → returns fashion/people
- "colorful blooms" → returns random objects
- "Week" or any single word → returns irrelevant content

🌱 SPECIFIC PLANT NAMES TO USE:
- Flowers: rose, petunia, marigold, zinnia, sunflower, dahlia, tulip, geranium, pansy, impatiens
- Vegetables: tomato, pepper, cucumber, lettuce, basil, cilantro, kale, carrot, onion
- Herbs: basil, rosemary, thyme, mint, oregano, parsley, sage, dill
- Shrubs: hydrangea, azalea, boxwood, rhododendron, lilac, forsythia
- Houseplants: pothos, monstera, succulent, fern, spider plant, peace lily, snake plant
- Trees: maple, oak, pine, apple, pear, cherry, birch

MANDATORY PROCESS:
1. READ content and EXTRACT specific plant names mentioned
2. If content mentions "Holiday Plants" → specify "poinsettia" or "holly"
3. If content mentions "Spring Flowers" → specify "tulip" or "daffodil"  
4. If content mentions "Summer Blooms" → specify "petunia" or "marigold"
5. ALWAYS add color + retail context to the plant name`;

  const channelRequirements: Record<string, string> = {
    facebook: `
FACEBOOK - Social Engagement Focus:
MANDATORY: 
- Prefix EVERY keyword with "garden_"
- Specific plant name + color (e.g., "garden_pink garden_petunia", "garden_red garden_geranium")
- Customers/shoppers/people interacting
- Retail setting (greenhouse/garden_center/nursery)

✅ CORRECT FORMAT: "garden_customers garden_selecting garden_red garden_geranium garden_hanging_baskets garden_greenhouse"
✅ CORRECT FORMAT: "garden_shoppers garden_browsing garden_purple garden_hydrangea garden_potted garden_display garden_nursery"
❌ WRONG: "customers selecting red geranium" (missing garden_ prefix)
❌ WRONG: "people shopping for flowers" (no prefix, no specific plant)`,

    instagram: `
INSTAGRAM - Visual Impact Focus:
MANDATORY:
- Prefix EVERY keyword with "garden_"
- Specific plant name + vibrant color descriptor
- Close-up/detailed shot emphasis
- Potted/display context

✅ CORRECT FORMAT: "garden_vibrant_orange garden_marigold garden_flowers garden_potted garden_display garden_closeup"
✅ CORRECT FORMAT: "garden_deep_purple garden_lavender garden_plants garden_center garden_shelves"
❌ WRONG: "vibrant orange marigold" (missing garden_ prefix)
❌ WRONG: "colorful flowers display" (no prefix, no specific plant)`,

    blog: `
BLOG - Educational How-To Focus:
MANDATORY:
- Prefix EVERY keyword with "garden_"
- Specific plant name being worked on
- Hands/tools showing technique
- Action verb (pruning, planting, transplanting)

✅ CORRECT FORMAT: "garden_hands garden_pruning garden_red garden_rose garden_bush garden_shears garden_technique"
✅ CORRECT FORMAT: "garden_transplanting garden_basil garden_seedlings garden_hands garden_trowel garden_soil"
❌ WRONG: "hands pruning red rose" (missing garden_ prefix)
❌ WRONG: "gardening techniques" (no prefix, no specific plant)`,

    newsletter: `
NEWSLETTER - Product Showcase Focus:
MANDATORY:
- Prefix EVERY keyword with "garden_"
- Seasonal context word (spring, summer, fall, winter)
- Specific plant varieties for that season
- Garden center inventory/display context

✅ CORRECT FORMAT: "garden_spring garden_vegetable garden_seedlings garden_tomato garden_pepper garden_greenhouse garden_trays"
✅ CORRECT FORMAT: "garden_fall garden_mum garden_chrysanthemum garden_plants garden_center garden_display"
❌ WRONG: "spring vegetable seedlings" (missing garden_ prefix)
❌ WRONG: "seasonal display" (no prefix, no specific plants)`,

    video: `
VIDEO - Action/Demo Focus:
MANDATORY:
- Prefix EVERY keyword with "garden_"
- Action verb (demonstrating, showing, planting)
- Specific plant name
- Hands/person performing task

✅ CORRECT FORMAT: "garden_hands garden_demonstrating garden_tomato garden_plant garden_pruning garden_technique"
✅ CORRECT FORMAT: "garden_planting garden_petunia garden_seedlings garden_raised_bed garden_tutorial"
❌ WRONG: "hands demonstrating tomato plant" (missing garden_ prefix)
❌ WRONG: "gardening tutorial" (no prefix, no specific plant)`
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
1. PREFIX every single keyword with "garden_" (CRITICAL - this prevents wrong image results!)
2. IDENTIFYING specific plant names mentioned in the content above (tomato, rose, basil, petunia, etc.)
3. EXTRACTING color descriptors or adding appropriate ones (pink, red, purple, vibrant, etc.)
4. ADDING garden retail context (greenhouse, nursery, garden_center, potted, display)
5. COMBINING into a 5-7 word search query with "garden_" prefix on EACH word

MANDATORY PREFIX EXAMPLES:
- Content: "Pink Petunias" → Keywords: ["garden_pink", "garden_petunia", "garden_flowers", "garden_potted", "garden_display"]
- Content: "Holiday Plants" → Keywords: ["garden_poinsettia", "garden_red", "garden_potted", "garden_greenhouse", "garden_holiday"]
- Content: "Spring Flowers" → Keywords: ["garden_spring", "garden_tulip", "garden_daffodil", "garden_colorful", "garden_nursery"]

REMEMBER: 
1. EVERY keyword must start with "garden_" (e.g., "garden_pink garden_petunia" NOT "pink petunia")
2. Use the ACTUAL PLANT NAMES from the content
3. If content mentions "Christmas Collection" or "Holiday Plants" → specify "garden_poinsettia garden_holly garden_evergreen"
4. If content mentions "Summer Flowers" → specify "garden_petunia garden_marigold garden_zinnia"

Extract and use SPECIFIC plant varieties with garden_ prefix from the content above.`
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
                  description: "5-7 word Unsplash query. CRITICAL: MUST start EACH keyword with 'garden_' prefix. Example: 'garden_red garden_roses garden_potted garden_nursery garden_display'. BAD: 'red roses potted nursery' (missing prefix). BAD: 'garden plants display' (generic). BAD: 'Week' (no prefix, generic). GOOD: 'garden_pink garden_petunia garden_hanging_baskets garden_greenhouse'. The query MUST pass this test: Does EVERY word start with 'garden_'? Does it name a specific plant? Does it include a color?"
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
    let { keywords, primaryQuery } = result;

    // ========== ENFORCE GARDEN_ PREFIX ==========
    // This guarantees prefix even if OpenAI forgets
    const ensureGardenPrefix = (keywords: string[]): string[] => {
      return keywords.map(kw => {
        const normalized = kw.trim().toLowerCase().replace(/\s+/g, '_');
        if (!normalized.startsWith('garden_')) {
          console.log(`[PREFIX-FIX] Adding garden_ prefix to: "${kw}"`);
          return `garden_${normalized}`;
        }
        return normalized;
      });
    };

    // Apply prefix to keywords array
    keywords = ensureGardenPrefix(keywords);

    // Apply prefix to primaryQuery
    if (!primaryQuery.includes('garden_')) {
      console.log(`[PREFIX-FIX] Query missing prefix: "${primaryQuery}"`);
      const queryWords = primaryQuery.split(/\s+/);
      primaryQuery = queryWords.map(word => {
        const normalized = word.toLowerCase().replace(/\s+/g, '_');
        return normalized.startsWith('garden_') ? normalized : `garden_${normalized}`;
      }).join(' ');
      console.log(`[PREFIX-FIX] Fixed query: "${primaryQuery}"`);
    }

    console.log('✅ AI Generated (with prefix):', { keywords, primaryQuery });

    // === VALIDATE KEYWORDS ===
    const { validateGardenKeywords } = await import('../_shared/enhanced-keyword-validator.ts');
    
    const validation = validateGardenKeywords(keywords, channel);
    
    console.log('🔍 Validation Results:', {
      score: validation.score,
      isValid: validation.isValid,
      issues: validation.issues
    });

    // If validation fails, return error with details for user to try manual search
    if (!validation.isValid) {
      console.error('❌ Keyword validation failed:', validation);
      return new Response(
        JSON.stringify({ 
          error: 'Generated keywords did not meet quality standards',
          details: validation.issues.join('. '),
          suggestions: validation.suggestions,
          score: validation.score,
          retryable: true
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        keywords, 
        primaryQuery,
        channel,
        validationScore: validation.score,
        validationPassed: validation.isValid,
        issues: validation.issues.length > 0 ? validation.issues : undefined,
        suggestions: validation.suggestions.length > 0 ? validation.suggestions : undefined
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
