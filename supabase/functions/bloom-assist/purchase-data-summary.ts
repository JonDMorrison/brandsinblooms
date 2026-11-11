import type { PersistenceClient } from "./types.ts";

/**
 * One short context line that tells Bloom which purchase data this company
 * really has. It is built once per request, with a strict time budget, and
 * never throws: a slow or failed lookup says "not checked" instead of
 * guessing.
 */
export const PURCHASE_DATA_TIMEOUT_MS = 800;

const DATED_ORDER_TABLES = [
  "pos_orders",
  "shopify_orders",
  "lightspeed_sales",
] as const;

type ImportPeriodRow = {
  report_type: string | null;
  source_period_start: string | null;
  source_period_end: string | null;
};

export type PurchaseDataFacts = {
  hasDatedOrders: boolean;
  idealPeriods: ImportPeriodRow[];
};

async function tableHasTenantRows(
  client: PersistenceClient,
  table: string,
  tenantId: string,
): Promise<boolean> {
  const { data, error } = await client
    .from(table)
    .select("id")
    .eq("tenant_id", tenantId)
    .limit(1);
  if (error) {
    throw error;
  }
  return Array.isArray(data) && data.length > 0;
}

async function loadIdealPeriods(
  client: PersistenceClient,
  tenantId: string,
): Promise<ImportPeriodRow[]> {
  const { data, error } = await client
    .from("customer_intelligence_imports")
    .select("report_type, source_period_start, source_period_end")
    .eq("tenant_id", tenantId)
    .eq("source", "ideal")
    .eq("status", "completed")
    .not("source_period_end", "is", null)
    .order("completed_at", { ascending: false })
    .limit(IDEAL_IMPORT_SCAN_LIMIT);
  if (error) {
    throw error;
  }
  return (data ?? []) as ImportPeriodRow[];
}

/**
 * Enough rows to see every retained period. A short "most recent" window
 * hid older years as soon as new years were imported, and Bloom then said
 * those years had no data.
 */
const IDEAL_IMPORT_SCAN_LIMIT = 200;

/**
 * Journal imports keep receipt lines for review only. Bloom reads product
 * facts from the period reports, so journals are left out of this line.
 */
const REPORT_TYPES_NOT_READ_BY_BLOOM = new Set(["journal"]);

/**
 * True when the company has at least one dated order or sale on file
 * (POS, Shopify or Lightspeed). Period summary reports such as IdealPOS
 * imports are not dated orders.
 */
export async function tenantHasDatedOrderRecords(
  client: PersistenceClient,
  tenantId: string,
): Promise<boolean> {
  const flags = await Promise.all(
    DATED_ORDER_TABLES.map((table) =>
      tableHasTenantRows(client, table, tenantId),
    ),
  );
  return flags.some(Boolean);
}

export const NO_DATED_SALES_MESSAGE =
  "No dated sales records are connected for this company, so order counts, revenue and last purchase dates are unknown. This does not mean sales were zero.";

export async function loadPurchaseDataFacts(
  client: PersistenceClient,
  tenantId: string,
): Promise<PurchaseDataFacts> {
  const [hasDatedOrders, idealPeriods] = await Promise.all([
    tenantHasDatedOrderRecords(client, tenantId),
    loadIdealPeriods(client, tenantId),
  ]);
  return { hasDatedOrders, idealPeriods };
}

function readableReportType(value: string | null): string {
  return (value ?? "report").replace(/_/g, " ");
}

export function formatPurchaseDataLine(facts: PurchaseDataFacts | null): string {
  if (!facts) {
    return "Purchase data available: not checked for this request. Do not assume dated sales or spend data exists; use tools and say what they return.";
  }

  const dated = facts.hasDatedOrders
    ? "dated sales records are connected"
    : "no dated sales records are connected, so order, revenue and last-purchase tools will have nothing to show";
  // Group every retained period under its report type, oldest first, so no
  // covered year is left out of the line.
  const byType = new Map<string, Set<string>>();
  for (const row of facts.idealPeriods) {
    if (REPORT_TYPES_NOT_READ_BY_BLOOM.has(row.report_type ?? "")) continue;
    const type = readableReportType(row.report_type);
    const period = `${row.source_period_start ?? "unknown start"} to ${row.source_period_end ?? "unknown end"}`;
    if (!byType.has(type)) byType.set(type, new Set());
    byType.get(type)!.add(period);
  }
  const groups = [...byType.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, periods]) => `${type} ${[...periods].sort().join(", ")}`);
  const ideal =
    groups.length > 0
      ? `IdealPOS period reports imported: ${groups.join("; ")}. Every listed period has data: for product, buyer or spend questions about these periods, call the tools and name the period. Do not say a listed period is unavailable.`
      : "no IdealPOS period reports imported";

  return `Purchase data available: ${dated}; ${ideal}`;
}

/** Never rejects. Resolves to "not checked" if the budget runs out. */
export async function buildPurchaseDataLine(
  client: PersistenceClient,
  tenantId: string,
  timeoutMs = PURCHASE_DATA_TIMEOUT_MS,
): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });
  try {
    const facts = await Promise.race([
      loadPurchaseDataFacts(client, tenantId).catch((error: unknown) => {
        console.warn(
          "[bloom-assist] Purchase data summary unavailable",
          error instanceof Error ? error.message : String(error),
        );
        return null;
      }),
      timeout,
    ]);
    return formatPurchaseDataLine(facts);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
