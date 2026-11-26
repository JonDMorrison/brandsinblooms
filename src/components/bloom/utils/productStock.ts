/**
 * Low stock for a Bloom product row. It mirrors the rule query_products
 * applies (`isLowStockProduct` in bloom-assist): an active, inventory-tracked
 * product is low when inventory_count is at or below its own
 * low_stock_threshold. A missing count or threshold means there is no rule to
 * apply, so the product is never reported low on a guessed constant.
 */
export type ProductStockLevel = {
  stock: number | null;
  threshold: number | null;
  tracked: boolean;
  isLow: boolean;
};

function readFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
}

export function readProductStockLevel(
  record: Record<string, unknown>,
): ProductStockLevel {
  const stock = readFiniteNumber(record.inventory_count);
  const threshold = readFiniteNumber(record.low_stock_threshold);
  const tracked = record.track_inventory !== false;

  if (typeof record.is_low_stock === "boolean") {
    return { stock, threshold, tracked, isLow: record.is_low_stock };
  }

  const active =
    record.status === undefined ||
    record.status === null ||
    record.status === "active";
  const isLow =
    tracked &&
    active &&
    stock !== null &&
    threshold !== null &&
    stock <= threshold;

  return { stock, threshold, tracked, isLow };
}

/** Bar fill for stock measured against the product's own threshold. */
export function stockPercentOfThreshold(
  stock: number,
  threshold: number,
): number {
  if (threshold <= 0) {
    return stock > 0 ? 100 : 0;
  }
  return Math.max(0, Math.min((stock / threshold) * 100, 100));
}
