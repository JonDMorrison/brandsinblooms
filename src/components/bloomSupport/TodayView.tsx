import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Button from "@mui/joy/Button";
import Input from "@mui/joy/Input";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Alert from "@mui/joy/Alert";
import Skeleton from "@mui/joy/Skeleton";
import Link from "@mui/joy/Link";
import { ArrowRight, Check, Search, X } from "lucide-react";
import { formatDistanceToNow, isToday } from "date-fns";
import { plainSummary } from "@/components/admin/readableFormat";
import { useAskDialog } from "./useAskDialog";
import { bloomSupport, STATUS_LABEL, WAITING_LABEL, type TicketSummary, type Whoami } from "@/lib/bloomSupport/api";
import { groupOpenEscalations, isBloomHandlingTicket, recordReviewDecision, escalationExplanation, type DecisionChoice, type TodayEscalation } from "./todayActions";

/**
 * Bloom Support "Today": one calm screen that answers "does anything need me?".
 * Decisions use the same endpoints as the detailed panels; nothing here bypasses them.
 */

type Row = Record<string, unknown>;
type Decision = {
  key: string;
  who: string;
  when: string;
  text: string;
  detail?: string;
  recommendation: string;
  decide?: (choice: DecisionChoice, alternative?: string) => Promise<unknown>;
  open?: { label: string; onClick?: () => void; href?: string };
};

const ago = (d: unknown) => (typeof d === "string" ? formatDistanceToNow(new Date(d), { addSuffix: true }) : "");
const initials = (name: string) =>
  name.replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
const clientName = (t: Pick<TicketSummary, "account" | "requester">) => t.account?.name ?? t.requester?.name ?? t.requester?.email ?? "Unknown client";

const sectionLabel = { fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" } as const;

function Avatar({ name }: { name: string }) {
  return (
    <Box aria-hidden sx={{ flex: "0 0 auto", width: 40, height: 40, borderRadius: "50%", bgcolor: "primary.100", color: "primary.900", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "display", fontWeight: 600, fontSize: "0.875rem" }}>
      {initials(name)}
    </Box>
  );
}

function ListCard({ children }: { children: ReactNode }) {
  return <Sheet variant="outlined" sx={{ borderRadius: "lg", overflow: "hidden", bgcolor: "background.surface", "& > * + *": { borderTop: "1px solid", borderColor: "neutral.100" } }}>{children}</Sheet>;
}

export function TodayView({ me, onOpenTicket, onOpenDesk }: { me: Whoami; onOpenTicket: (id: string) => void; onOpenDesk: () => void }) {
  const qc = useQueryClient();
  const { ask, dialog } = useAskDialog();
  const can = (p: string) => me.permissions.includes(p);
  const [acted, setActed] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  const engineering = useQuery({ queryKey: ["bloom-support", "engineering", "awaiting_approval", "today"], queryFn: async () => {
    const rows = await bloomSupport.engineering("awaiting_approval");
    return rows.map((row) => {
      const tickets = (row.tickets as Array<{ id: string; automation?: string }>) ?? [];
      return { ...row, reviewOwned: tickets.length > 0 && tickets.every((ticket) => ticket.automation === "human") };
    });
  }, enabled: can("engineering.view"), refetchInterval: 30_000 });
  const features = useQuery({ queryKey: ["bloom-support", "features"], queryFn: () => bloomSupport.features(), enabled: can("features.view"), refetchInterval: 60_000 });
  const escalations = useQuery({ queryKey: ["bloom-support", "escalations"], queryFn: () => bloomSupport.escalations(), enabled: can("escalations.view"), refetchInterval: 30_000 });
  const needsOwner = useQuery({ queryKey: ["bloom-support", "today", "needs_owner"], queryFn: () => bloomSupport.pageTickets({ view: "needs_owner", sort: "priority", limit: "20" }), refetchInterval: 30_000 });
  const open = useQuery({ queryKey: ["bloom-support", "today", "open", "bloom"], queryFn: () => bloomSupport.pageTickets({ view: "open", automation: "auto", sort: "updated", limit: "200" }), refetchInterval: 30_000 });
  const resolved = useQuery({ queryKey: ["bloom-support", "today", "resolved"], queryFn: () => bloomSupport.pageTickets({ view: "recently_resolved", limit: "50" }), refetchInterval: 60_000 });
  const results = useQuery({ queryKey: ["bloom-support", "today", "search", query], queryFn: () => bloomSupport.pageTickets({ q: query, limit: "8" }), enabled: query.length > 0 });

  const act = useMutation({
    mutationFn: async ({ run }: { key: string; run: () => Promise<unknown>; done: string }) => run(),
    onMutate: ({ key }) => { setBusy(key); setError(null); setOutcome(null); },
    onSuccess: (_d, { key, done }) => { setOutcome(done); setActed((a) => ({ ...a, [key]: done })); qc.invalidateQueries({ queryKey: ["bloom-support"] }); },
    onError: (e: Error) => setError(e.message),
    onSettled: () => setBusy(null),
  });

  const review = (ticketIds: string[], recommendation: string, items: TodayEscalation[] = []) =>
    can("tickets.write") && (!items.length || can("escalations.resolve"))
      ? (choice: DecisionChoice, alternative?: string) => recordReviewDecision(bloomSupport, { ticketIds, recommendation, escalations: items, ownerId: me.id }, choice, alternative)
      : undefined;
  const decisions: Decision[] = [];
  for (const e of (engineering.data ?? []) as Row[]) {
    if (e.reviewOwned === true) continue;
    const tickets = (e.tickets as Array<{ id: string; number: number; subject: string }>) ?? [];
    decisions.push({
      key: `eng:${e.id}`,
      who: tickets[0]?.subject ? `Fix for #${tickets[0].number}` : String(e.product ?? "Engineering"),
      when: ago(e.updated_at),
      text: "A proposed fix needs a person to review it before it can go live.",
      recommendation: "Assign the review to me and keep the release on hold.",
      detail: [
        e.risk ? `Risk: ${plainSummary(e.risk)}` : null,
        tickets.length ? `Fixes ${tickets.length} ticket${tickets.length === 1 ? "" : "s"}: ${tickets.map((t) => `#${t.number}`).join(", ")}` : null,
      ].filter(Boolean).join(" · ") || undefined,
      decide: tickets.length ? review(tickets.map((t) => t.id), "Assign the review to me and keep the release on hold.", ((escalations.data ?? []) as TodayEscalation[]).filter((x) => x.engineering_issue_id === e.id)) : undefined,
      open: e.pr_url ? { label: "See the change", href: String(e.pr_url) } : tickets[0] ? { label: "Open ticket", onClick: () => onOpenTicket(tickets[0].id) } : undefined,
    });
  }
  for (const f of ((features.data ?? []) as Row[]).filter((x) => String(x.status) === "awaiting_decision")) {
    const evidence = (f.evidence as Array<{ ticket_id: string; account: string | null }>) ?? [];
    const asked = Array.from(new Set(evidence.map((x) => x.account).filter(Boolean)));
    decisions.push({
      key: `feat:${f.id}`,
      who: asked[0] ? String(asked[0]) + (asked.length > 1 ? ` and ${asked.length - 1} more` : "") : "Feature request",
      when: ago(f.created_at),
      text: `A customer wants: ${String(f.title)}.`,
      recommendation: "Add this request to the product plan. The customer will receive the decision; no delivery date is promised.",
      decide: can("features.decide") && can("tickets.write") ? async (choice, alternative) => {
        if (choice === "other") {
          if (!evidence.length) throw new Error("Open the full desk to add guidance to this feature.");
          await recordReviewDecision(bloomSupport, { ticketIds: evidence.map((x) => x.ticket_id), escalations: [], ownerId: me.id, recommendation: "Review the feature plan" }, choice, alternative);
        } else await bloomSupport.decideFeature(String(f.id), choice === "do" ? "planned" : "declined", choice === "do" ? "Add to the product plan; release still requires review." : "Rejected from Today; do not propose the same plan again without new information.");
      } : undefined,
      open: evidence[0] ? { label: "Open request", onClick: () => onOpenTicket(evidence[0].ticket_id) } : undefined,
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
      who: t ? `#${t.number} ${t.subject}` : "Escalation",
      when: ago(x.created_at),
      text: escalationExplanation(x.reason),
      recommendation: "Assign this request to me for review and keep automatic work paused.",
      detail: [x.detail, group.length > 1 ? `${group.length} related items: ${groupedReasons.join("; ")}` : null].filter(Boolean).join("\n"),
      decide: review(x.ticket_id ? [String(x.ticket_id)] : [], "Assign this request to me for review and keep automatic work paused.", group),
      open: x.ticket_id ? { label: "Open ticket", onClick: () => onOpenTicket(String(x.ticket_id)) } : undefined,
    });
  }
  // Only an escalation still shown as a card stands in for its ticket; once taken, the ticket shows on its own until resolved.
  const escalatedTickets = new Set(escalationGroups.flatMap((group) => group.map((x) => String(x.ticket_id))));
  for (const t of needsOwner.data?.items ?? []) {
    if (escalatedTickets.has(t.id)) continue;
    decisions.push({
      key: `tkt:${t.id}`,
      who: clientName(t),
      when: ago(t.updated_at),
      text: "This request needs a person to choose the next step.",
      recommendation: "Assign this request to me for review and keep automatic work paused.",
      detail: [t.subject, t.next_action].filter(Boolean).join("\n"),
      decide: review([t.id], "Assign this request to me for review and keep automatic work paused."),
      open: { label: "Open conversation", onClick: () => onOpenTicket(t.id) },
    });
  }

  const pending = decisions.filter((d) => !acted[d.key]);
  const decided = decisions.filter((d) => acted[d.key]);
  const handling = (open.data?.items ?? []).filter(isBloomHandlingTicket);
  // Count only rows whose live ownership says Bloom. Subtracting Needs You
  // from every open ticket also counted work already owned by a person.
  const handlingTotal = handling.length;
  // Needs-owner tickets beyond the first page still need someone; count them and point to the desk.
  const moreNeedsOwner = Math.max(0, (needsOwner.data?.total ?? 0) - (needsOwner.data?.items.length ?? 0));
  const doneToday = (resolved.data?.items ?? []).filter((t) => t.resolved_at && isToday(new Date(t.resolved_at)));
  const decisionQueries = [engineering, features, escalations, needsOwner];
  // "All quiet" is only said once every source of decisions has answered.
  const loading = decisionQueries.some((q) => q.isLoading) || open.isLoading;
  const decisionsUnknown = decisionQueries.some((q) => q.error);
  const loadError = [...decisionQueries, open, resolved].find((q) => q.error)?.error as Error | undefined;

  const needCount = pending.length + moreNeedsOwner;
  const headline = decisionsUnknown && needCount === 0
    ? "Bloom couldn't check everything."
    : needCount === 0 ? "No decisions waiting." : needCount === 1 ? "1 thing needs you." : `${needCount} things need you.`;
  const subline = decisionsUnknown && needCount === 0
    ? "Some decisions may be waiting. Open the full desk to check."
    : `Bloom is handling ${open.data?.next_cursor ? "at least " : ""}${handlingTotal} other request${handlingTotal === 1 ? "" : "s"}${decided.length ? `. You've made ${decided.length} decision${decided.length === 1 ? "" : "s"} here` : ""}.`;

  const submitSearch = (e: FormEvent) => { e.preventDefault(); setQuery(search.trim()); };

  return (
    <Stack
      data-testid="bloom-support-today-work-column"
      spacing={4}
      sx={{ maxWidth: 1200, ml: 0, mr: "auto", width: "100%", textAlign: "left", py: { xs: 1, md: 3 }, pb: 6 }}
    >
      {dialog}
      <Stack spacing={1}>
        {loading ? <Skeleton variant="text" level="h2" width="60%" /> : <Typography level="h2" component="h1" sx={{ letterSpacing: "-0.02em" }}>{headline}</Typography>}
        {!loading && <Typography level="body-lg" textColor="text.secondary">{subline}</Typography>}
      </Stack>

      {outcome && <Alert role="status" color="success" variant="soft">{outcome}</Alert>}
      {(error || loadError) && <Alert color="danger" variant="soft">{error ?? loadError?.message}</Alert>}

      <form onSubmit={submitSearch} role="search">
        <Input
          size="lg"
          value={search}
          onChange={(e) => { setSearch(e.target.value); if (!e.target.value) setQuery(""); }}
          placeholder="Find a client, ticket number or problem…"
          startDecorator={<Search size={18} />}
          endDecorator={query ? <IconButton aria-label="Clear search" onClick={() => { setSearch(""); setQuery(""); }}><X size={16} /></IconButton> : <IconButton type="submit" aria-label="Search" variant="solid" color="primary"><ArrowRight size={18} /></IconButton>}
          sx={{ borderRadius: "xl", "--Input-minHeight": "52px", bgcolor: "background.surface" }}
          slotProps={{ input: { "aria-label": "Find a client, ticket number or problem" } }}
        />
      </form>

      {query && (
        <Stack spacing={1.5}>
          <Typography sx={sectionLabel} textColor="text.tertiary">Results</Typography>
          {results.isLoading ? <Skeleton variant="rectangular" height={120} sx={{ borderRadius: "lg" }} /> : results.data?.items.length ? (
            <ListCard>
              {results.data.items.map((t) => <TicketRow key={t.id} t={t} onOpen={onOpenTicket} />)}
            </ListCard>
          ) : <Typography level="body-md" textColor="text.secondary">Nothing matches “{query}”.</Typography>}
        </Stack>
      )}

      {needCount > 0 && (
        <Stack spacing={1.5} component="section" aria-label="Needs you">
          <Typography sx={sectionLabel} textColor="warning.700">Needs you</Typography>
          {pending.map((d) => <DecisionCard key={d.key} d={d} busy={busy !== null} onChoose={async (choice) => {
            let alternative: string | undefined;
            if (choice === "other") {
              const result = await ask({ title: "Something else", description: "Your guidance stays with this request for review. It does not execute a change or send a customer reply.", fields: [{ name: "alternative", label: "What would you like instead?", kind: "textarea", required: true }], confirmLabel: "Save guidance" });
              if (!result) return;
              alternative = String(result.alternative).trim();
            }
            act.mutate({ key: d.key, run: () => d.decide!(choice, alternative), done: choice === "do" ? "Recommendation recorded." : choice === "reject" ? "Recommendation rejected." : "Your alternative is recorded for review." });
          }} />)}
          {moreNeedsOwner > 0 && <Link component="button" level="body-md" onClick={onOpenDesk} sx={{ alignSelf: "flex-start" }}>{moreNeedsOwner} more need an admin. See them in the full desk</Link>}
        </Stack>
      )}

      {!loading && !decisionsUnknown && needCount === 0 && (
        <Sheet variant="outlined" sx={{ borderRadius: "lg", p: 3, display: "flex", gap: 2, alignItems: "center", bgcolor: "background.surface" }}>
          <Box sx={{ width: 44, height: 44, borderRadius: "50%", bgcolor: "primary.100", color: "primary.700", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}><Check size={22} /></Box>
          <div>
            <Typography level="title-md">You're all caught up</Typography>
            <Typography level="body-md" textColor="text.secondary">Bloom will email you when something needs a decision.</Typography>
          </div>
        </Sheet>
      )}

      {decided.length > 0 && (
        <ListCard>
          {decided.map((d) => (
            <Stack key={d.key} direction="row" spacing={1.5} alignItems="center" sx={{ px: 2.5, py: 1.75 }}>
              <Box sx={{ color: "success.700", display: "flex" }}><Check size={16} /></Box>
              <Typography level="body-md"><b>{d.who}</b> · {acted[d.key]}</Typography>
            </Stack>
          ))}
        </ListCard>
      )}

      <Stack spacing={1.5} component="section" aria-label="Open requests">
        <Typography sx={sectionLabel} textColor="text.tertiary">Open requests</Typography>
        {loading ? <Skeleton variant="rectangular" height={160} sx={{ borderRadius: "lg" }} /> : handling.length ? (
          <ListCard>{handling.slice(0, 8).map((t) => <TicketRow key={t.id} t={t} onOpen={onOpenTicket} />)}</ListCard>
        ) : <Typography level="body-md" textColor="text.secondary">No open requests right now.</Typography>}
        {handlingTotal > 8 && <Link component="button" level="body-md" onClick={onOpenDesk} sx={{ alignSelf: "flex-start" }}>See {open.data?.next_cursor ? "all Bloom-owned requests" : `all ${handlingTotal}`} in the full desk</Link>}
      </Stack>

      {doneToday.length > 0 && (
        <Stack spacing={1.5} component="section" aria-label="Done today">
          <Typography sx={sectionLabel} textColor="text.tertiary">Done today</Typography>
          <ListCard>
            {doneToday.map((t) => (
              <Stack key={t.id} role="button" tabIndex={0} direction="row" spacing={1.5} alignItems="center" sx={{ px: 2.5, py: 1.75, cursor: "pointer", "&:hover": { bgcolor: "neutral.50" }, "&:focus-visible": { outline: "2px solid", outlineColor: "primary.500", outlineOffset: -2 } }} onClick={() => onOpenTicket(t.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpenTicket(t.id); } }}>
                <Box sx={{ color: "success.700", display: "flex" }}><Check size={16} /></Box>
                <Typography level="body-md" sx={{ flex: 1, minWidth: 0 }}><b>{clientName(t)}</b> · {t.resolution_summary ?? t.subject}</Typography>
              </Stack>
            ))}
          </ListCard>
        </Stack>
      )}

      <Box>
        <Button variant="plain" color="neutral" onClick={onOpenDesk} endDecorator={<ArrowRight size={16} />}>Open the full support desk</Button>
      </Box>
    </Stack>
  );
}

export function DecisionCard({ d, busy, onChoose }: { d: Decision; busy: boolean; onChoose: (choice: DecisionChoice) => void }) {
  return (
    <Sheet variant="outlined" sx={{ borderRadius: "lg", p: 2.5, bgcolor: "background.surface", boxShadow: "xs" }}>
      <Stack direction="row" spacing={1.75} alignItems="flex-start">
        <Avatar name={d.who} />
        <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="baseline" flexWrap="wrap">
            <Typography level="title-md">{d.who}</Typography>
            <Typography level="body-sm" textColor="text.tertiary">{d.when}</Typography>
          </Stack>
          <Typography level="body-md" sx={{ lineHeight: 1.55 }}>{d.text}</Typography>
          <Typography level="body-md"><b>Recommendation:</b> {d.recommendation}</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ pt: 1.5 }}>
            <Button size="lg" disabled={busy || !d.decide} onClick={() => onChoose("do")}>Do It</Button>
            <Button size="lg" variant="outlined" color="neutral" disabled={busy || !d.decide} onClick={() => onChoose("reject")}>Reject it</Button>
            <Button size="lg" variant="plain" color="neutral" disabled={busy || !d.decide} onClick={() => onChoose("other")}>Something else</Button>
          </Stack>
          {!d.decide && <Typography level="body-sm">An authorized admin needs to make this decision.</Typography>}
          <Box component="details" sx={{ pt: 1.5 }}>
            <Box component="summary" sx={{ cursor: "pointer" }}>Technical evidence and history</Box>
            {d.detail && <Typography level="body-sm" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{d.detail}</Typography>}
            {d.open && (d.open.href
              ? <Link href={d.open.href} target="_blank" rel="noopener">{d.open.label}</Link>
              : <Link component="button" onClick={d.open.onClick}>{d.open.label}</Link>)}
          </Box>
        </Stack>
      </Stack>
    </Sheet>
  );
}

function TicketRow({ t, onOpen }: { t: TicketSummary; onOpen: (id: string) => void }) {
  const status = t.status === "waiting" && t.waiting_reason ? WAITING_LABEL[t.waiting_reason] : STATUS_LABEL[t.status];
  const dot = t.status === "waiting" ? "warning.400" : t.status === "resolved" ? "success.500" : "primary.500";
  return (
    <Stack
      direction="row" spacing={1.75} alignItems="center" role="button" tabIndex={0}
      onClick={() => onOpen(t.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(t.id); } }}
      sx={{ px: 2.5, py: 1.75, minHeight: 56, cursor: "pointer", "&:hover": { bgcolor: "neutral.50" }, "&:focus-visible": { outline: "2px solid", outlineColor: "primary.500", outlineOffset: -2 } }}
    >
      <Box aria-hidden sx={{ flex: "0 0 auto", width: 10, height: 10, borderRadius: "50%", bgcolor: dot }} />
      <Typography level="body-md" sx={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: { sm: "nowrap" } }}>
        <b>{clientName(t)}</b> · {t.subject}
      </Typography>
      <Typography level="body-sm" textColor="text.tertiary" sx={{ flex: "0 0 auto", display: { xs: "none", sm: "block" } }}>{status}</Typography>
    </Stack>
  );
}
