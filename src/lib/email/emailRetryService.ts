import { supabase } from '@/integrations/supabase/client'

export interface EmailRetryResult {
  countReset: number
  jobsCreated: number
}

export async function retryFailedEmailMessages(campaignId: string): Promise<EmailRetryResult> {
  // Prefer the 2-arg signature so we don't depend on PostgREST default-arg handling.
  // Fall back to the 1-arg wrapper if the schema cache is temporarily stale.
  let data: any = null
  let error: any = null

  ;({ data, error } = await supabase.rpc('retry_failed_email_messages' as any, {
    p_campaign_id: campaignId,
    p_batch_size: 200,
  }))

  if (error) {
    const msg = String(error?.message || error)
    const looksLikeSchemaCache = msg.toLowerCase().includes('schema cache') && msg.toLowerCase().includes('could not find the function')

    if (looksLikeSchemaCache) {
      ;({ data, error } = await supabase.rpc('retry_failed_email_messages' as any, {
        p_campaign_id: campaignId,
      }))
    }
  }

  if (error) throw new Error(String(error?.message || error))

  const row = (Array.isArray(data) ? data[0] : data) as any

  return {
    countReset: Number(row?.count_reset || 0),
    jobsCreated: Number(row?.jobs_created || 0),
  }
}
