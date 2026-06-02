import * as React from "react";
import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Brain, ChevronDown, ChevronUp } from "lucide-react";
import { useBloomReducedMotion } from "@/components/bloom/BloomMotionContext";
import { JoyCard } from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";

export interface ThinkingBlockProps {
  content: string;
  isStreaming: boolean;
  defaultExpanded?: boolean;
}

const stepPattern = /\bstep\s+\d+\s*:/gi;

const scrollbarSx = {
  scrollbarWidth: "thin",
  scrollbarColor: "var(--joy-palette-neutral-300) transparent",
  "&::-webkit-scrollbar": { width: 6, height: 6 },
  "&::-webkit-scrollbar-thumb": {
    backgroundColor: "var(--joy-palette-neutral-300)",
    borderRadius: 999,
  },
  "&::-webkit-scrollbar-thumb:hover": {
    backgroundColor: "var(--joy-palette-neutral-400)",
  },
  "&::-webkit-scrollbar-track": { backgroundColor: "transparent" },
} as const;

const formatCharacterCount = (value: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);

const getReasoningSummary = (content: string) => {
  const stepCount = content.match(stepPattern)?.length ?? 0;
  if (stepCount > 0) {
    return `${stepCount} ${stepCount === 1 ? "step" : "steps"}`;
  }

  return `${formatCharacterCount(content.trim().length)} chars`;
};

export function ThinkingBlock({
  content,
  defaultExpanded,
  isStreaming,
}: ThinkingBlockProps) {
  const reducedMotion = useBloomReducedMotion();
  const trimmedContent = content.trim();
  const previousStreamingRef = React.useRef(isStreaming);
  const [expanded, setExpanded] = React.useState(
    defaultExpanded ?? isStreaming,
  );
  const summary = React.useMemo(
    () => getReasoningSummary(trimmedContent),
    [trimmedContent],
  );

  React.useEffect(() => {
    if (isStreaming) {
      setExpanded(true);
    } else if (previousStreamingRef.current) {
      setExpanded(false);
    }

    previousStreamingRef.current = isStreaming;
  }, [isStreaming]);

  if (!trimmedContent) {
    return null;
  }

  return (
    <JoyCard
      variant="plain"
      sx={{
        borderLeft: "3px solid",
        borderColor: "primary.200",
        borderRadius: "var(--joy-radius-md)",
        backgroundColor: "neutral.50",
        p: 1.25,
        boxShadow: "none",
      }}
    >
      <Stack spacing={1}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="space-between"
        >
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            sx={{ minWidth: 0 }}
          >
            <Box
              sx={{
                color: "neutral.500",
                display: "inline-flex",
                flexShrink: 0,
              }}
            >
              <Brain size={15} strokeWidth={1.9} />
            </Box>
            <Typography
              level="title-sm"
              sx={{
                color: "neutral.600",
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              Reasoning
            </Typography>
          </Stack>
          <Stack
            direction="row"
            spacing={0.5}
            alignItems="center"
            sx={{ flexShrink: 0 }}
          >
            {!isStreaming ? (
              <JoyChip color="neutral" size="sm" variant="soft">
                {summary}
              </JoyChip>
            ) : null}
            <IconButton
              aria-label={expanded ? "Collapse reasoning" : "Expand reasoning"}
              color="neutral"
              size="sm"
              variant="plain"
              onClick={() => setExpanded((current) => !current)}
              sx={{ minHeight: 28, width: 28, height: 28 }}
            >
              {expanded ? (
                <ChevronUp size={15} strokeWidth={1.9} />
              ) : (
                <ChevronDown size={15} strokeWidth={1.9} />
              )}
            </IconButton>
          </Stack>
        </Stack>

        <Box
          aria-hidden={!expanded}
          sx={{
            maxHeight: expanded ? 300 : 0,
            opacity: expanded ? 1 : 0,
            overflow: "hidden",
            transition: reducedMotion
              ? "none"
              : "max-height 200ms ease, opacity 160ms ease",
          }}
        >
          <Box
            sx={{
              maxHeight: 300,
              overflowY: "auto",
              pr: 0.5,
              ...scrollbarSx,
            }}
          >
            <Typography
              component="div"
              level="body-xs"
              sx={{
                color: "neutral.500",
                fontFamily: "var(--joy-fontFamily-code)",
                lineHeight: 1.6,
                overflowWrap: "anywhere",
                whiteSpace: "pre-wrap",
              }}
            >
              {content}
              {isStreaming ? (
                <Box
                  aria-hidden="true"
                  component="span"
                  sx={{
                    display: "inline-block",
                    width: 2,
                    height: "1em",
                    ml: 0.25,
                    verticalAlign: "-0.12em",
                    borderRadius: 999,
                    backgroundColor: "primary.500",
                    animation: reducedMotion
                      ? "none"
                      : "bloomThinkingCursor 1s step-end infinite",
                    "@keyframes bloomThinkingCursor": {
                      "0%, 50%": { opacity: 1 },
                      "51%, 100%": { opacity: 0 },
                    },
                  }}
                />
              ) : null}
            </Typography>
          </Box>
        </Box>
      </Stack>
    </JoyCard>
  );
}
