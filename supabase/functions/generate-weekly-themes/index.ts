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
    const { userId, startYear, startFromCurrentWeek = false, weekNumber } = await req.json();
    const year = startYear || new Date().getFullYear();

    console.log(`🎯 Starting theme generation for user: ${userId}, week: ${weekNumber || 'current'}`);

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    // First, try to get theme from master templates
    if (weekNumber) {
      console.log('📚 Checking master templates for week:', weekNumber);
      const { data: masterTemplate, error: templateError } = await supabase
        .from('master_campaign_templates')
        .select('*')
        .eq('week_number', weekNumber)
        .maybeSingle();

      if (!templateError && masterTemplate) {
        console.log('✅ Found master template:', masterTemplate.title);
        
        const themeFromTemplate = {
          week: masterTemplate.week_number,
          title: masterTemplate.title,
          description: `${masterTemplate.seasonal_focus}: ${masterTemplate.content_ideas}`,
          content_ideas: masterTemplate.content_ideas ? masterTemplate.content_ideas.split(',').map(idea => idea.trim()) : []
        };

        return new Response(JSON.stringify({ 
          themes: [themeFromTemplate],
          success: true,
          source: 'master_template',
          message: `Retrieved curated seasonal theme for week ${weekNumber}` 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // If no master template found or OpenAI not available, use fallback themes
    if (!openAIApiKey) {
      console.log('⚠️ OpenAI API key not configured, using enhanced fallbacks');
      
      const month = new Date().getMonth() + 1;
      const currentWeek = weekNumber || Math.ceil(
        ((new Date().getTime() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7
      );
      
      let fallbackTheme;
      
      if (month >= 3 && month <= 5) {
        fallbackTheme = {
          week: currentWeek,
          title: `Spring Garden Renaissance - Week ${currentWeek}`,
          description: 'Celebrate the awakening of spring with fresh plantings, soil preparation, and garden renewal activities that capture the excitement of the growing season.',
          content_ideas: [
            'Spring soil preparation and testing',
            'Early season vegetable planting',
            'Spring cleanup and garden renewal',
            'Container garden design for patios'
          ]
        };
      } else if (month >= 6 && month <= 8) {
        fallbackTheme = {
          week: currentWeek,
          title: `Summer Garden Mastery - Week ${currentWeek}`,
          description: 'Master the art of summer gardening with heat-tolerant plants, water-wise techniques, and harvest celebrations that make the most of peak growing season.',
          content_ideas: [
            'Heat-tolerant plant selections',
            'Water conservation techniques',
            'Summer harvest and preservation',
            'Shade gardening solutions'
          ]
        };
      } else if (month >= 9 && month <= 11) {
        fallbackTheme = {
          week: currentWeek,
          title: `Autumn Garden Harvest - Week ${currentWeek}`,
          description: 'Embrace fall\'s bounty with harvest preservation, autumn color displays, and winter preparation activities that celebrate the season\'s abundance.',
          content_ideas: [
            'Fall harvest and preservation',
            'Autumn color plant displays',
            'Winter garden preparation',
            'Fall planting opportunities'
          ]
        };
      } else {
        fallbackTheme = {
          week: currentWeek,
          title: `Winter Garden Planning - Week ${currentWeek}`,
          description: 'Transform winter into productive planning time with indoor gardening, tool maintenance, and next year\'s garden design and preparation.',
          content_ideas: [
            'Indoor gardening and houseplants',
            'Garden planning and design',
            'Tool maintenance and care',
            'Seed catalog and variety selection'
          ]
        };
      }

      return new Response(JSON.stringify({ 
        themes: [fallbackTheme],
        success: true,
        source: 'enhanced_fallback',
        message: `Generated enhanced seasonal theme for week ${currentWeek}` 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch company profile for personalization
    let companyProfile = null;
    if (userId) {
      console.log('🏢 Fetching company profile...');
      const { data: profileData, error: profileError } = await supabase
        .from('company_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!profileError && profileData) {
        companyProfile = profileData;
        console.log('✅ Company profile loaded:', companyProfile.company_name);
      }
    }

    // Calculate starting week and context
    let startingWeek = 1;
    let seasonalContext = '';
    let requestedWeeks = 52;
    
    if (startFromCurrentWeek || weekNumber) {
      const today = new Date();
      const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
      const pastDaysOfYear = (today.getTime() - firstDayOfYear.getTime()) / 86400000;
      const currentWeek = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
      
      startingWeek = weekNumber || currentWeek;
      requestedWeeks = 1;
      
      const currentMonth = today.toLocaleString('default', { month: 'long' });
      seasonalContext = `\n\nIMPORTANT: Generate a theme specifically for week ${startingWeek} of the year, which is in ${currentMonth}. Make it highly relevant for the current season and time of year, focusing on what garden center customers need right now.`;
    }

    // Build company context for AI
    let companyContext = '';
    if (companyProfile) {
      companyContext = `
COMPANY PROFILE:
Company Name: ${companyProfile.company_name || 'Garden Center'}
Location: ${companyProfile.location_info || 'General climate zone'}
Specializations: ${companyProfile.specializations || 'Full-service garden center'}
Target Audience: ${companyProfile.target_audience || 'Home gardeners and landscapers'}
Unique Selling Points: ${companyProfile.unique_selling_points || 'Expert advice and quality plants'}
Brand Voice: ${companyProfile.brand_voice || 'Knowledgeable and helpful'}
Seasonal Focus: ${companyProfile.seasonal_focus || 'Year-round gardening support'}
`;
    }

    const prompt = `Generate ${requestedWeeks} strategic weekly marketing theme${requestedWeeks > 1 ? 's' : ''} for a garden center's ${year} content calendar. ${companyContext}${seasonalContext}

SEASONAL FRAMEWORK - Incorporate these key elements:

SPRING THEMES (March-May):
- Soil preparation, spring cleanup, early vegetables
- Tree and shrub planting, spring-flowering bulbs in bloom
- Garden planning, seed starting, lawn care revival

SUMMER THEMES (June-August):
- Watering strategies, heat-tolerant plants, summer vegetables
- Outdoor living spaces, container gardens, pest management
- Harvest celebrations, preservation techniques

FALL THEMES (September-November):
- Fall planting season, winter prep, harvest festivals
- Tree care, bulb planting for next year, seasonal decorations
- Thanksgiving arrangements, winter protection strategies

WINTER THEMES (December-February):
- Holiday plants and arrangements, indoor gardening
- Tool maintenance, planning next year's garden
- Winter interest plants, bird feeding, houseplant care

For each week, provide:
1. Week number (${startingWeek}${requestedWeeks > 1 ? ` to ${startingWeek + requestedWeeks - 1}` : ''})
2. Compelling theme title (4-6 words that capture the essence)
3. Strategic description (2-3 sentences explaining customer value and business opportunity)
4. Actionable content ideas (3-4 specific, implementable suggestions)

Format as JSON array:
[
  {
    "week": ${startingWeek},
    "title": "Engaging Seasonal Theme Title",
    "description": "Strategic description focused on current customer needs and business opportunities. Emphasizes seasonal relevance and practical value for garden center customers.",
    "content_ideas": [
      "Specific plant spotlight or seasonal activity",
      "Educational content addressing current garden needs", 
      "Promotional opportunity tied to seasonal demand",
      "Community engagement or workshop idea"
    ]
  }
]

Create themes that drive customer engagement, sales, and position the garden center as the trusted seasonal gardening resource.`;

    console.log(`📝 Generating content with OpenAI for ${requestedWeeks} week(s)...`);

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
            content: 'You are an expert garden center marketing strategist with deep knowledge of seasonal gardening cycles, plant care, and retail horticulture. Create compelling, actionable marketing themes that drive customer engagement and sales while educating gardeners. Always respond with valid JSON only.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      console.error(`❌ OpenAI API error: ${response.status}`);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.choices[0].message.content;
    
    console.log('📄 Raw OpenAI response:', responseText?.substring(0, 200) + '...');
    
    // Parse JSON response with better error handling
    let weeklyThemes;
    try {
      const cleanedResponse = responseText.trim();
      weeklyThemes = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('❌ Failed to parse JSON response:', parseError);
      throw new Error('Invalid JSON response from AI - please try again');
    }

    // Validate the response structure
    if (!Array.isArray(weeklyThemes) || weeklyThemes.length === 0) {
      console.error('❌ Invalid themes structure:', weeklyThemes);
      throw new Error('No valid themes generated');
    }

    console.log(`✅ Successfully generated ${weeklyThemes.length} weekly theme(s)`);

    return new Response(JSON.stringify({ 
      themes: weeklyThemes,
      success: true,
      source: 'ai_generated',
      message: `Generated ${weeklyThemes.length} AI-powered seasonal theme(s)` 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ Error in generate-weekly-themes function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false,
      themes: [] 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
