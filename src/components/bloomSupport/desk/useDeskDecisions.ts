import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { plainSummary } from "@/components/admin/readableFormat";
import { bloomSupport, type Whoami } from "@/lib/bloomSupport/api";
import { groupOpenEscalations, recordReviewDecision, type TodayEscalation } from "../todayActions";
import { asSentence, humanizeNextAction } from "../../../../supabase/functions/_shared/bloom-support/notes";
import { clientName } from "./statusWords";

type Row = Record<string, unknown>;

/** One choice on a decision card. Each runs an existing, server-checked action. */
export interface DecisionOption {
  id: string;
  label: string;
  /** What happens if you pick it, in one short line. */
  detail: string;
  recommended?: boolean;
  run: () => Promise<unknown>;
  /** Confirmation shown after it succeeds. */
  done: string;
}

/** One thing that needs a person, written like a short question with answers. */
export interface DeskDecision {
  key: string;
  /** Client name, or the best label we have. */
  client: string;
  /** "#1019 Checkout fails on phones". */
  ticket?: string;
  when: string;
  /** "The problem": what is actually wrong, in plain words. */
  problem: string;
  /** "What I recommend", with the reason. */
  recommendation: string;
  /** Risk or consequence, when there is one. */
  risk?: string;
  /** Technical evidence for the disclosure. Never shown by default. */
  evidence?: string;
  /** Empty when the current person is not allowed to decide. */
  options: DecisionOption[];
  /** "Something else": saves the person's own instructions on the request. */
  other?: { run: (text: string) => Promise<unknown>; done: string };
  open?: { label: string; onClick?: () => void; href?: string };
}

const ago = (d: unknown) => (typeof d === "string" ? formatDistanceToNow(new Date(d), { addSuffix: true }) : "");

/** "Admin: confirm the refund amount" reads as "Confirm the refund amount." on a card already addressed to an admin. */
const plainStep = (text: string) => {
  const s = humanizeNextAction(text).replace(/^Admin( or Support)?:\s*/i, "").trim();
  return asSentence(s.charAt(0).toUpperCase() + s.slice(1));
};

/** The first sentence of a long engineering note, kept short enough to read at a glance. */
export function firstSentence(text: unknown, max = 200): string {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const match = clean.match(/^.*?[.!?](?=\s|$)/);
  const sentence = (match ? match[0] : clean).trim();
  return sentence.length > max ? `${sentence.slice(0, max - 1).trimEnd()}…` : sentence;
}

const HOLD = "Assign this request to me for review and keep automatic work paused.";
const TAKE_DONE = "It's yours now. Bloom's automatic work on it stays paused.";
const OTHER_DONE = "Your instructions are saved on the request, and it's assigned to you.";

/** What the problem is, built from the escalation's own facts rather than a generic line. */
/** The card already shows the subject, so the problem never repeats it; a finding that only restates it is dropped. */
export function escalationProblem(reason: unknown, detail: unknown, subject: string | undefined): { problem: string; finding?: string } {
  const r = String(reason ?? "");
  const found = firstSentence(detail);
  const finding = found && found !== subject ? found : undefined;
  if (r === "engineering_start_requested") return { problem: "Bloom looked into this and is ready to start an automatic fix.", finding };
  if (/engineering|repair/.test(r)) return { problem: "Bloom's automatic fix stopped before it finished.", finding };
  if (/overdue|stalled/.test(r)) return { problem: "This request has waited too long for its next step.", finding };
  if (/feature/.test(r)) return { problem: "The client asked for something the product doesn't do yet.", finding };
  return { problem: "Bloom needs a person to move this request forward.", finding };
}

/**
 * The decisions list shared by Today and the Decisions view. Every option runs
 * an existing endpoint (recordReviewDecision, decideFeature, updateEngineering,
 * resolveEscalation); the server checks permission on each.
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

  const canReview = (items: TodayEscalation[] = []) => can("tickets.write") && (!items.length || can("escalations.resolve"));
  const take = (ticketIds: string[], items: TodayEscalation[] = [], recommended = true, label = "I'll take it from here"): DecisionOption => ({
    id: "take", label, recommended, done: TAKE_DONE,
    detail: "Assign it to me. Bloom stops automatic work on it while I decide.",
    run: () => recordReviewDecision(bloomSupport, { ticketIds, recommendation: HOLD, escalations: items, ownerId: me.id }, "do"),
  });
  const other = (ticketIds: string[], items: TodayEscalation[] = []) => (ticketIds.length && canReview(items) ? {
    done: OTHER_DONE,
    run: (text: string) => recordReviewDecision(bloomSupport, { ticketIds, recommendation: HOLD, escalations: items, ownerId: me.id }, "other", text),
  } : undefined);

  const decisions: DeskDecision[] = [];
  for (const e of (engineering.data ?? []) as Row[]) {
    if (e.reviewOwned === true) continue;
    const tickets = (e.tickets as Array<{ id: string; number: number; subject: string }>) ?? [];
    const ids = tickets.map((t) => t.id);
    const items = ((escalations.data ?? []) as TodayEscalation[]).filter((x) => x.engineering_issue_id === e.id);
    const options: DecisionOption[] = [];
    if (ids.length && canReview(items)) options.push({ ...take(ids, items, true, "I'll review the fix first"), detail: "Assign the review to me. Nothing goes live until it's approved.", done: "The review is yours. Nothing goes live until it's approved." });
    if (can("engineering.approve")) options.push({
      id: "approve", label: "Approve the fix now", done: "Approved. Bloom will release it, check it on the live site, then tell the client.",
      detail: "Bloom releases it, checks it on the live site, then tells the client.",
      run: () => bloomSupport.updateEngineering(String(e.id), { status: "approved", note: "Approved from the Support desk" }),
    });
    decisions.push({
      key: `eng:${e.id}`,
      client: tickets[0] ? nameOf.get(tickets[0].id) ?? `Request #${tickets[0].number}` : "Proposed fix",
      ticket: tickets[0] ? `#${tickets[0].number} ${tickets[0].subject}` : undefined,
      when: ago(e.updated_at),
      problem: "Bloom wrote and tested a fix. It is waiting for approval to go live.",
      recommendation: "Review the change before it goes live, because releasing it changes the product for clients.",
      risk: e.risk ? plainSummary(e.risk) : undefined,
      evidence: tickets.length ? `Fixes ${tickets.length} request${tickets.length === 1 ? "" : "s"}: ${tickets.map((t) => `#${t.number}`).join(", ")}` : undefined,
      options,
      other: other(ids, items),
      open: e.pr_url ? { label: "See the change", href: String(e.pr_url) } : tickets[0] ? { label: "Open request", onClick: () => onOpenTicket(tickets[0].id) } : undefined,
    });
  }
  for (const f of ((features.data ?? []) as Row[]).filter((x) => String(x.status) === "awaiting_decision")) {
    const evidence = (f.evidence as Array<{ ticket_id: string; account: string | null }>) ?? [];
    const asked = Array.from(new Set(evidence.map((x) => x.account).filter(Boolean)));
    const allowed = can("features.decide") && can("tickets.write");
    decisions.push({
      key: `feat:${f.id}`,
      client: asked[0] ? String(asked[0]) + (asked.length > 1 ? ` and ${asked.length - 1} more` : "") : "Feature request",
      when: ago(f.created_at),
      problem: `A client asked for something new: ${String(f.title)}.`,
      recommendation: "Add it to the product plan. The client hears we're considering it, with no date promised.",
      options: allowed ? [
        { id: "plan", label: "Add it to the plan", recommended: true, detail: "Bloom tells the client it's planned. No delivery date is promised.", done: "Added to the plan. Bloom will tell the client.",
          run: () => bloomSupport.decideFeature(String(f.id), "planned", "Add to the product plan; release still requires review.") },
        { id: "decline", label: "Not now", detail: "Bloom tells the client it isn't planned right now.", done: "Declined. Bloom will tell the client.",
          run: () => bloomSupport.decideFeature(String(f.id), "declined", "Declined from the Support desk.") },
      ] : [],
      other: allowed && evidence.length ? {
        done: OTHER_DONE,
        run: (text) => recordReviewDecision(bloomSupport, { ticketIds: evidence.map((x) => x.ticket_id), escalations: [], ownerId: me.id, recommendation: "Review the feature plan" }, "other", text),
      } : undefined,
      open: evidence[0] ? { label: "Open request", onClick: () => onOpenTicket(evidence[0].ticket_id) } : undefined,
    });
  }
  const escalationGroups = groupOpenEscalations((escalations.data ?? []) as TodayEscalation[]);
  for (const group of escalationGroups) {
    const x = group[0] as Row;
    if (group.some((item) => decisions.some((d) => d.key === `eng:${item.engineering_issue_id}`) || (features.data ?? []).some((f) => f.id === item.feature_request_id && f.status === "awaiting_decision"))) continue;
    const t = x.ticket as { number: number; subject: string } | null;
    const ids = x.ticket_id ? [String(x.ticket_id)] : [];
    const reason = String(x.reason ?? "");
    const { problem, finding } = escalationProblem(reason, x.detail, t?.subject);
    const options: DecisionOption[] = [];
    let recommendation = "Take it yourself, so Bloom stops retrying while you decide.";
    const engId = typeof x.engineering_issue_id === "string" ? x.engineering_issue_id : null;
    if (reason === "engineering_start_requested" && engId && can("engineering.dispatch")) {
      recommendation = "Let Bloom start the fix. It works on a copy, and nothing goes live without approval.";
      options.push({
        id: "repair", label: "Let Bloom start the fix", recommended: true, detail: "Bloom works on a fix. Nothing goes live until someone approves it.",
        done: "Bloom is starting the fix. You'll be asked before anything goes live.",
        run: () => bloomSupport.updateEngineering(engId, { start_repair: true, note: "Started from the Support desk" }),
      });
      if (canReview(group)) options.push(take(ids, group, false));
    } else if (/overdue|stalled/.test(reason) && can("escalations.resolve")) {
      recommendation = "Take it yourself, so the client hears from a person today.";
      if (ids.length && canReview(group)) options.push(take(ids, group));
      options.push({
        id: "continue", label: "Let Bloom keep going", detail: "Clear the reminder. Bloom carries on with the request as it is.",
        done: "Reminder cleared. Bloom carries on with the request.",
        run: async () => { for (const item of group) await bloomSupport.resolveEscalation(String(item.id), "Let Bloom continue (from the Support desk)"); },
      });
    } else if (ids.length && canReview(group)) {
      options.push(take(ids, group));
    }
    decisions.push({
      key: `esc:${String(x.ticket_id ?? x.id)}`,
      client: nameOf.get(String(x.ticket_id)) ?? (t ? `Request #${t.number}` : "Escalation"),
      ticket: t ? `#${t.number} ${t.subject}` : undefined,
      when: ago(x.created_at),
      problem: finding ? `${problem} ${/stopped/.test(problem) ? "Why" : "What it found"}: ${finding}` : problem,
      recommendation,
      evidence: [x.detail, group.length > 1 ? `${group.length} related reminders on this request.` : null].filter(Boolean).join("\n\n") || undefined,
      options,
      other: other(ids, group),
      open: x.ticket_id ? { label: "Open request", onClick: () => onOpenTicket(String(x.ticket_id)) } : undefined,
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
      recommendation: "Take it yourself. Bloom can't make this call on its own.",
      risk: t.priority === "urgent" || t.priority === "high" ? `The client marked this ${t.priority} priority.` : undefined,
      options: canReview() ? [take([t.id])] : [],
      other: other([t.id]),
      open: { label: "Open conversation", onClick: () => onOpenTicket(t.id) },
    });
  }

  const sources = [engineering, features, escalations, needsOwner];
  // Needs-owner tickets beyond the first page still need someone; count them so totals stay honest.
  const moreNeedsOwner = Math.max(0, (needsOwner.data?.total ?? 0) - (needsOwner.data?.items.length ?? 0));
  return {
    decisions,
    moreNeedsOwner,
    /** Escalations a person already took and has not closed. */
    taken: ((escalations.data ?? []) as Row[]).filter((x) => String(x.status) === "acknowledged"),
    nameOf,
    loading: sources.some((q) => q.isLoading),
    unknown: sources.some((q) => q.error),
    error: sources.find((q) => q.error)?.error as Error | undefined,
  };
}
