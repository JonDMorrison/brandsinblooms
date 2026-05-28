import * as React from "react";
import Stack from "@mui/joy/Stack";
import { AnimatePresence, motion } from "framer-motion";
import { useBloomReducedMotion } from "@/components/bloom/BloomMotionContext";
import { JoyChip } from "@/components/joy/JoyChip";

interface BloomFollowUpChipsProps {
  chips: string[];
  isLatestMessage: boolean;
  isStreaming: boolean;
  onChipClick: (text: string) => void;
}

const visibleChipCount = 4;
const chipExitDelayMs = 150;

export function BloomFollowUpChips({
  chips,
  isLatestMessage,
  isStreaming,
  onChipClick,
}: BloomFollowUpChipsProps) {
  const reducedMotion = useBloomReducedMotion();
  const [isDismissing, setIsDismissing] = React.useState(false);
  const dismissTimeoutRef = React.useRef<number | null>(null);
  const visible =
    isLatestMessage && !isStreaming && chips.length > 0 && !isDismissing;
  const visibleChips = chips.slice(0, visibleChipCount);

  React.useEffect(() => {
    setIsDismissing(false);
  }, [chips, isLatestMessage]);

  React.useEffect(
    () => () => {
      if (typeof window !== "undefined" && dismissTimeoutRef.current !== null) {
        window.clearTimeout(dismissTimeoutRef.current);
      }
    },
    [],
  );

  const handleChipClick = (chipText: string) => {
    setIsDismissing(true);

    if (reducedMotion || typeof window === "undefined") {
      onChipClick(chipText);
      return;
    }

    if (dismissTimeoutRef.current !== null) {
      window.clearTimeout(dismissTimeoutRef.current);
    }

    dismissTimeoutRef.current = window.setTimeout(() => {
      dismissTimeoutRef.current = null;
      onChipClick(chipText);
    }, chipExitDelayMs);
  };

  if (!visible) {
    return null;
  }

  if (reducedMotion) {
    return (
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
        {visibleChips.map((chipText) => (
          <JoyChip
            key={chipText}
            role="button"
            tabIndex={0}
            color="primary"
            size="sm"
            variant="outlined"
            onClick={() => handleChipClick(chipText)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") {
                return;
              }

              event.preventDefault();
              handleChipClick(chipText);
            }}
            sx={{
              cursor: "pointer",
              backgroundColor: "background.surface",
              transition: "none",
              "&:hover": { backgroundColor: "primary.50" },
              "&:active": { backgroundColor: "primary.100" },
              "&:focus-visible": {
                outline: 0,
                boxShadow:
                  "0 0 0 2px rgba(var(--joy-palette-primary-mainChannel) / 0.2)",
              },
            }}
          >
            {chipText}
          </JoyChip>
        ))}
      </Stack>
    );
  }

  return (
    <AnimatePresence initial={false}>
      <motion.div
        key="bloom-follow-up-chips"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        style={{ maxWidth: "100%" }}
      >
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
          {visibleChips.map((chipText, index) => (
            <motion.div
              key={chipText}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.18 }}
              style={{ maxWidth: "100%" }}
            >
              <JoyChip
                role="button"
                tabIndex={0}
                color="primary"
                size="sm"
                variant="outlined"
                onClick={() => handleChipClick(chipText)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") {
                    return;
                  }

                  event.preventDefault();
                  handleChipClick(chipText);
                }}
                sx={{
                  cursor: "pointer",
                  backgroundColor: "background.surface",
                  transition:
                    "background-color 150ms ease, border-color 150ms ease, color 150ms ease",
                  "&:hover": { backgroundColor: "primary.50" },
                  "&:active": { backgroundColor: "primary.100" },
                  "&:focus-visible": {
                    outline: 0,
                    boxShadow:
                      "0 0 0 2px rgba(var(--joy-palette-primary-mainChannel) / 0.2)",
                  },
                }}
              >
                {chipText}
              </JoyChip>
            </motion.div>
          ))}
        </Stack>
      </motion.div>
    </AnimatePresence>
  );
}
