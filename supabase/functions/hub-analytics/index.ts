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
    const { 
      campaign_id, 
      session_id, 
      interaction_type, 
      block_id, 
      metadata = {} 
    } = body

    if (!campaign_id || !session_id || !interaction_type) {
      return new Response('Missing required fields', { 
        status: 400, 
        headers: corsHeaders 
      })
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Insert interaction record
    const { error } = await supabase
      .from('hub_interactions')
      .insert({
        campaign_id,
        session_id,
        interaction_type,
        block_id,
        metadata: {
          ...metadata,
          timestamp: new Date().toISOString(),
          user_agent: req.headers.get('user-agent') || ''
        }
      })

    if (error) {
      console.error('Error tracking interaction:', error)
      return new Response('Error tracking interaction', { 
        status: 500, 
        headers: corsHeaders 
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Analytics error:', error)
    return new Response('Internal server error', { 
      status: 500, 
      headers: corsHeaders 
    })
  }
})