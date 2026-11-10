import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const migrationPath = resolve(
  root,
  "supabase/migrations/20260903044243_harden_internal_ops_and_views.sql",
);

const ignoredDirectories = new Set([
  ".git",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    if (ignoredDirectories.has(entry)) return [];

    const path = resolve(directory, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) return sourceFiles(path);

    return /\.(?:c?js|mjs|ts|tsx|sql|sh|ya?ml|json|md)$/.test(entry)
      ? [path]
      : [];
  });
}

describe("BloomSuite security release gate", () => {
  it("contains no committed JWT credentials", () => {
    const jwt = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;
    const offenders = sourceFiles(root)
      .filter((path) => path !== import.meta.filename)
      .filter((path) => jwt.test(readFileSync(path, "utf8")))
      .map((path) => path.slice(root.length + 1));

    expect(offenders).toEqual([]);
  });

  it("locks internal operational tables to the service role", () => {
    const sql = readFileSync(migrationPath, "utf8");
    const tables = [
      "provider_rate_limits",
      "idempotency_log",
      "edge_function_errors",
      "reconciliation_log",
      "health_scores",
      "email_queue_html",
    ];

    for (const table of tables) {
      expect(sql).toContain(
        `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`,
      );
      expect(sql).toContain(
        `REVOKE ALL ON TABLE public.${table} FROM anon, authenticated;`,
      );
      expect(sql).toContain(
        `GRANT ALL ON TABLE public.${table} TO service_role;`,
      );
    }
  });

  it("makes tenant views obey underlying RLS", () => {
    const sql = readFileSync(migrationPath, "utf8");
    const views = [
      "admin_tenant_overview",
      "content_library_view",
      "customer_360_enriched",
      "deliverability_summary_30d",
      "email_domain_stats_30d",
    ];

    for (const view of views) {
      expect(sql).toContain(
        `ALTER VIEW public.${view} SET (security_invoker = true);`,
      );
    }
  });

  it("uses the guarded tenant RPC instead of exposing the admin view", () => {
    const dashboard = readFileSync(
      resolve(root, "src/pages/admin/AdminDashboard.tsx"),
      "utf8",
    );

    expect(dashboard).toContain('.rpc("admin_list_tenants"');
    expect(dashboard).not.toContain('.from("admin_tenant_overview")');
  });
});
