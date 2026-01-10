import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeocodeResult {
  lat: number;
  lng: number;
  city: string;
  state: string;
  country: string;
  countryCode: string;
  formattedAddress: string;
}

interface ClimateArchetype {
  archetype: string;
  label: string;
  confidence: 'high' | 'medium' | 'low';
}

// US State to climate archetype mapping (deterministic)
const US_STATE_CLIMATE_MAP: Record<string, ClimateArchetype> = {
  // Hot & Dry
  'AZ': { archetype: 'hot_dry', label: 'Hot & Dry Desert Climate', confidence: 'high' },
  'NV': { archetype: 'hot_dry', label: 'Hot & Dry Desert Climate', confidence: 'high' },
  'NM': { archetype: 'hot_dry', label: 'Hot & Dry Desert Climate', confidence: 'medium' },
  'UT': { archetype: 'hot_dry', label: 'Hot & Dry Mountain/Desert Climate', confidence: 'medium' },
  
  // Hot & Humid
  'FL': { archetype: 'hot_humid', label: 'Hot & Humid Subtropical Climate', confidence: 'high' },
  'LA': { archetype: 'hot_humid', label: 'Hot & Humid Subtropical Climate', confidence: 'high' },
  'MS': { archetype: 'hot_humid', label: 'Hot & Humid Subtropical Climate', confidence: 'high' },
  'AL': { archetype: 'hot_humid', label: 'Hot & Humid Subtropical Climate', confidence: 'high' },
  'GA': { archetype: 'hot_humid', label: 'Hot & Humid Subtropical Climate', confidence: 'high' },
  'SC': { archetype: 'hot_humid', label: 'Hot & Humid Subtropical Climate', confidence: 'high' },
  
  // Subtropical (warmer south with occasional frost)
  'TX': { archetype: 'subtropical', label: 'Subtropical Climate', confidence: 'medium' },
  'NC': { archetype: 'subtropical', label: 'Subtropical Climate', confidence: 'medium' },
  'AR': { archetype: 'subtropical', label: 'Subtropical Climate', confidence: 'medium' },
  'TN': { archetype: 'temperate', label: 'Temperate Climate', confidence: 'medium' },
  
  // Cool & Wet (Pacific Northwest)
  'WA': { archetype: 'cool_wet', label: 'Cool & Wet Pacific Maritime Climate', confidence: 'high' },
  'OR': { archetype: 'cool_wet', label: 'Cool & Wet Pacific Maritime Climate', confidence: 'high' },
  
  // Mediterranean
  'CA': { archetype: 'mediterranean', label: 'Mediterranean Climate', confidence: 'medium' },
  
  // Cold
  'MN': { archetype: 'cold', label: 'Cold Continental Climate', confidence: 'high' },
  'WI': { archetype: 'cold', label: 'Cold Continental Climate', confidence: 'high' },
  'MI': { archetype: 'cold', label: 'Cold Continental Climate', confidence: 'high' },
  'ND': { archetype: 'cold', label: 'Cold Continental Climate', confidence: 'high' },
  'SD': { archetype: 'cold', label: 'Cold Continental Climate', confidence: 'high' },
  'MT': { archetype: 'cold', label: 'Cold Continental Climate', confidence: 'high' },
  'WY': { archetype: 'cold', label: 'Cold Mountain Climate', confidence: 'high' },
  'ID': { archetype: 'cold', label: 'Cold Mountain Climate', confidence: 'medium' },
  'ME': { archetype: 'cold', label: 'Cold Continental Climate', confidence: 'high' },
  'VT': { archetype: 'cold', label: 'Cold Continental Climate', confidence: 'high' },
  'NH': { archetype: 'cold', label: 'Cold Continental Climate', confidence: 'high' },
  'AK': { archetype: 'cold', label: 'Cold Subarctic Climate', confidence: 'high' },
  
  // Temperate (default for most states)
  'NY': { archetype: 'temperate', label: 'Temperate Climate', confidence: 'high' },
  'PA': { archetype: 'temperate', label: 'Temperate Climate', confidence: 'high' },
  'OH': { archetype: 'temperate', label: 'Temperate Climate', confidence: 'high' },
  'IN': { archetype: 'temperate', label: 'Temperate Climate', confidence: 'high' },
  'IL': { archetype: 'temperate', label: 'Temperate Climate', confidence: 'high' },
  'IA': { archetype: 'temperate', label: 'Temperate Climate', confidence: 'high' },
  'MO': { archetype: 'temperate', label: 'Temperate Climate', confidence: 'high' },
  'KS': { archetype: 'temperate', label: 'Temperate Climate', confidence: 'medium' },
  'NE': { archetype: 'temperate', label: 'Temperate Climate', confidence: 'medium' },
  'OK': { archetype: 'temperate', label: 'Temperate Climate', confidence: 'medium' },
  'KY': { archetype: 'temperate', label: 'Temperate Climate', confidence: 'high' },
  'WV': { archetype: 'temperate', label: 'Temperate Climate', confidence: 'high' },
  'VA': { archetype: 'temperate', label: 'Temperate Climate', confidence: 'high' },
  'MD': { archetype: 'temperate', label: 'Temperate Climate', confidence: 'high' },
  'DE': { archetype: 'temperate', label: 'Temperate Climate', confidence: 'high' },
  'NJ': { archetype: 'temperate', label: 'Temperate Climate', confidence: 'high' },
  'CT': { archetype: 'temperate', label: 'Temperate Climate', confidence: 'high' },
  'MA': { archetype: 'temperate', label: 'Temperate Climate', confidence: 'high' },
  'RI': { archetype: 'temperate', label: 'Temperate Climate', confidence: 'high' },
  
  // Coastal
  'HI': { archetype: 'hot_humid', label: 'Tropical Island Climate', confidence: 'high' },
  
  // Mountain
  'CO': { archetype: 'mountain', label: 'Mountain/Alpine Climate', confidence: 'high' },
};

// Canadian province mapping
const CA_PROVINCE_CLIMATE_MAP: Record<string, ClimateArchetype> = {
  'BC': { archetype: 'cool_wet', label: 'Cool & Wet Pacific Maritime Climate', confidence: 'high' },
  'AB': { archetype: 'cold', label: 'Cold Continental Climate', confidence: 'high' },
  'SK': { archetype: 'cold', label: 'Cold Continental Climate', confidence: 'high' },
  'MB': { archetype: 'cold', label: 'Cold Continental Climate', confidence: 'high' },
  'ON': { archetype: 'cold', label: 'Cold Continental Climate', confidence: 'medium' },
  'QC': { archetype: 'cold', label: 'Cold Continental Climate', confidence: 'high' },
  'NB': { archetype: 'cold', label: 'Cold Maritime Climate', confidence: 'high' },
  'NS': { archetype: 'cold', label: 'Cold Maritime Climate', confidence: 'high' },
  'PE': { archetype: 'cold', label: 'Cold Maritime Climate', confidence: 'high' },
  'NL': { archetype: 'cold', label: 'Cold Subarctic Climate', confidence: 'high' },
  'YT': { archetype: 'cold', label: 'Cold Subarctic Climate', confidence: 'high' },
  'NT': { archetype: 'cold', label: 'Cold Arctic Climate', confidence: 'high' },
  'NU': { archetype: 'cold', label: 'Cold Arctic Climate', confidence: 'high' },
};

/**
 * Geocode postal code using OpenCage API
 */
async function geocodePostalCode(postalCode: string, countryCode: string): Promise<GeocodeResult | null> {
  const apiKey = Deno.env.get('OPENCAGE_API_KEY');
  if (!apiKey) {
    console.error('OPENCAGE_API_KEY not configured');
    return null;
  }

  try {
    const query = `${postalCode}, ${countryCode}`;
    const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${apiKey}&limit=1&no_annotations=0`;
    
    console.log(`📍 Geocoding: ${query}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Geocoding API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (!data.results || data.results.length === 0) {
      console.warn(`No geocoding results for: ${query}`);
      return null;
    }

    const result = data.results[0];
    const components = result.components;
    
    return {
      lat: result.geometry.lat,
      lng: result.geometry.lng,
      city: components.city || components.town || components.village || components.county || '',
      state: components.state_code || components.state || '',
      country: components.country || '',
      countryCode: components.country_code?.toUpperCase() || countryCode,
      formattedAddress: result.formatted || ''
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

/**
 * Determine climate archetype from location data
 */
function determineClimateArchetype(
  lat: number,
  lng: number,
  stateCode: string,
  countryCode: string
): ClimateArchetype {
  // First, try state/province-based mapping (most accurate for US/Canada)
  if (countryCode === 'US' && stateCode) {
    const stateClimate = US_STATE_CLIMATE_MAP[stateCode.toUpperCase()];
    if (stateClimate) {
      console.log(`✅ Using US state mapping for ${stateCode}: ${stateClimate.archetype}`);
      return stateClimate;
    }
  }
  
  if (countryCode === 'CA' && stateCode) {
    const provinceClimate = CA_PROVINCE_CLIMATE_MAP[stateCode.toUpperCase()];
    if (provinceClimate) {
      console.log(`✅ Using Canadian province mapping for ${stateCode}: ${provinceClimate.archetype}`);
      return provinceClimate;
    }
  }

  // Fallback to latitude-based determination
  console.log(`⚠️ Falling back to latitude-based climate determination for lat=${lat}`);
  
  const absLat = Math.abs(lat);
  
  // Very high latitudes
  if (absLat >= 55) {
    return { archetype: 'cold', label: 'Cold Northern Climate', confidence: 'medium' };
  }
  
  // Northern temperate
  if (absLat >= 45) {
    return { archetype: 'temperate', label: 'Temperate Climate', confidence: 'medium' };
  }
  
  // Mid latitudes - check longitude for east/west coast
  if (absLat >= 35) {
    // West coast of North America
    if (lng < -115 && lng > -130) {
      return { archetype: 'mediterranean', label: 'Mediterranean Climate', confidence: 'low' };
    }
    return { archetype: 'temperate', label: 'Temperate Climate', confidence: 'low' };
  }
  
  // Southern latitudes in US
  if (absLat >= 25) {
    // Southwest desert region
    if (lng < -105 && lng > -120) {
      return { archetype: 'hot_dry', label: 'Hot & Dry Climate', confidence: 'low' };
    }
    // Southeast humid region
    if (lng > -95 && lng < -75) {
      return { archetype: 'hot_humid', label: 'Hot & Humid Climate', confidence: 'low' };
    }
    return { archetype: 'subtropical', label: 'Subtropical Climate', confidence: 'low' };
  }
  
  // Tropical
  return { archetype: 'hot_humid', label: 'Tropical Climate', confidence: 'low' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { postal_code, country_code = 'US', user_id, force_refresh = false, test_mode = false } = await req.json();

    if (!postal_code) {
      return new Response(
        JSON.stringify({ error: 'postal_code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Test mode - derive climate without requiring user_id or persisting
    if (test_mode) {
      console.log(`🧪 TEST MODE: Deriving climate for postal_code=${postal_code}, country=${country_code}`);
      
      const geoResult = await geocodePostalCode(postal_code, country_code);
      if (!geoResult) {
        return new Response(
          JSON.stringify({ error: 'Failed to geocode postal code', postal_code }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const climate = determineClimateArchetype(geoResult.lat, geoResult.lng, geoResult.state, country_code);
      
      return new Response(
        JSON.stringify({
          success: true,
          test_mode: true,
          postal_code,
          country: country_code,
          geocode: {
            city: geoResult.city,
            state: geoResult.state,
            lat: geoResult.lat,
            lng: geoResult.lng,
          },
          climate: {
            archetype: climate.archetype,
            label: climate.label,
            confidence: climate.confidence,
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`🌍 Deriving climate profile for postal_code=${postal_code}, country=${country_code}, user=${user_id}`);

    // Check if we already have a recent climate profile (skip if force_refresh)
    if (!force_refresh) {
      const { data: existingProfile } = await supabase
        .from('company_profiles')
        .select('climate_archetype, climate_last_updated_at, postal_code')
        .eq('user_id', user_id)
        .maybeSingle();

      if (existingProfile?.climate_archetype && 
          existingProfile?.postal_code === postal_code &&
          existingProfile?.climate_last_updated_at) {
        const lastUpdated = new Date(existingProfile.climate_last_updated_at);
        const daysSinceUpdate = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceUpdate < 30) {
          console.log(`ℹ️ Climate profile is recent (${daysSinceUpdate.toFixed(1)} days old), skipping refresh`);
          return new Response(
            JSON.stringify({ 
              success: true, 
              message: 'Climate profile is up to date',
              climate_archetype: existingProfile.climate_archetype,
              skipped: true
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Geocode the postal code
    const geoResult = await geocodePostalCode(postal_code, country_code);
    
    if (!geoResult) {
      console.error(`❌ Failed to geocode postal_code=${postal_code}`);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to geocode postal code',
          postal_code 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📍 Geocoded to: ${geoResult.city}, ${geoResult.state}, ${geoResult.country} (${geoResult.lat}, ${geoResult.lng})`);

    // Determine climate archetype
    const climateResult = determineClimateArchetype(
      geoResult.lat,
      geoResult.lng,
      geoResult.state,
      geoResult.countryCode
    );

    console.log(`🌡️ Climate archetype: ${climateResult.archetype} (${climateResult.label}) [${climateResult.confidence}]`);

    // Update company profile with climate data
    const updateData = {
      latitude: geoResult.lat,
      longitude: geoResult.lng,
      city: geoResult.city,
      state_province: geoResult.state,
      country: geoResult.country,
      climate_archetype: climateResult.archetype,
      climate_label: climateResult.label,
      climate_confidence: climateResult.confidence,
      climate_source: 'opencage_geocoding + state_mapping',
      climate_last_updated_at: new Date().toISOString(),
      // Also update location_info for legacy compatibility
      location_info: `${geoResult.city}, ${geoResult.state}${geoResult.countryCode !== 'US' ? `, ${geoResult.country}` : ''}`
    };

    const { error: updateError } = await supabase
      .from('company_profiles')
      .update(updateData)
      .eq('user_id', user_id);

    if (updateError) {
      console.error(`❌ Failed to update company profile:`, updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update climate profile', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Climate profile saved successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        climate_profile: {
          latitude: geoResult.lat,
          longitude: geoResult.lng,
          city: geoResult.city,
          state_province: geoResult.state,
          country: geoResult.country,
          climate_archetype: climateResult.archetype,
          climate_label: climateResult.label,
          climate_confidence: climateResult.confidence
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in derive-climate-profile:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
