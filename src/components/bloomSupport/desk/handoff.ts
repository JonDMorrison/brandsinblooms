/**
 * "Let Bloom handle it": decide what Bloom may safely take, then run it through
 * the existing permission-checked endpoints, one request at a time.
 *
 * Pure planning plus a runner that takes the API as an argument, so both are
 * testable without a browser. No new server endpoint: every write here is one
 * the desk already makes (addMessage, updateTicket, setAutomation), and the
 * server re-checks permission and version on each.
 */
import type { TicketDetail } from "@/lib/bloomSupport/api";
import { liveNextStep, resolutionPlan, type EngineeringFacts, type NextAction } from "../../../../supabase/functions/_shared/bloom-support/next-step";
import { clientName } from "./statusWords";

export type HandoffKind = "send-and-solve" | "hand-back";

export interface HandoffItem {
  key: string;
  kind: HandoffKind;
  ticketId: string;
  client: string;
  ticket: string;
  /** What Bloom will do, in plain words. */
  action: string;
  /** Why Bloom recommends it. */
  reason: string;
  /** Checked when the review opens. Hand-backs start unchecked: a person chose to own them. */
  preselected: boolean;
  /** The reply Bloom will send, for send-and-solve. Editable before approval. */
  draft?: string;
  summary?: string;
  checked?: string;
  noDeployReason?: string | null;
  /** Absent when the current person may approve this. */
  blocked?: string;
}

export interface HeldItem {
  key: string;
  ticketId: string;
  client: string;
  ticket: string;
  reason: string;
}

export interface HandoffPlan {
  items: HandoffItem[];
  held: HeldItem[];
}

/** Engineering states where repair work still owns the request. */
const ENGINEERING_ACTIVE = new Set(["investigating", "reproduced", "fixing", "awaiting_approval", "approved", "merging", "deploying", "verifying"]);

const HELD_REASON: Partial<Record<NextAction, string>> = {
  "approve-fix": "A fix is ready to go live. Releases always need a person's approval.",
  "start-repair": "Bloom wants to start an automatic repair. A person reads the evidence first.",
  "confirm-change": "Bloom prepared a change to the client's account. A person confirms account changes.",
  "decide-feature": "The client asked for something new. That is a product decision.",
  "review-reply": "The client wrote again after it was solved. A person decides what happens next.",
};

type Live = Pick<TicketDetail, "id" | "number" | "subject" | "status" | "automation" | "pending_review" | "merged_into" | "engineering" | "operations" | "feature_request" | "escalations" | "account" | "requester">;

function stepFor(t: Live) {
  return liveNextStep({
    status: t.status,
    automation: t.automation,
    pending_review: t.pending_review,
    merged_into: t.merged_into,
    engineering: t.engineering as EngineeringFacts | null | undefined,
    operations: t.operations,
    feature_request: t.feature_request as { id?: unknown; status?: unknown } | null | undefined,
    escalations: t.escalations as Array<{ reason?: unknown; status?: unknown }> | undefined,
  });
}

const openEscalation = (t: Live) => (t.escalations ?? []).some((e) => String(e.status) !== "resolved");

/**
 * Classify one live request. Returns what Bloom may do with it, why a person
 * must hold it, or null when Bloom already owns it and nothing is waiting.
 */
export function classifyForHandoff(t: Live, permissions: string[]): { item?: HandoffItem; held?: HeldItem } | null {
  if (t.status === "resolved" || t.merged_into) return null;
  const base = { ticketId: t.id, client: clientName(t), ticket: `#${t.number} ${t.subject}` };
  const blocked = permissions.includes("tickets.write") ? undefined : "Your role can't approve this. An admin can.";
  const step = stepFor(t);

  if (step?.action === "send-and-solve") {
    const plan = resolutionPlan({ engineering: t.engineering as EngineeringFacts | null | undefined, requesterName: t.requester?.name ?? null });
    if (plan) {
      return {
        item: {
          ...base, key: `solve:${t.id}`, kind: "send-and-solve",
          action: plan.outcome === "fixed" ? "Tell the client it's fixed, then mark it solved" : "Tell the client we couldn't reproduce it, then mark it solved",
          reason: plan.findings.join(" "),
          preselected: true, draft: plan.draft, summary: plan.summary, checked: plan.checked, noDeployReason: plan.noDeployReason, blocked,
        },
      };
    }
  }
  if (step && HELD_REASON[step.action]) return { held: { ...base, key: `held:${t.id}`, reason: HELD_REASON[step.action]! } };
  if (t.status === "needs_owner") return { held: { ...base, key: `held:${t.id}`, reason: "This needs an admin's decision before anyone can continue." } };
  if (openEscalation(t)) return { held: { ...base, key: `held:${t.id}`, reason: "Bloom stopped and asked for a person. Decide on it first." } };

  const engStatus = String((t.engineering as { status?: unknown } | null | undefined)?.status ?? "");
  if ((t.automation === "human" || t.automation === "paused") && !ENGINEERING_ACTIVE.has(engStatus)) {
    return {
      item: {
        ...base, key: `back:${t.id}`, kind: "hand-back",
        action: "Hand back to Bloom",
        reason: t.automation === "paused"
          ? "Automatic work is paused here, and nothing is waiting on a person's decision."
          : "A person took this over, and nothing is waiting on a person's decision.",
        preselected: false, blocked,
      },
    };
  }
  return null;
}

export function planHandoff(tickets: Live[], permissions: string[]): HandoffPlan {
  const plan: HandoffPlan = { items: [], held: [] };
  for (const t of tickets) {
    const c = classifyForHandoff(t, permissions);
    if (c?.item) plan.items.push(c.item);
    if (c?.held) plan.held.push(c.held);
  }
  // Settled requests first: they finish work for a waiting client.
  plan.items.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "send-and-solve" ? -1 : 1));
  return plan;
}

// ---------------------------------------------------------------------------
// Running the approved work
// ---------------------------------------------------------------------------

export interface HandoffApi {
  getTicket(id: string): Promise<TicketDetail>;
  addMessage(id: string, input: { body: string; visibility: "public" | "internal"; idempotency_key?: string }): Promise<{ message_id: string; duplicate: boolean }>;
  updateTicket(id: string, patch: Record<string, unknown>): Promise<unknown>;
  setAutomation(id: string, mode: "human" | "auto" | "paused", reason?: string): Promise<unknown>;
}

export type HandoffResult =
  | { status: "done"; message: string }
  | { status: "skipped"; message: string }
  | { status: "failed"; message: string };

/** Plain words for a failed step. Never a raw server message. */
export function plainFailure(error: unknown): string {
  const e = error as { status?: number; code?: string; message?: string };
  const text = String(e?.message ?? "");
  if (e?.status === 403 || /forbidden|permission/i.test(text)) return "Your role can't do this. An admin can.";
  if (e?.status === 409 || /conflict|version/i.test(text)) return "Someone changed this request while Bloom was working. Open it to review.";
  if (e?.status === 404) return "This request no longer exists.";
  return "Bloom couldn't finish this step. Try again, or open the request.";
}

/**
 * Run one approved item. Re-reads the live request first, so anything that
 * changed since the review is skipped rather than acted on. Idempotency keys
 * are stable for one review, so a retry never sends a reply twice.
 */
export async function runHandoffItem(
  api: HandoffApi,
  item: HandoffItem,
  opts: { body?: string; instructions?: string; idempotencyKey: string; permissions: string[] },
): Promise<HandoffResult> {
  if (item.blocked) return { status: "skipped", message: item.blocked };
  let live: TicketDetail;
  try {
    live = await api.getTicket(item.ticketId);
  } catch (error) {
    return { status: "failed", message: plainFailure(error) };
  }
  const now = classifyForHandoff(live, opts.permissions);
  if (now?.item?.kind !== item.kind) {
    return { status: "skipped", message: "This request changed since you reviewed it. Bloom left it alone. Open it to review." };
  }

  if (item.kind === "send-and-solve") {
    const body = (opts.body ?? item.draft ?? "").trim();
    if (!body) return { status: "skipped", message: "The reply was empty, so nothing was sent." };
    let sent: { message_id: string };
    try {
      sent = await api.addMessage(item.ticketId, { body, visibility: "public", idempotency_key: `${opts.idempotencyKey}:reply` });
    } catch (error) {
      return { status: "failed", message: `Nothing was sent. ${plainFailure(error)}` };
    }
    try {
      const fresh = await api.getTicket(item.ticketId);
      await api.updateTicket(item.ticketId, {
        ...(Number.isSafeInteger(fresh.version) ? { version: fresh.version } : {}),
        status: "resolved",
        resolution_summary: now.item.summary ?? item.summary,
        resolution_evidence: {
          // "send-and-solve" tells the worker this reply already told the client,
          // so no second resolution email goes out (resolutionAlreadyTold).
          via: "send-and-solve",
          source: "let-bloom-handle-it",
          reply_message_id: sent.message_id,
          verification: { passed: true, note: now.item.checked ?? item.checked },
          verified_note: now.item.checked ?? item.checked,
          ...(now.item.noDeployReason ? { no_deploy_reason: now.item.noDeployReason } : {}),
        },
      });
    } catch (error) {
      return { status: "failed", message: `The reply was sent, but the request isn't marked solved. ${plainFailure(error)}` };
    }
    return { status: "done", message: "Reply sent. Marked solved with the evidence on file." };
  }

  // Hand back to Bloom.
  const note = opts.instructions?.trim();
  if (note) {
    try {
      await api.addMessage(item.ticketId, { body: `Instructions for Bloom: ${note}`, visibility: "internal", idempotency_key: `${opts.idempotencyKey}:note` });
    } catch (error) {
      return { status: "failed", message: `Your instructions weren't saved, so Bloom didn't take it back. ${plainFailure(error)}` };
    }
  }
  try {
    await api.setAutomation(item.ticketId, "auto", note ? `Handed back to Bloom from Today. Instructions: ${note.slice(0, 300)}` : "Handed back to Bloom from Today");
  } catch (error) {
    return { status: "failed", message: `${note ? "Your instructions are saved, but " : ""}Bloom didn't take it back. ${plainFailure(error)}` };
  }
  return { status: "done", message: "Bloom has it again. It will look at the request and update the client." };
}
