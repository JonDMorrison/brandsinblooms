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
    .limit(5);
  if (error) {
    throw error;
  }
  return (data ?? []) as ImportPeriodRow[];
}

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
  const seen = new Set<string>();
  const periods = facts.idealPeriods
    .filter((row) => {
      const key = `${row.report_type}|${row.source_period_start}|${row.source_period_end}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(
      (row) =>
        `${readableReportType(row.report_type)} ${row.source_period_start ?? "unknown start"} to ${row.source_period_end ?? "unknown end"}`,
    );
  const ideal =
    periods.length > 0
      ? `IdealPOS period reports imported: ${periods.join("; ")}. For spend questions use the reported-spending tools and name the period.`
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
