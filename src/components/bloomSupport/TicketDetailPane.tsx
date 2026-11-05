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
import Accordion from "@mui/joy/Accordion";
import AccordionDetails from "@mui/joy/AccordionDetails";
import AccordionGroup from "@mui/joy/AccordionGroup";
import AccordionSummary from "@mui/joy/AccordionSummary";
import { Bot, Lock, Paperclip, User, Wrench } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  bloomSupport, KIND_LABEL, PRODUCT_LABEL, readBloomDiagnostics, STATUS_LABEL, statusLabel, WAITING_LABEL,
  type BloomDiagnostics, type SupportStatus, type TicketDetail, type TicketMessage, type WaitingReason, type Whoami,
} from "@/lib/bloomSupport/api";
import { StatusChip, PriorityChip, AutomationChip } from "./chips";
import { statusPatch } from "./statusPatch";
import { useAskDialog } from "./useAskDialog";
import { ReadableData } from "@/components/admin/ReadableData";
import { humanizeNextAction, humanizeStaffNote } from "../../../supabase/functions/_shared/bloom-support/notes";
import { useAdminInboxNames } from "./useAdminInboxNames";
import { ATTACHMENT_ACCEPT, checkAttachments, MAX_SUPPORT_BODY_LENGTH } from "@/lib/bloomSupport/constants";

function Bubble({ m }: { m: TicketMessage }) {
  const internal = m.visibility === "internal";
  const mine = m.author_kind !== "client";
  return (
    <Sheet
      variant={internal ? "soft" : "outlined"}
      color={internal ? "primary" : "neutral"}
      sx={{ p: 1.5, borderRadius: "md", maxWidth: "88%", alignSelf: mine ? "flex-end" : "flex-start", ...(internal ? { borderStyle: "dashed", borderWidth: 1 } : {}) }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
        {m.author_kind === "bloom" ? <Bot size={14} aria-hidden /> : internal ? <Lock size={14} aria-hidden /> : <User size={14} aria-hidden />}
        <Typography level="body-xs" fontWeight="lg">
          {m.author_kind === "bloom" ? "Bloom" : m.author?.name ?? (m.author_kind === "client" ? "Client" : "Staff")}
        </Typography>
        {internal && <Chip size="sm" color="neutral" variant="outlined">Internal note</Chip>}
        <Typography level="body-xs" textColor="text.tertiary">{formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}</Typography>
        {m.delivery && m.delivery !== "none" && <Typography level="body-xs" textColor="text.tertiary">· email {m.delivery}</Typography>}
      </Stack>
      <Typography level="body-sm" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{internal && m.author_kind === "bloom" ? humanizeStaffNote(m.body) : m.body}</Typography>
    </Sheet>
  );
}

/** What Bloom attached when it filed this ticket from chat. Staff only. */
function BloomDiagnosticsSection({ d }: { d: BloomDiagnostics }) {
  const row = (label: string, value: string | null) =>
    value ? <Typography level="body-xs"><strong>{label}:</strong> {value}</Typography> : null;
  return (
    <>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Bot size={14} aria-hidden />
        <Typography level="title-sm">Diagnostics from Bloom</Typography>
        {d.filedByStaff && <Chip size="sm" variant="soft" color="primary">{d.adminWorkspace ? "Filed by staff in client workspace" : "Filed by staff"}</Chip>}
      </Stack>
      <Sheet variant="soft" sx={{ p: 1, borderRadius: "sm" }}>
        <Stack spacing={0.25}>
          {row("Company", d.company)}
          {row("Page", d.route)}
          {row("Screen", d.viewport)}
          {row("Browser", d.userAgent)}
          {row("Captured", d.capturedAt ? formatDistanceToNow(new Date(d.capturedAt), { addSuffix: true }) : null)}
          {row("Bloom conversation", d.conversationId)}
        </Stack>
      </Sheet>
      <Typography level="body-xs" fontWeight="lg">Failed Bloom requests (24 hours before the report)</Typography>
      {d.failedRunsStatus === "unknown" ? (
        <Typography level="body-xs" color="warning">Bloom could not read these when the report was sent.</Typography>
      ) : d.failedRuns.length === 0 ? (
        <Typography level="body-xs" textColor="text.secondary">None.</Typography>
      ) : (
        d.failedRuns.map((r, i) => (
          <Typography key={`${r.tool}-${r.at ?? i}`} level="body-xs" color="danger" sx={{ wordBreak: "break-word" }}>
            {r.tool}{r.at ? ` · ${formatDistanceToNow(new Date(r.at), { addSuffix: true })}` : ""}{r.error ? `: ${r.error}` : ""}
          </Typography>
        ))
      )}
    </>
  );
}

function DetailSectionSummary({ title, detail }: { title: string; detail?: string }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0, width: "100%" }}>
      <Typography level="title-sm">{title}</Typography>
      {detail ? <Typography level="body-xs" textColor="text.tertiary" noWrap sx={{ ml: "auto !important" }}>{detail}</Typography> : null}
    </Stack>
  );
}

const dur = (v: unknown) => {
  const n = Number(v);
  if (v === null || v === undefined || !Number.isFinite(n)) return "—";
  if (n < 3600) return `${Math.round(n / 60)}m`;
  if (n < 86400) return `${(n / 3600).toFixed(1)}h`;
  return `${(n / 86400).toFixed(1)}d`;
};

type ReplyPayload = Parameters<typeof bloomSupport.addMessage>[1];

export function TicketDetailPane({ ticketId, me, onOpenTicket }: { ticketId: string; me: Whoami; onOpenTicket: (id: string) => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["bloom-support", "ticket", ticketId], queryFn: () => bloomSupport.getTicket(ticketId), refetchInterval: 20_000 });
  const [visibility, setVisibility] = useState<"public" | "internal">("internal");
  const [draft, setDraft] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replyNotice, setReplyNotice] = useState<string | null>(null);
  const [nextAction, setNextAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkTo, setLinkTo] = useState("");
  const replyKey = useRef(crypto.randomUUID());
  const pendingReply = useRef<ReplyPayload | null>(null);
  const replyInput = useRef<HTMLTextAreaElement | null>(null);
  const { ask, dialog } = useAskDialog();
  const staff = me.role !== "client";
  const adminNames = useAdminInboxNames(staff ? me : null);

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
  const replyRun = useMutation({
    mutationFn: (payload: ReplyPayload) => bloomSupport.addMessage(ticketId, payload),
    onSuccess: async () => {
      const sentVisibility = pendingReply.current?.visibility;
      pendingReply.current = null;
      replyKey.current = crypto.randomUUID();
      setDraft("");
      setReplyError(null);
      setReplyNotice(sentVisibility === "internal" ? "Internal note saved." : "Reply sent.");
      try {
        const fresh = await bloomSupport.getTicket(ticketId);
        patchCache(fresh);
      } catch {
        void qc.invalidateQueries({ queryKey: ["bloom-support", "ticket", ticketId] });
      }
    },
    onError: (e: Error) => {
      setReplyNotice(null);
      setReplyError(e.message);
    },
  });

  const t = q.data;
  const lastClientId = t ? [...t.messages].reverse().find((m) => m.author_kind === "client")?.id : undefined;
  const conversationNumbers = useMemo(() => new Map((t?.conversation_tickets ?? []).map((c) => [c.id, c.number])), [t]);
  const bloomDiagnostics = useMemo(() => readBloomDiagnostics(t?.context), [t?.context]);
  if (q.isLoading) return <Stack spacing={1} sx={{ p: 2 }}><Skeleton variant="text" level="h3" /><Skeleton variant="rectangular" height={240} /></Stack>;
  if (q.error) return <Alert color="danger" sx={{ m: 2 }}>{(q.error as Error).message}</Alert>;
  if (!t) return null;

  const retryLocked = pendingReply.current !== null && replyError !== null;
  const replyLocked = replyRun.isPending || retryLocked;
  const replyLabel = staff && visibility === "internal" ? "Internal note message" : "Reply message";
  const send = () => {
    const payload = pendingReply.current ?? {
      body: draft.trim(),
      visibility: staff ? visibility : "public",
      idempotency_key: replyKey.current,
    };
    pendingReply.current = payload;
    setReplyError(null);
    setReplyNotice(null);
    replyRun.mutate(payload);
  };
  const editAsNewReply = () => {
    pendingReply.current = null;
    replyKey.current = crypto.randomUUID();
    setReplyError(null);
    setReplyNotice(null);
    replyRun.reset();
    window.requestAnimationFrame(() => replyInput.current?.focus());
  };

  return (
    <Stack sx={{ height: "100%", minHeight: 0 }}>
      {dialog}
      {/* Header: client identity, status, owner, next action, automation */}
      <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography level="body-sm" textColor="text.tertiary">#{t.number}</Typography>
          <StatusChip status={t.status} audience={staff ? "staff" : "client"} />
          <PriorityChip priority={t.priority} />
          <Chip size="sm" variant="outlined">{PRODUCT_LABEL[t.product] ?? t.product}</Chip>
          {t.kind !== "unknown" && <Chip size="sm" variant="plain">{t.kind}</Chip>}
          {staff && t.automation && <AutomationChip mode={t.automation} />}
          {/* Clients read waiting state from the status chip ("Waiting for your reply"); the reason is staff routing detail. */}
          {staff && t.waiting_reason && <Chip size="sm" variant="soft" color="warning">{WAITING_LABEL[t.waiting_reason]}</Chip>}
          {staff && t.flags?.overdue && <Chip size="sm" color="danger" variant="solid">Overdue</Chip>}
          {staff && !t.flags?.overdue && t.flags?.due_soon && <Chip size="sm" color="warning">Due soon</Chip>}
          {staff && t.flags?.stalled && <Chip size="sm" color="warning" variant="outlined">Stalled</Chip>}
          {staff && t.spam && <Chip size="sm" color="neutral" variant="solid">Spam</Chip>}
          {staff && (t.tags ?? []).map((g) => <Chip key={g} size="sm" variant="outlined">#{g}</Chip>)}
        </Stack>
        {t.merged_into && <Alert size="sm" color="neutral" sx={{ mt: 1 }}>Merged into <Link component="button" onClick={() => onOpenTicket(t.merged_into!)}>#{t.merged_into_number}</Link>. Continue there.</Alert>}
        {!staff && t.progress && <Typography level="body-sm" sx={{ mt: 0.5 }}>{t.progress}</Typography>}
        <Typography level="title-lg" sx={{ mt: 0.5 }}>{t.subject}</Typography>
        <Typography level="body-sm">
          {t.account ? <strong>{t.account.name}</strong> : <em>No client account linked</em>}
          {t.requester?.email && <> · {t.requester.name ? `${t.requester.name} ` : ""}&lt;{t.requester.email}&gt;</>}
          {" · "}opened {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
          {staff && <> · {KIND_LABEL[t.kind] ?? t.kind} · {t.environment ?? "production"} · via {t.channel}{t.source_ref ? ` (${t.source_ref})` : ""}</>}
        </Typography>
        {staff && (
          <Typography level="body-xs" textColor="text.secondary">
            Accountable: <strong>{t.owner?.name ?? "Unassigned (default owner accountable)"}</strong> · Doing the work: <strong>{t.executor === "bloom" ? "Bloom" : t.executor_person?.name ?? "a person"}</strong>
            {t.flags?.response_due_at ? ` · First response due ${formatDistanceToNow(new Date(t.flags.response_due_at), { addSuffix: true })}` : ""}
            {t.next_action_due_at ? ` · Next action due ${formatDistanceToNow(new Date(t.next_action_due_at), { addSuffix: true })}` : ""}
            {t.flags?.targets_are_internal ? " (internal targets)" : ""}
          </Typography>
        )}
        {staff && (
          <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mt: 1.5 }} alignItems={{ md: "center" }}>
            <Select size="sm" value={t.status} aria-label="Status" sx={{ minWidth: 150 }}
              onChange={async (_, v) => {
                if (!v || v === t.status) return;
                const patch = await statusPatch(ask, t, v as SupportStatus, adminNames);
                if (patch) run.mutate(() => bloomSupport.updateTicket(t.id, { version: t.version, ...patch }));
              }}>
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
              ? <Button size="sm" variant="outlined" color="neutral" onClick={() => run.mutate(() => bloomSupport.setAutomation(t.id, "human", "manual takeover"))}>Take over from Bloom</Button>
              : <Button size="sm" variant="soft" color="success" onClick={() => run.mutate(() => bloomSupport.setAutomation(t.id, "auto"))}>Hand back to Bloom</Button>}
          </Stack>
        )}
        {staff && (
          <Stack direction="row" spacing={1} sx={{ mt: 1 }} alignItems="center">
            <Typography level="body-xs" fontWeight="lg" sx={{ whiteSpace: "nowrap" }}>Next action</Typography>
            <Input size="sm" type="datetime-local" sx={{ width: 210 }} aria-label="Next action due"
              defaultValue={t.next_action_due_at ? t.next_action_due_at.slice(0, 16) : ""}
              onBlur={(e) => { const v = e.target.value; if (v !== (t.next_action_due_at ?? "").slice(0, 16)) run.mutate(() => bloomSupport.updateTicket(t.id, { version: t.version, next_action_due_at: v ? new Date(v).toISOString() : null })); }} />
            <Input size="sm" sx={{ flex: 1 }} value={nextAction ?? (t.next_action ? humanizeNextAction(t.next_action) : "")} placeholder="Who does what next"
              onChange={(e) => setNextAction(e.target.value)}
              onBlur={() => nextAction !== null && nextAction !== (t.next_action ?? "") && run.mutate(async () => { await bloomSupport.updateTicket(t.id, { version: t.version, next_action: nextAction }); setNextAction(null); })} />
          </Stack>
        )}
        {staff && t.pending_review === "reply_after_resolution" && (
          <Alert color="primary" variant="soft" sx={{ mt: 1 }}>
            <Stack spacing={1}>
              <Typography level="body-sm">The client replied after this was resolved. Decide what it is:</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button size="sm" onClick={() => run.mutate(() => bloomSupport.postReply(t.id, "reopen", lastClientId))}>Still the same issue — reopen</Button>
                <Button size="sm" variant="outlined" onClick={() => run.mutate(() => bloomSupport.postReply(t.id, "new_ticket", lastClientId))}>New request — linked ticket</Button>
                <Button size="sm" variant="plain" onClick={() => run.mutate(() => bloomSupport.postReply(t.id, "dismiss", lastClientId))}>Just thanks — keep resolved</Button>
              </Stack>
            </Stack>
          </Alert>
        )}
        {!staff && t.status === "resolved" && !t.merged_into && (
          <Stack direction="row" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
            <Button size="sm" color="success" onClick={() => run.mutate(() => bloomSupport.clientAction(t.id, "confirm_resolved"))}>Yes, it's fixed</Button>
            <Button size="sm" variant="outlined" color="warning" onClick={async () => { const r = await ask({ title: "It's still happening", description: "Tell us what you see now, and we'll pick it straight back up.", fields: [{ name: "m", label: "What is still happening?", kind: "textarea", required: true }], confirmLabel: "Send" }); if (r) run.mutate(() => bloomSupport.clientAction(t.id, "still_broken", String(r.m).trim())); }}>It's still happening</Button>
          </Stack>
        )}
        {!staff && t.status !== "resolved" && !t.merged_into && (
          <Button size="sm" variant="plain" sx={{ mt: 1 }} onClick={() => run.mutate(() => bloomSupport.clientAction(t.id, "request_person"))}>Talk to a person</Button>
        )}
        {error && <Alert color="danger" variant="soft" sx={{ mt: 1 }}>{error}</Alert>}
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: { xs: "auto", lg: "hidden" }, display: "grid", gridTemplateColumns: { xs: "1fr", lg: staff ? "minmax(0,1fr) 300px" : "1fr" } }}>
        {/* Conversation */}
        <Stack spacing={1.25} sx={{ p: 2, minHeight: 0, overflowY: { xs: "visible", lg: "auto" } }}>
          {t.conversation_tickets.length > 0 && (
            <Alert size="sm" variant="soft" color="primary">
              Same conversation: {t.conversation_tickets.map((c) => <Link key={c.id} component="button" onClick={() => onOpenTicket(c.id)} sx={{ mx: 0.5 }}>#{c.number} {c.subject} ({statusLabel(c.status, staff ? "staff" : "client")})</Link>)}
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
                <Chip key={a.id} variant="outlined" startDecorator={<Paperclip size={12} />} color="neutral"
                  onClick={async () => { const { url } = await bloomSupport.attachmentUrl(a.id); window.open(url, "_blank", "noopener"); }}>
                  {a.file_name}
                </Chip>
              ))}
            </Stack>
          )}
          {/* Composer */}
          {!t.merged_into && (t.status !== "resolved" || staff) ? (
            <Sheet variant="outlined" sx={{ p: 1.5, borderRadius: "md", mt: 1, borderColor: "neutral.outlinedBorder" }}>
              {staff && (
                <ToggleButtonGroup size="sm" value={visibility} onChange={(_, v) => v && setVisibility(v)} sx={{ mb: 1 }} aria-label="Reply visibility">
                  <Button value="internal" disabled={replyLocked} startDecorator={<Lock size={14} />}>Internal note</Button>
                  <Button value="public" disabled={replyLocked} startDecorator={<User size={14} />}>Reply to client</Button>
                </ToggleButtonGroup>
              )}
              <Textarea minRows={3} value={draft} disabled={replyLocked} onChange={(e) => setDraft(e.target.value)}
                slotProps={{ textarea: { ref: replyInput, disabled: replyLocked, maxLength: MAX_SUPPORT_BODY_LENGTH, "aria-label": replyLabel, "aria-describedby": replyError ? "reply-body-count reply-send-error" : "reply-body-count" } }}
                placeholder={visibility === "internal" && staff ? "Private note — never sent to the client" : "Your reply (emailed to the client)"} />
              <Typography id="reply-body-count" level="body-xs" color={draft.length > MAX_SUPPORT_BODY_LENGTH ? "danger" : undefined} textColor={draft.length > MAX_SUPPORT_BODY_LENGTH ? undefined : "text.tertiary"} sx={{ mt: 0.5, textAlign: "right" }}>
                {draft.length.toLocaleString()} / {MAX_SUPPORT_BODY_LENGTH.toLocaleString()} characters
              </Typography>
              {replyError && (
                <Alert id="reply-send-error" role="alert" color="danger" variant="soft" sx={{ mt: 1 }}>
                  <Stack spacing={0.5}>
                    <Typography level="body-sm">{replyError}</Typography>
                    <Typography level="body-xs">
                      Your reply is unchanged. Retry it exactly, or choose edit and send as new before changing anything.
                    </Typography>
                  </Stack>
                </Alert>
              )}
              {replyNotice && <Typography role="status" aria-live="polite" level="body-sm" color="success" sx={{ mt: 1 }}>{replyNotice}</Typography>}
              <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} spacing={1} sx={{ mt: 1 }}>
                <Typography level="body-xs" textColor="text.tertiary" sx={{ flex: 1 }}>
                  {staff && visibility === "public" && t.automation === "auto" ? "Replying publicly takes this ticket over from Bloom." : ""}
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <Button size="sm" variant="plain" component="label" disabled={replyLocked || run.isPending} startDecorator={<Paperclip size={14} />}>
                    Attach one file
                    <input hidden type="file" disabled={replyLocked || run.isPending} accept={ATTACHMENT_ACCEPT} onChange={async (e) => {
                      const { accepted, rejected } = checkAttachments(Array.from(e.target.files ?? []));
                      e.target.value = "";
                      if (rejected.length) {
                        setError(`${rejected.join(" ")} No file was attached; choose a valid file and try again.`);
                        return;
                      }
                      if (!accepted.length) return;
                      run.mutate(() => bloomSupport.uploadAttachment(t.id, accepted[0], staff && visibility === "internal" ? "internal" : "public"));
                    }} />
                  </Button>
                  {retryLocked && (
                    <Button size="sm" variant="outlined" color="neutral" onClick={editAsNewReply}>
                      Edit and send as new reply
                    </Button>
                  )}
                  <Button size="sm" disabled={replyRun.isPending || !draft.trim() || draft.length > MAX_SUPPORT_BODY_LENGTH} loading={replyRun.isPending} color="primary" onClick={send}>
                    {retryLocked ? "Retry same reply" : visibility === "internal" && staff ? "Add note" : "Send reply"}
                  </Button>
                </Stack>
              </Stack>
            </Sheet>
          ) : null}
        </Stack>

        {/* Side panel: the next useful action stays visible; supporting evidence is on demand. */}
        {staff && (
          <Stack spacing={1.5} sx={{ p: 2, borderLeft: { lg: "1px solid" }, borderColor: { lg: "divider" }, minWidth: 0, minHeight: 0, overflowY: { xs: "visible", lg: "auto" } }}>
            <Stack spacing={0.25}>
              <Typography level="title-sm">Ticket tools</Typography>
              <Typography level="body-xs" textColor="text.tertiary">Extra actions and supporting details.</Typography>
            </Stack>
            {t.problem ? (
              <Sheet variant="soft" sx={{ p: 1, borderRadius: "sm" }}>
                <Typography level="body-xs" fontWeight="lg">{t.problem.kind === "incident" ? "Incident" : "Shared problem"}: {t.problem.title}</Typography>
                <Typography level="body-xs">{t.problem.tickets} tickets from {t.problem.accounts} clients · {t.problem.status}</Typography>
              </Sheet>
            ) : null}
            {t.engineering ? (
              <Sheet variant="soft" sx={{ p: 1, borderRadius: "sm" }}>
                <Typography level="body-xs" fontWeight="lg">Engineering: {String(t.engineering.status)}</Typography>
                {t.engineering.pr_url ? <Link level="body-xs" href={String(t.engineering.pr_url)} target="_blank" rel="noopener">Pull request</Link> : null}
                {(t.engineering.eligibility as { reasons?: string[] } | null)?.reasons?.length
                  ? <Typography level="body-xs">Needs review: {(t.engineering.eligibility as { reasons: string[] }).reasons.slice(0, 3).join("; ")}</Typography> : null}
              </Sheet>
            ) : null}

            <AccordionGroup
              size="sm"
              sx={{
                "--AccordionGroup-gap": "0.5rem",
                "--Accordion-radius": "var(--joy-radius-md)",
                "--AccordionDetails-paddingInline": "0.75rem",
                "& .MuiAccordion-root": { border: "1px solid", borderColor: "divider", bgcolor: "background.surface" },
              }}
            >
              <Accordion>
                <AccordionSummary><DetailSectionSummary title="More actions" /></AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={0.75} alignItems="flex-start" sx={{ pb: 1 }}>
                    <Button size="sm" variant="plain" startDecorator={<Wrench size={14} />} onClick={() => run.mutate(() => bloomSupport.investigate(t.id))}>Investigate bug</Button>
                    <Button size="sm" variant="plain" color="neutral" onClick={async () => { const r = await ask({ title: "Escalate to an admin", fields: [{ name: "reason", label: "Why does this need an admin?", kind: "textarea", required: true }], confirmLabel: "Send to the admins" }); if (r) run.mutate(() => bloomSupport.escalate(t.id, "both", String(r.reason).trim())); }}>Escalate to an admin</Button>
                    <Button size="sm" variant="plain" onClick={() => run.mutate(() => bloomSupport.routeFeature(t.id))}>Send feature request to an admin</Button>
                    <Button size="sm" variant="plain" onClick={async () => {
                      const r = await ask({ title: "Merge into another request", description: "Use this when the same client asked the same thing twice. Both must be for the same client.", fields: [{ name: "n", label: "Request number", kind: "text", required: true, placeholder: "e.g. 1042" }], confirmLabel: "Merge" });
                      if (!r) return;
                      const n = String(r.n).trim();
                      const found = await bloomSupport.pageTickets({ q: `#${n.replace("#", "")}`, limit: "1" });
                      const target = found.items.find((x) => String(x.number) === n.replace("#", ""));
                      if (!target) { setError(`Ticket #${n} not found`); return; }
                      run.mutate(() => bloomSupport.merge(t.id, target.id, "duplicate"));
                    }}>Merge duplicate into…</Button>
                    <Button size="sm" variant="plain" onClick={async () => {
                      const problems = await bloomSupport.problems().catch(() => [] as Array<Record<string, unknown>>);
                      const r = await ask({ title: "Link to a shared problem", description: "Group this with other clients' requests about the same issue.", fields: [{ name: "id", label: "Which problem?", kind: "select", required: true, initial: "__new", options: [{ value: "__new", label: "Create a new one from this request" }, ...problems.map((p) => ({ value: String(p.id), label: String(p.title) }))] }], confirmLabel: "Link" });
                      if (!r) return;
                      const id = r.id === "__new" ? "" : String(r.id);
                      run.mutate(async () => {
                        const problemId = id || String((await bloomSupport.createProblem({ title: t.subject, product: t.product })).id);
                        await bloomSupport.linkProblem(t.id, problemId);
                      });
                    }}>Link to shared problem</Button>
                    <Button size="sm" variant="plain" color="neutral" onClick={() => run.mutate(() => bloomSupport.spam(t.id, !t.spam))}>{t.spam ? "Mark as not spam" : "Mark as spam"}</Button>
                  </Stack>
                </AccordionDetails>
              </Accordion>

              <Accordion>
                <AccordionSummary>
                  <DetailSectionSummary title="Related requests" detail={`${(t.links?.length ?? 0) + (t.account_history?.length ?? 0)} related`} />
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={1} sx={{ pb: 1 }}>
                    <Stack direction="row" spacing={1}>
                      <Input size="sm" aria-label="Ticket id to link" placeholder="Ticket id" value={linkTo} onChange={(e) => setLinkTo(e.target.value)} sx={{ flex: 1 }} />
                      <Button size="sm" variant="outlined" disabled={!linkTo} onClick={() => run.mutate(async () => { await bloomSupport.link(t.id, linkTo.trim(), "duplicate"); setLinkTo(""); })}>Link</Button>
                    </Stack>
                    {t.links?.map((l) => (
                      <Link key={`${l.ticket_id}-${l.kind}`} level="body-xs" component="button" onClick={() => onOpenTicket(l.ticket_id)}>{l.kind}: #{l.number} {l.subject}</Link>
                    ))}
                    {t.account_history?.slice(0, 6).map((h) => (
                      <Link key={h.id} level="body-xs" component="button" onClick={() => onOpenTicket(h.id)}>Client history: #{h.number} {h.subject} · {STATUS_LABEL[h.status]}</Link>
                    ))}
                    {!t.links?.length && !t.account_history?.length ? <Typography level="body-xs" textColor="text.tertiary">No related requests yet.</Typography> : null}
                  </Stack>
                </AccordionDetails>
              </Accordion>

              {(t.jobs?.length || t.emails?.length) ? (
                <Accordion>
                  <AccordionSummary><DetailSectionSummary title="Automation & delivery" detail={`${(t.jobs?.length ?? 0) + (t.emails?.length ?? 0)} events`} /></AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={1} sx={{ pb: 1 }}>
                      {t.jobs?.slice(0, 6).map((j) => (
                        <Typography key={j.id} level="body-xs" color={j.status === "dead" || j.status === "failed" ? "danger" : "neutral"}>
                          {j.kind}: {j.status}{j.attempts > 1 ? ` (try ${j.attempts})` : ""}{j.last_error ? ` — ${j.last_error.slice(0, 80)}` : ""}
                        </Typography>
                      ))}
                      {t.emails?.slice(0, 5).map((e, i) => <Typography key={`${e.purpose}-${e.created_at}-${i}`} level="body-xs">{e.purpose} → {e.to}: {e.status}{e.error ? ` (${e.error.slice(0, 60)})` : ""}</Typography>)}
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              ) : null}

              {(t.timers || t.history?.length || t.activity?.length) ? (
                <Accordion>
                  <AccordionSummary><DetailSectionSummary title="Timing & history" /></AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={1} sx={{ pb: 1 }}>
                      {t.timers ? (
                        <Stack spacing={0.25}>
                          <Typography level="body-xs">Age {dur(t.timers.age_seconds)} · our clock {dur(t.timers.our_clock_seconds)} ({dur(t.timers.our_clock_business_seconds)} business)</Typography>
                          <Typography level="body-xs">Waiting on customer {dur(t.timers.waiting_customer_seconds)} · third party {dur(t.timers.waiting_third_party_seconds)} · scheduled {dur(t.timers.scheduled_seconds)}</Typography>
                          <Typography level="body-xs">First response {dur(t.timers.first_response_seconds)} · first resolution {dur(t.timers.first_resolution_seconds)}{t.timers.reopened ? ` · latest resolution ${dur(t.timers.latest_resolution_seconds)}` : ""}</Typography>
                        </Stack>
                      ) : null}
                      {t.history?.length ? <Divider /> : null}
                      {t.history?.slice(-12).reverse().map((h, i) => (
                        <Typography key={`${h.at}-${h.kind}-${i}`} level="body-xs" textColor="text.secondary">{h.kind}: {h.from ?? "—"} → {h.to ?? "—"} · {h.actor ?? "Bloom/system"} · {formatDistanceToNow(new Date(h.at), { addSuffix: true })}</Typography>
                      ))}
                      {t.activity?.length ? <Divider /> : null}
                      {t.activity?.slice(-10).reverse().map((a, i) => (
                        <Typography key={`${a.created_at}-${a.action}-${i}`} level="body-xs" textColor="text.secondary">{a.actor ?? "Bloom"} · {a.action} · {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</Typography>
                      ))}
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              ) : null}

              {(t.resolution_evidence || bloomDiagnostics || (t.context && Object.keys(t.context).length > 0)) ? (
                <Accordion>
                  <AccordionSummary><DetailSectionSummary title="Technical context" /></AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={1} sx={{ pb: 1 }}>
                      {t.resolution_evidence ? (
                        <>
                          <Typography level="body-xs" fontWeight="lg">Resolution evidence</Typography>
                          <ReadableData value={t.resolution_evidence} />
                        </>
                      ) : null}
                      {bloomDiagnostics ? <BloomDiagnosticsSection d={bloomDiagnostics} /> : null}
                      {t.context && Object.keys(t.context).length > 0 ? (
                        <>
                          <Typography level="body-xs" fontWeight="lg">Captured context</Typography>
                          <ReadableData value={t.context} />
                        </>
                      ) : null}
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              ) : null}
            </AccordionGroup>
          </Stack>
        )}
      </Box>
    </Stack>
  );
}
