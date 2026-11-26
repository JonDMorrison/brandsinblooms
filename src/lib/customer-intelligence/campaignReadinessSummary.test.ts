import { describe, expect, it } from "vitest";
import { summarizeCampaignReadiness } from "./campaignReadinessSummary";
import type { TenantAudienceHealth } from "@/hooks/useTenantAudienceHealth";

describe("West Coast campaign readiness", () => {
  const sample: TenantAudienceHealth = { total: 13, confirmed: 3, eligible: 2, suppressed: 1, pending: 5, optedOut: 4, neverOptedIn: 0 };
  it("separates contact quality from permission to send", () => {
    expect(summarizeCampaignReadiness(20, sample)).toEqual({
      activeCustomers: 20, withEmailToReview: 13, needsEmailReview: 7,
      verifiedOptIn: 2, needsConsentReview: 11,
    });
  });
  it("does not treat email existence as permission", () => {
    expect(summarizeCampaignReadiness(20, { ...sample, confirmed: 0, eligible: 0 }).verifiedOptIn).toBe(0);
  });
  it("fails closed if counts are missing or conflict", () => {
    expect(() => summarizeCampaignReadiness(10, sample)).toThrow("reconciliation");
    expect(() => summarizeCampaignReadiness(-1, sample)).toThrow("not available");
  });
});
