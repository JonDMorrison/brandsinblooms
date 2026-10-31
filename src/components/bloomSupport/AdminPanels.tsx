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
import { formatDistanceToNow } from "date-fns";
import { bloomSupport, type Whoami } from "@/lib/bloomSupport/api";
import { JoyEmptyState } from "@/components/joy/JoyEmptyState";
import { Inbox } from "lucide-react";

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
                </Stack>
                {x.detail ? <Typography level="body-sm" sx={{ mt: 0.5, whiteSpace: "pre-wrap" }}>{String(x.detail)}</Typography> : null}
                {ticket && x.ticket_id ? <Link level="body-sm" component="button" onClick={() => onOpenTicket(String(x.ticket_id))}>#{ticket.number} {ticket.subject}</Link> : null}
              </div>
              <Button size="sm" onClick={() => { const d = window.prompt("Record your decision"); if (d) run(() => bloomSupport.resolveEscalation(String(x.id), d)); }}>Record decision</Button>
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
