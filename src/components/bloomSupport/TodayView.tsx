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
import { bloomSupport, STATUS_LABEL, WAITING_LABEL, type TicketSummary, type Whoami } from "@/lib/bloomSupport/api";

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
  primary?: { label: string; run: () => Promise<unknown>; done: string };
  secondary?: { label: string; run: () => Promise<unknown>; done: string };
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
  const can = (p: string) => me.permissions.includes(p);
  const [acted, setActed] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  const engineering = useQuery({ queryKey: ["bloom-support", "engineering", "awaiting_approval"], queryFn: () => bloomSupport.engineering("awaiting_approval"), enabled: can("engineering.view"), refetchInterval: 30_000 });
  const features = useQuery({ queryKey: ["bloom-support", "features"], queryFn: () => bloomSupport.features(), enabled: can("features.view"), refetchInterval: 60_000 });
  const escalations = useQuery({ queryKey: ["bloom-support", "escalations"], queryFn: () => bloomSupport.escalations(), enabled: can("escalations.view"), refetchInterval: 30_000 });
  const needsOwner = useQuery({ queryKey: ["bloom-support", "today", "needs_owner"], queryFn: () => bloomSupport.pageTickets({ view: "needs_owner", sort: "priority", limit: "20" }), refetchInterval: 30_000 });
  const open = useQuery({ queryKey: ["bloom-support", "today", "open"], queryFn: () => bloomSupport.pageTickets({ view: "open", sort: "updated", limit: "50" }), refetchInterval: 30_000 });
  const resolved = useQuery({ queryKey: ["bloom-support", "today", "resolved"], queryFn: () => bloomSupport.pageTickets({ view: "recently_resolved", limit: "50" }), refetchInterval: 60_000 });
  const results = useQuery({ queryKey: ["bloom-support", "today", "search", query], queryFn: () => bloomSupport.pageTickets({ q: query, limit: "8" }), enabled: query.length > 0 });

  const act = useMutation({
    mutationFn: async ({ run }: { key: string; run: () => Promise<unknown>; done: string }) => run(),
    onMutate: ({ key }) => { setBusy(key); setError(null); },
    onSuccess: (_d, { key, done }) => { setActed((a) => ({ ...a, [key]: done })); qc.invalidateQueries({ queryKey: ["bloom-support"] }); },
    onError: (e: Error) => setError(e.message),
    onSettled: () => setBusy(null),
  });

  const decisions: Decision[] = [];
  for (const e of (engineering.data ?? []) as Row[]) {
    const tickets = (e.tickets as Array<{ id: string; number: number; subject: string }>) ?? [];
    decisions.push({
      key: `eng:${e.id}`,
      who: tickets[0]?.subject ? `Fix for #${tickets[0].number}` : String(e.product ?? "Engineering"),
      when: ago(e.updated_at),
      text: `Bloom has a tested fix ready: ${String(e.title)}. Approve it to go live?`,
      detail: [
        e.risk ? `Risk: ${typeof e.risk === "string" ? e.risk : JSON.stringify(e.risk)}` : null,
        tickets.length ? `Fixes ${tickets.length} ticket${tickets.length === 1 ? "" : "s"}: ${tickets.map((t) => `#${t.number}`).join(", ")}` : null,
      ].filter(Boolean).join(" · ") || undefined,
      primary: can("engineering.approve") ? { label: "Approve fix", run: () => bloomSupport.updateEngineering(String(e.id), { status: "approved", note: "Approved from Today" }), done: "Fix approved. Bloom will release it." } : undefined,
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
      text: `Asked for a new feature: ${String(f.title)}. Should we build it?`,
      primary: can("features.decide") ? { label: "Yes, plan it", run: () => bloomSupport.decideFeature(String(f.id), "planned"), done: "Planned. Bloom will let the client know." } : undefined,
      secondary: can("features.decide") ? { label: "Not now", run: () => bloomSupport.decideFeature(String(f.id), "declined"), done: "Declined. Bloom will let the client know." } : undefined,
      open: evidence[0] ? { label: "Open request", onClick: () => onOpenTicket(evidence[0].ticket_id) } : undefined,
    });
  }
  for (const x of ((escalations.data ?? []) as Row[]).filter((r) => String(r.status) === "open")) {
    const t = x.ticket as { number: number; subject: string } | null;
    decisions.push({
      key: `esc:${x.id}`,
      who: t ? `#${t.number} ${t.subject}` : "Escalation",
      when: ago(x.created_at),
      text: x.detail ? String(x.detail) : `Bloom needs a person: ${String(x.reason).replace(/_/g, " ")}.`,
      primary: can("escalations.resolve") ? { label: "I'll take it", run: () => bloomSupport.acknowledgeEscalation(String(x.id)), done: "It's yours. Bloom has stepped back." } : undefined,
      open: x.ticket_id ? { label: "Open ticket", onClick: () => onOpenTicket(String(x.ticket_id)) } : undefined,
    });
  }
  const escalatedTickets = new Set(((escalations.data ?? []) as Row[]).map((x) => String(x.ticket_id)));
  for (const t of needsOwner.data?.items ?? []) {
    if (escalatedTickets.has(t.id)) continue;
    decisions.push({
      key: `tkt:${t.id}`,
      who: clientName(t),
      when: ago(t.updated_at),
      text: t.next_action ? `${t.subject}. ${t.next_action}` : t.subject,
      open: { label: "Open conversation", onClick: () => onOpenTicket(t.id) },
    });
  }

  const pending = decisions.filter((d) => !acted[d.key]);
  const decided = decisions.filter((d) => acted[d.key]);
  const handling = (open.data?.items ?? []).filter((t) => t.status !== "needs_owner");
  const doneToday = (resolved.data?.items ?? []).filter((t) => t.resolved_at && isToday(new Date(t.resolved_at)));
  const loading = needsOwner.isLoading || open.isLoading;
  const loadError = [engineering, features, escalations, needsOwner, open, resolved].find((q) => q.error)?.error as Error | undefined;

  const headline = pending.length === 0 ? "All quiet. Bloom has it handled." : pending.length === 1 ? "1 thing needs you." : `${pending.length} things need you.`;
  const subline = `Bloom is handling ${handling.length} other request${handling.length === 1 ? "" : "s"}${decided.length ? `. You've made ${decided.length} decision${decided.length === 1 ? "" : "s"} here` : ""}.`;

  const submitSearch = (e: FormEvent) => { e.preventDefault(); setQuery(search.trim()); };

  return (
    <Stack spacing={4} sx={{ maxWidth: 840, mx: "auto", width: "100%", py: { xs: 1, md: 3 }, pb: 6 }}>
      <Stack spacing={1}>
        {loading ? <Skeleton variant="text" level="h2" width="60%" /> : <Typography level="h2" component="h1" sx={{ letterSpacing: "-0.02em" }}>{headline}</Typography>}
        {!loading && <Typography level="body-lg" textColor="text.secondary">{subline}</Typography>}
      </Stack>

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

      {pending.length > 0 && (
        <Stack spacing={1.5} component="section" aria-label="Needs you">
          <Typography sx={sectionLabel} textColor="warning.700">Needs you</Typography>
          {pending.map((d) => <DecisionCard key={d.key} d={d} busy={busy === d.key} onRun={(a) => act.mutate({ key: d.key, ...a })} />)}
        </Stack>
      )}

      {!loading && pending.length === 0 && (
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

      <Stack spacing={1.5} component="section" aria-label="Bloom is handling">
        <Typography sx={sectionLabel} textColor="text.tertiary">Bloom is handling</Typography>
        {loading ? <Skeleton variant="rectangular" height={160} sx={{ borderRadius: "lg" }} /> : handling.length ? (
          <ListCard>{handling.slice(0, 8).map((t) => <TicketRow key={t.id} t={t} onOpen={onOpenTicket} />)}</ListCard>
        ) : <Typography level="body-md" textColor="text.secondary">No open requests right now.</Typography>}
        {handling.length > 8 && <Link component="button" level="body-md" onClick={onOpenDesk} sx={{ alignSelf: "flex-start" }}>See all {handling.length} in the full desk</Link>}
      </Stack>

      {doneToday.length > 0 && (
        <Stack spacing={1.5} component="section" aria-label="Done today">
          <Typography sx={sectionLabel} textColor="text.tertiary">Done today</Typography>
          <ListCard>
            {doneToday.map((t) => (
              <Stack key={t.id} direction="row" spacing={1.5} alignItems="center" sx={{ px: 2.5, py: 1.75, cursor: "pointer", "&:hover": { bgcolor: "neutral.50" } }} onClick={() => onOpenTicket(t.id)}>
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

function DecisionCard({ d, busy, onRun }: { d: Decision; busy: boolean; onRun: (a: { run: () => Promise<unknown>; done: string }) => void }) {
  const [more, setMore] = useState(false);
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
          {more && d.detail && <Sheet variant="soft" color="neutral" sx={{ mt: 1, p: 1.5, borderRadius: "md" }}><Typography level="body-sm">{d.detail}</Typography></Sheet>}
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ pt: 1.5 }}>
            {d.primary && <Button size="lg" loading={busy} onClick={() => onRun(d.primary!)} sx={{ borderRadius: "xl" }}>{d.primary.label}</Button>}
            {d.secondary && <Button size="lg" variant="outlined" color="neutral" disabled={busy} onClick={() => onRun(d.secondary!)} sx={{ borderRadius: "xl" }}>{d.secondary.label}</Button>}
            {d.open && (d.open.href
              ? <Button size="lg" variant={d.primary ? "plain" : "solid"} component="a" href={d.open.href} target="_blank" rel="noopener" sx={{ borderRadius: "xl" }}>{d.open.label}</Button>
              : <Button size="lg" variant={d.primary ? "plain" : "solid"} onClick={d.open.onClick} sx={{ borderRadius: "xl" }}>{d.open.label}</Button>)}
            {d.detail && <Button size="lg" variant="plain" color="neutral" onClick={() => setMore((m) => !m)}>{more ? "Hide details" : "What did Bloom do?"}</Button>}
          </Stack>
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
