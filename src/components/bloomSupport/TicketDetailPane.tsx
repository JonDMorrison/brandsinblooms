import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Chip from "@mui/joy/Chip";
import Button from "@mui/joy/Button";
import Textarea from "@mui/joy/Textarea";
import Select from "@mui/joy/Select";
import Option from "@mui/joy/Option";
import Input from "@mui/joy/Input";
import Divider from "@mui/joy/Divider";
import Alert from "@mui/joy/Alert";
import Skeleton from "@mui/joy/Skeleton";
import Sheet from "@mui/joy/Sheet";
import ToggleButtonGroup from "@mui/joy/ToggleButtonGroup";
import Link from "@mui/joy/Link";
import { Bot, Lock, Paperclip, User, Wrench } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  bloomSupport, PRODUCT_LABEL, STATUS_LABEL, type SupportStatus, type TicketDetail, type TicketMessage, type Whoami,
} from "@/lib/bloomSupport/api";
import { StatusChip, PriorityChip, AutomationChip } from "./chips";

function Bubble({ m }: { m: TicketMessage }) {
  const internal = m.visibility === "internal";
  const mine = m.author_kind !== "client";
  return (
    <Sheet
      variant={internal ? "soft" : "outlined"}
      color={internal ? "warning" : "neutral"}
      sx={{ p: 1.5, borderRadius: "md", maxWidth: "88%", alignSelf: mine ? "flex-end" : "flex-start", ...(internal ? { borderStyle: "dashed", borderWidth: 1 } : {}) }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        {m.author_kind === "bloom" ? <Bot size={14} aria-hidden /> : internal ? <Lock size={14} aria-hidden /> : <User size={14} aria-hidden />}
        <Typography level="body-xs" fontWeight="lg">
          {m.author_kind === "bloom" ? "Bloom" : m.author?.name ?? (m.author_kind === "client" ? "Client" : "Staff")}
        </Typography>
        {internal && <Chip size="sm" color="warning" variant="solid">Internal note</Chip>}
        <Typography level="body-xs" textColor="text.tertiary">{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</Typography>
        {m.delivery && m.delivery !== "none" && <Typography level="body-xs" textColor="text.tertiary">· email {m.delivery}</Typography>}
      </Stack>
      <Typography level="body-sm" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.body}</Typography>
    </Sheet>
  );
}

export function TicketDetailPane({ ticketId, me, onOpenTicket }: { ticketId: string; me: Whoami; onOpenTicket: (id: string) => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["bloom-support", "ticket", ticketId], queryFn: () => bloomSupport.getTicket(ticketId), refetchInterval: 20_000 });
  const [visibility, setVisibility] = useState<"public" | "internal">("internal");
  const [draft, setDraft] = useState("");
  const [nextAction, setNextAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkTo, setLinkTo] = useState("");
  const replyKey = useRef(crypto.randomUUID());
  const staff = me.role !== "client";

  const patchCache = (t: Partial<TicketDetail>) => {
    qc.setQueryData<TicketDetail>(["bloom-support", "ticket", ticketId], (old) => (old ? { ...old, ...t } : old));
    qc.invalidateQueries({ queryKey: ["bloom-support", "tickets"] });
    qc.invalidateQueries({ queryKey: ["bloom-support", "summary"] });
  };
  const run = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onSuccess: async () => {
      setError(null);
      const fresh = await bloomSupport.getTicket(ticketId);
      patchCache(fresh);
    },
    onError: (e: Error) => setError(e.message),
  });

  const t = q.data;
  const conversationNumbers = useMemo(() => new Map((t?.conversation_tickets ?? []).map((c) => [c.id, c.number])), [t]);
  if (q.isLoading) return <Stack spacing={1} sx={{ p: 2 }}><Skeleton variant="text" level="h3" /><Skeleton variant="rectangular" height={240} /></Stack>;
  if (q.error) return <Alert color="danger" sx={{ m: 2 }}>{(q.error as Error).message}</Alert>;
  if (!t) return null;

  const send = () =>
    run.mutate(async () => {
      await bloomSupport.addMessage(t.id, { body: draft, visibility, idempotency_key: replyKey.current });
      setDraft("");
      replyKey.current = crypto.randomUUID();
    });

  return (
    <Stack sx={{ height: "100%", minHeight: 0 }}>
      {/* Header: client identity, status, owner, next action, automation */}
      <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography level="body-sm" textColor="text.tertiary">#{t.number}</Typography>
          <StatusChip status={t.status} />
          <PriorityChip priority={t.priority} />
          <Chip size="sm" variant="outlined">{PRODUCT_LABEL[t.product] ?? t.product}</Chip>
          {t.kind !== "unknown" && <Chip size="sm" variant="plain">{t.kind}</Chip>}
          {staff && t.automation && <AutomationChip mode={t.automation} />}
        </Stack>
        <Typography level="title-lg" sx={{ mt: 0.5 }}>{t.subject}</Typography>
        <Typography level="body-sm">
          {t.account ? <strong>{t.account.name}</strong> : <em>No client account linked</em>}
          {t.requester?.email && <> · {t.requester.name ? `${t.requester.name} ` : ""}&lt;{t.requester.email}&gt;</>}
          {" · "}opened {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
        </Typography>
        {staff && (
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mt: 1.5 }} alignItems={{ md: "center" }}>
            <Select size="sm" value={t.status} aria-label="Status" sx={{ minWidth: 150 }}
              onChange={(_, v) => v && v !== t.status && run.mutate(() => bloomSupport.updateTicket(t.id, {
                version: t.version, status: v,
                ...(v === "resolved" ? { resolution_summary: window.prompt("What resolved it? (sent to the client)") ?? "" } : {}),
              }))}>
              {(Object.keys(STATUS_LABEL) as SupportStatus[]).map((s) => <Option key={s} value={s}>{STATUS_LABEL[s]}</Option>)}
            </Select>
            <Select size="sm" value={t.priority} aria-label="Priority" sx={{ minWidth: 110 }}
              onChange={(_, v) => v && v !== t.priority && run.mutate(() => bloomSupport.updateTicket(t.id, { version: t.version, priority: v }))}>
              {["low", "normal", "high", "urgent"].map((p) => <Option key={p} value={p}>{p}</Option>)}
            </Select>
            <Button size="sm" variant="outlined" color="neutral" onClick={() => run.mutate(() => bloomSupport.updateTicket(t.id, { version: t.version, owner_id: t.owner?.id === me.id ? null : me.id }))}>
              {t.owner ? (t.owner.id === me.id ? "Unassign me" : `Owner: ${t.owner.name ?? "staff"}`) : "Assign to me"}
            </Button>
            {t.automation === "auto"
              ? <Button size="sm" variant="soft" color="warning" onClick={() => run.mutate(() => bloomSupport.setAutomation(t.id, "human", "manual takeover"))}>Take over from Bloom</Button>
              : <Button size="sm" variant="soft" color="success" onClick={() => run.mutate(() => bloomSupport.setAutomation(t.id, "auto"))}>Hand back to Bloom</Button>}
          </Stack>
        )}
        {staff && (
          <Stack direction="row" spacing={1} sx={{ mt: 1 }} alignItems="center">
            <Typography level="body-xs" fontWeight="lg" sx={{ whiteSpace: "nowrap" }}>Next action</Typography>
            <Input size="sm" sx={{ flex: 1 }} value={nextAction ?? t.next_action ?? ""} placeholder="Who does what next"
              onChange={(e) => setNextAction(e.target.value)}
              onBlur={() => nextAction !== null && nextAction !== (t.next_action ?? "") && run.mutate(async () => { await bloomSupport.updateTicket(t.id, { version: t.version, next_action: nextAction }); setNextAction(null); })} />
          </Stack>
        )}
        {error && <Alert color="danger" variant="soft" sx={{ mt: 1 }}>{error}</Alert>}
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: "auto", display: "grid", gridTemplateColumns: { xs: "1fr", lg: staff ? "minmax(0,1fr) 300px" : "1fr" } }}>
        {/* Conversation */}
        <Stack spacing={1.25} sx={{ p: 2 }}>
          {t.conversation_tickets.length > 0 && (
            <Alert size="sm" variant="soft" color="primary">
              Same conversation: {t.conversation_tickets.map((c) => <Link key={c.id} component="button" onClick={() => onOpenTicket(c.id)} sx={{ mx: 0.5 }}>#{c.number} {c.subject} ({STATUS_LABEL[c.status]})</Link>)}
            </Alert>
          )}
          {t.messages.map((m) => (
            <Box key={m.id} sx={{ display: "flex", flexDirection: "column" }}>
              {m.ticket_id && m.ticket_id !== t.id && <Typography level="body-xs" textColor="text.tertiary">On request #{conversationNumbers.get(m.ticket_id) ?? "other"}</Typography>}
              <Bubble m={m} />
            </Box>
          ))}
          {t.attachments.length > 0 && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {t.attachments.map((a) => (
                <Chip key={a.id} variant="outlined" startDecorator={<Paperclip size={12} />} color={a.visibility === "internal" ? "warning" : "neutral"}
                  onClick={async () => { const { url } = await bloomSupport.attachmentUrl(a.id); window.open(url, "_blank", "noopener"); }}>
                  {a.file_name}
                </Chip>
              ))}
            </Stack>
          )}
          {/* Composer */}
          {t.status !== "resolved" || staff ? (
            <Sheet variant="outlined" sx={{ p: 1.5, borderRadius: "md", mt: 1, borderColor: visibility === "internal" ? "warning.outlinedBorder" : "primary.outlinedBorder" }}>
              {staff && (
                <ToggleButtonGroup size="sm" value={visibility} onChange={(_, v) => v && setVisibility(v)} sx={{ mb: 1 }} aria-label="Reply visibility">
                  <Button value="internal" startDecorator={<Lock size={14} />}>Internal note</Button>
                  <Button value="public" startDecorator={<User size={14} />}>Reply to client</Button>
                </ToggleButtonGroup>
              )}
              <Textarea minRows={3} value={draft} onChange={(e) => setDraft(e.target.value)}
                placeholder={visibility === "internal" && staff ? "Private note — never sent to the client" : "Your reply (emailed to the client)"} />
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
                <Typography level="body-xs" textColor="text.tertiary">
                  {staff && visibility === "public" && t.automation === "auto" ? "Replying publicly takes this ticket over from Bloom." : ""}
                </Typography>
                <Button size="sm" disabled={!draft.trim()} loading={run.isPending} color={visibility === "internal" && staff ? "warning" : "primary"} onClick={send}>
                  {visibility === "internal" && staff ? "Add note" : "Send reply"}
                </Button>
              </Stack>
            </Sheet>
          ) : null}
        </Stack>

        {/* Side panel: relationships, engineering, jobs, activity */}
        {staff && (
          <Stack spacing={1.5} sx={{ p: 2, borderLeft: { lg: "1px solid" }, borderColor: { lg: "divider" } }}>
            <Typography level="title-sm">Bloom</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button size="sm" variant="outlined" startDecorator={<Wrench size={14} />} onClick={() => run.mutate(() => bloomSupport.investigate(t.id))}>Investigate bug</Button>
              <Button size="sm" variant="outlined" onClick={() => run.mutate(() => bloomSupport.routeFeature(t.id))}>Feature → Jon</Button>
              <Button size="sm" variant="outlined" color="warning" onClick={() => { const reason = window.prompt("Why does this need Jon/Jeff?"); if (reason) run.mutate(() => bloomSupport.escalate(t.id, "both", reason)); }}>Escalate</Button>
            </Stack>
            {t.engineering && (
              <Sheet variant="soft" sx={{ p: 1, borderRadius: "sm" }}>
                <Typography level="body-xs" fontWeight="lg">Engineering: {String(t.engineering.status)}</Typography>
                {t.engineering.pr_url ? <Link level="body-xs" href={String(t.engineering.pr_url)} target="_blank" rel="noopener">Pull request</Link> : null}
                {(t.engineering.eligibility as { reasons?: string[] } | null)?.reasons?.length
                  ? <Typography level="body-xs">Needs review: {(t.engineering.eligibility as { reasons: string[] }).reasons.slice(0, 3).join("; ")}</Typography> : null}
              </Sheet>
            )}
            <Divider />
            <Typography level="title-sm">Link to another ticket</Typography>
            <Stack direction="row" spacing={1}>
              <Input size="sm" placeholder="Ticket id" value={linkTo} onChange={(e) => setLinkTo(e.target.value)} sx={{ flex: 1 }} />
              <Button size="sm" variant="outlined" disabled={!linkTo} onClick={() => run.mutate(async () => { await bloomSupport.link(t.id, linkTo.trim(), "duplicate"); setLinkTo(""); })}>Duplicate of</Button>
            </Stack>
            {t.links && t.links.length > 0 && t.links.map((l) => (
              <Link key={`${l.ticket_id}-${l.kind}`} level="body-xs" component="button" onClick={() => onOpenTicket(l.ticket_id)}>{l.kind}: #{l.number} {l.subject}</Link>
            ))}
            {t.account_history && t.account_history.length > 0 && (
              <>
                <Divider />
                <Typography level="title-sm">Client history</Typography>
                {t.account_history.slice(0, 6).map((h) => (
                  <Link key={h.id} level="body-xs" component="button" onClick={() => onOpenTicket(h.id)}>#{h.number} {h.subject} · {STATUS_LABEL[h.status]}</Link>
                ))}
              </>
            )}
            {t.jobs && t.jobs.length > 0 && (
              <>
                <Divider />
                <Typography level="title-sm">Automation</Typography>
                {t.jobs.slice(0, 6).map((j) => (
                  <Typography key={j.id} level="body-xs" color={j.status === "dead" || j.status === "failed" ? "danger" : "neutral"}>
                    {j.kind}: {j.status}{j.attempts > 1 ? ` (try ${j.attempts})` : ""}{j.last_error ? ` — ${j.last_error.slice(0, 80)}` : ""}
                  </Typography>
                ))}
              </>
            )}
            {t.emails && t.emails.length > 0 && (
              <>
                <Divider />
                <Typography level="title-sm">Email</Typography>
                {t.emails.slice(0, 5).map((e, i) => <Typography key={i} level="body-xs">{e.purpose} → {e.to}: {e.status}{e.error ? ` (${e.error.slice(0, 60)})` : ""}</Typography>)}
              </>
            )}
            {t.context && Object.keys(t.context).length > 0 && (
              <>
                <Divider />
                <Typography level="title-sm">Captured context</Typography>
                <Box component="pre" sx={{ fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-all", m: 0 }}>{JSON.stringify(t.context, null, 2)}</Box>
              </>
            )}
            {t.activity && (
              <>
                <Divider />
                <Typography level="title-sm">Activity</Typography>
                {t.activity.slice(-10).reverse().map((a, i) => (
                  <Typography key={i} level="body-xs" textColor="text.secondary">{a.actor ?? "Bloom"} · {a.action} · {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</Typography>
                ))}
              </>
            )}
          </Stack>
        )}
      </Box>
    </Stack>
  );
}
