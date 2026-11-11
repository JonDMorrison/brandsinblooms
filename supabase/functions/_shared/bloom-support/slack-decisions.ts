// Signed Slack interaction parsing and deliberately narrow decision cards.
// Arbitrary message text never authorizes work. Only a stored, current repair
// recommendation can execute; other decisions stay in the authenticated desk.
import { safeTicketText, supportTicketLink, type TicketFacts } from "./ticket-slack.ts";
import { liveNextStep, type LiveTicketState } from "./next-step.ts";

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
export interface SlackDecisionClick {
  decisionId: string; choice: "do" | "reject"; userId: string; channelId: string; messageTs: string;
}
/** Call only after verifySlackWebhook has authenticated the exact raw body. */
export function parseSlackDecision(data: Record<string, unknown>, teamId: string | undefined, staffIds: string[]): SlackDecisionClick | null {
  if (data.type !== "block_actions" || !teamId || obj(data.team).id !== teamId) return null;
  const userId = obj(data.user).id;
  const channelId = obj(data.channel).id;
  const container = obj(data.container);
  const messageTs = container.message_ts;
  if (typeof userId !== "string" || !/^[UW][A-Z0-9]{8,24}$/.test(userId) || !staffIds.includes(userId) ||
      channelId !== "C0CFNEQBS2X" || container.channel_id !== channelId || container.type !== "message" ||
      typeof messageTs !== "string" || !/^\d{10}\.\d{6}$/.test(messageTs)) return null;
  if (!Array.isArray(data.actions) || data.actions.length !== 1) return null;
  const action = obj(data.actions[0]);
  if (action.type !== "button" || typeof action.value !== "string" || !UUID.test(action.value)) return null;
  const choice = action.action_id === "bloom_repair_do" ? "do" : action.action_id === "bloom_repair_reject" ? "reject" : null;
  return choice ? { decisionId: action.value, choice, userId, channelId, messageTs } : null;
}
export interface RepairDecisionSnapshot {
  id: string; action: "start-repair"; ticket_id: string; engineering_issue_id: string; message_ids: string[]; ticket_version: number; engineering_version: number; expires_at: string;
}
export function repairDecisionSnapshot(value: unknown): RepairDecisionSnapshot | null {
  const v = obj(value);
  if (typeof v.id !== "string" || !UUID.test(v.id) || v.action !== "start-repair" ||
      typeof v.ticket_id !== "string" || !UUID.test(v.ticket_id) || typeof v.engineering_issue_id !== "string" || !UUID.test(v.engineering_issue_id) ||
      !Array.isArray(v.message_ids) || !v.message_ids.every(id => typeof id === "string" && UUID.test(id)) ||
      !Number.isSafeInteger(v.ticket_version) || !Number.isSafeInteger(v.engineering_version) ||
      typeof v.expires_at !== "string" || !Number.isFinite(Date.parse(v.expires_at))) return null;
  return v as unknown as RepairDecisionSnapshot;
}
export function ticketDecisionBlocks(ticket: TicketFacts & Partial<LiveTicketState> & { version?: number; messages?: unknown[]; engineering?: (NonNullable<LiveTicketState["engineering"]> & { version?: number }) | null }, snapshot: RepairDecisionSnapshot | null): Record<string, unknown>[] | undefined {
  if (typeof ticket.id !== "string" || !UUID.test(ticket.id) || typeof ticket.status !== "string") return undefined;
  const next = liveNextStep(ticket as LiveTicketState);
  if (!next) return undefined;
  const url = supportTicketLink(ticket.id) + "&action=" + encodeURIComponent(next.action);
  const display = ticket as TicketFacts & { version?: unknown; engineering?: unknown };
  const engineering = obj(display.engineering);
  // Bind the displayed evidence, not merely a fresh snapshot fetched after it.
  const inline = next.action === "start-repair" && snapshot?.action === "start-repair" &&
    snapshot.ticket_id === ticket.id && snapshot.ticket_version === display.version &&
    snapshot.engineering_issue_id === engineering.id && snapshot.engineering_version === engineering.version &&
    Array.isArray(ticket.messages) && JSON.stringify(snapshot.message_ids.slice().sort()) === JSON.stringify(ticket.messages.map(obj).filter(m => m.ticket_id === ticket.id && (m.author_kind === "client" || m.author_kind === "staff")).map(m => m.id).sort());
  const recommendation = inline
    ? "Start investigating and preparing this repair. Existing review, release and safety checks still apply."
    : next.recommendation;
  const plain = { type: "plain_text", text: "Do It" };
  const button = (label: string, suffix: string) => ({ type: "button", text: { type: "plain_text", text: label }, url: url + suffix });
  return [
    { type: "section", text: { type: "mrkdwn", text: "*Recommended next step*\n" + safeTicketText(recommendation, 500) } },
    { type: "context", elements: [{ type: "mrkdwn", text: inline
      ? "This decision applies only to the current repair request. It expires in 30 minutes. Reject It leaves the request open. Something Else opens the ticket so you can add your preferred approach as an internal note."
      : "This button opens the current recommendation in Bloom Support. Review the details there before any action is applied." }] },
    { type: "actions", elements: inline ? [
      { type: "button", text: plain, action_id: "bloom_repair_do", value: snapshot.id, confirm: {
        title: { type: "plain_text", text: "Start this repair?" },
        text: { type: "plain_text", text: "Bloom will investigate and prepare a fix for this ticket. This does not waive review, release, payment or access approvals." },
        confirm: { type: "plain_text", text: "Do It" }, deny: { type: "plain_text", text: "Cancel" },
      } },
      { type: "button", text: { type: "plain_text", text: "Reject It" }, action_id: "bloom_repair_reject", value: snapshot.id },
      { type: "button", text: { type: "plain_text", text: "Something Else" }, url: supportTicketLink(ticket.id) + "&compose=internal" },
    ] : [button("Review recommendation", "")] },
  ];
}
export function slackDecisionReceipt(result: unknown): string {
  const r = obj(result);
  if (r.applied === true) return r.choice === "reject"
    ? "Recommendation declined. The ticket stays open; no repair was started. Choose Something Else to propose another approach."
    : "Repair approved to start. Bloom keeps the ticket and will report progress here. Release and safety checks still apply.";
  if (r.reason === "already_recorded") return "That decision was already recorded. No second action was taken.";
  if (r.reason === "stale" || r.reason === "expired") return "This recommendation has changed or expired. Open the ticket for its current next step; nothing was changed.";
  return "This decision could not be authorized. Nothing was changed. Open Bloom Support to review the current request.";
}
