import { describe, expect, it } from "vitest";
import fs from "node:fs";

const read=(p:string)=>fs.readFileSync(p,"utf8");

describe("premium customer intelligence",()=>{
 it("ships an opportunity-first Intelligence home",()=>{
  const page=read("src/pages/crm/CustomerIntelligencePage.tsx");
  expect(page).toContain("Know what your customers are telling you");
  expect(page).toContain("Opportunities worth your attention");
  expect(page).toContain("Ask Bloom what matters");
  expect(page).toContain("Historical value at risk");
 });
 it("makes Bloom proactive and grounded in customer intelligence",()=>{
  const generator=read("supabase/functions/bloom-insights-generator/generators/customer-intelligence.ts");
  const index=read("supabase/functions/bloom-insights-generator/index.ts");
  expect(generator).toContain("customer_purchase_intelligence");
  expect(generator).toContain("not an AI guess");
  expect(generator).toContain("actionPrompt");
  expect(index).toContain("customer-intelligence");
 });
 it("adds Customer Story and intelligence to Ask Bloom context",()=>{
  const story=read("src/components/crm/customer-dashboard/CustomerIntelligenceStory.tsx");
  const dashboard=read("src/pages/crm/CustomerDashboardPage.tsx");
  const context=read("src/utils/askBloomContextBuilders.ts");
  expect(story).toContain("Customer story");
  expect(story).toContain("Ask Bloom why");
  expect(dashboard).toContain("CustomerIntelligenceStory");
  expect(context).toContain("Purchase Momentum");
  expect(context).toContain("Category Spend");
  expect(context).toContain("Department Spend");
 });
});
