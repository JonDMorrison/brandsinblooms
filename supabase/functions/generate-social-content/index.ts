import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SocialContentRequest {
  platform: 'facebook' | 'instagram';
  theme: string;
  themeDescription?: string;
  month: string;
  weekNumber: number;
  contentType?: 'tips' | 'feature' | 'workshop' | 'inspiration' | 'behind-scenes';
  companyProfile?: {
    company_name?: string;
    brand_voice?: string;
    target_audience?: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: SocialContentRequest = await req.json();
    const { platform, theme, themeDescription, month, weekNumber, contentType = 'tips', companyProfile } = request;

    console.log(`[generate-social-content] Request received:`, { platform, theme, month, weekNumber, contentType });

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      console.error('[generate-social-content] OPENAI_API_KEY not configured');
      throw new Error('OPENAI_API_KEY not configured');
    }

    const monthDate = new Date(month + '-01');
    const monthName = monthDate.toLocaleString('default', { month: 'long' });
    const weekLabel = ['Early', 'Mid', 'Late', 'End'][weekNumber - 1] || 'Mid';

    // Platform-specific constraints
    const charLimit = platform === 'facebook' ? 500 : 300;
    const needsHashtags = platform === 'instagram';

    // Build enhanced system prompt with focus on educational content
    const systemPrompt = `You are an expert horticulturist and garden center educator creating ${platform.toUpperCase()} posts that TEACH customers how to succeed with gardening.

CONTEXT:
- Platform: ${platform.toUpperCase()}
- Theme: ${theme}
${themeDescription ? `- Theme Focus: ${themeDescription}` : ''}
- Month: ${monthName}
- Time Period: ${weekLabel} ${monthName}
- Content Type: ${contentType}
${companyProfile?.company_name ? `- Business: ${companyProfile.company_name}` : ''}
${companyProfile?.brand_voice ? `- Brand Voice: ${companyProfile.brand_voice}` : ''}
${companyProfile?.target_audience ? `- Audience: ${companyProfile.target_audience}` : ''}

=== CRITICAL FORMATTING RULE ===
PLAIN TEXT ONLY - NO MARKDOWN ALLOWED
Facebook and Instagram DO NOT render markdown. They show asterisks and underscores as literal text.

DO NOT USE:
- Asterisks for bold (like this: Water deeply twice weekly)
- Underscores for italic (like this: important note)
- Double asterisks (forbidden: Timing Your Harvest)
- Any markdown syntax whatsoever

INSTEAD USE FOR EMPHASIS:
- CAPITAL LETTERS for emphasis
- Emojis to break up text
- Line breaks for structure
- Plain text with natural language emphasis

CORRECT EXAMPLES:
✅ "Timing Your Harvest:" (plain text with colon)
✅ "IMPORTANT: Water deeply twice weekly" (caps for emphasis)
✅ "Maple Trees - Known for brilliant red hues" (plain dash)

WRONG EXAMPLES (NEVER DO THIS):
❌ "Timing Your Harvest:" (has asterisks - forbidden)
❌ "Water deeply twice weekly" (has underscores - forbidden)
❌ "Maple Trees (Acer)" (has asterisks - forbidden)

If you use ANY asterisks or underscores for formatting, you have FAILED this task.
Write everything in plain text as if you were typing a regular text message.
=== END CRITICAL FORMATTING RULE ===

🌱 CRITICAL REQUIREMENTS - EDUCATIONAL VALUE:

1. Include Specific Plant Care Instructions (PLAIN TEXT ONLY):
   - Exact watering schedules (e.g., "Water deeply twice weekly")
   - Fertilizing frequency and NPK ratios (e.g., "10-10-10 every 2 weeks")
   - Pruning techniques with timing (e.g., "Deadhead spent blooms weekly")
   - Light requirements (e.g., "6-8 hours direct sun")
   - Soil preferences (e.g., "Well-drained, pH 6.0-7.0")

2. Teach Specific Gardening Techniques (PLAIN TEXT ONLY):
   - Step-by-step how-to instructions (e.g., "Cut at 45 degree angle above leaf node")
   - Measurements and distances (e.g., "Plant 18 inches apart")
   - Tool recommendations (e.g., "Use sharp bypass pruners")
   - Timing windows (e.g., "Plant after last frost, April 15-May 1")

3. Provide Problem-Solving Advice (PLAIN TEXT ONLY):
   - Common issues and solutions (e.g., "Yellow leaves = overwatering")
   - Pest identification and organic controls (e.g., "Aphids? Spray neem oil weekly")
   - Disease prevention tips (e.g., "Water at soil level to prevent powdery mildew")

4. Give Expert Recommendations (PLAIN TEXT ONLY):
   - Specific plant varieties to try (e.g., "Try Brandywine heirloom tomatoes")
   - Product suggestions (e.g., "Use slow-release granular fertilizer")
   - Seasonal best practices (e.g., "Mulch 2-3 inches deep in ${monthName}")

REMINDER: Write all content in PLAIN TEXT - no asterisks, no underscores, no markdown formatting.

CONTENT TYPE GUIDANCE:
${contentType === 'tips' ? '- Share 3-5 ACTIONABLE tips with specific measurements/timing\n- Each tip should be immediately implementable' : ''}
${contentType === 'feature' ? '- Highlight a specific plant + complete care guide\n- Include: light, water, soil, fertilizer, common problems' : ''}
${contentType === 'workshop' ? '- Teach ONE technique in step-by-step detail\n- Include: tools needed, timing, exact measurements' : ''}
${contentType === 'inspiration' ? '- Show possibilities BUT include basic care requirements\n- Make it achievable with clear next steps' : ''}
${contentType === 'behind-scenes' ? '- Share expert knowledge and insider tips\n- Reveal "pro secrets" customers can use' : ''}

FORMATTING (PLAIN TEXT ONLY - CRITICAL):
- ${platform === 'facebook' ? `Maximum ${charLimit} characters with paragraph breaks` : `Maximum ${charLimit} characters (excluding hashtags)`}
- ${platform === 'facebook' ? 'Use numbered lists or bullet points for clarity (1. 2. 3. format with plain text)' : 'Use emojis (2-4 total) to break up text'}
${needsHashtags ? '- Include 5-8 relevant hashtags on separate lines' : ''}
- Clear call-to-action (visit for supplies, ask questions, attend workshop)
- Emphasize ${monthName} seasonal timing and urgency
- CRITICAL: NO ASTERISKS, NO UNDERSCORES, NO MARKDOWN - Only plain text like a regular social media post

🎨 IMAGE QUERY: Generate a 3-6 word Unsplash search query showing the specific plant/technique.
Be highly specific: plant names, growth stage, season, colors, garden setting.
Example: "heirloom tomato seedlings transplanting" NOT "gardening tips"

Return JSON with these exact fields:
{
  "content": "The ${platform} post text...",
  "imageQuery": "garden-focused unsplash search query",
  "hashtags": "${needsHashtags ? 'space-separated hashtags' : 'empty string'}"
}`;

    const userPrompt = `Generate a ${platform} post for "${theme}" in ${monthName} (${weekLabel}). 
Content type: ${contentType}.
${themeDescription ? `Additional context: ${themeDescription}` : ''}

CRITICAL REQUIREMENTS:
1. This post MUST teach customers specific, actionable gardening techniques
2. Include exact measurements, timing, and step-by-step instructions
3. Think like a horticulture professor explaining to beginners
4. Make it so valuable they will save it for reference

ABSOLUTELY CRITICAL FORMATTING RULE:
- Write in PLAIN TEXT ONLY
- DO NOT use asterisks for bold (forbidden)
- DO NOT use underscores for italic (forbidden)
- Write like a normal social media post without any markdown
- Use CAPS, emojis, or line breaks for emphasis instead
- If you include ANY asterisks or underscores for formatting, you have FAILED

Return valid JSON only.`;

    console.log(`[generate-social-content] Generating ${platform} content for theme: ${theme}, month: ${monthName}`);

    // Call OpenAI with structured output
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_social_post",
            description: `Generate ${platform} post with image query`,
            parameters: {
              type: "object",
              properties: {
                content: {
                  type: "string",
                  description: `The ${platform} post content in PLAIN TEXT ONLY - NO asterisks, NO underscores, NO markdown. Write like a normal social media post (${charLimit} chars max). Use CAPS and emojis for emphasis, not markdown.`
                },
                imageQuery: {
                  type: "string",
                  description: "Garden-focused Unsplash search query (3-5 words, must include garden context)"
                },
                hashtags: {
                  type: "string",
                  description: needsHashtags ? "Space-separated hashtags" : "Leave empty for Facebook"
                }
              },
              required: ["content", "imageQuery", "hashtags"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "generate_social_post" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[generate-social-content] AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please check your OpenAI API credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('[generate-social-content] AI response received');
    
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      console.error('[generate-social-content] No tool call in response:', JSON.stringify(data, null, 2));
      throw new Error('AI did not return structured output');
    }

    const result = JSON.parse(toolCall.function.arguments);
    
    // Use OpenAI's image query directly
    const imageQuery = result.imageQuery || 'garden center plants';
    
    console.log(`[generate-social-content] Success - Content length: ${result.content?.length || 0}, imageQuery: "${imageQuery}"`);

    // Fetch images from Unsplash using validated query
    let fetchedImages: any[] = [];

    try {
      console.log(`[generate-social-content] 📸 Fetching images for: "${imageQuery}"`);
      
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const imageResponse = await supabase.functions.invoke('fetch-unsplash-images', {
        body: { 
          query: imageQuery,
          maxImages: 8,
          orientation: 'squarish',
          rawQuery: true  // Trust OpenAI's query
        }
      });
      
      if (imageResponse.error) {
        console.error('[generate-social-content] ❌ Image fetch error:', imageResponse.error);
      } else if (imageResponse.data?.images) {
        fetchedImages = imageResponse.data.images;
        console.log(`[generate-social-content] ✅ Fetched ${fetchedImages.length} images`);
      }
    } catch (imageError) {
      console.error('[generate-social-content] ❌ Exception fetching images:', imageError);
      // Continue without images - don't fail
    }

    // Format images for response
    const formattedImages = fetchedImages.map((img: any) => ({
      url: img.urls?.regular || img.url,
      thumb: img.urls?.thumb || img.urls?.small || img.url,
      alt: img.alt || img.alt_description || theme,
      photographer: img.photographer || img.user?.name || 'Unknown',
      photographerUrl: img.photographer_url || img.user?.links?.html,
      unsplashId: img.unsplash_id || img.id
    }));

    return new Response(
      JSON.stringify({
        content: result.content,
        imageQuery: imageQuery,
        hashtags: result.hashtags || '',
        images: formattedImages,
        imageCount: formattedImages.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[generate-social-content] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate social content' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
