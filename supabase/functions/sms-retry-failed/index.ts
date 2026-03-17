/**
 * SMS Retry Failed Messages
 * 
 * Allows retrying failed/dead-lettered messages for a campaign.
 * Respects opt-out and suppression status.
 */

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, handleCorsPrelight, corsJsonResponse } from '../_shared/cors.ts'

interface RetryRequest {
  campaignId: string
  mode: 'all_failed' | 'dead_letter_only'
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCorsPrelight(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return corsJsonResponse({ error: 'Method not allowed' }, { status: 405 })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse request
    const body: RetryRequest = await req.json()
    const { campaignId, mode } = body

    if (!campaignId) {
      return corsJsonResponse({ error: 'campaignId is required' }, { status: 400 })
    }

    if (!mode || !['all_failed', 'dead_letter_only'].includes(mode)) {
      return corsJsonResponse({ error: 'mode must be "all_failed" or "dead_letter_only"' }, { status: 400 })
    }

    // Get user from auth header for tenant check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return corsJsonResponse({ error: 'Authorization required' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return corsJsonResponse({ error: 'Invalid authorization' }, { status: 401 })
    }

    // Get user's tenant
    const { data: userData } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (!userData?.tenant_id) {
      return corsJsonResponse({ error: 'User tenant not found' }, { status: 403 })
    }

    // Verify campaign belongs to tenant
    const { data: campaign, error: campaignError } = await supabase
      .from('crm_sms_campaigns')
      .select('id, tenant_id, status')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return corsJsonResponse({ error: 'Campaign not found' }, { status: 404 })
    }

    if (campaign.tenant_id !== userData.tenant_id) {
      return corsJsonResponse({ error: 'Access denied' }, { status: 403 })
    }

    console.log(`[sms-retry-failed] Retrying failed messages for campaign ${campaignId}, mode: ${mode}`)

    // Build query for failed messages
    let query = supabase
      .from('sms_messages')
      .select('id, customer_id')
      .eq('campaign_id', campaignId)
      .eq('status', 'failed')

    if (mode === 'dead_letter_only') {
      query = query.not('dead_lettered_at', 'is', null)
    }

    const { data: failedMessages, error: fetchError } = await query

    if (fetchError) {
      console.error('[sms-retry-failed] Error fetching failed messages:', fetchError)
      return corsJsonResponse({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    if (!failedMessages || failedMessages.length === 0) {
      return corsJsonResponse({
        success: true,
        countReset: 0,
        countSkippedOptOut: 0,
        countSkippedSuppressed: 0,
        message: 'No failed messages to retry'
      })
    }

    console.log(`[sms-retry-failed] Found ${failedMessages.length} failed messages`)

    // Get customer IDs for opt-out/suppression check
    const customerIds = failedMessages
      .map(m => m.customer_id)
      .filter((id): id is string => !!id)

    // Fetch customer statuses
    const { data: customers } = await supabase
      .from('crm_customers')
      .select('id, sms_opt_in, opt_out, suppressed')
      .in('id', customerIds)

    const customerMap = new Map(customers?.map(c => [c.id, c]) || [])

    let countReset = 0
    let countSkippedOptOut = 0
    let countSkippedSuppressed = 0

    const messagesToReset: string[] = []

    for (const msg of failedMessages) {
      if (msg.customer_id) {
        const customer = customerMap.get(msg.customer_id)
        
        if (customer) {
          // Check opt-out
          if (!customer.sms_opt_in || customer.opt_out) {
            countSkippedOptOut++
            continue
          }
          
          // Check suppression
          if (customer.suppressed) {
            countSkippedSuppressed++
            continue
          }
        }
      }

      messagesToReset.push(msg.id)
    }

    // Reset eligible messages
    if (messagesToReset.length > 0) {
      const now = new Date().toISOString()
      
      const { error: updateError } = await supabase
        .from('sms_messages')
        .update({
          status: 'queued',
          scheduled_at: now,
          error_message: null,
          error_code: null,
          failure_type: null,
          dead_lettered_at: null,
          attempts: 0,
          last_attempt_at: null,
          updated_at: now
        })
        .in('id', messagesToReset)

      if (updateError) {
        console.error('[sms-retry-failed] Error resetting messages:', updateError)
        return corsJsonResponse({ error: 'Failed to reset messages' }, { status: 500 })
      }

      countReset = messagesToReset.length

      // Update campaign status back to queued/sending
      await supabase
        .from('crm_sms_campaigns')
        .update({
          status: 'queued',
          updated_at: now
        })
        .eq('id', campaignId)

      // Also reset any failed jobs
      await supabase
        .from('sms_send_jobs')
        .update({
          status: 'pending',
          error_message: null,
          dead_lettered_at: null,
          claimed_at: null,
          claimed_by: null,
          claim_token: null,
          attempts: 0,
          updated_at: now
        })
        .eq('campaign_id', campaignId)
        .eq('status', 'failed')
    }

    console.log(`[sms-retry-failed] Reset ${countReset} messages, skipped ${countSkippedOptOut} opt-out, ${countSkippedSuppressed} suppressed`)

    return corsJsonResponse({
      success: true,
      countReset,
      countSkippedOptOut,
      countSkippedSuppressed,
      message: `Reset ${countReset} messages for retry`
    })

  } catch (error) {
    console.error('[sms-retry-failed] Error:', error)
    return corsJsonResponse({ error: error.message }, { status: 500 })
  }
})
