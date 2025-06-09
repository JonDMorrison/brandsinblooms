
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Build company context for AI
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

IMPORTANT: Use this company information to personalize the newsletter. Reference the company name, speak in their brand voice, mention their specializations, and align with their values and target audience.

CONTENT RESTRICTIONS: 
- NEVER use the phrase "Green Thumbs" or "green thumb" in any content
- NEVER use bullet points (•) or numbered lists in the content
- NEVER mention week numbers in the content (e.g., "Happy Week 23", "This is week 15", etc.)
- Write in flowing paragraphs and natural sentences only
- Avoid cliché gardening phrases and focus on fresh, authentic language
`;
    } else {
      companyContext = `
CONTENT RESTRICTIONS: 
- NEVER use the phrase "Green Thumbs" or "green thumb" in any content
- NEVER use bullet points (•) or numbered lists in the content
- NEVER mention week numbers in the content (e.g., "Happy Week 23", "This is week 15", etc.)
- Write in flowing paragraphs and natural sentences only
- Avoid cliché gardening phrases and focus on fresh, authentic language
`;
    }

    const prompt = `You are a professional newsletter writer for a garden center. Create an engaging weekly newsletter that reflects the specific company's brand and personality.

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
1. Uses the company's specific name and brand voice throughout
2. Reflects their unique selling points and specializations
3. Speaks directly to their target audience and ideal customer
4. Incorporates their company values naturally
5. References their location and seasonal focus when relevant
6. Maintains their preferred tone of writing
7. Highlights the week's main theme from the content
8. Includes practical gardening tips aligned with their expertise
9. Mentions seasonal activities relevant to their focus areas
10. Ends with a personalized call-to-action
11. NEVER uses "Green Thumbs" or "green thumb" phrases
12. NEVER uses bullet points or numbered lists - write in flowing paragraphs only
13. NEVER mentions week numbers in any form

Format the response as a JSON object with:
- subject: The email subject line (incorporating company name)
- content: The full newsletter content in HTML format
- summary: A brief plain text summary

The newsletter should be 400-600 words and feel personal and authentic to this specific garden center.`;

    console.log('Generating personalized newsletter with prompt:', prompt);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a professional newsletter writer specializing in garden center communications. Always respond with valid JSON and personalize content based on the company profile provided. NEVER use the phrase "Green Thumbs" or "green thumb" - avoid this cliché completely. NEVER use bullet points (•) or numbered lists - write only in flowing paragraphs and natural sentences. NEVER mention week numbers in any form in the content.' },
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

    console.log('Generated personalized newsletter:', newsletterData);

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
