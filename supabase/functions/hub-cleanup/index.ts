import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  console.log('🧹 Starting hub cleanup job...')
  
  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const now = new Date()
    const cutoffDate = now.toISOString().split('T')[0] // Today's date in YYYY-MM-DD format

    // Find expired campaigns
    const { data: expiredCampaigns, error: findError } = await supabase
      .from('campaigns')
      .select('id, title, slug, hub_expiry')
      .eq('hub_enabled', true)
      .not('hub_expiry', 'is', null)
      .lt('hub_expiry', cutoffDate)

    if (findError) {
      console.error('Error finding expired campaigns:', findError)
      return new Response('Error finding campaigns', { status: 500 })
    }

    console.log(`📊 Found ${expiredCampaigns?.length || 0} expired campaigns`)

    let cleanedCount = 0
    let disabledCount = 0

    if (expiredCampaigns && expiredCampaigns.length > 0) {
      // Disable expired hubs
      const expiredIds = expiredCampaigns.map(c => c.id)
      
      const { error: disableError } = await supabase
        .from('campaigns')
        .update({ hub_enabled: false })
        .in('id', expiredIds)

      if (disableError) {
        console.error('Error disabling expired hubs:', disableError)
      } else {
        disabledCount = expiredCampaigns.length
        console.log(`✅ Disabled ${disabledCount} expired hubs`)
      }

      // Optional: Clean up old analytics data (older than 90 days)
      const oldDataCutoff = new Date()
      oldDataCutoff.setDate(oldDataCutoff.getDate() - 90)

      const { error: cleanViewsError } = await supabase
        .from('hub_views')
        .delete()
        .lt('viewed_at', oldDataCutoff.toISOString())

      const { error: cleanInteractionsError } = await supabase
        .from('hub_interactions')
        .delete()
        .lt('created_at', oldDataCutoff.toISOString())

      if (!cleanViewsError && !cleanInteractionsError) {
        console.log('🗑️ Cleaned up old analytics data (>90 days)')
        cleanedCount++
      }
    }

    // Also clean up content blocks for disabled hubs
    const { data: disabledCampaigns, error: disabledError } = await supabase
      .from('campaigns')
      .select('id')
      .eq('hub_enabled', false)

    if (!disabledError && disabledCampaigns && disabledCampaigns.length > 0) {
      const disabledIds = disabledCampaigns.map(c => c.id)
      
      const { error: blocksError } = await supabase
        .from('content_blocks')
        .update({ is_active: false })
        .in('campaign_id', disabledIds)
        .eq('is_active', true)

      if (!blocksError) {
        console.log('🧹 Deactivated content blocks for disabled hubs')
      }
    }

    const summary = {
      timestamp: now.toISOString(),
      expired_campaigns_found: expiredCampaigns?.length || 0,
      hubs_disabled: disabledCount,
      analytics_cleaned: cleanedCount,
      status: 'completed'
    }

    console.log('📋 Cleanup summary:', summary)

    return new Response(JSON.stringify(summary), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Hub cleanup error:', error)
    return new Response(JSON.stringify({
      error: 'Cleanup failed',
      timestamp: new Date().toISOString(),
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})