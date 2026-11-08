import { useState, type FormEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Button from "@mui/joy/Button";
import Input from "@mui/joy/Input";
import IconButton from "@mui/joy/IconButton";
import Alert from "@mui/joy/Alert";
import Skeleton from "@mui/joy/Skeleton";
import Link from "@mui/joy/Link";
import { ArrowRight, Check, CheckCircle2, Scale, Search, Sprout, X } from "lucide-react";
import { formatDistanceToNow, isToday } from "date-fns";
import { bloomSupport, type TicketSummary, type Whoami } from "@/lib/bloomSupport/api";
import { isBloomHandlingTicket } from "./todayActions";
import { useDeskDecisions } from "./desk/useDeskDecisions";
import { DecisionList } from "./desk/DecisionList";
import { bloomNextStep, clientName, friendlyStatus } from "./desk/statusWords";
import { StatusPill } from "./desk/StatusPill";
import { deskCardSx } from "./desk/deskStyles";

/**
 * Bloom Support "Today": one calm screen that answers "does anything need me?".
 * Decisions use the same endpoints as the detailed panels; nothing here bypasses them.
 */

const ago = (d: unknown) => (typeof d === "string" ? formatDistanceToNow(new Date(d), { addSuffix: true }) : "");

export function TodayView({ me, onOpenTicket, onOpenDesk, heroAction }: {
  me: Whoami;
  onOpenTicket: (id: string) => void;
  onOpenDesk: () => void;
  /** The primary hand-off action, when available. */
  heroAction?: ReactNode;
}) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const { decisions, moreNeedsOwner, loading: decisionsLoading, unknown: decisionsUnknown, error: decisionsError } = useDeskDecisions(me, onOpenTicket);

  const open = useQuery({ queryKey: ["bloom-support", "today", "open", "bloom"], queryFn: () => bloomSupport.pageTickets({ view: "open", automation: "auto", sort: "updated", limit: "200" }), refetchInterval: 30_000 });
  const resolved = useQuery({ queryKey: ["bloom-support", "today", "resolved"], queryFn: () => bloomSupport.pageTickets({ view: "recently_resolved", limit: "50" }), refetchInterval: 60_000 });
  const results = useQuery({ queryKey: ["bloom-support", "today", "search", query], queryFn: () => bloomSupport.pageTickets({ q: query, limit: "8" }), enabled: query.length > 0 });

  // Count only rows whose live ownership says Bloom, never person-owned work.
  const handling = (open.data?.items ?? []).filter(isBloomHandlingTicket);
  const handlingMore = !!open.data?.next_cursor;
  const doneToday = (resolved.data?.items ?? []).filter((t) => t.resolved_at && isToday(new Date(t.resolved_at)));
  const needCount = decisions.length + moreNeedsOwner;
  const loading = decisionsLoading || open.isLoading;
  const loadError = decisionsError ?? (open.error as Error | null) ?? (resolved.error as Error | null) ?? undefined;

  const headline = loading ? null
    : decisionsUnknown && needCount === 0 ? "Bloom couldn't check everything."
    : needCount === 0 ? "Nothing needs you right now."
    : needCount === 1 ? "One decision needs you." : `${needCount} decisions need you.`;
  const subline = decisionsUnknown && needCount === 0
    ? "Some decisions may be waiting. Open Requests to check."
    : needCount === 0 ? "Bloom is taking care of the routine work. It will email you when something needs a person."
    : "Each one has a recommended answer. Pick it, choose another, or write your own.";

  const submitSearch = (e: FormEvent) => { e.preventDefault(); setQuery(search.trim()); };

  return (
    <Stack
      data-testid="bloom-support-today-work-column"
      spacing={8}
      sx={{ maxWidth: 1200, ml: 0, mr: "auto", width: "100%", textAlign: "left", py: { xs: 2, md: 4 }, pb: 12 }}
    >
      <Box component="section" aria-label="Today at a glance" sx={{
        ...deskCardSx,
        p: { xs: 5, md: 7 },
        background: "linear-gradient(135deg, var(--joy-palette-primary-50) 0%, var(--joy-palette-background-surface) 55%)",
        borderColor: "primary.100",
      }}>
        <Stack spacing={6}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={4} justifyContent="space-between" alignItems={{ md: "flex-end" }}>
            <Stack spacing={1.5} sx={{ minWidth: 0 }}>
              {headline === null ? <Skeleton variant="text" level="h2" width={320} /> : <Typography level="h2" component="h2">{headline}</Typography>}
              {!loading && <Typography level="body-lg" textColor="text.secondary" sx={{ maxWidth: 620 }}>{subline}</Typography>}
            </Stack>
            {heroAction}
          </Stack>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 3 }}>
            <Stat tone="warning" icon={<Scale size={20} aria-hidden />} value={loading ? null : String(needCount)} label="Need your decision" />
            <Stat tone="primary" icon={<Sprout size={20} aria-hidden />} value={open.isLoading ? null : `${handling.length}${handlingMore ? "+" : ""}`} label="Bloom is handling" />
            <Stat tone="success" icon={<CheckCircle2 size={20} aria-hidden />} value={resolved.isLoading ? null : String(doneToday.length)} label="Completed today" />
          </Box>
        </Stack>
      </Box>

      {loadError && <Alert color="warning" variant="soft" sx={{ borderRadius: "lg" }}>Some of today's work couldn't load. Refresh to try again.</Alert>}

      <form onSubmit={submitSearch} role="search">
        <Input
          size="lg"
          value={search}
          onChange={(e) => { setSearch(e.target.value); if (!e.target.value) setQuery(""); }}
          placeholder="Find a client, request number or problem…"
          startDecorator={<Search size={20} aria-hidden />}
          endDecorator={query ? <IconButton aria-label="Clear search" onClick={() => { setSearch(""); setQuery(""); }}><X size={18} /></IconButton> : <IconButton type="submit" aria-label="Search" variant="soft" color="primary"><ArrowRight size={18} /></IconButton>}
          sx={{ borderRadius: "xl", "--Input-minHeight": "52px", bgcolor: "background.surface", fontSize: "1rem" }}
          slotProps={{ input: { "aria-label": "Find a client, request number or problem" } }}
        />
      </form>

      {query && (
        <Section title="Search results">
          {results.isLoading ? <Skeleton variant="rectangular" height={120} sx={{ borderRadius: "xl" }} /> : results.data?.items.length ? (
            <RowList>{results.data.items.map((t) => <HandlingRow key={t.id} t={t} onOpen={onOpenTicket} />)}</RowList>
          ) : <Typography level="body-md" textColor="text.secondary">Nothing matches “{query}”.</Typography>}
        </Section>
      )}

      {(decisionsLoading || needCount > 0) && (
        <Section title="Needs your decision" tone="warning" count={decisionsLoading ? undefined : needCount}>
          {decisionsLoading
            ? <Skeleton variant="rectangular" height={220} sx={{ borderRadius: "xl" }} />
            : <DecisionList decisions={decisions} moreNeedsOwner={moreNeedsOwner} onOpenDesk={onOpenDesk} />}
        </Section>
      )}

      {!loading && !decisionsUnknown && needCount === 0 && (
        <Stack direction="row" spacing={4} alignItems="center" sx={{ ...deskCardSx, p: 6 }}>
          <Box sx={{ width: 48, height: 48, borderRadius: "50%", bgcolor: "success.100", color: "success.700", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}><Check size={24} aria-hidden /></Box>
          <div>
            <Typography level="title-lg">You're all caught up</Typography>
            <Typography level="body-md" textColor="text.secondary">No decisions are waiting. Bloom will email you when something needs a person.</Typography>
          </div>
        </Stack>
      )}

      <Section title="Bloom is handling" tone="primary" count={open.isLoading ? undefined : handling.length}>
        {open.isLoading ? <Skeleton variant="rectangular" height={160} sx={{ borderRadius: "xl" }} /> : handling.length ? (
          <RowList>{handling.slice(0, 8).map((t) => <HandlingRow key={t.id} t={t} onOpen={onOpenTicket} />)}</RowList>
        ) : <Typography level="body-md" textColor="text.secondary">Bloom isn't working on any requests right now.</Typography>}
        {(handling.length > 8 || handlingMore) && <Link component="button" level="body-md" onClick={onOpenDesk} sx={{ alignSelf: "flex-start" }}>See all of them in Requests</Link>}
      </Section>

      {doneToday.length > 0 && (
        <Section title="Completed today" tone="success" count={doneToday.length}>
          <RowList>
            {doneToday.map((t) => (
              <ClickRow key={t.id} onOpen={() => onOpenTicket(t.id)} label={`${clientName(t)}: ${t.resolution_summary ?? t.subject}`}>
                <Box sx={{ color: "success.600", display: "flex", flex: "0 0 auto" }}><CheckCircle2 size={20} aria-hidden /></Box>
                <Stack sx={{ flex: 1, minWidth: 0 }}>
                  <Typography level="title-md">{clientName(t)}</Typography>
                  <Typography level="body-md" textColor="text.secondary">{t.resolution_summary ?? t.subject}</Typography>
                </Stack>
              </ClickRow>
            ))}
          </RowList>
        </Section>
      )}

      <Box>
        <Button variant="plain" color="neutral" onClick={onOpenDesk} endDecorator={<ArrowRight size={18} />}>See every request</Button>
      </Box>
    </Stack>
  );
}

const TONE_COLOR: Record<"warning" | "primary" | "success", { bg: string; fg: string; border: string }> = {
  warning: { bg: "warning.50", fg: "warning.700", border: "warning.200" },
  primary: { bg: "primary.50", fg: "primary.800", border: "primary.200" },
  success: { bg: "success.50", fg: "success.700", border: "success.200" },
};

function Stat({ tone, icon, value, label }: { tone: "warning" | "primary" | "success"; icon: ReactNode; value: string | null; label: string }) {
  const c = TONE_COLOR[tone];
  return (
    <Stack direction="row" spacing={3} alignItems="center" sx={{ p: 4, borderRadius: "lg", bgcolor: "background.surface", border: "1px solid", borderColor: c.border }}>
      <Box sx={{ width: 44, height: 44, borderRadius: "lg", bgcolor: c.bg, color: c.fg, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>{icon}</Box>
      <Stack>
        {value === null ? <Skeleton variant="text" width={32} /> : <Typography level="h1" component="p" sx={{ color: c.fg }}>{value}</Typography>}
        <Typography level="body-md" textColor="text.secondary">{label}</Typography>
      </Stack>
    </Stack>
  );
}

function Section({ title, tone, count, children }: { title: string; tone?: "warning" | "primary" | "success"; count?: number; children: ReactNode }) {
  const dot = tone ? `${tone}.${tone === "primary" ? 500 : 400}` : "neutral.400";
  return (
    <Stack spacing={3} component="section" aria-label={title}>
      <Stack direction="row" spacing={2.5} alignItems="center">
        <Box aria-hidden sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: dot }} />
        <Typography level="h3" component="h2">{title}</Typography>
        {count !== undefined && <Typography level="body-md" textColor="text.tertiary">{count}</Typography>}
      </Stack>
      {children}
    </Stack>
  );
}

function RowList({ children }: { children: ReactNode }) {
  return <Box sx={{ ...deskCardSx, overflow: "hidden", "& > * + *": { borderTop: "1px solid", borderColor: "neutral.100" } }}>{children}</Box>;
}

function ClickRow({ onOpen, label, children }: { onOpen: () => void; label: string; children: ReactNode }) {
  return (
    <Stack
      direction="row" spacing={3.5} alignItems="center" role="button" tabIndex={0} aria-label={label}
      onClick={onOpen} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      sx={{ px: { xs: 4, sm: 5 }, py: 4, minHeight: 64, cursor: "pointer", transition: "background-color 120ms ease", "&:hover": { bgcolor: "neutral.50" }, "&:focus-visible": { outline: "3px solid", outlineColor: "primary.500", outlineOffset: -3 } }}
    >
      {children}
    </Stack>
  );
}

function HandlingRow({ t, onOpen }: { t: TicketSummary; onOpen: (id: string) => void }) {
  const status = friendlyStatus(t);
  return (
    <ClickRow onOpen={() => onOpen(t.id)} label={`${clientName(t)}: ${t.subject}. ${status.label}`}>
      <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography level="title-md">{clientName(t)}</Typography>
          <StatusPill tone={status.tone}>{status.label}</StatusPill>
        </Stack>
        <Typography level="body-md" textColor="text.primary" sx={{ overflowWrap: "anywhere" }}>{t.subject}</Typography>
        <Typography level="body-sm" textColor="text.secondary">
          <Box component="span" sx={{ fontWeight: 600, color: "primary.800" }}>Next: </Box>{bloomNextStep(t)}
        </Typography>
        <Typography level="body-xs" textColor="text.tertiary" sx={{ display: { sm: "none" } }}>Updated {ago(t.updated_at)}</Typography>
      </Stack>
      <Typography level="body-sm" textColor="text.tertiary" sx={{ flex: "0 0 auto", display: { xs: "none", sm: "block" }, alignSelf: "flex-start" }}>Updated {ago(t.updated_at)}</Typography>
    </ClickRow>
  );
}
