import { useState, useEffect, useCallback, useRef } from 'react'
import { getSmsCampaignProgress, SmsCampaignProgress } from '@/lib/sms/getSmsCampaignProgress'

interface UseSmsCampaignProgressOptions {
  campaignId: string | null | undefined
  pollIntervalMs?: number
  enabled?: boolean
}

interface UseSmsCampaignProgressResult {
  data: SmsCampaignProgress | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Hook to poll SMS campaign progress with automatic stop when complete
 */
export function useSmsCampaignProgress({
  campaignId,
  pollIntervalMs = 3000,
  enabled = true,
}: UseSmsCampaignProgressOptions): UseSmsCampaignProgressResult {
  const [data, setData] = useState<SmsCampaignProgress | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isMountedRef = useRef(true)

  const fetchProgress = useCallback(async () => {
    if (!campaignId) return

    try {
      setLoading(prev => prev || data === null) // Only show loading on initial fetch
      const result = await getSmsCampaignProgress(campaignId)
      
      if (isMountedRef.current) {
        setData(result)
        setError(null)
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err : new Error('Failed to fetch progress'))
        // Keep stale data on error
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [campaignId])

  // Check if we should stop polling
  const shouldStopPolling = useCallback((progressData: SmsCampaignProgress | null): boolean => {
    if (!progressData) return false
    
    // Stop if campaign is complete
    if (progressData.isComplete) return true
    
    // Stop if campaign status indicates finished
    const finishedStatuses = ['sent', 'failed', 'cancelled']
    if (finishedStatuses.includes(progressData.campaignStatus)) return true
    
    return false
  }, [])

  // Start polling
  useEffect(() => {
    isMountedRef.current = true

    if (!enabled || !campaignId) {
      return
    }

    // Initial fetch
    fetchProgress()

    // Set up polling interval
    intervalRef.current = setInterval(() => {
      // Check if we should stop
      if (shouldStopPolling(data)) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        return
      }
      
      fetchProgress()
    }, pollIntervalMs)

    return () => {
      isMountedRef.current = false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [campaignId, enabled, pollIntervalMs, fetchProgress, shouldStopPolling, data])

  // Stop polling when complete
  useEffect(() => {
    if (shouldStopPolling(data) && intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [data, shouldStopPolling])

  const refetch = useCallback(async () => {
    await fetchProgress()
  }, [fetchProgress])

  return { data, loading, error, refetch }
}
