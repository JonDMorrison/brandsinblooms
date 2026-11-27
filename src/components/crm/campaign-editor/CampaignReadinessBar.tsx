import * as React from "react";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { AlertTriangle, ArrowDown } from "lucide-react";
import { CAMPAIGN_EDITOR_COLORS as C } from "@/components/crm/campaign-editor/campaignEditorTheme";

/** One item from the editor's send checks (sendBlockers). */
export interface CampaignReadinessBlocker {
  message: string;
  /** The step that fixes it, or null when nothing on the page can. */
  section: string | null;
  fixLabel: string;
}

/**
 * The amber bar under the header. It lists what blocks sending, straight
 * from the editor's existing send checks, and jumps to the first fix.
 * Renders nothing when nothing blocks sending.
 */
export function CampaignReadinessBar({
  blockers,
  onJump,
  extraAction,
}: {
  blockers: CampaignReadinessBlocker[];
  onJump: (section: string) => void;
  /** Shown after the list, for fixes that are not a step (reload a draft). */
  extraAction?: React.ReactNode;
}) {
  if (blockers.length === 0) return null;
  const firstFixable = blockers.find((blocker) => blocker.section);
  return (
    <Box
      role="region"
      aria-label="Before you can send"
      data-testid="campaign-readiness-bar"
      sx={{
        bgcolor: C.warningBg,
        border: `1px solid ${C.warningBorder}`,
        borderLeftWidth: 4,
        borderRadius: "12px",
        px: { xs: 2, sm: 2.5 },
        py: 1.5,
        color: C.warningText,
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={{ xs: 1, md: 2 }}
        alignItems={{ xs: "flex-start", md: "center" }}
      >
        <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ flex: 1, minWidth: 0 }}>
          <AlertTriangle size={20} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography component="h2" sx={{ fontSize: 16, fontWeight: 700, color: C.warningText }}>
              {blockers.length === 1
                ? "1 thing to fix before you can send"
                : `${blockers.length} things to fix before you can send`}
            </Typography>
            <Box
              component="ul"
              data-testid="campaign-readiness-items"
              sx={{ m: 0, mt: 0.5, pl: 2.5, display: "grid", gap: 0.25 }}
            >
              {blockers.map((blocker) => (
                <Typography
                  key={blocker.message}
                  component="li"
                  sx={{ fontSize: 15, color: C.warningText }}
                >
                  {blocker.message}
                </Typography>
              ))}
            </Box>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
          {firstFixable?.section ? (
            <Box
              component="a"
              href={`#${firstFixable.section}`}
              data-testid="campaign-readiness-jump"
              onClick={(event: React.MouseEvent<HTMLAnchorElement>) => {
                event.preventDefault();
                onJump(firstFixable.section as string);
              }}
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                minHeight: 44,
                px: 1.5,
                borderRadius: "10px",
                color: C.warningText,
                fontSize: 16,
                fontWeight: 700,
                textDecoration: "underline",
                textUnderlineOffset: "3px",
                "&:hover": { bgcolor: "rgba(201, 138, 27, 0.12)" },
                "&:focus-visible": { outline: `3px solid ${C.warningText}`, outlineOffset: 2 },
              }}
            >
              {firstFixable.fixLabel}
              <ArrowDown size={16} aria-hidden />
            </Box>
          ) : null}
          {extraAction}
        </Stack>
      </Stack>
    </Box>
  );
}
