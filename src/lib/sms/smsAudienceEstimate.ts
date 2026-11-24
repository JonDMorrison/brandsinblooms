import { supabase } from "@/integrations/supabase/client";
import { isUuidLike, resolveAudienceRecipientIds } from "@/lib/computeAudienceRecipientCount";

/**
 * The SMS wizard's audience estimate. Counts come from
 * get_sms_audience_estimate, which applies check_sms_send_eligibility's rules
 * (live, not merged, not suppressed customer; 10-digit phone; sms_opt_in with
 * a date and a consent source; latest SMS consent record opted in; not on the
 * SMS suppression list). crm_customers.opt_out is the email unsubscribe flag
 * and does not affect SMS. The enqueue worker, Send Now's recipient count and
 * the persona recipient page use the same rule, so the estimate is what would
 * actually be queued.
 */
export interface SmsAudienceEstimate {
  /** Live customers in the chosen audience (before SMS rules). */
  audience: number;
  /** Customers who would be queued. */
  eligible: number;
  /** audience - eligible. */
  excluded: number;
}

function toCount(value: unknown) {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0;
}

export function parseSmsAudienceEstimate(value: unknown): SmsAudienceEstimate {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    audience: toCount(record.audience),
    eligible: toCount(record.eligible),
    excluded: toCount(record.excluded),
  };
}

export async function fetchSmsAudienceEstimate(params: {
  tenantId: string;
  segmentId?: string | null;
  personaIds?: string[];
}): Promise<SmsAudienceEstimate> {
  let segmentId: string | null = null;
  let customerIds: string[] | null = null;

  if (params.segmentId) {
    if (isUuidLike(params.segmentId)) {
      segmentId = params.segmentId;
    } else {
      // Built-in (system) segments have no membership rows; resolve them the
      // way email campaigns do, then apply the SMS rules to those customers.
      customerIds = await resolveAudienceRecipientIds({
        tenantId: params.tenantId,
        segmentIds: [params.segmentId],
        personaIds: [],
      });
    }
  }

  const { data, error } = await supabase.rpc("get_sms_audience_estimate", {
    p_tenant_id: params.tenantId,
    p_segment_id: segmentId,
    p_persona_ids: params.personaIds?.length ? params.personaIds : null,
    p_customer_ids: customerIds,
  });
  if (error) throw error;
  return parseSmsAudienceEstimate(data);
}
