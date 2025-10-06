import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { validateAndLogQuery, getImageQueryPromptInstructions } from "../_shared/unsplash-keyword-validator.ts";

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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const monthDate = new Date(month + '-01');
    const monthName = monthDate.toLocaleString('default', { month: 'long' });
    const weekLabel = ['Early', 'Mid', 'Late', 'End'][weekNumber - 1] || 'Mid';

    // Platform-specific constraints
    const charLimit = platform === 'facebook' ? 500 : 300;
    const needsHashtags = platform === 'instagram';

    // Build enhanced system prompt
    const systemPrompt = `You are an expert garden center social media manager creating engaging ${platform.toUpperCase()} posts.

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

REQUIREMENTS:
1. Create ${platform === 'facebook' ? 'engaging, informative' : 'visual, inspiring'} content about "${theme}"
2. ${platform === 'facebook' ? `Maximum ${charLimit} characters` : `Maximum ${charLimit} characters (excluding hashtags)`}
3. Focus on actionable ${monthName} gardening activities
4. Include clear call-to-action (visit store, check website, attend event)
5. ${platform === 'facebook' ? 'Use natural paragraph breaks' : 'Use emojis naturally (2-4 total)'}
${needsHashtags ? '6. Include 5-8 relevant hashtags on separate lines at the end' : ''}
7. Speak directly to garden center customers
8. Emphasize seasonal urgency and timing

${getImageQueryPromptInstructions()}

Return JSON with these exact fields:
{
  "content": "The ${platform} post text...",
  "imageQuery": "garden-focused unsplash search query",
  "hashtags": "${needsHashtags ? 'space-separated hashtags' : 'empty string'}"
}`;

    const userPrompt = `Generate a ${platform} post for "${theme}" in ${monthName} (${weekLabel}). 
Content type: ${contentType}.
${themeDescription ? `Additional context: ${themeDescription}` : ''}

Make it compelling, actionable, and seasonal. Return valid JSON only.`;

    console.log(`[generate-social-content] Generating ${platform} content for theme: ${theme}, month: ${monthName}`);

    // Call Lovable AI with structured output
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
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
                  description: `The ${platform} post content (${charLimit} chars max)`
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
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      console.error('[generate-social-content] No tool call in response:', JSON.stringify(data, null, 2));
      throw new Error('AI did not return structured output');
    }

    const result = JSON.parse(toolCall.function.arguments);
    
    // Validate and fix imageQuery
    const validatedQuery = validateAndLogQuery(result.imageQuery || '', `${platform} ${theme}`);
    
    console.log(`[generate-social-content] Generated ${platform} content successfully`);
    console.log(`[generate-social-content] Content length: ${result.content?.length || 0}, imageQuery: "${validatedQuery}"`);

    return new Response(
      JSON.stringify({
        content: result.content,
        imageQuery: validatedQuery,
        hashtags: result.hashtags || ''
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
