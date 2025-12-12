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
  const { data, error } = await supabase.functions.invoke<SmsCampaignProgress>('sms-campaign-progress', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    body: null,
  })

  // Since GET requests with body don't work well, use query params via custom fetch
  const url = `${import.meta.env.VITE_SUPABASE_URL || 'https://udldmkqwnxhdeztyqcau.supabase.co'}/functions/v1/sms-campaign-progress?campaignId=${encodeURIComponent(campaignId)}`
  
  const session = await supabase.auth.getSession()
  const accessToken = session.data.session?.access_token

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkbGRta3F3bnhoZGV6dHlxY2F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwNTg0MzQsImV4cCI6MjA2NDYzNDQzNH0.1iO2-DRx5aX_WpEcDGv9aKHGy1rdDPOZaQC6Ke4MpRM',
      ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
    },
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `HTTP ${response.status}`)
  }

  return response.json()
}
