/**
 * Purchase lines for the insights prompt. Missing values stay "Unknown":
 * a company with no dated sales records has no order count, and that is not
 * the same as zero orders. No currency is assumed.
 */
export type PurchaseMetricsInput = {
  lifetime_value?: number | null;
  total_purchases?: number | null;
  average_order_value?: number | null;
  days_since_last_purchase?: number | null;
} | null | undefined;

const UNKNOWN = "Unknown";

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function amount(value: unknown): string {
  const number = finite(value);
  return number === null ? UNKNOWN : number.toFixed(2);
}

function whole(value: unknown): string {
  const number = finite(value);
  return number === null ? UNKNOWN : String(Math.round(number));
}

export function buildPurchaseBehaviorLines(
  metrics: PurchaseMetricsInput,
): string[] {
  return [
    `- Lifetime value: ${amount(metrics?.lifetime_value)}`,
    `- Total orders: ${whole(metrics?.total_purchases)}`,
    `- Average order value: ${amount(metrics?.average_order_value)}`,
    `- Days since last purchase: ${whole(metrics?.days_since_last_purchase)}`,
    "- Unknown means no record is on file. Never treat Unknown as zero or as proof the customer has not bought.",
  ];
}
