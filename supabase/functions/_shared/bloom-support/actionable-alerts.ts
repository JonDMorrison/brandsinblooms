/**
 * Actionable, privacy-filtered internal Slack alerts.
 *
 * The source is the *actual* watchdog job and/or canonical support ticket.
 * No raw provider errors, client email, identifiers or untrusted alert text
 * are ever allowed into staff channels.
 */
import {
  safeTicketText, supportTicketLink, ticketBloomStatus,
  ticketNextAction, ticketOwnership, ticketProblem, ticketStatus,
  ticketNumber, type TicketFacts,
} from "./ticket-slack.ts";

type Json = Record<string, unknown>;
const record = (x: unknown): Json => x && typeof x === "object" && !Array.isArray(x) ? x as Json : {};
const word = (x: unknown): string => typeof x === "string" ? x : "";
const count = (x: unknown): number => typeof x === "number" && Number.isSafeInteger(x) && x >= 0
  ? Math.min(x,10_000) : 0;
const groupNames: Record<string,string> = {
  triage:"support reviews", answer:"customer answers",
  send_email:"email deliveries", notify:"staff notifications",
  investigate:"bug investigations", engineering_step:"repair checks",
  operate:"requested account changes", verify_resolution:"resolution checks",
  post_resolution_reply:"customer follow-ups", digest:"staff summaries",
  escalate:"escalation emails",
};
const reasonNames: Record<string,string> = {
  engineering_start_requested:"A decision about starting a repair is overdue.",
  engineering_escalated:"A repair was stopped and needs an authorized decision.",
  ticket_overdue:"The support deadline passed.",
  decision_needed:"A required decision has not been recorded.",
  client_reply_human:"A customer is waiting for a person to respond.",
};

function ticketAlert(kind:string, context:Json, t:TicketFacts):string|null {
  const number=ticketNumber(t.number);
  if (!number || typeof t.id !== "string") return null;
  const account=safeTicketText(record(t.account).name,76)||"a client";
  const headline=kind==="engineering_escalated"||kind==="engineering.escalated" ?
    "A repair needs review" : kind==="escalation.overdue" ?
    "A decision is overdue" : kind==="ticket.overdue" ?
    "A support deadline was missed" : kind==="engineering.failed" ?
    "A repair attempt stopped" : kind==="ticket.needs_owner" ?
    "A support decision is needed" : "A support issue needs attention";
  const reason = reasonNames[word(context.escalation_reason)] ??
    (kind==="engineering_escalated"?"An automated repair has stopped. A person must decide what happens next."
    :kind==="escalation.overdue"?"A decision for this support request has passed its deadline."
    :kind==="ticket.overdue"?"The deadline for this request has passed."
    :kind==="ticket.stalled"?"This request has not progressed as expected."
    :kind==="engineering.failed"?"Bloom could not finish a repair."
    :"This support issue needs a team decision.");
  const acknowledged=context.escalation_status==="acknowledged";
  const problem=ticketProblem(t).slice(0,300);
  const lines=[
    "*" + headline + " · " + account + " · #" + number + "*",
    "*Problem:* " + problem,
    "*Why this alert appeared:* " + reason,
    "*Status:* " + ticketStatus(t) + (acknowledged ? " · Escalation already acknowledged" : ""),
    "*Handling it:* " + ticketOwnership(t),
    "*Bloom:* " + ticketBloomStatus(t),
    "*Next:* " + ticketNextAction(t),
    "*Customer impact:* Not confirmed by this alert alone.",
    "<" + supportTicketLink(t.id) + "|Review this ticket>",
  ];
  return lines.join("\n").slice(0,2300);
}

const platformAlerts: Record<string,{title:string;why:(n:number)=>string;next:string}> = {
  worker_not_running:{
    title:"Bloom Support stopped processing requests",
    why:()=>"The background worker did not finish its recent check. New support requests may be delayed.",
    next:"Check Bloom Support's System Status and restore the worker before retrying affected tasks.",
  },
  queue_backlog:{
    title:"Support work is backing up",
    why:n=>n>0? n+" support tasks have been waiting longer than expected.":
      "Support tasks are taking longer than expected.",
    next:"Review the support queue, confirm the worker is running and assign time-sensitive requests.",
  },
  email_failures:{
    title:"Some support emails failed",
    why:()=>"At least one outgoing support email failed recently. The customer may not have received an update.",
    next:"Check failed email deliveries in Bloom Support before retrying them.",
  },
  bloom_tool_failures:{
    title:"Bloom had trouble retrieving information",
    why:()=>"Several connected-system lookups failed recently. The affected customer work still needs checking.",
    next:"Review the failing integrations and confirm what information Bloom could not retrieve.",
  },
  bloom_tool_timeouts:{
    title:"Bloom's connected-system checks took too long",
    why:()=>"Multiple lookups timed out. Their results are not confirmed.",
    next:"Check the affected integration and try one bounded read-only verification.",
  },
  bloom_request_errors:{
    title:"Some Bloom questions failed",
    why:()=>"Several Bloom requests ended in errors recently.",
    next:"Review the failed requests and verify whether staff could finish their tasks.",
  },
  bloom_negative_feedback:{
    title:"Staff reported problems with Bloom's answers",
    why:n=>n>0? n+" answers received negative feedback in the recent review window.":
      "Several answers received negative feedback.",
    next:"Review the examples and improve the underlying help information.",
  },
  duplicate_system_segments:{
    title:"Some customer groups are duplicated",
    why:()=>"An automatic check found duplicate built-in customer groups.",
    next:"Review the affected CRM accounts before changing group memberships.",
  },
  orphan_segment_memberships:{
    title:"Customer group counts may be incorrect",
    why:n=>n>0? n+" deleted or merged customer records still appear in customer groups.":
      "Some deleted or merged customers still appear in customer groups.",
    next:"Review the affected groups and confirm counts before sending a campaign.",
  },
  watchdog_check_failed:{
    title:"Bloom could not finish a system check",
    why:()=>"A health check failed before it could confirm the system's state.",
    next:"Review the health-check error in Bloom Support. Do not assume customers are affected.",
  },
};
const readiness="https://bloomsuite.app/admin/bloom-support?view=readiness";

/** Returns null rather than send an unverifiable or self-referential alert. */
export function actionableAlertMessage(kind:string, rawContext:unknown, rawTicket?:unknown):string|null {
  const ctx=record(rawContext);
  if (ctx.actionable !== true) return null;
  const issue=record(rawTicket);
  const id=typeof ctx.ticket_id==="string" ? ctx.ticket_id : "";
  if (id && issue.id===id) {
    return ticketAlert(word(ctx.kind)||kind,ctx,issue);
  }

  if (kind==="alert.dead_jobs" && ctx.kind==="dead_jobs") {
    const total=count(ctx.count);
    if (!total) return null;
    const entries=Array.isArray(ctx.groups)?ctx.groups.slice(0,5).map(record):[];
    const descriptions=entries.map(g=>{
      const code=word(g.type);
      return count(g.count)+" "+(groupNames[code]??"other support tasks");
    });
    return [
      "*Bloom stopped " + total + " task" + (total===1?"":"s") + " after repeated failures*",
      "*What stopped:* "+(descriptions.join("; ")||"Task details need reviewing."),
      "*What Bloom is doing:* Automatic retries have stopped for these tasks.",
      "*Customer impact:* Not confirmed. Check affected tasks before contacting customers.",
      "*Next:* Open System Status to review the actual failures and assign a person if needed.",
      "<"+readiness+"|Review failed tasks>",
    ].join("\n");
  }

  const info=platformAlerts[word(ctx.kind)];
  if (kind.startsWith("alert.") && info) {
    return [
      "*"+info.title+"*",
      "*What happened:* "+info.why(count(ctx.count)),
      "*What Bloom is doing:* The issue has been recorded; recovery is not confirmed.",
      "*Customer impact:* Not confirmed by this check.",
      "*Next:* "+info.next,
      "<"+readiness+"|Review System Status>",
    ].join("\n");
  }
  return null;
}

/**
 * Missing context is an exception, not proof there is no problem.
 * Only the self-referential Slack failure loop is silently skipped.
 * Keep every other potentially important alert visible with an honest blocker.
 */
export function missingAlertContextMessage(kind: string): string | null {
  const isSystem = kind.startsWith("alert.");
  const isEngineering = kind === "engineering.escalated" || kind === "engineering.failed";
  const isEscalation = kind === "escalation.overdue";
  const isSupport = kind === "ticket.overdue" || kind === "ticket.stalled" ||
    kind === "ticket.needs_owner" || kind === "job.dead";
  if (!isSystem && !isEngineering && !isEscalation && !isSupport) return null;
  const label = isEngineering ? "A repair needs review" : isEscalation ?
    "A support decision needs review" : isSystem ?
    "A system check needs review" : "A support task needs review";
  return [
    "*" + label + "*",
    "Bloom recorded a problem but could not safely match it to the supporting details.",
    "*What is known:* The source record could not be verified. Customer impact is not confirmed.",
    "*Next:* A support administrator should inspect the original alert and link the correct task before taking action.",
    "<https://bloomsuite.app/admin/bloom-support?view=readiness|Review System Status>",
  ].join("\n");
}
