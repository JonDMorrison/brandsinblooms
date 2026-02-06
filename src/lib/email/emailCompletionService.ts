import { supabase } from '@/integrations/supabase/client'

export interface MarkCompletedResult {
  success: boolean
  newStatus: string | null
  errorMessage: string | null
}

export async function markEmailCampaignCompletedWithFailures(
  campaignId: string,
): Promise<MarkCompletedResult> {
  const { data, error } = await supabase.rpc(
    'mark_email_campaign_completed_with_failures' as any,
    { p_campaign_id: campaignId },
  )

  if (error) throw new Error(String(error?.message || error))

  const row = (Array.isArray(data) ? data[0] : data) as any

  return {
    success: Boolean(row?.success),
    newStatus: (row?.new_status ?? null) as string | null,
    errorMessage: (row?.error_message ?? null) as string | null,
  }
}
