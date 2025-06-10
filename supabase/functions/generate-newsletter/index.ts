
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

ENHANCED WRITING STYLE DIRECTIVES (CRITICAL - APPLY TO ALL CONTENT):
1. ALWAYS START WITH A HOOK: Begin with a powerful opening that sparks curiosity, urgency, or seasonal awareness. Never open with "Welcome to," "This week," or generic greetings. Subject lines and openings should be strong, specific, and emotionally engaging.

2. AGITATE BEFORE YOU EDUCATE: After the hook, highlight common challenges or seasonal mistakes before giving advice. Make the reader feel the problem before introducing solutions.

3. KEEP PARAGRAPHS SHORT: Use paragraphs no longer than 2-3 sentences. Break long ideas into multiple short, readable chunks for mobile-friendliness.

4. MAKE IT VISUALLY SUGGESTIVE: Use words that help readers picture what you're talking about (e.g. "lush beds," "cracked soil," "overflowing baskets"). Avoid dry, abstract phrasing. Create scenes with your words.

5. USE A CONVERSATIONAL TONE: Sound like a local garden center owner writing to familiar customers. Avoid corporate, robotic, or overly polished language. Use friendly contractions, plain language, and warm phrasing.

6. INCLUDE A CLEAR, ALIGNED CTA: End with a single clear call-to-action that ties directly to the newsletter's main topic. Avoid vague CTAs like "Check it out" — use concrete, helpful instructions.

7. ANCHOR TIME WITHOUT WEEK NUMBERS: Avoid using week numbers entirely. Instead, reference seasonal timing in natural, relatable ways like "Now that the evenings are warmer…" or "This is the last cool stretch before summer hits…"

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
ENHANCED WRITING STYLE DIRECTIVES (CRITICAL - APPLY TO ALL CONTENT):
1. ALWAYS START WITH A HOOK: Begin with a powerful opening that sparks curiosity, urgency, or seasonal awareness. Never open with "Welcome to," "This week," or generic greetings. Subject lines and openings should be strong, specific, and emotionally engaging.

2. AGITATE BEFORE YOU EDUCATE: After the hook, highlight common challenges or seasonal mistakes before giving advice. Make the reader feel the problem before introducing solutions.

3. KEEP PARAGRAPHS SHORT: Use paragraphs no longer than 2-3 sentences. Break long ideas into multiple short, readable chunks for mobile-friendliness.

4. MAKE IT VISUALLY SUGGESTIVE: Use words that help readers picture what you're talking about (e.g. "lush beds," "cracked soil," "overflowing baskets"). Avoid dry, abstract phrasing. Create scenes with your words.

5. USE A CONVERSATIONAL TONE: Sound like a local garden center owner writing to familiar customers. Avoid corporate, robotic, or overly polished language. Use friendly contractions, plain language, and warm phrasing.

6. INCLUDE A CLEAR, ALIGNED CTA: End with a single clear call-to-action that ties directly to the newsletter's main topic. Avoid vague CTAs like "Check it out" — use concrete, helpful instructions.

7. ANCHOR TIME WITHOUT WEEK NUMBERS: Avoid using week numbers entirely. Instead, reference seasonal timing in natural, relatable ways like "Now that the evenings are warmer…" or "This is the last cool stretch before summer hits…"

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
1. STARTS WITH A POWERFUL HOOK in both subject line and opening - NO "Welcome to" language or week number mentions
2. AGITATES BEFORE EDUCATING: Highlights common seasonal challenges or mistakes before providing solutions
3. Uses SHORT PARAGRAPHS (2-3 sentences max) throughout for mobile readability
4. Makes content VISUALLY SUGGESTIVE with descriptive language that creates mental pictures
5. Sounds CONVERSATIONAL like a trusted local expert writing to familiar customers
6. Uses the company's specific name and brand voice throughout
7. Reflects their unique selling points and specializations
8. Speaks directly to their target audience and ideal customer
9. Incorporates their company values naturally
10. References their location and seasonal focus with high specificity to their region
11. Maintains their preferred tone of writing
12. Highlights the week's main theme from the content
13. Includes practical gardening tips that are specifically relevant to their geographic location and climate zone
14. Mentions seasonal activities and timing that's accurate for their specific region
15. Addresses local gardening challenges and regional growing conditions
16. References plants, techniques, and timing appropriate for their local hardiness zone
17. Considers local weather patterns, soil conditions, and regional gardening culture
18. Uses natural seasonal timing references instead of week numbers
19. Ends with a personalized, SPECIFIC call-to-action that reflects their local community and provides clear next steps
20. ABSOLUTELY NEVER uses "Green Thumbs", "green thumb", or any variation of this phrase
21. ABSOLUTELY NEVER uses bullet points, numbered lists, or dashes - write in flowing paragraphs only
22. ABSOLUTELY NEVER mentions week numbers in any form
23. ABSOLUTELY NEVER starts with "Welcome to" or similar generic openings
24. ABSOLUTELY NEVER uses emojis anywhere in the content - keep all text completely emoji-free

Format the response as a JSON object with:
- subject: The email subject line (incorporating company name and regional relevance, starting with a hook)
- content: The full newsletter content in HTML format
- summary: A brief plain text summary

The newsletter should be 400-600 words and feel personal, authentic, and highly relevant to this specific garden center and their local region/climate.`;

    console.log('Generating personalized, region-specific newsletter with enhanced writing style');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a professional newsletter writer specializing in garden center communications with extensive knowledge of regional gardening differences across climate zones. Always respond with valid JSON and personalize content based on the company profile and location provided. Create region-specific content that reflects local growing conditions, seasonal timing, weather patterns, and gardening challenges specific to their geographic area. ENHANCED WRITING REQUIREMENTS: Always start with powerful hooks that create curiosity or urgency, never "Welcome to" or generic openings. Agitate before you educate by highlighting common challenges first. Use short paragraphs for mobile readability. Make language visually suggestive. Sound conversational like a local expert. End with clear, specific call-to-actions. Use natural seasonal timing references instead of week numbers. CRITICAL RULES: ABSOLUTELY NEVER use the phrase "Green Thumbs", "green thumb", "Green Thumb", or any variation of this phrase - this is completely forbidden. ABSOLUTELY NEVER use bullet points (•), numbered lists (1., 2., 3.), or dashes (-) to create lists - write only in flowing paragraphs and natural sentences. ABSOLUTELY NEVER mention week numbers in any form in the content. ABSOLUTELY NEVER start with "Welcome to" or similar generic openings. ABSOLUTELY NEVER use emojis anywhere in the content - keep all text completely emoji-free. If you need to present multiple points, weave them naturally into paragraph form.' },
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
        subject: `${companyName}: ${campaignTitle}`,
        content: aiResponse,
        summary: `Enhanced newsletter featuring ${campaignTitle} with improved writing style`
      };
    }

    console.log('Generated enhanced newsletter with improved writing style:', newsletterData);

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
