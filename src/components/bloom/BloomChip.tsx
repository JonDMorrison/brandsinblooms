import * as React from "react";
import Box from "@mui/joy/Box";
import Tooltip from "@mui/joy/Tooltip";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useBloomReducedMotion } from "@/components/bloom/BloomMotionContext";
import { JoyChip } from "@/components/joy/JoyChip";
import {
  activateCompact,
  type BloomCompactEntityContext,
} from "@/hooks/bloom/useBloomCompactMode";
import type { BloomPageEntityType } from "@/hooks/bloom/types";

export interface BloomChipProps {
  label: string;
  prompt: string;
  entityType?: string;
  entityId?: string;
  autoSend?: boolean;
}

interface BloomChipInnerProps extends BloomChipProps {
  disabled?: boolean;
  disabledTooltip?: string;
}

interface BloomChipBoundaryState {
  hasError: boolean;
}

const entityTypes = new Set<BloomPageEntityType>([
  "campaign",
  "customer",
  "product",
  "segment",
]);

function isBloomPageEntityType(
  value: string | undefined,
): value is BloomPageEntityType {
  return Boolean(value && entityTypes.has(value as BloomPageEntityType));
}

function getEntityContext(
  entityType: string | undefined,
  entityId: string | undefined,
): BloomCompactEntityContext | undefined {
  if (!entityId || !isBloomPageEntityType(entityType)) {
    return undefined;
  }

  return {
    entityId,
    entityType,
  };
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

function BloomChipInner({
  autoSend = true,
  disabled = false,
  disabledTooltip,
  entityId,
  entityType,
  label,
  prompt,
}: BloomChipInnerProps) {
  const trimmedPrompt = prompt.trim();
  const isDisabled = disabled || !trimmedPrompt;

  const handleActivate = React.useCallback(() => {
    if (isDisabled) {
      return;
    }

    activateCompact(trimmedPrompt, getEntityContext(entityType, entityId), {
      autoSend,
    });
  }, [autoSend, entityId, entityType, isDisabled, trimmedPrompt]);

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
