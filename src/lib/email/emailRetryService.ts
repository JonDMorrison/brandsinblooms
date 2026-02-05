import { supabase } from '@/integrations/supabase/client'

export interface EmailRetryResult {
  countReset: number
  jobsCreated: number
}

export async function retryFailedEmailMessages(campaignId: string): Promise<EmailRetryResult> {
  const { data, error } = await supabase.rpc('retry_failed_email_messages' as any, {
    p_campaign_id: campaignId,
  })

  if (error) {
    throw new Error(error.message)
  }

  const row = (Array.isArray(data) ? data[0] : data) as any

  return {
    countReset: Number(row?.count_reset || 0),
    jobsCreated: Number(row?.jobs_created || 0),
  }
}
