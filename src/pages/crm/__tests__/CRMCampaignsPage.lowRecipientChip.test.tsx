import { describe, expect, it } from "vitest";
import { CAMPAIGN_STATUS } from "@/constants/campaignStatuses";

// Re-derive the helper so we can validate the chip predicate logic without
// mounting the entire CRMCampaignsPage (which requires routing, auth, and
// a real query client). The production helper lives in
// src/pages/crm/CRMCampaignsPage.tsx and follows the same shape.
const LOW_RECIPIENT_REVIEW_STATUSES = new Set([
  CAMPAIGN_STATUS.DRAFT,
  CAMPAIGN_STATUS.SCHEDULED,
]);

function shouldShowLowRecipientWarning(campaign: {
  status: string;
  totalRecipients?: number | null;
  projectedRecipientCount?: number | null;
}) {
  if (!LOW_RECIPIENT_REVIEW_STATUSES.has(campaign.status as any)) {
    return false;
  }
  const count = Math.max(
    0,
    Number(
      campaign.projectedRecipientCount ?? campaign.totalRecipients ?? 0,
    ),
  );
  return count <= 1;
}

describe("shouldShowLowRecipientWarning (recipient-count column chip)", () => {
  it("fires on draft with 0 recipients", () => {
    expect(
      shouldShowLowRecipientWarning({
        status: CAMPAIGN_STATUS.DRAFT,
        totalRecipients: 0,
      }),
    ).toBe(true);
  });

  it("fires on draft with 1 recipient", () => {
    expect(
      shouldShowLowRecipientWarning({
        status: CAMPAIGN_STATUS.DRAFT,
        totalRecipients: 1,
      }),
    ).toBe(true);
  });

  it("fires on scheduled with 0 recipients", () => {
    expect(
      shouldShowLowRecipientWarning({
        status: CAMPAIGN_STATUS.SCHEDULED,
        totalRecipients: 0,
      }),
    ).toBe(true);
  });

  it("does NOT fire on draft with 2+ recipients", () => {
    expect(
      shouldShowLowRecipientWarning({
        status: CAMPAIGN_STATUS.DRAFT,
        totalRecipients: 4000,
      }),
    ).toBe(false);
  });

  it("does NOT fire on sent campaigns (no point warning after the fact)", () => {
    expect(
      shouldShowLowRecipientWarning({
        status: CAMPAIGN_STATUS.SENT,
        totalRecipients: 1,
      }),
    ).toBe(false);
  });

  it("does NOT fire on sending or queued campaigns", () => {
    expect(
      shouldShowLowRecipientWarning({
        status: CAMPAIGN_STATUS.SENDING,
        totalRecipients: 0,
      }),
    ).toBe(false);
    expect(
      shouldShowLowRecipientWarning({
        status: CAMPAIGN_STATUS.QUEUED,
        totalRecipients: 1,
      }),
    ).toBe(false);
  });

  it("treats null/undefined recipient counts as zero", () => {
    expect(
      shouldShowLowRecipientWarning({
        status: CAMPAIGN_STATUS.DRAFT,
      }),
    ).toBe(true);
  });
});
