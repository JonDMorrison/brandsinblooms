/**
 * Tokens and formatting helpers for the public tracking page.
 * Colours are the BloomSuite theme (src/config/joy-theme.ts): primary
 * hsl(193 81% 20%), secondary hsl(184 55% 41%), accent hsl(225 42% 32%) and
 * brandNavy, on the BloomSuite page tint. Text pairs meet WCAG AA.
 */
export const T = Object.freeze({
  /** brandNavy: header band and headings */
  navy: "#183246",
  /** primary: buttons, done steps, links, the "what happens next" panel */
  primary: "#0A4A5C",
  primaryHover: "#083A48",
  /** secondary: the current step and accents */
  secondary: "#2F9AA2",
  halo: "#D4ECEE",
  /** accent: eyebrow, original-request badge, avatars */
  accent: "#2F4174",
  accentSoft: "#EEF1F8",
  tint: "#E6F2F5",
  ink: "#1B2B3A",
  body: "#34495C",
  muted: "#5B6B79",
  page: "#F2F7F9",
  panel: "#F5F9FA",
  border: "#D5E3E8",
  divider: "#E6EEF2",
  outline: "#C3D3DF",
  white: "#FFFFFF",
  amber: "#8A5A12",
  amberSoft: "#FBF3E4",
  danger: "#9A3412",
  dangerSoft: "#FFF4ED",
  focus: "#2F9AA2",
});

export const FONT = Object.freeze({
  heading: "Quicksand, system-ui, sans-serif",
  body: "Inter, system-ui, sans-serif",
});

export const focusRing = {
  "&:focus-visible": { outline: `3px solid ${T.focus}`, outlineOffset: "2px" },
} as const;

export const srOnly = { position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" } as const;

/** Primary action: deep teal, white text, 44px tall. */
export const primaryButton = {
  bgcolor: T.primary, color: T.white, borderRadius: "10px", fontWeight: 600, fontSize: "15px", minHeight: 44, px: 2.75,
  "&:hover": { bgcolor: T.primaryHover }, "&.Mui-disabled": { bgcolor: T.outline, color: T.white }, ...focusRing,
} as const;

/** Secondary action: outlined, deep-teal text, 44px tall. */
export const outlineButton = {
  bgcolor: "transparent", color: T.primary, border: `1px solid ${T.border}`, borderRadius: "10px", fontWeight: 500, fontSize: "14px", minHeight: 44, px: 1.75,
  "&:hover": { bgcolor: T.tint, borderColor: T.outline }, ...focusRing,
} as const;

// ---------------------------------------------------------------------------
// Dates in the viewer's own timezone
// ---------------------------------------------------------------------------
export function fullDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(iso));
}
export function shortDate(iso: string): string {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }), hour: "numeric", minute: "2-digit" }).format(d);
}
export function dayDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(iso));
}

/** "Nov 5" */
export function monthDay(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(iso));
}
/** "Nov 5, 2026" */
export function longDay(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(new Date(iso));
}
