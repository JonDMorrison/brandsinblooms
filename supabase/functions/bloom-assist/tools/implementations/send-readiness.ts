/**
 * get_send_readiness: can this company send an email campaign right now?
 *
 * Two independent checks, both required:
 *  - the sender: the shared resolveTenantSendingReadiness rule (Settings and
 *    Review & Send use the same one), loaded by loadTenantSendingReadiness;
 *  - who can receive it: public.email_reachability_summary, the same
 *    definition the audience health panel and the send path use.
 * A verified sender with nobody reachable is not ready: the campaign would
 * reach no one. get_email_health only reports past bounce and complaint
 * rates, which are 0% when nothing has been sent, so it cannot answer this.
 */
import type { TenantSendingReadiness } from "../../../../../src/lib/crm/senderSeverity.ts";
import type { JsonObject } from "../../types.ts";
import type { ToolExecutionContext, ToolImplementation, ToolResult } from "../types.ts";
import { loadTenantSendingReadiness } from "./query-campaigns.ts";
import { getQueryClient, isRecord } from "./shared.ts";

export interface EmailReachabilityCounts {
  total: number;
  reachable: number;
  waiting: number;
  stopped: number;
  unsendable: number;
  askedToStop: number;
  neverOptedIn: number;
}

export type SendReadinessVerdict = "ready" | "not_ready" | "unknown";

export type SendReadinessReason =
  | "READY"
  | "SENDER_NOT_READY"
  | "NO_REACHABLE_CUSTOMERS"
  | "NO_EMAIL_ADDRESSES"
  | "REACHABILITY_UNKNOWN";

function readCount(value: unknown): number | null {
  const count = typeof value === "string" ? Number(value) : value;
  return typeof count === "number" && Number.isSafeInteger(count) && count >= 0 ? count : null;
}

/** One email_reachability_summary row. Counts that do not add up are not trusted. */
export function parseReachabilityRow(row: unknown): EmailReachabilityCounts | null {
  if (!isRecord(row)) return null;
  const counts = {
    total: readCount(row.total),
    reachable: readCount(row.reachable),
    waiting: readCount(row.waiting),
    stopped: readCount(row.stopped),
    unsendable: readCount(row.unsendable),
    askedToStop: readCount(row.asked_to_stop),
    neverOptedIn: readCount(row.never_opted_in),
  };
  if (Object.values(counts).some((value) => value === null)) return null;
  const c = counts as EmailReachabilityCounts;
  if (c.askedToStop + c.neverOptedIn !== c.stopped) return null;
  if (c.reachable + c.waiting + c.stopped + c.unsendable !== c.total) return null;
  return c;
}

const number = (value: number) => value.toLocaleString("en-US");
const people = (value: number) => `${number(value)} ${value === 1 ? "address" : "addresses"}`;

/** Plain sentences for why addresses cannot receive campaign email. */
export function reachabilityReasons(counts: EmailReachabilityCounts): string[] {
  return [
    counts.unsendable > 0
      ? `${people(counts.unsendable)} can't receive email (invalid, bounced, suppressed or test addresses)`
      : null,
    counts.neverOptedIn > 0 ? `${people(counts.neverOptedIn)} never opted in to email` : null,
    counts.askedToStop > 0 ? `${people(counts.askedToStop)} asked to stop getting email` : null,
    counts.waiting > 0 ? `${people(counts.waiting)} are still waiting to confirm they want email` : null,
  ].filter((line): line is string => Boolean(line));
}

export interface SendReadinessAssessment {
  verdict: SendReadinessVerdict;
  reason: SendReadinessReason;
  canSendCampaigns: boolean | null;
  summary: string;
}

/** The verdict. Sending works only with a ready sender AND at least one reachable address. */
export function assessSendReadiness(
  readiness: TenantSendingReadiness,
  reachability: EmailReachabilityCounts | null,
): SendReadinessAssessment {
  if (readiness.canSend === false) {
    const senderLine = `Your sender is not ready: ${readiness.message}`;
    const audience = reachability
      ? ` ${number(reachability.reachable)} of ${people(reachability.total)} can receive email.`
      : "";
    return {
      verdict: "not_ready",
      reason: "SENDER_NOT_READY",
      canSendCampaigns: false,
      summary: `${senderLine}${audience} Campaigns cannot be sent until the sender is fixed.`,
    };
  }
  const senderLine = `Your sender is set up: the domain ${readiness.domain} is verified and campaigns send from ${readiness.fromEmail}${readiness.fromName ? ` (${readiness.fromName})` : ""}.`;
  if (!reachability) {
    return {
      verdict: "unknown",
      reason: "REACHABILITY_UNKNOWN",
      canSendCampaigns: null,
      summary: `${senderLine} I could not check how many customers can receive email, so I can't say a campaign would reach anyone.`,
    };
  }
  if (reachability.total === 0) {
    return {
      verdict: "not_ready",
      reason: "NO_EMAIL_ADDRESSES",
      canSendCampaigns: false,
      summary: `${senderLine} But no customer has an email address on file, so a campaign would reach no one.`,
    };
  }
  if (reachability.reachable === 0) {
    const reasons = reachabilityReasons(reachability);
    return {
      verdict: "not_ready",
      reason: "NO_REACHABLE_CUSTOMERS",
      canSendCampaigns: false,
      summary: `${senderLine} But 0 of ${people(reachability.total)} can receive campaign email${reasons.length ? `: ${reasons.join("; ")}` : ""}. A campaign sent now would reach no one.`,
    };
  }
  const reasons = reachabilityReasons(reachability);
  return {
    verdict: "ready",
    reason: "READY",
    canSendCampaigns: true,
    summary: `${senderLine} ${number(reachability.reachable)} of ${people(reachability.total)} can receive campaign email${reasons.length ? ` (the rest: ${reasons.join("; ")})` : ""}.`,
  };
}

function metric(key: string, label: string, value: number): JsonObject {
  return {
    key,
    label,
    value: number(value),
    raw_value: value,
    change_label: null,
    change_direction: "flat",
    comparison_value: null,
    change_percentage: null,
  };
}

export const getSendReadiness: ToolImplementation = async (
  _params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> => {
  const client = getQueryClient(context);
  const [{ readiness }, reachabilityResult] = await Promise.all([
    loadTenantSendingReadiness(client, context.tenantId),
    // No customer list: every customer in this company.
    client.rpc("email_reachability_summary", { p_tenant_id: context.tenantId }),
  ]);
  if (reachabilityResult.error) {
    console.error("[bloom-assist] email_reachability_summary failed", reachabilityResult.error.message);
  }
  const row: unknown = Array.isArray(reachabilityResult.data)
    ? reachabilityResult.data[0]
    : reachabilityResult.data;
  const reachability = reachabilityResult.error ? null : parseReachabilityRow(row);
  const assessment = assessSendReadiness(readiness, reachability);

  const data: JsonObject = {
    kind: "send_readiness",
    verdict: assessment.verdict,
    can_send_campaigns: assessment.canSendCampaigns,
    reason: assessment.reason,
    summary: assessment.summary,
    reachable_of_total: reachability
      ? `${number(reachability.reachable)} of ${number(reachability.total)}`
      : null,
    sender: readiness.canSend === true
      ? {
          status: "ready",
          domain: readiness.domain,
          domain_verified: true,
          from_email: readiness.fromEmail,
          from_name: readiness.fromName,
        }
      : {
          status: "blocked",
          reason: readiness.reason,
          domain: readiness.domain,
          domain_verified: false,
          message: readiness.message,
        },
    reachability: reachability
      ? {
          total: reachability.total,
          reachable: reachability.reachable,
          unsendable: reachability.unsendable,
          waiting: reachability.waiting,
          stopped: reachability.stopped,
          asked_to_stop: reachability.askedToStop,
          never_opted_in: reachability.neverOptedIn,
          reasons: reachabilityReasons(reachability),
        }
      : null,
    metrics: reachability
      ? [
          metric("reachable", "Can receive email", reachability.reachable),
          metric("unsendable", "Can't receive email", reachability.unsendable),
          metric("never_opted_in", "Never opted in", reachability.neverOptedIn),
          metric("total", "Email addresses", reachability.total),
        ]
      : [],
  };

  const rule =
    assessment.verdict === "ready"
      ? ""
      : assessment.verdict === "unknown"
        ? " Verdict: UNKNOWN. Do not say sending will work."
        : " Verdict: NOT READY. Do not say sending will work or that the user can send campaigns; give this reason.";
  return {
    success: true,
    data,
    count: 1,
    message: `${assessment.summary}${rule}`,
    error: null,
    block_type: "stat_card",
    confirmation_required: false,
    confirmation_details: null,
  };
};
