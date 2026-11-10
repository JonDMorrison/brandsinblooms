import { db, env, BloomError } from "./runtime.ts";
import { postSlackInternalMessage } from "./slack.ts";
import { repairDecisionSnapshot, ticketDecisionBlocks } from "./slack-decisions.ts";
import { ticketRootMessage, ticketUpdateMessage, type TicketFacts } from "./ticket-slack.ts";

/** Optional interactions fail closed; existing ticket delivery remains available. */
export async function postTicketDecisionMessage(ticket: TicketFacts, eventKind: string, jobId: string, rootTs?: string) {
  let snapshot = null;
  if (env("BLOOM_SUPPORT_SLACK_DECISIONS_ENABLED") === "true") {
    const {data,error} = await db().rpc("bloom_support_slack_repair_snapshot", {p_ticket:ticket.id,p_job:jobId});
    // A missing migration or unavailable snapshot must not suppress the usual update.
    snapshot = error ? null : repairDecisionSnapshot(data);
  }
  // A snapshot is the only way to emit executable buttons. Feature, release,
  // money, access and other decisions remain in the authenticated review flow.
  const blocks = ticketDecisionBlocks(ticket as Parameters<typeof ticketDecisionBlocks>[0],snapshot);
  const result = await postSlackInternalMessage("tickets", rootTs ? ticketUpdateMessage(ticket,eventKind) : ticketRootMessage(ticket,eventKind),jobId,rootTs,blocks);
  if (snapshot) {
    const {error} = await db().rpc("bloom_support_bind_slack_repair", {p_decision:snapshot.id,p_message_ts:result.ts,p_root_ts:rootTs ?? result.ts});
    if(error) throw new BloomError(503,"slack_decision_binding","Slack recommendation was not bound; it cannot execute");
  }
  return result;
}

/** Never call user-supplied response_url. Destination is authenticated above. */
export async function postDecisionReceipt(channel: string,user: string,text: string): Promise<void> {
  if(channel !== "C0CFNEQBS2X" || !/^[UW][A-Z0-9]{8,24}$/.test(user)) return;
  const token=env("BLOOM_SUPPORT_SLACK_BOT_TOKEN");
  if(!token) return;
  try {
    await fetch("https://slack.com/api/chat.postEphemeral", {
      method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
      body:JSON.stringify({channel,user,text}),signal:AbortSignal.timeout(2000),
    });
  } catch { /* Decision receipt remains in the durable audit if Slack is down. */ }
}
