import Box from "@mui/joy/Box";
import type { StatusTone } from "./statusWords";

/** Soft, rounded status labels used across the redesigned desk. No alarm colours. */
export type PillTone = StatusTone | "neutral";

const PILL_STYLE: Record<PillTone, { bg: string; fg: string }> = {
  active: { bg: "primary.50", fg: "primary.800" },
  waiting: { bg: "neutral.100", fg: "neutral.700" },
  done: { bg: "success.50", fg: "success.700" },
  attention: { bg: "warning.50", fg: "warning.800" },
  neutral: { bg: "neutral.50", fg: "neutral.700" },
};

export function StatusPill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  const s = PILL_STYLE[tone];
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", px: 2.5, py: 0.5, borderRadius: 999, bgcolor: s.bg, color: s.fg, fontSize: "0.8125rem", fontWeight: 600, lineHeight: 1.5, whiteSpace: "nowrap" }}>
      {children}
    </Box>
  );
}
