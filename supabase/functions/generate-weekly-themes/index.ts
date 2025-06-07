
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
    const { userId, startYear } = await req.json();
    const year = startYear || new Date().getFullYear();

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
Specializations: ${companyProfile.specializations || 'General gardening'}
Target Audience: ${companyProfile.target_audience || 'Home gardeners'}
Location: ${companyProfile.location_info || 'General climate'}
Unique Selling Points: ${companyProfile.unique_selling_points || ''}
Brand Voice: ${companyProfile.brand_voice || 'Professional and helpful'}
`;
    }

    const prompt = `Generate 52 unique weekly marketing themes for a garden center's ${year} content calendar. ${companyContext}

Requirements:
- Create themes that follow natural gardening seasons and cycles
- Include seasonal plant care, new arrivals, educational content, and promotional themes
- Vary between practical tips, product spotlights, customer engagement, and seasonal celebrations
- Make each theme specific and actionable for content creation
- Consider major gardening milestones throughout the year
- Include both evergreen content and timely seasonal topics
- Balance educational value with promotional opportunities

For each week, provide:
1. Week number (1-52)
2. Theme title (3-5 words)
3. Brief description (1-2 sentences explaining the week's focus)
4. Key content ideas (2-3 bullet points)

Format as JSON array with this structure:
[
  {
    "week": 1,
    "title": "New Year Garden Planning",
    "description": "Start the year by helping customers plan their dream gardens and set gardening goals.",
    "content_ideas": ["Garden planning worksheets", "2024 garden trends", "Goal-setting tips"]
  }
]

Make it comprehensive, seasonal, and engaging for the full year.`;

    console.log('Generating 52-week themes with OpenAI');

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
            content: 'You are a professional marketing strategist specializing in garden center content planning. Create comprehensive, seasonal marketing themes that align with natural gardening cycles and business objectives. Always respond with valid JSON.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.choices[0].message.content;
    
    // Parse JSON response
    let weeklyThemes;
    try {
      weeklyThemes = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse JSON response:', responseText);
      throw new Error('Invalid JSON response from AI');
    }

    console.log('Generated weekly themes:', weeklyThemes.length);

    return new Response(JSON.stringify({ themes: weeklyThemes }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in generate-weekly-themes function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
