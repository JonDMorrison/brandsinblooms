
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Get all active social connections
    const { data: connections, error: connectionsError } = await supabaseClient
      .from('social_connections')
      .select('*')
      .eq('is_active', true)

    if (connectionsError) throw connectionsError

    const syncResults = []

    for (const connection of connections || []) {
      try {
        console.log(`Syncing analytics for ${connection.platform} - ${connection.platform_account_name}`)

        if (connection.platform === 'facebook') {
          await syncFacebookMetrics(supabaseClient, connection)
        } else if (connection.platform === 'instagram') {
          await syncInstagramMetrics(supabaseClient, connection)
        } else if (connection.platform === 'google_my_business') {
          await syncGoogleMyBusinessMetrics(supabaseClient, connection)
        }

        syncResults.push({ 
          platform: connection.platform, 
          account: connection.platform_account_name,
          status: 'success' 
        })

      } catch (error) {
        console.error(`Error syncing ${connection.platform}:`, error)
        syncResults.push({ 
          platform: connection.platform, 
          account: connection.platform_account_name,
          status: 'error',
          error: error.message 
        })
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        synced: syncResults.length,
        results: syncResults 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      },
    )

  } catch (error) {
    console.error('Error in sync-analytics:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      },
    )
  }
})

async function syncFacebookMetrics(supabaseClient: any, connection: any) {
  const today = new Date().toISOString().split('T')[0]
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // Get Facebook page insights
  const insightsUrl = `https://graph.facebook.com/v18.0/${connection.platform_account_id}/insights/page_impressions,page_reach,page_engaged_users?since=${sevenDaysAgo}&until=${today}&access_token=${connection.access_token}`
  
  const response = await fetch(insightsUrl)
  const data = await response.json()

  if (data.error) {
    throw new Error(`Facebook API Error: ${data.error.message}`)
  }

  // Store metrics in analytics_data table
  for (const metric of data.data || []) {
    const metricType = metric.name === 'page_impressions' ? 'impressions' : 
                      metric.name === 'page_reach' ? 'reach' : 'engagement'
    
    const value = metric.values[metric.values.length - 1]?.value || 0

    await supabaseClient
      .from('analytics_data')
      .upsert({
        connection_id: connection.id,
        metric_type: metricType,
        metric_value: value,
        date_collected: today,
        metadata: { source: 'facebook_insights', period: '7_days' }
      })
  }
}

async function syncInstagramMetrics(supabaseClient: any, connection: any) {
  const today = new Date().toISOString().split('T')[0]

  // Get Instagram insights
  const insightsUrl = `https://graph.facebook.com/v18.0/${connection.platform_account_id}/insights?metric=impressions,reach,profile_views&period=day&access_token=${connection.access_token}`
  
  const response = await fetch(insightsUrl)
  const data = await response.json()

  if (data.error) {
    throw new Error(`Instagram API Error: ${data.error.message}`)
  }

  // Store metrics
  for (const metric of data.data || []) {
    const value = metric.values[metric.values.length - 1]?.value || 0

    await supabaseClient
      .from('analytics_data')
      .upsert({
        connection_id: connection.id,
        metric_type: metric.name,
        metric_value: value,
        date_collected: today,
        metadata: { source: 'instagram_insights', period: 'day' }
      })
  }
}

async function syncGoogleMyBusinessMetrics(supabaseClient: any, connection: any) {
  const today = new Date().toISOString().split('T')[0]
  
  // Get Google My Business insights
  const insightsUrl = `https://mybusiness.googleapis.com/v4/${connection.platform_account_id}/locations:reportInsights`
  
  const requestBody = {
    reportRequests: [{
      metricRequests: [
        { metric: 'QUERIES_DIRECT' },
        { metric: 'QUERIES_INDIRECT' },
        { metric: 'VIEWS_MAPS' },
        { metric: 'VIEWS_SEARCH' },
        { metric: 'ACTIONS_WEBSITE' },
        { metric: 'ACTIONS_PHONE' }
      ],
      timeRange: {
        startTime: { year: 2024, month: 12, day: 6 },
        endTime: { year: 2024, month: 12, day: 13 }
      }
    }]
  }

  const response = await fetch(insightsUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${connection.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  })

  const data = await response.json()

  if (data.error) {
    throw new Error(`Google My Business API Error: ${data.error.message}`)
  }

  // Store metrics
  const report = data.reportResults?.[0]
  if (report?.metricValues) {
    for (const metric of report.metricValues) {
      let metricType = 'views'
      let value = 0

      switch (metric.metric) {
        case 'QUERIES_DIRECT':
        case 'QUERIES_INDIRECT':
          metricType = 'search_queries'
          value = metric.totalValue?.value || 0
          break
        case 'VIEWS_MAPS':
        case 'VIEWS_SEARCH':
          metricType = 'views'
          value = metric.totalValue?.value || 0
          break
        case 'ACTIONS_WEBSITE':
          metricType = 'clicks'
          value = metric.totalValue?.value || 0
          break
        case 'ACTIONS_PHONE':
          metricType = 'calls'
          value = metric.totalValue?.value || 0
          break
      }

      await supabaseClient
        .from('analytics_data')
        .upsert({
          connection_id: connection.id,
          metric_type: metricType,
          metric_value: value,
          date_collected: today,
          metadata: { 
            source: 'google_my_business', 
            metric_name: metric.metric,
            period: '7_days' 
          }
        })
    }
  }
}
