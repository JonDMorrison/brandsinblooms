/**
 * SMS Campaign Progress Endpoint
 * 
 * Returns authoritative progress data for an SMS campaign including:
 * - Job counts (pending, in_progress, completed, failed)
 * - Message counts (queued, sent, delivered, failed)
 * - Derived rates (delivered rate, failed rate)
 * - Completion and stall detection
 * 
 * This is a read-only endpoint for UI polling.
 */

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Stall detection: if no job updates in this many minutes, campaign is stalled
const STALL_MINUTES = Number(Deno.env.get("SMS_CAMPAIGN_STALL_MINUTES") ?? "10");

interface ProgressResponse {
  success: boolean
  campaignId: string
  tenantId: string | null
  campaignStatus: string
  enqueueStatus: string
  enqueue: {
    status: string
    totalEstimate: number
    totalEnqueued: number
    percentComplete: number
    isEnqueuing: boolean
    isEnqueued: boolean
  }
  jobs: {
    total: number
    pending: number
    in_progress: number
    completed: number
    failed: number
  }
  messages: {
    total: number
    queued: number
    sent: number
    delivered: number
    failed: number
  }
  rates: {
    deliveredRate: number
    failedRate: number
  }
  timestamps: {
    scheduledAt: string | null
    sentAt: string | null
    lastJobUpdatedAt: string | null
    lastMessageUpdatedAt: string | null
  }
  isComplete: boolean
  isStalled: boolean
  stallReason: string | null
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Get campaign ID from query params
    const url = new URL(req.url)
    const campaignId = url.searchParams.get('campaignId')

    if (!campaignId) {
      return new Response(
        JSON.stringify({ success: false, error: 'campaignId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with service role for aggregation queries
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Also create a client with user auth for tenant verification
    const authHeader = req.headers.get('Authorization')
    let userTenantId: string | null = null

    if (authHeader) {
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      )

      const { data: userData } = await userClient.auth.getUser()
      if (userData?.user) {
        // Get user's tenant_id
        const { data: userRow } = await supabase
          .from('users')
          .select('tenant_id')
          .eq('id', userData.user.id)
          .single()
        
        userTenantId = userRow?.tenant_id || null
      }
    }

    // 1. Load the campaign with enqueue fields
    const { data: campaign, error: campaignError } = await supabase
      .from('crm_sms_campaigns')
      .select('id, tenant_id, status, scheduled_at, sent_at, enqueue_status, total_recipients_estimate, total_enqueued')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ success: false, error: 'Campaign not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify tenant access if we have user tenant
    if (userTenantId && campaign.tenant_id && userTenantId !== campaign.tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Access denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Aggregate job counts
    const { data: jobData, error: jobError } = await supabase
      .from('sms_send_jobs')
      .select('status, updated_at')
      .eq('campaign_id', campaignId)

    const jobs = {
      total: 0,
      pending: 0,
      in_progress: 0,
      completed: 0,
      failed: 0,
    }
    let lastJobUpdatedAt: string | null = null

    if (!jobError && jobData) {
      jobs.total = jobData.length
      for (const job of jobData) {
        switch (job.status) {
          case 'pending': jobs.pending++; break
          case 'in_progress': jobs.in_progress++; break
          case 'completed': jobs.completed++; break
          case 'failed': jobs.failed++; break
        }
        if (!lastJobUpdatedAt || (job.updated_at && job.updated_at > lastJobUpdatedAt)) {
          lastJobUpdatedAt = job.updated_at
        }
      }
    }

    // 3. Aggregate message counts
    const { data: msgData, error: msgError } = await supabase
      .from('sms_messages')
      .select('status, updated_at')
      .eq('campaign_id', campaignId)

    const messages = {
      total: 0,
      queued: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
    }
    let lastMessageUpdatedAt: string | null = null

    if (!msgError && msgData) {
      messages.total = msgData.length
      for (const msg of msgData) {
        switch (msg.status) {
          case 'queued': messages.queued++; break
          case 'sent': messages.sent++; break
          case 'delivered': messages.delivered++; break
          case 'failed': messages.failed++; break
        }
        if (!lastMessageUpdatedAt || (msg.updated_at && msg.updated_at > lastMessageUpdatedAt)) {
          lastMessageUpdatedAt = msg.updated_at
        }
      }
    }

    // 4. Compute derived fields
    const deliveredRate = messages.total > 0 ? messages.delivered / messages.total : 0
    const failedRate = messages.total > 0 ? messages.failed / messages.total : 0

    // isComplete: no pending or in_progress jobs, and we have jobs
    const isComplete = jobs.total > 0 && (jobs.pending + jobs.in_progress) === 0

    // 5. Stall detection
    let isStalled = false
    let stallReason: string | null = null

    if (jobs.total > 0 && !isComplete && lastJobUpdatedAt) {
      const lastUpdate = new Date(lastJobUpdatedAt)
      const stallThreshold = new Date(Date.now() - STALL_MINUTES * 60 * 1000)
      
      if (lastUpdate < stallThreshold) {
        isStalled = true
        stallReason = `No job updates in the last ${STALL_MINUTES} minutes. Worker may be paused or failing.`
      }
    }

    // Enqueue progress
    const enqueueStatus = campaign.enqueue_status || 'not_started'
    const totalEstimate = campaign.total_recipients_estimate || 0
    const totalEnqueued = campaign.total_enqueued || 0
    const enqueuePercentComplete = totalEstimate > 0 
      ? Math.round((totalEnqueued / totalEstimate) * 100) 
      : 0

    // Build response
    const response: ProgressResponse = {
      success: true,
      campaignId: campaign.id,
      tenantId: campaign.tenant_id,
      campaignStatus: campaign.status || 'unknown',
      enqueueStatus,
      enqueue: {
        status: enqueueStatus,
        totalEstimate,
        totalEnqueued,
        percentComplete: enqueuePercentComplete,
        isEnqueuing: enqueueStatus === 'enqueuing',
        isEnqueued: enqueueStatus === 'enqueued',
      },
      jobs,
      messages,
      rates: {
        deliveredRate,
        failedRate,
      },
      timestamps: {
        scheduledAt: campaign.scheduled_at || null,
        sentAt: campaign.sent_at || null,
        lastJobUpdatedAt,
        lastMessageUpdatedAt,
      },
      isComplete,
      isStalled,
      stallReason,
    }

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[sms-campaign-progress] Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
