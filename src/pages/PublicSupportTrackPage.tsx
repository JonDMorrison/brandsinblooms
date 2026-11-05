import { useMemo, useRef, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { formatDistanceToNow } from "date-fns";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Button from "@mui/joy/Button";
import Link from "@mui/joy/Link";
import Skeleton from "@mui/joy/Skeleton";
import { Lock, Paperclip, Printer, X } from "lucide-react";
import { bloomSupport, BloomSupportError, PRODUCT_LABEL } from "@/lib/bloomSupport/api";
import { ATTACHMENT_ACCEPT, checkAttachments, HELP_CENTRE_PATH, SUPPORT_EMAIL } from "@/lib/bloomSupport/constants";
import {
  buildTimeline,
  displayHost,
  formatSupportHours,
  isTrackToken,
  presentStatus,
  TRACK_MAX_FILES,
  TRACK_REPLY_MAX,
  type TrackAttachment,
  type TrackCompany,
  type TrackResponse,
  type TrackView,
  validateTrackReply,
} from "@/lib/bloomSupport/trackView";
import {
  Botanical,
  Card,
  EventRow,
  MessageBody,
  MessageRow,
  type PendingMessage,
  PendingRow,
  PlainTextarea,
  Stepper,
  Time,
} from "@/components/bloomSupport/track/TrackParts";
import { dayDate, focusRing, fullDate, T } from "@/components/bloomSupport/track/trackTheme";

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------
const BLOOMSUITE_LOGO = "/pos/features-assets/bloomsuite-logo.png";

/** The client's own logo; hidden (name still shown) if it fails to load. */
function CompanyLogo({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <Box component="img" src={src} alt={`${name} logo`} referrerPolicy="no-referrer" onError={() => setFailed(true)}
      sx={{ height: { xs: 32, sm: 40 }, width: "auto", maxWidth: { xs: 88, sm: 120 }, objectFit: "contain", display: "block", flex: "0 0 auto" }} />
  );
}

function Shell({ children, company, title }: { children: ReactNode; company?: TrackCompany | null; title: string }) {
  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: T.page, color: T.ink, "@media print": { bgcolor: "#fff" } }}>
      <Helmet>
        <title>{title}</title>
        <meta name="robots" content="noindex, nofollow, noarchive" />
        <meta name="referrer" content="no-referrer" />
      </Helmet>
      <style>{"@keyframes bloomTrackShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}"}</style>
      <Box component="header" sx={{ borderBottom: `1px solid ${T.border}`, bgcolor: T.white }}>
        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ maxWidth: 760, mx: "auto", px: { xs: 2, sm: 3 }, py: 1.5 }}>
          <Box component="img" src={BLOOMSUITE_LOGO} alt="BloomSuite" width={36} height={36} sx={{ display: "block", width: 36, height: 36, flex: "0 0 auto" }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography level="title-md" sx={{ color: T.navy, fontWeight: 800, lineHeight: 1.1 }}>Bloom Support</Typography>
            <Typography level="body-xs" sx={{ color: T.muted, display: { xs: company ? "none" : "block", sm: "block" } }}>BloomSuite · Brands in Blooms</Typography>
          </Box>
          {company && (
            <Stack direction="row" alignItems="center" spacing={1.25} sx={{ ml: "auto !important", minWidth: 0, pl: 1.5, borderLeft: { sm: `1px solid ${T.border}` } }}>
              <Box sx={{ minWidth: 0, textAlign: "right" }}>
                <Typography level="body-xs" sx={{ color: T.muted, lineHeight: 1.2, display: { xs: "none", sm: "block" } }}>Request from</Typography>
                <Typography level="title-sm" noWrap sx={{ color: T.navy, fontWeight: 700, maxWidth: { xs: 130, sm: 240 } }}>{company.name}</Typography>
                {company.website && (
                  <Link href={company.website} target="_blank" rel="noopener noreferrer" level="body-xs"
                    sx={{ color: T.sage, fontWeight: 600, maxWidth: { xs: 130, sm: 240 }, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", ...focusRing }}>
                    {displayHost(company.website)}
                  </Link>
                )}
              </Box>
              {company.logo_url && <CompanyLogo src={company.logo_url} name={company.name} />}
            </Stack>
          )}
        </Stack>
      </Box>
      <Box component="main" id="main" sx={{ maxWidth: 760, mx: "auto", px: { xs: 2, sm: 3 }, py: { xs: 2.5, sm: 4 } }}>
        <Stack spacing={{ xs: 2, sm: 2.5 }}>{children}</Stack>
      </Box>
    </Box>
  );
}

function TrustFooter({ expiresAt }: { expiresAt?: string | null }) {
  return (
    <Box component="footer" sx={{ px: { xs: 0.5, sm: 1 }, pt: 1, pb: 4 }}>
      <Stack direction="row" spacing={1.25} alignItems="flex-start">
        <Box sx={{ color: T.sage, pt: "2px", flex: "0 0 auto" }}><Lock size={16} aria-hidden /></Box>
        <Typography level="body-sm" sx={{ color: T.body, lineHeight: 1.6 }}>
          This page is private to the people we emailed about this request. Please don't forward the link, and never send passwords or card numbers here.
          {expiresAt ? <> This link works until <Time iso={expiresAt}>{new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date(expiresAt))}</Time>.</> : null}
        </Typography>
      </Stack>
      <Typography level="body-sm" sx={{ color: T.body, mt: 1.5, pl: { xs: 0, sm: 3.5 } }}>
        Need us another way? Email <Link href={`mailto:${SUPPORT_EMAIL}`} sx={{ color: T.sage, fontWeight: 600, ...focusRing }}>{SUPPORT_EMAIL}</Link>
        {" "}or browse the <Link href={HELP_CENTRE_PATH} sx={{ color: T.sage, fontWeight: 600, ...focusRing }}>help centre</Link>.
      </Typography>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Hero: plain-language status, progress and what happens next
// ---------------------------------------------------------------------------
function Hero({ view, onReplyNow }: { view: TrackView; onReplyNow: () => void }) {
  const p = presentStatus(view);
  const hours = formatSupportHours(view.support_hours);
  const icon = p.tone === "success" ? "check" : p.tone === "action" ? "mail" : view.status === "received" ? "leaf" : "sun";
  const pill = {
    neutral: { label: "Received", bg: T.panel, fg: T.navy },
    progress: { label: view.kind === "idea" ? "Under review" : "In progress", bg: T.sageSoft, fg: "#2F5446" },
    action: { label: "Waiting for your reply", bg: T.amberSoft, fg: T.amber },
    success: { label: view.confirmed ? "Resolved · confirmed" : "Resolved", bg: T.sageSoft, fg: "#2F5446" },
  }[p.tone];
  const product = PRODUCT_LABEL[view.product] && view.product !== "unknown" && view.product !== "platform" ? PRODUCT_LABEL[view.product] : null;
  return (
    <Card aria-labelledby="track-headline" sx={{ overflow: "hidden" }}>
      <Box sx={{ bgcolor: T.panel, borderBottom: `1px solid ${T.border}`, px: { xs: 2.25, sm: 3.5 }, pt: { xs: 2.5, sm: 3.5 }, pb: { xs: 2.5, sm: 3 } }}>
        <Stack direction="row" spacing={2} alignItems="flex-start" justifyContent="space-between">
          <Box sx={{ minWidth: 0 }}>
            <Typography level="body-xs" sx={{ color: T.sage, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", mb: 1 }}>
              Request #{view.number}{product ? ` · ${product}` : ""}
            </Typography>
            <Typography id="track-headline" level="h1" sx={{ color: T.navy, fontSize: { xs: "28px", sm: "34px" }, lineHeight: 1.15, letterSpacing: "-.02em", fontWeight: 800 }}>
              {p.headline}
            </Typography>
            <Typography level="title-md" sx={{ color: T.ink, mt: 1, fontWeight: 600, lineHeight: 1.4 }}>{view.subject}</Typography>
          </Box>
          <Box sx={{ display: { xs: "none", sm: "block" } }}><Botanical name={icon} size={56} /></Box>
        </Stack>
        <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
          <Box component="span" sx={{ px: 1.25, py: 0.5, borderRadius: 99, bgcolor: pill.bg, color: pill.fg, fontSize: 13, fontWeight: 700 }}>{pill.label}</Box>
          <Typography level="body-sm" sx={{ color: T.muted }}>
            Updated <Time iso={view.last_activity_at}>{formatDistanceToNow(new Date(view.last_activity_at), { addSuffix: true })}</Time>
          </Typography>
        </Stack>
        {view.merged_into_number === null && (
          <Box sx={{ mt: 2.5 }}><Stepper steps={p.steps} current={view.step} tone={p.tone} /></Box>
        )}
      </Box>

      <Box sx={{ px: { xs: 2.25, sm: 3.5 }, py: { xs: 2.25, sm: 3 } }}>
        {view.status === "resolved" && view.resolution_summary && (
          <Box sx={{ mb: 2.5, p: 2, borderRadius: "12px", bgcolor: T.sageSoft, border: "1px solid #CFDDD4" }}>
            <Typography level="title-sm" sx={{ color: "#2F5446", fontWeight: 800, mb: 0.5 }}>What we did</Typography>
            <MessageBody body={view.resolution_summary} />
          </Box>
        )}
        <Stack direction="row" spacing={1.75} alignItems="flex-start">
          <Botanical name="calendar" size={36} />
          <Box sx={{ minWidth: 0 }}>
            <Typography component="h2" level="title-md" sx={{ color: T.navy, fontWeight: 800 }}>What happens next</Typography>
            <Typography level="body-md" sx={{ color: T.body, mt: 0.5, lineHeight: 1.6 }}>{p.next}</Typography>
            {view.reply_expected_by && (
              <Typography level="body-sm" sx={{ color: T.ink, mt: 1, fontWeight: 600 }}>
                We aim to reply by <Time iso={view.reply_expected_by}>{dayDate(view.reply_expected_by)}</Time> (your time).
              </Typography>
            )}
            {hours && view.status !== "resolved" && (
              <Typography level="body-sm" sx={{ color: T.muted, mt: 0.75 }}>Our team is in {hours}. Bloom watches for urgent problems around the clock.</Typography>
            )}
            {view.status === "waiting_on_you" && view.can_reply && (
              <Button onClick={onReplyNow} sx={{ mt: 2, bgcolor: T.navy, borderRadius: "10px", fontWeight: 700, "&:hover": { bgcolor: T.ink }, ...focusRing, "@media print": { display: "none" } }}>
                Reply now
              </Button>
            )}
          </Box>
        </Stack>
      </Box>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Composer
// ---------------------------------------------------------------------------
const readBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).replace(/^data:[^,]*;base64,/, ""));
  r.onerror = () => reject(new Error(`Could not read ${file.name}`));
  r.readAsDataURL(file);
});

function Composer({
  token, view, onSent, onPending,
}: {
  token: string;
  view: TrackView;
  onSent: (next: TrackView | null) => void;
  onPending: (p: PendingMessage | null) => void;
}) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const keyRef = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const send = useMutation({
    mutationFn: async () => {
      keyRef.current ??= crypto.randomUUID();
      const attachments = await Promise.all(files.map(async (f) => ({ file_name: f.name, content_type: f.type, data_base64: await readBase64(f) })));
      const checked = validateTrackReply({ body, idempotency_key: keyRef.current, attachments });
      if ("error" in checked) throw new Error(checked.error);
      onPending({ key: keyRef.current, body: checked.value.body, files: files.map((f) => f.name), state: "sending" });
      return bloomSupport.trackReply(token, checked.value);
    },
    onSuccess: (res) => {
      onSent(res.view);
      onPending(null);
      keyRef.current = null;
      setBody("");
      setFiles([]);
      setNotice({ tone: "ok", text: "Sent. Your message is on the request and the team has it. We'll email you when we reply." });
    },
    onError: (e) => {
      onPending(null);
      const msg = e instanceof Error ? e.message : "Your message wasn't sent.";
      setNotice({ tone: "error", text: `${msg} Your message is still here — try again, or reply to any email about this request.` });
    },
  });

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const { accepted, rejected } = checkAttachments([...files, ...Array.from(list)]);
    const kept = accepted.slice(0, TRACK_MAX_FILES);
    const over = accepted.slice(TRACK_MAX_FILES).map((f) => `${f.name}: up to ${TRACK_MAX_FILES} files per message`);
    setFiles(kept);
    setNotice(rejected.length || over.length ? { tone: "error", text: [...rejected, ...over].join(" · ") } : null);
  };

  const tooShort = body.trim().length < 2;
  return (
    <Card aria-labelledby="track-compose" sx={{ p: { xs: 2.25, sm: 3 }, "@media print": { display: "none" } }}>
      <Typography id="track-compose" component="h2" level="title-lg" sx={{ color: T.navy, fontWeight: 800 }}>
        {view.status === "waiting_on_you" ? "Reply to our question" : "Add a reply"}
      </Typography>
      <Typography level="body-sm" sx={{ color: T.body, mt: 0.5, mb: 1.5 }}>
        It goes straight onto this request{view.requester_name ? ` as ${view.requester_name}` : ""}. Prefer email? Just reply to any email about it.
      </Typography>
      <Box component="form" onSubmit={(e) => { e.preventDefault(); if (!send.isPending && !tooShort) send.mutate(); }}>
        <Box component="label" htmlFor="track-reply" sx={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>Your message</Box>
        <PlainTextarea
          id="track-reply"
          rows={5}
          value={body}
          maxLength={TRACK_REPLY_MAX}
          disabled={send.isPending}
          describedBy="track-reply-help"
          placeholder={view.status === "waiting_on_you" ? "Type your answer…" : "Add more detail, a question, or an update…"}
          onChange={setBody}
        />
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 0.75 }}>
          <Typography id="track-reply-help" level="body-xs" sx={{ color: T.muted }}>Never include passwords or card numbers.</Typography>
          <Typography level="body-xs" sx={{ color: body.length > TRACK_REPLY_MAX * 0.9 ? T.amber : T.muted }} aria-live="polite">
            {body.length > 0 ? `${body.length.toLocaleString()}/${TRACK_REPLY_MAX.toLocaleString()}` : ""}
          </Typography>
        </Stack>
        {files.length > 0 && (
          <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} sx={{ mt: 1.25 }} aria-label="Files to send">
            {files.map((f) => (
              <Box key={`${f.name}-${f.size}`} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, pl: 1.25, pr: 0.5, py: 0.25, borderRadius: "10px", bgcolor: T.panel, border: `1px solid ${T.border}`, fontSize: 13, color: T.navy }}>
                <Box component="span" sx={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</Box>
                <Button size="sm" variant="plain" color="neutral" aria-label={`Remove ${f.name}`} disabled={send.isPending}
                  onClick={() => setFiles((all) => all.filter((x) => x !== f))} sx={{ minHeight: 28, px: 0.5, ...focusRing }}>
                  <X size={14} aria-hidden />
                </Button>
              </Box>
            ))}
          </Stack>
        )}
        {notice && (
          <Box role={notice.tone === "error" ? "alert" : "status"} sx={{ mt: 1.5, p: 1.5, borderRadius: "10px", fontSize: 14, lineHeight: 1.5,
            bgcolor: notice.tone === "ok" ? T.sageSoft : "#FFF4ED", color: notice.tone === "ok" ? "#2F5446" : "#9A3412", border: `1px solid ${notice.tone === "ok" ? "#CFDDD4" : "#F5C6AA"}` }}>
            {notice.text}
          </Box>
        )}
        <Stack direction={{ xs: "column-reverse", sm: "row" }} spacing={1.25} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" sx={{ mt: 2 }}>
          <Box>
            <input ref={fileInput} type="file" multiple accept={ATTACHMENT_ACCEPT} hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            <Button variant="plain" color="neutral" startDecorator={<Paperclip size={16} aria-hidden />} disabled={send.isPending || files.length >= TRACK_MAX_FILES}
              onClick={() => fileInput.current?.click()} sx={{ color: T.navy, fontWeight: 600, ...focusRing }}>
              Attach a file
            </Button>
          </Box>
          <Button type="submit" loading={send.isPending} disabled={tooShort}
            sx={{ bgcolor: T.navy, borderRadius: "10px", px: 3, fontWeight: 700, minHeight: 44, "&:hover": { bgcolor: T.ink }, ...focusRing }}>
            Send reply
          </Button>
        </Stack>
      </Box>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Resolved: confirm, or say it is still not right
// ---------------------------------------------------------------------------
function ResolvedActions({ token, view, onDone }: { token: string; view: TrackView; onDone: (v: TrackView | null) => void }) {
  const [reopening, setReopening] = useState(false);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const act = useMutation({
    mutationFn: (action: "confirm_resolved" | "still_broken") => bloomSupport.trackAction(token, action, action === "still_broken" ? message : undefined),
    onSuccess: (res, action) => {
      onDone(res.view);
      setReopening(false);
      setMessage("");
      setNotice({ tone: "ok", text: action === "confirm_resolved" ? "Thanks for letting us know — glad it's sorted." : "We've reopened your request and the team has been told. We'll be in touch soon." });
    },
    onError: (e) => setNotice({ tone: "error", text: `${e instanceof Error ? e.message : "That didn't go through."} You can also reply to any email about this request.` }),
  });
  if (!view.can_confirm && !view.can_reopen && !notice) return null;
  return (
    <Card aria-labelledby="track-resolved" sx={{ p: { xs: 2.25, sm: 3 }, "@media print": { display: "none" } }}>
      <Typography id="track-resolved" component="h2" level="title-lg" sx={{ color: T.navy, fontWeight: 800 }}>
        {view.confirmed ? "Still all good?" : "Is everything working now?"}
      </Typography>
      <Typography level="body-sm" sx={{ color: T.body, mt: 0.5 }}>
        {view.confirmed ? "If something comes back, tell us here and we'll pick it up again." : "A quick answer helps us know we got it right."}
      </Typography>
      {!reopening && (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ mt: 2 }}>
          {view.can_confirm && (
            <Button loading={act.isPending && act.variables === "confirm_resolved"} disabled={act.isPending} onClick={() => act.mutate("confirm_resolved")}
              startDecorator={<Botanical name="check" size={20} />}
              sx={{ bgcolor: T.navy, borderRadius: "10px", fontWeight: 700, minHeight: 44, "&:hover": { bgcolor: T.ink }, ...focusRing }}>
              Yes, it's sorted
            </Button>
          )}
          {view.can_reopen && (
            <Button variant="outlined" color="neutral" disabled={act.isPending} onClick={() => setReopening(true)}
              sx={{ borderColor: T.border, color: T.navy, borderRadius: "10px", fontWeight: 700, minHeight: 44, ...focusRing }}>
              Still having trouble?
            </Button>
          )}
        </Stack>
      )}
      {reopening && (
        <Box component="form" sx={{ mt: 2 }} onSubmit={(e) => { e.preventDefault(); act.mutate("still_broken"); }}>
          <Box component="label" htmlFor="track-reopen" sx={{ display: "block", fontWeight: 700, color: T.navy, mb: 0.75, fontSize: 14 }}>What's still not right?</Box>
          <PlainTextarea id="track-reopen" rows={3} value={message} onChange={setMessage} disabled={act.isPending} maxLength={TRACK_REPLY_MAX} />
          <Stack direction="row" spacing={1.25} sx={{ mt: 1.5 }} justifyContent="flex-end">
            <Button variant="plain" color="neutral" onClick={() => setReopening(false)} disabled={act.isPending} sx={focusRing}>Cancel</Button>
            <Button type="submit" loading={act.isPending} sx={{ bgcolor: T.navy, borderRadius: "10px", fontWeight: 700, "&:hover": { bgcolor: T.ink }, ...focusRing }}>Reopen request</Button>
          </Stack>
        </Box>
      )}
      {notice && (
        <Box role={notice.tone === "error" ? "alert" : "status"} sx={{ mt: 1.5, p: 1.5, borderRadius: "10px", fontSize: 14,
          bgcolor: notice.tone === "ok" ? T.sageSoft : "#FFF4ED", color: notice.tone === "ok" ? "#2F5446" : "#9A3412" }}>
          {notice.text}
        </Box>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------
function LoadingState() {
  return (
    <Shell title="Your request · Bloom Support">
      <Card sx={{ p: { xs: 2.25, sm: 3.5 } }} aria-busy="true">
        <Box role="status" sx={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>Loading your request…</Box>
        <Skeleton variant="text" level="body-xs" width={140} />
        <Skeleton variant="text" level="h1" width="70%" sx={{ mt: 1 }} />
        <Skeleton variant="text" level="title-md" width="55%" />
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, mt: 3 }}>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rectangular" height={6} sx={{ borderRadius: 99 }} />)}
        </Box>
      </Card>
      <Card sx={{ p: { xs: 2.25, sm: 3 } }}>
        {[0, 1, 2].map((i) => (
          <Stack key={i} direction="row" spacing={1.75} sx={{ mb: i < 2 ? 2.5 : 0 }}>
            <Skeleton variant="circular" width={40} height={40} />
            <Box sx={{ flex: 1 }}><Skeleton variant="text" width="30%" /><Skeleton variant="rectangular" height={i === 0 ? 96 : 48} sx={{ borderRadius: "12px", mt: 1 }} /></Box>
          </Stack>
        ))}
      </Card>
    </Shell>
  );
}

function MessageState({ icon, title, children }: { icon: "alert" | "mail" | "leaf"; title: string; children: ReactNode }) {
  return (
    <Shell title={`${title} · Bloom Support`}>
      <Card sx={{ p: { xs: 3, sm: 4.5 }, textAlign: "center" }} aria-labelledby="track-state">
        <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}><Botanical name={icon} size={64} /></Box>
        <Typography id="track-state" level="h1" sx={{ color: T.navy, fontSize: { xs: "26px", sm: "30px" }, fontWeight: 800, letterSpacing: "-.01em" }}>{title}</Typography>
        <Box sx={{ maxWidth: 480, mx: "auto", mt: 1.25, color: T.body }}>{children}</Box>
      </Card>
      <TrustFooter />
    </Shell>
  );
}

function ExpiredState({ token }: { token: string }) {
  const renew = useMutation({ mutationFn: () => bloomSupport.trackRenew(token) });
  return (
    <MessageState icon="mail" title="This link has expired">
      <Typography level="body-md" sx={{ color: T.body, lineHeight: 1.6 }}>
        For your privacy, tracking links stop working after a while. Your request and its whole conversation are safe — nothing is lost.
      </Typography>
      {renew.isSuccess ? (
        <Box role="status" sx={{ mt: 2.5, p: 2, borderRadius: "12px", bgcolor: T.sageSoft, color: "#2F5446", fontWeight: 600, lineHeight: 1.5 }}>
          If this link belongs to a request, we've emailed a fresh one to the address on that request. It can take a minute or two to arrive.
        </Box>
      ) : (
        <Button onClick={() => renew.mutate()} loading={renew.isPending}
          sx={{ mt: 2.5, bgcolor: T.navy, borderRadius: "10px", fontWeight: 700, minHeight: 44, px: 3, "&:hover": { bgcolor: T.ink }, ...focusRing }}>
          Email me a new link
        </Button>
      )}
      {renew.isError && (
        <Typography role="alert" level="body-sm" sx={{ color: "#9A3412", mt: 1.5 }}>
          {renew.error instanceof BloomSupportError && renew.error.status === 429 ? "We've already sent a new link recently — please check your inbox and spam folder." : "That didn't go through. Please try again in a minute."}
        </Typography>
      )}
      <Typography level="body-sm" sx={{ color: T.muted, mt: 2.5 }}>
        You can also reply to any email about your request — it reaches us just the same.
      </Typography>
    </MessageState>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function PublicSupportTrackPage() {
  const { token = "" } = useParams();
  const valid = isTrackToken(token);
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["bloom-support", "track", token] as const, [token]);
  const q = useQuery({
    queryKey,
    queryFn: () => bloomSupport.track(token),
    enabled: valid,
    retry: (count, e) => !(e instanceof BloomSupportError && e.status < 500) && count < 2,
    // Updates appear without a reload while the page is open (paused in background tabs).
    refetchInterval: 60_000,
  });
  const [pending, setPending] = useState<PendingMessage | null>(null);
  const [busyFileId, setBusyFileId] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const applyView = (next: TrackView | null) => {
    if (next) queryClient.setQueryData<TrackResponse>(queryKey, next);
    else void queryClient.invalidateQueries({ queryKey });
  };

  const openFile = async (f: TrackAttachment) => {
    setBusyFileId(f.id);
    setFileError(null);
    try {
      const { url } = await bloomSupport.trackAttachment(token, f.id);
      // A short-lived signed download link; the browser downloads it and this page stays put.
      window.location.assign(url);
    } catch {
      setFileError(`${f.file_name} couldn't be opened right now. Please try again in a minute.`);
    } finally {
      setBusyFileId(null);
    }
  };

  if (!valid || (q.error instanceof BloomSupportError && q.error.status === 404)) {
    return (
      <MessageState icon="leaf" title="We couldn't find that request">
        <Typography level="body-md" sx={{ color: T.body, lineHeight: 1.6 }}>
          The link may be incomplete — some email apps split long links across lines. Try opening it again straight from the email.
        </Typography>
        <Typography level="body-sm" sx={{ color: T.muted, mt: 2 }}>
          Still stuck? Reply to any email about your request, or write to us at{" "}
          <Link href={`mailto:${SUPPORT_EMAIL}`} sx={{ color: T.sage, fontWeight: 600, ...focusRing }}>{SUPPORT_EMAIL}</Link>.
        </Typography>
      </MessageState>
    );
  }
  if (q.isLoading) return <LoadingState />;
  if (q.error || !q.data) {
    return (
      <MessageState icon="alert" title="We couldn't load your request">
        <Typography level="body-md" sx={{ color: T.body, lineHeight: 1.6 }}>Something went wrong on our side, not yours. Your request is safe.</Typography>
        <Button onClick={() => void q.refetch()} loading={q.isFetching} sx={{ mt: 2.5, bgcolor: T.navy, borderRadius: "10px", fontWeight: 700, minHeight: 44, px: 3, "&:hover": { bgcolor: T.ink }, ...focusRing }}>
          Try again
        </Button>
      </MessageState>
    );
  }
  if (q.data.state === "expired") return <ExpiredState token={token} />;

  const view = q.data;
  const timeline = buildTimeline(view.messages);
  const firstCustomer = view.messages.find((m) => m.author === "customer")?.id ?? null;
  const replyNow = () => {
    const box = document.getElementById("track-reply");
    box?.scrollIntoView({ behavior: "smooth", block: "center" });
    box?.focus({ preventScroll: true });
  };

  return (
    <Shell title={`Request #${view.number} · Bloom Support`} company={view.company}>
      <Hero view={view} onReplyNow={replyNow} />

      <Card aria-labelledby="track-conversation" sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography id="track-conversation" component="h2" level="title-lg" sx={{ color: T.navy, fontWeight: 800 }}>Conversation</Typography>
          <Button size="sm" variant="plain" color="neutral" startDecorator={<Printer size={15} aria-hidden />} onClick={() => window.print()}
            sx={{ color: T.muted, fontWeight: 600, ...focusRing, "@media print": { display: "none" } }}>
            Print
          </Button>
        </Stack>
        {fileError && <Typography role="alert" level="body-sm" sx={{ color: "#9A3412", mb: 1.5 }}>{fileError}</Typography>}
        {timeline.length === 0 && !pending ? (
          <Typography level="body-md" sx={{ color: T.body }}>No messages yet. We'll post every update here and email you too.</Typography>
        ) : (
          <Stack component="ol" spacing={2.25} sx={{ m: 0, p: 0 }}>
            {timeline.map((item) => item.type === "event"
              ? <EventRow key={item.id} item={item} />
              : (
                <MessageRow
                  key={item.message.id}
                  m={item.message}
                  isRequest={item.message.id === firstCustomer}
                  extraFiles={item.message.id === firstCustomer ? view.attachments : []}
                  onOpenFile={openFile}
                  busyFileId={busyFileId}
                />
              ))}
            {pending && <PendingRow p={pending} name={view.requester_name ?? "You"} />}
          </Stack>
        )}
      </Card>

      {view.can_reply && (
        <Composer token={token} view={view} onSent={applyView} onPending={setPending} />
      )}
      {view.status === "resolved" && <ResolvedActions token={token} view={view} onDone={applyView} />}
      {!view.can_reply && view.status !== "resolved" && (
        <Card sx={{ p: { xs: 2.25, sm: 3 }, "@media print": { display: "none" } }}>
          <Stack direction="row" spacing={1.75} alignItems="flex-start">
            <Botanical name="mail" size={36} />
            <Box>
              <Typography component="h2" level="title-md" sx={{ color: T.navy, fontWeight: 800 }}>Want to add something?</Typography>
              <Typography level="body-sm" sx={{ color: T.body, mt: 0.5, lineHeight: 1.6 }}>
                {view.merged_into_number !== null
                  ? `Reply to any email about request #${view.merged_into_number} and it will reach the right place.`
                  : "Reply to any email about this request and it will appear here."}
              </Typography>
            </Box>
          </Stack>
        </Card>
      )}

      <Typography level="body-xs" sx={{ color: T.muted, textAlign: "center" }}>
        Opened <Time iso={view.created_at}>{fullDate(view.created_at)}</Time>
      </Typography>
      <TrustFooter expiresAt={view.link_expires_at} />
    </Shell>
  );
}
