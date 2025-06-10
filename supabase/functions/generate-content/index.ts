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
    const { postType, campaignTitle, userId, weekDescription } = await req.json();

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
Tone of Writing: ${companyProfile.tone_of_writing || ''}
Target Audience: ${companyProfile.target_audience || ''}
Ideal Customer: ${companyProfile.ideal_customer || ''}
Unique Selling Points: ${companyProfile.unique_selling_points || ''}
Company Values: ${companyProfile.company_values || ''}
Seasonal Focus: ${companyProfile.seasonal_focus || ''}
Specializations: ${companyProfile.specializations || ''}
Location Info: ${companyProfile.location_info || ''}

CAMPAIGN THEME & CONTEXT:
Weekly Theme: ${campaignTitle}
Week Description: ${weekDescription || 'No specific description provided'}

IMPORTANT: This content MUST specifically relate to and support the weekly theme "${campaignTitle}" and the description "${weekDescription || 'general theme'}". Make sure every piece of content directly ties back to this specific theme and provides value related to it.

REGIONAL CONSIDERATIONS:
- Use the Location Info to understand the company's geographic region, climate zone, and local conditions
- Factor in regional growing seasons, weather patterns, and plant hardiness zones
- Consider local gardening challenges (drought, humidity, frost dates, soil conditions, pests)
- Reference region-specific plants, trees, and gardening practices that work best in their area
- Mention seasonal timing that's appropriate for their climate (when to plant, prune, fertilize)
- Include local gardening terminology and regional preferences
- Consider cultural and demographic factors of their specific region
- Reference local weather patterns and how they affect gardening decisions

IMPORTANT: Use this company information to create highly localized, region-specific content that sounds authentic to this specific garden center and their local climate/conditions.

CRITICAL CONTENT RESTRICTIONS: 
- ABSOLUTELY NEVER use the phrase "Green Thumbs", "green thumb", "Green Thumb", or any variation of this phrase in any content
- ABSOLUTELY NEVER use bullet points (•) or numbered lists (1., 2., 3.) in the content
- ABSOLUTELY NEVER use dashes (-) to create lists
- ABSOLUTELY NEVER start with "Welcome to" or mention week numbers (e.g., "Week 12", "This week", etc.)
- ALWAYS start content with a powerful, attention-grabbing hook that immediately engages the reader
- Write ONLY in flowing paragraphs and natural sentences
- Avoid ALL cliché gardening phrases and focus on fresh, authentic language
- Make content regionally relevant and climate-appropriate
- If you need to present multiple points, weave them into natural paragraph flow
`;
    } else {
      companyContext = `
CAMPAIGN THEME & CONTEXT:
Weekly Theme: ${campaignTitle}
Week Description: ${weekDescription || 'No specific description provided'}

IMPORTANT: This content MUST specifically relate to and support the weekly theme "${campaignTitle}" and the description "${weekDescription || 'general theme'}". Make sure every piece of content directly ties back to this specific theme and provides value related to it.

CRITICAL CONTENT RESTRICTIONS: 
- ABSOLUTELY NEVER use the phrase "Green Thumbs", "green thumb", "Green Thumb", or any variation of this phrase in any content
- ABSOLUTELY NEVER use bullet points (•) or numbered lists (1., 2., 3.) in the content
- ABSOLUTELY NEVER use dashes (-) to create lists
- ABSOLUTELY NEVER start with "Welcome to" or mention week numbers (e.g., "Week 12", "This week", etc.)
- ALWAYS start content with a powerful, attention-grabbing hook that immediately engages the reader
- Write ONLY in flowing paragraphs and natural sentences
- Avoid ALL cliché gardening phrases and focus on fresh, authentic language
- Since no location is specified, keep advice general but mention the importance of knowing your local climate zone
- If you need to present multiple points, weave them into natural paragraph flow
`;
    }

    const contentPrompts = {
      instagram: `Create an engaging Instagram post specifically about "${campaignTitle}" with focus on: ${weekDescription || 'the main theme'}. ${companyContext}

Requirements:
- Start with a powerful hook that directly relates to "${campaignTitle}"
- The entire post must be focused on and provide value related to the "${campaignTitle}" theme
- Reference the week description "${weekDescription}" in your content approach
- Write in the company's brand voice and tone
- Keep it engaging and visual-friendly (under 150 words)
- Include relevant emojis
- Reference the company's specializations when relevant to the theme
- Speak to their target audience about this specific theme
- Include a call-to-action related to the theme
- Make content specific to their geographic region and local climate conditions when relevant to the theme
- Use plant varieties and gardening advice appropriate for their climate zone that relates to the theme
- Make it feel authentic to this specific garden center and their local area
- Write in flowing paragraphs, NEVER bullet points, numbered lists, or dashes
- ABSOLUTELY NEVER use "Green Thumbs", "green thumb", or any variation
- ABSOLUTELY NEVER mention week numbers or start with "Welcome to"
- Present information in natural, conversational paragraph form that clearly connects to the "${campaignTitle}" theme`,

      facebook: `Create a Facebook post specifically about "${campaignTitle}" with focus on: ${weekDescription || 'the main theme'}. ${companyContext}

Requirements:
- Start with a powerful hook that directly introduces the "${campaignTitle}" theme
- The entire post must center around and provide valuable insights about "${campaignTitle}"
- Use the week description "${weekDescription}" to guide your content direction
- Write in the company's brand voice and tone
- Be conversational and community-focused (150-250 words)
- Reference the company's unique selling points as they relate to this theme
- Speak to their ideal customer about this specific topic
- Include questions to encourage engagement about the theme
- Make content highly relevant to their specific geographic region when it relates to the theme
- Reference local weather patterns, growing seasons, or regional gardening challenges that connect to the theme
- Mention plants and gardening practices that work well in their specific climate and relate to the theme
- Consider local gardening culture and regional preferences relevant to the theme
- Make it feel personal and authentic to this garden center and their community
- Write in flowing paragraphs, NEVER bullet points, numbered lists, or dashes
- ABSOLUTELY NEVER use "Green Thumbs", "green thumb", or any variation
- ABSOLUTELY NEVER mention week numbers or start with "Welcome to"
- Present information in natural, conversational paragraph form that clearly supports the "${campaignTitle}" theme`,

      email: `Create email content specifically about "${campaignTitle}" with focus on: ${weekDescription || 'the main theme'}. ${companyContext}

Requirements:
- Start with a powerful subject line and hook that immediately identifies this is about "${campaignTitle}"
- The entire email must be dedicated to providing value around the "${campaignTitle}" theme
- Use the week description "${weekDescription}" to shape your content approach
- Write in the company's tone of writing
- Be informative and valuable about this specific theme (100-200 words)
- Reference the company's seasonal focus when it relates to this theme
- Include their specializations as they connect to the theme
- Speak to their target audience specifically about this topic
- Include a clear call-to-action related to the theme
- Provide region-specific gardening advice based on their location that relates to the theme
- Consider local climate conditions, hardiness zones, and seasonal timing relevant to the theme
- Reference regional growing challenges and solutions that connect to the theme
- Use plant recommendations appropriate for their geographic area that support the theme
- Make timing advice specific to their local growing season when relevant to the theme
- Make it feel personal from this specific garden center about this specific topic
- Write in flowing paragraphs, NEVER bullet points, numbered lists, or dashes
- ABSOLUTELY NEVER use "Green Thumbs", "green thumb", or any variation
- ABSOLUTELY NEVER mention week numbers or start with "Welcome to"
- Present information in natural, conversational paragraph form that clearly addresses the "${campaignTitle}" theme`,

      video: `Create a video script specifically about "${campaignTitle}" with focus on: ${weekDescription || 'the main theme'}. ${companyContext}

Requirements:
- Start with a powerful hook that immediately establishes this video is about "${campaignTitle}"
- The entire script must be focused on delivering valuable content about the "${campaignTitle}" theme
- Use the week description "${weekDescription}" to guide your script direction
- Write in the company's brand voice
- Keep it conversational and natural (60-90 seconds when spoken)
- Reference the company's expertise and specializations as they relate to this theme
- Include practical tips that align with their values and directly support the theme
- Speak directly to their ideal customer about this specific topic
- Include a strong opening hook and clear call-to-action related to the theme
- Provide region-specific gardening advice and recommendations that connect to the theme
- Reference local climate conditions, weather patterns, and growing seasons when relevant to the theme
- Mention plants and techniques that work best in their specific geographic area and support the theme
- Consider local gardening challenges and regional solutions related to the theme
- Use timing and seasonal advice appropriate for their location when it connects to the theme
- Make it feel authentic to this garden center owner/expert speaking about this specific topic
- Write in flowing paragraphs, NEVER bullet points, numbered lists, or dashes
- ABSOLUTELY NEVER use "Green Thumbs", "green thumb", or any variation
- ABSOLUTELY NEVER mention week numbers or start with "Welcome to"
- Present information in natural, conversational paragraph form that clearly delivers value on the "${campaignTitle}" theme`
    };

    const prompt = contentPrompts[postType as keyof typeof contentPrompts] || 
      `Create ${postType} content specifically about "${campaignTitle}" with focus on: ${weekDescription || 'the main theme'}. Start with a powerful hook - NO "Welcome to" language. Make it engaging, professional, and directly focused on the "${campaignTitle}" theme. The content must provide clear value related to this specific theme. Write in flowing paragraphs only - ABSOLUTELY NEVER use bullet points, numbered lists, or dashes. ABSOLUTELY NEVER use "Green Thumbs", "green thumb", or any variation of this phrase. ABSOLUTELY NEVER mention week numbers.`;

    console.log('Generating personalized, region-specific content with theme focus for:', postType);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: `You are a professional content writer specializing in garden center marketing with deep knowledge of regional gardening differences across various climate zones. Create authentic, personalized content that reflects the specific company's brand, expertise, and most importantly their local region and climate conditions. CRITICAL: Every piece of content must be specifically focused on and provide clear value related to the weekly theme "${campaignTitle}" and description "${weekDescription || 'general theme'}". Do not create generic content - it must directly address and support this specific theme. CRITICAL RULES: ABSOLUTELY NEVER use the phrase "Green Thumbs", "green thumb", "Green Thumb", or any variation of this phrase in any content - this is completely forbidden. ABSOLUTELY NEVER use bullet points (•), numbered lists (1., 2., 3.), or dashes (-) to create lists - write only in flowing paragraphs and natural sentences. ABSOLUTELY NEVER start with "Welcome to" or mention week numbers in any form. ALWAYS start content with a powerful, attention-grabbing hook that immediately engages the reader about the specific theme. If you need to present multiple points, weave them naturally into paragraph form.` },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedContent = data.choices[0].message.content;

    console.log('Generated personalized, theme-focused content:', generatedContent);

    return new Response(JSON.stringify({ content: generatedContent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-content function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
