import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
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
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { 
        status: 405, 
        headers: corsHeaders 
      })
    }

    const body = await req.json()
    const { message, campaign_id } = body

    if (!message || !campaign_id) {
      return new Response('Missing message or campaign_id', { 
        status: 400, 
        headers: corsHeaders 
      })
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id, slug, hub_enabled')
      .eq('id', campaign_id)
      .single()

    if (campaignError || !campaign) {
      return new Response('Campaign not found', { 
        status: 404, 
        headers: corsHeaders 
      })
    }

    // Process message and replace macros
    let processedMessage = message

    // Replace {{HUB}} macro with short link
    if (campaign.hub_enabled && campaign.slug) {
      const hubUrl = `https://gc.ly/${campaign.slug}`
      processedMessage = processedMessage.replace(/\{\{HUB\}\}/g, hubUrl)
    }

    // Replace other common macros
    processedMessage = processedMessage.replace(/\{\{BUSINESS_NAME\}\}/g, 'Your Business')
    processedMessage = processedMessage.replace(/\{\{CURRENT_DATE\}\}/g, new Date().toLocaleDateString())
    processedMessage = processedMessage.replace(/\{\{CURRENT_TIME\}\}/g, new Date().toLocaleTimeString())

    // Add campaign ID to track macro usage
    const macroUsage = {
      hub_used: message.includes('{{HUB}}'),
      total_macros: (message.match(/\{\{[^}]+\}\}/g) || []).length,
      processed_at: new Date().toISOString()
    }

    return new Response(JSON.stringify({
      original_message: message,
      processed_message: processedMessage,
      hub_url: campaign.hub_enabled && campaign.slug ? `https://gc.ly/${campaign.slug}` : null,
      macro_usage: macroUsage
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('SMS processing error:', error)
    return new Response('Internal server error', { 
      status: 500, 
      headers: corsHeaders 
    })
  }
})