import React from "react";
import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import Modal from "@mui/joy/Modal";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { X } from "lucide-react";
import { AIImageStudioImageActionButtons } from "./AIImageStudioImageResultCard";
import { Z } from "@/lib/zIndex";
import type { AIImageStudioImageResult, AIImageStudioMessage } from "./types";

interface AIImageStudioPreviewLightboxProps {
  image: AIImageStudioImageResult | null;
  message: AIImageStudioMessage | null;
  onClose: () => void;
  onRegenerate?: (prompt: string) => void;
  onUseImage?: (image: AIImageStudioImageResult) => void | Promise<void>;
  open: boolean;
}

export function AIImageStudioPreviewLightbox({
  image,
  message,
  onClose,
  onRegenerate,
  onUseImage,
  open,
}: AIImageStudioPreviewLightboxProps) {
  const originalPrompt =
    message?.userPrompt ||
    image?.userPrompt ||
    message?.prompt ||
    "AI generated image.";

  return (
    <Modal
      onClose={(_event, _reason) => onClose()}
      open={open}
      slotProps={{
        backdrop: {
          sx: {
            zIndex: Z.studioPreview - 1,
            backgroundColor: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
          },
        },
      }}
      sx={{
        zIndex: Z.studioPreview,
      }}
    >
      <Box
        sx={{
          minHeight: "100vh",
          px: 4,
          py: 4,
          position: "relative",
          zIndex: Z.studioPreview,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: "min(1080px, calc(100vw - 64px))",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            animation: "aiImageStudioPreviewEnter 250ms ease-out both",
            "@keyframes aiImageStudioPreviewEnter": {
              from: {
                opacity: 0,
                transform: "scale(0.95)",
              },
              to: {
                opacity: 1,
                transform: "scale(1)",
              },
            },
          }}
        >
          <Stack
            direction="row"
            justifyContent="flex-end"
            sx={{ width: "100%" }}
          >
            <IconButton
              aria-label="Close preview"
              color="neutral"
              onClick={onClose}
              size="sm"
              sx={{
                color: "common.white",
                borderColor: "rgba(255,255,255,0.22)",
                backgroundColor: "rgba(255,255,255,0.04)",
                "&:hover": {
                  backgroundColor: "rgba(255,255,255,0.08)",
                },
              }}
              variant="plain"
            >
              <X size={18} strokeWidth={2.2} />
            </IconButton>
          </Stack>

          {image ? (
            <Box
              sx={{
                maxWidth: "calc(100vw - 64px)",
                maxHeight: "calc(100vh - 240px)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Box
                component="img"
                alt={originalPrompt}
                src={image.imageUrl}
                sx={{
                  display: "block",
                  width: "auto",
                  maxWidth: "100%",
                  height: "auto",
                  maxHeight: "calc(100vh - 240px)",
                  objectFit: "contain",
                  borderRadius: "12px",
                  boxShadow: "xl",
                }}
              />
            </Box>
          ) : null}

          <Typography
            level="body-sm"
            sx={{
              color: "rgba(255,255,255,0.8)",
              textAlign: "center",
              maxWidth: 720,
              whiteSpace: "pre-wrap",
            }}
          >
            {originalPrompt}
          </Typography>

          {image ? (
            <AIImageStudioImageActionButtons
              generatedAt={message?.timestamp || new Date()}
              image={image}
              onRegenerate={
                originalPrompt
                  ? () => onRegenerate?.(originalPrompt)
                  : undefined
              }
              onUseImage={onUseImage ? () => onUseImage(image) : undefined}
              prompt={originalPrompt}
              tone="dark"
            />
          ) : null}
        </Box>
      </Box>
    </Modal>
  );
}
