import * as React from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import CircularProgress from "@mui/joy/CircularProgress";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import {
  ArrowLeft,
  Check,
  Eye,
  LogOut,
  Monitor,
  Redo2,
  Settings,
  Smartphone,
  Sparkles,
  Tablet,
  Undo2,
  AlertTriangle,
  X,
} from "lucide-react";
import StudioPreviewDialog from "@/components/crm/studio/StudioPreviewDialog";
import type { StudioDeviceMode } from "@/components/crm/studio/studioCanvasTypes";
import type { StudioBlock } from "@/types/studioBlocks";

type StudioTopBarProps = {
  campaignId: string;
  campaignName: string;
  onCampaignNameChange: (name: string) => void;
  campaignStatus: CampaignStatus;
  blockCount: number;
  blocks: StudioBlock[];
  deviceMode: StudioDeviceMode;
  onDeviceModeChange: (mode: StudioDeviceMode) => void;
  subjectLine: string;
  onSubjectLineChange: (value: string) => void;
  previewText: string;
  onPreviewTextChange: (value: string) => void;
  senderName: string;
  onSenderNameChange: (value: string) => void;
  senderEmail: string;
  onSenderEmailChange: (value: string) => void;
  saveStatus: StudioSaveStatus;
  saveMessage: string | null;
  hasUnsavedChanges: boolean;
  externalUpdateMessage: string | null;
  onDismissExternalUpdate: () => void;
  onSave: () => void;
  onExit: () => void;
  lastSavedAt: string | null;
};

type CampaignStatus = "Draft" | "Scheduled" | "Sending" | "Sent";
type StudioSaveStatus =
  | "idle"
  | "saving"
  | "saved"
  | "error"
  | "conflict"
  | "failed";

const STATUS_COLOR: Record<
  CampaignStatus,
  "neutral" | "primary" | "warning" | "success"
> = {
  Draft: "neutral",
  Scheduled: "primary",
  Sending: "warning",
  Sent: "success",
};

const studioDividerSx = {
  width: "1px",
  height: 20,
  bgcolor: "neutral.200",
  mx: 1.5,
  flexShrink: 0,
};

const metadataInputSx = {
  borderRadius: "6px",
  bgcolor: "neutral.50",
  fontSize: "13px",
  "--Input-minHeight": "32px",
  "&:focus-within": {
    bgcolor: "#ffffff",
    outline: "1.5px solid",
    outlineColor: "primary.300",
  },
};

const deviceOptions = [
  { value: "desktop", label: "Desktop preview", icon: Monitor },
  { value: "tablet", label: "Tablet preview", icon: Tablet },
  { value: "mobile", label: "Mobile preview", icon: Smartphone },
] as const;

export default function StudioTopBar({
  campaignId,
  campaignName,
  onCampaignNameChange,
  campaignStatus,
  blockCount,
  blocks,
  deviceMode,
  onDeviceModeChange,
  subjectLine,
  onSubjectLineChange,
  previewText,
  onPreviewTextChange,
  senderName,
  onSenderNameChange,
  senderEmail,
  onSenderEmailChange,
  saveStatus,
  saveMessage,
  hasUnsavedChanges,
  externalUpdateMessage,
  onDismissExternalUpdate,
  onSave,
  onExit,
  lastSavedAt,
}: StudioTopBarProps) {
  const [draftName, setDraftName] = React.useState(campaignName);
  const [isEditingName, setIsEditingName] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);

  React.useEffect(() => {
    setDraftName(campaignName);
  }, [campaignName]);

  const blockCountLabel = blockCount === 1 ? "1 block" : `${blockCount} blocks`;

  const commitName = React.useCallback(() => {
    const nextName = draftName.trim() || "Untitled Campaign";
    onCampaignNameChange(nextName);
    setDraftName(nextName);
    setIsEditingName(false);
  }, [draftName, onCampaignNameChange]);

  const statusTone =
    saveStatus === "conflict"
      ? "warning.600"
      : saveStatus === "error" || saveStatus === "failed"
        ? "danger.600"
        : saveStatus === "saved"
          ? "success.600"
          : "neutral.500";
  const statusLabel =
    saveMessage ||
    (saveStatus === "saving"
      ? "Saving changes..."
      : saveStatus === "saved"
        ? "Saved"
        : saveStatus === "conflict"
          ? "Save conflict"
          : saveStatus === "error" || saveStatus === "failed"
            ? "Save failed"
            : hasUnsavedChanges
              ? "Unsaved changes"
              : lastSavedAt
                ? "Saved"
                : "Ready");

  return (
    <Sheet
      sx={{
        height: 52,
        bgcolor: "background.surface",
        boxShadow: "0 1px 0 0 rgba(0,0,0,0.06)",
        overflowX: "auto",
      }}
    >
      <Box
        sx={{
          height: 52,
          px: 2,
          minWidth: { xs: 980, md: 0 },
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          gap: 2,
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          spacing={1.25}
          sx={{ minWidth: 0 }}
        >
          <IconButton
            variant="plain"
            color="neutral"
            size="sm"
            aria-label="Back to campaign editor"
            onClick={onExit}
            sx={{
              borderRadius: "8px",
              minWidth: 32,
              minHeight: 32,
              "&:hover": { bgcolor: "neutral.100" },
            }}
          >
            <ArrowLeft size={18} />
          </IconButton>

          {isEditingName ? (
            <Input
              size="sm"
              variant="plain"
              autoFocus
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onBlur={commitName}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  commitName();
                }

                if (event.key === "Escape") {
                  setDraftName(campaignName);
                  setIsEditingName(false);
                }
              }}
              sx={{
                maxWidth: 220,
                minWidth: 120,
                borderRadius: "6px",
                bgcolor: "transparent",
                px: 1,
                fontSize: "14px",
                fontWeight: 600,
                "--Input-minHeight": "28px",
                "&:focus-within": {
                  bgcolor: "transparent",
                  outline: "1.5px solid",
                  outlineColor: "primary.300",
                },
              }}
            />
          ) : (
            <Typography
              level="title-sm"
              noWrap
              fontWeight={600}
              sx={{
                maxWidth: 220,
                cursor: "text",
                color: "text.primary",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              onClick={() => setIsEditingName(true)}
            >
              {campaignName}
            </Typography>
          )}

          <Chip
            size="sm"
            variant="soft"
            color={STATUS_COLOR[campaignStatus]}
            sx={{
              fontSize: "11px",
              fontWeight: 600,
              height: 20,
              minHeight: 20,
              px: 1,
              borderRadius: "4px",
              letterSpacing: "0.02em",
              cursor: "default",
              ...(campaignStatus === "Draft"
                ? { color: "neutral.600", bgcolor: "neutral.100" }
                : {}),
              "&:hover": {
                bgcolor: campaignStatus === "Draft" ? "neutral.100" : undefined,
              },
            }}
          >
            {campaignStatus}
          </Chip>

          <IconButton
            variant="plain"
            color="neutral"
            size="sm"
            aria-label="Campaign settings"
            onClick={() => setSettingsOpen(true)}
            sx={{
              borderRadius: "8px",
              minWidth: 30,
              minHeight: 30,
              transition: "transform 300ms ease, background-color 120ms ease",
              "&:hover": {
                bgcolor: "neutral.100",
                transform: "rotate(30deg)",
              },
            }}
          >
            <Settings size={16} />
          </IconButton>

          <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)}>
            <ModalDialog
              sx={{
                width: 360,
                maxWidth: "calc(100vw - 32px)",
                p: 2.5,
                borderRadius: "12px",
                boxShadow: "lg",
              }}
            >
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
              >
                <Typography level="title-sm">Campaign Settings</Typography>
                <IconButton
                  variant="plain"
                  color="neutral"
                  size="sm"
                  aria-label="Close campaign settings"
                  onClick={() => setSettingsOpen(false)}
                  sx={{
                    borderRadius: "6px",
                    "&:hover": { bgcolor: "neutral.100" },
                  }}
                >
                  <X size={16} />
                </IconButton>
              </Stack>
              <Box sx={{ height: "1px", bgcolor: "neutral.100", my: 1.5 }} />
              <Stack spacing={1.5}>
                <Stack spacing={0.5}>
                  <Typography
                    level="body-xs"
                    fontWeight={500}
                    sx={{ color: "neutral.600", fontSize: "12px" }}
                  >
                    Subject Line
                  </Typography>
                  <Input
                    size="sm"
                    variant="soft"
                    value={subjectLine}
                    onChange={(event) =>
                      onSubjectLineChange(event.target.value)
                    }
                    placeholder="Enter subject line..."
                    endDecorator={
                      <IconButton
                        variant="plain"
                        color="neutral"
                        size="sm"
                        aria-label="Generate subject line"
                      >
                        <Sparkles size={14} />
                      </IconButton>
                    }
                    sx={metadataInputSx}
                  />
                  <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                    {subjectLine.length} characters
                  </Typography>
                </Stack>

                <Stack spacing={0.5}>
                  <Typography
                    level="body-xs"
                    fontWeight={500}
                    sx={{ color: "neutral.600", fontSize: "12px" }}
                  >
                    Preview Text
                  </Typography>
                  <Input
                    size="sm"
                    variant="soft"
                    value={previewText}
                    onChange={(event) =>
                      onPreviewTextChange(event.target.value)
                    }
                    placeholder="Enter preview text..."
                    sx={metadataInputSx}
                  />
                  <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                    Shown after subject in inbox
                  </Typography>
                </Stack>

                <Stack spacing={0.5}>
                  <Typography
                    level="body-xs"
                    fontWeight={500}
                    sx={{ color: "neutral.600", fontSize: "12px" }}
                  >
                    Sender Name
                  </Typography>
                  <Input
                    size="sm"
                    variant="soft"
                    value={senderName}
                    onChange={(event) => onSenderNameChange(event.target.value)}
                    sx={metadataInputSx}
                  />
                </Stack>

                <Stack spacing={0.5}>
                  <Typography
                    level="body-xs"
                    fontWeight={500}
                    sx={{ color: "neutral.600", fontSize: "12px" }}
                  >
                    Sender Email
                  </Typography>
                  <Input
                    size="sm"
                    variant="soft"
                    value={senderEmail}
                    onChange={(event) =>
                      onSenderEmailChange(event.target.value)
                    }
                    sx={metadataInputSx}
                  />
                </Stack>
              </Stack>
            </ModalDialog>
          </Modal>
        </Stack>

        <Stack direction="row" alignItems="center" spacing={0}>
          <Sheet
            sx={{
              bgcolor: "neutral.50",
              borderRadius: "8px",
              p: "3px",
              display: "inline-flex",
              gap: "2px",
            }}
          >
            {deviceOptions.map((option) => {
              const Icon = option.icon;
              const selected = deviceMode === option.value;

              return (
                <IconButton
                  key={option.value}
                  variant="plain"
                  color="neutral"
                  size="sm"
                  aria-label={option.label}
                  onClick={() => onDeviceModeChange(option.value)}
                  sx={{
                    width: 28,
                    height: 26,
                    minWidth: 28,
                    minHeight: 26,
                    borderRadius: "6px",
                    bgcolor: selected ? "background.surface" : "transparent",
                    boxShadow: selected ? "sm" : "none",
                    "& svg": { opacity: selected ? 1 : 0.5 },
                    "&:hover": {
                      bgcolor: selected ? "background.surface" : "neutral.100",
                    },
                  }}
                >
                  <Icon size={16} />
                </IconButton>
              );
            })}
          </Sheet>

          <Box sx={studioDividerSx} />

          <Tooltip title="Undo">
            <span>
              <IconButton
                variant="plain"
                color="neutral"
                size="sm"
                disabled
                aria-label="Undo"
                sx={{ opacity: 0.35, "&:hover": { opacity: 1 } }}
              >
                <Undo2 size={16} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Redo">
            <span>
              <IconButton
                variant="plain"
                color="neutral"
                size="sm"
                disabled
                aria-label="Redo"
                sx={{ opacity: 0.35, "&:hover": { opacity: 1 } }}
              >
                <Redo2 size={16} />
              </IconButton>
            </span>
          </Tooltip>

          <Box sx={studioDividerSx} />

          <Typography
            level="body-xs"
            sx={{ color: "neutral.500", fontSize: "12px" }}
          >
            {blockCountLabel}
          </Typography>
        </Stack>

        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          justifyContent="flex-end"
        >
          {externalUpdateMessage ? (
            <Sheet
              variant="soft"
              color="warning"
              sx={{
                px: 1,
                py: 0.5,
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                maxWidth: 260,
              }}
            >
              <AlertTriangle size={14} />
              <Typography
                level="body-xs"
                sx={{
                  color: "warning.700",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {externalUpdateMessage}
              </Typography>
              <IconButton
                variant="plain"
                color="warning"
                size="sm"
                aria-label="Dismiss studio warning"
                onClick={onDismissExternalUpdate}
                sx={{ minWidth: 20, minHeight: 20, borderRadius: "6px" }}
              >
                <X size={12} />
              </IconButton>
            </Sheet>
          ) : null}

          <Button
            variant="outlined"
            color="neutral"
            size="sm"
            startDecorator={<Eye size={16} />}
            onClick={() => setPreviewOpen(true)}
            sx={{
              height: 32,
              minHeight: 32,
              borderColor: "neutral.300",
              borderRadius: "8px",
              fontWeight: 500,
              fontSize: "13px",
              "&:hover": { bgcolor: "neutral.50" },
            }}
          >
            Preview & Test
          </Button>

          <Button
            variant={hasUnsavedChanges ? "solid" : "outlined"}
            color={
              saveStatus === "conflict" ||
              saveStatus === "error" ||
              saveStatus === "failed"
                ? "warning"
                : "primary"
            }
            size="sm"
            onClick={onSave}
            loading={saveStatus === "saving"}
            sx={{
              height: 32,
              minHeight: 32,
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "13px",
            }}
          >
            Save
          </Button>

          <Typography
            level="body-xs"
            sx={{
              color: statusTone,
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              fontSize: "12px",
            }}
          >
            <Box
              component="span"
              sx={{ display: "inline-flex", alignItems: "center" }}
            >
              {saveStatus === "saving" ? (
                <CircularProgress
                  size="sm"
                  thickness={3}
                  sx={{ "--CircularProgress-size": "14px" }}
                />
              ) : saveStatus === "saved" ? (
                <Check size={14} />
              ) : null}
            </Box>
            {statusLabel}
          </Typography>

          <Button
            variant="plain"
            color="neutral"
            size="sm"
            startDecorator={<LogOut size={16} />}
            onClick={onExit}
            sx={{
              fontSize: "13px",
              fontWeight: 500,
              borderRadius: "8px",
              "&:hover": { bgcolor: "neutral.100" },
            }}
          >
            Exit
          </Button>
        </Stack>
      </Box>

      <StudioPreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        blocks={blocks}
        subjectLine={subjectLine}
        previewText={previewText}
        campaignId={campaignId}
      />
    </Sheet>
  );
}
