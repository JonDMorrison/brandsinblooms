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
import { ADMIN_INBOX_KEYS, adminAudienceLabel, adminInboxNames } from "@/lib/bloomSupport/adminLabels";
import { useAdminInboxNames } from "./useAdminInboxNames";
import { JoyEmptyState } from "@/components/joy/JoyEmptyState";
import { Inbox } from "lucide-react";
import { splitList, useAskDialog } from "./useAskDialog";
import { ClientPicker, type PickedClient } from "./ClientPicker";
import { ChatSpendPanel } from "./ChatSpendPanel";
import { ReadableData } from "@/components/admin/ReadableData";
import { labelFor } from "@/components/admin/readableFormat";
import { OPEN_BY, engineeringLabel, featureLabel, problemLabel, reasonLabel, ticketStatusLabel } from "./labels";
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
  if (q.error) return <Alert color="danger">{(q.error as Error).message}</Alert>;
  if (!q.data?.length) return <Empty title="No engineering work" description="Bug investigations, fix PRs, releases and production verification appear here." />;
  const canApprove = me.permissions.includes("engineering.approve");
  return (
    <Sheet variant="outlined" sx={{ borderRadius: "md", overflow: "auto" }}>
      {error && <Alert color="danger">{error}</Alert>}
      <Table size="sm" stickyHeader>
        <thead><tr><th style={{ width: "34%" }}>Problem</th><th>Where it is</th><th>The change</th><th>Can it go live on its own?</th><th>Requests</th><th /></tr></thead>
        <tbody>
          {q.data.map((e) => {
            const elig = e.eligibility as { eligible?: boolean; reasons?: string[] } | null;
            const tickets = (e.tickets as Array<{ id: string; number: number }>) ?? [];
            return (
              <tr key={String(e.id)}>
                <td><Typography level="body-sm">{String(e.title)}</Typography><Typography level="body-xs" textColor="text.tertiary">{String(e.repository ?? e.product)}</Typography></td>
                <td><Chip size="sm" variant="soft" color={["verified"].includes(String(e.status)) ? "success" : ["failed", "rolled_back", "escalated", "awaiting_approval"].includes(String(e.status)) ? "danger" : "neutral"}>{engineeringLabel(e.status)}</Chip></td>
                <td>{e.pr_url ? <Link href={String(e.pr_url)} target="_blank" rel="noopener" level="body-sm">#{String(e.pr_number)}</Link> : "—"}</td>
                <td><Typography level="body-xs">{elig ? (elig.eligible ? "Yes" : `No: ${(elig.reasons ?? []).slice(0, 2).join("; ")}`) : "Not checked yet"}</Typography></td>
                <td>{tickets.map((t) => <Link key={t.id} level="body-xs" component="button" onClick={() => onOpenTicket(t.id)} sx={{ mr: 0.5 }}>#{t.number}</Link>)}</td>
                <td>{canApprove && String(e.status) === "awaiting_approval" ? <Button size="sm" onClick={() => run(() => bloomSupport.updateEngineering(String(e.id), { status: "approved", note: "Approved in dashboard" }))}>Approve fix</Button> : null}</td>
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
  const { ask, dialog } = useAskDialog();
  if (q.isLoading) return <Loading />;
  if (q.error) return <Alert color="danger">{(q.error as Error).message}</Alert>;
  if (!q.data?.length) return <Empty title="No feature requests" description="Requests Bloom recognises as new features are sent here for an admin decision, with the customer evidence attached." />;
  const canDecide = me.permissions.includes("features.decide");
  return (
    <Stack spacing={1}>
      {dialog}
      {error && <Alert color="danger">{error}</Alert>}
      {q.data.map((f) => {
        const evidence = (f.evidence as Array<{ ticket_id: string; number: number; account: string | null; excerpt: string | null }>) ?? [];
        return (
          <Sheet key={String(f.id)} variant="outlined" sx={{ p: 1.5, borderRadius: "md" }}>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
              <div>
                <Stack direction="row" spacing={1} alignItems="center"><Typography level="title-sm">{String(f.title)}</Typography><Chip size="sm">{featureLabel(f.status)}</Chip><Chip size="sm" variant="outlined">{evidence.length} client{evidence.length === 1 ? "" : "s"}</Chip></Stack>
                {evidence.slice(0, 4).map((x) => (
                  <Typography key={x.ticket_id} level="body-xs" sx={{ mt: 0.5 }}>
                    <Link component="button" onClick={() => onOpenTicket(x.ticket_id)}>#{x.number}</Link> {x.account ?? "unknown client"}: “{(x.excerpt ?? "").slice(0, 140)}”
                  </Typography>
                ))}
                {f.decision_note ? <Typography level="body-xs" sx={{ mt: 0.5 }}>Decision note: {String(f.decision_note)}</Typography> : null}
              </div>
              {canDecide && String(f.status) === "awaiting_decision" && (
                <Stack direction="row" spacing={0.5}>
                  {FEATURE_DECISIONS.map((d) => (
                    <Button key={d.value} size="sm" variant={d.value === "declined" ? "outlined" : "solid"} color={d.value === "declined" ? "neutral" : "primary"} onClick={async () => {
                      const r = await ask({ title: d.label, description: "Bloom tells the clients who asked. Add a note if there is something they should know.", fields: [{ name: "note", label: "Note (optional)", kind: "textarea" }], confirmLabel: "Confirm" });
                      if (r) run(() => bloomSupport.decideFeature(String(f.id), d.value, String(r.note).trim() || undefined));
                    }}>{d.label}</Button>
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
  const { ask, dialog } = useAskDialog();
  return (
    <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
      <Stack spacing={1} sx={{ width: { md: 320 }, flexShrink: 0 }}>
        <Input placeholder="Search clients by name" value={q} onChange={(e) => setQ(e.target.value)} />
        {list.isLoading ? <Loading /> : (list.data ?? []).map((a) => (
          <Sheet key={a.id} variant={selected === a.id ? "soft" : "outlined"} color={selected === a.id ? "primary" : "neutral"} sx={{ p: 1, borderRadius: "sm", cursor: "pointer" }} onClick={() => setSelected(a.id)}>
            <Typography level="title-sm">{a.name}</Typography>
            <Typography level="body-xs">{a.links.map((l) => l.product.toUpperCase()).join(" · ") || "no product links"} · {a.open_tickets} open{a.needs_review ? " · needs review" : ""}</Typography>
          </Sheet>
        ))}
      </Stack>
      <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
        {dialog}
      {error && <Alert color="danger">{error}</Alert>}
        {!selected ? <Empty title="Pick a client" description="See their products, contacts, every ticket and recent operations." /> : detail.isLoading ? <Loading /> : detail.data ? (
          <Sheet variant="outlined" sx={{ p: 2, borderRadius: "md" }}>
            <Typography level="title-lg">{String(detail.data.name)}</Typography>
            <Typography level="body-xs">Account {String(detail.data.id)}{detail.data.crm_tenant_id ? ` · CRM tenant ${String(detail.data.crm_tenant_id)}` : ""}</Typography>
            <Stack direction="row" spacing={1} sx={{ my: 1 }} flexWrap="wrap" useFlexGap>
              {((detail.data.links as Array<{ product: string; external_id: string; label: string | null }>) ?? []).map((l) => <Chip key={`${l.product}-${l.external_id}`} size="sm" variant="outlined">{l.product}: {l.label ?? l.external_id}</Chip>)}
              <Button size="sm" variant="plain" onClick={async () => {
                const r = await ask({ title: "Email domains", description: "Emails from these domains are linked to this client automatically (they still count as unverified).", fields: [{ name: "domains", label: "Domains", kind: "textarea", placeholder: "e.g. greenleafgardens.com, greenleaf.ca", helper: "Separate with commas or new lines.", initial: ((detail.data!.email_domains as string[]) ?? []).join(", ") }], confirmLabel: "Save domains" });
                if (r) run(() => bloomSupport.updateAccount(selected, { email_domains: splitList(r.domains), needs_review: false }));
              }}>Email domains</Button>
            </Stack>
            <Typography level="title-sm" sx={{ mt: 1 }}>Tickets</Typography>
            {((detail.data.tickets as Array<{ id: string; number: number; subject: string; status: string; updated_at: string }>) ?? []).map((t) => (
              <Typography key={t.id} level="body-sm"><Link component="button" onClick={() => onOpenTicket(t.id)}>#{t.number}</Link> {t.subject} · {ticketStatusLabel(t.status)} · {ago(t.updated_at)}</Typography>
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
  "site.provider_health": { label: "Verify Heartland and ShipStation", help: "Read-only check of recent Heartland syncs and ShipStation order events. Provider credentials and customer order data stay private.", template: {provider:"both"} },
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

function ProviderHealthSummary({value}:{value:unknown}) {
  const report = value && typeof value==="object" && !Array.isArray(value) ? value as Record<string,unknown> : {};
  const heartland=report.heartland && typeof report.heartland==="object" ? report.heartland as Record<string,unknown> : {};
  const shipstation=report.shipstation && typeof report.shipstation==="object" ? report.shipstation as Record<string,unknown> : {};
  const display=(v:unknown) => typeof v==="string" && v.length<90 ? v.replaceAll("_"," ") : "Not recorded";
  const highlights=Array.isArray(report.findings) ? report.findings.filter((x):x is string => typeof x==="string").slice(0,4) : [];
  return <Stack spacing={1.5}>
    <Stack direction="row" alignItems="center" spacing={1}>
      <Typography level="title-md">Provider integration health</Typography>
      <Chip color={report.assessment==="needs_attention" ? "warning" : "neutral"} variant="soft">
        {report.assessment==="needs_attention"?"Needs attention":"Not fully verified"}
      </Chip>
    </Stack>
    {(report.scope==="heartland"||report.scope==="both") && <>
      <Typography level="title-sm">Heartland</Typography>
      <Typography level="body-sm">Connection: {heartland.configured===true?display(heartland.connection_status):"Not configured"}. Latest successful sync: {display(heartland.last_success_at)}.</Typography>
      <Typography level="body-sm">Automatic sync: {heartland.auto_sync===true?"Enabled":"Not enabled"}. Stock publication: {heartland.stock_publication_enabled===true?"Enabled":"Not enabled"}.</Typography>
    </>}
    {(report.scope==="shipstation"||report.scope==="both") && <>
      <Typography level="title-sm">ShipStation</Typography>
      <Typography level="body-sm">Connection: {shipstation.configured===true?display(shipstation.connection_status):"Not configured"}. Latest successful order delivery: {display(shipstation.last_success_at)}.</Typography>
      <Typography level="body-sm">Last recorded error: {display(shipstation.last_error_at)}.</Typography>
    </>}
    {highlights.map((f,i)=><Typography key={i} level="body-sm">{f}</Typography>)}
    <Typography level="body-xs" sx={{color:"text.tertiary"}}>Read-only provider records. A connected integration does not prove a customer order is complete. No settings, shipping data or customer records were changed.</Typography>
  </Stack>;
}

export function OperationsPanel() {
  const catalog = useQuery({ queryKey: ["bloom-support", "ops-catalog"], queryFn: () => bloomSupport.operationsCatalog() });
  const [client, setClient] = useState<PickedClient | null>(null);
  const [kind, setKind] = useState("campaign.list");
  const [inputs, setInputs] = useState(JSON.stringify(OPERATION_INFO["campaign.list"].template ?? {}, null, 2));
  const [output, setOutput] = useState<unknown>(null);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [task, setTask] = useState<{ticket_id:string;number:number} | null>(null);
  const [integrationScope, setIntegrationScope] = useState<"catalogue" | "fulfillment">("catalogue");
  const { run, error, pending } = useAction();
  const isRead = catalog.data?.reads.some((r) => r.kind === kind);
  const parsed = () => { try { return JSON.parse(inputs || "{}"); } catch { throw new Error("The details box isn't filled in correctly. Keep the quotes and braces as shown."); } };
  const accountId = client?.id ?? "";
  const integrationKind = integrationScope === "fulfillment" ? "site.provider_health" : "site.integration_health";
  const integrationInputs = integrationScope === "fulfillment" ? {provider:"both"} : {};
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
                <Typography level="body-sm">Bloom checks the selected integration records without changing the client account.</Typography>
                <Select size="sm" value={integrationScope} onChange={(_, next) => {
                  if (next === "catalogue" || next === "fulfillment") {
                    setIntegrationScope(next); setOutput(null); setTask(null);
                  }
                }}>
                  <Option value="catalogue">CounterPoint + Open Plant Data</Option>
                  <Option value="fulfillment">Heartland + ShipStation</Option>
                </Select>
                <Button variant="solid" color="neutral" loading={pending} disabled={!accountId || pending} sx={{ alignSelf: "flex-start", borderRadius: "xl" }}
                  onClick={() => run(async () => {
                    setKind(integrationKind);
                    setInputs(JSON.stringify(integrationInputs));
                    setPreview(null);
                    setOutput(await bloomSupport.readOperation({ kind: integrationKind, account_id: accountId, inputs: integrationInputs }));
                  })}>Verify integrations</Button>
                <Button variant="outlined" color="neutral" loading={pending} disabled={!accountId || pending || Boolean(task)}
                  sx={{ alignSelf:"flex-start", borderRadius:"xl" }}
                  onClick={() => run(async () => {
                    const result = await bloomSupport.startIntegrationTask({
                      account_id: accountId, idempotency_key: crypto.randomUUID(),
                      kind: integrationKind,
                      ...(integrationScope === "fulfillment" ? {provider:"both" as const} : {}),
                    });
                    setKind(integrationKind);
                    setInputs(JSON.stringify(integrationInputs)); setPreview(null);
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
          {kind === "site.integration_health" ? <IntegrationHealthSummary value={output} /> : kind === "site.provider_health" ? <ProviderHealthSummary value={output} /> : <ReadableData value={output} />}
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
  const toggle = (key: string, label: string, help: string, allowed: boolean) => (
    <Stack direction="row" spacing={1.5} alignItems="center">
      <Switch checked={s[key] === true} disabled={!allowed} onChange={(e) => run(() => bloomSupport.setSetting(key, e.target.checked))} />
      <div><Typography level="title-sm">{label}</Typography><Typography level="body-xs">{help}</Typography></div>
    </Stack>
  );
  return (
    <Stack spacing={2}>
      {dialog}
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
          <Typography level="title-sm">Where admins get alerts</Typography>
          <Typography level="body-xs">Bloom emails these addresses when something needs an admin.</Typography>
          {ADMIN_INBOX_KEYS.map((who) => (
            <Typography key={who} level="body-sm" sx={{ mt: 0.5 }}>
              <strong>{adminAudienceLabel(who, inboxNames)}:</strong> {(((s.owners as Record<string, string[]>) ?? {})[who] ?? []).join(", ") || "not set"}
            </Typography>
          ))}
          <Button size="sm" variant="outlined" sx={{ mt: 1 }} onClick={async () => {
            const owners = (s.owners as { jon?: string[]; jeff?: string[] }) ?? {};
            const r = await ask({ title: "Alert addresses", fields: [
              { name: "jon", label: `${adminAudienceLabel("jon", inboxNames)}: email`, kind: "text", helper: "Separate several with commas.", initial: (owners.jon ?? []).join(", ") },
              { name: "jeff", label: `${adminAudienceLabel("jeff", inboxNames)}: email`, kind: "text", helper: "Separate several with commas.", initial: (owners.jeff ?? []).join(", ") },
            ], confirmLabel: "Save" });
            if (r) run(() => bloomSupport.setSetting("owners", { jon: splitList(r.jon), jeff: splitList(r.jeff) }));
          }}>Edit</Button>
        </Sheet>
      )}
      {isAdmin && <ChatSpendPanel />}
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
                <td>{ROLE_LABEL[p.role] ?? p.role}</td>
                <td>{p.grants.map((g) => GRANT_LABEL[g] ?? g).join(", ") || "—"}</td>
                <td>{me.permissions.includes("admin.roles") && p.id !== me.id && (
                  <Select size="sm" value={p.role} onChange={(_, v) => v && run(() => bloomSupport.setRole({ principal_id: p.id, role: v }))}>
                    {["platform_admin", "platform_operator", "support", "client"].map((r) => <Option key={r} value={r}>{ROLE_LABEL[r] ?? r}</Option>)}
                  </Select>
                )}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        {me.permissions.includes("admin.roles") && (
          <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
            <Button size="sm" variant="outlined" onClick={async () => {
              const r = await ask({ title: "Add a team member", description: "They must have signed in to BloomSuite at least once.", fields: [
                { name: "email", label: "Their email", kind: "email", required: true },
                { name: "role", label: "What can they do?", kind: "select", required: true, initial: "support", options: [
  { value: "support", label: "Support", hint: "Handles client requests" },
  { value: "platform_operator", label: "Operator", hint: "Support plus account changes and fixes" },
  { value: "platform_admin", label: "Admin", hint: "Everything, including settings and people" },
] },
              ], confirmLabel: "Add" });
              if (r) run(() => bloomSupport.setRole({ email: String(r.email).trim(), role: String(r.role) }));
            }}>Add staff by email</Button>
            <Button size="sm" variant="outlined" onClick={async () => {
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
          {me.permissions.includes("admin.roles") && (
            <Button size="sm" variant="outlined" onClick={() => run(async () => {
              // A dedicated service identity that can only record repair outcomes
              // (engineering.report). This is the key the repair workflow's
              // BLOOM_REPAIR_REPORT_KEY secret should hold, never a person's key.
              const principalId = await bloomSupport.createServiceIdentity("Bloom repair report", "repair_report");
              setNewKey((await bloomSupport.createKey({ label: "Bloom repair report", principal_id: principalId })).token);
            })}>New repair report key</Button>
          )}
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

export function ProblemsPanel({ onOpenTicket }: { onOpenTicket: (id: string) => void }) {
  const q = useQuery({ queryKey: ["bloom-support", "problems"], queryFn: () => bloomSupport.problems() });
  const { run, error } = useAction();
  const { ask, dialog } = useAskDialog();
  if (q.isLoading) return <Loading />;
  if (q.error) return <Alert color="danger">{(q.error as Error).message}</Alert>;
  return (
    <Stack spacing={1}>
      {dialog}
      {error && <Alert color="danger">{error}</Alert>}
      <Stack direction="row"><Button size="sm" onClick={async () => { const r = await ask({ title: "New shared problem", description: "Group requests from several clients about the same issue, so it is fixed once.", fields: [{ name: "title", label: "What's the problem?", kind: "text", required: true, placeholder: "e.g. Checkout fails on phones" }], confirmLabel: "Create" }); if (r) run(() => bloomSupport.createProblem({ title: String(r.title).trim() })); }}>New shared problem</Button></Stack>
      {!q.data?.length && <Empty title="No shared problems" description="When several clients hit the same issue, link their tickets to one problem: one investigation, separate private conversations." />}
      {(q.data ?? []).map((p) => {
        const tickets = (p.tickets as Array<{ id: string; number: number; status: string; account: string | null }>) ?? [];
        const eng = p.engineering as { status: string; pr_url: string | null } | null;
        return (
          <Sheet key={String(p.id)} variant="outlined" sx={{ p: 1.5, borderRadius: "md" }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Chip size="sm" color={p.kind === "incident" ? "danger" : "neutral"}>{String(p.kind)}</Chip>
              <Typography level="title-sm">{String(p.title)}</Typography>
              <Chip size="sm" variant="outlined">{problemLabel(p.status)}</Chip>
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
            <Typography level="title-sm">{OPEN_BY[k].title}</Typography>
            {Object.entries(m.open_by[k]).map(([a, n]) => <Typography key={a} level="body-sm">{OPEN_BY[k].value(a)}: {n}</Typography>)}
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
