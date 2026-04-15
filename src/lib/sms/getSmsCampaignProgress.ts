import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from '@/integrations/supabase/config'
import { supabase } from '@/integrations/supabase/client'

export interface SmsCampaignProgress {
  success: boolean
  campaignId: string
  tenantId: string | null
  campaignStatus: string
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

/**
 * Fetch real-time progress data for an SMS campaign
 */
export async function getSmsCampaignProgress(campaignId: string): Promise<SmsCampaignProgress> {
  // Since GET requests with body don't work well, use query params via custom fetch
  const url = `${SUPABASE_URL}/functions/v1/sms-campaign-progress?campaignId=${encodeURIComponent(campaignId)}`
  
  const session = await supabase.auth.getSession()
  const accessToken = session.data.session?.access_token

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_PUBLISHABLE_KEY,
      ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `HTTP ${response.status}`)
  }

  return response.json()
}
