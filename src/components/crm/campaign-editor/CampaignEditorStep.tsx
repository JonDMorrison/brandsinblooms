import * as React from "react";
import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Check, ChevronDown } from "lucide-react";
import {
  campaignEditorCardSx,
  campaignEditorFocusOutline,
} from "@/components/crm/campaign-editor/campaignEditorTheme";

/** What a step header says about the step. */
export type CampaignStepState =
  | { kind: "done" }
  | { kind: "attention"; count: number }
  | { kind: "required" }
  | { kind: "optional" }
  /** A server check for this step has not returned yet. */
  | { kind: "checking"; label: string };

export function CampaignStepBadge({ state }: { state: CampaignStepState }) {
  if (state.kind === "done") {
    return (
      <Typography
        component="span"
        level="body-sm"
        data-testid="campaign-step-badge-done"
        startDecorator={
          <Box
            component="span"
            aria-hidden
            sx={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              bgcolor: "success.solidBg",
              color: "success.solidColor",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Check size={14} strokeWidth={3} />
          </Box>
        }
        sx={{ "--Typography-gap": "4px", color: "success.plainColor", fontWeight: "lg" }}
      >
        Done
      </Typography>
    );
  }

  if (state.kind === "checking") {
    return (
      <Typography
        component="span"
        level="body-sm"
        data-testid="campaign-step-badge-checking"
        sx={{ color: "text.secondary", fontWeight: "md" }}
      >
        {state.label}
      </Typography>
    );
  }

  if (state.kind === "optional") {
    return (
      <Typography
        component="span"
        level="body-sm"
        data-testid="campaign-step-badge-optional"
        sx={{ color: "text.secondary", fontWeight: "md" }}
      >
        Optional
      </Typography>
    );
  }

  const label =
    state.kind === "required"
      ? "Required"
      : `${state.count} ${state.count === 1 ? "issue" : "issues"}`;

  return (
    <Chip
      component="span"
      size="sm"
      variant="soft"
      color="warning"
      data-testid={`campaign-step-badge-${state.kind}`}
      startDecorator={
        state.kind === "attention" ? (
          <Box
            component="span"
            aria-hidden
            sx={{
              minWidth: 20,
              height: 20,
              px: 0.5,
              borderRadius: "xl",
              bgcolor: "warning.solidBg",
              color: "warning.solidColor",
              fontSize: "xs",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {state.count}
          </Box>
        ) : undefined
      }
      sx={{
        "--Chip-gap": "6px",
        border: "1px solid",
        borderColor: "warning.outlinedBorder",
        fontSize: "sm",
        fontWeight: "lg",
        lineHeight: 1.4,
        py: 0.25,
      }}
    >
      {state.kind === "attention" ? `Needs attention: ${label}` : label}
    </Chip>
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
          color: "text.primary",
          borderBottom: expanded ? "1px solid" : "none",
          borderColor: "divider",
          "&:hover": { bgcolor: "background.level2" },
          "&:focus-visible": {
            outline: campaignEditorFocusOutline,
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
            border: "1.5px solid",
            borderColor: "primary.solidBg",
            color: "primary.plainColor",
            fontWeight: "xl",
            fontSize: "sm",
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
            level="title-lg"
            sx={{ fontWeight: "xl", color: "text.primary", lineHeight: 1.3 }}
          >
            <Box component="span" sx={visuallyHidden}>
              {`Step ${number}: `}
            </Box>
            {title}
          </Typography>
          {!expanded && summary ? (
            <Typography
              component="span"
              level="body-sm"
              sx={{
                display: "block",
                color: "text.secondary",
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
            color: "text.secondary",
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
