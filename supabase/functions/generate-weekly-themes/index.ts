
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

const getSeasonalGardenTheme = (weekNumber: number) => {
  const month = new Date().getMonth() + 1;
  
  if (month >= 3 && month <= 5) {
    // Spring garden center themes
    const springThemes = [
      {
        week: weekNumber,
        title: "Spring Garden Awakening",
        description: "Celebrate spring's return with soil preparation, early plantings, and garden renewal. Help customers transition from winter dormancy to active growing season with expert plant care advice.",
        content_ideas: [
          "Spring soil testing and preparation techniques",
          "Early season vegetable and herb planting guide", 
          "Spring cleanup and garden renewal projects",
          "Container garden design for spring displays"
        ]
      },
      {
        week: weekNumber,
        title: "Early Season Planting Excellence",
        description: "Master the critical early planting decisions and soil preparation that create the foundation for a spectacular growing season.",
        content_ideas: [
          "Timing guide for spring vegetable planting",
          "Soil amendment and preparation strategies",
          "Seed starting techniques and equipment",
          "Frost protection and season extension methods"
        ]
      }
    ];
    return springThemes[weekNumber % springThemes.length];
  } else if (month >= 6 && month <= 8) {
    // Summer garden center themes
    const summerThemes = [
      {
        week: weekNumber,
        title: "Summer Heat Solutions & Plant Care",
        description: "Master summer gardening with heat-tolerant plants, efficient watering systems, and strategies for thriving gardens in hot weather.",
        content_ideas: [
          "Heat-tolerant plant selections and varieties",
          "Water-wise gardening and irrigation techniques",
          "Summer pest and disease management",
          "Shade gardening solutions for hot climates"
        ]
      },
      {
        week: weekNumber,
        title: "Peak Season Harvest & Abundance",
        description: "Celebrate summer's bounty with harvest tips, preservation techniques, and maximizing garden productivity during peak growing season.",
        content_ideas: [
          "Summer harvest timing and techniques",
          "Food preservation and storage methods",
          "Succession planting for continuous harvests",
          "Summer flower arrangements and displays"
        ]
      }
    ];
    return summerThemes[weekNumber % summerThemes.length];
  } else if (month >= 9 && month <= 11) {
    // Fall garden center themes
    const fallThemes = [
      {
        week: weekNumber,
        title: "Autumn Garden Harvest Festival",
        description: "Embrace fall's spectacular transformation with harvest celebrations, autumn color displays, and preparation for winter dormancy.",
        content_ideas: [
          "Fall harvest festivals and preservation",
          "Autumn color tree and shrub selections",
          "Fall planting opportunities and timing",
          "Winter garden protection strategies"
        ]
      },
      {
        week: weekNumber,
        title: "Fall Planting & Winter Preparation",
        description: "Guide customers through important fall tasks including planting, cleanup, and winter protection for garden success.",
        content_ideas: [
          "Fall bulb planting for spring color",
          "Tree and shrub fall planting guide",
          "Garden cleanup and winter prep tasks",
          "Mulching and plant protection techniques"
        ]
      }
    ];
    return fallThemes[weekNumber % fallThemes.length];
  } else {
    // Winter garden center themes
    const winterThemes = [
      {
        week: weekNumber,
        title: "Winter Garden Planning & Indoor Growing",
        description: "Transform winter into productive planning time with indoor gardening, tool maintenance, and exciting preparation for next season.",
        content_ideas: [
          "Indoor herb and microgreen growing",
          "Houseplant care and winter plant health",
          "Garden planning and design for next year",
          "Tool maintenance and greenhouse management"
        ]
      },
      {
        week: weekNumber,
        title: "Holiday Plants & Winter Beauty",
        description: "Celebrate winter's unique charm with holiday arrangements, winter interest plants, and festive gardening projects.",
        content_ideas: [
          "Holiday plant care and arrangements",
          "Winter interest plants and landscape design",
          "Seasonal decorations with natural materials",
          "Bird feeding and winter wildlife support"
        ]
      }
    ];
    return winterThemes[weekNumber % winterThemes.length];
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, startYear, startFromCurrentWeek = false, weekNumber } = await req.json();
    const year = startYear || new Date().getFullYear();

    console.log(`🌱 Generating garden center themes for user: ${userId}, week: ${weekNumber || 'current'}`);

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
        console.log('✅ Found master garden center template:', masterTemplate.title);
        
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
          message: `Retrieved curated seasonal garden center theme for week ${weekNumber}` 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Use enhanced seasonal garden center themes as fallback
    console.log('🌿 Using enhanced seasonal garden center themes');
    
    const currentWeek = weekNumber || Math.ceil(
      ((new Date().getTime() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7
    );
    
    const gardenTheme = getSeasonalGardenTheme(currentWeek);

    return new Response(JSON.stringify({ 
      themes: [gardenTheme],
      success: true,
      source: 'seasonal_garden_themes',
      message: `Generated seasonal garden center theme for week ${currentWeek}` 
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
