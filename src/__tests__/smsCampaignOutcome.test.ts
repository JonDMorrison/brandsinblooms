import { describe, expect, it } from "vitest";
import { resolveSmsEnqueueOutcome } from "../../supabase/functions/_shared/smsCampaignOutcome";

describe("resolveSmsEnqueueOutcome", () => {
  it("fails a completed campaign with no eligible recipients", () => {
    expect(resolveSmsEnqueueOutcome({
      existingTotal: 0,
      messagesCreated: 0,
      hasMoreCustomers: false,
    })).toMatchObject({
      success: false,
      code: "NO_ELIGIBLE_RECIPIENTS",
      enqueueStatus: "failed",
      campaignStatus: "failed",
      totalEnqueued: 0,
    });
  });

  it("keeps a paginated campaign active with a cumulative count", () => {
    expect(resolveSmsEnqueueOutcome({
      existingTotal: 100,
      messagesCreated: 250,
      hasMoreCustomers: true,
    })).toMatchObject({
      success: true,
      enqueueStatus: "enqueuing",
      campaignStatus: null,
      totalEnqueued: 350,
    });
  });

  it("moves a populated completed campaign to sending", () => {
    expect(resolveSmsEnqueueOutcome({
      existingTotal: 100,
      messagesCreated: 25,
      hasMoreCustomers: false,
    })).toMatchObject({
      success: true,
      enqueueStatus: "enqueued",
      campaignStatus: "sending",
      totalEnqueued: 125,
    });
  });
});
