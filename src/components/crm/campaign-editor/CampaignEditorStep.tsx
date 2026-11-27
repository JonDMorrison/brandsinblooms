import * as React from "react";
import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Check, ChevronDown } from "lucide-react";
import {
  CAMPAIGN_EDITOR_COLORS as C,
  campaignEditorCardSx,
} from "@/components/crm/campaign-editor/campaignEditorTheme";

/** What a step header says about the step. */
export type CampaignStepState =
  | { kind: "done" }
  | { kind: "attention"; count: number }
  | { kind: "required" }
  | { kind: "optional" };

export function CampaignStepBadge({ state }: { state: CampaignStepState }) {
  if (state.kind === "done") {
    return (
      <Box
        component="span"
        data-testid="campaign-step-badge-done"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.5,
          color: C.success,
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        <Box
          component="span"
          aria-hidden
          sx={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            bgcolor: C.success,
            color: "#FFFFFF",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Check size={14} strokeWidth={3} />
        </Box>
        Done
      </Box>
    );
  }

  if (state.kind === "optional") {
    return (
      <Box
        component="span"
        data-testid="campaign-step-badge-optional"
        sx={{ color: C.muted, fontSize: 14, fontWeight: 500 }}
      >
        Optional
      </Box>
    );
  }

  const label =
    state.kind === "required"
      ? "Required"
      : `${state.count} ${state.count === 1 ? "issue" : "issues"}`;

  return (
    <Box
      component="span"
      data-testid={`campaign-step-badge-${state.kind}`}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        px: 1,
        py: 0.25,
        borderRadius: "999px",
        bgcolor: C.warningBg,
        border: `1px solid ${C.warningBorder}`,
        color: C.warningText,
        fontSize: 14,
        fontWeight: 600,
        lineHeight: 1.4,
      }}
    >
      {state.kind === "attention" ? (
        <Box
          component="span"
          aria-hidden
          sx={{
            minWidth: 20,
            height: 20,
            px: 0.5,
            borderRadius: "999px",
            bgcolor: C.warningText,
            color: "#FFFFFF",
            fontSize: 12,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {state.count}
        </Box>
      ) : null}
      <span>{state.kind === "attention" ? `Needs attention: ${label}` : label}</span>
    </Box>
  );
}

export interface CampaignEditorStepProps {
  id: string;
  number: number;
  title: string;
  summary?: React.ReactNode;
  state: CampaignStepState;
  expanded: boolean;
  onExpandedChange: (next: boolean) => void;
  children: React.ReactNode;
}

/**
 * One numbered step of the campaign editor. The header is a real button with
 * aria-expanded, so it works from the keyboard and with screen readers.
 */
export function CampaignEditorStep({
  id,
  number,
  title,
  summary,
  state,
  expanded,
  onExpandedChange,
  children,
}: CampaignEditorStepProps) {
  const bodyId = `${id}-body`;
  const headerId = `${id}-header`;
  return (
    <Box
      id={id}
      component="section"
      aria-labelledby={headerId}
      data-campaign-step={id}
      sx={{
        ...campaignEditorCardSx,
        // Contains the visually hidden step label, so it never adds to the
        // height of the page outside the shell's scroll area.
        position: "relative",
        overflow: "hidden",
        scrollMarginTop: "calc(var(--campaign-editor-header-height, 120px) + 16px)",
      }}
    >
      <Box
        component="button"
        type="button"
        id={headerId}
        aria-expanded={expanded}
        aria-controls={bodyId}
        data-campaign-step-toggle
        onClick={() => onExpandedChange(!expanded)}
        sx={{
          all: "unset",
          boxSizing: "border-box",
          width: "100%",
          minHeight: 64,
          px: { xs: 2, sm: 3 },
          py: 1.75,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          cursor: "pointer",
          color: C.text,
          borderBottom: expanded ? `1px solid ${C.cardBorder}` : "none",
          "&:hover": { bgcolor: "#FAF9F6" },
          "&:focus-visible": {
            outline: `3px solid ${C.primary}`,
            outlineOffset: "-3px",
          },
        }}
      >
        <Box
          component="span"
          aria-hidden
          sx={{
            width: 32,
            height: 32,
            flexShrink: 0,
            borderRadius: "50%",
            border: `1.5px solid ${C.primary}`,
            color: C.primary,
            fontWeight: 700,
            fontSize: 15,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {number}
        </Box>
        <Stack component="span" spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            component="span"
            sx={{ fontSize: 18, fontWeight: 700, color: C.text, lineHeight: 1.3 }}
          >
            <Box component="span" sx={visuallyHidden}>
              {`Step ${number}: `}
            </Box>
            {title}
          </Typography>
          {!expanded && summary ? (
            <Typography
              component="span"
              sx={{
                display: "block",
                fontSize: 14,
                color: C.muted,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {summary}
            </Typography>
          ) : null}
        </Stack>
        <CampaignStepBadge state={state} />
        <Box
          component="span"
          aria-hidden
          sx={{
            display: "inline-flex",
            color: C.muted,
            transform: expanded ? "rotate(180deg)" : "none",
            transition: "transform 0.16s ease",
            "@media (prefers-reduced-motion: reduce)": { transition: "none" },
          }}
        >
          <ChevronDown size={20} />
        </Box>
      </Box>
      <Box
        id={bodyId}
        role="region"
        aria-labelledby={headerId}
        hidden={!expanded}
        sx={{ p: { xs: 2, sm: 3 } }}
      >
        {expanded ? children : null}
      </Box>
    </Box>
  );
}

const visuallyHidden = {
  position: "absolute",
  width: 1,
  height: 1,
  p: 0,
  m: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
} as const;
