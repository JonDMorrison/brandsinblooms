import {assert,assertEquals,assertStringIncludes} from "@std/assert";
import {actionableAlertMessage} from "./actionable-alerts.ts";

const westCoast={
 id:"79b917c5-6fd8-4f74-a2cd-4149a1b7fb85",number:1022,
 account:{name:"West Coast Gardens"},product:"crm",
 subject:"Sea Soil and saved audience search issues",summary:"Sea Soil search and saved audience searches need verification.",
 status:"working",automation:"paused",executor:"person",owner:{name:"Jon"},
 next_action:"Verify the Sea Soil and saved audience searches before contacting the customer.",
 resolution_verified:false,
};
const lacoste={
 ...westCoast,id:"5824687d-ae36-4c5a-952e-75aca2ca51dd",number:1020,
 account:{name:"Lacoste Garden Centre"},
 subject:"Pottery and missing bulk photos",
 summary:"The pottery collection is visible, but nine bulk product photos still need review.",
 next_action:"Review the source of the nine photos and verify the affected pages.",
};
const northfield={
 ...westCoast,id:"8a22a890-0df9-4b36-983d-b0340ff41d91",number:1026,
 account:{name:"Northfield Garden Center"},
 subject:"TEST: Calendar export issue",summary:"Calendar export is failing with emojis at line breaks.",
 status:"needs_owner",next_action:"Review the stopped repair and choose the next step.",
};

Deno.test("hourly failed Slack notifications do not create another system emergency",()=>{
 assertEquals(actionableAlertMessage("alert.dead_jobs",{
   actionable:false,reason:"slack_delivery_failures_only",kind:"dead_jobs",count:0,
 }),null);
 assertEquals(actionableAlertMessage("alert.dead_jobs",{
   actionable:true,kind:"dead_jobs",count:0,groups:[],
 }),null);
});
Deno.test("genuine stopped tasks receive an exact explanation and a recovery action",()=>{
 const msg=actionableAlertMessage("alert.dead_jobs",{
  actionable:true,kind:"dead_jobs",count:3,
  groups:[{type:"send_email",count:2},{type:"investigate",count:1}],
 });
 assert(msg);
 assertStringIncludes(msg,"3 tasks");
 assertStringIncludes(msg,"2 email deliveries");
 assertStringIncludes(msg,"1 bug investigations");
 assertStringIncludes(msg,"Automatic retries have stopped");
 assertStringIncludes(msg,"Review failed tasks");
 assertEquals(msg.includes("A system needs attention"),false);
});
Deno.test("West Coast escalation names the client, underlying problem, owner and next step",()=>{
 const msg=actionableAlertMessage("escalation.overdue",{
  actionable:true,kind:"escalation.overdue",ticket_id:westCoast.id,
  escalation_reason:"engineering_start_requested",escalation_status:"open",
 },westCoast);
 assert(msg);
 assertStringIncludes(msg,"West Coast Gardens");
 assertStringIncludes(msg,"#1022");
 assertStringIncludes(msg,"Sea Soil");
 assertStringIncludes(msg,"starting a repair is overdue");
 assertStringIncludes(msg,"Jon");
 assertStringIncludes(msg,"Verify the Sea Soil");
 assertStringIncludes(msg,"Not confirmed");
 assertEquals(msg.includes("An escalation needs attention"),false);
});
Deno.test("Lacoste acknowledged escalation is not reported as unowned or new",()=>{
 const msg=actionableAlertMessage("escalation.overdue",{
  actionable:true,kind:"escalation.overdue",ticket_id:lacoste.id,
  escalation_reason:"engineering_escalated",escalation_status:"acknowledged",
 },lacoste);
 assert(msg);
 assertStringIncludes(msg,"Lacoste Garden Centre");
 assertStringIncludes(msg,"nine bulk product photos");
 assertStringIncludes(msg,"already acknowledged");
 assertStringIncludes(msg,"Review the source");
});
Deno.test("inferred Northfield engineering issue has an accurate client and required decision",()=>{
 const msg=actionableAlertMessage("engineering.escalated",{
  actionable:true,kind:"engineering_escalated",ticket_id:northfield.id,
 },northfield);
 assert(msg);
 assertStringIncludes(msg,"Northfield Garden Center");
 assertStringIncludes(msg,"repair was stopped");
 assertStringIncludes(msg,"#1026");
 assertStringIncludes(msg,"Review the stopped repair");
});
Deno.test("unknown or unverified alerts are held rather than spamming Slack",()=>{
 assertEquals(actionableAlertMessage("alert.xyz",{actionable:false,reason:"unknown_alert_condition"}),null);
 assertEquals(actionableAlertMessage("alert.dead_jobs",{actionable:true,kind:"secret_unknown"}),null);
 assertEquals(actionableAlertMessage("escalation.overdue",{
  actionable:true,kind:"escalation.overdue",ticket_id:westCoast.id,
 },null),null);
});
Deno.test("missing service-worker health produces a specific next action with no invented customer impact",()=>{
 const msg=actionableAlertMessage("alert.worker_not_running",{
  actionable:true,kind:"worker_not_running",count:0,
 });
 assert(msg);
 assertStringIncludes(msg,"Bloom Support stopped processing requests");
 assertStringIncludes(msg,"restore the worker");
 assertStringIncludes(msg,"Not confirmed");
 assertEquals(msg.includes("determine customer impact"),false);
});
Deno.test("ticket descriptions never expose email, card numbers, credentials or Slack pings",()=>{
 const privateTicket={
  ...westCoast,account:{name:"owner@example.com"},
  summary:"Contact joe@example.com or call 604-555-0199; card 4242 4242 4242 4242. <@U123> https://example.com/private?access_token=secret",
  next_action:"Bearer secret1234567890",
 };
 const msg=actionableAlertMessage("escalation.overdue",{
  actionable:true,kind:"escalation.overdue",ticket_id:westCoast.id,
  escalation_reason:"decision_needed",
 },privateTicket);
 assert(msg);
 for(const sensitive of ["joe@example.com","owner@example.com","604-555-0199","4242 4242","<@U123>","https://example.com","secret1234567890"]) {
   assertEquals(msg.includes(sensitive),false,sensitive);
 }
 assertStringIncludes(msg,"Sensitive details are in Bloom Support");
});
Deno.test("task kind codes from database never become executable Slack markup",()=>{
 const msg=actionableAlertMessage("alert.dead_jobs",{
  actionable:true,kind:"dead_jobs",count:1,
  groups:[{type:"<@U123> @here",count:1}],
 });
 assert(msg);
 assertEquals(msg.includes("<@"),false);
 assertEquals(msg.includes("@here"),false);
 assertStringIncludes(msg,"other support tasks");
});

Deno.test("read-only alert function is service-only, SQL delimiters are balanced",async()=>{
 const sql=await Deno.readTextFile(new URL("../../../migrations/20261109021000_bloom_support_slack_actionable_alerts.sql",import.meta.url));
 assertEquals((sql.match(/CREATE OR REPLACE FUNCTION/g)||[]).length,1);
 assertEquals((sql.match(/AS \$\$/g)||[]).length,1);
 assertEquals((sql.match(/\$\$;/g)||[]).length,1);
 assertStringIncludes(sql,"x.lane NOT LIKE 'slack:%'");
 assertStringIncludes(sql,"REVOKE ALL ON FUNCTION public.bloom_support_slack_alert_context(uuid)");
 assertStringIncludes(sql,"GRANT EXECUTE ON FUNCTION public.bloom_support_slack_alert_context(uuid)");
 assertStringIncludes(sql,"TO service_role;");
});
