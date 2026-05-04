import React from "react";
import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import IconButton from "@mui/joy/IconButton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Sparkles, X } from "lucide-react";

interface AIImageStudioHeaderProps {
  titleId: string;
  onClose: () => void;
  closeButtonRef: React.RefObject<HTMLButtonElement | null>;
  paddingX: number;
  subtitle?: string;
  children?: React.ReactNode;
}

export function AIImageStudioHeader({
  titleId,
  onClose,
  closeButtonRef,
  paddingX,
  subtitle,
  children,
}: AIImageStudioHeaderProps) {
  return (
    <Box
      component="header"
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 1,
        px: paddingX,
        pt: 2,
        pb: 1.5,
        backgroundColor: "background.surface",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
      }}
    >
      <Stack direction="row" alignItems="flex-start" spacing={2}>
        <Stack
          direction="row"
          spacing={1.25}
          alignItems="flex-start"
          sx={{ minWidth: 0, flex: 1 }}
        >
          <Box
            aria-hidden="true"
            sx={{
              color: "primary.500",
              display: "inline-flex",
              mt: 0.125,
              flexShrink: 0,
            }}
          >
            <Sparkles size={20} strokeWidth={1.9} />
          </Box>

          <Stack spacing={0.375} sx={{ minWidth: 0, flex: 1 }}>
            <Typography id={titleId} level="title-md" fontWeight="lg">
              AI Image Studio
            </Typography>
            <Typography
              level="body-sm"
              textColor="text.tertiary"
              noWrap
              sx={{ minWidth: 0 }}
            >
              {subtitle || "Describe your vision - I'll bring it to life"}
            </Typography>
          </Stack>
        </Stack>

        <IconButton
          ref={closeButtonRef}
          aria-label="Close AI Image Studio"
          color="neutral"
          onClick={onClose}
          size="sm"
          variant="plain"
          sx={{
            width: 44,
            height: 44,
            flexShrink: 0,
            borderRadius: "999px",
            "&:focus-visible": {
              outline:
                "2px solid rgba(var(--joy-palette-primary-mainChannel) / 0.32)",
              outlineOffset: 2,
              backgroundColor:
                "rgba(var(--joy-palette-primary-mainChannel) / 0.06)",
            },
          }}
        >
          <X size={18} strokeWidth={1.9} />
        </IconButton>
      </Stack>

      <Divider sx={{ mt: 1.5, opacity: 0.5 }} />

      {children ? <Box sx={{ pt: 1.5 }}>{children}</Box> : null}
    </Box>
  );
}
