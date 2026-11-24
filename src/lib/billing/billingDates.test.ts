import { describe, expect, it } from "vitest";
import { getPlanDateDisplay, isCardExpired } from "./billingDates";

const now = new Date(2026, 10, 24); // Nov 24, 2026

describe("default card expiry", () => {
  it("treats 12/25 as expired in November 2026", () => {
    expect(isCardExpired(12, 2025, now)).toBe(true);
  });

  it("keeps a card valid through the end of its expiry month", () => {
    expect(isCardExpired(11, 2026, now)).toBe(false);
    expect(isCardExpired(11, 2026, new Date(2026, 11, 1))).toBe(true);
  });
});

describe("plan end date for monthly plans", () => {
  it("shows the next monthly renewal instead of a far-off end date", () => {
    const display = getPlanDateDisplay({
      startDate: "2025-08-31",
      endDate: "2035-08-31",
      billingInterval: "monthly",
      isTrial: false,
      now,
    });
    expect(display.label).toBe("Renews");
    expect(display.date).toEqual(new Date(2026, 10, 30)); // Nov 30 (clamped from 31)
  });

  it("shows Ends when the plan stops before the next renewal", () => {
    const display = getPlanDateDisplay({
      startDate: "2026-01-10",
      endDate: "2026-12-01",
      billingInterval: "monthly",
      isTrial: false,
      now,
    });
    expect(display).toEqual({ label: "Ends", date: new Date(2026, 11, 1) });
  });

  it("leaves annual plans and trials on their stored end date", () => {
    expect(
      getPlanDateDisplay({ startDate: "2026-01-01", endDate: "2027-01-01", billingInterval: "annual", isTrial: false, now }).label,
    ).toBe("End date");
    expect(
      getPlanDateDisplay({ startDate: "2026-11-20", endDate: "2026-11-27", billingInterval: "monthly", isTrial: true, now }).label,
    ).toBe("Trial ends");
  });
});
