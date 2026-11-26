import { describe, expect, it } from "vitest";
import {
  approvalBlocksSending,
  approvalStateMessage,
  isApprovalRequiredError,
  parseCampaignApproval,
  parseCampaignApprovalSetting,
} from "./campaignApproval";

const base = { required: true, state: "pending", fingerprint: "abc", canSubmit: true, canApprove: false, canSend: true, review: null, history: [] };

describe("campaign approval", () => {
  it("reads what the database returns", () => {
    const parsed = parseCampaignApproval({
      ...base,
      review: { id: "r1", state: "pending", isCurrentVersion: true, submittedBy: "Sam", submittedAt: "2026-11-26T10:00:00Z" },
      history: [{ event: "submitted", at: "2026-11-26T10:00:00Z", by: "Sam", detail: {} }, { bad: true }],
    });
    expect(parsed?.state).toBe("pending");
    expect(parsed?.review?.submittedBy).toBe("Sam");
    expect(parsed?.history).toHaveLength(1);
  });

  it("rejects shapes it does not understand", () => {
    expect(parseCampaignApproval(null)).toBeNull();
    expect(parseCampaignApproval({ required: true, state: "surprise" })).toBeNull();
    expect(parseCampaignApprovalSetting({})).toBeNull();
  });

  it("blocks sending for every state except approved, only when approval is on", () => {
    for (const state of ["draft", "pending", "changes_requested", "changed"]) {
      expect(approvalBlocksSending(parseCampaignApproval({ ...base, state }))).toBe(true);
    }
    expect(approvalBlocksSending(parseCampaignApproval({ ...base, state: "approved" }))).toBe(false);
    expect(approvalBlocksSending(parseCampaignApproval({ ...base, required: false, state: "not_required" }))).toBe(false);
    expect(approvalBlocksSending(null)).toBe(false);
  });

  it("explains each state in plain words", () => {
    expect(approvalStateMessage(parseCampaignApproval({ ...base, state: "changed" })!)).toContain("changed after it was reviewed");
    expect(approvalStateMessage(parseCampaignApproval({ ...base, state: "draft" })!)).toContain("needs approval");
  });

  it("recognises the database refusal", () => {
    expect(isApprovalRequiredError({ message: "Campaign approval required" })).toBe(true);
    expect(isApprovalRequiredError({ message: "Not allowed" })).toBe(false);
  });
});
