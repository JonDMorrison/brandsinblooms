import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GeocodeResponse {
  results: {
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
    address_components: {
      long_name: string;
      short_name: string;
      types: string[];
    }[];
  }[];
}

interface USDAZoneData {
  zone: string;
  min_temp: number;
  max_temp: number;
}

// USDA Hardiness Zone mapping based on average annual minimum temperatures
const USDA_ZONES: Record<string, USDAZoneData> = {
  '3a': { zone: '3a', min_temp: -40, max_temp: -35 },
  '3b': { zone: '3b', min_temp: -35, max_temp: -30 },
  '4a': { zone: '4a', min_temp: -30, max_temp: -25 },
  '4b': { zone: '4b', min_temp: -25, max_temp: -20 },
  '5a': { zone: '5a', min_temp: -20, max_temp: -15 },
  '5b': { zone: '5b', min_temp: -15, max_temp: -10 },
  '6a': { zone: '6a', min_temp: -10, max_temp: -5 },
  '6b': { zone: '6b', min_temp: -5, max_temp: 0 },
  '7a': { zone: '7a', min_temp: 0, max_temp: 5 },
  '7b': { zone: '7b', min_temp: 5, max_temp: 10 },
  '8a': { zone: '8a', min_temp: 10, max_temp: 15 },
  '8b': { zone: '8b', min_temp: 15, max_temp: 20 },
  '9a': { zone: '9a', min_temp: 20, max_temp: 25 },
  '9b': { zone: '9b', min_temp: 25, max_temp: 30 },
  '10a': { zone: '10a', min_temp: 30, max_temp: 35 },
  '10b': { zone: '10b', min_temp: 35, max_temp: 40 },
  '11': { zone: '11', min_temp: 40, max_temp: 50 },
};

// Climate zone mapping based on latitude
function getClimateZone(lat: number): string {
  const absLat = Math.abs(lat);
  
  if (absLat >= 66.5) return 'polar';
  if (absLat >= 60) return 'subpolar';
  if (absLat >= 45) return 'temperate_cold';
  if (absLat >= 30) return 'temperate_warm';
  if (absLat >= 23.5) return 'subtropical';
  return 'tropical';
}

// Simple USDA zone estimation based on latitude for US locations
function estimateUSDAZone(lat: number): string {
  // Simplified zone estimation - in reality this would use more complex data
  if (lat >= 48) return '3a';
  if (lat >= 46) return '4a';
  if (lat >= 44) return '5a';
  if (lat >= 42) return '6a';
  if (lat >= 40) return '6b';
  if (lat >= 38) return '7a';
  if (lat >= 36) return '7b';
  if (lat >= 34) return '8a';
  if (lat >= 32) return '8b';
  if (lat >= 30) return '9a';
  if (lat >= 28) return '9b';
  if (lat >= 26) return '10a';
  return '10b';
}

async function geocodePostalCode(postalCode: string, countryCode: string = 'US'): Promise<{
  lat: number;
  lon: number;
  city: string;
  state: string;
  country: string;
} | null> {
  try {
    // In production, you would use Google Geocoding API or similar
    // For now, we'll use a simplified mock response
    console.log(`Geocoding postal code: ${postalCode} in ${countryCode}`);
    
    // Mock geocoding - replace with actual API call
    const mockData = {
      lat: 40.7128 + (Math.random() - 0.5) * 10, // Mock latitude around NYC
      lon: -74.0060 + (Math.random() - 0.5) * 10, // Mock longitude around NYC
      city: 'Sample City',
      state: countryCode === 'US' ? 'NY' : 'Sample State',
      country: countryCode
    };
    
    return mockData;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (req.method === 'POST') {
      // Manual enrichment for specific customer
      const { customer_id, postal_code, country_code = 'US' } = await req.json();
      
      if (!customer_id || !postal_code) {
        return new Response(
          JSON.stringify({ error: 'customer_id and postal_code are required' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const geoData = await geocodePostalCode(postal_code, country_code);
      
      if (!geoData) {
        return new Response(
          JSON.stringify({ error: 'Failed to geocode postal code' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Round coordinates to 3 decimal places for privacy
      const roundedLat = Math.round(geoData.lat * 1000) / 1000;
      const roundedLon = Math.round(geoData.lon * 1000) / 1000;

      const usda_zone = country_code === 'US' ? estimateUSDAZone(roundedLat) : null;
      const climate_zone = getClimateZone(roundedLat);

      const { error: updateError } = await supabase
        .from('crm_customers')
        .update({
          postal_code,
          country_code,
          city: geoData.city,
          state_region: geoData.state,
          lat: roundedLat,
          lon: roundedLon,
          usda_zone,
          climate_zone,
          updated_at: new Date().toISOString()
        })
        .eq('id', customer_id);

      if (updateError) {
        console.error('Database update error:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update customer data' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          enriched_data: {
            lat: roundedLat,
            lon: roundedLon,
            city: geoData.city,
            state_region: geoData.state,
            country_code,
            usda_zone,
            climate_zone
          }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Batch enrichment for customers without geo data
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const limit = parseInt(url.searchParams.get('limit') || '50');
      
      // Get customers with postal codes but no geo data
      const { data: customers, error: fetchError } = await supabase
        .from('crm_customers')
        .select('id, postal_code, country_code')
        .not('postal_code', 'is', null)
        .is('lat', null)
        .limit(limit);

      if (fetchError) {
        console.error('Failed to fetch customers:', fetchError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch customers' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      let enriched = 0;
      let failed = 0;

      for (const customer of customers || []) {
        const geoData = await geocodePostalCode(
          customer.postal_code, 
          customer.country_code || 'US'
        );
        
        if (geoData) {
          const roundedLat = Math.round(geoData.lat * 1000) / 1000;
          const roundedLon = Math.round(geoData.lon * 1000) / 1000;
          const usda_zone = (customer.country_code || 'US') === 'US' ? estimateUSDAZone(roundedLat) : null;
          const climate_zone = getClimateZone(roundedLat);

          const { error: updateError } = await supabase
            .from('crm_customers')
            .update({
              country_code: customer.country_code || 'US',
              city: geoData.city,
              state_region: geoData.state,
              lat: roundedLat,
              lon: roundedLon,
              usda_zone,
              climate_zone,
              updated_at: new Date().toISOString()
            })
            .eq('id', customer.id);

          if (updateError) {
            console.error(`Failed to update customer ${customer.id}:`, updateError);
            failed++;
          } else {
            enriched++;
          }
        } else {
          failed++;
        }

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          processed: customers?.length || 0,
          enriched,
          failed
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});