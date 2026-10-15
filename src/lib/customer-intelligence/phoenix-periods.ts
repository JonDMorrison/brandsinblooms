import { assertDate, localDate } from "../../../supabase/functions/_shared/customer-intelligence/purchase-exploration";

export type PhoenixPeriodPreset = "mtd" | "ytd" | "previous_month" | "previous_year" | "custom";
export interface PhoenixPeriod {
  current_start: string;
  current_end: string;
  baseline_start: string;
  baseline_end: string;
  normalizeDailyRequired: boolean;
  note: string;
}
const iso = (value: Date) => value.toISOString().slice(0, 10);
const startOfMonth = (d: string) => d.slice(0, 7) + "-01";
const addDays = (value: string, delta: number) => iso(new Date(Date.parse(value + "T00:00:00Z") + delta * 86400000));
const calendarDays = (a: string, b: string) => (Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000 + 1;
function lastYear(value: string): string {
  assertDate(value);
  const year = Number(value.slice(0, 4)) - 1;
  const old = String(year) + value.slice(4);
  // Feb 29 has no exact last-year date. Do not manufacture a visit day.
  try { assertDate(old); return old; }
  catch { if (value.slice(5) === "02-29") return String(year) + "-02-28"; throw new Error("No comparable calendar date."); }
}
export function phoenixPeriod(
  preset: PhoenixPeriodPreset,
  now: Date,
  timezone: string,
  custom?: Pick<PhoenixPeriod, "current_start" | "current_end" | "baseline_start" | "baseline_end">,
): PhoenixPeriod {
  const today = localDate(now.toISOString(), timezone);
  if (!today) throw new Error("Valid business timezone and current date are required.");
  let current_start: string, current_end: string, baseline_start: string, baseline_end: string;
  switch (preset) {
    case "mtd":
      current_start = startOfMonth(today); current_end = today;
      baseline_start = lastYear(current_start); baseline_end = lastYear(current_end);
      break;
    case "ytd":
      current_start = today.slice(0, 4) + "-01-01"; current_end = today;
      baseline_start = lastYear(current_start); baseline_end = lastYear(current_end);
      break;
    case "previous_month":
      current_end = addDays(startOfMonth(today), -1);
      current_start = startOfMonth(current_end);
      baseline_start = lastYear(current_start); baseline_end = lastYear(current_end);
      break;
    case "previous_year": {
      const year = Number(today.slice(0, 4)) - 1;
      current_start = String(year) + "-01-01";
      current_end = String(year) + "-12-31";
      baseline_start = String(year - 1) + "-01-01";
      baseline_end = String(year - 1) + "-12-31";
      break;
    }
    case "custom":
      if (!custom) throw new Error("Choose all four dates for a custom comparison.");
      ({ current_start, current_end, baseline_start, baseline_end } = custom);
      break;
    default: throw new Error("Unsupported customer-growth period.");
  }
  for (const d of [current_start, current_end, baseline_start, baseline_end]) assertDate(d);
  if (current_start > current_end || baseline_start > baseline_end || baseline_end >= current_start || current_end > today)
    throw new Error("Comparison periods must be ordered, non-overlapping and not in the future.");
  const normalizeDailyRequired = calendarDays(current_start, current_end) !== calendarDays(baseline_start, baseline_end);
  return {
    current_start, current_end, baseline_start, baseline_end, normalizeDailyRequired,
    note: normalizeDailyRequired
      ? "These periods contain different numbers of calendar days, often because of leap years. Explicit per-day normalization is required."
      : (preset === "mtd" || preset === "ytd")
        ? "Compared with the same calendar dates last year. Today is still in progress; totals may be incomplete."
        : "Exact historical date comparison; no transactions or missing days have been inferred.",
  };
}
