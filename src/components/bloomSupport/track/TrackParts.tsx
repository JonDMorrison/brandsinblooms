/**
 * Presentational pieces of the public tracking page (/support/track/:token).
 * Botanical visual language shared with Bloom Support emails: navy ink, sage
 * accents, ivory page, soft panels and the first-party premium icons.
 */
import { useId, useState, type ReactNode } from "react";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Button from "@mui/joy/Button";
import Link from "@mui/joy/Link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileText, Paperclip } from "lucide-react";
import { focusRing, fullDate, shortDate, T } from "./trackTheme";
import type { TrackAttachment, TrackMessage, TimelineItem } from "@/lib/bloomSupport/trackView";

export type BotanicalIcon = "leaf" | "check" | "mail" | "calendar" | "alert" | "sun" | "water" | "soil" | "truck";
const ICONS = "https://bloomsites.app/email/premium-icons/";

/** Decorative only: the text next to it always carries the meaning. */
export function Botanical({ name, size = 40 }: { name: BotanicalIcon; size?: number }) {
  return (
    <Box
      component="img"
      src={`${ICONS}${name}.png`}
      alt=""
      aria-hidden
      width={size}
      height={size}
      loading="lazy"
      sx={{ display: "block", width: size, height: size, objectFit: "contain", flex: "0 0 auto" }}
    />
  );
}

export function Card({ children, sx, component = "section", ...rest }: { children: ReactNode; sx?: Record<string, unknown>; component?: "section" | "div" | "aside"; "aria-labelledby"?: string; id?: string }) {
  return (
    <Box
      component={component}
      {...rest}
      sx={{
        bgcolor: T.white,
        border: `1px solid ${T.border}`,
        borderRadius: { xs: "16px", sm: "20px" },
        boxShadow: "0 1px 2px rgba(27,48,73,0.04), 0 8px 24px rgba(27,48,73,0.05)",
        "@media print": { boxShadow: "none", breakInside: "avoid" },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

export function Time({ iso, children }: { iso: string; children: ReactNode }) {
  return <time dateTime={iso} title={fullDate(iso)}>{children}</time>;
}

// ---------------------------------------------------------------------------
// Progress stepper
// ---------------------------------------------------------------------------
export function Stepper({ steps, current, tone }: { steps: readonly string[]; current: number; tone: "neutral" | "progress" | "action" | "success" }) {
  const accent = tone === "action" ? T.amber : T.sage;
  return (
    <Box
      component="ol"
      aria-label="Progress"
      sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gridTemplateColumns: `repeat(${steps.length}, 1fr)`, gap: { xs: 0.5, sm: 1 } }}
    >
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current || (n === current && n === steps.length);
        const active = n === current && !done;
        return (
          <Box component="li" key={label} aria-current={n === current ? "step" : undefined} sx={{ minWidth: 0 }}>
            <Box sx={{ height: 6, borderRadius: 99, bgcolor: n <= current ? accent : T.border, mb: 1, position: "relative", overflow: "hidden",
              ...(active ? { "&::after": { content: '""', position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent)", animation: "bloomTrackShimmer 2.4s ease-in-out infinite" },
                "@media (prefers-reduced-motion: reduce)": { "&::after": { animation: "none" } } } : {}) }} />
            <Typography
              level="body-xs"
              sx={{ color: n <= current ? T.navy : T.muted, fontWeight: n === current ? 700 : 500, lineHeight: 1.3, fontSize: { xs: "11px", sm: "13px" } }}
            >
              <Box component="span" sx={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>
                {done ? "Done: " : active ? "Current step: " : "Next: "}
              </Box>
              {label}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Message body: safe Markdown (no raw HTML, no images, safe links only)
// ---------------------------------------------------------------------------
const safeHref = (href: string | undefined): string | null => {
  if (!href) return null;
  try {
    const u = new URL(href, "https://bloomsuite.app");
    return ["https:", "http:", "mailto:"].includes(u.protocol) && !u.username && !u.password ? u.href : null;
  } catch {
    return null;
  }
};

export function MessageBody({ body }: { body: string }) {
  return (
    <Box
      sx={{
        color: T.ink, fontSize: "15px", lineHeight: 1.65, overflowWrap: "anywhere",
        "& p": { m: 0, mb: 1.25 }, "& p:last-child": { mb: 0 },
        "& ul, & ol": { m: 0, mb: 1.25, pl: 3 }, "& ul": { listStyle: "disc" }, "& ol": { listStyle: "decimal" }, "& li": { mb: 0.5, listStyle: "inherit" },
        "& code": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "0.88em", bgcolor: T.panel, border: `1px solid ${T.border}`, borderRadius: "6px", px: 0.5 },
        "& pre": { bgcolor: T.panel, border: `1px solid ${T.border}`, borderRadius: "10px", p: 1.5, overflowX: "auto", "& code": { border: 0, p: 0 } },
        "& blockquote": { m: 0, mb: 1.25, pl: 1.5, borderLeft: `3px solid ${T.border}`, color: T.body },
        "& h1, & h2, & h3, & h4": { fontSize: "16px", fontWeight: 700, color: T.navy, m: 0, mb: 1 },
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        disallowedElements={["img"]}
        unwrapDisallowed
        components={{
          a: ({ href, children }) => {
            const safe = safeHref(href);
            return safe
              ? <Link href={safe} target="_blank" rel="noopener noreferrer nofollow ugc" sx={{ color: T.sage, fontWeight: 600, textDecorationColor: "currentColor", ...focusRing }}>{children}</Link>
              : <span>{children}</span>;
          },
        }}
      >
        {body}
      </ReactMarkdown>
    </Box>
  );
}

const LONG = 700;

/** Long messages open collapsed with a fade and a real button to expand. */
export function Collapsible({ body }: { body: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const long = body.length > LONG || body.split("\n").length > 14;
  if (!long) return <MessageBody body={body} />;
  return (
    <Box>
      <Box
        id={id}
        sx={{
          position: "relative", maxHeight: open ? "none" : 220, overflow: "hidden",
          ...(open ? {} : { "&::after": { content: '""', position: "absolute", left: 0, right: 0, bottom: 0, height: 72, background: `linear-gradient(rgba(255,255,255,0), ${T.white})` } }),
          "@media print": { maxHeight: "none", "&::after": { display: "none" } },
        }}
      >
        <MessageBody body={body} />
      </Box>
      <Button
        variant="plain"
        size="sm"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        sx={{ mt: 0.5, px: 0.75, ml: -0.75, color: T.sage, fontWeight: 700, "&:hover": { bgcolor: T.sageSoft }, ...focusRing, "@media print": { display: "none" } }}
      >
        {open ? "Show less" : "Show more"}
      </Button>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------
const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export function Attachments({ files, onOpen, busyId }: { files: TrackAttachment[]; onOpen: (f: TrackAttachment) => void; busyId: string | null }) {
  if (!files.length) return null;
  return (
    <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} sx={{ mt: 1.5 }} aria-label="Attachments">
      {files.map((f) => (
        <Button
          key={f.id}
          size="sm"
          variant="outlined"
          color="neutral"
          loading={busyId === f.id}
          onClick={() => onOpen(f)}
          startDecorator={f.content_type.startsWith("image/") ? <Paperclip size={14} aria-hidden /> : <FileText size={14} aria-hidden />}
          sx={{ borderColor: T.border, color: T.navy, bgcolor: T.panel, borderRadius: "10px", fontWeight: 600, maxWidth: "100%", ...focusRing }}
        >
          <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>{f.file_name}</Box>
          <Box component="span" sx={{ color: T.muted, fontWeight: 500, ml: 0.75 }}>{kb(f.size_bytes)}</Box>
        </Button>
      ))}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "Y").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

function Avatar({ author, name }: { author: TrackMessage["author"]; name: string }) {
  if (author === "customer") {
    return (
      <Box aria-hidden sx={{ width: 40, height: 40, borderRadius: "50%", bgcolor: T.sageSoft, color: T.sage, display: "grid", placeItems: "center", fontWeight: 700, fontSize: 14, flex: "0 0 auto" }}>
        {initials(name)}
      </Box>
    );
  }
  return (
    <Box aria-hidden sx={{ width: 40, height: 40, borderRadius: "50%", bgcolor: T.panel, border: `1px solid ${T.border}`, display: "grid", placeItems: "center", flex: "0 0 auto" }}>
      <Botanical name="leaf" size={26} />
    </Box>
  );
}

export interface PendingMessage {
  key: string;
  body: string;
  files: string[];
  state: "sending" | "sent" | "failed";
}

export function MessageRow({
  m, isRequest, onOpenFile, busyFileId, extraFiles = [],
}: { m: TrackMessage; isRequest: boolean; onOpenFile: (f: TrackAttachment) => void; busyFileId: string | null; extraFiles?: TrackAttachment[] }) {
  const customer = m.author === "customer";
  return (
    <Box component="li" sx={{ listStyle: "none", display: "flex", gap: { xs: 1.25, sm: 1.75 }, alignItems: "flex-start" }}>
      <Avatar author={m.author} name={m.name} />
      <Box
        component="article"
        aria-label={`${customer ? m.name : "Bloom Support"}, ${fullDate(m.created_at)}`}
        sx={{
          flex: 1, minWidth: 0, borderRadius: "14px", p: { xs: 1.75, sm: 2.25 },
          bgcolor: customer ? T.white : T.panel,
          border: `1px solid ${customer ? T.border : "#E3EAE5"}`,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="baseline" flexWrap="wrap" useFlexGap sx={{ mb: 0.75 }}>
          <Typography level="title-sm" sx={{ color: T.navy, fontWeight: 700 }}>{customer ? m.name : "Bloom Support"}</Typography>
          {isRequest && (
            <Typography level="body-xs" sx={{ color: T.sage, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", fontSize: "10.5px" }}>Original request</Typography>
          )}
          <Typography level="body-xs" sx={{ color: T.muted, ml: "auto !important" }}><Time iso={m.created_at}>{shortDate(m.created_at)}</Time></Typography>
        </Stack>
        <Collapsible body={m.body} />
        <Attachments files={[...extraFiles, ...m.attachments]} onOpen={onOpenFile} busyId={busyFileId} />
      </Box>
    </Box>
  );
}

export function EventRow({ item }: { item: Extract<TimelineItem, { type: "event" }> }) {
  return (
    <Box component="li" sx={{ listStyle: "none", display: "flex", gap: { xs: 1.25, sm: 1.75 }, alignItems: "flex-start" }}>
      <Box aria-hidden sx={{ width: 40, display: "grid", placeItems: "center", flex: "0 0 auto", pt: 0.25 }}>
        <Botanical name="check" size={28} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, py: 0.5 }}>
        <Typography level="body-sm" sx={{ color: T.navy, fontWeight: 700 }}>
          {item.title}
          <Typography component="span" level="body-xs" sx={{ color: T.muted, fontWeight: 500, ml: 1 }}><Time iso={item.at}>{shortDate(item.at)}</Time></Typography>
        </Typography>
        {item.details.map((d) => (
          <Typography key={d} level="body-sm" sx={{ color: T.body, mt: 0.25, lineHeight: 1.55 }}>{d}</Typography>
        ))}
      </Box>
    </Box>
  );
}

export function PendingRow({ p, name }: { p: PendingMessage; name: string }) {
  return (
    <Box component="li" sx={{ listStyle: "none", display: "flex", gap: { xs: 1.25, sm: 1.75 }, alignItems: "flex-start", opacity: p.state === "sending" ? 0.75 : 1 }}>
      <Avatar author="customer" name={name} />
      <Box component="article" aria-label={`${name}, ${p.state === "sending" ? "sending" : p.state === "sent" ? "sent" : "not sent"}`}
        sx={{ flex: 1, minWidth: 0, borderRadius: "14px", p: { xs: 1.75, sm: 2.25 }, bgcolor: T.white, border: `1px ${p.state === "failed" ? "solid #C2410C" : `dashed ${T.border}`}` }}>
        <Stack direction="row" spacing={1} alignItems="baseline" sx={{ mb: 0.75 }}>
          <Typography level="title-sm" sx={{ color: T.navy, fontWeight: 700 }}>{name}</Typography>
          <Typography level="body-xs" sx={{ color: p.state === "failed" ? "#9A3412" : T.muted, ml: "auto !important" }}>
            {p.state === "sending" ? "Sending…" : p.state === "sent" ? "Sent just now" : "Not sent"}
          </Typography>
        </Stack>
        <MessageBody body={p.body} />
        {p.files.length > 0 && <Typography level="body-xs" sx={{ color: T.muted, mt: 1 }}>Attaching {p.files.join(", ")}</Typography>}
      </Box>
    </Box>
  );
}

/** A plain textarea in the page's style (fixed rows, resizable; no autosize measuring). */
export function PlainTextarea(props: { id: string; value: string; onChange: (v: string) => void; rows: number; maxLength: number; disabled?: boolean; placeholder?: string; describedBy?: string }) {
  return (
    <Box
      component="textarea"
      id={props.id}
      rows={props.rows}
      value={props.value}
      maxLength={props.maxLength}
      disabled={props.disabled}
      placeholder={props.placeholder}
      aria-describedby={props.describedBy}
      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => props.onChange(e.target.value)}
      sx={{
        display: "block", width: "100%", boxSizing: "border-box", resize: "vertical", minHeight: 96, maxHeight: 480,
        p: 1.5, font: "inherit", fontSize: "15px", lineHeight: 1.55, color: T.ink, bgcolor: T.white,
        border: `1px solid ${T.border}`, borderRadius: "12px", outline: "none",
        "&::placeholder": { color: "#8A97A3" },
        "&:focus-visible": { borderColor: T.focus, boxShadow: `0 0 0 3px ${T.sageSoft}` },
        "&:disabled": { opacity: 0.7 },
      }}
    />
  );
}
