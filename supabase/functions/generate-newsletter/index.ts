
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
    const { campaignId, campaignTitle, weekNumber } = await req.json();

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

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

    const prompt = `You are a professional newsletter writer for a garden center. Create an engaging weekly newsletter based on the following content that was created for social media and email this week.

Campaign: ${campaignTitle}
Week: ${weekNumber}

Content created this week:
${contentSummary.map(item => `
${item.type.toUpperCase()}:
Content: ${item.content}
Hashtags: ${item.hashtags}
Image idea: ${item.imageIdea}
`).join('\n')}

Create a comprehensive weekly newsletter that:
1. Has an engaging subject line
2. Includes a warm welcome message
3. Highlights the week's main theme from the content
4. Summarizes key gardening tips and advice from the content
5. Mentions upcoming events or seasonal activities
6. Includes a community spotlight or customer feature
7. Ends with a call-to-action to visit the garden center
8. Maintains a friendly, knowledgeable tone throughout

Format the response as a JSON object with:
- subject: The email subject line
- content: The full newsletter content in HTML format
- summary: A brief plain text summary

The newsletter should be 400-600 words and feel personal and engaging.`;

    console.log('Generating newsletter with prompt:', prompt);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are a professional newsletter writer specializing in garden center communications. Always respond with valid JSON.' },
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
      newsletterData = {
        subject: `Weekly Garden Newsletter - Week ${weekNumber}`,
        content: aiResponse,
        summary: `Newsletter for week ${weekNumber} featuring ${campaignTitle}`
      };
    }

    console.log('Generated newsletter:', newsletterData);

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
