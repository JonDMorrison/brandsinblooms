import {
  readCustomerReportedSpending,
  type ReportedPeriodSpending,
} from "@/lib/crm/reportedPeriodSpending";

/**
 * The single source of truth for a customer's lifetime value, order count and
 * purchase dates. Every surface (customer list, record header, Purchases tab
 * and Bloom) must read these numbers through `resolveCustomerPurchaseSummary`
 * so they never disagree.
 *
 * Source: the crm_customers rollups. POS orders are the detail behind them.
 *   lifetime value  = total_spent, else lifetime_value (imported), else none
 *   order count     = pos_order_count, else the number of order_history rows
 *   last purchase   = last_purchase_date
 *   first purchase  = first_purchase_date
 * A POS spending report (custom_fields.ideal_reported_ytd) is shown only when
 * no recorded value exists, and always labelled as a report for its period.
 */
export interface CustomerPurchaseSource {
  total_spent?: number | string | null;
  lifetime_value?: number | string | null;
  pos_order_count?: number | string | null;
  order_history?: unknown;
  last_purchase_date?: string | null;
  first_purchase_date?: string | null;
  created_at?: string | null;
  custom_fields?: unknown;
}

export interface CustomerPurchaseSummary {
  /** Recorded lifetime value, or null when nothing is recorded. */
  lifetimeValue: number | null;
  /** Recorded order count, or null when nothing is recorded. */
  orderCount: number | null;
  averageOrderValue: number | null;
  lastPurchaseDate: string | null;
  firstPurchaseDate: string | null;
  /** Only set when there is no recorded value. Never lifetime value. */
  reportedPeriod: ReportedPeriodSpending | null;
  valueSource: "total_spent" | "lifetime_value" | "reported_period" | "none";
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && !value.trim()) return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function positive(value: unknown): number | null {
  const numeric = toNumber(value);
  return numeric !== null && numeric > 0 ? numeric : null;
}

function readDate(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function resolveCustomerPurchaseSummary(
  customer: CustomerPurchaseSource | null | undefined,
): CustomerPurchaseSummary {
  if (!customer) {
    return {
      lifetimeValue: null,
      orderCount: null,
      averageOrderValue: null,
      lastPurchaseDate: null,
      firstPurchaseDate: null,
      reportedPeriod: null,
      valueSource: "none",
    };
  }

  // A recorded total_spent (including an explicit 0 or a net refund) wins; an
  // imported lifetime_value fills in only when no non-zero spend is recorded.
  const spent = toNumber(customer.total_spent);
  const imported = positive(customer.lifetime_value);
  const useImported = (spent === null || spent === 0) && imported !== null;
  const lifetimeValue = useImported ? imported : spent;
  const valueSource: CustomerPurchaseSummary["valueSource"] = useImported
    ? "lifetime_value"
    : spent !== null
      ? "total_spent"
      : "none";

  const historyCount = Array.isArray(customer.order_history)
    ? customer.order_history.length
    : null;
  const orderCount = positive(customer.pos_order_count) ?? (historyCount || null);

  const reportedPeriod =
    lifetimeValue === null || lifetimeValue === 0
      ? readCustomerReportedSpending(customer as Record<string, unknown>)
      : null;

  return {
    lifetimeValue,
    orderCount,
    averageOrderValue:
      lifetimeValue !== null && lifetimeValue > 0 && orderCount
        ? lifetimeValue / orderCount
        : null,
    lastPurchaseDate: readDate(customer.last_purchase_date),
    firstPurchaseDate: readDate(customer.first_purchase_date),
    reportedPeriod,
    valueSource: reportedPeriod ? "reported_period" : valueSource,
  };
}

const NEW_CUSTOMER_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * "New" means the customer's first purchase (or, with no purchase on file,
 * the record's creation) is within the last 30 days. A demo or imported
 * record created recently for a long-standing customer is not new.
 */
export function isNewCustomer(
  customer: Pick<CustomerPurchaseSource, "first_purchase_date" | "created_at"> | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!customer) return false;
  const anchor = readDate(customer.first_purchase_date) ?? readDate(customer.created_at);
  if (!anchor) return false;
  const time = new Date(anchor).getTime();
  if (!Number.isFinite(time)) return false;
  const age = now.getTime() - time;
  return age >= 0 && age <= NEW_CUSTOMER_WINDOW_MS;
}

/** Currency format shared by customer surfaces, e.g. $3,700.91. */
export function formatCustomerCurrency(
  amount: number | null | undefined,
  currency: string = "USD",
  locale?: string,
): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return "—";
  }
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }
}
