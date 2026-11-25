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

/**
 * Built-in segments the "Send SMS to segment" flow can target. send-sms-campaign
 * stores the id as metrics.segment_filter.system_segment_type, and
 * count_sms_campaign_recipients and the enqueue worker only know these four;
 * any other value would fall through to every subscriber, so it is rejected.
 */
export const SMS_SEND_SYSTEM_SEGMENT_IDS = [
  "perks-members",
  "high-value",
  "new-customers",
  "frequent-buyers",
] as const;

export type SmsSendSystemSegmentId = (typeof SMS_SEND_SYSTEM_SEGMENT_IDS)[number];

export function isSmsSendSystemSegmentId(
  value: string,
): value is SmsSendSystemSegmentId {
  return (SMS_SEND_SYSTEM_SEGMENT_IDS as readonly string[]).includes(value);
}

const SYSTEM_SEGMENT_PAGE_SIZE = 1000;

async function fetchCustomerIdsByCursor(
  fetchPage: (
    afterId: string | null,
    pageSize: number,
  ) => PromiseLike<{ data: { id: string }[] | null; error: unknown }>,
): Promise<string[]> {
  const ids: string[] = [];
  let afterId: string | null = null;

  for (;;) {
    const { data, error } = await fetchPage(afterId, SYSTEM_SEGMENT_PAGE_SIZE);
    if (error) throw error;
    const rows = data ?? [];
    for (const row of rows) ids.push(row.id);
    if (rows.length < SYSTEM_SEGMENT_PAGE_SIZE) return ids;
    afterId = rows[rows.length - 1].id;
  }
}

/**
 * Live customers in a built-in SMS segment, defined exactly as
 * count_sms_campaign_recipients defines them (migration
 * 20261124190246_sms_campaign_count_frequent_buyers.sql). Paged by id so a
 * large tenant is not cut off at PostgREST's 1,000-row limit. SMS eligibility
 * is not applied here; get_sms_audience_estimate applies it.
 */
export async function resolveSmsSystemSegmentCustomerIds(
  tenantId: string,
  systemSegmentId: SmsSendSystemSegmentId,
): Promise<string[]> {
  if (systemSegmentId === "perks-members") {
    return fetchCustomerIdsByCursor((afterId, pageSize) => {
      let query = supabase
        .from("crm_customers")
        .select("id, customer_loyalty_metrics!inner(is_perks_member)")
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .is("merged_into_customer_id", null)
        .eq("customer_loyalty_metrics.is_perks_member", true);
      if (afterId) query = query.gt("id", afterId);
      return query.order("id", { ascending: true }).limit(pageSize);
    });
  }

  return fetchCustomerIdsByCursor((afterId, pageSize) => {
    let query = supabase
      .from("crm_customers")
      .select("id")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .is("merged_into_customer_id", null);

    switch (systemSegmentId) {
      case "high-value":
        query = query.gte("total_spent", 500);
        break;
      case "new-customers":
        query = query.gte(
          "created_at",
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        );
        break;
      case "frequent-buyers":
        query = query.gte("pos_order_count", 3);
        break;
    }

    if (afterId) query = query.gt("id", afterId);
    return query.order("id", { ascending: true }).limit(pageSize);
  });
}

/**
 * Audience estimate for "Send SMS to segment" (SendToSegmentCard and
 * SegmentSMSDialog). Same rule as the wizard, Send Now's
 * count_sms_campaign_recipients and the enqueue worker
 * (public.sms_eligible_customers); crm_customers.opt_out is the email
 * unsubscribe flag and plays no part in SMS.
 */
export async function fetchSmsSegmentSendEstimate(params: {
  tenantId: string;
  segmentId: string;
  isSystemSegment: boolean;
}): Promise<SmsAudienceEstimate> {
  if (!params.isSystemSegment) {
    if (!isUuidLike(params.segmentId)) {
      throw new Error("Unknown segment.");
    }
    return fetchSmsAudienceEstimate({
      tenantId: params.tenantId,
      segmentId: params.segmentId,
    });
  }

  if (!isSmsSendSystemSegmentId(params.segmentId)) {
    throw new Error("This built-in segment can't be sent by SMS from here.");
  }

  const customerIds = await resolveSmsSystemSegmentCustomerIds(
    params.tenantId,
    params.segmentId,
  );
  if (customerIds.length === 0) {
    return { audience: 0, eligible: 0, excluded: 0 };
  }

  const { data, error } = await supabase.rpc("get_sms_audience_estimate", {
    p_tenant_id: params.tenantId,
    p_segment_id: null,
    p_persona_ids: null,
    p_customer_ids: customerIds,
  });
  if (error) throw error;
  return parseSmsAudienceEstimate(data);
}
