import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildCompanyContext, buildNewsletterPrompt } from '../generate-newsletter/prompt-builder.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaignId, campaignTitle, userId, weekDescription } = await req.json();
    
    console.log('Cohesive newsletter generation request:', { campaignId, campaignTitle, userId });

    if (!userId) {
      throw new Error('User ID is required');
    }

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get company profile for context
    let companyProfile = null;
    const { data: profile, error: profileError } = await supabase
      .from('company_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (!profileError && profile) {
      companyProfile = profile;
      console.log('Retrieved company profile:', companyProfile.company_name);
    }

    // Build company context using existing prompt builder
    const companyContext = buildCompanyContext(companyProfile);

    // Create cohesive newsletter sections outline
    const newsletterOutline = {
      section1: {
        title: "Problem Identification",
        purpose: "Identify the main challenge gardeners face with the campaign theme",
        storybrand_focus: "Character facing problem"
      },
      section2: {
        title: "Solution Guide", 
        purpose: "Position garden center as the empathetic guide with authority",
        storybrand_focus: "Guide with empathy and authority"
      },
      section3: {
        title: "Action Plan",
        purpose: "Provide specific actionable steps in paragraph form",
        storybrand_focus: "Clear plan to solve the problem"
      },
      section4: {
        title: "Success Vision",
        purpose: "Paint vivid picture of garden transformation success",
        storybrand_focus: "Success outcome and call to action"
      }
    };

    // Generate cohesive newsletter content using outline
    const newsletterContent = await generateCohesiveNewsletter(
      openAIApiKey,
      campaignTitle,
      companyContext,
      newsletterOutline,
      weekDescription
    );

    console.log('Cohesive newsletter generated successfully');

    return new Response(JSON.stringify({ 
      content: newsletterContent,
      sections: 4,
      approach: "cohesive_narrative"
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-cohesive-newsletter function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function generateCohesiveNewsletter(
  openAIApiKey: string,
  campaignTitle: string,
  companyContext: string,
  outline: any,
  weekDescription?: string
) {
  console.log('🚀 Generating cohesive newsletter with narrative structure');

  const prompt = `Create a cohesive 4-section newsletter that tells a complete story using the StoryBrand framework.

${companyContext}

CAMPAIGN FOCUS: ${campaignTitle}
${weekDescription ? `ADDITIONAL CONTEXT: ${weekDescription}` : ''}

NARRATIVE STRUCTURE - Create sections that build on each other:

SECTION 1 - PROBLEM IDENTIFICATION (80-100 words):
- Identify the specific challenge gardeners face with "${campaignTitle}"
- Show understanding of their frustration and desires
- Set up the problem that needs solving
- DO NOT provide solutions yet - just establish the challenge

SECTION 2 - SOLUTION GUIDE (80-100 words):
- Position the garden center as the empathetic guide
- Show authority and expertise in solving this specific problem
- Explain why the garden center understands and can help
- Build trust and establish credibility

SECTION 3 - ACTION PLAN (80-100 words):
- Provide 2-3 specific, actionable steps in flowing paragraph form
- Give practical advice gardeners can implement
- Reference specific plants, techniques, or timing
- Build momentum toward taking action

SECTION 4 - SUCCESS VISION (80-100 words):
- Paint a vivid picture of their garden transformation
- Show the beautiful outcome they'll achieve
- Include clear call-to-action to visit garden center
- End with inspiring vision of success

CRITICAL REQUIREMENTS:
1. Each section flows logically into the next
2. Use transitional phrases between sections
3. Focus entirely on "${campaignTitle}" theme
4. Write in flowing paragraphs - no bullets or lists
5. Use exactly two spaces after sentence endings
6. Sound like a complete story from problem to success

Return the complete newsletter with all 4 sections.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAIApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a certified StoryBrand Guide creating cohesive newsletter content. Each section must build on the previous section to create a complete narrative arc. Use exactly two spaces after every sentence ending.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1200,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || 'Newsletter content could not be generated.';
}