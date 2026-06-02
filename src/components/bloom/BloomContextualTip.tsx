import * as React from "react";
import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { motion } from "framer-motion";
import { Lightbulb, X } from "lucide-react";
import { useBloomReducedMotion } from "@/components/bloom/BloomMotionContext";
import type { BloomOnboardingTipId } from "@/hooks/bloom/types";

interface BloomContextualTipProps {
  tipId: BloomOnboardingTipId;
  text: string;
  onDismiss: (tipId: BloomOnboardingTipId) => void;
}

export function BloomContextualTip({
  tipId,
  text,
  onDismiss,
}: BloomContextualTipProps) {
  const reducedMotion = useBloomReducedMotion();
  const dismiss = React.useCallback(() => {
    onDismiss(tipId);
  }, [onDismiss, tipId]);

  const content = (
    <Box
      sx={{
        display: "flex",
        justifyContent: "flex-start",
        pl: { xs: 0, sm: 5.5 },
        pr: { xs: 0, md: 5 },
        mb: 3,
      }}
    >
      <Sheet
        role="note"
        tabIndex={0}
        variant="soft"
        color="neutral"
        onKeyDown={(event) => {
          if (event.key !== "Escape") {
            return;
          }

          event.preventDefault();
          dismiss();
        }}
        sx={{
          width: "100%",
          px: 1.5,
          py: 1.25,
          borderRadius: "var(--joy-radius-md)",
          border: "1px solid",
          borderColor: "neutral.200",
          backgroundColor: "background.level1",
          boxShadow: "none",
          "&:focus-visible": {
            outline: 0,
            boxShadow:
              "0 0 0 2px rgba(var(--joy-palette-primary-mainChannel) / 0.18)",
          },
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          alignItems="flex-start"
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <Box
              aria-hidden="true"
              sx={{
                display: "inline-flex",
                color: "neutral.600",
                flexShrink: 0,
                pt: 0.125,
              }}
            >
              <Lightbulb size={14} strokeWidth={1.9} />
            </Box>
            <Typography
              level="body-xs"
              sx={{ color: "neutral.700", lineHeight: 1.55 }}
            >
              {text}
            </Typography>
          </Stack>

          <IconButton
            aria-label="Dismiss tip"
            color="neutral"
            size="sm"
            variant="plain"
            onClick={dismiss}
            sx={{
              mt: -0.25,
              mr: -0.5,
              flexShrink: 0,
              color: "neutral.500",
            }}
          >
            <X size={14} strokeWidth={1.9} />
          </IconButton>
        </Stack>
      </Sheet>
    </Box>
  );

  if (reducedMotion) {
    return <Box sx={{ width: "100%" }}>{content}</Box>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      style={{ width: "100%" }}
    >
      {content}
    </motion.div>
  );
}
