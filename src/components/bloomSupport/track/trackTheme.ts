/** Tokens and formatting helpers for the public tracking page. */
import { BLOOM_EMAIL } from "@/lib/email/premiumBotanical";

/** Page tokens: the support email palette plus the BloomSites hero panel. */
export const T = Object.freeze({
  navy: BLOOM_EMAIL.navy,
  ink: "#243D55",
  body: BLOOM_EMAIL.body,
  muted: BLOOM_EMAIL.muted,
  sage: BLOOM_EMAIL.sage,
  sageSoft: "#E6EEE9",
  page: BLOOM_EMAIL.ivory,
  panel: "#F5F7F3",
  border: BLOOM_EMAIL.border,
  white: BLOOM_EMAIL.white,
  amber: "#8A5A12",
  amberSoft: "#FBF3E4",
  focus: "#2F6B57",
});

export const focusRing = {
  "&:focus-visible": { outline: `3px solid ${T.focus}`, outlineOffset: "2px" },
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

