
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaignTitle, userId } = await req.json();

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    // Fetch company profile for personalization
    let companyProfile = null;
    if (userId) {
      const { data: profileData, error: profileError } = await supabase
        .from('company_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!profileError && profileData) {
        companyProfile = profileData;
      }
    }

    // Build company context for AI with enhanced regional focus
    let companyContext = '';
    if (companyProfile) {
      companyContext = `
COMPANY PROFILE:
Company Name: ${companyProfile.company_name || 'Garden Center'}
Overview: ${companyProfile.company_overview || ''}
Brand Voice: ${companyProfile.brand_voice || ''}
Target Audience: ${companyProfile.target_audience || ''}
Ideal Customer: ${companyProfile.ideal_customer || ''}
Unique Selling Points: ${companyProfile.unique_selling_points || ''}
Company Values: ${companyProfile.company_values || ''}
Specializations: ${companyProfile.specializations || ''}
Location Info: ${companyProfile.location_info || ''}

REGIONAL VIDEO SCRIPT FOCUS:
- Use the Location Info to create content that's highly specific to their geographic region and local climate
- Reference local growing seasons, weather patterns, and regional gardening calendars
- Include region-appropriate plant recommendations and gardening techniques
- Consider local hardiness zones, frost dates, and seasonal timing specific to their location
- Address regional gardening challenges and local growing conditions
- Reference local gardening culture, community practices, and regional preferences
- Use timing and seasonal advice that's accurate for their specific climate zone
- Include locally-relevant tips that would resonate with gardeners in their area
- Make references to local weather patterns, soil conditions, and environmental factors

IMPORTANT: Use this company information to create a personalized video script that sounds authentic to this specific garden center owner or expert speaking to their local community about region-specific gardening advice.

CRITICAL CONTENT RESTRICTIONS: 
- ABSOLUTELY NEVER use the phrase "Green Thumbs", "green thumb", "Green Thumb", or any variation of this phrase in any content
- ABSOLUTELY NEVER use bullet points (•) or numbered lists (1., 2., 3.) in the content
- ABSOLUTELY NEVER use dashes (-) to create lists
- ABSOLUTELY NEVER start with "Welcome to" or mention week numbers in any form
- ALWAYS start with a powerful, attention-grabbing hook that immediately draws viewers in
- Write ONLY in flowing paragraphs and natural sentences
- Avoid ALL cliché gardening phrases and focus on fresh, authentic language
- Make all advice regionally appropriate and climate-specific
- If you need to present multiple points, weave them into natural paragraph flow
`;
    } else {
      companyContext = `
CRITICAL CONTENT RESTRICTIONS: 
- ABSOLUTELY NEVER use the phrase "Green Thumbs", "green thumb", "Green Thumb", or any variation of this phrase in any content
- ABSOLUTELY NEVER use bullet points (•) or numbered lists (1., 2., 3.) in the content
- ABSOLUTELY NEVER use dashes (-) to create lists
- ABSOLUTELY NEVER start with "Welcome to" or mention week numbers in any form
- ALWAYS start with a powerful, attention-grabbing hook that immediately draws viewers in
- Write ONLY in flowing paragraphs and natural sentences
- Avoid ALL cliché gardening phrases and focus on fresh, authentic language
- Since no location is specified, keep advice general but mention the importance of knowing your local climate zone
- If you need to present multiple points, weave them into natural paragraph flow
`;
    }

    const prompt = `Create a video script about ${campaignTitle} for a garden center owner/expert speaking to their local community. ${companyContext}

Requirements:
- Start with a powerful, attention-grabbing hook - NO "Welcome to" language or week mentions
- Write as if the garden center owner/expert is speaking directly to their local customers
- Use the company's brand voice and speak to their target audience
- Keep it conversational and natural (60-90 seconds when spoken)
- Include practical tips that align with their specializations and values and are appropriate for their specific region
- Reference their expertise and unique selling points naturally
- Include a strong opening hook and clear call-to-action
- Make it feel authentic and personal, not generic
- Structure it with clear sections: Hook, Main Content, Call-to-Action
- Provide region-specific gardening advice based on their location and local climate conditions
- Reference local growing seasons, weather patterns, and regional gardening challenges
- Include plant recommendations and techniques that work well in their specific geographic area
- Use timing and seasonal advice that's accurate for their local hardiness zone
- Consider local soil conditions, weather patterns, and regional gardening culture
- Make it sound like a local expert giving advice to their community
- Write in flowing paragraphs and natural sentences, NOT bullet points, numbered lists, or dashes
- ABSOLUTELY NEVER use "Green Thumbs", "green thumb", or any variation of this phrase
- ABSOLUTELY NEVER start with "Welcome to" or mention week numbers
- If you need to present multiple points, weave them naturally into conversational paragraph form

Format the response as a natural speaking script, not bullet points or lists.`;

    console.log('Generating personalized, region-specific video script with OpenAI');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a professional video script writer specializing in garden center content with deep knowledge of regional gardening differences across various climate zones. Create authentic, conversational scripts that sound natural when spoken by the garden center owner or expert to their local community. Focus on region-specific advice that considers local climate, growing conditions, seasonal timing, and regional gardening challenges. CRITICAL RULES: ABSOLUTELY NEVER use the phrase "Green Thumbs", "green thumb", "Green Thumb", or any variation of this phrase - this is completely forbidden. ABSOLUTELY NEVER use bullet points (•), numbered lists (1., 2., 3.), or dashes (-) to create lists - write only in flowing paragraphs and natural sentences. ABSOLUTELY NEVER start with "Welcome to" or mention week numbers in any form. ALWAYS start with a powerful, attention-grabbing hook that immediately draws viewers in. If you need to present multiple points, weave them naturally into conversational paragraph form.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const videoScript = data.choices[0].message.content;

    console.log('Generated personalized, region-specific video script:', videoScript);

    return new Response(JSON.stringify({ script: videoScript }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-video-script function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
