import type { TicketSummary, WaitingReason } from "@/lib/bloomSupport/api";
import { humanizeNextAction } from "../../../../supabase/functions/_shared/bloom-support/notes";

/**
 * Friendly words for the "Bloom is handling" list. One shared mapping so every
 * surface describes a status the same way, without internal codes.
 */
export type StatusTone = "active" | "waiting" | "done" | "attention";

const WAITING_WORDS: Record<WaitingReason, string> = {
  customer: "Waiting for the client",
  internal: "Waiting on our team",
  third_party: "Waiting on another company",
  deployment: "Waiting for a release",
  scheduled: "Scheduled for later",
};

const WAITING_NEXT: Record<WaitingReason, string> = {
  customer: "Bloom follows up if the client doesn't reply.",
  internal: "Bloom picks this up once the team responds.",
  third_party: "Bloom checks again and updates the client.",
  deployment: "Bloom checks the release and tells the client.",
  scheduled: "Bloom starts at the scheduled time.",
};

export function friendlyStatus(t: Pick<TicketSummary, "status" | "waiting_reason">): { label: string; tone: StatusTone } {
  switch (t.status) {
    case "new":
    case "received":
      return { label: "Just arrived", tone: "active" };
    case "working":
    case "in_progress":
      return { label: "Bloom is on it", tone: "active" };
    case "waiting":
    case "waiting_on_you":
      return { label: t.waiting_reason ? WAITING_WORDS[t.waiting_reason] : "Waiting", tone: "waiting" };
    case "needs_owner":
      return { label: "Needs an admin", tone: "attention" };
    case "resolved":
      return { label: "Solved", tone: "done" };
    default:
      return { label: "In progress", tone: "active" };
  }
}

/** What Bloom does next, in plain words. Stored next actions win; otherwise a sensible line per status. */
export function bloomNextStep(t: Pick<TicketSummary, "status" | "waiting_reason" | "next_action" | "progress">): string {
  if (t.next_action && t.next_action.trim()) return humanizeNextAction(t.next_action.trim());
  if (t.progress && t.progress.trim()) return t.progress.trim();
  if (t.status === "waiting" && t.waiting_reason) return WAITING_NEXT[t.waiting_reason];
  if (t.status === "new") return "Bloom is reading the request.";
  return "Bloom is working out the next step.";
}

/** The Today desk is grouped by client, not by whoever emailed support.
 * An unlinked intake or test has no verified client identity. Never present a
 * staff person's email as the customer; show the request number instead.
 * The requester and email remain available in the ticket details.
 */
export const clientName = (t: Pick<TicketSummary, "account" | "requester"> & Partial<Pick<TicketSummary, "number">>): string => {
  const linked = t.account?.name?.trim();
  if (linked) return linked;
  return Number.isInteger(t.number) && Number(t.number) > 0 ? `Unlinked request #${t.number}` : "Unlinked request";
};
