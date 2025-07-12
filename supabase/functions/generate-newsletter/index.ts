
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fetchCampaignContent } from './content-processor.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaignId, userId } = await req.json();
    
    console.log('Newsletter generation request:', { campaignId, userId });

    if (!userId) {
      throw new Error('User ID is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch campaign content with improved error handling
    const contentResult = await fetchCampaignContent(supabase, campaignId, userId);
    
    if (contentResult.shouldGenerateContent) {
      console.log('No content found, should generate content first');
      return new Response(JSON.stringify({ 
        error: 'No content available for newsletter generation. Please generate content first.',
        shouldGenerateContent: true
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { tasks, campaign } = contentResult;

    if (!tasks || tasks.length === 0) {
      throw new Error('No content tasks found for newsletter generation');
    }

    // Generate newsletter content
    const newsletterContent = await generateNewsletterFromTasks(tasks, campaign);

    console.log('Newsletter generated successfully');

    return new Response(JSON.stringify({ 
      content: newsletterContent,
      campaign: campaign
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-newsletter function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function generateNewsletterFromTasks(tasks: any[], campaign: any) {
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!openAIApiKey) {
    throw new Error('OpenAI API key not configured');
  }

  // Organize content by type
  const contentByType = tasks.reduce((acc, task) => {
    const type = task.post_type || 'general';
    if (!acc[type]) acc[type] = [];
    acc[type].push(task);
    return acc;
  }, {});

  const campaignTitle = campaign?.title || 'This Week\'s Garden Focus';
  const campaignTheme = campaign?.theme || 'Seasonal Gardening';

  // Create newsletter prompt
  const prompt = `Create a professional garden center newsletter with the following content:

CAMPAIGN: ${campaignTitle}
THEME: ${campaignTheme}

AVAILABLE CONTENT:
${Object.entries(contentByType).map(([type, tasks]: [string, any[]]) => 
  `${type.toUpperCase()}:\n${tasks.map(task => `- ${task.ai_output?.substring(0, 200)}...`).join('\n')}`
).join('\n\n')}

Please create a cohesive newsletter that:
1. Has an engaging subject line
2. Opens with a warm greeting
3. Organizes the content into logical sections
4. Maintains a friendly, expert tone
5. Includes calls-to-action where appropriate
6. Ends with contact information
7. **CRITICAL: Uses exactly two spaces after every sentence ending (period, question mark, exclamation mark) throughout the entire newsletter**

Format as structured content with clear sections.  Ensure proper sentence spacing throughout.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a professional newsletter writer specializing in garden center and nursery content.  Create engaging, informative newsletters that help customers with their gardening needs.  CRITICAL: Always use exactly two spaces after every sentence ending (period, question mark, exclamation mark) before starting the next sentence.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || 'Newsletter content could not be generated.';
}
