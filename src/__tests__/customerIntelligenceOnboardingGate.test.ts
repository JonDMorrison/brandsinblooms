import { describe, expect, it } from "vitest";
import fs from "node:fs";
const read=(p:string)=>fs.readFileSync(p,"utf8");

describe("Customer Intelligence onboarding",()=>{
 it("reuses the existing POS integrations page",()=>{
  const page=read("src/pages/integrations/POSIntegrationsPage.tsx");
  expect(page).toContain("CustomerIntelligenceSetupWizard");
  expect(page).toContain("IntegrationCategoryLanding");
 });
 it("supports native, connected, Ideal API, and Ideal import paths",()=>{
  const wizard=read("src/components/integrations/CustomerIntelligenceSetupWizard.tsx");
  for(const source of ["bloomsuite-pos","connected-pos","ideal-api","ideal-import"]) expect(wizard).toContain(source);
  expect(wizard).toContain("six Ideal report families");
  expect(wizard).toContain("Deduplicate transactions");
 });
 it("adds Ideal to the existing integration catalog",()=>{
  const config=read("src/components/integrations/integrationsHubConfig.ts");
  expect(config).toContain('slug: "ideal"');
  expect(config).toContain("Customers + Sales + Loyalty + Coupons");
 });
 it("persists source health without replacing existing integration connections",()=>{
  const sql=read("supabase/migrations/20260929113000_customer_intelligence_sources.sql");
  expect(sql).toContain("provider_connection_id");
  expect(sql).toContain("customer_intelligence_imports");
  expect(sql).toContain("customer_intelligence_source_health");
 });
});
