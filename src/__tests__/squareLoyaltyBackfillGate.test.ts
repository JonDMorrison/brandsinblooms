import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const backfill = readFileSync(
  "supabase/functions/square-loyalty-backfill/index.ts",
  "utf8",
);
const config = readFileSync("supabase/config.toml", "utf8");

describe("Square loyalty backfill release gate", () => {
  it("requires a valid session and an admin role", () => {
    expect(config).toMatch(
      /\[functions\.square-loyalty-backfill\]\s*verify_jwt = true/,
    );
    expect(backfill).toContain("const supabaseAuthed = createClient(");
    expect(backfill).toContain("await supabaseAuthed.auth.getUser()");
    expect(backfill).toContain("await hasAdminRole(supabaseAdmin, user.id)");
    expect(backfill).toContain(
      'error: "Admin access required for loyalty backfill"',
    );
    expect(backfill.indexOf("await hasAdminRole")).toBeLessThan(
      backfill.indexOf('.from("square_connections")'),
    );
  });

  it("persists accounts through the service-only audited snapshot RPC", () => {
    expect(backfill).toContain("const supabaseAdmin = createClient(");
    expect(backfill).toContain('"sync_loyalty_account_snapshot"');
    expect(backfill).toContain('p_provider: "square"');
    expect(backfill).toContain('p_balance_unit: "points"');
    expect(backfill).toContain("readNonNegativeInteger(");
    expect(backfill).toContain("Square loyalty snapshot failed");
    expect(backfill).not.toContain('.from("customer_loyalty_metrics")');
  });

  it("keeps customer writes tenant-scoped and reports unmatched accounts", () => {
    expect(backfill).toContain('.eq("tenant_id", tenantId)');
    expect(backfill).toContain("loyalty_member: true");
    expect(backfill).toContain(
      "customersUnmatched: totalProcessed - totalMatched",
    );
  });
});
