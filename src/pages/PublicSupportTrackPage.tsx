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
  type StatusPresentation,
  TRACK_MAX_FILES,
  TRACK_REPLY_MAX,
  type TrackAttachment,
  type TrackCompany,
  type TrackKind,
  type TrackResponse,
  type TrackView,
  validateTrackReply,
} from "@/lib/bloomSupport/trackView";
import {
  Botanical,
  Card,
  EventRow,
  Heading,
  MessageBody,
  MessageRow,
  type PendingMessage,
  PendingRow,
  PlainTextarea,
  Stepper,
  Time,
} from "@/components/bloomSupport/track/TrackParts";
import { dayDate, FONT, focusRing, longDay, monthDay, outlineButton, primaryButton, srOnly, T } from "@/components/bloomSupport/track/trackTheme";

// ---------------------------------------------------------------------------
// Shell: navy band with the BloomSuite mark and the client, content floating over it
// ---------------------------------------------------------------------------
const BLOOMSUITE_LOGO = "/pos/features-assets/bloomsuite-logo.png";
const BLOOMSUITE_SITE = "https://bloomsuite.app";

/** The client's own logo on a white disc; falls back to their initial if it fails to load. */
function CompanyMark({ company }: { company: TrackCompany }) {
  const [failed, setFailed] = useState(false);
  if (company.logo_url && !failed) {
    return (
      <Box aria-hidden sx={{ width: 32, height: 32, borderRadius: 999, bgcolor: T.white, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flex: "none" }}>
        <Box component="img" src={company.logo_url} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)}
          sx={{ width: 26, height: 26, objectFit: "contain", display: "block" }} />
      </Box>
    );
  }
  return (
    <Box aria-hidden sx={{ width: 32, height: 32, borderRadius: 999, bgcolor: T.primary, color: T.white, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 14, flex: "none" }}>
      {company.name.trim()[0]?.toUpperCase() ?? "?"}
    </Box>
  );
}

function ClientChip({ company }: { company: TrackCompany }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.5}
      sx={{ minWidth: 0, maxWidth: "100%", bgcolor: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 999, py: 0.75, pl: 0.75, pr: 2,
        "@media print": { bgcolor: "transparent", borderColor: T.border } }}>
      <CompanyMark company={company} />
      <Box sx={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "1px" }}>
        <Box component="span" sx={srOnly}>Request from </Box>
        <Typography component="span" noWrap sx={{ fontSize: "14px", fontWeight: 600, color: "inherit" }}>{company.name}</Typography>
        {company.website && (
          <Link href={company.website} target="_blank" rel="noopener noreferrer"
            sx={{ fontSize: "12px", color: "#9FD6DA", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", "&:hover": { color: T.white }, ...focusRing, "@media print": { color: T.primary } }}>
            {displayHost(company.website)}
          </Link>
        )}
      </Box>
    </Stack>
  );
}

function Shell({ children, company, title }: { children: ReactNode; company?: TrackCompany | null; title: string }) {
  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: T.page, color: T.ink, fontFamily: FONT.body, "@media print": { bgcolor: T.white } }}>
      <Helmet>
        <title>{title}</title>
        <meta name="robots" content="noindex, nofollow, noarchive" />
        <meta name="referrer" content="no-referrer" />
      </Helmet>
      <Box component="header" sx={{ bgcolor: T.navy, color: T.white, "@media print": { bgcolor: T.white, color: T.navy, borderBottom: `1px solid ${T.border}` } }}>
        <Box sx={{ maxWidth: 1180, mx: "auto", px: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 2.5 }, pb: { xs: 11, sm: 12 }, display: "flex", flexWrap: "wrap", gap: 2, alignItems: "center", justifyContent: "space-between",
          "@media print": { pb: 2 } }}>
          <Stack direction="row" alignItems="center" spacing={1.75} sx={{ minWidth: 0 }}>
            <Box component="img" src={BLOOMSUITE_LOGO} alt="BloomSuite" width={40} height={40}
              sx={{ display: "block", width: 40, height: 40, borderRadius: "10px", bgcolor: T.white, p: "4px", boxSizing: "border-box", flex: "none" }} />
            <Box sx={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
              <Typography component="span" sx={{ fontFamily: FONT.heading, fontWeight: 700, fontSize: "20px", letterSpacing: "0.2px", color: "inherit", lineHeight: 1.2 }}>Bloom Support</Typography>
              <Typography component="span" sx={{ fontSize: "13px", color: "#B9CCDA", "@media print": { color: T.muted } }}>BloomSuite · Brands in Blooms</Typography>
            </Box>
          </Stack>
          {company && <ClientChip company={company} />}
        </Box>
      </Box>
      <Box component="main" id="main" sx={{ maxWidth: 1180, mx: "auto", mt: { xs: -9, sm: -9 }, px: { xs: 2, sm: 3 }, pb: { xs: 5, sm: 8 }, boxSizing: "border-box", "@media print": { mt: 2 } }}>
        {children}
      </Box>
    </Box>
  );
}

function TrustFooter({ expiresAt }: { expiresAt?: string | null }) {
  return (
    <Box component="footer" sx={{ mt: { xs: 4, sm: 5 }, display: "flex", flexDirection: "column", gap: 1.5, fontSize: "13px", color: T.muted }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: "8px 20px", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ flex: "1 1 420px", minWidth: 0 }}>
          <Box sx={{ color: T.primary, pt: "1px", flex: "none" }}><Lock size={14} aria-hidden /></Box>
          <Typography component="p" sx={{ m: 0, fontSize: "13px", lineHeight: 1.55, color: T.muted }}>
            This page is private to the people we emailed about this request. Please don&apos;t forward the link, and never send passwords or card numbers here.
            {expiresAt ? <> This link works until <Time iso={expiresAt}>{longDay(expiresAt)}</Time>.</> : null}
          </Typography>
        </Stack>
        <Link href={BLOOMSUITE_SITE} target="_blank" rel="noopener noreferrer" sx={{ fontSize: "13px", color: T.primary, fontWeight: 600, ...focusRing }}>bloomsuite.app</Link>
      </Box>
      <Typography component="p" sx={{ m: 0, fontSize: "13px", color: T.muted }}>
        Need us another way? Email <Link href={`mailto:${SUPPORT_EMAIL}`} sx={{ color: T.primary, fontWeight: 600, ...focusRing }}>{SUPPORT_EMAIL}</Link>
        {" "}or browse the <Link href={HELP_CENTRE_PATH} sx={{ color: T.primary, fontWeight: 600, ...focusRing }}>help centre</Link>.
      </Typography>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Status card: request, plain-language headline, pill and numbered progress
// ---------------------------------------------------------------------------
const PILL: Record<StatusPresentation["tone"], { bg: string; fg: string; dot: string }> = {
  neutral: { bg: T.accentSoft, fg: T.accent, dot: T.accent },
  progress: { bg: T.tint, fg: T.primary, dot: T.secondary },
  action: { bg: T.amberSoft, fg: T.amber, dot: "#C27C0E" },
  success: { bg: T.tint, fg: T.primary, dot: T.primary },
};

function pillLabel(view: TrackView, tone: StatusPresentation["tone"]): string {
  if (view.merged_into_number !== null) return `Joined with #${view.merged_into_number}`;
  switch (tone) {
    case "neutral": return "Received";
    case "progress": return view.kind === "idea" ? "Under review" : "In progress";
    case "action": return "Waiting for your reply";
    case "success": return view.confirmed ? "Resolved · confirmed" : view.kind === "idea" ? "Decided" : "Resolved";
  }
}

const productLabel = (product: string): string | null =>
  product !== "unknown" && product !== "platform" && PRODUCT_LABEL[product] ? PRODUCT_LABEL[product] : null;

function StatusCard({ view, p }: { view: TrackView; p: StatusPresentation }) {
  const pill = PILL[p.tone];
  const product = productLabel(view.product);
  const resolved = view.status === "resolved";
  // Dates are shown only where they are known: received, the step in progress now, and resolution.
  const dates = p.steps.map((_, i): ReactNode | null => {
    const n = i + 1;
    if (n === 1) return <Time iso={view.created_at}>{monthDay(view.created_at)}</Time>;
    if (resolved && n === 4 && view.resolved_at) return <Time iso={view.resolved_at}>{monthDay(view.resolved_at)}</Time>;
    if (!resolved && n === view.step) return "Now";
    return null;
  });
  return (
    <Card aria-labelledby="track-headline" sx={{ boxShadow: "0 12px 32px rgba(24,50,70,0.10)", px: { xs: 2.5, sm: 4.5 }, py: { xs: 3, sm: 4 }, display: "flex", flexDirection: "column", gap: 3, position: "relative" }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-start", justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, flex: "1 1 520px", minWidth: 0 }}>
          <Typography component="p" sx={{ m: 0, fontSize: "12px", fontWeight: 600, letterSpacing: "1.4px", textTransform: "uppercase", color: T.accent }}>
            Request #{view.number}{product ? ` · ${product}` : ""}
          </Typography>
          <Heading id="track-headline" component="h1" size={{ xs: "30px", sm: "40px" }} lineHeight={1.15}>{p.headline}</Heading>
          <Typography component="p" sx={{ m: 0, fontSize: { xs: "16px", sm: "17px" }, lineHeight: 1.5, color: "#3E5266", overflowWrap: "anywhere" }}>{view.subject}</Typography>
        </Box>
        <Box sx={{ display: "flex", flexDirection: { xs: "row", sm: "column" }, flexWrap: "wrap", alignItems: { xs: "center", sm: "flex-end" }, gap: 1 }}>
          <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 1, bgcolor: pill.bg, color: pill.fg, fontWeight: 600, fontSize: "14px", px: 1.75, py: 1, borderRadius: 999 }}>
            <Box component="span" aria-hidden sx={{ width: 8, height: 8, borderRadius: 999, bgcolor: pill.dot }} />
            {pillLabel(view, p.tone)}
          </Box>
          <Typography component="span" sx={{ fontSize: "13px", color: T.muted }}>
            Updated <Time iso={view.last_activity_at}>{formatDistanceToNow(new Date(view.last_activity_at), { addSuffix: true })}</Time>
          </Typography>
        </Box>
      </Box>
      {view.merged_into_number === null && <Stepper steps={p.steps} current={view.step} dates={dates} />}
      {resolved && view.resolution_summary && (
        <Box sx={{ p: 2.25, borderRadius: "14px", bgcolor: T.tint }}>
          <Typography component="h2" sx={{ m: 0, mb: 0.75, fontFamily: FONT.heading, fontWeight: 700, fontSize: "16px", color: T.primary }}>What we did</Typography>
          <MessageBody body={view.resolution_summary} color={T.ink} />
        </Box>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Side column: what happens next, request details
// ---------------------------------------------------------------------------
function NextPanel({ view, p, onReplyNow }: { view: TrackView; p: StatusPresentation; onReplyNow: () => void }) {
  const hours = formatSupportHours(view.support_hours);
  return (
    <Box component="section" aria-labelledby="track-next"
      sx={{ bgcolor: T.primary, color: T.white, borderRadius: "20px", px: { xs: 2.5, sm: 3.25 }, py: 3, display: "flex", flexDirection: "column", gap: 1.5,
        "@media print": { bgcolor: T.white, color: T.navy, border: `1px solid ${T.border}` } }}>
      <Heading id="track-next" size={19} color="inherit">What happens next</Heading>
      <Typography component="p" sx={{ m: 0, fontSize: "15px", lineHeight: 1.6, color: "#D8ECEF", "@media print": { color: T.body } }}>{p.next}</Typography>
      {view.reply_expected_by && (
        <Box sx={{ bgcolor: "rgba(255,255,255,0.10)", borderRadius: "12px", px: 2, py: 1.75, display: "flex", flexDirection: "column", gap: 0.5, "@media print": { bgcolor: T.panel } }}>
          <Typography component="span" sx={{ fontSize: "12px", letterSpacing: "1px", fontWeight: 600, color: "#9FD6DA", "@media print": { color: T.muted } }}>WE AIM TO REPLY BY</Typography>
          <Typography component="span" sx={{ fontSize: "17px", fontWeight: 600, color: "inherit" }}>
            <Time iso={view.reply_expected_by}>{dayDate(view.reply_expected_by)}</Time>
          </Typography>
          <Typography component="span" sx={{ fontSize: "13px", color: "#CFE3E8", "@media print": { color: T.muted } }}>Your local time</Typography>
        </Box>
      )}
      {hours && view.status !== "resolved" && (
        <Typography component="p" sx={{ m: 0, fontSize: "13px", lineHeight: 1.55, color: "#CFE3E8", "@media print": { color: T.muted } }}>
          Our team is in {hours}. Bloom watches for urgent problems around the clock.
        </Typography>
      )}
      {view.status === "waiting_on_you" && view.can_reply && (
        <Button onClick={onReplyNow}
          sx={{ alignSelf: "flex-start", bgcolor: T.white, color: T.primary, borderRadius: "10px", fontWeight: 600, fontSize: "15px", minHeight: 44, px: 2.75,
            "&:hover": { bgcolor: T.tint }, "&:focus-visible": { outline: `3px solid ${T.white}`, outlineOffset: "2px" }, "@media print": { display: "none" } }}>
          Reply now
        </Button>
      )}
    </Box>
  );
}

const KIND_LABEL: Record<TrackKind, string> = { fix: "Problem", help: "Help", idea: "Idea" };

function DetailsCard({ view }: { view: TrackView }) {
  const product = productLabel(view.product);
  const rows: Array<[string, ReactNode]> = [
    ["Request", `#${view.number}`],
    ...(product ? [["Product", product] as [string, ReactNode]] : []),
    ["Type", KIND_LABEL[view.kind]],
    ["Opened", <Time key="opened" iso={view.created_at}>{longDay(view.created_at)}</Time>],
    ...(view.status === "resolved" && view.resolved_at
      ? [["Resolved", <Time key="resolved" iso={view.resolved_at}>{longDay(view.resolved_at)}</Time>] as [string, ReactNode]]
      : []),
  ];
  return (
    <Card aria-labelledby="track-details" sx={{ px: { xs: 2.5, sm: 3.25 }, py: 3, display: "flex", flexDirection: "column", gap: 1.75 }}>
      <Heading id="track-details" size={19}>Request details</Heading>
      <Box component="dl" sx={{ m: 0, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px 16px", fontSize: "14px" }}>
        {rows.map(([label, value]) => (
          <Box key={label}>
            <Box component="dt" sx={{ color: T.muted }}>{label}</Box>
            <Box component="dd" sx={{ m: 0, mt: "2px", fontWeight: 600, color: T.ink, overflowWrap: "anywhere" }}>{value}</Box>
          </Box>
        ))}
      </Box>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Reply form (inside the conversation card)
// ---------------------------------------------------------------------------
const readBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).replace(/^data:[^,]*;base64,/, ""));
  r.onerror = () => reject(new Error(`Could not read ${file.name}`));
  r.readAsDataURL(file);
});

function Notice({ tone, children }: { tone: "ok" | "error"; children: ReactNode }) {
  return (
    <Box role={tone === "error" ? "alert" : "status"} sx={{ p: 1.5, borderRadius: "10px", fontSize: "14px", lineHeight: 1.5,
      bgcolor: tone === "ok" ? T.tint : T.dangerSoft, color: tone === "ok" ? T.primary : T.danger, border: `1px solid ${tone === "ok" ? T.halo : "#F5C6AA"}` }}>
      {children}
    </Box>
  );
}

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
      setNotice({ tone: "ok", text: "Sent. It's now part of this conversation, and the team has it. We'll email you when we reply." });
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
    <Box component="form" aria-labelledby="track-compose"
      onSubmit={(e: React.FormEvent) => { e.preventDefault(); if (!send.isPending && !tooShort) send.mutate(); }}
      sx={{ display: "flex", flexDirection: "column", gap: 1.5, borderTop: `1px solid ${T.divider}`, pt: 2.5, "@media print": { display: "none" } }}>
      <Box component="label" id="track-compose" htmlFor="track-reply" sx={{ fontFamily: FONT.heading, fontWeight: 700, fontSize: "17px", color: T.navy }}>
        {view.status === "waiting_on_you" ? "Reply to our question" : "Add a reply"}
      </Box>
      <PlainTextarea
        id="track-reply"
        rows={3}
        value={body}
        maxLength={TRACK_REPLY_MAX}
        disabled={send.isPending}
        describedBy="track-reply-help"
        placeholder={view.status === "waiting_on_you" ? "Type your answer…" : "Add details, answer a question, or attach a screenshot…"}
        onChange={setBody}
      />
      <Stack direction="row" alignItems="baseline" justifyContent="space-between" spacing={1}>
        <Typography id="track-reply-help" component="span" sx={{ fontSize: "13px", color: T.muted }}>
          Goes straight onto this request{view.requester_name ? ` as ${view.requester_name}` : ""}. Never include passwords or card numbers.
        </Typography>
        <Typography component="span" sx={{ fontSize: "12px", color: body.length > TRACK_REPLY_MAX * 0.9 ? T.amber : T.muted, flex: "none" }} aria-live="polite">
          {body.length > 0 ? `${body.length.toLocaleString()}/${TRACK_REPLY_MAX.toLocaleString()}` : ""}
        </Typography>
      </Stack>
      {files.length > 0 && (
        <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} aria-label="Files to send">
          {files.map((f) => (
            <Box key={`${f.name}-${f.size}`} sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, pl: 1.5, borderRadius: "10px", bgcolor: T.panel, border: `1px solid ${T.border}`, fontSize: "13px", color: T.navy }}>
              <Box component="span" sx={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</Box>
              <Button variant="plain" color="neutral" aria-label={`Remove ${f.name}`} disabled={send.isPending}
                onClick={() => setFiles((all) => all.filter((x) => x !== f))} sx={{ minHeight: 44, minWidth: 44, px: 0, color: T.muted, ...focusRing }}>
                <X size={16} aria-hidden />
              </Button>
            </Box>
          ))}
        </Stack>
      )}
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center", justifyContent: "space-between" }}>
        <input ref={fileInput} type="file" multiple accept={ATTACHMENT_ACCEPT} hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        <Button variant="outlined" startDecorator={<Paperclip size={16} aria-hidden />} disabled={send.isPending || files.length >= TRACK_MAX_FILES}
          onClick={() => fileInput.current?.click()} sx={outlineButton}>
          Attach a file
        </Button>
        <Button type="submit" loading={send.isPending} disabled={tooShort} sx={primaryButton}>
          Send reply
        </Button>
      </Box>
      <Typography component="p" sx={{ m: 0, fontSize: "13px", color: T.muted }}>Prefer email? Just reply to any message about this request.</Typography>
    </Box>
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
    <Card aria-labelledby="track-resolved" sx={{ px: { xs: 2.5, sm: 4 }, py: 3.5, display: "flex", flexDirection: "column", gap: 1.5, "@media print": { display: "none" } }}>
      <Heading id="track-resolved">{view.confirmed ? "Still all good?" : "Is everything working now?"}</Heading>
      <Typography component="p" sx={{ m: 0, fontSize: "15px", color: T.body }}>
        {view.confirmed ? "If something comes back, tell us here and we'll pick it up again." : "A quick answer helps us know we got it right."}
      </Typography>
      {!reopening && (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ mt: 0.5 }}>
          {view.can_confirm && (
            <Button loading={act.isPending && act.variables === "confirm_resolved"} disabled={act.isPending} onClick={() => act.mutate("confirm_resolved")}
              startDecorator={<Botanical name="check" size={20} />} sx={primaryButton}>
              Yes, it&apos;s sorted
            </Button>
          )}
          {view.can_reopen && (
            <Button variant="outlined" disabled={act.isPending} onClick={() => setReopening(true)} sx={{ ...outlineButton, fontWeight: 600, fontSize: "15px" }}>
              Still having trouble?
            </Button>
          )}
        </Stack>
      )}
      {reopening && (
        <Box component="form" sx={{ mt: 0.5 }} onSubmit={(e: React.FormEvent) => { e.preventDefault(); act.mutate("still_broken"); }}>
          <Box component="label" htmlFor="track-reopen" sx={{ display: "block", fontWeight: 600, color: T.navy, mb: 0.75, fontSize: "15px" }}>What&apos;s still not right?</Box>
          <PlainTextarea id="track-reopen" rows={3} value={message} onChange={setMessage} disabled={act.isPending} maxLength={TRACK_REPLY_MAX} />
          <Stack direction="row" spacing={1.25} sx={{ mt: 1.5 }} justifyContent="flex-end">
            <Button variant="plain" onClick={() => setReopening(false)} disabled={act.isPending} sx={{ minHeight: 44, color: T.primary, ...focusRing }}>Cancel</Button>
            <Button type="submit" loading={act.isPending} sx={primaryButton}>Reopen request</Button>
          </Stack>
        </Box>
      )}
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------
function LoadingState() {
  return (
    <Shell title="Your request · Bloom Support">
      <Card aria-busy="true" sx={{ boxShadow: "0 12px 32px rgba(24,50,70,0.10)", px: { xs: 2.5, sm: 4.5 }, py: { xs: 3, sm: 4 } }}>
        <Box role="status" sx={srOnly}>Loading your request…</Box>
        <Skeleton variant="text" level="body-xs" width={160} />
        <Skeleton variant="text" level="h1" width="60%" sx={{ mt: 1 }} />
        <Skeleton variant="text" level="title-md" width="45%" />
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 1, mt: 3 }}>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="circular" width={28} height={28} />)}
        </Box>
      </Card>
      <Card sx={{ mt: 3, px: { xs: 2.5, sm: 4 }, py: 3.5 }}>
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
      <Card aria-labelledby="track-state" sx={{ boxShadow: "0 12px 32px rgba(24,50,70,0.10)", px: { xs: 3, sm: 6 }, py: { xs: 4, sm: 6 }, textAlign: "center", maxWidth: 760, mx: "auto" }}>
        <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}><Botanical name={icon} size={64} /></Box>
        <Heading id="track-state" component="h1" size={{ xs: "28px", sm: "34px" }} lineHeight={1.2}>{title}</Heading>
        <Box sx={{ maxWidth: 500, mx: "auto", mt: 1.5, color: T.body }}>{children}</Box>
      </Card>
      <Box sx={{ maxWidth: 760, mx: "auto" }}><TrustFooter /></Box>
    </Shell>
  );
}

function ExpiredState({ token }: { token: string }) {
  const renew = useMutation({ mutationFn: () => bloomSupport.trackRenew(token) });
  return (
    <MessageState icon="mail" title="This link has expired">
      <Typography component="p" sx={{ m: 0, fontSize: "16px", color: T.body, lineHeight: 1.6 }}>
        For your privacy, tracking links stop working after a while. Your request and its whole conversation are safe — nothing is lost.
      </Typography>
      {renew.isSuccess ? (
        <Box role="status" sx={{ mt: 2.5, p: 2, borderRadius: "12px", bgcolor: T.tint, color: T.primary, fontWeight: 600, lineHeight: 1.5 }}>
          If this link belongs to a request, we&apos;ve emailed a fresh one to the address on that request. It can take a minute or two to arrive.
        </Box>
      ) : (
        <Button onClick={() => renew.mutate()} loading={renew.isPending} sx={{ ...primaryButton, mt: 2.5 }}>
          Email me a new link
        </Button>
      )}
      {renew.isError && (
        <Typography role="alert" component="p" sx={{ fontSize: "14px", color: T.danger, mt: 1.5, mb: 0 }}>
          {renew.error instanceof BloomSupportError && renew.error.status === 429 ? "We've already sent a new link recently — please check your inbox and spam folder." : "That didn't go through. Please try again in a minute."}
        </Typography>
      )}
      <Typography component="p" sx={{ fontSize: "14px", color: T.muted, mt: 2.5, mb: 0 }}>
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
        <Typography component="p" sx={{ m: 0, fontSize: "16px", color: T.body, lineHeight: 1.6 }}>
          The link may be incomplete — some email apps split long links across lines. Try opening it again straight from the email.
        </Typography>
        <Typography component="p" sx={{ fontSize: "14px", color: T.muted, mt: 2, mb: 0 }}>
          Still stuck? Reply to any email about your request, or write to us at{" "}
          <Link href={`mailto:${SUPPORT_EMAIL}`} sx={{ color: T.primary, fontWeight: 600, ...focusRing }}>{SUPPORT_EMAIL}</Link>.
        </Typography>
      </MessageState>
    );
  }
  if (q.isLoading) return <LoadingState />;
  if (q.error || !q.data) {
    return (
      <MessageState icon="alert" title="We couldn't load your request">
        <Typography component="p" sx={{ m: 0, fontSize: "16px", color: T.body, lineHeight: 1.6 }}>Something went wrong on our side, not yours. Your request is safe.</Typography>
        <Button onClick={() => void q.refetch()} loading={q.isFetching} sx={{ ...primaryButton, mt: 2.5 }}>
          Try again
        </Button>
      </MessageState>
    );
  }
  if (q.data.state === "expired") return <ExpiredState token={token} />;

  const view = q.data;
  const p = presentStatus(view);
  const timeline = buildTimeline(view.messages);
  const firstCustomer = view.messages.find((m) => m.author === "customer")?.id ?? null;
  const replyNow = () => {
    const box = document.getElementById("track-reply");
    box?.scrollIntoView({ behavior: "smooth", block: "center" });
    box?.focus({ preventScroll: true });
  };

  return (
    <Shell title={`Request #${view.number} · Bloom Support`} company={view.company}>
      <StatusCard view={view} p={p} />

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 3, mt: 3, alignItems: "flex-start" }}>
        <Box sx={{ flex: "999 1 560px", minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
          <Card aria-labelledby="track-conversation" sx={{ px: { xs: 2, sm: 4 }, py: { xs: 2.5, sm: 3.5 }, display: "flex", flexDirection: "column", gap: 2.5 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5}>
              <Heading id="track-conversation">Conversation</Heading>
              <Button variant="outlined" aria-label="Print this request" startDecorator={<Printer size={16} aria-hidden />} onClick={() => window.print()}
                sx={{ ...outlineButton, "@media print": { display: "none" } }}>
                Print
              </Button>
            </Stack>
            {fileError && <Typography role="alert" component="p" sx={{ m: 0, fontSize: "14px", color: T.danger }}>{fileError}</Typography>}
            {timeline.length === 0 && !pending ? (
              <Typography component="p" sx={{ m: 0, fontSize: "15px", color: T.body }}>No messages yet. We&apos;ll post every update here and email you too.</Typography>
            ) : (
              <Stack component="ol" spacing={2.5} sx={{ m: 0, p: 0 }}>
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
            {view.can_reply && <Composer token={token} view={view} onSent={applyView} onPending={setPending} />}
            {!view.can_reply && view.status !== "resolved" && (
              <Box sx={{ borderTop: `1px solid ${T.divider}`, pt: 2.5, "@media print": { display: "none" } }}>
                <Typography component="h3" sx={{ m: 0, fontFamily: FONT.heading, fontWeight: 700, fontSize: "17px", color: T.navy }}>Want to add something?</Typography>
                <Typography component="p" sx={{ m: 0, mt: 0.5, fontSize: "14px", color: T.body, lineHeight: 1.6 }}>
                  {view.merged_into_number !== null
                    ? `Reply to any email about request #${view.merged_into_number} and it will reach the right place.`
                    : "Reply to any email about this request and it will appear here."}
                </Typography>
              </Box>
            )}
          </Card>
          {view.status === "resolved" && <ResolvedActions token={token} view={view} onDone={applyView} />}
        </Box>

        <Box component="aside" aria-label="About this request" sx={{ flex: "1 1 320px", minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
          <NextPanel view={view} p={p} onReplyNow={replyNow} />
          <DetailsCard view={view} />
        </Box>
      </Box>

      <TrustFooter expiresAt={view.link_expires_at} />
    </Shell>
  );
}
