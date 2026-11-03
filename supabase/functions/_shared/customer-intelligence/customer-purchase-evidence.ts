import { readReportedPeriodSpending } from "../../../../src/lib/crm/reportedPeriodSpending.ts";

type PurchaseField =
  | "custom_fields"
  | "total_spent"
  | "lifetime_value"
  | "pos_total_spent"
  | "pos_order_count"
  | "first_purchase_date"
  | "last_purchase_date"
  | "order_history";

type PurchaseRecord = Partial<Record<PurchaseField, unknown>>;

function numberOrNull(value: unknown): number | null {
  const parsed = typeof value === "string" && value.trim() ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
}

function hasDate(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0 &&
    Number.isFinite(Date.parse(value));
}

/**
 * CRM purchase columns and order_history default to zero/[] before receipts
 * have been connected. Those defaults cannot establish zero spending/orders.
 * Report totals are kept in their own source period and never fill these fields.
 */
export function readCustomerPurchaseEvidence(record: PurchaseRecord) {
  const reported = readReportedPeriodSpending(record.custom_fields);
  const storedCount = numberOrNull(record.pos_order_count);
  const historyCount = Array.isArray(record.order_history) && record.order_history.length > 0
    ? record.order_history.length
    : null;
  const orderCount = storedCount !== null && Number.isInteger(storedCount) && storedCount > 0
    ? storedCount
    : historyCount;
  const hasReceiptEvidence = orderCount !== null ||
    hasDate(record.first_purchase_date) || hasDate(record.last_purchase_date);
  const recordedAmount = (value: unknown): number | null => {
    const amount = numberOrNull(value);
    // Preserve signed amounts, including returns. A zero needs an independent
    // order/date anchor because zero alone is also the database default.
    return amount === 0 && !hasReceiptEvidence ? null : amount;
  };
  const totalSpent = recordedAmount(record.total_spent);
  const posTotalSpent = recordedAmount(record.pos_total_spent);
  let lifetimeValue = recordedAmount(record.lifetime_value);
  if (lifetimeValue === 0 && [totalSpent, posTotalSpent].some(value => value !== null && value !== 0)) {
    // Some integrations populate total_spent but leave lifetime_value at its
    // default. Keep the real recorded total without inventing lifetime coverage.
    lifetimeValue = null;
  }
  const hasRecordedMetrics = hasReceiptEvidence ||
    [totalSpent, posTotalSpent, lifetimeValue].some(value => value !== null);

  return {
    total_spent: totalSpent,
    lifetime_value: lifetimeValue,
    pos_total_spent: posTotalSpent,
    order_count: orderCount,
    reported_period_spending: reported
      ? { ...reported, currency: "CAD" as const, evidence_basis: "reported_period" as const }
      : null,
    purchase_data_note: reported
      ? "Reported spending and transactions cover the stated source period only. They are not lifetime value, dated receipts or order counts. Unknown recorded metrics do not mean the customer bought nothing."
      : hasRecordedMetrics
        ? "Recorded purchase metrics cover the available records. Missing fields are unknown; they do not establish complete lifetime history."
        : "Purchase history is unknown. Default zero fields and an empty order history do not prove that the customer bought nothing.",
  };
}
