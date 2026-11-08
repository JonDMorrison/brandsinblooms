import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { plainSummary } from "@/components/admin/readableFormat";
import { bloomSupport, type Whoami } from "@/lib/bloomSupport/api";
import { escalationExplanation, groupOpenEscalations, recordReviewDecision, type DecisionChoice, type TodayEscalation } from "../todayActions";
import { asSentence, humanizeNextAction } from "../../../../supabase/functions/_shared/bloom-support/notes";
import { clientName } from "./statusWords";

type Row = Record<string, unknown>;

/** One thing that needs a person, written for a busy reader. */
export interface DeskDecision {
  key: string;
  /** Client name, or the best label we have. */
  client: string;
  /** "#1019 Checkout fails on phones", when the decision is about one request. */
  ticket?: string;
  when: string;
  /** The problem in plain language. */
  problem: string;
  /** What Bloom recommends. "Approve Bloom's plan" records exactly this. */
  recommendation: string;
  /** Why Bloom recommends it. */
  reason: string;
  /** Risk or consequence, when there is one. */
  risk?: string;
  /** Technical evidence for the disclosure. Never shown by default. */
  evidence?: string;
  /** Absent when the current person is not allowed to decide. */
  decide?: (choice: DecisionChoice, instructions?: string) => Promise<unknown>;
  open?: { label: string; onClick?: () => void; href?: string };
  /** What to confirm after each choice succeeds. */
  done: Record<DecisionChoice, string>;
}

const HOLD_DONE: Record<DecisionChoice, string> = {
  do: "Assigned to you. Bloom's automatic work stays paused.",
  reject: "Noted. Bloom won't suggest that again. The request is assigned to you to pick another step.",
  other: "Your instructions are saved on the request, and it is assigned to you.",
};

const ago = (d: unknown) => (typeof d === "string" ? formatDistanceToNow(new Date(d), { addSuffix: true }) : "");
/** "Admin: confirm the refund amount" reads as "Confirm the refund amount." on a card already addressed to an admin. */
const plainStep = (text: string) => {
  const s = humanizeNextAction(text).replace(/^Admin( or Support)?:\s*/i, "").trim();
  return asSentence(s.charAt(0).toUpperCase() + s.slice(1));
};
const HOLD = "Assign this request to me for review and keep automatic work paused.";

/**
 * The decisions list shared by Today and the Decisions view. It reads the same
 * endpoints the detailed panels use; every decision runs through
 * recordReviewDecision or decideFeature, which the server permission-checks.
 */
export function useDeskDecisions(me: Whoami, onOpenTicket: (id: string) => void) {
  const can = (p: string) => me.permissions.includes(p);
  const engineering = useQuery({ queryKey: ["bloom-support", "engineering", "awaiting_approval", "today"], queryFn: async () => {
    const rows = await bloomSupport.engineering("awaiting_approval");
    return rows.map((row) => {
      const tickets = (row.tickets as Array<{ id: string; automation?: string }>) ?? [];
      return { ...row, reviewOwned: tickets.length > 0 && tickets.every((ticket) => ticket.automation === "human") };
    });
  }, enabled: can("engineering.view"), refetchInterval: 30_000 });
  const features = useQuery({ queryKey: ["bloom-support", "features"], queryFn: () => bloomSupport.features(), enabled: can("features.view"), refetchInterval: 60_000 });
  const escalations = useQuery({ queryKey: ["bloom-support", "escalations"], queryFn: () => bloomSupport.escalations(), enabled: can("escalations.view"), refetchInterval: 30_000 });
  // Escalations carry only a ticket number; open requests give the client's name.
  const openAll = useQuery({ queryKey: ["bloom-support", "today", "open", "all"], queryFn: () => bloomSupport.pageTickets({ view: "open", sort: "updated", limit: "200" }), refetchInterval: 60_000 });
  const nameOf = new Map((openAll.data?.items ?? []).map((t) => [t.id, clientName(t)]));
  const needsOwner = useQuery({ queryKey: ["bloom-support", "today", "needs_owner"], queryFn: () => bloomSupport.pageTickets({ view: "needs_owner", sort: "priority", limit: "20" }), refetchInterval: 30_000 });

  const review = (ticketIds: string[], recommendation: string, items: TodayEscalation[] = []) =>
    can("tickets.write") && (!items.length || can("escalations.resolve"))
      ? (choice: DecisionChoice, alternative?: string) => recordReviewDecision(bloomSupport, { ticketIds, recommendation, escalations: items, ownerId: me.id }, choice, alternative)
      : undefined;

  const decisions: DeskDecision[] = [];
  for (const e of (engineering.data ?? []) as Row[]) {
    if (e.reviewOwned === true) continue;
    const tickets = (e.tickets as Array<{ id: string; number: number; subject: string }>) ?? [];
    const recommendation = "Assign the review to me and keep the release on hold.";
    decisions.push({
      key: `eng:${e.id}`,
      client: tickets[0] ? `Fix for #${tickets[0].number}` : "Proposed fix",
      ticket: tickets[0] ? `#${tickets[0].number} ${tickets[0].subject}` : undefined,
      when: ago(e.updated_at),
      problem: "A tested fix is ready, and it needs a person to review it before it goes live.",
      recommendation,
      reason: "Releasing a fix changes the live product for clients, so a person signs off first.",
      risk: e.risk ? plainSummary(e.risk) : undefined,
      evidence: tickets.length ? `Fixes ${tickets.length} request${tickets.length === 1 ? "" : "s"}: ${tickets.map((t) => `#${t.number}`).join(", ")}` : undefined,
      decide: tickets.length ? review(tickets.map((t) => t.id), recommendation, ((escalations.data ?? []) as TodayEscalation[]).filter((x) => x.engineering_issue_id === e.id)) : undefined,
      open: e.pr_url ? { label: "See the change", href: String(e.pr_url) } : tickets[0] ? { label: "Open request", onClick: () => onOpenTicket(tickets[0].id) } : undefined,
      done: { ...HOLD_DONE, do: "The review is assigned to you. The release stays on hold until it is approved." },
    });
  }
  for (const f of ((features.data ?? []) as Row[]).filter((x) => String(x.status) === "awaiting_decision")) {
    const evidence = (f.evidence as Array<{ ticket_id: string; account: string | null }>) ?? [];
    const asked = Array.from(new Set(evidence.map((x) => x.account).filter(Boolean)));
    decisions.push({
      key: `feat:${f.id}`,
      client: asked[0] ? String(asked[0]) + (asked.length > 1 ? ` and ${asked.length - 1} more` : "") : "Feature request",
      when: ago(f.created_at),
      problem: `A client wants: ${String(f.title)}.`,
      recommendation: "Add this request to the product plan. The client hears the decision; no delivery date is promised.",
      reason: "Planning it tells the client we heard them without committing to a date.",
      decide: can("features.decide") && can("tickets.write") ? async (choice, alternative) => {
        if (choice === "other") {
          if (!evidence.length) throw new Error("Open the request to add instructions to this feature.");
          await recordReviewDecision(bloomSupport, { ticketIds: evidence.map((x) => x.ticket_id), escalations: [], ownerId: me.id, recommendation: "Review the feature plan" }, choice, alternative);
        } else await bloomSupport.decideFeature(String(f.id), choice === "do" ? "planned" : "declined", choice === "do" ? "Add to the product plan; release still requires review." : "Rejected from Today; do not propose the same plan again without new information.");
      } : undefined,
      open: evidence[0] ? { label: "Open request", onClick: () => onOpenTicket(evidence[0].ticket_id) } : undefined,
      done: { do: "Added to the product plan. Bloom will tell the client.", reject: "Declined. Bloom will tell the client.", other: "Your instructions are saved on the request." },
    });
  }
  const escalationGroups = groupOpenEscalations((escalations.data ?? []) as TodayEscalation[]);
  for (const group of escalationGroups) {
    const x = group[0] as Row;
    if (group.some((item) => decisions.some((d) => d.key === `eng:${item.engineering_issue_id}`) || (features.data ?? []).some((f) => f.id === item.feature_request_id && f.status === "awaiting_decision"))) continue;
    const t = x.ticket as { number: number; subject: string } | null;
    const groupedReasons = Array.from(new Set(group.map((item) => String(item.reason ?? "needs attention").replace(/_/g, " "))));
    decisions.push({
      key: `esc:${String(x.ticket_id ?? x.id)}`,
      client: nameOf.get(String(x.ticket_id)) ?? (t ? `Request #${t.number}` : "Escalation"),
      ticket: t ? `#${t.number} ${t.subject}` : undefined,
      when: ago(x.created_at),
      problem: escalationExplanation(x.reason),
      recommendation: HOLD,
      reason: "Bloom paused its own work on this request. A person owning it stops repeated automatic attempts while you decide.",
      evidence: [x.detail, group.length > 1 ? `${group.length} related items: ${groupedReasons.join("; ")}` : null].filter(Boolean).join("\n") || undefined,
      decide: review(x.ticket_id ? [String(x.ticket_id)] : [], HOLD, group),
      open: x.ticket_id ? { label: "Open request", onClick: () => onOpenTicket(String(x.ticket_id)) } : undefined,
      done: HOLD_DONE,
    });
  }
  // Only an escalation still shown as a card stands in for its ticket; once taken, the ticket shows on its own until resolved.
  const escalatedTickets = new Set(escalationGroups.flatMap((group) => group.map((x) => String(x.ticket_id))));
  for (const t of needsOwner.data?.items ?? []) {
    if (escalatedTickets.has(t.id)) continue;
    decisions.push({
      key: `tkt:${t.id}`,
      client: clientName(t),
      ticket: `#${t.number} ${t.subject}`,
      when: ago(t.updated_at),
      problem: t.next_action ? plainStep(t.next_action) : "This request needs a person to choose the next step.",
      recommendation: HOLD,
      reason: "Bloom cannot choose this step on its own. Owning it keeps the client from waiting on an automatic attempt.",
      risk: t.priority === "urgent" || t.priority === "high" ? `The client marked this ${t.priority} priority.` : undefined,
      decide: review([t.id], HOLD),
      open: { label: "Open conversation", onClick: () => onOpenTicket(t.id) },
      done: HOLD_DONE,
    });
  }

  const sources = [engineering, features, escalations, needsOwner];
  // Needs-owner tickets beyond the first page still need someone; count them so totals stay honest.
  const moreNeedsOwner = Math.max(0, (needsOwner.data?.total ?? 0) - (needsOwner.data?.items.length ?? 0));
  return {
    decisions,
    moreNeedsOwner,
    loading: sources.some((q) => q.isLoading),
    unknown: sources.some((q) => q.error),
    error: sources.find((q) => q.error)?.error as Error | undefined,
  };
}
