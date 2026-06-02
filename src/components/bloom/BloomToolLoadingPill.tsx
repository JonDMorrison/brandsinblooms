import * as React from "react";
import Box from "@mui/joy/Box";
import Typography from "@mui/joy/Typography";
import type { Theme } from "@mui/joy/styles";
import { Sparkles } from "lucide-react";
import { useBloomReducedMotion } from "@/components/bloom/BloomMotionContext";
import {
  determinePhase,
  getRenderingMessage,
  getStreamingMessage,
} from "@/components/bloom/utils/streamingMessages";
import type { BloomStreamingConnectionState } from "@/hooks/bloom/useBloomStreaming";

export interface BloomToolLoadingPillProps {
  toolName: string;
  description: string;
  isActive: boolean;
}

const shimmerTextSx = (theme: Theme) => {
  const isDark = theme.palette.mode === "dark";
  const base = isDark ? "#86efac" : "#1a3a2a";
  const mid = isDark ? "#4ade80" : "#2d6b4f";
  const highlight = isDark ? "#2d6b4f" : "#4ade80";
  const glow = isDark ? "#bbf7d0" : "#86efac";
  const fallback = isDark ? "#86efac" : "#2d6b4f";
  return {
    background: `linear-gradient(90deg, ${base} 0%, ${base} 30%, ${mid} 40%, ${highlight} 48%, ${glow} 50%, ${highlight} 52%, ${mid} 60%, ${base} 70%, ${base} 100%)`,
    backgroundSize: "200% auto",
    backgroundClip: "text",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    animation: "bloomShimmer 2.5s ease-in-out infinite",
    "@keyframes bloomShimmer": {
      "0%": { backgroundPosition: "-200% center" },
      "100%": { backgroundPosition: "200% center" },
    },
    "@media (prefers-reduced-motion: reduce)": {
      animation: "none",
      background: "none",
      WebkitTextFillColor: fallback,
      backgroundClip: "unset",
      WebkitBackgroundClip: "unset",
      color: fallback,
    },
  };
};

const iconPulseSx = (theme: Theme) => ({
  display: "inline-flex",
  alignItems: "center",
  color: theme.palette.mode === "dark" ? "#86efac" : "#2d6b4f",
  animation: "bloomIconPulse 2s ease-in-out infinite",
  "@keyframes bloomIconPulse": {
    "0%, 100%": { transform: "scale(1)", opacity: 0.8 },
    "50%": { transform: "scale(1.15)", opacity: 1 },
  },
  "@media (prefers-reduced-motion: reduce)": {
    animation: "none",
    opacity: 0.8,
  },
});

export interface BloomStreamingIndicatorProps {
  toolName?: string | null;
  connectionState?: BloomStreamingConnectionState;
  hasPartialText?: boolean;
  /**
   * When `true`, cycle the generic "organizing results" copy. When a string,
   * show that exact message (used by the content gate for tailored loaders).
   */
  overrideMessage?: boolean | string;
}

export function BloomStreamingIndicator({
  toolName,
  connectionState,
  hasPartialText,
  overrideMessage,
}: BloomStreamingIndicatorProps) {
  const reducedMotion = useBloomReducedMotion();
  const [cycleIndex, setCycleIndex] = React.useState(0);

  const phase = React.useMemo(
    () =>
      determinePhase({
        connectionState,
        toolName,
        hasPartialText,
      }),
    [connectionState, toolName, hasPartialText],
  );

  const currentMessage = React.useMemo(() => {
    if (typeof overrideMessage === "string") {
      return overrideMessage;
    }
    if (overrideMessage) {
      return getRenderingMessage(cycleIndex);
    }
    return getStreamingMessage(phase, cycleIndex, toolName);
  }, [overrideMessage, toolName, phase, cycleIndex]);

  const [displayText, setDisplayText] = React.useState(currentMessage);
  const [isTransitioning, setIsTransitioning] = React.useState(false);

  // Restart the message cycle whenever the phase or active tool changes so each
  // new phase reads from its first tailored message rather than mid-rotation.
  React.useEffect(() => {
    setCycleIndex(0);
  }, [phase, toolName]);

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      setCycleIndex((prev) => prev + 1);
    }, 2000);
    return () => window.clearInterval(interval);
  }, []);

  React.useEffect(() => {
    if (currentMessage === displayText) {
      return;
    }
    if (reducedMotion) {
      setDisplayText(currentMessage);
      setIsTransitioning(false);
      return;
    }
    setIsTransitioning(true);
    const timer = window.setTimeout(() => {
      setDisplayText(currentMessage);
      setIsTransitioning(false);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [currentMessage, displayText, reducedMotion]);

  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        py: "14px",
        px: "6px",
        minHeight: "44px",
      }}
    >
      <Box component="span" aria-hidden="true" sx={iconPulseSx}>
        <Sparkles size={16} strokeWidth={2} />
      </Box>
      <Typography
        level="body-sm"
        fontWeight={500}
        sx={[
          shimmerTextSx,
          {
            transition: reducedMotion ? "none" : "opacity 180ms ease",
            opacity: isTransitioning ? 0 : 1,
            letterSpacing: "0.01em",
            lineHeight: 1.5,
          },
        ]}
      >
        {displayText}
      </Typography>
    </Box>
  );
}

export function BloomToolLoadingPill({
  isActive,
  toolName,
}: BloomToolLoadingPillProps) {
  if (!isActive) {
    return null;
  }

  return (
    <BloomStreamingIndicator
      toolName={toolName}
      connectionState="streaming"
      hasPartialText={false}
    />
  );
}
