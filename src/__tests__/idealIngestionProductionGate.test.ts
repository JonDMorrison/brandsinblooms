import { describe, expect, it } from "vitest";
import fs from "node:fs";
const read=(p:string)=>fs.readFileSync(p,"utf8");

describe("production Ideal ingestion",()=>{
 it("wires upload to the ingestion function and reconciliation UI",()=>{
  const wizard=read("src/components/integrations/CustomerIntelligenceSetupWizard.tsx");
  expect(wizard).toContain('accept=".xlsx,.xls,.csv,.txt"');
  expect(wizard).toContain('supabase.functions.invoke("ideal-intelligence-import"');
  expect(wizard).toContain("Process & reconcile");
  expect(wizard).toContain("accepted");
  expect(wizard).toContain("duplicates");
  expect(wizard).toContain("rejected");
 });
 it("authenticates, tenant-scopes and permission-gates ingestion",()=>{
  const fn=read("supabase/functions/ideal-intelligence-import/index.ts");
  expect(fn).toContain('auth.getUser()');
  expect(fn).toContain('select("tenant_id")');
  expect(fn).toContain('"integrations.manage"');
  expect(fn).toContain('eq("tenant_id",tenantId)');
 });
 it("uses canonical identity resolution and never changes consent",()=>{
  const fn=read("supabase/functions/ideal-intelligence-import/index.ts");
  expect(fn).toContain('resolve_crm_customer_identity');
  expect(fn).not.toContain("email_opt_in");
  expect(fn).not.toContain("sms_opt_in");
 });
 it("is idempotent at both file and row level",()=>{
  const fn=read("supabase/functions/ideal-intelligence-import/index.ts");
  const foundation=read("supabase/migrations/20260928143000_customer_intelligence_foundation.sql");
  const events=read("supabase/migrations/20260930040000_ideal_ingestion_events.sql");
  expect(fn).toContain("source_sha256");
  expect(fn).toContain('error.code==="23505"');
  expect(foundation).toContain("UNIQUE (tenant_id, source, report_type, source_sha256)");
  expect(foundation).toContain("UNIQUE (tenant_id, source, source_fingerprint)");
  expect(events).toContain("UNIQUE (tenant_id, source, source_fingerprint)");
 });
 it("supports all six report families without inventing native coupon or loyalty records",()=>{
  const adapter=read("supabase/functions/_shared/customer-intelligence/ideal-pos.ts");
  const fn=read("supabase/functions/ideal-intelligence-import/index.ts");
  for(const type of ["customer_sales","customer_sales_by_category","customer_spending","customer_points","coupons_issued","coupons_redeemed"]) expect(adapter).toContain(type);
  expect(fn).toContain("customer_intelligence_source_events");
  expect(fn).not.toContain('.from("coupons")');
  expect(fn).not.toContain('.from("loyalty_points_transactions")');
 });
 it("refreshes intelligence after accepted purchase facts",()=>{
  const fn=read("supabase/functions/ideal-intelligence-import/index.ts");
  expect(fn).toContain("recalculate_customer_intelligence_after_import");
  expect(fn).toContain("customer_intelligence_sources");
 });
});
