import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import Sheet from "@mui/joy/Sheet";
import Table from "@mui/joy/Table";
import Input from "@mui/joy/Input";
import Textarea from "@mui/joy/Textarea";
import Select from "@mui/joy/Select";
import Option from "@mui/joy/Option";
import Switch from "@mui/joy/Switch";
import Alert from "@mui/joy/Alert";
import Link from "@mui/joy/Link";
import Skeleton from "@mui/joy/Skeleton";
import Box from "@mui/joy/Box";
import { formatDistanceToNow } from "date-fns";
import { bloomSupport, PRODUCT_LABEL, type Whoami } from "@/lib/bloomSupport/api";
import { deskCardSx } from "./desk/deskStyles";
import { StatusPill } from "./desk/StatusPill";
import { ADMIN_INBOX_KEYS, adminAudienceLabel, adminInboxNames } from "@/lib/bloomSupport/adminLabels";
import { useAdminInboxNames } from "./useAdminInboxNames";
import { JoyEmptyState } from "@/components/joy/JoyEmptyState";
import { ChevronDown, Inbox, Search } from "lucide-react";
import { splitList, useAskDialog } from "./useAskDialog";
import { ClientPicker, type PickedClient } from "./ClientPicker";
import { ChatSpendPanel } from "./ChatSpendPanel";
import { ReadableData } from "@/components/admin/ReadableData";
import { labelFor } from "@/components/admin/readableFormat";
import { OPEN_BY, engineeringLabel, featureLabel, fixStage, problemLabel, reasonLabel, ticketStatusLabel } from "./labels";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import FormHelperText from "@mui/joy/FormHelperText";

const ROLE_LABEL: Record<string, string> = { platform_admin: "Admin", platform_operator: "Operator", support: "Support", client: "Client", service: "Automation" };
const GRANT_LABEL: Record<string, string> = { publish: "Publish websites", campaign_send: "Send email campaigns", event_manage: "Manage events", sensitive: "Sensitive details" };
const FEATURE_DECISIONS = [
  { value: "accepted", label: "Yes, we'll build it" },
  { value: "planned", label: "Add to the plan" },
  { value: "declined", label: "Not now" },
];

type Dur = { n: number; median_seconds?: number | null; p90_seconds?: number | null; median_business_seconds?: number | null; p90_business_seconds?: number | null };
interface Metrics {
  definitions: Record<string, string>;
  daily: Array<{ day: string; incoming: number; resolved: number; backlog: number }>;
  first_response: Dur; first_resolution: Dur; final_resolution: Dur;
  reopen_rate: { rate: number | null; reopened: number; denominator: number };
  overdue_now: number;
  handling: { by_person: number; by_bloom: number; verified_autonomous: number };
  automation: { dead_jobs: number; model_calls: number; model_tokens: number };
  open_by: { status: Record<string, number>; priority: Record<string, number>; product: Record<string, number> };
  age_distribution: Record<string, number>;
}

function useAction() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => { setError(null); qc.invalidateQueries({ queryKey: ["bloom-support"] }); },
    onError: (e: Error) => setError(e.message),
  });
  return { run: m.mutate, pending: m.isPending, error };
}

function Loading() {
  return <Stack spacing={1}><Skeleton variant="text" /><Skeleton variant="rectangular" height={120} /></Stack>;
}
function Empty({ title, description }: { title: string; description: string }) {
  return <JoyEmptyState icon={<Inbox size={28} />} title={title} description={description} />;
}
const ago = (d: unknown) => (typeof d === "string" ? formatDistanceToNow(new Date(d), { addSuffix: true }) : "");

/** Shared building blocks for the calm desk pages. */
function DeskSection({ title, count, tone, children }: { title: string; count?: number; tone?: "warning" | "primary"; children: React.ReactNode }) {
  return (
    <Stack spacing={3} component="section" aria-label={title}>
      <Stack direction="row" spacing={2.5} alignItems="center">
        {tone && <Box aria-hidden sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: tone === "warning" ? "warning.400" : "primary.500" }} />}
        <Typography level="h3" component="h2">{title}</Typography>
        {count !== undefined && <Typography level="body-md" textColor="text.tertiary">{count}</Typography>}
      </Stack>
      {children}
    </Stack>
  );
}
function Calm({ title, body }: { title: string; body: string }) {
  return (
    <Box sx={{ ...deskCardSx, p: { xs: 6, md: 8 }, textAlign: "center" }}>
      <Typography level="title-lg">{title}</Typography>
      <Typography level="body-md" textColor="text.secondary" sx={{ mt: 1, maxWidth: 520, mx: "auto" }}>{body}</Typography>
    </Box>
  );
}
function LoadFailed() {
  return <Alert color="warning" variant="soft">This page didn't load. Refresh to try again.</Alert>;
}
function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <Box sx={{ p: 3.5, borderRadius: "lg", bgcolor: "neutral.50" }}>
      <Typography level="h3" component="p">{value}</Typography>
      <Typography level="body-sm" textColor="text.secondary">{label}</Typography>
    </Box>
  );
}
function Row({ onOpen, label, selected, children }: { onOpen: () => void; label: string; selected?: boolean; children: React.ReactNode }) {
  return (
    <Stack
      direction="row" spacing={3} alignItems="center" role="button" tabIndex={0} aria-label={label} aria-current={selected ? "true" : undefined}
      onClick={onOpen} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      sx={{
        px: 5, py: 3.5, minHeight: 64, cursor: "pointer", borderBottom: "1px solid", borderColor: "neutral.100",
        borderLeft: "3px solid", borderLeftColor: selected ? "primary.500" : "transparent", bgcolor: selected ? "primary.50" : undefined,
        "&:last-of-type": { borderBottom: "none" },
        "&:hover": { bgcolor: selected ? "primary.50" : "neutral.50" },
        "&:focus-visible": { outline: "3px solid", outlineColor: "primary.500", outlineOffset: -3 },
      }}
    >
      {children}
    </Stack>
  );
}
function Disclosure({ label, defaultOpen = false, children }: { label: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Box>
      <Button variant="plain" color="neutral" aria-expanded={open} onClick={() => setOpen((v) => !v)} endDecorator={<ChevronDown size={18} aria-hidden style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 120ms ease" }} />} sx={{ ml: -2 }}>
        {label}
      </Button>
      {open && <Box sx={{ mt: 2 }}>{children}</Box>}
    </Box>
  );
}

export function EscalationsPanel({ me, onOpenTicket }: { me: Whoami; onOpenTicket: (id: string) => void }) {
  const q = useQuery({ queryKey: ["bloom-support", "escalations"], queryFn: () => bloomSupport.escalations() });
  const adminNames = useAdminInboxNames(me);
  const people = useQuery({ queryKey: ["bloom-support", "staff"], queryFn: () => bloomSupport.staff(), enabled: me.permissions.includes("tickets.read_all"), retry: false });
  const ownerName = (id: unknown) => { const p = (people.data ?? []).find((x) => x.id === id); return p ? (p.name?.trim() || p.email) : null; };
  const { run, error } = useAction();
  const { ask, dialog } = useAskDialog();
  if (q.isLoading) return <Loading />;
  if (q.error) return <Alert color="danger">{(q.error as Error).message}</Alert>;
  if (!q.data?.length) return <Empty title="Nothing waiting for an admin" description="Escalations, approvals and failed automation show up here." />;
  return (
    <Stack spacing={1}>
      {dialog}
      {error && <Alert color="danger">{error}</Alert>}
      {q.data.map((x) => {
        const ticket = x.ticket as { number: number; subject: string } | null;
        return (
          <Sheet key={String(x.id)} variant="outlined" sx={{ p: 1.5, borderRadius: "md" }}>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
              <div>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip size="sm" color="danger" variant="soft">{adminAudienceLabel(String(x.audience), adminNames, ownerName(x.owner_id))}</Chip>
                  <Typography level="title-sm">{reasonLabel(x.reason)}</Typography>
                  <Typography level="body-xs" textColor="text.tertiary">{ago(x.created_at)}</Typography>
                  {x.due_at ? <Chip size="sm" variant="outlined" color={Date.parse(String(x.due_at)) < Date.now() ? "danger" : "neutral"}>due {ago(x.due_at)}</Chip> : null}
                  {Number(x.fallback_level ?? 0) > 0 ? <Chip size="sm" color="warning">fallback {String(x.fallback_level)}</Chip> : null}
                  {String(x.status) === "acknowledged" ? <Chip size="sm" color="success" variant="soft">taken</Chip> : null}
                </Stack>
                {x.detail ? <Typography level="body-sm" sx={{ mt: 0.5, whiteSpace: "pre-wrap" }}>{String(x.detail)}</Typography> : null}
                {ticket && x.ticket_id ? <Link level="body-sm" component="button" onClick={() => onOpenTicket(String(x.ticket_id))}>#{ticket.number} {ticket.subject}</Link> : null}
              </div>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                {String(x.status) === "open" && <Button size="sm" variant="outlined" onClick={() => run(() => bloomSupport.acknowledgeEscalation(String(x.id)))}>Take it</Button>}
                <Button size="sm" onClick={async () => { const r = await ask({ title: "Record your decision", description: "Bloom follows this and lets the client know where it lands.", fields: [{ name: "decision", label: "What did you decide?", kind: "textarea", required: true, placeholder: "e.g. Refund the order and apologise for the delay." }], confirmLabel: "Save decision" }); if (r) run(() => bloomSupport.resolveEscalation(String(x.id), String(r.decision).trim())); }}>Record decision</Button>
              </Stack>
            </Stack>
          </Sheet>
        );
      })}
    </Stack>
  );
}

export function EngineeringPanel({ me, onOpenTicket }: { me: Whoami; onOpenTicket: (id: string) => void }) {
  const q = useQuery({ queryKey: ["bloom-support", "engineering"], queryFn: () => bloomSupport.engineering() });
  const { run, error } = useAction();
  if (q.isLoading) return <Loading />;
  if (q.error) return <LoadFailed />;
  if (!q.data?.length) return <Calm title="No fixes in progress" body="When Bloom investigates or fixes a bug, you can follow it here." />;
  const canApprove = me.permissions.includes("engineering.approve");
  const done = (s: string) => s === "verified";
  const active = q.data.filter((e) => !done(String(e.status)));
  const finished = q.data.filter((e) => done(String(e.status)));
  const card = (e: Record<string, unknown>) => {
    const elig = e.eligibility as { eligible?: boolean; reasons?: string[] } | null;
    const tickets = (e.tickets as Array<{ id: string; number: number }>) ?? [];
    const stage = fixStage(String(e.status));
    return (
      <Box key={String(e.id)} sx={{ ...deskCardSx, p: 5 }}>
        <Stack spacing={2.5}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography level="title-md" sx={{ flex: 1, minWidth: 200, overflowWrap: "anywhere" }}>{String(e.title)}</Typography>
            <StatusPill tone={stage.tone === "success" ? "done" : stage.tone === "warning" ? "attention" : stage.tone === "primary" ? "active" : "neutral"}>{stage.label}</StatusPill>
          </Stack>
          <Typography level="body-md" textColor="text.secondary">{engineeringLabel(e.status)}.</Typography>
          {elig && !elig.eligible && (elig.reasons ?? []).length > 0 && <Typography level="body-sm" textColor="text.secondary">Needs a person to release it: {(elig.reasons ?? []).slice(0, 2).join("; ")}.</Typography>}
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
            {tickets.length > 0 && <Typography level="body-sm" textColor="text.tertiary">For {tickets.map((t, i) => <span key={t.id}>{i ? ", " : ""}<Link component="button" onClick={() => onOpenTicket(t.id)}>#{t.number}</Link></span>)}</Typography>}
            {e.pr_url ? <Link href={String(e.pr_url)} target="_blank" rel="noopener" level="body-sm">See the change</Link> : null}
            {canApprove && String(e.status) === "awaiting_approval" ? <Button onClick={() => run(() => bloomSupport.updateEngineering(String(e.id), { status: "approved", note: "Approved in dashboard" }))} sx={{ ml: "auto" }}>Approve fix</Button> : null}
          </Stack>
        </Stack>
      </Box>
    );
  };
  return (
    <Stack spacing={6} sx={{ maxWidth: 900, pb: 8 }}>
      {error && <Alert color="warning" variant="soft">{error}</Alert>}
      {active.length > 0 ? <DeskSection title="In progress" count={active.length} tone="primary">{active.map(card)}</DeskSection> : <Calm title="Nothing in progress" body="Every fix Bloom started is live and checked." />}
      {finished.length > 0 && <Disclosure label={`Fixed and checked (${finished.length})`}><Stack spacing={3}>{finished.map(card)}</Stack></Disclosure>}
    </Stack>
  );
}

export function FeaturesPanel({ me, onOpenTicket }: { me: Whoami; onOpenTicket: (id: string) => void }) {
  const q = useQuery({ queryKey: ["bloom-support", "features"], queryFn: () => bloomSupport.features() });
  const { run, error } = useAction();
  const { ask, dialog } = useAskDialog();
  if (q.isLoading) return <Loading />;
  if (q.error) return <LoadFailed />;
  if (!q.data?.length) return <Calm title="No feature requests" body="When a client asks for something new, Bloom brings it here with the clients who asked." />;
  const canDecide = me.permissions.includes("features.decide");
  const waiting = q.data.filter((f) => String(f.status) === "awaiting_decision");
  const decided = q.data.filter((f) => String(f.status) !== "awaiting_decision");
  const card = (f: Record<string, unknown>) => {
    const evidence = (f.evidence as Array<{ ticket_id: string; number: number; account: string | null; excerpt: string | null }>) ?? [];
    const clients = new Set(evidence.map((x) => x.account ?? "unknown")).size;
    return (
      <Box key={String(f.id)} sx={{ ...deskCardSx, p: 5 }}>
        <Stack spacing={3}>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography level="title-lg" sx={{ flex: 1, minWidth: 200 }}>{String(f.title)}</Typography>
            <StatusPill tone={String(f.status) === "awaiting_decision" ? "attention" : String(f.status) === "declined" ? "neutral" : "active"}>{featureLabel(f.status)}</StatusPill>
          </Stack>
          <Typography level="body-md" textColor="text.secondary">{clients} {clients === 1 ? "client" : "clients"} asked for this.</Typography>
          {evidence.slice(0, 2).map((x) => (
            <Box key={x.ticket_id} sx={{ pl: 3, borderLeft: "3px solid", borderColor: "neutral.200" }}>
              <Typography level="body-md" sx={{ fontStyle: "italic" }}>“{(x.excerpt ?? "").slice(0, 160)}{(x.excerpt ?? "").length > 160 ? "…" : ""}”</Typography>
              <Typography level="body-sm" textColor="text.tertiary">{x.account ?? "Unknown client"} · <Link component="button" onClick={() => onOpenTicket(x.ticket_id)}>request #{x.number}</Link></Typography>
            </Box>
          ))}
          {evidence.length > 2 && <Typography level="body-sm" textColor="text.tertiary">and {evidence.length - 2} more {evidence.length - 2 === 1 ? "request" : "requests"}</Typography>}
          {f.decision_note ? <Typography level="body-sm" textColor="text.secondary" title={String(f.decision_note)} sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>Decision note: {String(f.decision_note)}</Typography> : null}
          {canDecide && String(f.status) === "awaiting_decision" && (
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
              {FEATURE_DECISIONS.map((dec) => (
                <Button key={dec.value} variant={dec.value === "declined" ? "outlined" : dec.value === "planned" ? "solid" : "soft"} color={dec.value === "declined" ? "neutral" : "primary"} onClick={async () => {
                  const r = await ask({ title: dec.label, description: "Bloom tells the clients who asked. Add a note if there is something they should know.", fields: [{ name: "note", label: "Note (optional)", kind: "textarea" }], confirmLabel: "Confirm" });
                  if (r) run(() => bloomSupport.decideFeature(String(f.id), dec.value, String(r.note).trim() || undefined));
                }}>{dec.label}</Button>
              ))}
            </Stack>
          )}
        </Stack>
      </Box>
    );
  };
  return (
    <Stack spacing={6} sx={{ maxWidth: 900, pb: 8 }}>
      {dialog}
      {error && <Alert color="warning" variant="soft">{error}</Alert>}
      {waiting.length > 0
        ? <DeskSection title="Waiting for your decision" count={waiting.length} tone="warning">{waiting.map(card)}</DeskSection>
        : <Calm title="Nothing waiting for a decision" body="Bloom brings new ideas here when clients ask for them." />}
      {decided.length > 0 && (
        <Disclosure label={`Already decided (${decided.length})`}>
          <Stack spacing={3}>{decided.map(card)}</Stack>
        </Disclosure>
      )}
    </Stack>
  );
}

export function ClientsPanel({ onOpenTicket }: { onOpenTicket: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const list = useQuery({ queryKey: ["bloom-support", "accounts", q], queryFn: () => bloomSupport.listAccounts(q || undefined) });
  const detail = useQuery({ queryKey: ["bloom-support", "account", selected], queryFn: () => bloomSupport.getAccount(selected!), enabled: !!selected });
  const { run, error } = useAction();
  const { ask, dialog } = useAskDialog();
  const d = detail.data;
  const links = (d?.links as Array<{ product: string; external_id: string; label: string | null }>) ?? [];
  const tickets = (d?.tickets as Array<{ id: string; number: number; subject: string; status: string; updated_at: string }>) ?? [];
  const members = (d?.members as Array<{ id: string; name: string | null; email: string | null; product: string | null; verified: boolean }>) ?? [];
  const domains = (d?.email_domains as string[]) ?? [];
  const openTickets = tickets.filter((t) => t.status !== "resolved");
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(300px, 380px) minmax(0, 1fr)" }, gap: 5, alignItems: "start", pb: 8 }}>
      {dialog}
      <Box sx={{ ...deskCardSx, overflow: "hidden", display: { xs: selected ? "none" : "block", md: "block" } }}>
        <Box sx={{ p: 4, borderBottom: "1px solid", borderColor: "neutral.100" }}>
          <Input startDecorator={<Search size={18} aria-hidden />} placeholder="Find a client by name" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a client by name" sx={{ borderRadius: "lg" }} />
        </Box>
        <Box role="list" aria-label="Clients" sx={{ maxHeight: { md: "calc(100dvh - 380px)" }, overflow: "auto" }}>
          {list.isLoading ? <Box sx={{ p: 4 }}><Loading /></Box> : (list.data ?? []).length === 0 ? (
            <Typography level="body-md" textColor="text.secondary" sx={{ p: 4 }}>No clients match “{q}”.</Typography>
          ) : (list.data ?? []).map((a) => (
            <Row key={a.id} selected={selected === a.id} onOpen={() => setSelected(a.id)} label={a.name}>
              <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
                <Typography level="title-md" noWrap>{a.name}</Typography>
                <Typography level="body-sm" textColor="text.secondary" noWrap>{a.links.map((l) => PRODUCT_LABEL[l.product] ?? l.product.toUpperCase()).join(" · ") || "No products linked"}</Typography>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ flex: "0 0 auto" }}>
                {a.needs_review && <StatusPill tone="attention">Check</StatusPill>}
                {a.open_tickets > 0 && <StatusPill tone="active">{a.open_tickets} open</StatusPill>}
              </Stack>
            </Row>
          ))}
        </Box>
      </Box>

      <Stack spacing={5} sx={{ minWidth: 0, display: { xs: selected ? "flex" : "none", md: "flex" } }}>
        {error && <Alert color="warning" variant="soft">{error}</Alert>}
        {!selected ? (
          <Calm title="Pick a client" body="You'll see their open requests, the people who contact you, and their linked products." />
        ) : detail.isLoading ? <Loading /> : d ? (
          <>
            <Box sx={{ ...deskCardSx, p: { xs: 5, md: 6 } }}>
              <Button variant="plain" color="neutral" size="sm" onClick={() => setSelected(null)} sx={{ display: { md: "none" }, mb: 2, ml: -2 }}>Back to clients</Button>
              <Typography level="h2" component="h2">{String(d.name)}</Typography>
              <Typography level="body-md" textColor="text.secondary" sx={{ mt: 1 }}>
                {links.length ? links.map((l) => `${PRODUCT_LABEL[l.product] ?? l.product}${l.label ? `: ${l.label}` : ""}`).join(" · ") : "No products linked yet"}
              </Typography>
              <Box sx={{ mt: 5, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 3 }}>
                <MiniStat value={String(openTickets.length)} label="Open requests" />
                <MiniStat value={String(tickets.length)} label="All requests" />
                <MiniStat value={String(members.length)} label="People" />
              </Box>
            </Box>

            <DeskSection title="Requests" count={tickets.length}>
              {tickets.length === 0 ? <Typography level="body-md" textColor="text.secondary">No requests from this client yet.</Typography> : (
                <Box sx={{ ...deskCardSx, overflow: "hidden" }}>
                  {tickets.slice(0, 12).map((t) => (
                    <Row key={t.id} onOpen={() => onOpenTicket(t.id)} label={`#${t.number} ${t.subject}`}>
                      <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
                        <Typography level="body-md" sx={{ overflowWrap: "anywhere" }}>{t.subject}</Typography>
                        <Typography level="body-sm" textColor="text.tertiary">#{t.number} · updated {ago(t.updated_at)}</Typography>
                      </Stack>
                      <StatusPill tone={t.status === "resolved" ? "done" : t.status === "needs_owner" ? "attention" : t.status === "waiting" ? "waiting" : "active"}>{ticketStatusLabel(t.status)}</StatusPill>
                    </Row>
                  ))}
                </Box>
              )}
            </DeskSection>

            <DeskSection title="People" count={members.length}>
              {members.length === 0 ? <Typography level="body-md" textColor="text.secondary">No contacts saved yet.</Typography> : (
                <Box sx={{ ...deskCardSx, overflow: "hidden", "& > * + *": { borderTop: "1px solid", borderColor: "neutral.100" } }}>
                  {members.map((m) => (
                    <Stack key={m.id} direction="row" spacing={3} alignItems="center" sx={{ px: 5, py: 3.5 }}>
                      <Stack sx={{ minWidth: 0, flex: 1 }}>
                        <Typography level="title-sm">{m.name ?? m.email ?? "Unknown"}</Typography>
                        <Typography level="body-sm" textColor="text.secondary" sx={{ overflowWrap: "anywhere" }}>{m.email ?? "No email"}{m.product ? ` · ${PRODUCT_LABEL[m.product] ?? m.product}` : ""}</Typography>
                      </Stack>
                      <StatusPill tone={m.verified ? "done" : "neutral"}>{m.verified ? "Verified" : "Not verified"}</StatusPill>
                    </Stack>
                  ))}
                </Box>
              )}
            </DeskSection>

            <Box sx={{ ...deskCardSx, p: 5 }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={3} justifyContent="space-between" alignItems={{ sm: "center" }}>
                <Stack spacing={0.5}>
                  <Typography level="title-md">Email domains</Typography>
                  <Typography level="body-sm" textColor="text.secondary">
                    {domains.length ? `Email from ${domains.join(", ")} is linked to this client.` : "Add the client's email domains so new emails link to them automatically."}
                  </Typography>
                </Stack>
                <Button variant="outlined" color="neutral" onClick={async () => {
                  const r = await ask({ title: "Email domains", description: "Emails from these domains are linked to this client automatically (they still count as unverified).", fields: [{ name: "domains", label: "Domains", kind: "textarea", placeholder: "e.g. greenleafgardens.com, greenleaf.ca", helper: "Separate with commas or new lines.", initial: domains.join(", ") }], confirmLabel: "Save domains" });
                  if (r) run(() => bloomSupport.updateAccount(selected, { email_domains: splitList(r.domains), needs_review: false }));
                }}>{domains.length ? "Edit domains" : "Add domains"}</Button>
              </Stack>
            </Box>

            <Disclosure label="Technical details">
              <Typography level="body-sm" textColor="text.secondary">Account {String(d.id)}{d.crm_tenant_id ? ` · CRM tenant ${String(d.crm_tenant_id)}` : ""}</Typography>
              {links.map((l) => <Typography key={`${l.product}-${l.external_id}`} level="body-sm" textColor="text.secondary">{PRODUCT_LABEL[l.product] ?? l.product}: {l.external_id}</Typography>)}
            </Disclosure>
          </>
        ) : null}
      </Stack>
    </Box>
  );
}

const OPERATION_INFO: Record<string, { label: string; help: string; template?: Record<string, unknown> }> = {
  "client.lookup": { label: "Look up the client's linked accounts", help: "Shows which website, CRM and POS accounts belong to this client." },
  "campaign.list": { label: "List email campaigns", help: "Every campaign, newest first. Optionally filter by status.", template: { status: "" } },
  "campaign.read": { label: "See one email campaign", help: "Details of a single campaign.", template: { campaign_id: "" } },
  "campaign.create_draft": { label: "Create a draft email campaign", help: "Starts a new draft. Nothing is sent." },
  "campaign.update_draft": { label: "Edit a draft email campaign", help: "Changes a draft. Can be undone.", template: { campaign_id: "" } },
  "campaign.schedule": { label: "Schedule an email campaign", help: "Sets when a campaign is sent. Can be undone until it sends.", template: { campaign_id: "", scheduled_at: "2026-11-03T15:00:00Z", timezone: "America/Vancouver" } },
  "campaign.unschedule": { label: "Cancel a scheduled campaign", help: "Stops a scheduled send. Can be undone.", template: { campaign_id: "" } },
  "site.read": { label: "See the client's website", help: "Basic details of their website." },
  "site.integration_health": { label: "Verify CounterPoint and Open Plant Data", help: "Read-only check of connection health, latest sync activity and OPD link counts. Never claims a customer workflow works without a test." },
  "site.pages": { label: "List website pages", help: "Every page on their website." },
  "site.create_draft": { label: "Create a draft website", help: "Starts a draft site. Nothing goes live." },
  "site.page.update": { label: "Edit a website page", help: "Changes a page. Can be undone." },
  "site.publish": { label: "Publish the website", help: "Makes saved changes live. Can be undone." },
  "site.section.update": { label: "Change a section's words, buttons or images", help: "Saves to the page draft only. Nothing goes live until the page is published. Can be undone.", template: { content_id: "", section_key: "", patch: { heading: "New heading text" } } },
  "site.section.reorder": { label: "Reorder a page's sections", help: "Saves to the page draft only. List every section in the new order. Can be undone.", template: { content_id: "", order: ["hero", "features", "footer"] } },
  "site.section.visibility": { label: "Show or hide a section", help: "Saves to the page draft only. Required sections can't be hidden. Can be undone.", template: { content_id: "", section_key: "", visible: true } },
  "site.theme.update": { label: "Change the website's colours, fonts, header or footer", help: "Saved as a theme draft. Nothing changes on the live site until the theme draft is published. Can be undone.", template: { patch: { colors: { primary: "#2F5D50" } } } },
  "site.theme.publish": { label: "Publish the theme draft", help: "Makes the prepared colours, fonts, header and footer live. Can be undone.", template: {} },
  "site.theme.discard": { label: "Throw away the theme draft", help: "Removes the prepared theme changes. The live site is not affected. Can be undone.", template: {} },
  "site.blog.create": { label: "Write a draft blog post", help: "Creates an unpublished post with a private preview link. Nothing goes live until the post is published. Images must already be in the site's media. Can be undone.", template: { title: "Spring planting tips", excerpt: "", body: "First paragraph.\n\nSecond paragraph." } },
  "site.blog.update": { label: "Edit a blog post", help: "The article text saves to the post's draft. Title, address, excerpt, tags and image can change only while the post is unpublished. Can be undone.", template: { post_id: "", body: "New article text." } },
  "site.blog.publish": { label: "Publish a blog post", help: "Makes the post's draft live on the blog. Can be undone.", template: { post_id: "" } },
  "site.seo.update": { label: "Change a page's search listing (SEO)", help: "Sets the title and description search engines show, and the share image. Saved straight to the live page, so it needs publish access. Can be undone.", template: { content_id: "", title: "", description: "" } },
  "site.navigation.update": { label: "Change the website's menu", help: "List the whole menu in its new order. Keep an item's id to keep or rename it, leave id out to add one, and leave an item out to remove it. Links must be one of the site's own published pages or an https link. Saved as a menu draft. Nothing changes on the live site until the menu is published. Can be undone.", template: { items: [{ id: "home", label: "Home" }, { label: "Visit us", href: "/contact" }] } },
  "site.navigation.publish": { label: "Publish the menu draft", help: "Makes the prepared menu live. It refuses if the owner has unpublished menu changes of their own. Can be undone.", template: {} },
  "site.navigation.discard": { label: "Throw away the menu draft", help: "Removes the prepared menu. The live site is not affected. Can be undone.", template: {} },
  "site.image.replace": { label: "Swap an image on a page", help: "Replaces one image, for example a hero background, with one already in this site's own media. Saves to the page draft only. Nothing goes live until the page is published. Can be undone.", template: { content_id: "", section_key: "hero", field: "backgroundImage", media_url: "" } },
  "site.preview_link": { label: "Get a page's preview link", help: "A private link to see draft changes before they're published.", template: { content_id: "" } },
  "event.list": { label: "List events", help: "Their upcoming and past events." },
  "event.update": { label: "Edit an event", help: "Changes an event. Can be undone." },
  "pos.products": { label: "List POS products", help: "Products in their point-of-sale system." },
  "pos.inventory": { label: "Check POS stock levels", help: "Current stock in their point-of-sale system." },
  "pos.sales_summary": { label: "POS sales summary", help: "Recent sales totals from their point-of-sale system." },
  "pos.price_history": { label: "POS price history", help: "Who changed one product's price, and when. Find the variant with List POS products first.", template: { variant_id: "" } },
};
const opLabel = (kind: string) => OPERATION_INFO[kind]?.label ?? labelFor(kind);

function IntegrationHealthSummary({ value }: { value: unknown }) {
  const data = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const cp = data.counterpoint && typeof data.counterpoint === "object" ? data.counterpoint as Record<string, unknown> : {};
  const opd = data.opd && typeof data.opd === "object" ? data.opd as Record<string, unknown> : {};
  const describe = (v: unknown) => typeof v === "string" && v.length < 90 ? v.replaceAll("_", " ") : "Not recorded";
  const amount = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v.toLocaleString("en-CA") : "Not recorded";
  const concerns = Array.isArray(data.findings) ? data.findings.filter((x): x is string => typeof x === "string").slice(0, 5) : [];
  return (
    <Stack spacing={1.5}>
      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
        <Typography level="title-md">Integration health</Typography>
        <Chip variant="soft" color={data.assessment === "needs_attention" ? "warning" : "neutral"}>
          {data.assessment === "needs_attention" ? "Needs attention" : "Not fully verified"}
        </Chip>
      </Stack>
      <Typography level="body-sm"><strong>CounterPoint:</strong> {describe(cp.connection_status)} connection, health {describe(cp.connection_health)}. Last successful receipt: {describe(cp.last_success_at)}.</Typography>
      <Typography level="body-sm"><strong>Catalogue sync:</strong> {describe(cp.catalogue_sync_status)}. Receiving a batch does not establish that it reached the shop.</Typography>
      <Typography level="body-sm"><strong>Open Plant Data:</strong> {opd.enabled === true ? "Enabled" : "Not enabled or not configured"}. {amount(opd.imported_links)} imported, {amount(opd.approved_links)} approved, {amount(opd.failed_links)} failed.</Typography>
      {concerns.map((item, i) => <Typography key={i} level="body-sm">{item}</Typography>)}
      <Typography level="body-xs" sx={{ color: "text.tertiary" }}>Read-only information from BloomSites. Confirm the original customer workflow before reporting a complete fix. No integration settings or customer data were changed.</Typography>
    </Stack>
  );
}

export function OperationsPanel() {
  const catalog = useQuery({ queryKey: ["bloom-support", "ops-catalog"], queryFn: () => bloomSupport.operationsCatalog() });
  const [client, setClient] = useState<PickedClient | null>(null);
  const [kind, setKind] = useState("campaign.list");
  const [inputs, setInputs] = useState(JSON.stringify(OPERATION_INFO["campaign.list"].template ?? {}, null, 2));
  const [output, setOutput] = useState<unknown>(null);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [task, setTask] = useState<{ticket_id:string;number:number} | null>(null);
  const { run, error, pending } = useAction();
  const isRead = catalog.data?.reads.some((r) => r.kind === kind);
  const parsed = () => { try { return JSON.parse(inputs || "{}"); } catch { throw new Error("The details box isn't filled in correctly. Keep the quotes and braces as shown."); } };
  const accountId = client?.id ?? "";
  const recentTasks = useQuery({
    queryKey: ["bloom-support","integration-tasks",accountId],
    queryFn: () => bloomSupport.listTickets({ account_id: accountId, q: "Integration investigation", view: "open" }),
    enabled: Boolean(accountId),
    staleTime: 30_000,
  });
  const pick = (k: string) => { setKind(k); setInputs(JSON.stringify(OPERATION_INFO[k]?.template ?? {}, null, 2)); setOutput(null); setPreview(null); setTask(null); };
  return (
    <Stack spacing={2} sx={{ maxWidth: 820 }}>
      {catalog.data && Object.entries(catalog.data.remote).filter(([, v]) => !v.configured).map(([k]) => (
        <Alert key={k} color="warning" variant="soft">{k === "cms" ? "Website" : "POS"} actions aren't connected yet. Ask a developer to finish the setup (see Setup check).</Alert>
      ))}
      <Sheet variant="outlined" sx={{ p: 2.5, borderRadius: "lg", bgcolor: "background.surface" }}>
        <Stack spacing={2}>
          <FormControl required>
            <FormLabel>1. Which client?</FormLabel>
            <ClientPicker value={client} onChange={(c) => { setClient(c); setOutput(null); setPreview(null); setTask(null); }} />
          </FormControl>
          {client && catalog.data?.reads.some((o) => o.kind === "site.integration_health") && (
            <Sheet variant="soft" sx={{ p: 2, borderRadius: "md" }}>
              <Stack spacing={1}>
                <Typography level="title-sm">Check this client's integrations</Typography>
                <Typography level="body-sm">Bloom will review CounterPoint and Open Plant Data status without changing anything.</Typography>
                <Button variant="solid" color="neutral" loading={pending} disabled={!accountId || pending} sx={{ alignSelf: "flex-start", borderRadius: "xl" }}
                  onClick={() => run(async () => {
                    setKind("site.integration_health");
                    setInputs("{}");
                    setPreview(null);
                    setOutput(await bloomSupport.readOperation({ kind: "site.integration_health", account_id: accountId, inputs: {} }));
                  })}>Verify integrations</Button>
                <Button variant="outlined" color="neutral" loading={pending} disabled={!accountId || pending || Boolean(task)}
                  sx={{ alignSelf:"flex-start", borderRadius:"xl" }}
                  onClick={() => run(async () => {
                    const result = await bloomSupport.startIntegrationTask({
                      account_id: accountId, idempotency_key: crypto.randomUUID(),
                    });
                    setKind("site.integration_health");
                    setInputs("{}"); setPreview(null);
                    setOutput(result.evidence); setTask({ticket_id:result.ticket_id,number:result.number});
                  })}>Record an investigation</Button>
                <Typography level="body-xs" textColor="text.tertiary">Creates one internal support task with evidence. Bloom cannot repair or contact the client without the separate approval process.</Typography>
                {task && (
                  <Typography level="body-sm">
                    Saved as <Link href={`/admin/bloom-support?view=queue&ticket=${encodeURIComponent(task.ticket_id)}`}>
                      investigation #{task.number}
                    </Link>. Follow its status in the Support desk.
                  </Typography>
                )}
                {!!recentTasks.data?.length && (
                  <Stack spacing={0.5}>
                    <Typography level="title-sm">Open investigations for this client</Typography>
                    {recentTasks.data.filter(t => t.subject.startsWith("Integration investigation:")).slice(0,5).map(t => (
                      <Typography key={t.id} level="body-sm">
                        <Link href={`/admin/bloom-support?view=queue&ticket=${encodeURIComponent(t.id)}`}>
                          #{t.number} · {t.subject}
                        </Link> · {ticketStatusLabel(t.status)}
                      </Typography>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Sheet>
          )}
          <FormControl required>
            <FormLabel>2. What do you want to do?</FormLabel>
            <Select value={kind} onChange={(_, v) => v && pick(v)}>
              {catalog.data?.reads.length ? <Option key="__reads" value="__reads" disabled>Look things up (safe, changes nothing)</Option> : null}
              {(catalog.data?.reads ?? []).map((o) => <Option key={o.kind} value={o.kind} label={opLabel(o.kind)}>{opLabel(o.kind)}</Option>)}
              {catalog.data?.changes.length ? <Option key="__changes" value="__changes" disabled>Make a change (you see a preview first)</Option> : null}
              {(catalog.data?.changes ?? []).map((o) => <Option key={o.kind} value={o.kind} label={opLabel(o.kind)}>{opLabel(o.kind)}{o.undo ? " · can be undone" : ""}</Option>)}
            </Select>
            {OPERATION_INFO[kind] && <FormHelperText>{OPERATION_INFO[kind].help}</FormHelperText>}
          </FormControl>
          <FormControl>
            <FormLabel>3. Details</FormLabel>
            <Textarea minRows={3} value={inputs} onChange={(e) => setInputs(e.target.value)} sx={{ fontFamily: "monospace" }} />
            <FormHelperText>Fill in the values between the quotes. Leave as {"{}"} when nothing is needed.</FormHelperText>
          </FormControl>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {isRead
              ? <Button size="lg" sx={{ borderRadius: "xl" }} loading={pending} disabled={!accountId} onClick={() => run(async () => setOutput(await bloomSupport.readOperation({ kind, account_id: accountId, inputs: parsed() })))}>Look it up</Button>
              : <Button size="lg" sx={{ borderRadius: "xl" }} loading={pending} disabled={!accountId} onClick={() => run(async () => { const p = await bloomSupport.previewOperation({ kind, account_id: accountId, inputs: parsed() }); setPreview(p); setOutput(p.preview); })}>Show me a preview</Button>}
            {preview && String(preview.status) === "previewed" && (
              <Button size="lg" color="danger" sx={{ borderRadius: "xl" }} loading={pending} onClick={() => run(async () => { const r = await bloomSupport.executeOperation(String(preview.id)); setPreview(r); setOutput(r); })}>Yes, make this change</Button>
            )}
            {preview && String(preview.status) === "succeeded" && preview.undo ? (
              <Button size="lg" variant="outlined" sx={{ borderRadius: "xl" }} onClick={() => run(async () => { const r = await bloomSupport.undoOperation(String(preview.id)); setPreview(r); setOutput(r); })}>Undo</Button>
            ) : null}
          </Stack>
        </Stack>
      </Sheet>
      {error && <Alert color="danger">{error}</Alert>}
      {output !== null && (
        <Sheet variant="soft" sx={{ p: 2, borderRadius: "lg", overflow: "auto", maxHeight: 520 }}>
          <Typography level="title-sm" sx={{ mb: 1 }}>{preview && String(preview.status) === "previewed" ? "This is what will change" : "Result"}</Typography>
          {kind === "site.integration_health" ? <IntegrationHealthSummary value={output} /> : <ReadableData value={output} />}
        </Sheet>
      )}
    </Stack>
  );
}

export function SettingsPanel({ me }: { me: Whoami }) {
  const settings = useQuery({ queryKey: ["bloom-support", "settings"], queryFn: () => bloomSupport.settings() });
  const health = useQuery({ queryKey: ["bloom-support", "health"], queryFn: () => bloomSupport.health() });
  const staff = useQuery({ queryKey: ["bloom-support", "staff"], queryFn: () => bloomSupport.staff() });
  const keys = useQuery({ queryKey: ["bloom-support", "keys"], queryFn: () => bloomSupport.keys() });
  const jobs = useQuery({ queryKey: ["bloom-support", "jobs", "failed,dead"], queryFn: () => bloomSupport.jobs("failed,dead"), enabled: me.permissions.includes("automation.control") });
  const [newKey, setNewKey] = useState<string | null>(null);
  const { run, error } = useAction();
  const { ask, dialog } = useAskDialog();
  const isAdmin = me.permissions.includes("admin.policy");
  const s = settings.data ?? {};
  const inboxNames = adminInboxNames(s.owners, staff.data);
  const people = (staff.data ?? []).filter((p) => p.kind === "user");
  const activeKeys = (keys.data ?? []).filter((k) => !k.revoked_at);
  const revokedKeys = (keys.data ?? []).filter((k) => k.revoked_at);
  const toggle = (key: string, label: string, help: string, allowed: boolean) => (
    <Stack direction="row" spacing={4} alignItems="center" justifyContent="space-between" sx={{ py: 3.5 }}>
      <Stack spacing={0.5} sx={{ minWidth: 0 }}>
        <Typography level="title-md">{label}</Typography>
        <Typography level="body-sm" textColor="text.secondary">{help}</Typography>
      </Stack>
      <Switch size="lg" checked={s[key] === true} disabled={!allowed} onChange={(e) => run(() => bloomSupport.setSetting(key, e.target.checked))} slotProps={{ input: { "aria-label": label } }} />
    </Stack>
  );
  return (
    <Stack spacing={7} sx={{ maxWidth: 900, pb: 8 }}>
      {dialog}
      {error && <Alert color="warning" variant="soft">{error}</Alert>}

      {jobs.data && jobs.data.length > 0 && (
        <DeskSection title="Automatic steps that failed" count={jobs.data.length} tone="warning">
          <Typography level="body-md" textColor="text.secondary">Bloom stopped retrying these. Try again once the cause is fixed, or cancel them.</Typography>
          <Box sx={{ ...deskCardSx, overflow: "hidden", "& > * + *": { borderTop: "1px solid", borderColor: "neutral.100" } }}>
            {jobs.data.map((j) => (
              <Stack key={String(j.id)} direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} sx={{ px: 5, py: 3.5 }}>
                <Stack sx={{ minWidth: 0, flex: 1 }}>
                  <Typography level="title-sm">{labelFor(String(j.kind))}</Typography>
                  {j.last_error ? <Typography level="body-sm" textColor="text.secondary" sx={{ overflowWrap: "anywhere" }}>{String(j.last_error).slice(0, 160)}</Typography> : null}
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Button size="sm" variant="soft" color="primary" onClick={() => run(() => bloomSupport.controlJob(String(j.id), "retry"))}>Try again</Button>
                  <Button size="sm" variant="plain" color="neutral" onClick={() => run(() => bloomSupport.controlJob(String(j.id), "cancel"))}>Cancel</Button>
                </Stack>
              </Stack>
            ))}
          </Box>
        </DeskSection>
      )}

      <DeskSection title="Bloom">
        <Box sx={{ ...deskCardSx, px: 5, "& > * + *": { borderTop: "1px solid", borderColor: "neutral.100" } }}>
          {toggle("automation_enabled", "Bloom works on requests", "Turn off to pause everything Bloom does in the background. Work already running finishes.", me.permissions.includes("automation.control"))}
          {toggle("client_email_enabled", "Email clients", "Turn off to record client emails without sending them. Useful for testing.", isAdmin)}
          {toggle("auto_release_enabled", "Release safe fixes automatically", "Only fixes that pass every safety rule. Anything sensitive still waits for a person.", isAdmin)}
        </Box>
        {health.data && health.data.missing_configuration.length > 0 && (
          <Typography level="body-sm" textColor="text.secondary">Still to set up: {health.data.missing_configuration.map((x) => labelFor(x)).join(", ")}. See System status for details.</Typography>
        )}
      </DeskSection>

      {isAdmin && (
        <DeskSection title="Where admins get alerts">
          <Box sx={{ ...deskCardSx, p: 5 }}>
            <Typography level="body-md" textColor="text.secondary">Bloom emails these addresses when something needs an admin.</Typography>
            <Stack spacing={1.5} sx={{ mt: 3 }}>
              {ADMIN_INBOX_KEYS.map((who) => (
                <Detail key={who} label={adminAudienceLabel(who, inboxNames)} value={(((s.owners as Record<string, string[]>) ?? {})[who] ?? []).join(", ") || "Not set"} />
              ))}
            </Stack>
            <Button variant="outlined" color="neutral" sx={{ mt: 4 }} onClick={async () => {
              const owners = (s.owners as { jon?: string[]; jeff?: string[] }) ?? {};
              const r = await ask({ title: "Alert addresses", fields: [
                { name: "jon", label: `${adminAudienceLabel("jon", inboxNames)}: email`, kind: "text", helper: "Separate several with commas.", initial: (owners.jon ?? []).join(", ") },
                { name: "jeff", label: `${adminAudienceLabel("jeff", inboxNames)}: email`, kind: "text", helper: "Separate several with commas.", initial: (owners.jeff ?? []).join(", ") },
              ], confirmLabel: "Save" });
              if (r) run(() => bloomSupport.setSetting("owners", { jon: splitList(r.jon), jeff: splitList(r.jeff) }));
            }}>Change addresses</Button>
          </Box>
        </DeskSection>
      )}

      <DeskSection title="People" count={people.length}>
        <Box sx={{ ...deskCardSx, overflow: "hidden", "& > * + *": { borderTop: "1px solid", borderColor: "neutral.100" } }}>
          {people.map((p) => (
            <Stack key={p.id} direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }} sx={{ px: 5, py: 3.5 }}>
              <Stack sx={{ minWidth: 0, flex: 1 }}>
                <Typography level="title-sm">{p.name ?? p.email}</Typography>
                <Typography level="body-sm" textColor="text.secondary" sx={{ overflowWrap: "anywhere" }}>{p.email}{p.grants.length ? ` · can also ${p.grants.map((g) => (GRANT_LABEL[g] ?? g).toLowerCase()).join(", ")}` : ""}</Typography>
              </Stack>
              {me.permissions.includes("admin.roles") && p.id !== me.id ? (
                <Select size="sm" value={p.role} aria-label={`Role for ${p.name ?? p.email}`} onChange={(_, v) => v && run(() => bloomSupport.setRole({ principal_id: p.id, role: v }))} sx={{ minWidth: 150 }}>
                  {["platform_admin", "platform_operator", "support", "client"].map((r) => <Option key={r} value={r}>{ROLE_LABEL[r] ?? r}</Option>)}
                </Select>
              ) : <StatusPill tone="neutral">{ROLE_LABEL[p.role] ?? p.role}</StatusPill>}
            </Stack>
          ))}
        </Box>
        {me.permissions.includes("admin.roles") && (
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            <Button variant="outlined" color="neutral" onClick={async () => {
              const r = await ask({ title: "Add a team member", description: "They must have signed in to BloomSuite at least once.", fields: [
                { name: "email", label: "Their email", kind: "email", required: true },
                { name: "role", label: "What can they do?", kind: "select", required: true, initial: "support", options: [
                  { value: "support", label: "Support", hint: "Handles client requests" },
                  { value: "platform_operator", label: "Operator", hint: "Support plus account changes and fixes" },
                  { value: "platform_admin", label: "Admin", hint: "Everything, including settings and people" },
                ] },
              ], confirmLabel: "Add" });
              if (r) run(() => bloomSupport.setRole({ email: String(r.email).trim(), role: String(r.role) }));
            }}>Add a team member</Button>
            <Button variant="plain" color="neutral" onClick={async () => {
              const r = await ask({ title: "Extra permissions", description: "For Support team members who need to do a bit more.", fields: [
                { name: "email", label: "Their email", kind: "email", required: true },
                { name: "grants", label: "Allow them to", kind: "checkboxes", options: [
                  { value: "publish", label: "Publish websites" },
                  { value: "campaign_send", label: "Send email campaigns" },
                  { value: "event_manage", label: "Manage events" },
                  { value: "sensitive", label: "See sensitive account details" },
                ] },
              ], confirmLabel: "Save permissions" });
              if (r) run(() => bloomSupport.setRole({ email: String(r.email).trim(), grants: r.grants as string[] }));
            }}>Give extra permissions</Button>
          </Stack>
        )}
      </DeskSection>

      <Disclosure label="Connect ChatGPT and other tools">
        <Stack spacing={3}>
          <Typography level="body-sm" textColor="text.secondary">Each person uses their own key, with their own permissions. Read-only keys can't change anything.</Typography>
          <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
            <Button size="sm" onClick={() => run(async () => setNewKey((await bloomSupport.createKey({ label: "ChatGPT", scopes: ["*"] })).token))}>New full key</Button>
            <Button size="sm" variant="outlined" color="neutral" onClick={() => run(async () => setNewKey((await bloomSupport.createKey({ label: "ChatGPT (read-only)", scopes: ["read"] })).token))}>New read-only key</Button>
            {me.permissions.includes("admin.roles") && (
              <Button size="sm" variant="plain" color="neutral" onClick={() => run(async () => {
                // A dedicated service identity that can only record repair outcomes
                // (engineering.report). This is the key the repair workflow's
                // BLOOM_REPAIR_REPORT_KEY secret should hold, never a person's key.
                const principalId = await bloomSupport.createServiceIdentity("Bloom repair report", "repair_report");
                setNewKey((await bloomSupport.createKey({ label: "Bloom repair report", principal_id: principalId })).token);
              })}>New repair report key</Button>
            )}
          </Stack>
          {newKey && <Alert color="success" variant="soft" sx={{ wordBreak: "break-all" }}>Copy this now. It is shown once: {newKey}</Alert>}
          {activeKeys.map((k) => (
            <Stack key={String(k.id)} direction="row" spacing={2} justifyContent="space-between" alignItems="center">
              <Typography level="body-sm" sx={{ overflowWrap: "anywhere" }}>{String(k.label)} · {String(k.principal)} · {(k.scopes as string[]).includes("read") ? "read-only" : "full"} · last used {k.last_used_at ? ago(k.last_used_at) : "never"}</Typography>
              <Button size="sm" variant="plain" color="neutral" onClick={() => run(() => bloomSupport.revokeKey(String(k.id)))}>Turn off</Button>
            </Stack>
          ))}
          {revokedKeys.length > 0 && <Typography level="body-xs" textColor="text.tertiary">{revokedKeys.length} old {revokedKeys.length === 1 ? "key is" : "keys are"} turned off.</Typography>}
        </Stack>
      </Disclosure>

      {isAdmin && <Disclosure label="AI spending"><ChatSpendPanel /></Disclosure>}

      <Disclosure label="Advanced settings">
        <Typography level="body-sm" textColor="text.secondary" sx={{ mb: 3 }}>Response targets, business hours, notifications and limits. Change these only if you know what each value does.</Typography>
        <SupportConfigPanel me={me} />
      </Disclosure>
    </Stack>
  );
}

export function ProblemsPanel({ onOpenTicket }: { onOpenTicket: (id: string) => void }) {
  const q = useQuery({ queryKey: ["bloom-support", "problems"], queryFn: () => bloomSupport.problems() });
  const { run, error } = useAction();
  const { ask, dialog } = useAskDialog();
  if (q.isLoading) return <Loading />;
  if (q.error) return <LoadFailed />;
  return (
    <Stack spacing={5} sx={{ maxWidth: 900, pb: 8 }}>
      {dialog}
      {error && <Alert color="warning" variant="soft">{error}</Alert>}
      <Box><Button variant="outlined" color="neutral" onClick={async () => { const r = await ask({ title: "New shared problem", description: "Group requests from several clients about the same issue, so it is fixed once.", fields: [{ name: "title", label: "What's the problem?", kind: "text", required: true, placeholder: "e.g. Checkout fails on phones" }], confirmLabel: "Create" }); if (r) run(() => bloomSupport.createProblem({ title: String(r.title).trim() })); }}>New shared problem</Button></Box>
      {!q.data?.length && <Calm title="No shared problems" body="When several clients hit the same issue, group their requests here. Bloom investigates once and still talks to each client privately." />}
      {(q.data ?? []).map((p) => {
        const tickets = (p.tickets as Array<{ id: string; number: number; status: string; account: string | null }>) ?? [];
        const eng = p.engineering as { status: string; pr_url: string | null } | null;
        const clients = new Set(tickets.map((t) => t.account)).size;
        return (
          <Box key={String(p.id)} sx={{ ...deskCardSx, p: 5 }}>
            <Stack spacing={2.5}>
              <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography level="title-md" sx={{ flex: 1, minWidth: 200 }}>{String(p.title)}</Typography>
                {p.kind === "incident" && <StatusPill tone="attention">Incident</StatusPill>}
                <StatusPill tone={["resolved", "closed"].includes(String(p.status)) ? "done" : "active"}>{problemLabel(p.status)}</StatusPill>
              </Stack>
              <Typography level="body-md" textColor="text.secondary">
                {tickets.length} {tickets.length === 1 ? "request" : "requests"} from {clients} {clients === 1 ? "client" : "clients"}{eng ? `. Fix: ${engineeringLabel(eng.status).toLowerCase()}` : ""}.
              </Typography>
              {tickets.length > 0 && (
                <Typography level="body-sm" textColor="text.tertiary">
                  {tickets.map((t, i) => <span key={t.id}>{i ? " · " : ""}<Link component="button" onClick={() => onOpenTicket(t.id)}>#{t.number}</Link> {t.account ?? ""}</span>)}
                </Typography>
              )}
            </Stack>
          </Box>
        );
      })}
      {(q.data ?? []).length > 0 && <Typography level="body-sm" textColor="text.tertiary">Closing a shared problem never closes its requests. Each one is checked with its own client.</Typography>}
    </Stack>
  );
}

/** Plain durations for Reports: "Under a minute", "3 min", "4.2 hrs", "1.5 days". */
const fmtDur = (s: unknown) => {
  const n = Number(s);
  if (!Number.isFinite(n) || s === null || s === undefined) return "—";
  if (n < 60) return "Under a minute";
  if (n < 3600) return `${Math.round(n / 60)} min`;
  if (n < 86400) return `${(n / 3600).toFixed(1)} hrs`;
  return `${(n / 86400).toFixed(1)} days`;
};

export function ReportsPanel() {
  const [days, setDays] = useState("30");
  const q = useQuery({ queryKey: ["bloom-support", "metrics", days], queryFn: () => bloomSupport.metrics(new Date(Date.now() - Number(days) * 86400e3).toISOString()) });
  const header = (
    <Stack direction="row" spacing={3} alignItems="center" justifyContent="space-between" flexWrap="wrap" useFlexGap>
      <Typography level="h3" component="h2">How support is going</Typography>
      <Select value={days} onChange={(_, v) => v && setDays(v)} aria-label="Time range" sx={{ minWidth: 180 }}>
        {["7", "30", "90"].map((d) => <Option key={d} value={d}>Last {d} days</Option>)}
      </Select>
    </Stack>
  );
  if (q.isLoading) return <Stack spacing={5}>{header}<Loading /></Stack>;
  if (q.error) return <Stack spacing={5}>{header}<LoadFailed /></Stack>;
  const m = q.data as unknown as Metrics;
  const defs = m.definitions ?? {};
  const daily = (m.daily ?? []).slice(-Number(days));
  const max = Math.max(1, ...daily.map((d) => Math.max(d.incoming, d.resolved)));
  const incoming = daily.reduce((n, d) => n + d.incoming, 0);
  const solved = m.handling.by_person + m.handling.by_bloom;
  const openNow = Object.values(m.open_by.status ?? {}).reduce((n, v) => n + v, 0);
  return (
    <Stack spacing={7} sx={{ maxWidth: 1100, pb: 8 }}>
      {header}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 3 }}>
        <BigStat value={fmtDur(m.first_response.median_business_seconds)} label="Typical first reply" sub="During business hours" />
        <BigStat value={fmtDur(m.first_resolution.median_seconds)} label="Typical time to solve" sub={`Across ${m.first_resolution.n} solved ${m.first_resolution.n === 1 ? "request" : "requests"}`} />
        <BigStat value={String(solved)} label="Requests solved" sub={m.handling.by_bloom ? `Bloom solved ${m.handling.by_bloom} on its own` : `${incoming} came in`} />
        <BigStat value={String(m.overdue_now)} label="Past due right now" sub={m.overdue_now ? "Worth a look in Requests" : "Everything is on time"} tone={m.overdue_now ? "warning" : "success"} />
      </Box>

      <DeskSection title="Requests per day">
        <Box sx={{ ...deskCardSx, p: 5 }}>
          <Stack direction="row" spacing={4} sx={{ mb: 4 }}>
            <Legend color="neutral.300" label={`Came in (${incoming})`} />
            <Legend color="success.500" label={`Solved (${daily.reduce((n, d) => n + d.resolved, 0)})`} />
          </Stack>
          <Box role="img" aria-label={`Over the last ${days} days, ${incoming} requests came in.`} sx={{ display: "flex", alignItems: "flex-end", gap: daily.length > 40 ? "2px" : "6px", height: 160 }}>
            {daily.map((d) => (
              <Box key={d.day} title={`${d.day}: ${d.incoming} in, ${d.resolved} solved`} sx={{ flex: 1, display: "flex", alignItems: "flex-end", gap: "2px", height: "100%" }}>
                <Box sx={{ flex: 1, height: `${(d.incoming / max) * 100}%`, minHeight: d.incoming ? 4 : 0, bgcolor: "neutral.300", borderRadius: "3px 3px 0 0" }} />
                <Box sx={{ flex: 1, height: `${(d.resolved / max) * 100}%`, minHeight: d.resolved ? 4 : 0, bgcolor: "success.500", borderRadius: "3px 3px 0 0" }} />
              </Box>
            ))}
          </Box>
          <Box sx={{ height: "1px", bgcolor: "neutral.200" }} />
          <Stack direction="row" justifyContent="space-between" sx={{ mt: 1.5 }}>
            <Typography level="body-xs" textColor="text.tertiary">{daily[0]?.day ?? ""}</Typography>
            <Typography level="body-xs" textColor="text.tertiary">{daily[daily.length - 1]?.day ?? ""}</Typography>
          </Stack>
        </Box>
      </DeskSection>

      <DeskSection title="Open right now" count={openNow}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" }, gap: 3 }}>
          {([["status", "By status"], ["product", "By product"]] as const).map(([k, title]) => (
            <Breakdown key={k} title={title} rows={Object.entries(m.open_by[k] ?? {}).map(([a, n]) => [OPEN_BY[k].value(a), n])} />
          ))}
          <Breakdown title="By age" rows={Object.entries(m.age_distribution ?? {}).map(([a, n]) => [ageLabel(a), n])} />
        </Box>
      </DeskSection>

      <Disclosure label="More detail">
        <Stack spacing={3}>
          <Detail label="First reply, slowest 1 in 10" value={fmtDur(m.first_response.p90_business_seconds)} />
          <Detail label="Time to solve, slowest 1 in 10" value={fmtDur(m.first_resolution.p90_seconds)} />
          <Detail label="Final solve time (typical / slowest 1 in 10)" value={`${fmtDur(m.final_resolution.median_seconds)} / ${fmtDur(m.final_resolution.p90_seconds)}`} />
          <Detail label="Reopened after being solved" value={m.reopen_rate.rate === null ? "None yet" : `${Math.round(m.reopen_rate.rate * 100)}% (${m.reopen_rate.reopened} of ${m.reopen_rate.denominator})`} />
          <Detail label="Solved by a person / by Bloom" value={`${m.handling.by_person} / ${m.handling.by_bloom} (${m.handling.verified_autonomous} checked as fully automatic)`} />
          <Detail label="Open by priority" value={Object.entries(m.open_by.priority ?? {}).map(([a, n]) => `${OPEN_BY.priority.value(a)} ${n}`).join(" · ") || "None"} />
          <Detail label="Bloom's automatic steps" value={`${m.automation.dead_jobs} failed · ${m.automation.model_calls.toLocaleString()} AI calls · ${m.automation.model_tokens.toLocaleString()} tokens`} />
          {Object.entries(defs).map(([k, v]) => <Detail key={k} label={labelFor(k)} value={v} />)}
        </Stack>
      </Disclosure>
    </Stack>
  );
}

const AGE_LABEL: Record<string, string> = { under_1d: "Under 1 day", "1_3d": "1 to 3 days", "3_7d": "3 to 7 days", "7_30d": "1 to 4 weeks", over_30d: "Over a month" };
const ageLabel = (k: string) => AGE_LABEL[k] ?? labelFor(k.replace(/_/g, " "));

function BigStat({ value, label, sub, tone = "primary" }: { value: string; label: string; sub?: string; tone?: "primary" | "warning" | "success" }) {
  return (
    <Box sx={{ ...deskCardSx, p: 5 }}>
      <Typography level="body-md" textColor="text.secondary">{label}</Typography>
      <Typography level="h1" component="p" sx={{ mt: 1, color: tone === "warning" ? "warning.700" : tone === "success" ? "success.700" : "primary.800" }}>{value}</Typography>
      {sub && <Typography level="body-sm" textColor="text.tertiary" sx={{ mt: 1 }}>{sub}</Typography>}
    </Box>
  );
}
function Legend({ color, label }: { color: string; label: string }) {
  return <Stack direction="row" spacing={1.5} alignItems="center"><Box aria-hidden sx={{ width: 12, height: 12, borderRadius: 3, bgcolor: color }} /><Typography level="body-sm">{label}</Typography></Stack>;
}
function Breakdown({ title, rows }: { title: string; rows: Array<[string, number]> }) {
  const max = Math.max(1, ...rows.map(([, n]) => n));
  return (
    <Box sx={{ ...deskCardSx, p: 5 }}>
      <Typography level="title-md" sx={{ mb: 3 }}>{title}</Typography>
      {rows.length === 0 ? <Typography level="body-sm" textColor="text.secondary">Nothing open.</Typography> : (
        <Stack spacing={2.5}>
          {rows.map(([label, n]) => (
            <Stack key={label} spacing={1}>
              <Stack direction="row" justifyContent="space-between"><Typography level="body-sm">{label}</Typography><Typography level="body-sm" fontWeight="lg">{n}</Typography></Stack>
              <Box sx={{ height: 6, borderRadius: 3, bgcolor: "neutral.100" }}><Box sx={{ height: "100%", width: `${(n / max) * 100}%`, borderRadius: 3, bgcolor: "primary.300" }} /></Box>
            </Stack>
          ))}
        </Stack>
      )}
    </Box>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.5, sm: 3 }}>
      <Typography level="body-sm" textColor="text.secondary" sx={{ width: { sm: 300 }, flex: "0 0 auto" }}>{label}</Typography>
      <Typography level="body-sm" sx={{ overflowWrap: "anywhere" }}>{value}</Typography>
    </Stack>
  );
}

const CONFIG_KEYS: Array<{ key: string; label: string; help: string }> = [
  { key: "sla", label: "Response targets", help: "Internal targets (first_response_business_hours per priority, due_soon_minutes, stale_hours). Set contractual=true only for an agreed SLA." },
  { key: "business_hours", label: "Business hours & holidays", help: "timezone, days (1=Mon…7), start, end, holidays [\"YYYY-MM-DD\"]." },
  { key: "timers", label: "Clock pausing", help: "Waiting reasons that pause our clock. Internal and deployment waits should keep it running." },
  { key: "notifications", label: "Notifications", help: "urgent_new, unassigned_minutes, response_warning_minutes, next_action_overdue, stalled, email_staff." },
  { key: "digest", label: "Daily / weekly summary", help: "Staff recipients only. hour is local business-hours time." },
  { key: "closure", label: "Closure policy", help: "Only resolved tickets are closed automatically. Waiting tickets are never auto-resolved." },
  { key: "retention", label: "Retention", help: "redact_resolved_after_days (null = keep). Redaction keeps events and audit." },
  { key: "automation_scopes", label: "Automation scopes", help: "Pause triage, answer, email, operations or engineering separately. Intake always continues." },
  { key: "limits", label: "Usage limits", help: "Model calls, tickets per client, repair attempts and concurrency." },
  { key: "ai", label: "Model", help: "OpenAI API model id and per-client budget (billed to the API account)." },
  { key: "support", label: "Accountability", help: "default_owner_email: who is accountable for unassigned tickets (defaults to the admin on inbox 1)." },
];

export function SupportConfigPanel({ me }: { me: Whoami }) {
  const settings = useQuery({ queryKey: ["bloom-support", "settings"], queryFn: () => bloomSupport.settings() });
  const [editing, setEditing] = useState<string | null>(null);
  const [text, setText] = useState("");
  const { run, error, pending } = useAction();
  const canEdit = me.permissions.includes("admin.policy");
  if (settings.isLoading) return <Loading />;
  return (
    <Stack spacing={1}>
      {error && <Alert color="danger">{error}</Alert>}
      {CONFIG_KEYS.map((c) => (
        <Sheet key={c.key} variant="outlined" sx={{ p: 1.5, borderRadius: "md" }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <div><Typography level="title-sm">{c.label}</Typography><Typography level="body-xs">{c.help}</Typography></div>
            {canEdit && editing !== c.key && <Button size="sm" variant="outlined" onClick={() => { setEditing(c.key); setText(JSON.stringify(settings.data?.[c.key] ?? {}, null, 2)); }}>Edit</Button>}
          </Stack>
          {editing === c.key ? (
            <Stack spacing={1} sx={{ mt: 1 }}>
              <Textarea minRows={4} value={text} onChange={(e) => setText(e.target.value)} sx={{ fontFamily: "monospace", fontSize: 12 }} />
              <Stack direction="row" spacing={1}>
                <Button size="sm" loading={pending} onClick={() => run(async () => { await bloomSupport.setSetting(c.key, JSON.parse(text)); setEditing(null); })}>Save</Button>
                <Button size="sm" variant="plain" onClick={() => setEditing(null)}>Cancel</Button>
              </Stack>
            </Stack>
          ) : (
            <Box sx={{ mt: 1 }}><ReadableData value={settings.data?.[c.key] ?? null} /></Box>
          )}
        </Sheet>
      ))}
    </Stack>
  );
}
