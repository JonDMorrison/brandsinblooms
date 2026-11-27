import { describe, expect, it } from "vitest";
import {
  campaignReadiness,
  campaignStage,
  partitionEmptyDrafts,
  visibleColumnsForFilter,
} from "./campaignCardModel";

describe("campaign card model", () => {
  it("names the first missing step for an email draft", () => {
    expect(campaignReadiness({ channel: "email", subjectLine: "", isEmptyDraft: true, hasAudience: false }).nextStep).toBe("Add your content");
    expect(campaignReadiness({ channel: "email", subjectLine: "", isEmptyDraft: false, hasAudience: false }).nextStep).toBe("Add a subject line");
    expect(campaignReadiness({ channel: "email", subjectLine: "Hi", isEmptyDraft: false, hasAudience: false }).nextStep).toBe("Choose who gets it");
    expect(campaignReadiness({ channel: "email", subjectLine: "Hi", isEmptyDraft: false, hasAudience: true })).toMatchObject({ ready: true, nextStep: null });
  });

  it("skips the subject step for SMS", () => {
    const readiness = campaignReadiness({ channel: "sms", subjectLine: "", isEmptyDraft: false, hasAudience: true });
    expect(readiness.steps.map((step) => step.key)).toEqual(["content", "audience"]);
    expect(readiness.ready).toBe(true);
  });

  it("maps statuses to stages", () => {
    expect(campaignStage("draft")).toBe("draft");
    expect(campaignStage("scheduled")).toBe("scheduled");
    expect(campaignStage("sending")).toBe("sending");
    expect(campaignStage("failed")).toBe("failed");
    expect(campaignStage("sent")).toBe("sent");
  });

  it("separates empty drafts from real work", () => {
    const { visible, empty } = partitionEmptyDrafts([
      { isEmptyDraft: true, name: "" },
      { isEmptyDraft: false, name: "" },
      { isEmptyDraft: true, name: "Untitled Campaign" },
    ]);
    expect(visible).toHaveLength(1);
    expect(empty).toHaveLength(2);
  });

  it("always shows a draft with a custom name, even with no subject or content", () => {
    const { visible, empty } = partitionEmptyDrafts([
      { isEmptyDraft: true, name: "Spring plans" },
      { isEmptyDraft: true, name: "Draft, Nov 27, 2026" },
      { isEmptyDraft: true, name: "  " },
    ]);
    expect(visible.map((item) => item.name)).toEqual(["Spring plans", "Draft, Nov 27, 2026"]);
    expect(empty).toHaveLength(1);
  });

  it("only shows schedule and rate columns where they mean something", () => {
    expect(visibleColumnsForFilter("draft")).toEqual({ showSchedule: false, showRates: false });
    expect(visibleColumnsForFilter("scheduled")).toEqual({ showSchedule: true, showRates: false });
    expect(visibleColumnsForFilter("sent")).toEqual({ showSchedule: false, showRates: true });
  });
});
