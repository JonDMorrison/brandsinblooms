
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { theme, month, tone, channels, campaignId, userId } = await req.json();

    console.log('Generating campaign content with:', { theme, month, tone, channels, campaignId, userId });

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get company profile for personalization
    let companyProfile = null;
    if (userId) {
      const { data: profile } = await supabase
        .from('company_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      companyProfile = profile;
    }

    const systemPrompt = `You are a garden-center marketing assistant.
- Channel caps: Facebook < 600 chars • Instagram < 180 chars • Blog ≤ 1,400 chars • Newsletter block ≤ 300 chars • Video ≤ 900 chars.
- Newsletter MUST be exactly 5 blocks (hero + 4) — each block starts with a <8-word hook.
- Everything ties to ${theme} for ${month}. No emojis. Max 2 sentences per paragraph.
${companyProfile?.company_name ? `- Company: ${companyProfile.company_name}` : ''}
${companyProfile?.brand_voice ? `- Brand voice: ${companyProfile.brand_voice}` : ''}
${companyProfile?.location_info ? `- Location: ${companyProfile.location_info}` : ''}
Return JSON:
{
  "facebook":"...",
  "instagram":"...",
  "blog":"...",
  "video":"...",
  "newsletter":[{"heading":"","body":"","image_prompt":""},(x4)]
}`;

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
          { 
            role: 'user', 
            content: `Generate marketing content for theme: "${theme}" for the month of ${month}. Tone: ${tone}. Include channels: ${channels.join(', ')}.` 
          }
        ],
        response_format: {
          type: "json_object"
        }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    let generatedContent;

    try {
      generatedContent = JSON.parse(data.choices[0].message.content);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', data.choices[0].message.content);
      throw new Error('Failed to parse generated content as JSON');
    }

    // Validate the response structure
    const requiredFields = ['facebook', 'instagram', 'blog', 'video', 'newsletter'];
    for (const field of requiredFields) {
      if (!generatedContent[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate newsletter structure - Make it more flexible
    if (!Array.isArray(generatedContent.newsletter)) {
      console.log('Newsletter is not an array, attempting to fix...');
      // If newsletter is a string, convert it to a single block array
      if (typeof generatedContent.newsletter === 'string') {
        generatedContent.newsletter = [{
          heading: "Newsletter Content",
          body: generatedContent.newsletter.substring(0, 300),
          image_prompt: `${theme} newsletter visual`
        }];
      } else {
        throw new Error('Newsletter must be an array or string');
      }
    }

    // Ensure newsletter has at least 1 block, pad to 5 if needed
    if (generatedContent.newsletter.length === 0) {
      generatedContent.newsletter = [{
        heading: "Newsletter Content",
        body: `Content about ${theme} for ${month}`,
        image_prompt: `${theme} newsletter visual`
      }];
    }

    // Pad newsletter to exactly 5 blocks if less than 5
    while (generatedContent.newsletter.length < 5) {
      const blockNum = generatedContent.newsletter.length + 1;
      generatedContent.newsletter.push({
        heading: `${theme} Tips ${blockNum}`,
        body: `Additional information about ${theme} for your gardening needs.`,
        image_prompt: `${theme} gardening tips visual ${blockNum}`
      });
    }

    // Trim to exactly 5 blocks if more than 5
    if (generatedContent.newsletter.length > 5) {
      generatedContent.newsletter = generatedContent.newsletter.slice(0, 5);
    }

    // Enforce character limits strictly
    if (generatedContent.facebook.length > 600) {
      generatedContent.facebook = generatedContent.facebook.substring(0, 597) + '...';
    }
    if (generatedContent.instagram.length > 180) {
      generatedContent.instagram = generatedContent.instagram.substring(0, 177) + '...';
    }
    if (generatedContent.blog.length > 1400) {
      generatedContent.blog = generatedContent.blog.substring(0, 1397) + '...';
    }
    if (generatedContent.video.length > 900) {
      generatedContent.video = generatedContent.video.substring(0, 897) + '...';
    }

    // Validate newsletter blocks
    generatedContent.newsletter.forEach((block, index) => {
      if (!block.heading || !block.body || !block.image_prompt) {
        // Fix missing fields
        block.heading = block.heading || `${theme} - Section ${index + 1}`;
        block.body = block.body || `Information about ${theme} for ${month}.`;
        block.image_prompt = block.image_prompt || `${theme} gardening visual ${index + 1}`;
      }
      if (block.heading.length > 60) {
        block.heading = block.heading.substring(0, 57) + '...';
      }
      if (block.body.length > 300) {
        block.body = block.body.substring(0, 297) + '...';
      }
      if (block.image_prompt.length > 140) {
        block.image_prompt = block.image_prompt.substring(0, 137) + '...';
      }
    });

    console.log('Successfully generated campaign content');

    return new Response(JSON.stringify({
      success: true,
      content: generatedContent
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate_campaign_content function:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
