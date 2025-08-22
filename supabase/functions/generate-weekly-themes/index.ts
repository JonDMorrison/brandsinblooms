
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ISO week calculation - consistent with dateUtils.ts
const getISOWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

const getCurrentWeekNumber = (): number => {
  const today = new Date();
  return getISOWeekNumber(today);
};

const getSeasonalGardenTheme = (weekNumber: number) => {
  // Updated seasonal mapping based on ISO week numbers
  // Spring: Weeks 10-22 (March-May)
  // Summer: Weeks 23-35 (June-August) 
  // Fall: Weeks 36-48 (September-November)
  // Winter: Weeks 49-52, 1-9 (December-February)
  
  let season, weekInSeason;
  
  console.log(`🗓️ Processing week ${weekNumber} for seasonal theme`);
  
  if (weekNumber >= 10 && weekNumber <= 22) {
    // Spring: Weeks 10-22 (March-May)
    season = "Spring";
    weekInSeason = weekNumber - 9;
  } else if (weekNumber >= 23 && weekNumber <= 35) {
    // Summer: Weeks 23-35 (June-August)
    season = "Summer";
    weekInSeason = weekNumber - 22;
  } else if (weekNumber >= 36 && weekNumber <= 48) {
    // Fall: Weeks 36-48 (September-November)
    season = "Fall";
    weekInSeason = weekNumber - 35;
  } else {
    // Winter: Weeks 49-52, 1-9 (December-February)
    season = "Winter";
    weekInSeason = weekNumber >= 49 ? weekNumber - 48 : weekNumber + 5;
  }
  
  console.log(`🌱 Week ${weekNumber} maps to ${season}, week ${weekInSeason} of season`);
  
  const seasons = {
    "Spring": {
      name: "Spring",
      themes: [
        {
          title: "Early Spring Garden Awakening",
          description: "Celebrate spring's return with soil preparation, early plantings, and garden renewal. Help customers transition from winter dormancy to active growing season with expert plant care advice.",
          content_ideas: ["Spring soil testing and preparation techniques", "Early season vegetable and herb planting guide", "Spring cleanup and garden renewal projects", "Container garden design for spring displays"]
        },
        {
          title: "Mid-Spring Planting Excellence",
          description: "Master the critical spring planting decisions and soil preparation that create the foundation for a spectacular growing season.",
          content_ideas: ["Timing guide for spring vegetable planting", "Soil amendment and preparation strategies", "Seed starting techniques and equipment", "Frost protection and season extension methods"]
        },
        {
          title: "Late Spring Flower Power",
          description: "Showcase the beauty and variety of spring blooms with expert guidance on selection, planting, and care for seasonal color.",
          content_ideas: ["Spring bulb and annual selection guide", "Color combination design tips", "Spring flower care and maintenance", "Early season pest prevention"]
        },
        {
          title: "Spring Garden Establishment",
          description: "Focus on establishing strong foundations for summer success with proper planting techniques and early season care strategies.",
          content_ideas: ["Transplanting seedlings and young plants", "Mulching strategies for spring plantings", "Early irrigation setup", "Companion planting for pest control"]
        }
      ]
    },
    "Summer": {
      name: "Summer",
      themes: [
        {
          title: "Early Summer Garden Launch",
          description: "Launch your summer garden with heat-loving plants, efficient watering systems, and strategies for establishing thriving gardens as temperatures rise.",
          content_ideas: ["Heat-tolerant plant selections and varieties", "Summer planting timing and techniques", "Irrigation system setup and optimization", "Early summer pest prevention strategies"]
        },
        {
          title: "Mid-Summer Growing Success",
          description: "Master mid-summer gardening with water-wise techniques, continuous harvests, and maintaining garden productivity during peak heat.",
          content_ideas: ["Water-wise gardening and conservation techniques", "Succession planting for continuous harvests", "Summer pruning and plant maintenance", "Heat stress management for plants"]
        },
        {
          title: "Peak Summer Garden Care",
          description: "Keep gardens thriving through peak heat with expert maintenance, efficient watering, and strategies for summer garden success.",
          content_ideas: ["Efficient watering schedules and techniques", "Summer mulching for moisture retention", "Managing garden pests in hot weather", "Summer flower arrangements and displays"]
        },
        {
          title: "Late Summer Harvest & Maintenance",
          description: "Celebrate summer's bounty with harvest tips, preservation techniques, and strategies for maintaining gardens through late summer heat.",
          content_ideas: ["Summer harvest timing and techniques", "Food preservation and storage methods", "Late summer plant care and protection", "Preparing for fall transitions"]
        }
      ]
    },
    "Fall": {
      name: "Fall",
      themes: [
        {
          title: "Early Fall Harvest Festival",
          description: "Embrace fall's transformation with harvest celebrations, autumn preparations, and the beginning of winter planning.",
          content_ideas: ["Early fall harvest and preservation", "Autumn color tree and shrub selections", "Fall garden cleanup beginning", "Late summer to fall transition planning"]
        },
        {
          title: "Mid-Fall Planting & Preparation",
          description: "Guide customers through important fall tasks including planting, cleanup, and winter protection for garden success.",
          content_ideas: ["Fall bulb planting for spring color", "Tree and shrub fall planting guide", "Garden cleanup and winter prep tasks", "Mulching and plant protection techniques"]
        },
        {
          title: "Back-to-School Garden Projects",
          description: "Engage families with educational garden projects and prepare gardens for the transition from active growing to winter rest.",
          content_ideas: ["School garden project ideas", "Teaching kids about fall harvests", "Preparing gardens for winter dormancy", "Fall container garden designs"]
        },
        {
          title: "Late Fall Winter Preparation",
          description: "Prepare gardens for winter with strategic planning, final harvests, and comprehensive winterization strategies.",
          content_ideas: ["Final harvest and garden cleanup", "Winter protection methods", "Tool maintenance and storage", "Planning next year's garden improvements"]
        }
      ]
    },
    "Winter": {
      name: "Winter",
      themes: [
        {
          title: "Early Winter Planning & Indoor Growing",
          description: "Transform early winter into productive planning time with indoor gardening, tool maintenance, and exciting preparation for next season.",
          content_ideas: ["Indoor herb and microgreen growing", "Houseplant care and winter plant health", "Garden planning and design for next year", "Tool maintenance and greenhouse management"]
        },
        {
          title: "Mid-Winter Holiday Plants & Beauty",
          description: "Celebrate winter's unique charm with holiday arrangements, winter interest plants, and festive gardening projects.",
          content_ideas: ["Holiday plant care and arrangements", "Winter interest plants and landscape design", "Seasonal decorations with natural materials", "Bird feeding and winter wildlife support"]
        },
        {
          title: "Late Winter Garden Dreams & Planning",
          description: "Use late winter's quiet time for garden planning, seed ordering, and dreaming of next year's growing season.",
          content_ideas: ["Seed catalog planning and ordering", "Garden design and layout planning", "Winter garden photography and journaling", "Early seed starting preparation"]
        },
        {
          title: "Winter Reflection & Preparation",
          description: "Reflect on the past growing season while preparing for spring with strategic planning and early preparation activities.",
          content_ideas: ["Greenhouse and indoor growing projects", "Pruning workshops and techniques", "Garden journal review and planning", "Equipment maintenance and upgrades"]
        }
      ]
    }
  };
  
  const seasonData = seasons[season];
  const themeIndex = Math.min(Math.floor((weekInSeason - 1) / Math.ceil(13 / seasonData.themes.length)), seasonData.themes.length - 1);
  const theme = seasonData.themes[themeIndex];
  
  return {
    week: weekNumber,
    title: theme.title,
    description: theme.description,
    content_ideas: theme.content_ideas
  };
};

const generateAll52Themes = (startWeek: number = 1) => {
  const themes = [];
  for (let i = 0; i < 52; i++) {
    let weekNumber = startWeek + i;
    if (weekNumber > 52) {
      weekNumber = weekNumber - 52;
    }
    themes.push(getSeasonalGardenTheme(weekNumber));
  }
  return themes;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, generateAll52Weeks = false, weekNumber, startWeek } = await req.json();

    console.log(`🌱 Generating garden center themes for user: ${userId}, generateAll52Weeks: ${generateAll52Weeks}, week: ${weekNumber || 'current'}, startWeek: ${startWeek || 'current'}`);

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

    // Handle bulk generation of all 52 weeks
    if (generateAll52Weeks) {
      const currentWeekForStart = startWeek || getCurrentWeekNumber();
      console.log(`🌿 Generating all 52 seasonal garden center themes starting from week ${currentWeekForStart}`);
      
      const allThemes = generateAll52Themes(currentWeekForStart);
      
      return new Response(JSON.stringify({ 
        themes: allThemes,
        success: true,
        source: 'seasonal_garden_themes_bulk',
        message: `Generated complete 52-week seasonal garden center theme collection starting from week ${currentWeekForStart}` 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Single week generation (existing logic)
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
    
    const currentWeek = weekNumber || getCurrentWeekNumber();
    
    console.log(`🗓️ Current week calculated as: ${currentWeek}`);
    
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
