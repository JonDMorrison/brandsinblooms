import { describe, expect, it } from "vitest";
import { phoenixPeriod } from "../phoenix-periods";
import { defaultGrowthDates } from "../presentation";

describe("Operation Phoenix — exact business calendar comparisons", () => {
  const now = new Date("2026-10-15T20:00:00Z");
  it("defaults to month-to-date versus identical dates last year", () => {
    expect(defaultGrowthDates(now)).toEqual({current_start:"2026-10-01",current_end:"2026-10-15",baseline_start:"2025-10-01",baseline_end:"2025-10-15"});
    expect(phoenixPeriod("mtd",now,"America/Vancouver").normalizeDailyRequired).toBe(false);
  });
  it("uses business-local date at a midnight UTC boundary", () => {
    const p=phoenixPeriod("mtd",new Date("2026-10-16T03:00:00Z"),"America/Vancouver");
    expect(p.current_end).toBe("2026-10-15");
  });
  it("year-to-date is through the same date, not all of last year", () => {
    expect(phoenixPeriod("ytd",now,"America/Vancouver")).toMatchObject({current_start:"2026-01-01",current_end:"2026-10-15",baseline_start:"2025-01-01",baseline_end:"2025-10-15"});
  });
  it("previous month is complete, with exact prior-year month", () => {
    expect(phoenixPeriod("previous_month",now,"America/Vancouver")).toMatchObject({current_start:"2026-09-01",current_end:"2026-09-30",baseline_start:"2025-09-01",baseline_end:"2025-09-30"});
  });
  it("marks leap-day mismatches explicitly", () => {
    const p=phoenixPeriod("mtd",new Date("2024-02-29T20:00:00Z"),"America/Vancouver");
    expect(p.baseline_end).toBe("2023-02-28");
    expect(p.normalizeDailyRequired).toBe(true);
    expect(p.note).toContain("Explicit");
  });
  it("does not silently shorten unequal-length calendar years", () => {
    expect(phoenixPeriod("previous_year",new Date("2025-10-15T20:00:00Z"),"America/Vancouver").normalizeDailyRequired).toBe(true);
  });
  it("rejects imaginary dates, overlaps and future periods", () => {
    const p={current_start:"2026-10-01",current_end:"2026-10-15",baseline_start:"2025-10-01",baseline_end:"2025-10-15"};
    expect(()=>phoenixPeriod("custom",now,"America/Vancouver",{...p,current_start:"2026-02-30"})).toThrow();
    expect(()=>phoenixPeriod("custom",now,"America/Vancouver",{...p,baseline_end:"2026-10-03"})).toThrow();
    expect(()=>phoenixPeriod("custom",now,"America/Vancouver",{...p,current_end:"2026-10-20"})).toThrow();
  });
});
