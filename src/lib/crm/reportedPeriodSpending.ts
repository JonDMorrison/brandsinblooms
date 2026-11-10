/**
 * Reported period spending imported from a POS spending report (currently IdealPOS).
 * These are report totals for a stated period. They are not lifetime value,
 * dated receipts, or an order count, and must never be presented as such.
 */
export interface ReportedPeriodSpending {
  start: string;
  end: string;
  spend: number;
  transactions: number;
  source: string | null;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function readReportedPeriodSpending(
  customFields: unknown,
): ReportedPeriodSpending | null {
  if (!customFields || typeof customFields !== "object" || Array.isArray(customFields)) {
    return null;
  }
  const report = (customFields as Record<string, unknown>).ideal_reported_ytd;
  if (!report || typeof report !== "object" || Array.isArray(report)) {
    return null;
  }
  const { start, end, spend, transactions, source } = report as Record<string, unknown>;
  if (
    typeof start !== "string" ||
    typeof end !== "string" ||
    !DATE.test(start) ||
    !DATE.test(end) ||
    start > end ||
    typeof spend !== "number" ||
    !Number.isFinite(spend) ||
    typeof transactions !== "number" ||
    !Number.isInteger(transactions) ||
    transactions < 0
  ) {
    return null;
  }
  return {
    start,
    end,
    spend,
    transactions,
    source: typeof source === "string" && source.trim() ? source.trim() : null,
  };
}

export function formatReportedCurrency(amount: number): string {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(amount);
}

/** Both Bloom tool results and customer rows carry the same report evidence. */
export function readCustomerReportedSpending(
  customer: Record<string, unknown>,
): ReportedPeriodSpending | null {
  return readReportedPeriodSpending({ ideal_reported_ytd: customer.reported_period_spending })
    ?? readReportedPeriodSpending(customer.custom_fields);
}

/** e.g. "Jan 1 – Oct 14, 2026" or "Dec 1, 2025 – Jan 31, 2026". Dates are calendar dates, not instants. */
export function formatReportedPeriod(report: Pick<ReportedPeriodSpending, "start" | "end">): string {
  const parse = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  };
  const start = parse(report.start);
  const end = parse(report.end);
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const short = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const long = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return `${sameYear ? short.format(start) : long.format(start)} – ${long.format(end)}`;
}
