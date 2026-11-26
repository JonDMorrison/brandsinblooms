// Morning Slack digest — formats a DigestReport as Slack block kit content.
// Internal staff-only channel; never sent to or visible by clients.
import type { DigestReport } from "./support-emails.ts";

export type SlackDigest = { text: string; blocks: Record<string, unknown>[] };

/**
 * Renders the digest report as a Slack message with block kit layout.
 * Returns null when there is nothing to report (same guard as the email digest).
 * Client names and ticket numbers are included; subjects and message bodies are not.
 */
export function renderSlackDigestBlocks(
  r: DigestReport,
  opts: { appUrl: string; date: string },
): SlackDigest | null {
  const { needs_you, resolved, said, repairs, alerts } = r;
  const approvalsPending = r.approvals_pending ?? 0;
  if (!needs_you.length && !resolved.length && !said.length && !repairs.length && !alerts.length && !approvalsPending) {
    return null;
  }

  const base = opts.appUrl.replace(/\/+$/, "");
  const link = `${base}/admin/bloom-support`;

  const headline = needs_you.length === 0
    ? "Nothing needs you today"
    : needs_you.length === 1
      ? "1 decision needs you"
      : `${needs_you.length} decisions need you`;

  const statParts: string[] = [];
  if (resolved.length) statParts.push(`Bloom resolved ${resolved.length}`);
  if (said.length) statParts.push(`talked to ${said.length} client${said.length === 1 ? "" : "s"}`);
  if (repairs.length) statParts.push(`${repairs.length} repair${repairs.length === 1 ? "" : "s"} in progress`);
  if (alerts.length) statParts.push(`⚠ ${alerts.length} alert${alerts.length === 1 ? "" : "s"}`);
  if (approvalsPending) statParts.push(`📬 ${approvalsPending} repl${approvalsPending === 1 ? "y" : "ies"} need review`);

  const blocks: Record<string, unknown>[] = [];

  // Calendar header
  blocks.push({
    type: "header",
    text: { type: "plain_text", text: `Support desk · ${opts.date}`, emoji: false },
  });

  // Headline + stats
  const introLines = [`*${headline}*`];
  if (statParts.length) introLines.push(statParts.join(" · "));
  blocks.push({ type: "section", text: { type: "mrkdwn", text: introLines.join("\n") } });

  // Needs your decision (client name + ticket number; no subject or message body)
  if (needs_you.length) {
    const MAX = 6;
    const lines = needs_you.slice(0, MAX).map((n) => {
      const age = formatAge(Date.now() - new Date(n.since).getTime());
      return `• ${n.client ?? "A client"} · #${n.number} · ${reasonSummary(n.reason)} (${age})`;
    });
    if (needs_you.length > MAX) lines.push(`• …and ${needs_you.length - MAX} more`);
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Needs your decision*\n${lines.join("\n")}` },
    });
  }

  // Repairs in progress (status label only; no ticket subject)
  if (repairs.length) {
    const MAX = 4;
    const lines = repairs.slice(0, MAX).map((rep) => {
      const status = REPAIR_STATUS[rep.status] ?? rep.status.replace(/_/g, " ");
      return `• ${rep.client ? `${rep.client} · ` : ""}${status}`;
    });
    if (repairs.length > MAX) lines.push(`• …and ${repairs.length - MAX} more`);
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Repairs*\n${lines.join("\n")}` },
    });
  }

  // Open Support action button
  blocks.push({
    type: "actions",
    elements: [{
      type: "button",
      text: { type: "plain_text", text: "Open Support", emoji: false },
      url: link,
      action_id: "bloom_morning_open",
    }],
  });

  // Plain-text fallback for notification previews
  const text = [
    `Support desk · ${opts.date}`,
    headline,
    statParts.join(" · "),
    ...needs_you.slice(0, 4).map((n) => `• ${n.client ?? "A client"} #${n.number}`),
    link,
  ].filter(Boolean).join("\n");

  return { text, blocks };
}

const REPAIR_STATUS: Record<string, string> = {
  open: "Not started", investigating: "Investigating", reproduced: "Bug reproduced",
  not_reproduced: "Could not reproduce", fixing: "Writing the fix",
  awaiting_approval: "Fix ready, waiting approval", approved: "Approved, waiting to release",
  merging: "Releasing", deploying: "Releasing", verifying: "Checking the fix", verified: "Fixed",
  failed: "Fix failed", rolled_back: "Rolled back", escalated: "Needs a person",
};

function reasonSummary(reason: string): string {
  const MAP: Record<string, string> = {
    ticket_overdue: "Overdue",
    engineering_start_requested: "Fix ready",
    engineering_escalated: "Repair escalated",
    engineering_needs_approval: "Approval needed",
    feature_decision: "Feature decision needed",
    question: "Question for you",
    refund_request: "Refund decision needed",
    policy_decision: "Policy decision needed",
  };
  return MAP[reason] ?? reason.replace(/_/g, " ");
}

function formatAge(ms: number): string {
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} min`;
  if (ms < 86_400_000) return `${(ms / 3_600_000).toFixed(1)} hrs`;
  return `${(ms / 86_400_000).toFixed(1)} days`;
}

/**
 * Why a Slack answer did not answer, or null when it did. The morning digest
 * lists these so a gap is seen by the team before a person has to hit it twice.
 */
export function unansweredReason(answer: unknown): string | null {
  if(typeof answer!=="string" || !answer.trim()) return "no answer was recorded";
  const a=answer.slice(0,700);
  if(/can't share ticket or client records here|couldn't check this channel with Slack/i.test(a)) return "the channel was refused";
  if(/\bcannot read (?:application fees|invoices|the balance|payouts|the account)\b|no Stripe read-only key/i.test(a)) return "the Stripe key lacks access";
  if(/\bI(?: am|'m|\u2019m) unable to\b|\bI (?:can(?:no|'|\u2019)t|cannot|(?:currently )?(?:don't|do not|don\u2019t) have access)\b|\bnot accessible\b|\b(?:restricted|not permitted)\b/i.test(a)) return "Bloom said it could not";
  if(/\bI couldn't (?:finish|verify|confirm|complete|check)\b|\bcould not (?:complete|finish|validate)\b|did not answer this time|exceeded the safe work limit|safe processing window ended/i.test(a)) return "the lookup did not finish";
  if(/^(?:which|what) (?:ticket|product|pr|release)\b|\bI need (?:more (?:details|context)|the specific ticket)\b|\bplease (?:provide|specify|clarify)\b|\bI don't have enough verified information\b/i.test(a)) return "Bloom asked for details instead of answering";
  return null;
}

export interface SlackAnswerRow { route?: unknown; question?: unknown; answer?: unknown }
const plain = (v: unknown, max: number): string => typeof v === "string"
  ? v.replace(/[*_~`<>|@]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : "";
/**
 * The questions staff asked in Slack since the last digest that Bloom did not
 * answer, grouped by question. Null when every question was answered.
 */
export function unansweredDigest(rows: readonly SlackAnswerRow[]): SlackDigest | null {
  const seen = new Map<string, { route: string; question: string; reason: string; count: number }>();
  for (const r of rows) {
    const reason = unansweredReason(r.answer), question = plain(r.question, 140);
    if (!reason || !question) continue;
    const key = `${plain(r.route, 20)}|${question.toLowerCase()}`;
    const entry = seen.get(key) ?? { route: plain(r.route, 20) || "ask", question, reason, count: 0 };
    entry.count++; seen.set(key, entry);
  }
  if (!seen.size) return null;
  const items = [...seen.values()].slice(0, 12);
  const title = seen.size === 1 ? "1 question Bloom could not answer" : `${seen.size} questions Bloom could not answer`;
  const lines = items.map(i => `• #bloom-${i.route === "ask" ? "ask" : i.route}: “${i.question}”${i.count > 1 ? ` (asked ${i.count} times)` : ""} — ${i.reason}`);
  const text = `*${title}*\n${lines.join("\n")}`;
  return { text, blocks: [{ type: "divider" }, { type: "section", text: { type: "mrkdwn", text: text.slice(0, 2900) } }] };
}
