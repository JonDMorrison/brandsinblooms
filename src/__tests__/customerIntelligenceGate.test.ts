import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const read=(p:string)=>fs.readFileSync(path.join(root,p),"utf8");

describe("customer intelligence foundation",()=>{
  it("keeps imports and line items idempotent and tenant secured",()=>{
    const sql=read("supabase/migrations/20260928143000_customer_intelligence_foundation.sql");
    expect(sql).toContain("UNIQUE (tenant_id, source, report_type, source_sha256)");
    expect(sql).toContain("UNIQUE (tenant_id, source, source_fingerprint)");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("security_invoker = true");
    expect(sql).toContain("Explicit comparable periods are required");
  });
  it("supports the six West Coast Gardens Ideal report families",()=>{
    const adapter=read("supabase/functions/_shared/customer-intelligence/ideal-pos.ts");
    for(const type of ["customer_sales","customer_sales_by_category","customer_spending","customer_points","coupons_issued","coupons_redeemed"]){
      expect(adapter).toContain(`"${type}"`);
    }
    expect(adapter).toContain("stableIdealFingerprint");
  });
  it("exposes explainable intelligence through Bloom",()=>{
    const registry=read("supabase/functions/bloom-assist/tools/registry.ts");
    const executor=read("supabase/functions/bloom-assist/tools/executor.ts");
    const implementation=read("supabase/functions/_shared/customer-intelligence/customer-ranking.ts");
    expect(registry).toContain('name: "rank_customers_by_intelligence"');
    expect(registry).toContain('name: "find_customer_opportunities"');
    expect(executor).toContain("rankCustomersByIntelligence");
    expect(executor).toContain("findCustomerOpportunities");
    expect(implementation).toContain("components");
    expect(implementation).toContain("source_values");
    expect(implementation).toContain("weights");
  });
});
