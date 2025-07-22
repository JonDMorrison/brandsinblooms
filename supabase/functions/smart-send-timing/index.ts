import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openAIApiKey = Deno.env.get('OPENAI_API_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PersonaTimingMap {
  [key: string]: {
    preferredDay: string;
    preferredTime: string;
    timezone: string;
    priority: number;
  };
}

interface SmartTiming {
  sendAt: string;
  reasoning: string;
  confidence: number;
  persona: string;
  timezone: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { campaignId, personaTags = [], audienceData = {} } = await req.json();

    console.log('🕐 Calculating smart send time for campaign:', campaignId);

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('crm_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      throw new Error(`Campaign not found: ${campaignError?.message}`);
    }

    // Get user's timezone and preferences
    const { data: userProfile, error: profileError } = await supabase
      .from('company_profiles')
      .select('feature_flags')
      .eq('user_id', campaign.user_id)
      .single();

    const userTimezone = userProfile?.feature_flags?.default_timezone || 'America/Los_Angeles';

    // Smart timing calculation
    const smartTiming = await calculateSmartSendTime(
      personaTags,
      audienceData,
      userTimezone,
      campaign
    );

    // Suggest audience segments based on theme and personas
    const audienceSuggestions = await generateAudienceSuggestions(
      campaign,
      personaTags
    );

    console.log('✅ Smart timing calculated:', {
      sendAt: smartTiming.sendAt,
      reasoning: smartTiming.reasoning,
      audienceSuggestionsCount: audienceSuggestions.length
    });

    return new Response(JSON.stringify({
      success: true,
      smartTiming,
      audienceSuggestions,
      campaignId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in smart-send-timing function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

async function calculateSmartSendTime(
  personaTags: string[],
  audienceData: any,
  userTimezone: string,
  campaign: any
): Promise<SmartTiming> {
  
  // Persona-based timing preferences
  const personaTimingMap: PersonaTimingMap = {
    'New Gardener': {
      preferredDay: 'Sunday',
      preferredTime: '08:00',
      timezone: userTimezone,
      priority: 8
    },
    'Master Gardener': {
      preferredDay: 'Tuesday',
      preferredTime: '06:00',
      timezone: userTimezone,
      priority: 9
    },
    'Houseplant Lover': {
      preferredDay: 'Sunday',
      preferredTime: '08:00',
      timezone: userTimezone,
      priority: 7
    },
    'Flower Enthusiast': {
      preferredDay: 'Wednesday',
      preferredTime: '07:30',
      timezone: userTimezone,
      priority: 8
    },
    'Vegetable Grower': {
      preferredDay: 'Tuesday',
      preferredTime: '06:30',
      timezone: userTimezone,
      priority: 8
    },
    'Seasonal Decorator': {
      preferredDay: 'Friday',
      preferredTime: '15:00',
      timezone: userTimezone,
      priority: 7
    },
    'Bargain Hunter': {
      preferredDay: 'Thursday',
      preferredTime: '09:00',
      timezone: userTimezone,
      priority: 9
    },
    'Weekend Warrior': {
      preferredDay: 'Friday',
      preferredTime: '15:00',
      timezone: userTimezone,
      priority: 8
    }
  };

  // Find the highest priority persona timing
  let bestTiming = {
    preferredDay: 'Tuesday',
    preferredTime: '07:00',
    timezone: userTimezone,
    priority: 5
  };
  
  let matchedPersona = 'General';

  for (const persona of personaTags) {
    if (personaTimingMap[persona] && personaTimingMap[persona].priority > bestTiming.priority) {
      bestTiming = personaTimingMap[persona];
      matchedPersona = persona;
    }
  }

  // Calculate next occurrence of the preferred day/time
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const preferredDayIndex = dayNames.indexOf(bestTiming.preferredDay);
  
  let daysUntilPreferred = preferredDayIndex - currentDay;
  if (daysUntilPreferred <= 0) {
    daysUntilPreferred += 7; // Next week
  }

  const sendDate = new Date(now);
  sendDate.setDate(sendDate.getDate() + daysUntilPreferred);
  
  const [hours, minutes] = bestTiming.preferredTime.split(':').map(Number);
  sendDate.setHours(hours, minutes, 0, 0);

  const reasoning = `Optimized for ${matchedPersona} personas who typically engage best on ${bestTiming.preferredDay}s at ${bestTiming.preferredTime}`;

  return {
    sendAt: sendDate.toISOString(),
    reasoning,
    confidence: bestTiming.priority / 10,
    persona: matchedPersona,
    timezone: bestTiming.timezone
  };
}

async function generateAudienceSuggestions(campaign: any, personaTags: string[]) {
  try {
    // Get existing segments for this tenant
    const { data: segments, error } = await supabase
      .from('crm_segments')
      .select('*')
      .eq('tenant_id', campaign.tenant_id)
      .limit(10);

    if (error) {
      console.warn('Could not fetch segments:', error);
      return [];
    }

    // Extract theme keywords from campaign
    const themeKeywords = extractThemeKeywords(campaign);
    
    // Score segments based on relevance
    const scoredSegments = segments?.map(segment => {
      let score = 0;
      let reasons: string[] = [];

      // Check if segment name/description matches theme keywords
      const segmentText = `${segment.name} ${segment.description || ''}`.toLowerCase();
      
      themeKeywords.forEach(keyword => {
        if (segmentText.includes(keyword.toLowerCase())) {
          score += 3;
          reasons.push(`Matches "${keyword}"`);
        }
      });

      // Check persona alignment
      personaTags.forEach(persona => {
        if (segmentText.includes(persona.toLowerCase().replace(' ', ''))) {
          score += 2;
          reasons.push(`Aligns with ${persona} persona`);
        }
      });

      return {
        segment,
        score,
        reasons,
        confidence: Math.min(score / 5, 1)
      };
    }).filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    return scoredSegments || [];
  } catch (error) {
    console.error('Error generating audience suggestions:', error);
    return [];
  }
}

function extractThemeKeywords(campaign: any): string[] {
  const text = `${campaign.name} ${campaign.subject_line} ${campaign.metadata?.theme_title || ''}`;
  
  // Common garden center keywords
  const gardenKeywords = [
    'fall', 'spring', 'summer', 'winter',
    'plant', 'flower', 'bulb', 'tree', 'shrub',
    'houseplant', 'indoor', 'outdoor',
    'vegetable', 'herb', 'fruit',
    'perennial', 'annual',
    'sale', 'discount', 'special',
    'new', 'arrival', 'seasonal'
  ];

  const foundKeywords = gardenKeywords.filter(keyword => 
    text.toLowerCase().includes(keyword)
  );

  return foundKeywords.length > 0 ? foundKeywords : ['general', 'newsletter'];
}

serve(handler);