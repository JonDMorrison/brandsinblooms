import * as React from "react";
import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Check, ChevronDown } from "lucide-react";
import { mergeSx } from "@/components/joy/mergeSx";
import {
  campaignEditorCardPadding,
  campaignEditorCardSx,
  campaignEditorFocusOutline,
  campaignEditorVisuallyHidden,
} from "@/components/crm/campaign-editor/campaignEditorTheme";

/** What a step header says about the step. */
export type CampaignStepState =
  /** label replaces "Done", e.g. "In 2 groups". */
  | { kind: "done"; label?: string }
  | { kind: "attention"; count: number }
  | { kind: "required" }
  | { kind: "optional" }
  /** A server check for this step has not returned yet. */
  | { kind: "checking"; label: string };

const badgeSx = {
  "--Chip-gap": "6px",
  "--Chip-minHeight": "28px",
  px: 1.5,
  fontSize: "sm",
  fontWeight: "lg",
  lineHeight: 1.4,
  whiteSpace: "nowrap",
  flexShrink: 0,
} as const;

/**
 * The status badge on the right of a step header: success soft with a check
 * when done, primary (navy) soft with the number of things to fix, warning
 * soft for Required, neutral soft for
 * Optional and while a server check is still running.
 */
export function CampaignStepBadge({ state }: { state: CampaignStepState }) {
  if (state.kind === "done") {
    return (
      <Chip
        component="span"
        size="sm"
        variant="soft"
        color="success"
        data-testid="campaign-step-badge-done"
        startDecorator={<Check size={14} strokeWidth={3} aria-hidden />}
        sx={badgeSx}
      >
        {state.label ?? "Done"}
      </Chip>
    );
  }

  if (state.kind === "checking" || state.kind === "optional") {
    return (
      <Chip
        component="span"
        size="sm"
        variant="soft"
        color="neutral"
        data-testid={`campaign-step-badge-${state.kind}`}
        sx={mergeSx(badgeSx, { color: "text.secondary" })}
      >
        {state.kind === "checking" ? state.label : "Optional"}
      </Chip>
    );
  }

  if (state.kind === "required") {
    return (
      <Chip
        component="span"
        size="sm"
        variant="soft"
        color="warning"
        data-testid="campaign-step-badge-required"
        sx={badgeSx}
      >
        Required
      </Chip>
    );
  }

  const issues = `${state.count} ${state.count === 1 ? "issue" : "issues"}`;
  return (
    <Chip
      component="span"
      size="sm"
      variant="soft"
      color="primary"
      data-testid="campaign-step-badge-attention"
      startDecorator={
        <Box
          component="span"
          aria-hidden
          data-testid="campaign-step-badge-count"
          sx={{
            minWidth: 20,
            height: 20,
            px: 1,
            borderRadius: "xl",
            bgcolor: "primary.solidBg",
            color: "primary.solidColor",
            fontSize: "xs",
            fontWeight: "xl",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {state.count}
        </Box>
      }
      sx={mergeSx(badgeSx, { color: "text.primary" })}
    >
      {/* Phones show only the number; the words stay for screen readers. */}
      <Box component="span" aria-hidden sx={{ display: { xs: "none", sm: "inline" } }}>
        Needs attention
      </Box>
      <Box component="span" sx={campaignEditorVisuallyHidden}>
        {`Needs attention: ${issues}`}
      </Box>
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
        // height of the page outside the shell's scroll area. "clip", not
        // "hidden": a hidden box is still a scroll container, so focusing or
        // scrolling to a wide child shifted the card's content sideways and
        // cut off its left edge ("paign type" in Organize).
        position: "relative",
        overflow: "clip",
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
          // One header height for every step, open or closed. The summary
          // is a single truncated line, so title and summary fit in 64px.
          height: 64,
          px: campaignEditorCardPadding,
          display: "flex",
          alignItems: "center",
          gap: { xs: 2, sm: 4 },
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
            bgcolor: "primary.softBg",
            color: "primary.softColor",
            fontWeight: "xl",
            fontSize: "sm",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {number}
        </Box>
        <Stack component="span" spacing={0} sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            component="span"
            level="title-lg"
            noWrap
            sx={{ display: "block", fontWeight: "xl", color: "text.primary", lineHeight: 1.3 }}
          >
            <Box component="span" sx={campaignEditorVisuallyHidden}>
              {`Step ${number}: `}
            </Box>
            {title}
          </Typography>
          {!expanded && summary ? (
            <Typography
              component="span"
              level="body-sm"
              data-testid="campaign-step-summary"
              sx={{
                display: "block",
                color: "text.tertiary",
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
        sx={{ p: campaignEditorCardPadding, minWidth: 0 }}
      >
        {expanded ? children : null}
      </Box>
    </Box>
  );
}
