import { detectIdealReportType, normalizeIdealRow, type IdealReportType, type IdealNormalizedRow } from "./ideal-pos.ts";

const verifiedTimestamp = (v: string): boolean =>
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(v)
  && Number.isFinite(Date.parse(v));
const money = (v: unknown): number | null => {
  if (v===null || v===undefined || String(v).trim()==="") return null;
  let text = String(v).trim();
  const negative = /^\(.*\)$/.test(text);
  if (negative) text = text.slice(1,-1);
  if (!/^-?\$?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?$|^-?\$?\d+(?:\.\d{1,2})?$/.test(text)) return null;
  const n = Number(text.replace(/[$,]/g,""));
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
};
/** Fallback only. A filename is never sufficient to authorize a write. */
export function idealReportHint(filename: string): IdealReportType | null {
  const file = filename.toLowerCase().replace(/\.xls[x]?$/,"").trim();
  if (file.includes("coupon") && file.includes("redeem")) return "coupons_redeemed";
  if (file.includes("coupon") && file.includes("issu")) return "coupons_issued";
  if (file.includes("customer points")) return "customer_points";
  if (file.includes("customer spending")) return "customer_spending";
  if (file.includes("customer sales") && (file.includes("sales cat") || file.includes("category"))) return "customer_sales_by_category";
  if (file.includes("customer sales")) return "customer_sales";
  return null;
}
const cell = (row: Record<string,unknown>, key: string) => String(row[key] ?? "").trim();
/**
 * Crystal Reports prints section headings as rows. This uses the customer's documented
 * original B/C/H/J layout, not arbitrary positional shifting. A grouped row is a category
 * aggregate, NEVER a dated receipt or a proven individual visit.
 */
export function transformIdealCrystalSales(rows: Record<string,unknown>[]): { rows: Record<string,unknown>[]; unknownRows: number; groupHeaders: number } {
  let customerCode = "", customerName = "", salesCategory = "";
  let unknownRows=0,groupHeaders=0;
  const output:Record<string,unknown>[]=[];
  for (let i=0; i<rows.length; i++) {
    const row=rows[i], b=cell(row,"B"), c=cell(row,"C");
    const customer=/^Customer\s+([A-Za-z0-9_-]+)\s+-\s+(.+)$/i.exec(b);
    if (customer) { customerCode=customer[1]; customerName=customer[2].trim(); salesCategory=""; groupHeaders++; continue; }
    const category=/^Sales\s+Category\s+\d+\s+(.+)$/i.exec(b);
    if (category) { salesCategory=category[1].trim(); groupHeaders++; continue; }
    if (!b || !c || /\b(total|subtotal|grand total)\b/i.test(b+" "+c)) { unknownRows++; continue; }
    const quantity=money(row.H),amount=money(row.J);
    if (!customerCode || !salesCategory || quantity===null || amount===null || !Number.isInteger(quantity)) {unknownRows++;continue;}
    output.push({"Customer Code":customerCode,"Customer Name":customerName,"Sales Category":salesCategory,
      "Department":c,"Quantity Bought":quantity,"Dollar Amount Bought":amount,
      "__sourceRow":i+1,"__reportShape":"crystal_grouped_category_summary", "__raw":row});
  }
  return { rows:output,unknownRows,groupHeaders };
}
export interface IdealRowReview {
  accepted: number; rejected: number; unlinked: number; missingDatedTransactions: number;
  errors: string[]; canMeasureVisits: boolean; duplicateFilePrevented: boolean;
  sourceType: IdealReportType; sourceRows: number;
  /** Cannot establish an exclusive transaction set when all rows are grouped aggregates. */
  reportIsAggregate: boolean;
}
export function assessIdealRows(reportType: IdealReportType, rows: Record<string,unknown>[]): IdealRowReview {
  const errors:string[]=[];
  let accepted=0,rejected=0,unlinked=0,missingDatedTransactions=0;
  const aggregate = ["customer_sales_by_category","customer_spending"].includes(reportType)
    || rows.some(row=>row.__reportShape==="crystal_grouped_category_summary");
  for (let i=0;i<rows.length;i++) {
    const r=normalizeIdealRow(reportType,rows[i]);
    const index = typeof rows[i].__sourceRow === "number" ? rows[i].__sourceRow : i+2;
    const problems:string[]=[];
    if (!r.customerCode || !/^[A-Za-z0-9_-]{1,80}$/.test(r.customerCode)) { unlinked++; problems.push("Customer Code absent or invalid"); }
    if (reportType==="customer_sales" || reportType==="customer_sales_by_category") {
      if (!r.department && !r.productCode) problems.push("No department or product code");
      if (r.quantity===null) problems.push("Quantity missing or invalid");
      if (r.amount===null) problems.push("Sales amount missing or invalid");
      if (!r.transactionId || !r.purchasedAt) missingDatedTransactions++;
      if (reportType==="customer_sales" && r.transactionId && !r.lineId) problems.push("Unique transaction line ID missing; re-imports could double-count corrected sales");
      if ((r.transactionId && !r.purchasedAt) || (!r.transactionId && r.purchasedAt)) problems.push("Transaction/date pair incomplete");
      if (r.purchasedAt && !verifiedTimestamp(r.purchasedAt)) problems.push("Transaction timestamp must include a verified timezone offset; a calendar date is not an exact purchase timestamp");
    } else if (reportType==="customer_spending") {
      if (r.amount===null) problems.push("Spending missing or invalid");
    } else if (reportType==="customer_points") {
      if (r.pointsDelta===null) problems.push("Points missing or invalid");
    } else {
      if (!r.couponCode) problems.push("Coupon identifier missing");
      if (reportType==="coupons_issued" && !r.issuedAt) problems.push("Issue date missing");
      if (reportType==="coupons_issued" && r.issuedAt && !verifiedTimestamp(r.issuedAt)) problems.push("Coupon issue timestamp requires a verified timezone offset");
      if (reportType==="coupons_redeemed" && !r.redeemedAt) problems.push("Redemption date missing");
      if (reportType==="coupons_redeemed" && r.redeemedAt && !verifiedTimestamp(r.redeemedAt)) problems.push("Coupon redemption timestamp requires a verified timezone offset");
    }
    if (problems.length) { rejected++; if(errors.length<50) errors.push("Source row "+index+": "+problems.join("; ")); }
    else accepted++;
  }
  return {accepted,rejected,unlinked,missingDatedTransactions,errors,
    canMeasureVisits:!aggregate && accepted>0 && missingDatedTransactions===0 && rejected===0 && reportType==="customer_sales",
    duplicateFilePrevented:true,sourceType:reportType,sourceRows:rows.length,reportIsAggregate:aggregate};
}
export function inspectIdealSource(filename: string, headers: string[], rows: Record<string,unknown>[]) {
  const sourceType=detectIdealReportType(headers) || idealReportHint(filename);
  if (!sourceType) throw new Error("Cannot identify this Ideal report; choose a documented mapping instead of guessing.");
  const isCrystal = sourceType==="customer_sales" || sourceType==="customer_sales_by_category";
  const crystal = isCrystal && rows.some(r=>/^Customer\s+\S+\s+-\s+/i.test(cell(r,"B")))
    ? transformIdealCrystalSales(rows) : null;
  const review=assessIdealRows(sourceType,crystal?.rows??rows);
  return {review, normalizedRows:crystal?.rows??rows,
    notices: [
      ...(crystal?["Crystal Reports B/C/H/J grouping recognized using West Coast Gardens' documented transformation. Headers and excluded source rows remain separate."]:[]),
      ...(review.missingDatedTransactions>0?["No visit or CGI counts may be inferred from undated summary rows. Obtain distinct dated transactions before measuring visit frequency."]:[]),
      ...(review.reportIsAggregate?["This report contains grouped totals. Cross-report totals must be reconciled without counting the same sales twice."]:[]),
      ...(review.rejected?["Rows with missing values are flagged, never quietly treated as zeros."]:[]),
    ],
    originalRowCount:rows.length, untransformedRows:crystal?.unknownRows??0,groupHeaders:crystal?.groupHeaders??0};
}
