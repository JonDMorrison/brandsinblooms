/**
 * SMS Failed Export
 * 
 * Exports failed messages for a campaign as CSV.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handleCorsPrelight } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCorsPrelight(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get campaignId from query params
    const url = new URL(req.url)
    const campaignId = url.searchParams.get('campaignId')

    if (!campaignId) {
      return new Response(JSON.stringify({ error: 'campaignId is required' }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get user from auth header for tenant check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authorization' }), { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get user's tenant
    const { data: userData } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (!userData?.tenant_id) {
      return new Response(JSON.stringify({ error: 'User tenant not found' }), { 
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Verify campaign belongs to tenant
    const { data: campaign, error: campaignError } = await supabase
      .from('crm_sms_campaigns')
      .select('id, tenant_id, name')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return new Response(JSON.stringify({ error: 'Campaign not found' }), { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (campaign.tenant_id !== userData.tenant_id) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { 
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`[sms-failed-export] Exporting failed messages for campaign ${campaignId}`)

    // Fetch failed messages with customer info
    const { data: failedMessages, error: fetchError } = await supabase
      .from('sms_messages')
      .select(`
        phone,
        customer_id,
        error_code,
        error_message,
        failure_type,
        attempts,
        dead_lettered_at,
        last_attempt_at
      `)
      .eq('campaign_id', campaignId)
      .eq('status', 'failed')
      .order('last_attempt_at', { ascending: false })

    if (fetchError) {
      console.error('[sms-failed-export] Error fetching failed messages:', fetchError)
      return new Response(JSON.stringify({ error: 'Failed to fetch messages' }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!failedMessages || failedMessages.length === 0) {
      // Return empty CSV with headers
      const csv = 'phone,customer_id,error_code,error_message,failure_type,attempts,dead_lettered_at\n'
      return new Response(csv, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="failed-messages-${campaignId}.csv"`
        }
      })
    }

    // Build CSV
    const headers = ['phone', 'customer_id', 'error_code', 'error_message', 'failure_type', 'attempts', 'dead_lettered_at']
    const rows = failedMessages.map(msg => {
      return [
        msg.phone || '',
        msg.customer_id || '',
        msg.error_code || '',
        // Escape quotes and newlines in error message
        `"${(msg.error_message || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
        msg.failure_type || '',
        String(msg.attempts || 0),
        msg.dead_lettered_at || ''
      ].join(',')
    })

    const csv = [headers.join(','), ...rows].join('\n')

    console.log(`[sms-failed-export] Exported ${failedMessages.length} failed messages`)

    return new Response(csv, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="failed-messages-${campaignId}.csv"`
      }
    })

  } catch (error) {
    console.error('[sms-failed-export] Error:', error)
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
