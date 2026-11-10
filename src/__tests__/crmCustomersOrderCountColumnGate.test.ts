import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// crm_customers has no `order_count` column. The real column is
// `pos_order_count`. PostgREST rejects filters on unknown columns, so any
// query builder filter on "order_count" breaks the query.
const FILTER_ON_ORDER_COUNT =
  /\.(?:eq|neq|gt|gte|lt|lte|in|is|not|order|filter|match)\(\s*["'`]order_count["'`]/;

const SCAN_ROOTS = ["src", "supabase/functions"];
const SOURCE_FILE = /\.(?:ts|tsx)$/;

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (entry === "node_modules") return [];
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return collectSourceFiles(path);
    return SOURCE_FILE.test(entry) ? [path] : [];
  });
}

const crmCustomersRow = (() => {
  const types = readFileSync("src/integrations/supabase/types.ts", "utf8");
  const start = types.indexOf("      crm_customers: {");
  const end = types.indexOf("        Insert: {", start);
  return types.slice(start, end);
})();

describe("crm_customers order count column", () => {
  it("uses pos_order_count as the real column", () => {
    expect(crmCustomersRow).toContain("pos_order_count: number | null;");
    expect(crmCustomersRow).not.toMatch(/^\s+order_count:/m);
  });

  it("never filters a query on the nonexistent order_count column", () => {
    const offenders = SCAN_ROOTS.flatMap(collectSourceFiles)
      .filter((file) => !file.endsWith("crmCustomersOrderCountColumnGate.test.ts"))
      .filter((file) => FILTER_ON_ORDER_COUNT.test(readFileSync(file, "utf8")));

    expect(offenders).toEqual([]);
  });

  it("filters the Frequent Buyers SMS fallback on pos_order_count", () => {
    for (const file of [
      "src/components/sms/SegmentSMSDialog.tsx",
      "src/components/sms/SendToSegmentCard.tsx",
      "supabase/functions/sms-campaign-enqueue-worker/index.ts",
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source, file).toMatch(
        /case ["']frequent-buyers["']:\s*query = query\.gte\(["']pos_order_count["'], 3\);/,
      );
    }
  });
});
