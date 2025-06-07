
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
    const { postType, campaignTitle, userId } = await req.json();

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
Tone of Writing: ${companyProfile.tone_of_writing || ''}
Target Audience: ${companyProfile.target_audience || ''}
Ideal Customer: ${companyProfile.ideal_customer || ''}
Unique Selling Points: ${companyProfile.unique_selling_points || ''}
Company Values: ${companyProfile.company_values || ''}
Seasonal Focus: ${companyProfile.seasonal_focus || ''}
Specializations: ${companyProfile.specializations || ''}
Location Info: ${companyProfile.location_info || ''}

IMPORTANT: Use this company information to personalize the content. Reference the company name, speak in their brand voice, mention their specializations, and align with their values and target audience.
`;
    }

    const contentPrompts = {
      instagram: `Create an engaging Instagram post about ${campaignTitle}. ${companyContext}

Requirements:
- Write in the company's brand voice and tone
- Keep it engaging and visual-friendly (under 150 words)
- Include relevant emojis
- Reference the company's specializations when relevant
- Speak to their target audience
- Include a call-to-action
- Make it feel authentic to this specific garden center`,

      facebook: `Create a Facebook post about ${campaignTitle}. ${companyContext}

Requirements:
- Write in the company's brand voice and tone
- Be conversational and community-focused (150-250 words)
- Reference the company's unique selling points
- Speak to their ideal customer
- Include questions to encourage engagement
- Make it feel personal and authentic to this garden center`,

      email: `Create email content about ${campaignTitle}. ${companyContext}

Requirements:
- Write in the company's tone of writing
- Be informative and valuable (100-200 words)
- Reference the company's seasonal focus when relevant
- Include their specializations
- Speak to their target audience
- Include a clear call-to-action
- Make it feel personal from this specific garden center`,

      video: `Create a video script about ${campaignTitle}. ${companyContext}

Requirements:
- Write in the company's brand voice
- Keep it conversational and natural (60-90 seconds when spoken)
- Reference the company's expertise and specializations
- Include practical tips that align with their values
- Speak directly to their ideal customer
- Include a strong opening hook and clear call-to-action
- Make it feel authentic to this garden center owner/expert`
    };

    const prompt = contentPrompts[postType as keyof typeof contentPrompts] || 
      `Create ${postType} content about ${campaignTitle} for a garden center. Make it engaging and professional.`;

    console.log('Generating personalized content with OpenAI for:', postType);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a professional content writer specializing in garden center marketing. Create authentic, personalized content that reflects the specific company\'s brand and expertise.' },
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

    console.log('Generated personalized content:', generatedContent);

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
