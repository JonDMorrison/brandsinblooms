import * as React from "react";
import Box from "@mui/joy/Box";
import Tooltip from "@mui/joy/Tooltip";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useBloomReducedMotion } from "@/components/bloom/BloomMotionContext";
import { useNavigate } from "react-router-dom";
import { JoyChip } from "@/components/joy/JoyChip";
import { useOptionalAskBloom } from "@/providers/AskBloomProvider";

export interface BloomChipProps {
  label: string;
  prompt: string;
}

interface BloomChipInnerProps extends BloomChipProps {
  disabled?: boolean;
  disabledTooltip?: string;
}

interface BloomChipBoundaryState {
  hasError: boolean;
}

function BloomChipTrigger({
  disabled = false,
  disabledTooltip,
  label,
  onActivate,
}: {
  disabled?: boolean;
  disabledTooltip?: string;
  label: string;
  onActivate?: () => void;
}) {
  const reducedMotion = useBloomReducedMotion();
  const chip = (
    <JoyChip
      color="primary"
      disabled={disabled}
      role={disabled ? undefined : "button"}
      size="sm"
      startDecorator={<Sparkles size={14} strokeWidth={1.9} />}
      tabIndex={disabled ? -1 : 0}
      variant="outlined"
      onClick={disabled ? undefined : onActivate}
      onKeyDown={(event) => {
        if (disabled || (event.key !== "Enter" && event.key !== " ")) {
          return;
        }

        event.preventDefault();
        onActivate?.();
      }}
      sx={{
        backgroundColor: "background.surface",
        cursor: disabled ? "not-allowed" : "pointer",
        maxWidth: "100%",
        opacity: disabled ? 0.6 : 1,
        transition: reducedMotion
          ? "none"
          : "background-color 150ms ease, border-color 150ms ease, color 150ms ease",
        "&:hover": disabled ? undefined : { backgroundColor: "primary.50" },
        "&:active": disabled ? undefined : { backgroundColor: "primary.100" },
        "&:focus-visible": {
          outline: 0,
          boxShadow: "0 0 0 2px var(--joy-palette-focusVisible)",
        },
      }}
    >
      {label}
    </JoyChip>
  );

  const content = reducedMotion ? (
    <Box component="span" sx={{ display: "inline-flex", maxWidth: "100%" }}>
      {chip}
    </Box>
  ) : (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5, duration: 0.18, ease: "easeOut" }}
      style={{ display: "inline-flex", maxWidth: "100%" }}
    >
      {chip}
    </motion.div>
  );

  if (!disabledTooltip) {
    return content;
  }

  return (
    <Tooltip title={disabledTooltip} variant="solid">
      <Box component="span" sx={{ display: "inline-flex", maxWidth: "100%" }}>
        {content}
      </Box>
    </Tooltip>
  );
}

/**
 * Starts Bloom with a prompt. In the tenant shell that is the Ask Bloom drawer,
 * which carries the page's context and asks the prompt only once the user,
 * organization and session token are loaded. Outside it (no drawer), the full
 * Bloom page opens with the prompt prefilled, never auto-sent.
 */
function BloomChipInner({
  disabled = false,
  disabledTooltip,
  label,
  prompt,
}: BloomChipInnerProps) {
  const askBloom = useOptionalAskBloom();
  const navigate = useNavigate();
  const trimmedPrompt = prompt.trim();
  const isDisabled = disabled || !trimmedPrompt;

  const handleActivate = React.useCallback(() => {
    if (isDisabled) {
      return;
    }

    if (askBloom) {
      askBloom.openWithPrompt(trimmedPrompt);
      return;
    }

    navigate(`/bloom?prompt=${encodeURIComponent(trimmedPrompt)}`);
  }, [askBloom, isDisabled, navigate, trimmedPrompt]);

  return (
    <BloomChipTrigger
      disabled={isDisabled}
      disabledTooltip={disabledTooltip}
      label={label}
      onActivate={handleActivate}
    />
  );
}

class BloomChipUnavailableBoundary extends React.Component<
  BloomChipProps,
  BloomChipBoundaryState
> {
  state: BloomChipBoundaryState = { hasError: false };

  static getDerivedStateFromError(): BloomChipBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <BloomChipTrigger
          disabled
          disabledTooltip="Bloom is loading..."
          label={this.props.label}
        />
      );
    }

    return <BloomChipInner {...this.props} />;
  }
}

export function BloomChip(props: BloomChipProps) {
  return <BloomChipUnavailableBoundary {...props} />;
}

export default BloomChip;
