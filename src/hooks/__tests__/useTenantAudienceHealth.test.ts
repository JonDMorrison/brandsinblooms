import { describe, expect, it } from "vitest";

// Pure predicate copied from the audience step UI — if the production code
// shifts this logic, this test should be updated to match. Centralising the
// threshold (10%) here in tests keeps it visible.
function shouldShowPendingConfirmationWarning(health: {
  total: number;
  pending: number;
}) {
  if (health.pending <= 0) return false;
  if (health.total <= 0) return false;
  return health.pending / health.total > 0.1;
}

describe("audience-step pending-confirmation warning predicate", () => {
  it("fires when pending is more than 10% of total", () => {
    expect(
      shouldShowPendingConfirmationWarning({ total: 100, pending: 11 }),
    ).toBe(true);
  });

  it("does not fire when pending is exactly 10% of total", () => {
    expect(
      shouldShowPendingConfirmationWarning({ total: 100, pending: 10 }),
    ).toBe(false);
  });

  it("does not fire when pending is less than 10%", () => {
    expect(
      shouldShowPendingConfirmationWarning({ total: 1000, pending: 50 }),
    ).toBe(false);
  });

  it("does not fire when pending is 0", () => {
    expect(
      shouldShowPendingConfirmationWarning({ total: 1000, pending: 0 }),
    ).toBe(false);
  });

  it("does not fire when total is 0 (avoid divide by zero)", () => {
    expect(
      shouldShowPendingConfirmationWarning({ total: 0, pending: 0 }),
    ).toBe(false);
  });

  it("fires for the Erin Minter shape (most of list pending)", () => {
    // Real-world shape: ~4,300 customers, only a handful confirmed.
    expect(
      shouldShowPendingConfirmationWarning({ total: 4346, pending: 4200 }),
    ).toBe(true);
  });
});
