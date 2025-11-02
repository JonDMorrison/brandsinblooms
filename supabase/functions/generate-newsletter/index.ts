
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

// Cache for company profiles to avoid repeated DB calls
let companyProfileCache = new Map();

async function generateNewsletterFromTasks(tasks: any[], campaign: any) {
  console.log('🚀 OPTIMIZED: Starting newsletter generation with cached profiles');
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

  // Create cohesive newsletter prompt using StoryBrand framework
  const prompt = `Create a professional StoryBrand-driven garden center newsletter using the following narrative structure:

CAMPAIGN: ${campaignTitle}
THEME: ${campaignTheme}

NARRATIVE STRUCTURE - Each section must build on the previous:
1. PROBLEM IDENTIFICATION: Open with the main gardening challenge gardeners face with "${campaignTitle}"
2. SOLUTION INTRODUCTION: Position the garden center as the guide with expertise 
3. ACTION PLAN: Provide specific, actionable steps gardeners can take
4. SUCCESS VISION: Paint a vivid picture of their garden transformation

AVAILABLE CONTENT TO WEAVE INTO NARRATIVE:
${Object.entries(contentByType).map(([type, tasks]: [string, any[]]) => 
  `${type.toUpperCase()} INSIGHTS:\n${tasks.map(task => `- ${task.ai_output?.substring(0, 200)}...`).join('\n')}`
).join('\n\n')}

CRITICAL REQUIREMENTS:
1. Create sections that flow logically and build on each other
2. Each section should advance the gardener's journey from challenge to success
3. Use transitional phrases between sections for narrative cohesion
4. Focus entirely on "${campaignTitle}" - no generic seasonal advice
5. **CRITICAL: Uses exactly two spaces after every sentence ending (period, question mark, exclamation mark) throughout the entire newsletter**
6. Write in flowing paragraphs only - no bullet points or numbered lists
7. Position customer as hero, garden center as guide

Format as a cohesive narrative newsletter with clear section transitions.  Ensure proper sentence spacing throughout.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // OPTIMIZED: Use faster, cheaper model
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
        max_tokens: 1500, // OPTIMIZED: Reduced token usage
        temperature: 0.7,
      }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || 'Newsletter content could not be generated.';
}
