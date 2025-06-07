
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

    // Build company context for AI
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

IMPORTANT: Use this company information to create a personalized video script that sounds authentic to this specific garden center owner or expert.

CONTENT RESTRICTIONS: 
- NEVER use the phrase "Green Thumbs" or "green thumb" in any content
- Avoid cliché gardening phrases and focus on fresh, authentic language
`;
    } else {
      companyContext = `
CONTENT RESTRICTIONS: 
- NEVER use the phrase "Green Thumbs" or "green thumb" in any content
- Avoid cliché gardening phrases and focus on fresh, authentic language
`;
    }

    const prompt = `Create a video script about ${campaignTitle} for a garden center. ${companyContext}

Requirements:
- Write as if the garden center owner/expert is speaking directly to their customers
- Use the company's brand voice and speak to their target audience
- Keep it conversational and natural (60-90 seconds when spoken)
- Include practical tips that align with their specializations and values
- Reference their expertise and unique selling points naturally
- Include a strong opening hook and clear call-to-action
- Make it feel authentic and personal, not generic
- Structure it with clear sections: Hook, Main Content, Call-to-Action
- NEVER use "Green Thumbs" or "green thumb" phrases

Format the response as a natural speaking script, not bullet points.`;

    console.log('Generating personalized video script with OpenAI');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a professional video script writer specializing in garden center content. Create authentic, conversational scripts that sound natural when spoken by the garden center owner or expert. NEVER use the phrase "Green Thumbs" or "green thumb" - avoid this cliché completely.' },
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

    console.log('Generated personalized video script:', videoScript);

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
