import * as React from "react";
import Box from "@mui/joy/Box";
import CircularProgress from "@mui/joy/CircularProgress";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { AlertTriangle, ArrowDown, CheckCircle2, ExternalLink } from "lucide-react";
import { JoyTooltip } from "@/components/joy/JoyTooltip";
import { campaignEditorVisuallyHidden } from "@/components/crm/campaign-editor/campaignEditorTheme";

/** One item from the editor's send checks (sendBlockers). */
export interface CampaignReadinessBlocker {
  message: string;
  /** The step that fixes it, or null when nothing on the page can. */
  section: string | null;
  fixLabel: string;
  /** Show the fix as a link on this item itself, not only on the first one. */
  inlineLink?: boolean;
  /**
   * A settings page that fixes it (for example the business address). Opens
   * in a new tab so the draft stays open. Shown as this item's link.
   */
  href?: string;
}

/**
 * The 44px hit area around a small chip. The visible chip is 32px tall; the
 * link around it keeps the touch target at 44px.
 */
const chipHitAreaSx = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 44,
  textDecoration: "none",
  borderRadius: "xl",
  "&:focus-visible": {
    outline: "3px solid var(--joy-palette-warning-softColor)",
    outlineOffset: 0,
  },
  "&:hover > span, &:focus-visible > span": { bgcolor: "warning.softActiveBg" },
} as const;

const chipFaceSx = {
  display: "inline-flex",
  alignItems: "center",
  gap: 1,
  minHeight: 32,
  px: 3,
  borderRadius: "xl",
  bgcolor: "warning.softHoverBg",
  color: "warning.softColor",
  typography: "body-sm",
  fontWeight: "lg",
  lineHeight: 1.3,
  // Long fix labels wrap inside the chip instead of widening the page.
  whiteSpace: "normal",
  overflowWrap: "anywhere",
  transition: "background-color 150ms ease",
} as const;

function ReadinessChip({
  blocker,
  onJump,
  testId,
}: {
  blocker: CampaignReadinessBlocker;
  onJump: (section: string) => void;
  testId: string;
}) {
  const label = blocker.fixLabel || blocker.message;
  if (blocker.href) {
    return (
      <JoyTooltip title={blocker.message} describeChild>
        <Box
          component="a"
          href={blocker.href}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="campaign-readiness-settings-link"
          sx={chipHitAreaSx}
        >
          <Box component="span" sx={chipFaceSx}>
            {label}
            <ExternalLink size={14} aria-hidden />
          </Box>
        </Box>
      </JoyTooltip>
    );
  }
  if (blocker.section) {
    const section = blocker.section;
    return (
      <JoyTooltip title={blocker.message} describeChild>
        <Box
          component="a"
          href={`#${section}`}
          data-testid={testId}
          onClick={(event: React.MouseEvent<HTMLAnchorElement>) => {
            event.preventDefault();
            onJump(section);
          }}
          sx={chipHitAreaSx}
        >
          <Box component="span" sx={chipFaceSx}>
            {label}
            <ArrowDown size={14} aria-hidden />
          </Box>
        </Box>
      </JoyTooltip>
    );
  }
  // Nothing on the page fixes it (a save conflict, a send hold): a plain
  // chip that states it.
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", minHeight: 44 }}>
      <Box component="span" sx={chipFaceSx}>
        {label}
      </Box>
    </Box>
  );
}

const barSx = {
  borderRadius: "lg",
  border: "1px solid",
  px: 4,
  py: 1,
  minHeight: 56,
  display: "flex",
  alignItems: "center",
} as const;

/**
 * The bar under the header. It lists what blocks sending, straight from the
 * editor's existing send checks, as one compact row of chips that each jump
 * to the step that fixes them. While the audience check is still running it
 * says so; when nothing blocks sending it says the campaign is ready. It is
 * never an empty box.
 */
export function CampaignReadinessBar({
  blockers,
  onJump,
  extraAction,
  checking = false,
  checkingLabel = "Checking audience",
}: {
  blockers: CampaignReadinessBlocker[];
  onJump: (section: string) => void;
  /** Shown after the list, for fixes that are not a step (reload a draft). */
  extraAction?: React.ReactNode;
  /** The email eligibility check has not returned yet. */
  checking?: boolean;
  checkingLabel?: string;
}) {
  if (blockers.length === 0 && checking) {
    return (
      <Box
        role="status"
        aria-live="polite"
        data-testid="campaign-readiness-checking"
        sx={{ ...barSx, gap: 2, bgcolor: "neutral.softBg", borderColor: "neutral.outlinedBorder" }}
      >
        <CircularProgress size="sm" color="neutral" sx={{ "--CircularProgress-size": "20px" }} />
        <Typography level="title-md" sx={{ color: "text.secondary" }}>
          {checkingLabel}
        </Typography>
      </Box>
    );
  }

  if (blockers.length === 0) {
    return (
      <Box
        role="status"
        aria-live="polite"
        data-testid="campaign-readiness-ready"
        sx={{
          ...barSx,
          gap: 2,
          bgcolor: "success.softBg",
          borderColor: "success.outlinedBorder",
          color: "success.softColor",
        }}
      >
        <CheckCircle2 size={20} aria-hidden style={{ flexShrink: 0 }} />
        <Typography level="title-md" sx={{ fontWeight: "xl", color: "success.softColor" }}>
          Campaign is ready
        </Typography>
        <Typography level="body-sm" sx={{ color: "success.softColor" }}>
          Nothing left to fix before you send.
        </Typography>
        {extraAction ? <Box sx={{ ml: "auto" }}>{extraAction}</Box> : null}
      </Box>
    );
  }

  return (
    <Box
      role="region"
      aria-label="Before you can send"
      data-testid="campaign-readiness-bar"
      sx={{
        ...barSx,
        bgcolor: "warning.softBg",
        borderColor: "warning.outlinedBorder",
        color: "warning.softColor",
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        useFlexGap
        flexWrap="wrap"
        sx={{ columnGap: 2, rowGap: 0, minWidth: 0, width: "100%" }}
      >
        <Stack direction="row" spacing={2} alignItems="center" sx={{ minHeight: 44 }}>
          <AlertTriangle size={20} aria-hidden style={{ flexShrink: 0 }} />
          <Typography
            component="h2"
            level="title-md"
            sx={{ fontWeight: "xl", color: "warning.softColor" }}
          >
            {blockers.length === 1
              ? "1 thing before you can send"
              : `${blockers.length} things before you can send`}
          </Typography>
        </Stack>
        <Box
          component="ul"
          data-testid="campaign-readiness-items"
          sx={{
            m: 0,
            p: 0,
            listStyle: "none",
            display: "flex",
            flexWrap: "wrap",
            columnGap: 2,
            rowGap: 0,
            minWidth: 0,
          }}
        >
          {blockers.map((blocker) => (
            <Box component="li" key={blocker.message} sx={{ position: "relative", minWidth: 0, maxWidth: "100%" }}>
              {/* The full sentence, for screen readers; sighted users get it
                  as the chip's tooltip. */}
              {blocker.fixLabel ? (
                <Box component="span" sx={campaignEditorVisuallyHidden}>
                  {blocker.message}
                </Box>
              ) : null}
              <ReadinessChip
                blocker={blocker}
                onJump={onJump}
                testId={`campaign-readiness-link-${blocker.section ?? "none"}`}
              />
            </Box>
          ))}
        </Box>
        {checking ? (
          <Typography level="body-sm" sx={{ color: "warning.softColor" }}>
            {checkingLabel}
          </Typography>
        ) : null}
        {extraAction ? <Box sx={{ ml: { sm: "auto" } }}>{extraAction}</Box> : null}
      </Stack>
    </Box>
  );
}
