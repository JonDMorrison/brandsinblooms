import {assert, assertEquals, assertStringIncludes} from "@std/assert";
import {findDiagnosticAccount, formatIntegrationEvidence, isIntegrationDiagnosticQuestion} from "./integration-diagnostics.ts";

const siteId = "f599e50e-4245-43d2-954c-e5b05777ec22";
const accounts = [
  {id:"a1",name:"Lacoste Garden Centre",links:[{product:"cms",external_id:siteId}]},
  {id:"a2",name:"Lacoste Garden Centre",links:[{product:"crm",external_id:"ac48dc66-51ba-44da-bcbc-b97a90e0729b"}]},
  {id:"a3",name:"West Coast Gardens",links:[{product:"cms",external_id:"11111111-1111-4111-8111-111111111111"}]},
];
Deno.test("recognizes explicit read-only diagnostics, not generic project questions",()=>{
 assert(isIntegrationDiagnosticQuestion("Verify Lacoste's CounterPoint and OPD integration work"));
 assert(isIntegrationDiagnosticQuestion("Check integrations for Lacoste"));
 assertEquals(isIntegrationDiagnosticQuestion("What major projects are we working on?"),false);
 assertEquals(isIntegrationDiagnosticQuestion("Fix Lacoste's products and send emails"),false);
});
Deno.test("matches one authorized CMS-linked account, never an unrelated CRM account",()=>{
 const target=findDiagnosticAccount("Verify Lacoste's CounterPoint and OPD sync", accounts);
 assertEquals(target?.siteId,siteId);
 assertEquals(target?.account.id,"a1");
 assertEquals(findDiagnosticAccount("Verify CounterPoint integration",accounts),null);
});
Deno.test("refuses ambiguous site links",()=>{
 const sameSiteAccounts=[accounts[0],{id:"b",name:"Lacoste Wholesale",links:[{product:"cms",external_id:"22222222-2222-4222-8222-222222222222"}]}];
 assertEquals(findDiagnosticAccount("Verify Lacoste integration",sameSiteAccounts),null);
});
Deno.test("truthful diagnosis separates receipt, catalogue failure, and imported OPD data",()=>{
 const text=formatIntegrationEvidence("Lacoste Garden Centre",{
  assessment:"needs_attention",
  counterpoint:{configured:true,connection_status:"active",connection_health:"healthy",
    last_success_at:"2026-11-08T13:11:15Z",catalogue_sync_status:"failed",recent_batches:[{status:"staged"}]},
  opd:{enabled:true,imported_links:3793,approved_links:3341,failed_links:0,latest_link_update_at:"2026-10-29T20:43:32Z"}
 });
 assertStringIncludes(text,"Needs attention");
 assertStringIncludes(text,"Catalogue synchronization: failed");
 assertStringIncludes(text,"3,793".replace(",","")); // raw integer, not an invented metric
 assertStringIncludes(text,"Staged is not proof of import");
 assertStringIncludes(text,"No settings, orders");
});
Deno.test("provider errors, hidden account fields and arbitrary markup never appear",()=>{
 const text=formatIntegrationEvidence("<@U123> customer@example.com",{
  assessment:"not_fully_verified",
  counterpoint:{configured:true,connection_status:"active",connection_health:"healthy",
     catalogue_sync_status:"completed",last_success_at:"invalid",
     recent_batches:[{status:"staged",error_code:"private-key-something",raw_customer_email:"x@test.com"}]},
  opd:{enabled:true,imported_links:0,approved_links:0,failed_links:0,secret:"sk_live_exposed"}
 });
 assertEquals(text.includes("<@U123>"),false);
 assertEquals(text.includes("sk_live"),false);
 assertEquals(text.includes("x@test.com"),false);
 assertStringIncludes(text,"Not fully verified");
});
