import { describe,expect,it } from "vitest";
import { calculateSuiteEstimate as estimate,DEFAULT_SUITE_CONFIGURATION as defaults,suiteEstimateSummary } from "./suiteEstimate";
describe("proposed modular suite pricing",()=>{
 it("charges $99 for any one, $198 for two, $250 for all three",()=>{
  for(const key of ["site","pos","crm"] as const)expect(estimate({...defaults,site:false,pos:false,crm:false,[key]:true}).bloom).toBe(9900);
  expect(estimate({...defaults,pos:false}).bloom).toBe(19800);expect(estimate(defaults).bloom).toBe(25000);expect(estimate(defaults).discount).toBe(4700);
 });
 it("meters email and SMS independently and counts actual segments",()=>{
  const e=estimate({...defaults,emails:40000,sms:2000,segments:2});expect(e.email).toBe(6000);expect(e.sms).toBe(18000);expect(e.bloom).toBe(49000);
  expect(estimate({...defaults,emails:20001}).email).toBe(0);expect(estimate({...defaults,emails:20010}).email).toBe(3);
  expect(estimate({...defaults,crm:false,emails:500000,sms:500000}).bloom).toBe(19800);
 });
 it("prices extra locations, registers, websites and eligible commerce once",()=>{
  const e=estimate({...defaults,locations:2,registers:2,websites:2,onlineSales:20000,advancedAi:true});
  expect(e.software).toBe(51500);expect(e.commerce).toBe(10000);expect(e.bloom).toBe(61500);
 });
 it("does not charge disabled products and bounds invalid inputs",()=>{
  expect(estimate({...defaults,site:false,pos:false,crm:false,websites:20,locations:100,registers:20,onlineSales:100000,sms:10000,advancedAi:true}).bloom).toBe(0);
  const e=estimate({...defaults,emails:NaN,locations:Infinity,sms:-1});expect(Number.isFinite(e.bloom)).toBe(true);expect(e.c.locations).toBe(1);expect(e.c.sms).toBe(0);
 });
 it("flags high-volume quotes and exports an editable nonbinding inquiry",()=>{
  expect(estimate({...defaults,emails:250001}).quoteRequired).toBe(true);
  const s=suiteEstimateSummary({...defaults,locations:100,registers:20,sms:10000000,segments:10});expect(s).toContain("not a purchase");expect(s).toContain("suite-preview-2026-11-25-v2");expect(s.length).toBeLessThan(900);
 });
});