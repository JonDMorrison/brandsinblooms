import { describe, expect, it } from "vitest";
import { campaignTiming } from "../campaignTiming";

describe("campaignTiming", () => {
  it("never labels a draft as sent", () => {
    const timing = campaignTiming({
      status: "draft",
      created_at: "2026-11-24T18:26:21Z",
      updated_at: "2026-11-24T18:27:00Z",
    });
    expect(timing.kind).toBe("draft");
    expect(timing.label).toMatch(/^Draft/);
    expect(timing.label).not.toMatch(/Sent/);
  });

  it("labels a sent campaign with its send date", () => {
    const timing = campaignTiming({ status: "sent", sent_at: "2026-11-02T18:58:00Z" });
    expect(timing.kind).toBe("sent");
    expect(timing.label).toMatch(/^Sent /);
  });

  it("labels a scheduled campaign as scheduled, not sent", () => {
    const timing = campaignTiming({ status: "scheduled", scheduled_at: "2026-12-01T16:00:00Z" });
    expect(timing.kind).toBe("scheduled");
    expect(timing.label).toMatch(/^Scheduled/);
  });

  it("ignores a stray sent_at on a draft", () => {
    const timing = campaignTiming({ status: "draft", sent_at: "2026-11-02T18:58:00Z" });
    expect(timing.kind).toBe("draft");
  });
});
