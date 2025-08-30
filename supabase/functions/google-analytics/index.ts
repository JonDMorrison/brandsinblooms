import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the authorization header to verify the user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Invalid authentication');
    }

    const { propertyId, startDate, endDate, metrics = ['sessions', 'pageviews', 'users'] } = await req.json();

    if (!propertyId) {
      throw new Error('Property ID is required');
    }

    const GOOGLE_ANALYTICS_API_KEY = Deno.env.get('GOOGLE_ANALYTICS_API_KEY');
    if (!GOOGLE_ANALYTICS_API_KEY) {
      throw new Error('Google Analytics API key not configured');
    }

    // Calculate date range (default to last 30 days)
    const endDateStr = endDate || new Date().toISOString().split('T')[0];
    const startDateStr = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    console.log(`Fetching GA data for property ${propertyId} from ${startDateStr} to ${endDateStr}`);

    // Google Analytics Data API v1 endpoint
    const gaResponse = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GOOGLE_ANALYTICS_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{
            startDate: startDateStr,
            endDate: endDateStr
          }],
          metrics: metrics.map(metric => ({ name: metric })),
          dimensions: [
            { name: 'date' },
            { name: 'country' },
            { name: 'deviceCategory' },
            { name: 'channelGrouping' }
          ]
        })
      }
    );

    if (!gaResponse.ok) {
      const errorText = await gaResponse.text();
      console.error('GA API Error:', errorText);
      throw new Error(`Google Analytics API error: ${gaResponse.status} - ${errorText}`);
    }

    const gaData = await gaResponse.json();
    console.log('GA API Response received successfully');

    // Process the data into a more usable format
    const processedData = {
      overview: {
        totalSessions: 0,
        totalPageviews: 0,
        totalUsers: 0,
        avgSessionDuration: 0
      },
      dailyData: [],
      topCountries: [],
      deviceBreakdown: [],
      trafficSources: []
    };

    if (gaData.rows) {
      // Calculate totals
      gaData.rows.forEach(row => {
        const [date, country, device, source] = row.dimensionValues.map(d => d.value);
        const [sessions, pageviews, users] = row.metricValues.map(m => parseInt(m.value) || 0);
        
        processedData.overview.totalSessions += sessions;
        processedData.overview.totalPageviews += pageviews;
        processedData.overview.totalUsers += users;
      });

      // Group daily data
      const dailyMap = {};
      const countryMap = {};
      const deviceMap = {};
      const sourceMap = {};

      gaData.rows.forEach(row => {
        const [date, country, device, source] = row.dimensionValues.map(d => d.value);
        const [sessions, pageviews, users] = row.metricValues.map(m => parseInt(m.value) || 0);

        // Daily data
        if (!dailyMap[date]) {
          dailyMap[date] = { date, sessions: 0, pageviews: 0, users: 0 };
        }
        dailyMap[date].sessions += sessions;
        dailyMap[date].pageviews += pageviews;
        dailyMap[date].users += users;

        // Country data
        countryMap[country] = (countryMap[country] || 0) + sessions;
        
        // Device data
        deviceMap[device] = (deviceMap[device] || 0) + sessions;
        
        // Source data
        sourceMap[source] = (sourceMap[source] || 0) + sessions;
      });

      processedData.dailyData = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
      processedData.topCountries = Object.entries(countryMap)
        .map(([country, sessions]) => ({ country, sessions }))
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, 10);
      
      processedData.deviceBreakdown = Object.entries(deviceMap)
        .map(([device, sessions]) => ({ device, sessions }));
        
      processedData.trafficSources = Object.entries(sourceMap)
        .map(([source, sessions]) => ({ source, sessions }))
        .sort((a, b) => b.sessions - a.sessions)
        .slice(0, 10);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: processedData,
        dateRange: { startDate: startDateStr, endDate: endDateStr }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in Google Analytics function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});