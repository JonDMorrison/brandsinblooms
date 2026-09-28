export const IDEAL_REPORT_TYPES = [
  "customer_sales",
  "customer_sales_by_category",
  "customer_spending",
  "customer_points",
  "coupons_issued",
  "coupons_redeemed",
] as const;

export type IdealReportType = (typeof IDEAL_REPORT_TYPES)[number];

export type IdealNormalizedRow = {
  reportType: IdealReportType;
  customerCode: string | null;
  customerName: string | null;
  transactionId: string | null;
  lineId: string | null;
  productCode: string | null;
  productName: string | null;
  salesCategory: string | null;
  department: string | null;
  quantity: number;
  amount: number;
  purchasedAt: string | null;
  couponCode: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  redeemedAt: string | null;
  pointsDelta: number | null;
  raw: Record<string, unknown>;
};

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
const value = (row: Record<string, unknown>, names: string[]) => {
  const entries = Object.entries(row);
  for (const name of names) {
    const wanted = norm(name);
    const found = entries.find(([key]) => norm(key) === wanted);
    if (found && String(found[1] ?? "").trim()) return String(found[1]).trim();
  }
  return null;
};
const num = (v: string | null) => {
  if (!v) return 0;
  const n = Number(v.replace(/[$,%\s,]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export function detectIdealReportType(headers: string[]): IdealReportType | null {
  const h = headers.map(norm).join("|");
  if (h.includes("coupon") && h.includes("redeem")) return "coupons_redeemed";
  if (h.includes("coupon") && (h.includes("issue") || h.includes("valid"))) return "coupons_issued";
  if (h.includes("point")) return "customer_points";
  if (h.includes("average") && h.includes("spend")) return "customer_spending";
  if (h.includes("sales category")) return "customer_sales_by_category";
  if (h.includes("customer") && (h.includes("department") || h.includes("quantity"))) return "customer_sales";
  return null;
}

export function normalizeIdealRow(
  reportType: IdealReportType,
  row: Record<string, unknown>,
): IdealNormalizedRow {
  const customerCode = value(row, ["customer code","customer #","customer number","code"]);
  const customerName = value(row, ["customer name","name"]);
  const transactionId = value(row, ["transaction","transaction id","invoice","receipt","sale number"]);
  const productCode = value(row, ["stock code","product code","sku","item number","item no"]);
  const productName = value(row, ["product","product name","description","item description"]);
  const salesCategory = value(row, ["sales category","category"]);
  const department = value(row, ["department","dept"]);
  const quantity = num(value(row, ["quantity bought","quantity","qty"]));
  const amount = num(value(row, ["dollar amount bought","amount","sales","net sales","spending"]));

  return {
    reportType, customerCode, customerName, transactionId,
    lineId: value(row, ["line id","line number"]),
    productCode, productName, salesCategory, department, quantity, amount,
    purchasedAt: value(row, ["transaction date","sale date","purchase date","date"]),
    couponCode: value(row, ["coupon","coupon code","code"]),
    issuedAt: value(row, ["issued date","issue date"]),
    expiresAt: value(row, ["expiry date","expiration date","valid until"]),
    redeemedAt: value(row, ["redeemed date","redemption date"]),
    pointsDelta: reportType === "customer_points"
      ? num(value(row, ["points","points change","points amount"])) : null,
    raw: row,
  };
}

export function stableIdealFingerprint(row: IdealNormalizedRow): string {
  // This canonical payload is hashed by the server ingestion boundary with SHA-256.
  // Never use row position: re-exported reports can reorder rows.
  return JSON.stringify([
    row.reportType,row.customerCode,row.transactionId,row.lineId,row.productCode,
    row.productName,row.salesCategory,row.department,row.quantity,row.amount,
    row.purchasedAt,row.couponCode,row.issuedAt,row.redeemedAt,
  ]);
}
