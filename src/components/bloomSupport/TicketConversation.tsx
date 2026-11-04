import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Button from "@mui/joy/Button";
import IconButton from "@mui/joy/IconButton";
import Textarea from "@mui/joy/Textarea";
import Sheet from "@mui/joy/Sheet";
import Chip from "@mui/joy/Chip";
import Alert from "@mui/joy/Alert";
import Skeleton from "@mui/joy/Skeleton";
import Link from "@mui/joy/Link";
import Dropdown from "@mui/joy/Dropdown";
import MenuButton from "@mui/joy/MenuButton";
import Menu from "@mui/joy/Menu";
import MenuItem from "@mui/joy/MenuItem";
import { ArrowLeft, Check, Lock, Paperclip, Sprout } from "lucide-react";
import { format, formatDistanceToNow, isToday } from "date-fns";
import { bloomSupport, PRODUCT_LABEL, WAITING_LABEL, type TicketDetail, type TicketMessage, type Whoami } from "@/lib/bloomSupport/api";
import { statusPatch } from "./statusPatch";
import { ENGINEERING_TEXT } from "./labels";
import { useAskDialog } from "./useAskDialog";
import { ATTACHMENT_ACCEPT, checkAttachments, MAX_SUPPORT_BODY_LENGTH } from "@/lib/bloomSupport/constants";

/**
 * Bloom Support conversation: one ticket read as a chat, with the single thing it needs
 * from a person at the top and the reply box at the bottom. Every action calls the same
 * endpoints as the detailed desk view, which stays one click away.
 */

type Tone = "warning" | "primary" | "success" | "neutral";
type Banner = { tone: Tone; text: string };
type ReplyPayload = Parameters<typeof bloomSupport.addMessage>[1];

const STAGE_TEXT: Record<string, string> = {
  intake: "Bloom has the request and is reading it.",
  triage: "Bloom is working out what this needs.",
  answering: "Bloom is answering.",
  operating: "Bloom is making the change.",
  investigating: "Bloom is investigating.",
  fixing: "Bloom is preparing a fix.",
  releasing: "Releasing the fix.",
  verifying: "Checking the fix on the live site.",
  needs_info: "Waiting on the client for more detail.",
  awaiting_client: "Waiting on the client.",
};


function banner(t: TicketDetail): Banner {
  const eng = t.engineering as { status?: string } | null | undefined;
  // A reply after resolution needs a decision, so it outranks "Solved".
  if (t.pending_review === "reply_after_resolution") return { tone: "warning", text: "Waiting on you: the client replied after this was solved." };
  if (t.status === "resolved") return { tone: "success", text: t.resolved_at ? `Solved ${formatDistanceToNow(new Date(t.resolved_at), { addSuffix: true })}.` : "Solved." };
  if (eng?.status === "awaiting_approval") return { tone: "warning", text: "Waiting on you: approve the fix." };
  if (t.status === "needs_owner") return { tone: "warning", text: `Waiting on you: ${t.next_action ?? "a decision from Jon or Jeff"}` };
  if (t.automation === "human") return { tone: "neutral", text: `${t.taken_over_by?.name ?? "A person"} is handling this. Bloom has stepped back.` };
  if (t.automation === "paused") return { tone: "neutral", text: "Bloom is paused here and will only suggest, not act." };
  if (t.status === "waiting" && t.waiting_reason) return { tone: "primary", text: `${WAITING_LABEL[t.waiting_reason]}.` };
  return { tone: "primary", text: (t.stage && STAGE_TEXT[t.stage]) ?? "Bloom is working on this." };
}

const when = (d: string) => {
  const date = new Date(d);
  return isToday(date) ? format(date, "h:mm a") : format(date, "MMM d, h:mm a");
};
const initials = (name: string) =>
  name.replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

function Message({ m, clientName, onRequest }: { m: TicketMessage; clientName: string; onRequest?: string }) {
  const fromClient = m.author_kind === "client";
  const internal = m.visibility === "internal";
  const who = m.author_kind === "bloom" ? "Bloom" : m.author_kind === "system" ? "System" : m.author?.name ?? (fromClient ? clientName : "Staff");
  const meta = [onRequest, who, when(m.created_at), !internal && !fromClient && m.delivery && m.delivery !== "none" ? `email ${m.delivery}` : null].filter(Boolean).join(" · ");

  if (internal) {
    return (
      <Sheet variant="soft" color="primary" sx={{ p: 2, borderRadius: "lg", display: "flex", gap: 1.5, alignItems: "flex-start" }}>
        <Box sx={{ flex: "0 0 auto", width: 32, height: 32, borderRadius: "50%", bgcolor: m.author_kind === "bloom" ? "primary.solidBg" : "neutral.500", color: "common.white", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {m.author_kind === "bloom" ? <Sprout size={16} aria-hidden /> : <Lock size={14} aria-hidden />}
        </Box>
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          <Typography level="body-sm" textColor="text.tertiary"><Typography fontWeight="lg" textColor="text.primary">{m.author_kind === "bloom" ? "What Bloom found" : "Private note"}</Typography> · {meta} · only staff can see this</Typography>
          <Typography level="body-md" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.55 }}>{m.body}</Typography>
        </Stack>
      </Sheet>
    );
  }
  return (
    <Stack spacing={0.5} sx={{ alignItems: fromClient ? "flex-start" : "flex-end" }}>
      <Typography level="body-xs" textColor="text.tertiary">{meta}</Typography>
      <Sheet
        variant={fromClient ? "outlined" : "solid"}
        color={fromClient ? "neutral" : "primary"}
        sx={{ maxWidth: "88%", px: 2, py: 1.5, borderRadius: "18px", borderTopLeftRadius: fromClient ? "4px" : "18px", borderTopRightRadius: fromClient ? "18px" : "4px", bgcolor: fromClient ? "background.surface" : undefined }}
      >
        <Typography level="body-md" textColor="inherit" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.55 }}>{m.body}</Typography>
      </Sheet>
    </Stack>
  );
}

export function TicketConversation({ ticketId, me, onBack, onShowDetails, onOpenTicket }: { ticketId: string; me: Whoami; onBack: () => void; onShowDetails: () => void; onOpenTicket: (id: string) => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["bloom-support", "ticket", ticketId], queryFn: () => bloomSupport.getTicket(ticketId), refetchInterval: 20_000 });
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const replyKey = useRef(crypto.randomUUID());
  const pendingReply = useRef<ReplyPayload | null>(null);
  const replyInput = useRef<HTMLTextAreaElement | null>(null);
  const publicAttachmentInput = useRef<HTMLInputElement | null>(null);
  const privateAttachmentInput = useRef<HTMLInputElement | null>(null);
  const { ask, dialog } = useAskDialog();
  const can = (p: string) => me.permissions.includes(p);

  const run = useMutation({
    mutationFn: async ({ fn }: { fn: () => Promise<unknown>; done?: string }) => fn(),
    onMutate: () => { setError(null); setNotice(null); },
    onSuccess: async (_d, { done }) => {
      if (done) setNotice(done);
      const fresh = await bloomSupport.getTicket(ticketId);
      qc.setQueryData<TicketDetail>(["bloom-support", "ticket", ticketId], fresh);
      qc.invalidateQueries({ queryKey: ["bloom-support"], predicate: (x) => x.queryKey[1] !== "ticket" });
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
      setNotice(sentVisibility === "internal" ? "Private note added." : "Reply sent to the client.");
      try {
        const fresh = await bloomSupport.getTicket(ticketId);
        qc.setQueryData<TicketDetail>(["bloom-support", "ticket", ticketId], fresh);
        void qc.invalidateQueries({ queryKey: ["bloom-support"], predicate: (x) => x.queryKey[1] !== "ticket" });
      } catch {
        void qc.invalidateQueries({ queryKey: ["bloom-support", "ticket", ticketId] });
      }
    },
    onError: (e: Error) => {
      setNotice(null);
      setReplyError(e.message);
    },
  });

  const t = q.data;
  if (q.isLoading) return <Stack spacing={2} sx={{ width: "100%", maxWidth: 760, minWidth: 0, boxSizing: "border-box", mx: "auto", p: 2 }}><Skeleton variant="text" level="h3" /><Skeleton variant="rectangular" height={320} sx={{ borderRadius: "lg" }} /></Stack>;
  if (q.error) return <Alert color="danger" sx={{ m: 2 }}>{(q.error as Error).message}</Alert>;
  if (!t) return null;

  // The thread can include messages from other requests in the same conversation; label them.
  const otherNumbers = new Map(t.conversation_tickets.map((c) => [c.id, c.number]));
  const clientName = t.account?.name ?? t.requester?.name ?? t.requester?.email ?? "Unknown client";
  const b = banner(t);
  const eng = t.engineering as { id?: string; title?: string; status?: string; pr_url?: string | null; pr_number?: number | null; eligibility?: { eligible?: boolean; reasons?: string[] } | null } | null | undefined;
  const lastClientId = [...t.messages].reverse().find((m) => m.author_kind === "client")?.id;
  const canWrite = can("tickets.write");
  const closed = !!t.merged_into;
  const retryLocked = pendingReply.current !== null && replyError !== null;
  const replyLocked = replyRun.isPending || retryLocked;

  const send = (visibility: "public" | "internal") => {
    const payload = pendingReply.current ?? {
      body: draft.trim(),
      visibility,
      idempotency_key: replyKey.current,
    };
    pendingReply.current = payload;
    setError(null);
    setReplyError(null);
    setNotice(null);
    replyRun.mutate(payload);
  };

  const editAsNewReply = () => {
    pendingReply.current = null;
    replyKey.current = crypto.randomUUID();
    setReplyError(null);
    setNotice(null);
    replyRun.reset();
    window.requestAnimationFrame(() => replyInput.current?.focus());
  };

  const attach = (visibility: "public" | "internal", files: FileList | null) => {
    const { accepted, rejected } = checkAttachments(Array.from(files ?? []));
    if (rejected.length) {
      setError(`${rejected.join(" ")} No file was attached; choose a valid file and try again.`);
      return;
    }
    if (!accepted.length) return;
    run.mutate({
      fn: () => bloomSupport.uploadAttachment(t.id, accepted[0], visibility),
      done: visibility === "internal" ? "Private file attached." : "File attached for the client.",
    });
  };

  const markSolved = async () => {
    const patch = await statusPatch(ask, t, "resolved");
    if (patch) run.mutate({ fn: () => bloomSupport.updateTicket(t.id, { version: t.version, ...patch }), done: "Marked solved. Bloom will let the client know." });
  };

  const bannerColors: Record<Tone, { bg: string; fg: string }> = {
    warning: { bg: "warning.50", fg: "warning.800" },
    primary: { bg: "primary.50", fg: "primary.800" },
    success: { bg: "success.50", fg: "success.700" },
    neutral: { bg: "neutral.100", fg: "neutral.700" },
  };

  return (
    <Stack sx={{ width: "100%", maxWidth: "100%", minWidth: 0, height: "100%", minHeight: 0, overflowWrap: "anywhere", bgcolor: "background.body" }}>
      {dialog}
      <Box sx={{ flex: 1, maxWidth: "100%", minWidth: 0, minHeight: 0, overflow: "auto" }}>
        <Stack spacing={3} sx={{ width: "100%", maxWidth: 760, minWidth: 0, boxSizing: "border-box", mx: "auto", px: { xs: 2, md: 3 }, py: 3 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <IconButton variant="outlined" color="neutral" aria-label="Back" onClick={onBack} sx={{ borderRadius: "50%", "--IconButton-size": "44px", flex: "0 0 auto" }}><ArrowLeft size={18} /></IconButton>
            <Box aria-hidden sx={{ flex: "0 0 auto", width: 44, height: 44, borderRadius: "50%", bgcolor: "primary.100", color: "primary.900", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "display", fontWeight: 600 }}>{initials(clientName)}</Box>
            <Stack sx={{ minWidth: 0, flex: 1 }}>
              <Typography level="title-lg" sx={{ fontFamily: "display" }}>{clientName}</Typography>
              <Typography level="body-sm" textColor="text.secondary" noWrap>
                {PRODUCT_LABEL[t.product] ?? t.product} · #{t.number} {t.subject}{t.requester?.name ? ` · ${t.requester.name}` : ""}
              </Typography>
            </Stack>
            <Button variant="plain" color="neutral" onClick={onShowDetails} sx={{ flex: "0 0 auto" }}>Details</Button>
          </Stack>

          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ px: 2, py: 1.5, borderRadius: "md", bgcolor: bannerColors[b.tone].bg, color: bannerColors[b.tone].fg }} role="status">
            <Box aria-hidden sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: "currentColor", flex: "0 0 auto" }} />
            <Typography level="title-sm" textColor="inherit">{b.text}</Typography>
          </Stack>

          {t.merged_into && <Alert color="neutral" variant="soft">This continues in <Link component="button" onClick={() => onOpenTicket(t.merged_into!)}>#{t.merged_into_number}</Link>.</Alert>}
          {t.status === "resolved" && t.resolution_summary && (
            <Sheet variant="soft" color="success" sx={{ p: 2, borderRadius: "lg" }}>
              <Typography level="title-sm" startDecorator={<Check size={16} />}>How it was solved</Typography>
              <Typography level="body-md" sx={{ mt: 0.5 }}>{t.resolution_summary}</Typography>
            </Sheet>
          )}

          <Stack spacing={2.5} component="ol" sx={{ listStyle: "none", m: 0, p: 0 }}>
            {t.messages.map((m) => <Box component="li" key={m.id}><Message m={m} clientName={clientName} onRequest={m.ticket_id && m.ticket_id !== t.id ? `On request #${otherNumbers.get(m.ticket_id) ?? "other"}` : undefined} /></Box>)}
          </Stack>

          {t.attachments.length > 0 && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {t.attachments.map((a) => (
                <Chip key={a.id} variant="outlined" size="lg" startDecorator={<Paperclip size={14} />} title={`${a.file_name}${a.visibility === "internal" ? " (private)" : ""}`}
                  sx={{ maxWidth: "100%", "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }}
                  onClick={() => run.mutate({ fn: async () => { const { url } = await bloomSupport.attachmentUrl(a.id); window.open(url, "_blank", "noopener"); } })}>
                  {a.file_name}{a.visibility === "internal" ? " (private)" : ""}
                </Chip>
              ))}
            </Stack>
          )}

          {eng?.status && (
            <Sheet variant="outlined" sx={{ p: 2, borderRadius: "lg", bgcolor: "background.surface" }}>
              <Stack spacing={1}>
                <Typography level="title-sm" startDecorator={<Sprout size={16} />}>The fix</Typography>
                <Typography level="body-md">{eng.title ? `${eng.title}. ` : ""}{ENGINEERING_TEXT[eng.status] ?? eng.status.replace(/_/g, " ")}.</Typography>
                {eng.eligibility?.reasons?.length ? <Typography level="body-sm" textColor="text.secondary">Needs a person because: {eng.eligibility.reasons.slice(0, 3).join("; ")}</Typography> : null}
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ pt: 0.5 }}>
                  {eng.status === "awaiting_approval" && eng.id && can("engineering.approve") && (
                    <Button size="lg" sx={{ borderRadius: "xl" }} loading={run.isPending}
                      onClick={() => run.mutate({ fn: () => bloomSupport.updateEngineering(eng.id!, { status: "approved", note: `Approved from ticket #${t.number}` }), done: "Fix approved. Bloom will release it and tell the client." })}>
                      Approve fix
                    </Button>
                  )}
                  {eng.pr_url && <Button size="lg" variant="plain" component="a" href={eng.pr_url} target="_blank" rel="noopener">See the change{eng.pr_number ? ` (#${eng.pr_number})` : ""}</Button>}
                </Stack>
              </Stack>
            </Sheet>
          )}

          {t.pending_review === "reply_after_resolution" && canWrite && (
            <Sheet variant="outlined" sx={{ p: 2, borderRadius: "lg", bgcolor: "background.surface" }}>
              <Typography level="title-sm">The client wrote again after this was solved. What is it?</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ pt: 1.5 }}>
                <Button size="lg" sx={{ borderRadius: "xl" }} onClick={() => run.mutate({ fn: () => bloomSupport.postReply(t.id, "reopen", lastClientId), done: "Reopened." })}>Still broken, reopen</Button>
                <Button size="lg" variant="outlined" color="neutral" sx={{ borderRadius: "xl" }} onClick={() => run.mutate({ fn: () => bloomSupport.postReply(t.id, "new_ticket", lastClientId), done: "Opened as a new request." })}>Something new</Button>
                <Button size="lg" variant="plain" color="neutral" onClick={() => run.mutate({ fn: () => bloomSupport.postReply(t.id, "dismiss", lastClientId), done: "Kept as solved." })}>Just a thank you</Button>
              </Stack>
            </Sheet>
          )}
        </Stack>
      </Box>

      {canWrite && !closed && (
        <Box sx={{ width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box", borderTop: "1px solid", borderColor: "divider", bgcolor: "background.surface", px: { xs: 2, md: 3 }, py: 2 }}>
          <Stack spacing={1.25} sx={{ width: "100%", maxWidth: 760, minWidth: 0, boxSizing: "border-box", mx: "auto" }}>
            {error ? <Alert role="alert" size="sm" variant="soft" color="danger">{error}</Alert> : null}
            {replyError ? (
              <Alert id="conversation-reply-error" role="alert" size="sm" variant="soft" color="danger">
                <Stack spacing={0.5}>
                  <Typography level="body-sm">{replyError}</Typography>
                  <Typography level="body-xs">Your message is unchanged. Retry it exactly, or choose edit and send as new before changing anything.</Typography>
                </Stack>
              </Alert>
            ) : null}
            {notice ? <Alert role="status" aria-live="polite" size="sm" variant="soft" color="success">{notice}</Alert> : null}
            <Textarea
              minRows={2} maxRows={8} value={draft} disabled={replyLocked} onChange={(e) => setDraft(e.target.value)}
              placeholder={`Write to ${t.requester?.name ?? clientName}, or add a private note`}
              slotProps={{ textarea: { ref: replyInput, disabled: replyLocked, maxLength: MAX_SUPPORT_BODY_LENGTH, "aria-label": "Message", "aria-describedby": replyError ? "conversation-reply-count conversation-reply-error" : "conversation-reply-count" } }}
              sx={{
                width: "100%",
                minWidth: 0,
                borderRadius: "lg",
                fontSize: "md",
                // Keep the theme's 80px root while letting Joy's hidden autosize clone measure a real row.
                "& .MuiTextarea-textarea": { minHeight: 0 },
              }}
            />
            <Typography id="conversation-reply-count" level="body-xs" color={draft.length > MAX_SUPPORT_BODY_LENGTH ? "danger" : undefined} textColor={draft.length > MAX_SUPPORT_BODY_LENGTH ? undefined : "text.tertiary"} sx={{ textAlign: "right" }}>
              {draft.length.toLocaleString()} / {MAX_SUPPORT_BODY_LENGTH.toLocaleString()} characters
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
              {pendingReply.current ? (
                <>
                  <Button
                    size="lg"
                    disabled={!retryLocked || replyRun.isPending}
                    loading={replyRun.isPending}
                    onClick={() => send(pendingReply.current?.visibility ?? "public")}
                    sx={{ borderRadius: "xl" }}
                  >
                    {retryLocked ? `Retry same ${pendingReply.current.visibility === "internal" ? "private note" : "reply"}` : "Sending…"}
                  </Button>
                  {retryLocked ? <Button size="lg" variant="outlined" color="neutral" onClick={editAsNewReply} sx={{ borderRadius: "xl" }}>Edit and send as new</Button> : null}
                </>
              ) : (
                <>
                  <Button size="lg" disabled={!draft.trim() || draft.length > MAX_SUPPORT_BODY_LENGTH || replyRun.isPending} loading={replyRun.isPending} onClick={() => send("public")} sx={{ borderRadius: "xl" }}>Send to client</Button>
                  <Button size="lg" variant="outlined" color="neutral" disabled={!draft.trim() || draft.length > MAX_SUPPORT_BODY_LENGTH || replyRun.isPending} onClick={() => send("internal")} startDecorator={<Lock size={14} />} sx={{ borderRadius: "xl" }}>Private note</Button>
                </>
              )}
              <Dropdown>
                <MenuButton
                  size="sm"
                  variant="plain"
                  disabled={replyLocked || run.isPending}
                  startDecorator={<Paperclip size={14} />}
                  sx={{ minHeight: 44, px: 1.25 }}
                >
                  Attach
                </MenuButton>
                <Menu placement="top-start" size="sm">
                  <MenuItem onClick={() => publicAttachmentInput.current?.click()}>For the client</MenuItem>
                  <MenuItem onClick={() => privateAttachmentInput.current?.click()}>Private for staff</MenuItem>
                </Menu>
              </Dropdown>
              <input ref={publicAttachmentInput} hidden type="file" aria-label="Attach a file for the client" disabled={replyLocked || run.isPending} accept={ATTACHMENT_ACCEPT} onChange={(e) => { attach("public", e.target.files); e.target.value = ""; }} />
              <input ref={privateAttachmentInput} hidden type="file" aria-label="Attach a private file" disabled={replyLocked || run.isPending} accept={ATTACHMENT_ACCEPT} onChange={(e) => { attach("internal", e.target.files); e.target.value = ""; }} />
              <Box sx={{ flex: 1 }} />
              {t.automation === "auto"
                ? <Button variant="plain" color="neutral" disabled={run.isPending || replyLocked} onClick={() => run.mutate({ fn: () => bloomSupport.setAutomation(t.id, "human", "Taken over from conversation"), done: "It's yours. Bloom won't message the client." })}>I'll take it from here</Button>
                : <Button variant="plain" color="primary" disabled={run.isPending || replyLocked} onClick={() => run.mutate({ fn: () => bloomSupport.setAutomation(t.id, "auto"), done: "Handed back to Bloom." })}>Hand back to Bloom</Button>}
              {t.status !== "resolved" ? <Button variant="plain" color="success" disabled={run.isPending || replyLocked} startDecorator={<Check size={16} />} onClick={markSolved}>Mark solved</Button> : null}
            </Stack>
            {t.automation === "auto" && draft.trim() ? <Typography level="body-xs" textColor="text.tertiary">Sending to the client takes this over from Bloom.</Typography> : null}
          </Stack>
        </Box>
      )}
      {!canWrite && error && <Alert color="danger" sx={{ m: 2 }}>{error}</Alert>}
    </Stack>
  );
}
