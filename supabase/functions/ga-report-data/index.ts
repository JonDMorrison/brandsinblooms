import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10';
import { corsHeaders, handleCorsPrelight, corsJsonResponse } from '../_shared/cors.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

async function decryptToken(encryptedToken: string): Promise<string> {
  const key = Deno.env.get('TOKEN_ENCRYPTION_KEY');
  if (!key) throw new Error('Encryption key not configured');
  
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const keyBytes = encoder.encode(key.padEnd(32, '0').slice(0, 32));
  
  const combined = new Uint8Array(
    atob(encryptedToken).split('').map(char => char.charCodeAt(0))
  );
  
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encrypted
  );
  
  return decoder.decode(decrypted);
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: Deno.env.get('GA_CLIENT_ID') ?? '',
      client_secret: Deno.env.get('GA_CLIENT_SECRET') ?? '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh access token');
  }

  const data = await response.json();
  return data.access_token;
}

async function fetchGoogleAnalyticsData(propertyId: string, accessToken: string, dateRange: number = 30) {
  const endDate = 'today';
  const startDate = `${dateRange}daysAgo`;

  // Fetch overview metrics
  const overviewResponse = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'screenPageViews' },
          { name: 'sessions' },
          { name: 'engagementRate' }
        ],
      }),
    }
  );

  if (!overviewResponse.ok) {
    throw new Error(`GA API Error: ${overviewResponse.status}`);
  }

  const overviewData = await overviewResponse.json();

  // Fetch daily data for trend chart
  const dailyResponse = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'date' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' }
        ],
        orderBys: [{ dimension: { dimensionName: 'date' } }]
      }),
    }
  );

  const dailyData = await dailyResponse.json();

  // Fetch top countries
  const countriesResponse = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 5
      }),
    }
  );

  const countriesData = await countriesResponse.json();

  // Fetch device breakdown
  const devicesResponse = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }]
      }),
    }
  );

  const devicesData = await devicesResponse.json();

  // Process and format the data
  const overview = {
    totalUsers: parseInt(overviewData.rows?.[0]?.metricValues?.[0]?.value || '0'),
    pageViews: parseInt(overviewData.rows?.[0]?.metricValues?.[1]?.value || '0'),
    sessions: parseInt(overviewData.rows?.[0]?.metricValues?.[2]?.value || '0'),
    engagementRate: parseFloat(overviewData.rows?.[0]?.metricValues?.[3]?.value || '0')
  };

  const daily = dailyData.rows?.map((row: any) => ({
    date: row.dimensionValues[0].value,
    users: parseInt(row.metricValues[0].value),
    sessions: parseInt(row.metricValues[1].value)
  })) || [];

  const topCountries = countriesData.rows?.map((row: any) => ({
    country: row.dimensionValues[0].value,
    sessions: parseInt(row.metricValues[0].value)
  })) || [];

  const deviceBreakdown = devicesData.rows?.map((row: any) => ({
    device: row.dimensionValues[0].value,
    sessions: parseInt(row.metricValues[0].value)
  })) || [];

  return {
    overview,
    dailyData: daily,
    topCountries,
    deviceBreakdown,
    lastUpdated: new Date().toISOString()
  };
}

Deno.serve(async (req) => {
  const corsResponse = handleCorsPrelight(req);
  if (corsResponse) return corsResponse;

  try {
    const { propertyId, dateRange = 30 } = await req.json();

    // Get auth header
    const authorization = req.headers.get('Authorization');
    if (!authorization) {
      return corsJsonResponse({ error: 'Authorization header required' }, { status: 401 });
    }

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authorization.replace('Bearer ', '')
    );

    if (authError || !user) {
      return corsJsonResponse({ error: 'Invalid authorization' }, { status: 401 });
    }

    // Get GA settings for this user
    const { data: gaSettings, error: settingsError } = await supabase
      .from('google_analytics_settings')
      .select('*')
      .eq('user_id', user.id)
      .eq('property_id', propertyId)
      .single();

    if (settingsError || !gaSettings) {
      return corsJsonResponse({ 
        error: 'Google Analytics not configured for this property' 
      }, { status: 404 });
    }

    if (gaSettings.connection_status !== 'connected') {
      return corsJsonResponse({ 
        error: 'Google Analytics connection not active',
        connectionStatus: gaSettings.connection_status 
      }, { status: 400 });
    }

    // For now, return mock data since we need the token storage implemented
    // TODO: Implement token storage and retrieval
    console.log('⚠️ Using mock data - token storage not yet implemented');
    
    const mockData = {
      overview: {
        totalUsers: Math.floor(Math.random() * 10000) + 1000,
        pageViews: Math.floor(Math.random() * 50000) + 5000,
        sessions: Math.floor(Math.random() * 8000) + 800,
        engagementRate: Math.random() * 0.5 + 0.3
      },
      dailyData: Array.from({ length: dateRange }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (dateRange - i - 1));
        return {
          date: date.toISOString().split('T')[0],
          users: Math.floor(Math.random() * 500) + 100,
          sessions: Math.floor(Math.random() * 300) + 50
        };
      }),
      topCountries: [
        { country: 'United States', sessions: Math.floor(Math.random() * 1000) + 500 },
        { country: 'Canada', sessions: Math.floor(Math.random() * 500) + 200 },
        { country: 'United Kingdom', sessions: Math.floor(Math.random() * 400) + 150 },
        { country: 'Germany', sessions: Math.floor(Math.random() * 300) + 100 },
        { country: 'France', sessions: Math.floor(Math.random() * 250) + 75 }
      ],
      deviceBreakdown: [
        { device: 'desktop', sessions: Math.floor(Math.random() * 800) + 400 },
        { device: 'mobile', sessions: Math.floor(Math.random() * 600) + 300 },
        { device: 'tablet', sessions: Math.floor(Math.random() * 200) + 50 }
      ],
      lastUpdated: new Date().toISOString()
    };

    return corsJsonResponse({ 
      success: true, 
      data: mockData 
    });

  } catch (error) {
    console.error('❌ GA report data error:', error);
    return corsJsonResponse({ 
      error: 'Failed to fetch analytics data',
      details: error.message 
    }, { status: 500 });
  }
});