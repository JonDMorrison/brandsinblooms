import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { resolveBusinessProfileUserId } from "../_shared/businessProfileUserId.ts";
import {
  authorizeGeneratorRequest,
  readJsonBody,
  type GeneratorAuthDeps,
  type GeneratorProfileClient,
} from "../_shared/generatorAuth.ts";

// Inline interfaces and functions to avoid cross-function imports
interface CompanyProfile {
  company_name?: string;
  company_overview?: string;
  brand_voice?: string;
  tone_of_writing?: string;
  target_audience?: string;
  ideal_customer?: string;
  unique_selling_points?: string;
  company_values?: string;
  seasonal_focus?: string;
  specializations?: string;
  location_info?: string;
}

const buildCompanyContext = (companyProfile: CompanyProfile | null): string => {
  if (companyProfile) {
    return `
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
`;
  } else {
    return '';
  }
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CohesiveNewsletterRequest {
  campaignId?: string;
  campaignTitle: string;
  weekDescription?: string;
}

const defaultDeps: GeneratorAuthDeps = {
  createClient: createClient as GeneratorAuthDeps["createClient"],
  envGet: (key) => Deno.env.get(key),
};

export async function handleGenerateCohesiveNewsletter(
  req: Request,
  deps: GeneratorAuthDeps = defaultDeps,
): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await readJsonBody<CohesiveNewsletterRequest>(req);
    // The caller's JWT and tenant membership are verified before any query.
    // The user is the token's user; a userId in the body is ignored.
    const auth = await authorizeGeneratorRequest(req, body, deps, corsHeaders);
    if (!auth.ok) return auth.response;

    const { campaignId, campaignTitle, weekDescription } = body;
    const userId = auth.userId;
    
    console.log('Cohesive newsletter generation request:', { campaignId, campaignTitle, userId });

    const openAIApiKey = deps.envGet('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // profile_user_id_for is executable by service_role only, so the service
    // key is kept for that one call, after the checks above. The profile
    // itself is read with the caller's JWT (RLS: own or business profile).
    const serviceClient = deps.createClient(
      deps.envGet('SUPABASE_URL')!,
      deps.envGet('SUPABASE_SERVICE_ROLE_KEY')!,
    ) as Parameters<typeof resolveBusinessProfileUserId>[0];
    const userClient = auth.userClient as GeneratorProfileClient;

    // Get company profile for context
    let companyProfile: CompanyProfile | null = null;
    const profileUserId = await resolveBusinessProfileUserId(serviceClient, userId);
    const { data: profile, error: profileError } = await userClient
      .from('company_profiles')
      .select('*')
      .eq('user_id', profileUserId)
      .single();
    
    if (!profileError && profile) {
      companyProfile = profile as CompanyProfile;
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
}

if (import.meta.main) {
  serve((req) => handleGenerateCohesiveNewsletter(req));
}

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