import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Button from "@mui/joy/Button";
import IconButton from "@mui/joy/IconButton";
import Textarea from "@mui/joy/Textarea";
import Sheet from "@mui/joy/Sheet";
import Chip from "@mui/joy/Chip";
import Avatar from "@mui/joy/Avatar";
import Divider from "@mui/joy/Divider";
import Tooltip from "@mui/joy/Tooltip";
import ToggleButtonGroup from "@mui/joy/ToggleButtonGroup";
import Alert from "@mui/joy/Alert";
import Skeleton from "@mui/joy/Skeleton";
import Link from "@mui/joy/Link";
import Dropdown from "@mui/joy/Dropdown";
import MenuButton from "@mui/joy/MenuButton";
import Menu from "@mui/joy/Menu";
import MenuItem from "@mui/joy/MenuItem";
import { ArrowLeft, Bot, Check, Hand, Lock, Paperclip, SendHorizontal, Sprout } from "lucide-react";
import { format, formatDistanceToNow, isToday } from "date-fns";
import { bloomSupport, PRODUCT_LABEL, WAITING_LABEL, type TicketDetail, type TicketMessage, type Whoami } from "@/lib/bloomSupport/api";
import { statusPatch } from "./statusPatch";
import { engineeringLabel, fixStage } from "./labels";
import { StatusChip } from "./chips";
import { asSentence, humanizeNextAction, staffNotePresentation } from "../../../supabase/functions/_shared/bloom-support/notes";
import { useAskDialog } from "./useAskDialog";
import { clientName as deskClientName } from "./desk/statusWords";
import { BloomRecommends } from "./BloomRecommends";
import type { NextAction } from "../../../supabase/functions/_shared/bloom-support/next-step";
import { ATTACHMENT_ACCEPT, checkAttachments, MAX_SUPPORT_BODY_LENGTH } from "@/lib/bloomSupport/constants";

/**
 * Bloom Support conversation: one ticket read as a chat, with the single thing it needs
 * from a person at the top and the reply box at the bottom. Every action calls the same
 * endpoints as the detailed desk view, which stays one click away.
 */

type Tone = "warning" | "primary" | "success" | "neutral";
type Banner = { tone: Tone; text: string };
type ReplyPayload = Parameters<typeof bloomSupport.addMessage>[1];
type Visibility = "public" | "internal";

const STAGE_TEXT: Record<string, string> = {
  intake: "Bloom has the request and is reading it",
  triage: "Bloom is working out what this needs",
  answering: "Bloom is answering",
  operating: "Bloom is making the change",
  investigating: "Bloom is investigating",
  fixing: "Bloom is preparing a fix",
  releasing: "Releasing the fix",
  verifying: "Checking the fix on the live site",
  needs_info: "Waiting on the client for more detail",
  awaiting_client: "Waiting on the client",
};

function banner(t: TicketDetail): Banner {
  const eng = t.engineering as { status?: string } | null | undefined;
  // A reply after resolution needs a decision, so it outranks "Solved".
  if (t.pending_review === "reply_after_resolution") return { tone: "warning", text: "Waiting on you: the client replied after this was solved" };
  if (t.pending_review === "client_reply_human") return { tone: "warning", text: "Waiting on you: the client replied to your conversation" };
  if (t.status === "resolved") return { tone: "success", text: t.resolved_at ? `Solved ${formatDistanceToNow(new Date(t.resolved_at), { addSuffix: true })}` : "Solved" };
  if (eng?.status === "escalated") return { tone: "warning", text: "The automatic repair is paused for engineering review" };
  if (eng?.status === "awaiting_approval") return { tone: "warning", text: "Waiting on you: approve the fix" };
  if (t.status === "needs_owner") return { tone: "warning", text: `Waiting on you: ${t.next_action ? humanizeNextAction(t.next_action) : "an admin decision"}` };
  if (t.automation === "human") return { tone: "neutral", text: `${t.taken_over_by?.name ?? "A person"} is handling this. Bloom has stepped back` };
  if (t.automation === "paused") return { tone: "neutral", text: "Bloom is paused here and will only suggest, not act" };
  if (t.status === "waiting" && t.waiting_reason) return { tone: "primary", text: WAITING_LABEL[t.waiting_reason] };
  return { tone: "primary", text: (t.stage && STAGE_TEXT[t.stage]) ?? "Bloom is working on this" };
}

const when = (d: string) => {
  const date = new Date(d);
  return isToday(date) ? format(date, "h:mm a") : format(date, "MMM d, h:mm a");
};
const initials = (name: string) =>
  name.replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
const deliveryText = (delivery: string) => `Email ${delivery.replace(/_/g, " ")}`;

const segmentSx = {
  borderRadius: "sm",
  color: "text.tertiary",
  "&[aria-pressed='true']": { bgcolor: "background.surface", color: "text.primary", boxShadow: "sm", fontWeight: "lg" },
  "&:hover:not([aria-pressed='true'])": { bgcolor: "transparent", color: "text.primary" },
} as const;
/** On phones the ticket actions keep their icon and accessible name, and drop the visible label. */
const wideOnly = { display: { xs: "none", sm: "inline" } } as const;
const actionSx = { borderRadius: "md", "& .MuiButton-startDecorator": { mr: { xs: 0, sm: 0.75 } } } as const;

/** Readable text width for every bubble and note, so the thread keeps one calm column. */


/**
 * The ticket summary, message history and reply composer must share the
 * same left edge. The previous 820px centred columns left a large blank
 * gutter in the Support desk and disconnected the reply from the thread.
 * Allow a wider desk while keeping individual messages readable.
 */
const conversationColumnSx = {
  width: "100%",
  maxWidth: 1200,
  minWidth: 0,
  boxSizing: "border-box",
  ml: 0,
  mr: "auto",
} as const;

/**
 * Show support correspondence as a readable activity feed.
 * Each entry has its own visible boundary and a consistent sender/time header.
 * Unlike chat bubbles, staff and client updates share the same reading edge.
 */
function Message({ m, clientName, onRequest }: { m: TicketMessage; clientName: string; onRequest?: string }) {
  const fromClient = m.author_kind === "client";
  const internal = m.visibility === "internal";
  const bloom = m.author_kind === "bloom";
  const who = bloom ? "Bloom" : m.author_kind === "system" ? "System" : m.author?.name ?? (fromClient ? clientName : "Staff");
  const delivery = !internal && !fromClient && m.delivery && m.delivery !== "none" ? deliveryText(m.delivery) : null;
  const body = m.body;
  const note = internal ? staffNotePresentation(body) : null;

  return (
    <Sheet
      data-testid="bloom-support-message"
      data-message-visibility={internal ? "internal" : "public"}
      variant="outlined"
      color="neutral"
      sx={{
        width: "100%",
        minWidth: 0,
        ml: 0,
        mr: "auto",
        px: { xs: 2, sm: 2.5 },
        py: 2,
        border: "1px solid",
        borderColor: "neutral.200",
        borderRadius: "lg",
        bgcolor: internal ? "background.level1" : fromClient ? "background.surface" : "neutral.50",
        boxShadow: "0 1px 3px rgba(15,23,42,0.04)",
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ minWidth: 0, mb: 1.5, pb: 1.25, borderBottom: "1px solid", borderColor: "neutral.200" }}>
        <Avatar
          size="sm"
          variant="soft"
          color={fromClient || internal ? "neutral" : "primary"}
          aria-hidden
          sx={{ flex: "0 0 auto", "--Avatar-size": "32px", fontSize: "xs" }}
        >
          {bloom ? <Sprout size={16} /> : initials(who)}
        </Avatar>
        <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography level="title-sm" textColor="text.primary">{who}</Typography>
            {internal ? (
              <Chip size="sm" variant="outlined" color="neutral" startDecorator={<Lock size={12} aria-hidden />}>Internal · staff only</Chip>
            ) : (
              <Typography level="body-xs" textColor="text.tertiary">
                {fromClient ? "Customer" : bloom ? "Bloom reply" : "Team reply"}
              </Typography>
            )}
          </Stack>
          {onRequest && <Typography level="body-xs" textColor="text.tertiary">{onRequest}</Typography>}
          {delivery && <Typography level="body-xs" textColor="text.tertiary">{delivery}</Typography>}
        </Stack>
        <Typography level="body-xs" textColor="text.tertiary" sx={{ whiteSpace: "nowrap", pt: 0.25, flexShrink: 0 }}>
          {when(m.created_at)}
        </Typography>
      </Stack>
      <Box sx={{ pl: { xs: 0, sm: "44px" }, minWidth: 0 }}>
        {internal ? (
          <>
            <Typography level="body-md" textColor="text.primary" sx={{ maxWidth: "82ch", whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.6 }}>
              {note?.preview}
            </Typography>
            {note?.collapsed ? (
              <Box component="details" sx={{ mt: 1.25, "& > summary": { cursor: "pointer", color: "primary.700", fontWeight: 600, py: 0.5 } }}>
                <Box component="summary">Read full technical note</Box>
                <Typography level="body-sm" textColor="text.secondary" sx={{ mt: 1, whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.6 }}>{note.original}</Typography>
              </Box>
            ) : null}
          </>
        ) : fromClient && Array.from(body).length > 700 ? (
          <>
            <Typography level="body-md" textColor="text.primary" sx={{ maxWidth: "82ch", whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.6 }}>
              {Array.from(body).slice(0, 220).join("").trimEnd()}…
            </Typography>
            <Box component="details" sx={{ mt: 1.25, "& > summary": { cursor: "pointer", fontWeight: 600, fontSize: "sm", color: "primary.700", py: 0.5 } }}>
              <Box component="summary">Read full original message</Box>
              <Typography level="body-sm" textColor="text.primary" sx={{ mt: 1, whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.6 }}>{body}</Typography>
            </Box>
          </>
        ) : (
          <Typography level="body-md" textColor="text.primary" sx={{ maxWidth: "82ch", whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.6 }}>{body}</Typography>
        )}
      </Box>
    </Sheet>
  );
}

export function TicketConversation({ ticketId, me, onBack, onShowDetails, onOpenTicket, backOn = "always", actionHint = null }: {
  ticketId: string;
  me: Whoami;
  onBack: () => void;
  onShowDetails: () => void;
  onOpenTicket: (id: string) => void;
  /** "compact" shows Back only on narrow screens, where the request list is hidden behind the conversation. */
  backOn?: "always" | "compact";
  /** Action pre-selected by a staff email link; the live ticket decides whether it still applies. */
  actionHint?: NextAction | null;
}) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["bloom-support", "ticket", ticketId], queryFn: () => bloomSupport.getTicket(ticketId), refetchInterval: 20_000 });
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<Visibility>("public");
  const [error, setError] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [macKeys, setMacKeys] = useState(false);
  const replyKey = useRef(crypto.randomUUID());
  const pendingReply = useRef<ReplyPayload | null>(null);
  const replyInput = useRef<HTMLTextAreaElement | null>(null);
  const publicAttachmentInput = useRef<HTMLInputElement | null>(null);
  const privateAttachmentInput = useRef<HTMLInputElement | null>(null);
  const { ask, dialog } = useAskDialog();
  const can = (p: string) => me.permissions.includes(p);

  useEffect(() => {
    setMacKeys(/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent));
  }, []);

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
      setNotice(sentVisibility === "internal" ? "Internal note added." : "Reply sent to the client.");
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
  if (q.isLoading) return <Stack spacing={2} sx={{ ...conversationColumnSx, p: 3 }}><Skeleton variant="text" level="h3" /><Skeleton variant="rectangular" height={320} sx={{ borderRadius: "lg" }} /></Stack>;
  if (q.error) return <Alert color="danger" sx={{ m: 2 }}>{(q.error as Error).message}</Alert>;
  if (!t) return null;

  // The thread can include messages from other requests in the same conversation; label them.
  const otherNumbers = new Map(t.conversation_tickets.map((c) => [c.id, c.number]));
  const clientName = deskClientName(t);
  const b = banner(t);
  const eng = t.engineering as { id?: string; title?: string; status?: string; pr_url?: string | null; pr_number?: number | null; eligibility?: { eligible?: boolean; reasons?: string[] } | null } | null | undefined;
  const fix = eng?.status ? fixStage(eng.status) : null;
  const lastClientId = [...t.messages].reverse().find((m) => m.author_kind === "client")?.id;
  const canWrite = can("tickets.write");
  const closed = !!t.merged_into;
  const retryLocked = pendingReply.current !== null && replyError !== null;
  const replyLocked = replyRun.isPending || retryLocked;
  const product = t.product === "unknown" ? "Product not confirmed" : PRODUCT_LABEL[t.product] ?? t.product;
  // The desk already stores a human-readable problem statement. Reuse it instead
  // of making staff read a technical subject or the full original email.
  const plainEscalation = (t.escalations ?? []).find((e) =>
    e.status === "open" && !!e.plain && typeof e.plain === "object" &&
    typeof (e.plain as Record<string, unknown>).problem === "string",
  );
  const plainProblem = (plainEscalation?.plain as { problem?: string } | undefined)?.problem?.trim() ?? "";
  const headline = t.subject.replace(/^TEST:\s*/i, "").replace(/\s*\|\s*20\d{2}-\d{2}-\d{2}$/, "");
  const repairPaused = eng?.status === "escalated";
  const routingBlocked = repairPaused && t.product === "unknown";
  // Routine receipts and triage notes are preserved but don't obscure the actual request.
  const routineUpdates = t.messages.filter((m) => m.author_kind === "bloom" && (
    m.purpose === "acknowledgement" ||
    (m.visibility === "internal" && m.body.startsWith("Bloom read this as")) ||
    (m.purpose === "progress" && (
      m.body.startsWith("I've logged this as a possible product problem") ||
      m.body.startsWith("The automatic repair has stopped.")
    ))
  ));
  // Custom progress reports, verified findings and actual client replies stay
  // visible in the conversation. Only stock notifications are tucked away.
  const routineIds = new Set(routineUpdates.map((m) => m.id));
  const mainMessages = t.messages.filter((m) => !routineIds.has(m.id));
  const overLimit = draft.length > MAX_SUPPORT_BODY_LENGTH;
  const canSend = !pendingReply.current && !!draft.trim() && !overLimit && !replyRun.isPending;
  const internalMode = mode === "internal";

  const send = (visibility: Visibility) => {
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

  const attach = (visibility: Visibility, files: FileList | null) => {
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

  const fixDetail = eng?.status === "open"
    ? "Logged for engineering. Work hasn't started yet."
    : eng?.status ? asSentence(engineeringLabel(eng.status)) : "";

  return (
    <Stack sx={{ width: "100%", maxWidth: "100%", minWidth: 0, height: "100%", minHeight: 0, overflowWrap: "anywhere", bgcolor: "background.surface" }}>
      {dialog}

      {/* Header: stays put while the thread scrolls. */}
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        sx={{ flex: "0 0 auto", px: { xs: 2, md: 3 }, py: 2, borderBottom: "1px solid", borderColor: "divider", bgcolor: "background.surface", minWidth: 0 }}
      >
        <IconButton
          variant="plain"
          color="neutral"
          size="sm"
          aria-label="Back"
          onClick={onBack}
          sx={{ flex: "0 0 auto", borderRadius: "md", "--IconButton-size": "36px", ml: -0.5, display: backOn === "compact" ? { xs: "inline-flex", md: "none" } : "inline-flex" }}
        >
          <ArrowLeft size={18} />
        </IconButton>
        <Avatar color="primary" variant="soft" aria-hidden sx={{ flex: "0 0 auto", "--Avatar-size": "40px", fontWeight: "lg", fontSize: "sm" }}>{initials(clientName)}</Avatar>
        <Stack sx={{ minWidth: 0, flex: 1 }} spacing={0.25}>
          <Typography level="title-md" noWrap>{clientName}</Typography>
          <Tooltip title={`#${t.number} ${t.subject}${t.requester?.name ? ` · from ${t.requester.name}` : ""}`} placement="bottom-start" variant="soft" enterDelay={400}>
            <Typography level="body-sm" textColor="text.tertiary" noWrap tabIndex={0} sx={{ outline: "none", "&:focus-visible": { textDecoration: "underline" } }}>
              {product} · #{t.number} · {t.subject}
            </Typography>
          </Tooltip>
        </Stack>
        <Box sx={{ flex: "0 0 auto", display: { xs: "none", sm: "block" } }}><StatusChip status={t.status} /></Box>
        <Button variant="outlined" color="neutral" size="sm" onClick={onShowDetails} sx={{ flex: "0 0 auto", borderRadius: "md" }}>Details</Button>
      </Stack>

      <Box sx={{ flex: 1, maxWidth: "100%", minWidth: 0, minHeight: 0, overflow: "auto" }}>
        <Stack data-testid="bloom-support-conversation-content" spacing={3} sx={{ ...conversationColumnSx, px: { xs: 2, md: 4 }, py: 3 }}>
          {/* One readable summary. Detailed evidence and routine updates stay available below. */}
          <Sheet variant="outlined" sx={{ borderRadius: "lg", bgcolor: "background.surface", overflow: "hidden", boxShadow: "xs" }}>
            <Stack spacing={1.5} sx={{ px: { xs: 2, md: 2.5 }, py: 2 }}>
              <Stack spacing={0.5}>
                <Typography level="body-xs" textColor="text.tertiary" sx={{ fontWeight: "lg" }}>THE PROBLEM</Typography>
                <Typography level="title-lg" sx={{ overflowWrap: "anywhere" }}>{headline}</Typography>
                {plainProblem && plainProblem.toLowerCase() !== headline.toLowerCase() ? (
                  <Typography level="body-md" textColor="text.secondary" sx={{ pt: 0.5, overflowWrap: "anywhere" }}>{plainProblem}</Typography>
                ) : null}
                {/^(TEST|TESTING):\s*/i.test(t.subject) ? <Chip variant="soft" color="neutral" size="sm" sx={{ alignSelf: "flex-start" }}>Marked as a test</Chip> : null}
              </Stack>
              <Divider />
              <Stack spacing={0.5}>
                <Typography level="title-sm">Where things stand</Typography>
                <Typography level="body-md" role="status" textColor="text.secondary">
                  {routingBlocked
                    ? "Bloom stopped before starting the repair because the request was not linked to the right product."
                    : repairPaused
                      ? "Bloom couldn't continue the repair automatically. An engineering review is needed."
                      : b.text}
                </Typography>
                {!repairPaused && eng?.status && fix ? (
                  <Stack spacing={0.5} alignItems="flex-start">
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography level="body-sm" textColor="text.tertiary">The fix</Typography>
                      <Chip size="sm" variant="soft" color={fix.tone}>{fix.label}</Chip>
                    </Stack>
                    <Typography level="body-sm" textColor="text.tertiary">{fixDetail}</Typography>
                  </Stack>
                ) : null}
              </Stack>
              {repairPaused ? (
                <>
                  <Divider />
                  <Stack spacing={0.75}>
                    <Typography level="title-sm">What happens next</Typography>
                    <Typography level="body-sm" textColor="text.secondary">
                      {routingBlocked
                        ? "An admin needs to confirm which product this belongs to, then restart the engineering review. Nothing will be released without the usual checks and approval."
                        : "An admin needs to review why the repair stopped and decide whether engineering can safely continue. Repair approval and client replies are separate."}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ pt: 0.5 }}>
                      <Button variant="outlined" color="neutral" size="sm" onClick={onShowDetails}>Review repair details</Button>
                    </Stack>
                  </Stack>
                </>
              ) : null}
              {!repairPaused && eng?.status === "awaiting_approval" && eng.id && can("engineering.approve") ? (
                <Button size="sm" loading={run.isPending}
                  onClick={() => run.mutate({ fn: () => bloomSupport.updateEngineering(eng.id!, { status: "approved", note: `Approved from ticket #${t.number}` }), done: "Fix approved. Bloom will release it and tell the client." })}>
                  Approve fix
                </Button>
              ) : null}
              {eng?.pr_url ? (
                <Button variant="plain" color="neutral" size="sm" component="a" href={eng.pr_url} target="_blank" rel="noopener">
                  See the change{eng.pr_number ? ` (#${eng.pr_number})` : ""}
                </Button>
              ) : null}
            </Stack>
          </Sheet>

          {canWrite && !repairPaused ? (
            <BloomRecommends
              t={t}
              me={me}
              hint={actionHint}
              busy={run.isPending}
              run={(fn, done) => run.mutate({ fn, done })}
              onReply={() => { setMode("public"); window.requestAnimationFrame(() => replyInput.current?.focus()); }}
            />
          ) : null}

          {t.merged_into && <Alert color="neutral" variant="soft">This continues in <Link component="button" onClick={() => onOpenTicket(t.merged_into!)}>#{t.merged_into_number}</Link>.</Alert>}
          {t.status === "resolved" && t.resolution_summary && (
            <Sheet variant="soft" color="success" sx={{ px: 2, py: 1.5, borderRadius: "lg" }}>
              <Typography level="title-sm" startDecorator={<Check size={16} />}>How it was solved</Typography>
              <Typography level="body-sm" sx={{ mt: 0.5 }}>{t.resolution_summary}</Typography>
            </Sheet>
          )}

          <Stack spacing={1.5} component="section" aria-label="Conversation history">
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ pb: 1.25, borderBottom: "1px solid", borderColor: "neutral.200" }}>
              <Typography level="title-md">Conversation</Typography>
              <Typography level="body-xs" textColor="text.tertiary">{t.messages.length} updates</Typography>
            </Stack>
            <Stack spacing={2.5} component="ol" aria-label="Conversation" sx={{ listStyle: "none", m: 0, p: 0 }}>
            {mainMessages.map((m) => <Box component="li" key={m.id}><Message m={m} clientName={clientName} onRequest={m.ticket_id && m.ticket_id !== t.id ? `On request #${otherNumbers.get(m.ticket_id) ?? "other"}` : undefined} /></Box>)}
            {routineUpdates.length > 0 && (
              <Box component="li">
                <Sheet variant="outlined" color="neutral" sx={{ p: 1.5, borderRadius: "lg", borderColor: "neutral.200", bgcolor: "background.level1" }}>
                  <Box component="details" sx={{ "& > summary": { cursor: "pointer", fontWeight: 600, fontSize: "sm", py: 0.5 } }}>
                    <Box component="summary">Bloom activity ({routineUpdates.length} {routineUpdates.length === 1 ? "update" : "updates"})</Box>
                    <Stack spacing={2} sx={{ mt: 1.5 }}>
                      {routineUpdates.map((m) => (
                        <Message key={m.id} m={m} clientName={clientName} onRequest={m.ticket_id && m.ticket_id !== t.id ? `On request #${otherNumbers.get(m.ticket_id) ?? "other"}` : undefined} />
                      ))}
                    </Stack>
                  </Box>
                </Sheet>
              </Box>
            )}
            </Stack>
          </Stack>

          {t.attachments.length > 0 && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {t.attachments.map((a) => (
                <Chip key={a.id} variant="outlined" color="neutral" startDecorator={<Paperclip size={14} />} title={`${a.file_name}${a.visibility === "internal" ? " (private)" : ""}`}
                  sx={{ maxWidth: "100%", "& .MuiChip-label": { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }}
                  onClick={() => run.mutate({ fn: async () => { const { url } = await bloomSupport.attachmentUrl(a.id); window.open(url, "_blank", "noopener"); } })}>
                  {a.file_name}{a.visibility === "internal" ? " (private)" : ""}
                </Chip>
              ))}
            </Stack>
          )}

          {t.pending_review === "reply_after_resolution" && canWrite && (
            <Sheet variant="outlined" sx={{ px: 2, py: 1.5, borderRadius: "lg", bgcolor: "background.surface" }}>
              <Typography level="title-sm">The client wrote again after this was solved. What is it?</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ pt: 1.5 }}>
                <Button size="sm" onClick={() => run.mutate({ fn: () => bloomSupport.postReply(t.id, "reopen", lastClientId), done: "Reopened." })}>Still broken, reopen</Button>
                <Button size="sm" variant="outlined" color="neutral" onClick={() => run.mutate({ fn: () => bloomSupport.postReply(t.id, "new_ticket", lastClientId), done: "Opened as a new request." })}>Something new</Button>
                <Button size="sm" variant="plain" color="neutral" onClick={() => run.mutate({ fn: () => bloomSupport.postReply(t.id, "dismiss", lastClientId), done: "Kept as solved." })}>Just a thank you</Button>
              </Stack>
            </Sheet>
          )}
        </Stack>
      </Box>

      {canWrite && !closed && (
        <Box sx={{ flex: "0 0 auto", width: "100%", maxWidth: "100%", minWidth: 0, boxSizing: "border-box", borderTop: "2px solid", borderColor: "neutral.200", bgcolor: "background.level1", boxShadow: "0 -4px 14px rgba(15,23,42,0.05)", px: { xs: 2, md: 4 }, pt: 1.5, pb: 2 }}>
          <Stack data-testid="bloom-support-conversation-composer" spacing={1} sx={conversationColumnSx}>
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

            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <ToggleButtonGroup
                size="sm"
                variant="plain"
                value={mode}
                onChange={(_, v) => { if (v === "public" || v === "internal") setMode(v); }}
                aria-label="Message type"
                sx={{ "--ButtonGroup-separatorSize": "0px", bgcolor: "neutral.softBg", p: 0.375, borderRadius: "md", gap: 0.25 }}
              >
                <Button value="public" disabled={replyLocked} sx={segmentSx}>Reply</Button>
                <Button value="internal" disabled={replyLocked} startDecorator={<Lock size={13} aria-hidden />} sx={segmentSx}>Internal note</Button>
              </ToggleButtonGroup>
              <Box sx={{ flex: 1 }} />
              {t.automation === "auto"
                ? <Button size="sm" variant="plain" color="neutral" aria-label="Take over" startDecorator={<Hand size={14} aria-hidden />} disabled={run.isPending || replyLocked} onClick={() => run.mutate({ fn: () => bloomSupport.setAutomation(t.id, "human", "Taken over from conversation"), done: "It's yours. Bloom won't message the client." })} sx={actionSx}><Box component="span" sx={wideOnly}>Take over</Box></Button>
                : <Button size="sm" variant="plain" color="neutral" aria-label="Hand back to Bloom" startDecorator={<Bot size={14} aria-hidden />} disabled={run.isPending || replyLocked} onClick={() => run.mutate({ fn: () => bloomSupport.setAutomation(t.id, "auto"), done: "Handed back to Bloom." })} sx={actionSx}><Box component="span" sx={wideOnly}>Hand back to Bloom</Box></Button>}
              {t.status !== "resolved" ? <Button size="sm" variant="plain" color="neutral" aria-label="Mark solved" disabled={run.isPending || replyLocked} startDecorator={<Check size={14} aria-hidden />} onClick={markSolved} sx={actionSx}><Box component="span" sx={wideOnly}>Mark solved</Box></Button> : null}
            </Stack>

            <Sheet
              variant="outlined"
              sx={{
                borderRadius: "lg",
                overflow: "hidden",
                bgcolor: internalMode ? "background.level1" : "background.surface",
                borderColor: "neutral.outlinedBorder",
                borderStyle: "solid",
                transition: "border-color 120ms ease, box-shadow 120ms ease",
                "&:focus-within": { borderColor: "primary.400", boxShadow: "sm" },
              }}
            >
              <Textarea
                variant="plain"
                minRows={3}
                maxRows={10}
                value={draft}
                disabled={replyLocked}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={internalMode ? "What changed? What happens next? Add technical evidence below if needed. Only staff will see this." : `Reply to ${t.requester?.name ?? clientName}…`}
                slotProps={{
                  textarea: {
                    ref: replyInput,
                    disabled: replyLocked,
                    maxLength: MAX_SUPPORT_BODY_LENGTH,
                    "aria-label": "Message",
                    "aria-describedby": replyError ? "conversation-reply-count conversation-reply-error" : "conversation-reply-count",
                    onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        if (canSend) send(mode);
                      }
                    },
                  },
                }}
                sx={{
                  width: "100%",
                  minWidth: 0,
                  bgcolor: "transparent",
                  border: 0,
                  boxShadow: "none",
                  fontSize: "md",
                  px: 1.5,
                  pt: 1.25,
                  pb: 0.5,
                  "--Textarea-focusedHighlight": "transparent",
                  "&:hover:not([data-disabled='true'])": { bgcolor: "transparent" },
                  "&:focus-within": { borderColor: "transparent" },
                  "&[data-disabled='true']": { bgcolor: "transparent" },
                  // The theme gives textareas an 80px floor; the composer sizes by rows instead.
                  minHeight: 0,
                  "--Textarea-paddingInline": "12px",
                  "--Textarea-paddingBlock": "10px",
                  "& .MuiTextarea-textarea": { minHeight: 0, lineHeight: 1.6, resize: "none" },
                }}
              />
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ px: 1, pb: 1, pt: 0.5 }}>
                <Dropdown>
                  <MenuButton
                    size="sm"
                    variant="plain"
                    color="neutral"
                    disabled={replyLocked || run.isPending}
                    aria-label="Attach"
                    startDecorator={<Paperclip size={14} />}
                    sx={actionSx}
                  >
                    <Box component="span" sx={wideOnly}>Attach</Box>
                  </MenuButton>
                  <Menu placement="top-start" size="sm">
                    <MenuItem onClick={() => publicAttachmentInput.current?.click()}>For the client</MenuItem>
                    <MenuItem onClick={() => privateAttachmentInput.current?.click()}>Private for staff</MenuItem>
                  </Menu>
                </Dropdown>
                <input ref={publicAttachmentInput} hidden type="file" aria-label="Attach a file for the client" disabled={replyLocked || run.isPending} accept={ATTACHMENT_ACCEPT} onChange={(e) => { attach("public", e.target.files); e.target.value = ""; }} />
                <input ref={privateAttachmentInput} hidden type="file" aria-label="Attach a private file" disabled={replyLocked || run.isPending} accept={ATTACHMENT_ACCEPT} onChange={(e) => { attach("internal", e.target.files); e.target.value = ""; }} />
                <Typography id="conversation-reply-count" level="body-xs" color={overLimit ? "danger" : undefined} textColor={overLimit ? undefined : "text.tertiary"}>
                  {draft.length.toLocaleString()} / {MAX_SUPPORT_BODY_LENGTH.toLocaleString()} characters
                </Typography>
                <Box sx={{ flex: 1 }} />
                {pendingReply.current ? (
                  <>
                    {retryLocked ? <Button size="sm" variant="plain" color="neutral" onClick={editAsNewReply}>Edit and send as new</Button> : null}
                    <Button
                      size="sm"
                      disabled={!retryLocked || replyRun.isPending}
                      loading={replyRun.isPending}
                      onClick={() => send(pendingReply.current?.visibility ?? "public")}
                      sx={{ borderRadius: "md", px: 2 }}
                    >
                      {retryLocked ? `Retry same ${pendingReply.current.visibility === "internal" ? "note" : "reply"}` : "Sending…"}
                    </Button>
                  </>
                ) : (
                  <>
                    <Typography level="body-xs" textColor="text.tertiary" aria-hidden sx={{ display: { xs: "none", sm: "block" } }}>
                      {macKeys ? "⌘" : "Ctrl"} ↵ to send
                    </Typography>
                    <Button
                      size="sm"
                      color={internalMode ? "neutral" : "primary"}
                      disabled={!canSend}
                      loading={replyRun.isPending}
                      onClick={() => send(mode)}
                      endDecorator={internalMode ? <Lock size={14} aria-hidden /> : <SendHorizontal size={14} aria-hidden />}
                      aria-keyshortcuts={macKeys ? "Meta+Enter" : "Control+Enter"}
                      sx={{ borderRadius: "md", px: 2, ml: "auto !important" }}
                    >
                      {internalMode ? "Add note" : "Send to client"}
                    </Button>
                  </>
                )}
              </Stack>
            </Sheet>
            {t.automation === "auto" && draft.trim() && !internalMode ? <Typography level="body-xs" textColor="text.tertiary">Sending to the client takes this over from Bloom.</Typography> : null}
          </Stack>
        </Box>
      )}
      {!canWrite && error && <Alert color="danger" sx={{ m: 2 }}>{error}</Alert>}
    </Stack>
  );
}
