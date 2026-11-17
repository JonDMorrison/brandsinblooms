import { assertEquals } from "@std/assert";
import { gmailDraftQueueAvailable, shouldQueueAsDraft } from "./gmail-drafts.ts";
Deno.test("automatic held replies always use the canonical approval queue, even with Gmail credentials", () => {
 const keys=["GMAIL_FROM","GMAIL_CLIENT_ID","GMAIL_CLIENT_SECRET","GMAIL_REFRESH_TOKEN"];
 const previous=keys.map(k=>Deno.env.get(k));
 try { keys.forEach(k=>Deno.env.set(k,"test-value")); assertEquals(gmailDraftQueueAvailable(),false); }
 finally { keys.forEach((k,i)=>previous[i]===undefined?Deno.env.delete(k):Deno.env.set(k,previous[i]!)); }
});
Deno.test("sensitive automated replies remain held; human ownership is enforced by the delivery ledger", () => {
 assertEquals(shouldQueueAsDraft({ticketStatus:"needs_owner",executor:"bloom",nextAction:null}),true);
 assertEquals(shouldQueueAsDraft({ticketStatus:"working",executor:"bloom",nextAction:"Review refund dispute"}),true);
 assertEquals(shouldQueueAsDraft({ticketStatus:"working",executor:"bloom",nextAction:null,forceDraft:true}),true);
 assertEquals(shouldQueueAsDraft({ticketStatus:"working",executor:"person",nextAction:null}),false);
});
