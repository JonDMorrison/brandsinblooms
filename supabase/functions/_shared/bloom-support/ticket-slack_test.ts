import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { safeTicketText, ticketBloomStatus,
  ticketProblem, ticketQuestionAnswer, ticketRootMessage, ticketUpdateMessage } from "./ticket-slack.ts";
import { slackQuestionRoute } from "./slack-questions.ts";

const ID = "11111111-1111-4111-8111-111111111111";
const sample = {
  id:ID, number:1022, product:"crm",priority:"high",
  account:{name:"West Coast Gardens"},
  subject:"Product search is missing expected results",
  summary:"The shop team cannot find Sea Soil in their product search. Some saved audiences do not return expected customers.",
  status:"working",stage:"investigating",automation:"paused",executor:"person",
  owner:{name:"Jeff O'Brien"},
  next_action:"Review the authenticated CRM search and verify the original product filter.",
  resolution_verified:false,
};

Deno.test("ticket alert tells staff what happened, what Bloom does, owner and next step without a click",()=>{
  const message = ticketRootMessage(sample);
  assertStringIncludes(message,"#1022");
  assertStringIncludes(message,"West Coast Gardens");
  assertStringIncludes(message,"cannot find Sea Soil");
  assertStringIncludes(message,"Jeff O'Brien");
  assertStringIncludes(message,"A support person is handling this");
  assertStringIncludes(message,"Review the authenticated CRM search");
  assertStringIncludes(message,"Reply in this thread with @Bloom");
  assertStringIncludes(message,"Open ticket and actions");
});
Deno.test("an actual human takeover changes the posted ownership and Bloom state",()=>{
  const auto = {...sample,owner:null,executor:"bloom",automation:"auto",status:"new",next_action:null};
  assertStringIncludes(ticketRootMessage(auto),"Bloom (automated review)");
  assertStringIncludes(ticketBloomStatus(auto),"no active job confirmed");
  const after = ticketUpdateMessage(sample,"ticket.changed");
  assertStringIncludes(after,"Support handoff / progress");
  assertStringIncludes(after,"Jeff O'Brien");
  assertStringIncludes(after,"A support person is handling this");
});
Deno.test("queued versus active Bloom jobs cannot be falsely called completed",()=>{
  const queued={...sample,owner:null,executor:"bloom",automation:"auto",jobs:[{status:"queued"}]};
  const running={...queued,jobs:[{status:"leased"}]};
  assertStringIncludes(ticketBloomStatus(queued),"queued for processing");
  assertStringIncludes(ticketBloomStatus(running),"active job recorded");
  assertEquals(ticketBloomStatus({...queued,automation:"paused"}).includes("paused"),true);
});
Deno.test("an unverified resolution is never reported as verified",()=>{
  assertEquals(ticketRootMessage({...sample,status:"resolved",resolution_verified:false}).includes("Verified resolved"),false);
  assertStringIncludes(ticketQuestionAnswer({...sample,status:"resolved"},"is this fixed and tested?"),"not recorded");
  assertEquals(ticketRootMessage({...sample,status:"resolved",resolution_verified:true}).includes("Verified resolved"),true);
});
Deno.test("ticket conversation questions use only the current canonical facts",()=>{
  assertStringIncludes(ticketQuestionAnswer(sample,"Who is handling this?"),"Jeff O'Brien");
  assertStringIncludes(ticketQuestionAnswer(sample,"What's wrong with the search?"),"Sea Soil");
  assertStringIncludes(ticketQuestionAnswer(sample,"What should we do next?"),"Review the authenticated CRM search");
  assertStringIncludes(ticketQuestionAnswer(sample,"Did it pass customer verification?"),"not recorded");
});
Deno.test("Slack text cannot approve repairs, take ownership or send email",()=>{
  for (const q of ["I will take this", "Please deploy fix", "Refund the customer", "Send a campaign", "Approve this PR"]) {
    const message = ticketQuestionAnswer(sample,q);
    assertStringIncludes(message,"Slack message cannot approve");
    assertEquals(message.includes("I have assigned"),false);
  }
});
Deno.test("contact details and Slack pings are redacted before printing descriptions",()=>{
  const example={
    ...sample,account:{name:"Private client@example.com"},
    subject:"<@U123> @here *urgent*",
    summary:"Please email jane@example.com or call 604-555-1212 about payment card 4242 4242 4242 4242. <@U456> https://example.com/private?token=abc",
    next_action:"Email jane@example.com and tag <@U555>",
  };
  const message = ticketRootMessage(example);
  assertEquals(message.includes("jane@example.com"),false);
  assertEquals(message.includes("604-555-1212"),false);
  assertEquals(message.includes("4242 4242"),false);
  assertEquals(message.includes("https://example.com"),false);
  assertEquals(message.includes("<@U"),false);
  assertEquals(message.includes("@here"),false);
  assertStringIncludes(message,"[redacted");
  assertStringIncludes(message,"*Problem:*");
});
Deno.test("passwords, bearer tokens and private keys never appear in Slack",()=>{
  const t={...sample,summary:"This is the API key: sk_live_abcd1234efgh5678"};
  const message=ticketRootMessage(t);
  assertEquals(message.includes("sk_live"),false);
  assertStringIncludes(message,"Sensitive details are in Bloom Support");
  assertEquals(safeTicketText("Bearer abcdefg123456789"),"Sensitive details are in Bloom Support");
});
Deno.test("overlong forwarded email is truncated and not sent wholesale",()=>{
  const oversized="Hello support, the product preview is broken. "+ "Details in customer email. ".repeat(200);
  const summary=ticketProblem({...sample,summary:oversized});
  assert(summary.length<=440);
  assertStringIncludes(summary,"product preview is broken");
});
Deno.test("approved private tickets channel can be conversational, public channels are unaffected",()=>{
  assertEquals(slackQuestionRoute("C0CFNEQBS2X"),"tickets");
  assertEquals(slackQuestionRoute("C0CFUG4LFLJ"),"ask");
  assertEquals(slackQuestionRoute("C0CFUHJ5ESW"),"projects");
  assertEquals(slackQuestionRoute("C999999999"),null);
});
