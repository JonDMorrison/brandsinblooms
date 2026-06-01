import { describe, expect, it } from "vitest";

// Mirrors the threshold used in:
//   src/components/crm/campaign-editor/CampaignSendConfirmation.tsx
//     (UI warning Sheet)
//   supabase/functions/send-email-campaign/index.ts
//     (forensic edge_function_errors breadcrumb)
// Keep these tests in sync if the threshold ever changes.

interface ShrinkageInput {
  currentCount: number;
  previousCount: number | null;
  /**
   * Only relevant for the backend breadcrumb. The send-time UI fires whenever
   * the ratio is below 50%; the backend breadcrumb additionally requires the
   * previous send to have been at least 100 recipients to avoid noise.
   */
  variant: "ui" | "backend";
}

function shouldWarnOnAudienceShrinkage({
  currentCount,
  previousCount,
  variant,
}: ShrinkageInput): boolean {
  if (previousCount === null || previousCount <= 0) return false;
  if (currentCount <= 0) return false;
  if (variant === "backend" && previousCount < 100) return false;
  if (variant === "backend" && currentCount <= 1) return false;
  return currentCount < previousCount * 0.5;
}

describe("audience-shrinkage warning — send-time UI", () => {
  it("fires on the Erin Minter shape (4346 → 1 — but UI excludes the count<=1 case)", () => {
    expect(
      shouldWarnOnAudienceShrinkage({
        currentCount: 1,
        previousCount: 4346,
        variant: "ui",
      }),
    ).toBe(true);
  });

  it("fires when current is just under half", () => {
    expect(
      shouldWarnOnAudienceShrinkage({
        currentCount: 49,
        previousCount: 100,
        variant: "ui",
      }),
    ).toBe(true);
  });

  it("does not fire when current is exactly half", () => {
    expect(
      shouldWarnOnAudienceShrinkage({
        currentCount: 50,
        previousCount: 100,
        variant: "ui",
      }),
    ).toBe(false);
  });

  it("does not fire when current is larger than previous", () => {
    expect(
      shouldWarnOnAudienceShrinkage({
        currentCount: 5000,
        previousCount: 4346,
        variant: "ui",
      }),
    ).toBe(false);
  });

  it("does not fire when there is no previous campaign", () => {
    expect(
      shouldWarnOnAudienceShrinkage({
        currentCount: 1,
        previousCount: null,
        variant: "ui",
      }),
    ).toBe(false);
  });
});

describe("audience-shrinkage warning — backend breadcrumb", () => {
  it("does not fire when previous count is below 100 (anti-noise floor)", () => {
    expect(
      shouldWarnOnAudienceShrinkage({
        currentCount: 1,
        previousCount: 50,
        variant: "backend",
      }),
    ).toBe(false);
  });

  it("does not fire when current count <= 1 (already covered by the low-count breadcrumb)", () => {
    expect(
      shouldWarnOnAudienceShrinkage({
        currentCount: 1,
        previousCount: 4346,
        variant: "backend",
      }),
    ).toBe(false);
  });

  it("fires when previous >= 100 and current < 50% of previous", () => {
    expect(
      shouldWarnOnAudienceShrinkage({
        currentCount: 40,
        previousCount: 100,
        variant: "backend",
      }),
    ).toBe(true);
  });

  it("fires on a representative real-world shape (1000 → 200)", () => {
    expect(
      shouldWarnOnAudienceShrinkage({
        currentCount: 200,
        previousCount: 1000,
        variant: "backend",
      }),
    ).toBe(true);
  });
});
