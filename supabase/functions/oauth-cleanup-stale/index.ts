import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Authorization required')
    }
    
    const jwt = authHeader.replace('Bearer ', '')
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt)
    if (userError || !user) {
      throw new Error('Invalid or expired token')
    }

    console.log('🧹 Cleaning stale OAuth codes for user:', user.id.substring(0, 8) + '...')

    // Find stale OAuth attempts (older than 10 minutes with no active connections)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    
    const { data: staleCodes, error: fetchError } = await supabase
      .from('oauth_code_usage')
      .select('id, used_at')
      .eq('user_id', user.id)
      .lt('used_at', tenMinutesAgo)

    if (fetchError) {
      throw fetchError
    }

    if (!staleCodes || staleCodes.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          cleaned: 0,
          message: 'No stale OAuth codes found'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user has active connections
    const { data: connections } = await supabase
      .from('social_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .in('platform', ['facebook', 'instagram'])

    // Only clean up if no connections exist (meaning the OAuth failed)
    if (!connections || connections.length === 0) {
      const { error: deleteError } = await supabase
        .from('oauth_code_usage')
        .delete()
        .in('id', staleCodes.map(c => c.id))

      if (deleteError) {
        throw deleteError
      }

      console.log(`✅ Cleaned up ${staleCodes.length} stale OAuth code(s)`)

      return new Response(
        JSON.stringify({ 
          success: true, 
          cleaned: staleCodes.length,
          message: `Cleaned up ${staleCodes.length} stale OAuth attempt${staleCodes.length !== 1 ? 's' : ''}. You can retry connecting now.`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      return new Response(
        JSON.stringify({ 
          success: true, 
          cleaned: 0,
          message: 'Active connections exist, no cleanup needed',
          connections: connections.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('❌ Error cleaning stale OAuth codes:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
