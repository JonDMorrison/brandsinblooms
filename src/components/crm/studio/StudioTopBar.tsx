import NewsletterSettingsButton from "./newsletter/NewsletterSettingsButton";
import * as React from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import Dropdown from "@mui/joy/Dropdown";
import Menu from "@mui/joy/Menu";
import MenuButton from "@mui/joy/MenuButton";
import MenuItem from "@mui/joy/MenuItem";
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
  ArrowRight,
  Check,
  Eye,
  Info,
  Monitor,
  Redo2,
  RefreshCw,
  Settings,
  Smartphone,
  Sparkles,
  Tablet,
  Undo2,
  AlertTriangle,
  BookmarkPlus,
  MoreHorizontal,
  SlidersHorizontal,
  X,
} from "lucide-react";
import StudioPreviewDialog from "@/components/crm/studio/StudioPreviewDialog";
import type { StudioDeviceMode } from "@/components/crm/studio/studioCanvasTypes";
import type { StudioBlock } from "@/types/studioBlocks";
import type { CampaignChangeClassification } from "@/lib/crm/campaignChangeClassifier";

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
  externalUpdateNotice: CampaignChangeClassification | null;
  onDismissExternalUpdate: () => void;
  onReloadCampaign: () => void;
  onSave: () => void;
  onSaveAsTemplate: () => void;
  onExit: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  lastSavedAt: string | null;
};

type CampaignStatus = "Draft" | "Scheduled" | "Sending" | "Sent";
type StudioSaveStatus =
  "idle" | "saving" | "saved" | "error" | "conflict" | "failed";

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

/** Below this width secondary actions move into the "More" menu. */
const WIDE_TOOLBAR_QUERY = "@media (min-width: 1280px)";
const NARROW_TOOLBAR_QUERY = "@media (max-width: 1279.98px)";
const wideOnlySx = { [NARROW_TOOLBAR_QUERY]: { display: "none" } };
const narrowOnlySx = { [WIDE_TOOLBAR_QUERY]: { display: "none" } };
/** 1280–1439px: same controls, shorter labels, so the row still fits. */
const COMPACT_TOOLBAR_QUERY = "@media (max-width: 1439.98px)";
const fullLabelSx = { [COMPACT_TOOLBAR_QUERY]: { display: "none" } };
const compactLabelSx = { display: "none", [COMPACT_TOOLBAR_QUERY]: { display: "inline" } };

/** One save state, always the same width so nothing beside it moves. */
function getStudioSaveState(
  saveStatus: StudioSaveStatus,
  hasUnsavedChanges: boolean,
): { label: string; tone: "neutral" | "success" | "warning" | "danger"; kind: "saving" | "saved" | "unsaved" | "error" | "conflict" } {
  if (saveStatus === "saving") return { label: "Saving…", tone: "neutral", kind: "saving" };
  if (saveStatus === "conflict") return { label: "Save conflict", tone: "warning", kind: "conflict" };
  if (saveStatus === "error" || saveStatus === "failed") return { label: "Couldn’t save", tone: "danger", kind: "error" };
  if (hasUnsavedChanges) return { label: "Unsaved changes", tone: "neutral", kind: "unsaved" };
  return { label: "Saved", tone: "success", kind: "saved" };
}

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
  externalUpdateNotice,
  onDismissExternalUpdate,
  onReloadCampaign,
  onSave,
  onSaveAsTemplate,
  onExit,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  lastSavedAt,
}: StudioTopBarProps) {
  const [draftName, setDraftName] = React.useState(campaignName);
  const [isEditingName, setIsEditingName] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [designOpen, setDesignOpen] = React.useState(false);

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

  const saveState = getStudioSaveState(saveStatus, hasUnsavedChanges);
  const statusLabel =
    saveState.kind === "saved" && !lastSavedAt && saveMessage
      ? saveMessage
      : saveState.label;
  const canRetrySave = saveState.kind === "error" || saveState.kind === "conflict";

  const savedDate = lastSavedAt ? new Date(lastSavedAt) : null;
  const savedAtLabel =
    savedDate && !Number.isNaN(savedDate.getTime())
      ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(savedDate)
      : "Not saved yet";

  return (
    <Sheet
      data-testid="studio-top-bar"
      sx={{
        position: "relative",
        height: 52,
        bgcolor: "#d9e0e2",
        color: "#203137",
        boxShadow: "0 1px 0 0 rgba(0,0,0,0.06)",
        overflow: "visible",
      }}
    >
      {/* One row, never wrapping: everything fits in 52px at 1280px and up,
          and secondary actions move into "More" below that. */}
      <Box
        data-testid="studio-top-bar-row"
        sx={{
          height: 52,
          px: 1.5,
          minWidth: 0,
          display: "flex",
          flexWrap: "nowrap",
          alignItems: "center",
          gap: 1,
          overflow: "hidden",
          whiteSpace: "nowrap",
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.75}
          sx={{ minWidth: 0, flex: "1 1 auto", overflow: "hidden" }}
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
                minWidth: 96,
                flexShrink: 1,
                cursor: "text",
                color: "text.primary",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              title={campaignName}
              data-campaign-name
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

          {/* The subject line decides whether an email gets opened, so it is
              a labelled button and not a bare gear icon. */}
          <Button
            variant="outlined"
            color="neutral"
            size="sm"
            aria-label="Campaign settings"
            title="Subject line, preview text and sender"
            startDecorator={<Settings size={16} />}
            onClick={() => setSettingsOpen(true)}
            sx={{
              borderRadius: "8px",
              minHeight: 30,
              whiteSpace: "nowrap",
              flexShrink: 0,
              fontWeight: 600,
            }}
          >
            Subject line
          </Button>

          <Button
            size="sm"
            variant="outlined"
            color="neutral"
            startDecorator={<SlidersHorizontal size={15} />}
            onClick={() => setDesignOpen(true)}
            aria-label="Design & spacing"
            title="Design & spacing"
            sx={{ whiteSpace: "nowrap", flexShrink: 0, borderRadius: "8px", minHeight: 30, ...wideOnlySx }}
          >
            <Box component="span" sx={fullLabelSx}>Design & spacing</Box>
            <Box component="span" sx={compactLabelSx}>Design</Box>
          </Button>
          <NewsletterSettingsButton
            hideTrigger
            open={designOpen}
            onOpenChange={setDesignOpen}
          />
          <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)}>
            <ModalDialog
              sx={{
                width: 500,
                maxWidth: "calc(100vw - 32px)",
                maxHeight: "calc(100vh - 32px)",
                overflowY: "auto",
                p: { xs: 2, sm: 3 },
                borderRadius: "14px",
                boxShadow: "lg",
              }}
            >
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
              >
                <Stack spacing={0.25}>
                  <Typography level="title-md">Subject line and sender</Typography>
                  <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                    This is what customers see in their inbox before they open your email.
                  </Typography>
                </Stack>
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
                <Sheet variant="soft" color="neutral" sx={{ p: 1.5, borderRadius: "md" }}>
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                    <Stack spacing={0.25}>
                      <Typography level="body-xs" sx={{ color: "neutral.500" }}>Campaign status</Typography>
                      <Chip variant="outlined" color={STATUS_COLOR[campaignStatus]} size="sm">
                        {campaignStatus}
                      </Chip>
                    </Stack>
                    <Stack spacing={0.25} alignItems="flex-end">
                      <Typography level="body-xs" sx={{ color: "neutral.500" }}>Last saved</Typography>
                      <Typography level="body-sm" fontWeight="md">{savedAtLabel}</Typography>
                      {hasUnsavedChanges ? (
                        <Typography level="body-xs" sx={{ color: "neutral.600" }}>Unsaved changes</Typography>
                      ) : null}
                    </Stack>
                  </Stack>
                </Sheet>
                <Typography level="title-sm">Inbox details</Typography>
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
                    {/\{\{\s*first_name\s*\}\}/.test(subjectLine)
                      ? " · {{ first_name }} becomes each customer's first name"
                      : ""}
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

                <Box sx={{ height: "1px", bgcolor: "neutral.100", my: 0.5 }} />
                <Typography level="title-sm">Sender details</Typography>
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
                    placeholder="The email address your customers will see"
                    sx={metadataInputSx}
                  />
                </Stack>
                <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                  <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                    Click Save changes when you are done.
                  </Typography>
                  <Button
                    color="primary"
                    variant={hasUnsavedChanges ? "solid" : "outlined"}
                    size="sm"
                    loading={saveStatus === "saving"}
                    onClick={onSave}
                    disabled={!hasUnsavedChanges || saveStatus === "saving"}
                  >
                    Save changes
                  </Button>
                </Stack>
              </Stack>
            </ModalDialog>
          </Modal>
        </Stack>

        <Stack direction="row" alignItems="center" spacing={0} sx={{ flexShrink: 0 }}>
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
                  title={option.label}
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

          <Tooltip title="Undo (Ctrl/⌘ Z)">
            <span>
              <IconButton
                variant="plain"
                color="neutral"
                size="sm"
                disabled={!canUndo}
                aria-label="Undo"
                onClick={onUndo}
                sx={{ opacity: canUndo ? 1 : 0.35 }}
              >
                <Undo2 size={16} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Redo (Ctrl/⌘ Shift Z)">
            <span>
              <IconButton
                variant="plain"
                color="neutral"
                size="sm"
                disabled={!canRedo}
                aria-label="Redo"
                onClick={onRedo}
                sx={{ opacity: canRedo ? 1 : 0.35 }}
              >
                <Redo2 size={16} />
              </IconButton>
            </span>
          </Tooltip>

          <Box sx={{ ...studioDividerSx, ...wideOnlySx }} />

          <Typography
            level="body-xs"
            sx={{ color: "neutral.500", fontSize: "12px", ...wideOnlySx }}
          >
            {blockCountLabel}
          </Typography>
        </Stack>

        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          justifyContent="flex-end"
          sx={{ flexShrink: 0 }}
        >
          {externalUpdateNotice
            ? (() => {
                const isInfo = externalUpdateNotice.severity === "info";
                const color = isInfo ? "primary" : "warning";
                const textColor = isInfo ? "primary.700" : "warning.700";
                const Icon = isInfo ? Info : AlertTriangle;
                const reloadLabel = externalUpdateNotice.localChangesAtRisk
                  ? "Reload anyway"
                  : "Reload";
                return (
                  <Sheet
                    variant="soft"
                    color={color}
                    sx={{
                      // Floats under the bar so it never pushes or clips the row.
                      position: "absolute",
                      top: 56,
                      right: 16,
                      zIndex: 20,
                      boxShadow: "md",
                      whiteSpace: "normal",
                      px: 1.25,
                      py: 0.75,
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      maxWidth: 480,
                    }}
                    role={isInfo ? "status" : "alert"}
                  >
                    <Icon size={14} />
                    <Stack
                      spacing={0.25}
                      sx={{
                        minWidth: 0,
                        flex: "1 1 auto",
                      }}
                    >
                      <Typography
                        level="body-xs"
                        sx={{
                          color: textColor,
                          fontWeight: 600,
                          whiteSpace: "normal",
                          lineHeight: 1.3,
                        }}
                      >
                        {externalUpdateNotice.message}
                      </Typography>
                      <Typography
                        level="body-xs"
                        sx={{
                          color: textColor,
                          opacity: 0.8,
                          whiteSpace: "normal",
                          lineHeight: 1.35,
                        }}
                      >
                        {externalUpdateNotice.detail}
                      </Typography>
                    </Stack>
                    <Button
                      variant="soft"
                      color={color}
                      size="sm"
                      startDecorator={<RefreshCw size={12} />}
                      onClick={onReloadCampaign}
                      sx={{
                        height: 26,
                        minHeight: 26,
                        fontSize: "12px",
                        px: 1,
                        flexShrink: 0,
                      }}
                    >
                      {reloadLabel}
                    </Button>
                    {externalUpdateNotice.localChangesAtRisk ? (
                      <Button
                        variant="plain"
                        color="neutral"
                        size="sm"
                        onClick={onDismissExternalUpdate}
                        sx={{
                          height: 26,
                          minHeight: 26,
                          fontSize: "12px",
                          px: 1,
                          flexShrink: 0,
                        }}
                      >
                        Keep my version
                      </Button>
                    ) : (
                      <IconButton
                        variant="plain"
                        color={color}
                        size="sm"
                        aria-label="Dismiss notification"
                        onClick={onDismissExternalUpdate}
                        sx={{
                          minWidth: 20,
                          minHeight: 20,
                          borderRadius: "6px",
                        }}
                      >
                        <X size={12} />
                      </IconButton>
                    )}
                  </Sheet>
                );
              })()
            : null}

          {/* The single save state. Fixed width, so buttons never shift. */}
          <Box
            data-testid="studio-save-state"
            role="status"
            aria-live="polite"
            sx={{ width: 118, flexShrink: 0, display: "flex", justifyContent: "flex-end" }}
          >
            {canRetrySave ? (
              <Button
                size="sm"
                variant="plain"
                color={saveState.tone === "warning" ? "warning" : "danger"}
                onClick={onSave}
                title={
                  saveState.kind === "conflict"
                    ? "Someone else changed this campaign. Review before saving."
                    : "Your edits are still here. Try saving again."
                }
                startDecorator={<RefreshCw size={13} />}
                sx={{ minHeight: 28, fontSize: "12px", px: 1 }}
              >
                {statusLabel} · Retry
              </Button>
            ) : (
              <Typography
                level="body-xs"
                title={lastSavedAt ? `Last saved ${savedAtLabel}` : undefined}
                sx={{
                  color: `${saveState.tone}.${saveState.tone === "neutral" ? 500 : 600}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  fontSize: "12px",
                }}
              >
                {saveState.kind === "saving" ? (
                  <CircularProgress size="sm" thickness={3} sx={{ "--CircularProgress-size": "14px" }} />
                ) : saveState.kind === "saved" ? (
                  <Check size={14} aria-hidden />
                ) : null}
                {statusLabel}
              </Typography>
            )}
          </Box>

          <Button
            variant="outlined"
            color="neutral"
            size="sm"
            aria-label="Save template"
            title="Save this design as a template"
            startDecorator={<BookmarkPlus size={16} />}
            onClick={onSaveAsTemplate}
            disabled={blockCount === 0}
            sx={{
              ...wideOnlySx,
              [COMPACT_TOOLBAR_QUERY]: {
                px: 0.75,
                "& .MuiButton-startDecorator": { margin: 0 },
              },
              height: 32,
              minHeight: 32,
              borderColor: "neutral.300",
              borderRadius: "8px",
              fontWeight: 500,
              fontSize: "13px",
              "&:hover": { bgcolor: "neutral.50" },
            }}
          >
            <Box component="span" sx={fullLabelSx}>Save template</Box>
          </Button>

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

          <Dropdown>
            <MenuButton
              slots={{ root: IconButton }}
              slotProps={{
                root: {
                  variant: "outlined",
                  color: "neutral",
                  size: "sm",
                  "aria-label": "More actions",
                  sx: { borderRadius: "8px", minHeight: 32, minWidth: 32, ...narrowOnlySx },
                } as never,
              }}
            >
              <MoreHorizontal size={16} />
            </MenuButton>
            <Menu placement="bottom-end" sx={{ zIndex: 1300 }}>
              <MenuItem onClick={() => setDesignOpen(true)}>
                <SlidersHorizontal size={15} /> Design & spacing
              </MenuItem>
              <MenuItem disabled={blockCount === 0} onClick={onSaveAsTemplate}>
                <BookmarkPlus size={15} /> Save template
              </MenuItem>
              <MenuItem disabled>{blockCountLabel}</MenuItem>
            </Menu>
          </Dropdown>

          {campaignStatus === "Draft" ? (
            <Tooltip title="Your design is saved before you review recipients and send. This does not send your email.">
              <Button
                variant="solid"
                size="sm"
                aria-label="Review & Send"
                onClick={onExit}
                loading={saveStatus === "saving"}
                endDecorator={<ArrowRight size={16} aria-hidden="true" />}
                sx={{
                  minHeight: 34,
                  flexShrink: 0,
                  px: 1.5,
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: 14,
                  bgcolor: "#244d46",
                  "&:hover": { bgcolor: "#183c35" },
                }}
              >
                Review &amp; Send
              </Button>
            </Tooltip>
          ) : null}
          <Tooltip title="Save your changes and return to the campaign">
            <IconButton
              variant="plain"
              color="neutral"
              aria-label="Save and close Design Studio"
              onClick={onExit}
              sx={{ minWidth: 34, minHeight: 34, flexShrink: 0 }}
            >
              <X size={18} />
            </IconButton>
          </Tooltip>
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
