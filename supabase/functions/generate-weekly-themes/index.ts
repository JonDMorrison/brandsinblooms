
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
    const { userId, startYear, startFromCurrentWeek = false } = await req.json();
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

    // Calculate starting week if needed
    let startingWeek = 1;
    let seasonalContext = '';
    
    if (startFromCurrentWeek) {
      const today = new Date();
      const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
      const pastDaysOfYear = (today.getTime() - firstDayOfYear.getTime()) / 86400000;
      startingWeek = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
      
      const currentMonth = today.toLocaleString('default', { month: 'long' });
      seasonalContext = `\n\nIMPORTANT: Start the themes from the current week ${startingWeek} of the year, which is in ${currentMonth}. The first theme should be relevant for the current season and time of year, not January themes.`;
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

    const prompt = `Generate 52 unique weekly marketing themes for a garden center's ${year} content calendar. ${companyContext}${seasonalContext}

IMPORTANT: Incorporate these seasonal events, holidays, and horticultural celebrations:

FLOWER & PLANT MONTHS:
- January: Houseplant Month, Poinsettia Month
- February: Amaryllis Month, Houseplant Month continues
- March: Daffodil Month, Orchid Month
- April: Garden Month, Sweet Pea Month, Tulip Month
- May: Rose Month begins, Lilac Month, National Garden Month
- June: Rose Month (peak), Peony Month, Lily Month
- July: Dahlia Month, Sunflower Month, Delphinium Month
- August: Gladiolus Month, Poppy Month
- September: Aster Month, Chrysanthemum Month begins
- October: Chrysanthemum Month (peak), Pumpkin Season
- November: Poinsettia prep, Holly Month
- December: Poinsettia Month, Evergreen Month, Holiday Wreaths

MAJOR HOLIDAYS & GARDEN-RELATED EVENTS:
- Valentine's Day (Feb 14) - romantic plants, red flowers
- St. Patrick's Day (Mar 17) - green plants, shamrocks
- Easter (varies) - Easter lilies, spring bulbs, pastel themes
- Mother's Day (May, 2nd Sunday) - hanging baskets, potted plants
- Memorial Day (May, last Monday) - red, white, blue plantings
- Father's Day (June, 3rd Sunday) - tools, outdoor projects
- Independence Day (July 4) - patriotic plantings
- Labor Day (September) - end of summer care
- Halloween (Oct 31) - pumpkins, fall decorations, orange/black plants
- Thanksgiving (November) - autumn harvest, gratitude themes
- Christmas (Dec 25) - evergreens, poinsettias, holiday arrangements

HORTICULTURAL OBSERVANCES:
- National Seed Swap Day (Jan 25)
- National Garden Week (first week of June)
- National Pollinator Week (3rd week of June)
- National Garden Month (April)
- National Herb Week (3rd week of May)
- National Tree Week (1st week of May)
- Arbor Day (varies by state, typically April)
- Earth Day (April 22)
- World Soil Day (Dec 5)

Requirements:
- Create themes that incorporate these holidays and observances naturally
- Follow natural gardening seasons and growth cycles
- Include seasonal plant care, new arrivals, educational content, and promotional themes
- Vary between practical tips, product spotlights, customer engagement, and seasonal celebrations
- Make each theme specific and actionable for content creation
- Reference flower months and holidays where relevant
- Consider major gardening milestones throughout the year
- Include both evergreen content and timely seasonal topics
- Balance educational value with promotional opportunities
- Align themes with holiday shopping patterns and gift-giving occasions

For each week, provide:
1. Week number (${startingWeek} to ${startingWeek + 51}, wrapping around to 1-52 as needed)
2. Theme title (3-5 words, incorporating relevant holidays/flower months when applicable)
3. Brief description (1-2 sentences explaining the week's focus)
4. Key content ideas (2-3 bullet points)

Format as JSON array with this structure:
[
  {
    "week": ${startingWeek},
    "title": "Current Season Appropriate Title",
    "description": "Description relevant to the current time of year and season.",
    "content_ideas": ["Seasonally appropriate content", "Current month activities", "Timely gardening tips"]
  }
]

Make it comprehensive, seasonal, and engaging for the full year while incorporating all relevant horticultural holidays and observances. Start with themes appropriate for the current season.`;

    console.log('Generating 52-week themes with holidays and horticultural events, starting from week:', startingWeek);

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
            content: 'You are a professional marketing strategist specializing in garden center content planning with deep knowledge of horticultural holidays, flower months, and seasonal observances. Create comprehensive, seasonal marketing themes that align with natural gardening cycles, holidays, and special horticultural events. Always respond with valid JSON.' 
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

    console.log('Generated weekly themes with holidays and events:', weeklyThemes.length);

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
