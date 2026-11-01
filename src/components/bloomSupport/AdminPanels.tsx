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
import { bloomSupport, type Whoami } from "@/lib/bloomSupport/api";
import { JoyEmptyState } from "@/components/joy/JoyEmptyState";
import { Inbox } from "lucide-react";

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

export function EscalationsPanel({ onOpenTicket }: { onOpenTicket: (id: string) => void }) {
  const q = useQuery({ queryKey: ["bloom-support", "escalations"], queryFn: () => bloomSupport.escalations() });
  const { run, error } = useAction();
  if (q.isLoading) return <Loading />;
  if (q.error) return <Alert color="danger">{(q.error as Error).message}</Alert>;
  if (!q.data?.length) return <Empty title="Nothing waiting for Jon or Jeff" description="Escalations, approvals and failed automation show up here." />;
  return (
    <Stack spacing={1}>
      {error && <Alert color="danger">{error}</Alert>}
      {q.data.map((x) => {
        const ticket = x.ticket as { number: number; subject: string } | null;
        return (
          <Sheet key={String(x.id)} variant="outlined" sx={{ p: 1.5, borderRadius: "md" }}>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
              <div>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip size="sm" color="danger" variant="soft">{String(x.audience) === "both" ? "Jon + Jeff" : String(x.audience) === "jon" ? "Jon" : "Jeff"}</Chip>
                  <Typography level="title-sm">{String(x.reason).replace(/_/g, " ")}</Typography>
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
                <Button size="sm" onClick={() => { const d = window.prompt("Record your decision"); if (d) run(() => bloomSupport.resolveEscalation(String(x.id), d)); }}>Record decision</Button>
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
  if (q.error) return <Alert color="danger">{(q.error as Error).message}</Alert>;
  if (!q.data?.length) return <Empty title="No engineering work" description="Bug investigations, fix PRs, releases and production verification appear here." />;
  const canApprove = me.permissions.includes("engineering.approve");
  return (
    <Sheet variant="outlined" sx={{ borderRadius: "md", overflow: "auto" }}>
      {error && <Alert color="danger">{error}</Alert>}
      <Table size="sm" stickyHeader>
        <thead><tr><th style={{ width: "34%" }}>Issue</th><th>Status</th><th>PR</th><th>Release check</th><th>Tickets</th><th /></tr></thead>
        <tbody>
          {q.data.map((e) => {
            const elig = e.eligibility as { eligible?: boolean; reasons?: string[] } | null;
            const tickets = (e.tickets as Array<{ id: string; number: number }>) ?? [];
            return (
              <tr key={String(e.id)}>
                <td><Typography level="body-sm">{String(e.title)}</Typography><Typography level="body-xs" textColor="text.tertiary">{String(e.repository ?? e.product)}</Typography></td>
                <td><Chip size="sm" variant="soft" color={["verified"].includes(String(e.status)) ? "success" : ["failed", "rolled_back", "escalated", "awaiting_approval"].includes(String(e.status)) ? "danger" : "neutral"}>{String(e.status)}</Chip></td>
                <td>{e.pr_url ? <Link href={String(e.pr_url)} target="_blank" rel="noopener" level="body-sm">#{String(e.pr_number)}</Link> : "—"}</td>
                <td><Typography level="body-xs">{elig ? (elig.eligible ? "eligible" : (elig.reasons ?? []).slice(0, 2).join("; ")) : "—"}</Typography></td>
                <td>{tickets.map((t) => <Link key={t.id} level="body-xs" component="button" onClick={() => onOpenTicket(t.id)} sx={{ mr: 0.5 }}>#{t.number}</Link>)}</td>
                <td>{canApprove && String(e.status) === "awaiting_approval" ? <Button size="sm" onClick={() => run(() => bloomSupport.updateEngineering(String(e.id), { status: "approved", note: "Approved in dashboard" }))}>Approve</Button> : null}</td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Sheet>
  );
}

export function FeaturesPanel({ me, onOpenTicket }: { me: Whoami; onOpenTicket: (id: string) => void }) {
  const q = useQuery({ queryKey: ["bloom-support", "features"], queryFn: () => bloomSupport.features() });
  const { run, error } = useAction();
  if (q.isLoading) return <Loading />;
  if (q.error) return <Alert color="danger">{(q.error as Error).message}</Alert>;
  if (!q.data?.length) return <Empty title="No feature requests" description="Requests Bloom recognises as new features are sent here for Jon's decision, with the customer evidence attached." />;
  const canDecide = me.permissions.includes("features.decide");
  return (
    <Stack spacing={1}>
      {error && <Alert color="danger">{error}</Alert>}
      {q.data.map((f) => {
        const evidence = (f.evidence as Array<{ ticket_id: string; number: number; account: string | null; excerpt: string | null }>) ?? [];
        return (
          <Sheet key={String(f.id)} variant="outlined" sx={{ p: 1.5, borderRadius: "md" }}>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
              <div>
                <Stack direction="row" spacing={1} alignItems="center"><Typography level="title-sm">{String(f.title)}</Typography><Chip size="sm">{String(f.status).replace(/_/g, " ")}</Chip><Chip size="sm" variant="outlined">{evidence.length} client{evidence.length === 1 ? "" : "s"}</Chip></Stack>
                {evidence.slice(0, 4).map((x) => (
                  <Typography key={x.ticket_id} level="body-xs" sx={{ mt: 0.5 }}>
                    <Link component="button" onClick={() => onOpenTicket(x.ticket_id)}>#{x.number}</Link> {x.account ?? "unknown client"}: “{(x.excerpt ?? "").slice(0, 140)}”
                  </Typography>
                ))}
                {f.decision_note ? <Typography level="body-xs" sx={{ mt: 0.5 }}>Decision note: {String(f.decision_note)}</Typography> : null}
              </div>
              {canDecide && String(f.status) === "awaiting_decision" && (
                <Stack direction="row" spacing={0.5}>
                  {["accepted", "planned", "declined"].map((d) => (
                    <Button key={d} size="sm" variant={d === "declined" ? "outlined" : "solid"} color={d === "declined" ? "neutral" : "primary"} onClick={() => run(() => bloomSupport.decideFeature(String(f.id), d, window.prompt("Note (optional)") ?? undefined))}>{d}</Button>
                  ))}
                </Stack>
              )}
            </Stack>
          </Sheet>
        );
      })}
    </Stack>
  );
}

export function ClientsPanel({ onOpenTicket }: { onOpenTicket: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const list = useQuery({ queryKey: ["bloom-support", "accounts", q], queryFn: () => bloomSupport.listAccounts(q || undefined) });
  const detail = useQuery({ queryKey: ["bloom-support", "account", selected], queryFn: () => bloomSupport.getAccount(selected!), enabled: !!selected });
  const { run, error } = useAction();
  return (
    <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
      <Stack spacing={1} sx={{ width: { md: 320 }, flexShrink: 0 }}>
        <Input placeholder="Search clients, site or tenant id" value={q} onChange={(e) => setQ(e.target.value)} />
        {list.isLoading ? <Loading /> : (list.data ?? []).map((a) => (
          <Sheet key={a.id} variant={selected === a.id ? "soft" : "outlined"} color={selected === a.id ? "primary" : "neutral"} sx={{ p: 1, borderRadius: "sm", cursor: "pointer" }} onClick={() => setSelected(a.id)}>
            <Typography level="title-sm">{a.name}</Typography>
            <Typography level="body-xs">{a.links.map((l) => l.product.toUpperCase()).join(" · ") || "no product links"} · {a.open_tickets} open{a.needs_review ? " · needs review" : ""}</Typography>
          </Sheet>
        ))}
      </Stack>
      <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
        {error && <Alert color="danger">{error}</Alert>}
        {!selected ? <Empty title="Pick a client" description="See their products, contacts, every ticket and recent operations." /> : detail.isLoading ? <Loading /> : detail.data ? (
          <Sheet variant="outlined" sx={{ p: 2, borderRadius: "md" }}>
            <Typography level="title-lg">{String(detail.data.name)}</Typography>
            <Typography level="body-xs">Account {String(detail.data.id)}{detail.data.crm_tenant_id ? ` · CRM tenant ${String(detail.data.crm_tenant_id)}` : ""}</Typography>
            <Stack direction="row" spacing={1} sx={{ my: 1 }} flexWrap="wrap" useFlexGap>
              {((detail.data.links as Array<{ product: string; external_id: string; label: string | null }>) ?? []).map((l) => <Chip key={`${l.product}-${l.external_id}`} size="sm" variant="outlined">{l.product}: {l.label ?? l.external_id}</Chip>)}
              <Button size="sm" variant="plain" onClick={() => {
                const domains = window.prompt("Registered email domains (comma separated) — senders from these domains are linked to this client but stay unverified", ((detail.data.email_domains as string[]) ?? []).join(", "));
                if (domains !== null) run(() => bloomSupport.updateAccount(selected, { email_domains: domains.split(",").map((s) => s.trim()).filter(Boolean), needs_review: false }));
              }}>Email domains</Button>
            </Stack>
            <Typography level="title-sm" sx={{ mt: 1 }}>Tickets</Typography>
            {((detail.data.tickets as Array<{ id: string; number: number; subject: string; status: string; updated_at: string }>) ?? []).map((t) => (
              <Typography key={t.id} level="body-sm"><Link component="button" onClick={() => onOpenTicket(t.id)}>#{t.number}</Link> {t.subject} · {t.status} · {ago(t.updated_at)}</Typography>
            ))}
            <Typography level="title-sm" sx={{ mt: 1 }}>Contacts</Typography>
            {((detail.data.members as Array<{ id: string; name: string | null; email: string | null; product: string | null; verified: boolean }>) ?? []).map((m) => (
              <Typography key={m.id} level="body-xs">{m.name ?? "—"} &lt;{m.email ?? "no email"}&gt; · {m.product ?? ""} · {m.verified ? "verified" : "unverified"}</Typography>
            ))}
          </Sheet>
        ) : null}
      </Stack>
    </Stack>
  );
}

export function OperationsPanel() {
  const catalog = useQuery({ queryKey: ["bloom-support", "ops-catalog"], queryFn: () => bloomSupport.operationsCatalog() });
  const [accountId, setAccountId] = useState("");
  const [kind, setKind] = useState("campaign.list");
  const [inputs, setInputs] = useState("{}");
  const [output, setOutput] = useState<unknown>(null);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const { run, error, pending } = useAction();
  const isRead = catalog.data?.reads.some((r) => r.kind === kind);
  const parsed = () => { try { return JSON.parse(inputs || "{}"); } catch { throw new Error("Inputs must be JSON"); } };
  return (
    <Stack spacing={1.5}>
      {catalog.data && Object.entries(catalog.data.remote).filter(([, v]) => !v.configured).map(([k, v]) => (
        <Alert key={k} color="warning" variant="soft">{k === "cms" ? "BloomSites" : "POS"} operations are not connected: set {v.missing.join(", ")}.</Alert>
      ))}
      <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
        <Input placeholder="Client account id" value={accountId} onChange={(e) => setAccountId(e.target.value)} sx={{ flex: 1 }} />
        <Select value={kind} onChange={(_, v) => v && setKind(v)} sx={{ minWidth: 220 }}>
          {[...(catalog.data?.reads ?? []), ...(catalog.data?.changes ?? [])].map((o) => <Option key={o.kind} value={o.kind}>{o.kind}</Option>)}
        </Select>
      </Stack>
      <Textarea minRows={3} value={inputs} onChange={(e) => setInputs(e.target.value)} placeholder='Inputs as JSON, e.g. {"campaign_id":"…","scheduled_at":"2026-11-03T15:00:00Z"}' sx={{ fontFamily: "monospace" }} />
      <Stack direction="row" spacing={1}>
        {isRead
          ? <Button loading={pending} disabled={!accountId} onClick={() => run(async () => setOutput(await bloomSupport.readOperation({ kind, account_id: accountId, inputs: parsed() })))}>Run read</Button>
          : <Button loading={pending} disabled={!accountId} onClick={() => run(async () => { const p = await bloomSupport.previewOperation({ kind, account_id: accountId, inputs: parsed() }); setPreview(p); setOutput(p.preview); })}>Preview change</Button>}
        {preview && String(preview.status) === "previewed" && (
          <Button color="danger" loading={pending} onClick={() => run(async () => { const r = await bloomSupport.executeOperation(String(preview.id)); setPreview(r); setOutput(r); })}>Confirm and execute</Button>
        )}
        {preview && String(preview.status) === "succeeded" && preview.undo ? (
          <Button variant="outlined" onClick={() => run(async () => { const r = await bloomSupport.undoOperation(String(preview.id)); setPreview(r); setOutput(r); })}>Undo</Button>
        ) : null}
      </Stack>
      {error && <Alert color="danger">{error}</Alert>}
      {output !== null && <Sheet variant="soft" sx={{ p: 1.5, borderRadius: "md", overflow: "auto", maxHeight: 420 }}><pre style={{ margin: 0, fontSize: 12 }}>{JSON.stringify(output, null, 2)}</pre></Sheet>}
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
  const isAdmin = me.permissions.includes("admin.policy");
  const s = settings.data ?? {};
  const toggle = (key: string, label: string, help: string, allowed: boolean) => (
    <Stack direction="row" spacing={1.5} alignItems="center">
      <Switch checked={s[key] === true} disabled={!allowed} onChange={(e) => run(() => bloomSupport.setSetting(key, e.target.checked))} />
      <div><Typography level="title-sm">{label}</Typography><Typography level="body-xs">{help}</Typography></div>
    </Stack>
  );
  return (
    <Stack spacing={2}>
      {error && <Alert color="danger">{error}</Alert>}
      {health.data && health.data.missing_configuration.length > 0 && (
        <Alert color="warning" variant="soft">
          <div><Typography level="title-sm">Not yet configured</Typography><Typography level="body-xs">{health.data.missing_configuration.join(", ")}</Typography></div>
        </Alert>
      )}
      <Sheet variant="outlined" sx={{ p: 2, borderRadius: "md" }}>
        <Stack spacing={1.5}>
          {toggle("automation_enabled", "Bloom automation", "Kill switch for all background work. Running jobs finish; nothing new starts.", me.permissions.includes("automation.control"))}
          {toggle("client_email_enabled", "Email clients", "Off: client emails are recorded but not sent (safe for testing).", isAdmin)}
          {toggle("auto_release_enabled", "Automatic release of eligible fixes", "Only policy-eligible bug fixes. Everything sensitive still waits for review.", isAdmin)}
        </Stack>
      </Sheet>
      {isAdmin && (
        <Sheet variant="outlined" sx={{ p: 2, borderRadius: "md" }}>
          <Typography level="title-sm">Jon / Jeff notification addresses</Typography>
          <Button size="sm" variant="outlined" sx={{ mt: 1 }} onClick={() => {
            const owners = (s.owners as { jon?: string[]; jeff?: string[] }) ?? {};
            const jon = window.prompt("Jon's email(s)", (owners.jon ?? []).join(", "));
            const jeff = window.prompt("Jeff's email(s)", (owners.jeff ?? []).join(", "));
            if (jon !== null && jeff !== null) run(() => bloomSupport.setSetting("owners", { jon: jon.split(",").map((x) => x.trim()).filter(Boolean), jeff: jeff.split(",").map((x) => x.trim()).filter(Boolean) }));
          }}>Edit</Button>
          <Typography level="body-xs" sx={{ mt: 1 }}>{JSON.stringify(s.owners ?? {})}</Typography>
        </Sheet>
      )}
      <Typography level="title-md">Support configuration</Typography>
      <SupportConfigPanel me={me} />
      <Sheet variant="outlined" sx={{ p: 2, borderRadius: "md" }}>
        <Typography level="title-sm">People and roles</Typography>
        <Table size="sm">
          <thead><tr><th>Name</th><th>Role</th><th>Extra permissions</th><th /></tr></thead>
          <tbody>
            {(staff.data ?? []).filter((p) => p.kind === "user").map((p) => (
              <tr key={p.id}>
                <td>{p.name ?? p.email}<Typography level="body-xs">{p.email}</Typography></td>
                <td>{p.role}</td>
                <td>{p.grants.join(", ") || "—"}</td>
                <td>{me.permissions.includes("admin.roles") && p.id !== me.id && (
                  <Select size="sm" value={p.role} onChange={(_, v) => v && run(() => bloomSupport.setRole({ principal_id: p.id, role: v }))}>
                    {["platform_admin", "platform_operator", "support", "client"].map((r) => <Option key={r} value={r}>{r}</Option>)}
                  </Select>
                )}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        {me.permissions.includes("admin.roles") && (
          <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
            <Button size="sm" variant="outlined" onClick={() => {
              const email = window.prompt("Email of a person who has signed in to BloomSuite at least once");
              const role = email && window.prompt("Role: platform_operator, support or platform_admin", "support");
              if (email && role) run(() => bloomSupport.setRole({ email, role }));
            }}>Add staff by email</Button>
            <Button size="sm" variant="outlined" onClick={() => {
              const email = window.prompt("Support person's email");
              const grants = email && window.prompt("Extra permissions (comma separated): publish, campaign_send, sensitive, event_manage", "");
              if (email && grants !== null) run(() => bloomSupport.setRole({ email, grants: (grants ?? "").split(",").map((x) => x.trim()).filter(Boolean) }));
            }}>Support permissions</Button>
          </Stack>
        )}
      </Sheet>
      <Sheet variant="outlined" sx={{ p: 2, borderRadius: "md" }}>
        <Typography level="title-sm">API keys (ChatGPT / MCP)</Typography>
        <Typography level="body-xs">Each person uses their own key; it carries that person's permissions. Read-only keys cannot change anything.</Typography>
        <Stack direction="row" spacing={1} sx={{ my: 1 }}>
          <Button size="sm" onClick={() => run(async () => setNewKey((await bloomSupport.createKey({ label: "ChatGPT", scopes: ["*"] })).token))}>New full key</Button>
          <Button size="sm" variant="outlined" onClick={() => run(async () => setNewKey((await bloomSupport.createKey({ label: "ChatGPT (read-only)", scopes: ["read"] })).token))}>New read-only key</Button>
        </Stack>
        {newKey && <Alert color="success" variant="soft" sx={{ wordBreak: "break-all" }}>Copy now — shown once: {newKey}</Alert>}
        {(keys.data ?? []).map((k) => (
          <Stack key={String(k.id)} direction="row" justifyContent="space-between" alignItems="center">
            <Typography level="body-xs">{String(k.label)} · {String(k.prefix)}… · {String(k.principal)} · {(k.scopes as string[]).join(",") || "full"} · {k.revoked_at ? "revoked" : `last used ${k.last_used_at ? ago(k.last_used_at) : "never"}`}</Typography>
            {!k.revoked_at && <Button size="sm" variant="plain" color="danger" onClick={() => run(() => bloomSupport.revokeKey(String(k.id)))}>Revoke</Button>}
          </Stack>
        ))}
      </Sheet>
      {jobs.data && jobs.data.length > 0 && (
        <Sheet variant="outlined" sx={{ p: 2, borderRadius: "md" }}>
          <Typography level="title-sm">Failed automation</Typography>
          {jobs.data.map((j) => (
            <Stack key={String(j.id)} direction="row" justifyContent="space-between" alignItems="center">
              <Typography level="body-xs">{String(j.kind)} · {String(j.status)} · {String(j.last_error ?? "").slice(0, 120)}</Typography>
              <Stack direction="row"><Button size="sm" variant="plain" onClick={() => run(() => bloomSupport.controlJob(String(j.id), "retry"))}>Retry</Button><Button size="sm" variant="plain" color="neutral" onClick={() => run(() => bloomSupport.controlJob(String(j.id), "cancel"))}>Cancel</Button></Stack>
            </Stack>
          ))}
        </Sheet>
      )}
    </Stack>
  );
}

export function ReadinessPanel() {
  const q = useQuery({ queryKey: ["bloom-support", "readiness"], queryFn: () => bloomSupport.readiness(), refetchInterval: 60_000 });
  const settings = useQuery({ queryKey: ["bloom-support", "settings"], queryFn: () => bloomSupport.settings() });
  const { run, error } = useAction();
  if (q.isLoading) return <Loading />;
  if (q.error) return <Alert color="danger">{(q.error as Error).message}</Alert>;
  const r = q.data!;
  const ai = (settings.data?.ai ?? {}) as { model?: string; max_calls_per_account_per_day?: number };
  const tick = (v: boolean | null) => (v === null ? "—" : v ? "yes" : "no");
  return (
    <Stack spacing={1.5}>
      {error && <Alert color="danger">{error}</Alert>}
      <Alert color={r.summary.continuous_automation === "running" ? "success" : "warning"} variant="soft">
        Continuous automation: <strong>{r.summary.continuous_automation}</strong>. ChatGPT connections are for people; the background worker runs on its own schedule.
      </Alert>
      <Sheet variant="outlined" sx={{ borderRadius: "md", overflow: "auto" }}>
        <Table size="sm">
          <thead><tr><th style={{ width: "26%" }}>Capability</th><th>Implemented</th><th>Configured</th><th>Enabled</th><th>Live evidence</th><th style={{ width: "28%" }}>Tested / missing</th></tr></thead>
          <tbody>
            {r.capabilities.map((c) => (
              <tr key={c.key}>
                <td><Typography level="body-sm">{c.label}</Typography>{c.note ? <Typography level="body-xs" textColor="text.tertiary">{c.note}</Typography> : null}</td>
                <td>{tick(c.implemented)}</td>
                <td><Chip size="sm" variant="soft" color={c.configured ? "success" : "warning"}>{tick(c.configured)}</Chip></td>
                <td>{tick(c.enabled)}</td>
                <td><Typography level="body-xs">{c.live ? ago(c.live) : "not seen"}</Typography></td>
                <td><Typography level="body-xs">{c.tested}</Typography>{c.missing.length ? <Typography level="body-xs" color="warning">Missing: {c.missing.join(", ")}</Typography> : null}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Sheet>
      <Sheet variant="outlined" sx={{ p: 2, borderRadius: "md" }}>
        <Typography level="title-sm">Model (OpenAI API, billed to the API account — not a ChatGPT subscription)</Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 1 }} alignItems="center">
          <Typography level="body-sm">Current: {ai.model ?? "gpt-4o-mini"} · {ai.max_calls_per_account_per_day ?? 200} calls/client/day</Typography>
          <Button size="sm" variant="outlined" onClick={() => {
            const model = window.prompt("OpenAI model id for Bloom's background work", ai.model ?? "gpt-4o-mini");
            if (model) run(() => bloomSupport.setSetting("ai", { ...ai, provider: "openai", model }));
          }}>Change model</Button>
        </Stack>
      </Sheet>
      {r.summary.open_alerts.length > 0 && (
        <Sheet variant="soft" color="danger" sx={{ p: 2, borderRadius: "md" }}>
          <Typography level="title-sm">Alerts (last 24h)</Typography>
          {r.summary.open_alerts.map((a, i) => <Typography key={i} level="body-xs">{String(a.condition)} · {ago(a.created_at)} · {String(a.delivered)}</Typography>)}
        </Sheet>
      )}
    </Stack>
  );
}

export function ProblemsPanel({ onOpenTicket }: { onOpenTicket: (id: string) => void }) {
  const q = useQuery({ queryKey: ["bloom-support", "problems"], queryFn: () => bloomSupport.problems() });
  const { run, error } = useAction();
  if (q.isLoading) return <Loading />;
  if (q.error) return <Alert color="danger">{(q.error as Error).message}</Alert>;
  return (
    <Stack spacing={1}>
      {error && <Alert color="danger">{error}</Alert>}
      <Stack direction="row"><Button size="sm" onClick={() => { const title = window.prompt("Problem or incident title"); if (title) run(() => bloomSupport.createProblem({ title })); }}>New shared problem</Button></Stack>
      {!q.data?.length && <Empty title="No shared problems" description="When several clients hit the same issue, link their tickets to one problem: one investigation, separate private conversations." />}
      {(q.data ?? []).map((p) => {
        const tickets = (p.tickets as Array<{ id: string; number: number; status: string; account: string | null }>) ?? [];
        const eng = p.engineering as { status: string; pr_url: string | null } | null;
        return (
          <Sheet key={String(p.id)} variant="outlined" sx={{ p: 1.5, borderRadius: "md" }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Chip size="sm" color={p.kind === "incident" ? "danger" : "neutral"}>{String(p.kind)}</Chip>
              <Typography level="title-sm">{String(p.title)}</Typography>
              <Chip size="sm" variant="outlined">{String(p.status)}</Chip>
              <Typography level="body-xs">{tickets.length} tickets · {new Set(tickets.map((t) => t.account)).size} clients</Typography>
              {eng && <Typography level="body-xs">Engineering: {eng.status}{eng.pr_url ? <> · <Link href={eng.pr_url} target="_blank" rel="noopener">PR</Link></> : null}</Typography>}
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
              {tickets.map((t) => <Link key={t.id} level="body-xs" component="button" onClick={() => onOpenTicket(t.id)}>#{t.number} {t.account ?? ""} ({t.status})</Link>)}
            </Stack>
            <Typography level="body-xs" textColor="text.tertiary" sx={{ mt: 0.5 }}>Closing a problem never resolves its tickets; each is verified for its own client.</Typography>
          </Sheet>
        );
      })}
    </Stack>
  );
}

const fmtDur = (s: unknown) => {
  const n = Number(s);
  if (!Number.isFinite(n) || s === null) return "—";
  if (n < 3600) return `${Math.round(n / 60)}m`;
  if (n < 86400) return `${(n / 3600).toFixed(1)}h`;
  return `${(n / 86400).toFixed(1)}d`;
};

export function ReportsPanel() {
  const [days, setDays] = useState("30");
  const q = useQuery({ queryKey: ["bloom-support", "metrics", days], queryFn: () => bloomSupport.metrics(new Date(Date.now() - Number(days) * 86400e3).toISOString()) });
  if (q.isLoading) return <Loading />;
  if (q.error) return <Alert color="danger">{(q.error as Error).message}</Alert>;
  const m = q.data as unknown as Metrics;
  const defs = m.definitions;
  const daily = m.daily ?? [];
  const max = Math.max(1, ...daily.map((d) => Math.max(d.incoming, d.resolved, d.backlog)));
  const stat = (label: string, value: string, def?: string) => (
    <Sheet variant="outlined" sx={{ p: 1.25, borderRadius: "md", minWidth: 150 }}>
      <Typography level="body-xs" textColor="text.tertiary">{label}</Typography>
      <Typography level="title-lg">{value}</Typography>
      {def && <Typography level="body-xs" textColor="text.tertiary">{def}</Typography>}
    </Sheet>
  );
  return (
    <Stack spacing={1.5}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography level="title-sm">Range</Typography>
        <Select size="sm" value={days} onChange={(_, v) => v && setDays(v)}>{["7", "30", "90"].map((d) => <Option key={d} value={d}>Last {d} days</Option>)}</Select>
        <Typography level="body-xs" textColor="text.tertiary">{defs.targets}</Typography>
      </Stack>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {stat("First response (median / p90, business)", `${fmtDur(m.first_response.median_business_seconds)} / ${fmtDur(m.first_response.p90_business_seconds)}`, `n=${m.first_response.n}`)}
        {stat("First resolution (median / p90)", `${fmtDur(m.first_resolution.median_seconds)} / ${fmtDur(m.first_resolution.p90_seconds)}`, `n=${m.first_resolution.n}`)}
        {stat("Final resolution (median / p90)", `${fmtDur(m.final_resolution.median_seconds)} / ${fmtDur(m.final_resolution.p90_seconds)}`, `n=${m.final_resolution.n}`)}
        {stat("Reopen rate", m.reopen_rate.rate === null ? "—" : `${Math.round(m.reopen_rate.rate * 100)}%`, `${m.reopen_rate.reopened} of ${m.reopen_rate.denominator} first resolved`)}
        {stat("Overdue now", String(m.overdue_now))}
        {stat("Resolved: person / Bloom", `${m.handling.by_person} / ${m.handling.by_bloom}`, `${m.handling.verified_autonomous} verified autonomous`)}
        {stat("Automation", `${m.automation.dead_jobs} failed jobs`, `${m.automation.model_calls} model calls · ${m.automation.model_tokens} tokens`)}
      </Stack>
      <Sheet variant="outlined" sx={{ p: 2, borderRadius: "md", overflowX: "auto" }}>
        <Typography level="title-sm">Incoming, resolved and backlog per day</Typography>
        <Table size="sm" aria-label="Daily volume">
          <thead><tr><th>Day</th><th>Incoming</th><th>Resolved</th><th>Backlog (end of day)</th></tr></thead>
          <tbody>
            {daily.slice(-31).map((d) => (
              <tr key={d.day}>
                <td>{d.day}</td>
                <td><Box sx={{ display: "flex", alignItems: "center", gap: 1 }}><Box sx={{ height: 8, width: `${(d.incoming / max) * 120}px`, bgcolor: "primary.400", borderRadius: 2 }} />{d.incoming}</Box></td>
                <td><Box sx={{ display: "flex", alignItems: "center", gap: 1 }}><Box sx={{ height: 8, width: `${(d.resolved / max) * 120}px`, bgcolor: "success.400", borderRadius: 2 }} />{d.resolved}</Box></td>
                <td>{d.backlog}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Sheet>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
        {(["status", "priority", "product"] as const).map((k) => (
          <Sheet key={k} variant="outlined" sx={{ p: 1.5, borderRadius: "md", flex: 1 }}>
            <Typography level="title-sm">Open by {k}</Typography>
            {Object.entries(m.open_by[k]).map(([a, n]) => <Typography key={a} level="body-sm">{a}: {n}</Typography>)}
          </Sheet>
        ))}
        <Sheet variant="outlined" sx={{ p: 1.5, borderRadius: "md", flex: 1 }}>
          <Typography level="title-sm">Open by age</Typography>
          {Object.entries(m.age_distribution).map(([a, n]) => <Typography key={a} level="body-sm">{a.replace("_", " ")}: {n}</Typography>)}
        </Sheet>
      </Stack>
      <Sheet variant="soft" sx={{ p: 1.5, borderRadius: "md" }}>
        <Typography level="title-sm">Definitions</Typography>
        {Object.entries(defs).map(([k, v]) => <Typography key={k} level="body-xs"><strong>{k}</strong>: {v}</Typography>)}
      </Sheet>
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
  { key: "support", label: "Accountability", help: "default_owner_email: who is accountable for unassigned tickets (defaults to Jon)." },
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
            <Box component="pre" sx={{ fontSize: 11, m: 0, mt: 0.5, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{JSON.stringify(settings.data?.[c.key] ?? null)}</Box>
          )}
        </Sheet>
      ))}
    </Stack>
  );
}
