import type { TenantAudienceHealth } from "@/hooks/useTenantAudienceHealth";

export type CampaignReadinessSummary = {
  activeCustomers: number;
  withEmailToReview: number;
  needsEmailReview: number;
  verifiedOptIn: number;
  needsConsentReview: number;
};

/**
 * Display only. The send-time checks remain the final authority for consent,
 * suppressions, domain validation and individual recipient eligibility.
 */
export function summarizeCampaignReadiness(
  activeCustomers: number,
  health: TenantAudienceHealth,
): CampaignReadinessSummary {
  if (!Number.isSafeInteger(activeCustomers) || activeCustomers < 0)
    throw Error("Customer count is not available.");
  for (const count of [health.total, health.confirmed, health.eligible, health.suppressed]) {
    if (!Number.isSafeInteger(count) || count < 0)
      throw Error("Email readiness count is not available.");
  }
  if (health.total > activeCustomers || health.eligible > health.confirmed ||
      health.confirmed > health.total)
    throw Error("Email readiness counts need reconciliation.");
  return {
    activeCustomers,
    withEmailToReview: health.total,
    needsEmailReview: activeCustomers - health.total,
    verifiedOptIn: health.eligible,
    needsConsentReview: Math.max(0, health.total - health.eligible),
  };
}
