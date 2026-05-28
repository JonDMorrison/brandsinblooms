import * as React from "react";
import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { BloomAttachmentDisplay } from "@/components/bloom/BloomAttachmentDisplay";
import {
  BloomMessageActions,
  copyBloomMessageText,
  useBloomMessageActionsVisibility,
} from "@/components/bloom/BloomMessageActions";
import { BloomUserMessageEdit } from "@/components/bloom/BloomUserMessageEdit";
import type { BloomMessage } from "@/hooks/bloom/types";

interface BloomUserMessageProps {
  message: BloomMessage;
  isEditing: boolean;
  isStreaming: boolean;
  onEdit: (message: BloomMessage) => void;
  onEditCancel: () => void;
  onEditSave: (message: BloomMessage, newText: string) => Promise<void>;
}

const formatMessageTime = (createdAt: string) =>
  new Date(createdAt).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

export function BloomUserMessage({
  isEditing,
  isStreaming,
  message,
  onEdit,
  onEditCancel,
  onEditSave,
}: BloomUserMessageProps) {
  const actionVisibility = useBloomMessageActionsVisibility();
  const messageWidthSx = isEditing
    ? { xs: "100%", md: "70%" }
    : { xs: "90%", md: "75%" };

  return (
    <Box
      id={message.id}
      ref={actionVisibility.rootRef}
      onPointerCancel={actionVisibility.handlePointerCancel}
      onPointerDown={actionVisibility.handlePointerDown}
      onPointerLeave={actionVisibility.handlePointerLeave}
      onPointerUp={actionVisibility.handlePointerUp}
      sx={{
        position: "relative",
        display: "flex",
        justifyContent: "flex-end",
        mb: 2.5,
        scrollMarginBlock: 96,
        "@media (hover: hover)": {
          "&:hover [data-bloom-message-actions='true'], &:focus-within [data-bloom-message-actions='true']":
            {
              opacity: 1,
              pointerEvents: "auto",
            },
          "&:hover [data-bloom-message-time='true'], &:focus-within [data-bloom-message-time='true']":
            {
              opacity: 1,
            },
        },
      }}
    >
      <Stack
        spacing={0.75}
        alignItems="flex-end"
        sx={{ width: messageWidthSx, maxWidth: messageWidthSx, minWidth: 0 }}
      >
        {isEditing ? (
          <BloomUserMessageEdit
            message={message}
            onCancel={onEditCancel}
            onSave={(newText) => onEditSave(message, newText)}
          />
        ) : (
          <Sheet
            color="neutral"
            variant="soft"
            sx={{
              px: 2,
              py: 1.25,
              borderRadius: "16px 16px 4px 16px",
              backgroundColor: "var(--joy-palette-brandNavy-700)",
              color: "common.white",
              boxShadow: "none",
            }}
          >
            <Stack spacing={1} sx={{ minWidth: 0 }}>
              <Typography
                level="body-md"
                sx={{
                  color: "common.white",
                  fontSize: "16px",
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                }}
              >
                {message.text}
              </Typography>
              <BloomAttachmentDisplay attachments={message.attachments} />
            </Stack>
          </Sheet>
        )}
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          justifyContent="flex-end"
          sx={{ minHeight: 30, px: 0.5 }}
        >
          <Typography
            data-bloom-message-time="true"
            level="body-xs"
            color="neutral"
            sx={{
              opacity: actionVisibility.forceVisible ? 1 : 0,
              transition: "opacity 100ms ease",
            }}
          >
            {formatMessageTime(message.createdAt)}
          </Typography>
          {!isEditing ? (
            <BloomMessageActions
              forceVisible={actionVisibility.forceVisible}
              isLatestAssistant={false}
              isStreaming={isStreaming}
              message={message}
              onBookmark={() => undefined}
              onCopy={() => {
                void copyBloomMessageText(message.text);
              }}
              onEdit={() => onEdit(message)}
              onFeedback={() => undefined}
              onRegenerate={() => undefined}
            />
          ) : null}
        </Stack>
      </Stack>
    </Box>
  );
}
