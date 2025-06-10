
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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaignId, campaignTitle, weekNumber, userId } = await req.json();

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

    // Fetch all content tasks for this campaign (excluding newsletter)
    const { data: contentTasks, error: tasksError } = await supabase
      .from('content_tasks')
      .select('*')
      .eq('campaign_id', campaignId)
      .neq('post_type', 'newsletter');

    if (tasksError) {
      console.error('Error fetching content tasks:', tasksError);
      throw new Error('Failed to fetch campaign content');
    }

    // Prepare content for AI analysis
    const contentSummary = contentTasks?.map(task => ({
      type: task.post_type,
      content: task.ai_output,
      hashtags: task.hashtags,
      imageIdea: task.image_idea
    })) || [];

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

REGIONAL NEWSLETTER FOCUS:
- Use the Location Info to create content highly specific to their geographic region and climate
- Reference local growing seasons, weather patterns, and gardening calendars specific to their area
- Include region-appropriate plant recommendations and gardening advice
- Consider local hardiness zones, frost dates, and seasonal timing for their specific location
- Address regional gardening challenges (drought, humidity, snow, heat, soil conditions, local pests)
- Reference local gardening culture, preferences, and community events when appropriate
- Use seasonal timing advice that's accurate for their specific climate zone
- Include locally-relevant tips that would resonate with gardeners in their specific region

IMPORTANT: Use this company information to personalize the newsletter with highly location-specific content that reflects their specific geographic region, local climate, and regional gardening conditions.

CRITICAL CONTENT RESTRICTIONS: 
- ABSOLUTELY NEVER use the phrase "Green Thumbs", "green thumb", "Green Thumb", or any variation of this phrase in any content
- ABSOLUTELY NEVER use bullet points (•) or numbered lists (1., 2., 3.) in the content
- ABSOLUTELY NEVER use dashes (-) to create lists
- ABSOLUTELY NEVER mention week numbers in the content (e.g., "Happy Week 23", "This is week 15", etc.)
- ABSOLUTELY NEVER start with "Welcome to" language or similar generic openings
- ABSOLUTELY NEVER use emojis in any content - keep all text completely emoji-free
- ALWAYS start with a powerful, attention-grabbing hook that immediately engages the reader
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
- ABSOLUTELY NEVER mention week numbers in the content (e.g., "Happy Week 23", "This is week 15", etc.)
- ABSOLUTELY NEVER start with "Welcome to" language or similar generic openings
- ABSOLUTELY NEVER use emojis in any content - keep all text completely emoji-free
- ALWAYS start with a powerful, attention-grabbing hook that immediately engages the reader
- Write ONLY in flowing paragraphs and natural sentences
- Avoid ALL cliché gardening phrases and focus on fresh, authentic language
- Since no location is specified, keep advice general but emphasize the importance of local climate considerations
- If you need to present multiple points, weave them into natural paragraph flow
`;
    }

    const prompt = `You are a professional newsletter writer for a garden center with deep expertise in regional gardening differences across various climate zones and geographic areas. Create an engaging weekly newsletter that reflects the specific company's brand, personality, and most importantly their local region and climate conditions.

${companyContext}

Campaign: ${campaignTitle}

Content created this week:
${contentSummary.map(item => `
${item.type.toUpperCase()}:
Content: ${item.content}
Hashtags: ${item.hashtags}
Image idea: ${item.imageIdea}
`).join('\n')}

Create a comprehensive weekly newsletter that:
1. STARTS with a powerful, attention-grabbing hook - NO "Welcome to" language or week number mentions
2. Uses the company's specific name and brand voice throughout
3. Reflects their unique selling points and specializations
4. Speaks directly to their target audience and ideal customer
5. Incorporates their company values naturally
6. References their location and seasonal focus with high specificity to their region
7. Maintains their preferred tone of writing
8. Highlights the week's main theme from the content
9. Includes practical gardening tips that are specifically relevant to their geographic location and climate zone
10. Mentions seasonal activities and timing that's accurate for their specific region
11. Addresses local gardening challenges and regional growing conditions
12. References plants, techniques, and timing appropriate for their local hardiness zone
13. Considers local weather patterns, soil conditions, and regional gardening culture
14. Ends with a personalized call-to-action that reflects their local community
15. ABSOLUTELY NEVER uses "Green Thumbs", "green thumb", or any variation of this phrase
16. ABSOLUTELY NEVER uses bullet points, numbered lists, or dashes - write in flowing paragraphs only
17. ABSOLUTELY NEVER mentions week numbers in any form
18. ABSOLUTELY NEVER starts with "Welcome to" or similar generic openings
19. ABSOLUTELY NEVER uses emojis anywhere in the content - keep all text completely emoji-free

Format the response as a JSON object with:
- subject: The email subject line (incorporating company name and regional relevance)
- content: The full newsletter content in HTML format
- summary: A brief plain text summary

The newsletter should be 400-600 words and feel personal, authentic, and highly relevant to this specific garden center and their local region/climate.`;

    console.log('Generating personalized, region-specific newsletter with prompt:', prompt);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a professional newsletter writer specializing in garden center communications with extensive knowledge of regional gardening differences across climate zones. Always respond with valid JSON and personalize content based on the company profile and location provided. Create region-specific content that reflects local growing conditions, seasonal timing, weather patterns, and gardening challenges specific to their geographic area. CRITICAL RULES: ABSOLUTELY NEVER use the phrase "Green Thumbs", "green thumb", "Green Thumb", or any variation of this phrase - this is completely forbidden. ABSOLUTELY NEVER use bullet points (•), numbered lists (1., 2., 3.), or dashes (-) to create lists - write only in flowing paragraphs and natural sentences. ABSOLUTELY NEVER mention week numbers in any form in the content. ABSOLUTELY NEVER start with "Welcome to" or similar generic openings. ABSOLUTELY NEVER use emojis anywhere in the content - keep all text completely emoji-free. ALWAYS start content with a powerful, attention-grabbing hook that immediately engages the reader. If you need to present multiple points, weave them naturally into paragraph form.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    let newsletterData;
    try {
      newsletterData = JSON.parse(aiResponse);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', aiResponse);
      // Fallback: create newsletter data from raw text
      const companyName = companyProfile?.company_name || 'Garden Center';
      newsletterData = {
        subject: `Weekly Newsletter from ${companyName}`,
        content: aiResponse,
        summary: `Personalized newsletter featuring ${campaignTitle}`
      };
    }

    console.log('Generated personalized, region-specific newsletter:', newsletterData);

    return new Response(JSON.stringify(newsletterData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-newsletter function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
