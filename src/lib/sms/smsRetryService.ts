/**
 * SMS Retry Service
 * 
 * Client API for retrying failed SMS messages and exporting failures.
 */

import { supabase } from '@/integrations/supabase/client'

export interface RetryResult {
  success: boolean
  countReset: number
  countSkippedOptOut: number
  countSkippedSuppressed: number
  message: string
  error?: string
}

/**
 * Retry failed messages for a campaign
 */
export async function retryFailedMessages(
  campaignId: string,
  mode: 'all_failed' | 'dead_letter_only' = 'all_failed'
): Promise<RetryResult> {
  const { data, error } = await supabase.functions.invoke('sms-retry-failed', {
    body: { campaignId, mode }
  })

  if (error) {
    return {
      success: false,
      countReset: 0,
      countSkippedOptOut: 0,
      countSkippedSuppressed: 0,
      message: 'Failed to retry messages',
      error: error.message
    }
  }

  return data as RetryResult
}

/**
 * Download failed messages as CSV
 */
export async function downloadFailedMessages(campaignId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session?.access_token) {
    throw new Error('Not authenticated')
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://udldmkqwnxhdeztyqcau.supabase.co'
  const url = `${supabaseUrl}/functions/v1/sms-failed-export?campaignId=${campaignId}`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
    }
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Failed to download')
  }

  // Get the CSV content
  const csvContent = await response.text()
  
  // Create download
  const blob = new Blob([csvContent], { type: 'text/csv' })
  const downloadUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = `failed-messages-${campaignId}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(downloadUrl)
}
