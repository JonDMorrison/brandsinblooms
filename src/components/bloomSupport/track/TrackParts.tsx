/**
 * Presentational pieces of the public tracking page (/support/track/:token).
 * BloomSuite visual language: navy band, deep-teal actions, teal progress,
 * indigo accents on a cool page tint, Quicksand headings over Inter text.
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
import { FONT, focusRing, fullDate, outlineButton, shortDate, srOnly, T } from "./trackTheme";
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


export function Card({ children, sx, component = "section", ...rest }: { children: ReactNode; sx?: Record<string, unknown>; component?: "section" | "div" | "aside"; "aria-labelledby"?: string; "aria-busy"?: "true"; id?: string }) {
  return (
    <Box
      component={component}
      {...rest}
      sx={{
        bgcolor: T.white,
        border: `1px solid ${T.border}`,
        borderRadius: "20px",
        "@media print": { boxShadow: "none", breakInside: "avoid" },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

/** Section heading in the page's display face. */
export function Heading({ id, children, size = 22, color = T.navy, component = "h2", lineHeight = 1.25 }: { id?: string; children: ReactNode; size?: number | { xs: string; sm: string }; color?: string; component?: "h1" | "h2"; lineHeight?: number }) {
  return (
    <Typography id={id} component={component} sx={{ m: 0, fontFamily: FONT.heading, fontWeight: 700, fontSize: typeof size === "number" ? `${size}px` : size, lineHeight, color }}>
      {children}
    </Typography>
  );
}

export function Time({ iso, children }: { iso: string; children: ReactNode }) {
  return <time dateTime={iso} title={fullDate(iso)}>{children}</time>;
}


const Check = ({ size = 14, width = 3 }: { size?: number; width?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12l5 5L20 7" />
  </svg>
);

// ---------------------------------------------------------------------------
// Numbered progress stepper
// ---------------------------------------------------------------------------
export function Stepper({ steps, current, dates }: { steps: readonly string[]; current: number; dates: ReadonlyArray<ReactNode | null> }) {
  return (
    <Box
      component="ol"
      aria-label="Progress"
      sx={{ listStyle: "none", m: 0, p: 0, display: "grid", gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`, gap: { xs: 0.75, sm: 1 } }}
    >
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current || (n === current && n === steps.length);
        const active = n === current && !done;
        const last = n === steps.length;
        const date = dates[i];
        return (
          <Box component="li" key={label} aria-current={n === current ? "step" : undefined} sx={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 1.25 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box
                aria-hidden
                sx={{
                  width: 28, height: 28, borderRadius: 999, flex: "none", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 600, boxSizing: "border-box",
                  ...(done
                    ? { bgcolor: T.primary, color: T.white }
                    : active
                    ? { bgcolor: T.secondary, color: T.white, boxShadow: `0 0 0 5px ${T.halo}` }
                    : { bgcolor: T.white, color: T.muted, border: `2px solid ${T.outline}` }),
                }}
              >
                {done ? <Check /> : n}
              </Box>
              {!last && <Box aria-hidden sx={{ height: 3, flex: 1, borderRadius: 3, bgcolor: n < current ? T.primary : T.border }} />}
            </Box>
            <Typography component="span" sx={{ fontSize: { xs: "12px", sm: "14px" }, lineHeight: 1.35, color: active ? T.primary : done ? T.ink : T.muted, fontWeight: active ? 700 : 400, overflowWrap: "anywhere" }}>
              <Box component="span" sx={srOnly}>{done ? "Done: " : active ? "Current step: " : "Next: "}</Box>
              {label}
              {date && <Box component="span" sx={{ display: "block", fontSize: "12px", fontWeight: 400, color: T.muted, mt: 0.25 }}>{date}</Box>}
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

export function MessageBody({ body, color = T.body }: { body: string; color?: string }) {
  return (
    <Box
      sx={{
        color, fontSize: "15px", lineHeight: 1.65, overflowWrap: "anywhere",
        "& p": { m: 0, mb: 1.25 }, "& p:last-child": { mb: 0 },
        "& ul, & ol": { m: 0, mb: 1.25, pl: 3 }, "& ul": { listStyle: "disc" }, "& ol": { listStyle: "decimal" }, "& li": { mb: 0.5, listStyle: "inherit" },
        "& code": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "0.88em", bgcolor: T.panel, border: `1px solid ${T.border}`, borderRadius: "6px", px: 0.5 },
        "& pre": { bgcolor: T.panel, border: `1px solid ${T.border}`, borderRadius: "10px", p: 1.5, overflowX: "auto", "& code": { border: 0, p: 0 } },
        "& blockquote": { m: 0, mb: 1.25, pl: 1.5, borderLeft: `3px solid ${T.border}`, color: T.muted },
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
              ? <Link href={safe} target="_blank" rel="noopener noreferrer nofollow ugc" sx={{ color: T.primary, fontWeight: 600, textDecorationColor: "currentColor", ...focusRing }}>{children}</Link>
              : <span>{children}</span>;
          },
        }}
      >
        {body}
      </ReactMarkdown>
    </Box>
  );
}

const LONG = 420;

/** Long messages open collapsed with a fade and a real button to expand. */
export function Collapsible({ body, background = T.white }: { body: string; background?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const long = body.length > LONG || body.split("\n").length > 8;
  if (!long) return <MessageBody body={body} />;
  return (
    <Box>
      <Box
        id={id}
        sx={{
          position: "relative", maxHeight: open ? "none" : 132, overflow: "hidden",
          ...(open ? {} : { "&::after": { content: '""', position: "absolute", left: 0, right: 0, bottom: 0, height: 56, background: `linear-gradient(rgba(255,255,255,0), ${background})` } }),
          "@media print": { maxHeight: "none", "&::after": { display: "none" } },
        }}
      >
        <MessageBody body={body} />
      </Box>
      <Button
        variant="plain"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        sx={{ minHeight: 44, px: 0, color: T.primary, fontWeight: 600, fontSize: "14px", "&:hover": { bgcolor: "transparent", textDecoration: "underline" }, ...focusRing, "@media print": { display: "none" } }}
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
    <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1} sx={{ mt: 0.5 }} aria-label="Attachments">
      {files.map((f) => (
        <Button
          key={f.id}
          variant="outlined"
          color="neutral"
          loading={busyId === f.id}
          onClick={() => onOpen(f)}
          startDecorator={f.content_type.startsWith("image/") ? <Paperclip size={14} aria-hidden /> : <FileText size={14} aria-hidden />}
          sx={{ ...outlineButton, bgcolor: T.panel, fontWeight: 600, maxWidth: "100%" }}
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
      <Box aria-hidden sx={{ width: 40, height: 40, borderRadius: 999, bgcolor: "#E1E9EF", color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 14, flex: "none" }}>
        {initials(name)}
      </Box>
    );
  }
  return (
    <Box aria-hidden sx={{ width: 40, height: 40, borderRadius: 999, bgcolor: T.tint, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
      <Botanical name="leaf" size={24} />
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
  const bg = customer ? T.white : T.panel;
  return (
    <Box component="li" sx={{ listStyle: "none", display: "flex", gap: { xs: 1.25, sm: 1.75 }, alignItems: "flex-start" }}>
      <Avatar author={m.author} name={m.name} />
      <Box
        component="article"
        aria-label={`${customer ? m.name : "Bloom Support"}, ${fullDate(m.created_at)}`}
        sx={{ flex: 1, minWidth: 0, borderRadius: "16px", px: { xs: 1.75, sm: 2.5 }, py: 2, bgcolor: bg, border: `1px solid ${T.border}`, display: "flex", flexDirection: "column", gap: 1.25 }}
      >
        <Stack direction="row" spacing={1} alignItems="baseline" justifyContent="space-between" flexWrap="wrap" useFlexGap>
          <Typography component="span" sx={{ color: T.navy, fontWeight: 600, fontSize: "15px", overflowWrap: "anywhere" }}>
            {customer ? m.name : "Bloom Support"}
            {isRequest && (
              <Box component="span" sx={{ ml: 0.75, fontSize: "11px", fontWeight: 600, letterSpacing: "1px", color: T.accent, bgcolor: T.accentSoft, px: 1, py: 0.375, borderRadius: "6px", whiteSpace: "nowrap" }}>
                ORIGINAL REQUEST
              </Box>
            )}
          </Typography>
          <Typography component="span" sx={{ fontSize: "13px", color: T.muted }}><Time iso={m.created_at}>{shortDate(m.created_at)}</Time></Typography>
        </Stack>
        <Collapsible body={m.body} background={bg} />
        <Attachments files={[...extraFiles, ...m.attachments]} onOpen={onOpenFile} busyId={busyFileId} />
      </Box>
    </Box>
  );
}

/** Bloom's automatic notes: a compact check row instead of a full message. */
export function EventRow({ item }: { item: Extract<TimelineItem, { type: "event" }> }) {
  return (
    <Box component="li" sx={{ listStyle: "none", display: "flex", gap: 1.75, alignItems: "flex-start", pl: 1 }}>
      <Box aria-hidden sx={{ width: 24, height: 24, borderRadius: 999, bgcolor: T.tint, color: T.primary, display: "flex", alignItems: "center", justifyContent: "center", flex: "none", mt: "2px" }}>
        <Check size={12} />
      </Box>
      <Box sx={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 0.5 }}>
        <Typography component="span" sx={{ fontSize: "14px", color: T.navy }}>
          <Box component="strong" sx={{ fontWeight: 600 }}>{item.title}</Box>
          <Box component="span" sx={{ color: T.muted }}> · <Time iso={item.at}>{shortDate(item.at)}</Time></Box>
        </Typography>
        {item.details.map((d) => (
          <Typography key={d} component="span" sx={{ fontSize: "14px", lineHeight: 1.55, color: "#4A5B6B", overflowWrap: "anywhere" }}>{d}</Typography>
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
        sx={{ flex: 1, minWidth: 0, borderRadius: "16px", px: { xs: 1.75, sm: 2.5 }, py: 2, bgcolor: T.white, border: `1px ${p.state === "failed" ? "solid #C2410C" : `dashed ${T.outline}`}` }}>
        <Stack direction="row" spacing={1} alignItems="baseline" sx={{ mb: 0.75 }}>
          <Typography component="span" sx={{ color: T.navy, fontWeight: 600, fontSize: "15px" }}>{name}</Typography>
          <Typography component="span" sx={{ fontSize: "13px", color: p.state === "failed" ? T.danger : T.muted, ml: "auto !important" }}>
            {p.state === "sending" ? "Sending…" : p.state === "sent" ? "Sent just now" : "Not sent"}
          </Typography>
        </Stack>
        <MessageBody body={p.body} />
        {p.files.length > 0 && <Typography sx={{ fontSize: "13px", color: T.muted, mt: 1 }}>Attaching {p.files.join(", ")}</Typography>}
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
        display: "block", width: "100%", boxSizing: "border-box", resize: "vertical", minHeight: 88, maxHeight: 480,
        px: 1.75, py: 1.5, font: "inherit", fontSize: "15px", lineHeight: 1.5, color: T.ink, bgcolor: T.white,
        border: `1px solid ${T.outline}`, borderRadius: "12px", outline: "none",
        "&::placeholder": { color: T.muted },
        "&:focus-visible": { borderColor: T.primary, boxShadow: `0 0 0 3px ${T.halo}` },
        "&:disabled": { opacity: 0.7 },
      }}
    />
  );
}
