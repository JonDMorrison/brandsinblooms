import * as React from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import CircularProgress from "@mui/joy/CircularProgress";
import Divider from "@mui/joy/Divider";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Snackbar from "@mui/joy/Snackbar";
import Typography from "@mui/joy/Typography";
import { useDropzone, type FileRejection } from "react-dropzone";
import {
  ArrowUp,
  Brain,
  Bot,
  Download,
  Microscope,
  Mic,
  Palette,
  Pencil,
  Pin,
  Plus,
  Send,
  SlidersHorizontal,
  Square,
  X,
  type LucideIcon,
} from "lucide-react";
import { JoyTooltip } from "@/components/joy/JoyTooltip";
import { BloomFilePreview } from "@/components/bloom/BloomFilePreview";
import { BloomPlusMenu } from "@/components/bloom/BloomPlusMenu";
import {
  BloomSlashMenu,
  type BloomSlashMenuHandle,
} from "@/components/bloom/BloomSlashMenu";
import { BloomVoiceWaveform } from "@/components/bloom/BloomVoiceWaveform";
import {
  BLOOM_ATTACHMENT_ACCEPT,
  MAX_BLOOM_ATTACHMENT_BYTES,
  MAX_BLOOM_ATTACHMENTS,
} from "@/components/bloom/bloomFileUtils";
import {
  executeSlashCommand,
  matchSlashCommand,
  type BloomActionContext,
} from "@/components/bloom/utils/slashCommandRegistry";
import { useBloomFileUpload } from "@/hooks/bloom/useBloomFileUpload";
import { useBloomVoiceInput } from "@/hooks/bloom/useBloomVoiceInput";
import type {
  BloomJsonArray,
  BloomMode,
  BloomModelPreference,
} from "@/hooks/bloom/types";

const DEFAULT_MODE: BloomMode = "standard";
const DEFAULT_MODEL: BloomModelPreference = "auto";

type BloomComposerModeOption = {
  mode: BloomMode;
  label: string;
  triggerLabel: string;
  description: string;
  shortcut: string;
  Icon: LucideIcon;
};

type BloomComposerModelOption = {
  value: BloomModelPreference;
  label: string;
  description: string;
};

const modeOptions: BloomComposerModeOption[] = [
  {
    mode: "standard",
    label: "Standard",
    triggerLabel: "Ask",
    description: "General questions and tasks",
    shortcut: "⌘1",
    Icon: Pencil,
  },
  {
    mode: "reasoning",
    label: "Reasoning",
    triggerLabel: "Reason",
    description: "Step-by-step logical analysis",
    shortcut: "⌘2",
    Icon: Brain,
  },
  {
    mode: "research",
    label: "Research",
    triggerLabel: "Research",
    description: "Deep research with sources",
    shortcut: "⌘3",
    Icon: Microscope,
  },
  {
    mode: "image",
    label: "Image",
    triggerLabel: "Image",
    description: "Generate images with AI",
    shortcut: "⌘4",
    Icon: Palette,
  },
];

const modelOptions: BloomComposerModelOption[] = [
  {
    value: "auto",
    label: "Auto",
    description: "Automatically select the best model",
  },
  {
    value: "standard",
    label: "Standard",
    description: "Fast responses for simple tasks",
  },
  {
    value: "pro",
    label: "Pro",
    description: "Most capable model for complex tasks",
  },
];

const getModeOption = (mode: BloomMode): BloomComposerModeOption =>
  modeOptions.find((option) => option.mode === mode) ?? modeOptions[0];

const getModelOption = (
  value: BloomModelPreference,
): BloomComposerModelOption =>
  modelOptions.find((option) => option.value === value) ?? modelOptions[0];

const normalizeVoiceTranscript = (transcript: string) =>
  transcript.replace(/\s+/g, " ").trim();

const appendVoiceTranscript = (baseValue: string, transcript: string) => {
  const normalized = normalizeVoiceTranscript(transcript);
  if (!normalized) {
    return baseValue;
  }

  const needsLeadingSpace = baseValue.length > 0 && !/\s$/.test(baseValue);
  return `${baseValue}${needsLeadingSpace ? " " : ""}${normalized}`;
};

const formatRecordingElapsed = (elapsedSeconds: number) => {
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const getFileOnlyPrompt = (fileCount: number) =>
  fileCount === 1 ? "Review the attached file." : "Review the attached files.";

const selectedToolBadgeSx = {
  appearance: "none",
  width: 28,
  height: 28,
  minWidth: 28,
  minHeight: 28,
  p: 0,
  border: "1px solid",
  borderColor: "primary.outlinedBorder",
  borderRadius: "50%",
  backgroundColor: "primary.softBg",
  color: "primary.plainColor",
  cursor: "pointer",
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  overflow: "hidden",
  transition:
    "color 150ms ease, background-color 150ms ease, border-color 150ms ease, transform 150ms ease",
  userSelect: "none",
  "&:hover": {
    backgroundColor: "primary.solidBg",
    borderColor: "primary.solidBg",
    color: "primary.solidColor",
  },
  "&:hover .ask-bloom-selected-tool-icon, &:focus-visible .ask-bloom-selected-tool-icon":
    {
      opacity: 0,
      transform: "scale(0.72)",
    },
  "&:hover .ask-bloom-selected-tool-clear, &:focus-visible .ask-bloom-selected-tool-clear":
    {
      opacity: 1,
      transform: "translateX(-2px) scale(1)",
    },
  "&:active": {
    transform: "scale(0.96)",
  },
  "&:focus-visible": {
    outline: 0,
    boxShadow: "0 0 0 2px rgba(var(--joy-palette-primary-mainChannel) / 0.18)",
  },
} as const;

const selectedToolBadgeIconSx = {
  position: "absolute",
  inset: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  opacity: 1,
  transform: "scale(1)",
  transition: "opacity 120ms ease, transform 120ms ease",
} as const;

const selectedToolBadgeClearSx = {
  position: "absolute",
  inset: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  opacity: 0,
  transform: "translateX(3px) scale(0.72)",
  transition: "opacity 120ms ease, transform 120ms ease",
} as const;

const optionItemSx = {
  width: "100%",
  appearance: "none",
  border: 0,
  backgroundColor: "transparent",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "6px 8px",
  borderRadius: "var(--joy-radius-sm)",
  textAlign: "left",
  color: "text.primary",
  fontFamily: "var(--joy-fontFamily-body)",
  "&:hover": {
    bgcolor: "background.level1",
  },
  "&:focus-visible": {
    outline: 0,
    boxShadow: "0 0 0 2px var(--joy-palette-focusVisible)",
  },
  "&:disabled": {
    cursor: "not-allowed",
    opacity: 0.45,
  },
} as const;

const toolbarIconButtonSx = {
  width: 30,
  height: 30,
  minWidth: 30,
  minHeight: 30,
  p: 0,
  borderRadius: "var(--joy-radius-sm)",
  color: "text.secondary",
  opacity: 0.45,
  transition:
    "background-color 150ms ease, color 150ms ease, opacity 150ms ease, transform 150ms ease",
  "&:hover": {
    bgcolor: "background.level2",
    opacity: 0.75,
  },
} as const;

const sendSpinnerSx = {
  "--CircularProgress-size": "16px",
  "--CircularProgress-trackThickness": "2px",
  "--CircularProgress-progressThickness": "2px",
  "--CircularProgress-trackColor": "rgba(255, 255, 255, 0.3)",
} as const;

/** Solid brand-navy treatment shared by the send pill and icon send button. */
const sendButtonBaseSx = {
  borderRadius: "12px",
  bgcolor: "brandNavy.700",
  color: "common.white",
  transition:
    "background-color 150ms ease, color 150ms ease, transform 150ms ease, opacity 150ms ease",
  "&:hover": { bgcolor: "brandNavy.800", transform: "scale(1.03)" },
  "&:active": { transform: "scale(0.97)" },
  "&.Mui-disabled": {
    bgcolor: "brandNavy.700",
    color: "common.white",
    opacity: 0.35,
    cursor: "not-allowed",
    transform: "none",
  },
  "&.Mui-disabled:hover": { transform: "none" },
} as const;

const sendButtonShapeSx = {
  width: 40,
  height: 40,
  minWidth: 40,
  minHeight: 40,
  borderRadius: "12px",
  p: 0,
  transition:
    "background-color 150ms ease, border-color 150ms ease, color 150ms ease, transform 150ms ease, opacity 150ms ease",
  "&:active": { transform: "scale(0.95)" },
  "&.Mui-disabled": { opacity: 0.35, cursor: "not-allowed", transform: "none" },
} as const;

type BloomComposerOptionsPopoverProps = {
  anchor: HTMLButtonElement | null;
  buttonRef: React.RefObject<HTMLButtonElement>;
  isPinned: boolean;
  resourceLabel: string | null;
  resourceType: string | null;
  onClearFocus: () => void;
  onClose: () => void;
  onNewConversation: () => void;
  onOpenChange: (anchor: HTMLButtonElement | null) => void;
  onTogglePin: () => void;
  onUnsupported: (message: string) => void;
};

function BloomComposerOptionsPopover({
  anchor,
  buttonRef,
  isPinned,
  onClearFocus,
  onClose,
  onNewConversation,
  onOpenChange,
  onTogglePin,
  onUnsupported,
  resourceLabel,
  resourceType,
}: BloomComposerOptionsPopoverProps) {
  const sheetRef = React.useRef<HTMLDivElement | null>(null);
  const isOpen = Boolean(anchor);

  React.useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (sheetRef.current?.contains(target) || anchor?.contains(target)) {
        return;
      }

      onClose();
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [anchor, isOpen, onClose]);

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <Box sx={{ position: "relative", display: "inline-flex" }}>
      <JoyTooltip title="Options" placement="top">
        <IconButton
          ref={buttonRef}
          aria-label="Ask Bloom options"
          aria-expanded={isOpen}
          color="neutral"
          size="sm"
          variant="plain"
          onClick={() => onOpenChange(isOpen ? null : buttonRef.current)}
          sx={{
            ...toolbarIconButtonSx,
            borderRadius: "var(--joy-radius-sm)",
            opacity: 0.7,
            "&:hover": {
              bgcolor: "background.level2",
              opacity: 1,
            },
          }}
        >
          <SlidersHorizontal size={16} strokeWidth={1.75} />
        </IconButton>
      </JoyTooltip>

      {isOpen ? (
        <Sheet
          ref={sheetRef}
          role="dialog"
          aria-label="Ask Bloom options"
          data-placement="right-end"
          tabIndex={-1}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            }
          }}
          sx={{
            position: "absolute",
            left: "calc(100% + 8px)",
            bottom: 0,
            width: 260,
            maxWidth: "calc(100vw - 32px)",
            zIndex: "var(--joy-zIndex-popup)",
            bgcolor: "background.popup",
            border: "1px solid",
            borderColor: "neutral.outlinedBorder",
            borderRadius: "var(--joy-radius-xl)",
            boxShadow: "var(--joy-shadow-lg)",
            p: "12px",
          }}
        >
          <Box sx={{ display: "grid", gap: "12px" }}>
            <Box sx={{ display: "grid", gap: "6px" }}>
              <Typography
                level="body-xs"
                sx={{
                  color: "text.secondary",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                Resource Context
              </Typography>
              <Typography level="body-sm" sx={{ color: "text.primary" }}>
                {resourceLabel
                  ? `${resourceLabel} — ${resourceType ?? "resource"}`
                  : "General — no resource focus"}
              </Typography>
              {resourceLabel ? (
                <Button
                  color="neutral"
                  size="sm"
                  variant="plain"
                  onClick={() => handleAction(onClearFocus)}
                  sx={{ justifySelf: "start", px: 1, minHeight: 28 }}
                >
                  Clear focus
                </Button>
              ) : null}
            </Box>

            <Divider />

            <Box sx={{ display: "grid", gap: "4px" }}>
              <Typography
                level="body-xs"
                sx={{
                  color: "text.secondary",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                Conversation
              </Typography>
              <Box
                component="button"
                type="button"
                onClick={() => handleAction(onNewConversation)}
                sx={optionItemSx}
              >
                <Plus size={14} strokeWidth={1.75} />
                <Typography level="body-sm" sx={{ color: "text.primary" }}>
                  New conversation
                </Typography>
              </Box>
              <Box
                component="button"
                type="button"
                disabled={!resourceLabel}
                onClick={() => handleAction(onTogglePin)}
                sx={optionItemSx}
              >
                <Pin size={14} strokeWidth={1.75} />
                <Typography level="body-sm" sx={{ color: "text.primary" }}>
                  {isPinned ? "Unpin from resource" : "Pin to resource"}
                </Typography>
              </Box>
              <Box
                component="button"
                type="button"
                onClick={() => onUnsupported("Export as note coming soon")}
                sx={optionItemSx}
              >
                <Download size={14} strokeWidth={1.75} />
                <Typography level="body-sm" sx={{ color: "text.primary" }}>
                  Export as note
                </Typography>
              </Box>
            </Box>
          </Box>
        </Sheet>
      ) : null}
    </Box>
  );
}

type BloomComposerSelectedToolBadgeProps = {
  Icon: LucideIcon;
  label: string;
  onRemove: () => void;
};

function BloomComposerSelectedToolBadge({
  Icon,
  label,
  onRemove,
}: BloomComposerSelectedToolBadgeProps) {
  return (
    <JoyTooltip title={`Clear ${label}`} placement="top">
      <Box
        component="button"
        type="button"
        aria-label={`Clear ${label}`}
        onClick={onRemove}
        sx={selectedToolBadgeSx}
      >
        <Box
          component="span"
          aria-hidden="true"
          className="ask-bloom-selected-tool-icon"
          sx={selectedToolBadgeIconSx}
        >
          <Icon size={13} strokeWidth={2} />
        </Box>
        <Box
          component="span"
          aria-hidden="true"
          className="ask-bloom-selected-tool-clear"
          sx={selectedToolBadgeClearSx}
        >
          <X size={13} strokeWidth={2.2} />
        </Box>
      </Box>
    </JoyTooltip>
  );
}

export type BloomComposerSelection = "end" | "select-all" | "start";

/** Imperative handle /bloom's keyboard shortcuts drive (see useBloomShortcuts). */
export interface BloomComposerController {
  focus: (selection?: BloomComposerSelection) => void;
  getValue: () => string;
  isFocused: () => boolean;
  isSlashMenuOpen: () => boolean;
  setSlashMenuOpen: (open: boolean) => void;
  setValue: (
    value: string,
    options?: { focus?: boolean; selection?: BloomComposerSelection },
  ) => void;
}

/** The drawer's conversation menu (pin, clear focus, new conversation). */
export interface BloomComposerConversationOptions {
  isPinned: boolean;
  resourceLabel: string | null;
  resourceType: string | null;
  onClearFocus: () => void;
  onNewConversation: () => void;
  onTogglePin: () => void;
}

export interface BloomComposerProps {
  /** "panel" is the Ask Bloom drawer; "page" is /bloom's wider canvas. */
  layout: "panel" | "page";
  /** The draft. Each surface owns where its draft lives. */
  value: string;
  onValueChange: (value: string) => void;
  conversationId: string | null;
  /** Resolves (creating if needed) the conversation files upload into. */
  ensureConversationId: () => Promise<string>;
  /** True while the reply streams. */
  isStreaming: boolean;
  /** True while a send is being prepared, before the stream starts. */
  isSending?: boolean;
  /** No messages yet: shows the welcome label, placeholder and send pill. */
  isWelcome: boolean;
  onSend: (
    message: string,
    attachments: BloomJsonArray,
  ) => void | Promise<void>;
  /** Stops the streaming reply; the send button becomes a stop button. */
  onStop?: () => void;
  activeMode: BloomMode;
  onModeChange: (mode: BloomMode) => void;
  modelPreference: BloomModelPreference;
  onModelPreferenceChange: (preference: BloomModelPreference) => void;
  slashActionContext: BloomActionContext;
  /** Opens the keyboard shortcuts; without it the composer says where they are. */
  onOpenShortcuts?: () => void;
  /** Width to lay out against before the composer has been measured. */
  fallbackWidth?: number;
  conversationOptions?: BloomComposerConversationOptions;
  registerController?: (controller: BloomComposerController | null) => void;
  /** User-facing feedback; defaults to the composer's own snackbar. */
  onNotify?: (message: string) => void;
}

const SHORTCUTS_IN_FULL_BLOOM = "Keyboard shortcuts are available in full Bloom.";
const PANEL_TEXTAREA_MAX_HEIGHT = 120;
const PAGE_TEXTAREA_MAX_HEIGHT = 240;

/**
 * The one Bloom composer. The Ask Bloom drawer (AskBloomInput) and /bloom
 * (BloomPageComposer) both render it and drive it through props, so they share
 * the same text box, slash commands, voice input, attachments, mode/model
 * selection, sending and stop states.
 */
export function BloomComposer({
  activeMode,
  conversationId,
  conversationOptions,
  ensureConversationId,
  fallbackWidth = 400,
  isSending = false,
  isStreaming,
  isWelcome,
  layout,
  modelPreference,
  onModeChange,
  onModelPreferenceChange,
  onNotify,
  onOpenShortcuts,
  onSend,
  onStop,
  onValueChange,
  registerController,
  slashActionContext: providedSlashActionContext,
  value,
}: BloomComposerProps) {
  const isPage = layout === "page";
  const textareaMaxHeight = isPage
    ? PAGE_TEXTAREA_MAX_HEIGHT
    : PANEL_TEXTAREA_MAX_HEIGHT;
  const [isFocused, setIsFocused] = React.useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = React.useState(false);
  const [slashMenuOpen, setSlashMenuOpen] = React.useState(false);
  const [optionsAnchor, setOptionsAnchor] =
    React.useState<HTMLButtonElement | null>(null);
  const [measuredWidth, setMeasuredWidth] = React.useState<number | null>(null);
  const [snackbarMessage, setSnackbarMessage] = React.useState<string | null>(
    null,
  );
  const [streamStatusMessage, setStreamStatusMessage] = React.useState("");
  const [recordingElapsedSeconds, setRecordingElapsedSeconds] =
    React.useState(0);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const composerAreaRef = React.useRef<HTMLDivElement | null>(null);
  const plusButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const optionsButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const slashMenuRef = React.useRef<BloomSlashMenuHandle | null>(null);
  const previousStreamingRef = React.useRef(isStreaming);
  const voiceBaseValueRef = React.useRef("");
  const ignoreVoiceTranscriptRef = React.useRef(false);
  const voiceRecordingActiveRef = React.useRef(false);
  const trimmedValue = value.trim();
  const effectiveWidth = measuredWidth ?? fallbackWidth;
  const isCompact = effectiveWidth < 360;
  const textareaId = React.useId();

  const notify = React.useCallback(
    (message: string) => {
      if (onNotify) {
        onNotify(message);
        return;
      }

      setSnackbarMessage(message);
    },
    [onNotify],
  );

  const openShortcuts = React.useCallback(() => {
    if (onOpenShortcuts) {
      onOpenShortcuts();
      return;
    }

    notify(SHORTCUTS_IN_FULL_BLOOM);
  }, [notify, onOpenShortcuts]);

  const slashActionContext = React.useMemo<BloomActionContext>(
    () => ({
      ...providedSlashActionContext,
      openShortcutsPanel: openShortcuts,
    }),
    [openShortcuts, providedSlashActionContext],
  );

  const resizeTextarea = React.useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, textareaMaxHeight)}px`;
  }, [textareaMaxHeight]);

  const focusTextarea = React.useCallback(
    (selection: BloomComposerSelection = "end") => {
      window.setTimeout(() => {
        const textarea = textareaRef.current;
        if (!textarea) {
          return;
        }

        resizeTextarea();
        textarea.focus();

        if (selection === "select-all") {
          textarea.select();
          return;
        }

        const cursorPosition =
          selection === "start" ? 0 : textarea.value.length;
        textarea.setSelectionRange(cursorPosition, cursorPosition);
      }, 0);
    },
    [resizeTextarea],
  );

  const {
    addFiles,
    attachments,
    clearFiles,
    files,
    hasUnreadyFiles,
    isUploading,
    removeFile,
    retryFile,
  } = useBloomFileUpload({
    activeConversationId: conversationId,
    ensureConversationId,
  });

  const {
    analyserNode: voiceAnalyserNode,
    error: voiceError,
    interimTranscript: voiceInterimTranscript,
    isListening: voiceIsListening,
    isSupported: voiceIsSupported,
    resetTranscript: resetVoiceTranscript,
    startListening: startVoiceListening,
    stopListening: stopVoiceListening,
    transcript: voiceTranscript,
  } = useBloomVoiceInput();

  const hasFiles = files.length > 0;
  const hasText = value.length > 0;
  const hasSubmitContent = trimmedValue.length > 0 || hasFiles;
  const isSendInProgress = isSending || isStreaming;
  const canStop = isStreaming && Boolean(onStop);
  const sendDisabled = !hasSubmitContent || isSendInProgress || hasUnreadyFiles;
  const attachDisabled =
    isSendInProgress || files.length >= MAX_BLOOM_ATTACHMENTS;
  const sendButtonLabel = canStop
    ? "Stop response"
    : isSending
      ? "Sending message"
      : isUploading
        ? "Uploading files"
        : "Send message";
  const showWelcomeSendPill = isWelcome && !isCompact && !canStop;
  const activeModeOption = getModeOption(activeMode);
  const activeModelOption = getModelOption(modelPreference);
  const showModePill = activeMode !== DEFAULT_MODE;
  const showModelPill = modelPreference !== DEFAULT_MODEL;
  const placeholder =
    activeMode === "image"
      ? "Describe the image you'd like to create..."
      : isWelcome
        ? "Ask how to do something, or about your store..."
        : "Ask a follow-up...";

  const updateSlashMenuState = React.useCallback((nextValue: string) => {
    setSlashMenuOpen(nextValue.trimStart().startsWith("/"));
  }, []);

  const setComposerValue = React.useCallback(
    (
      nextValue: string,
      options?: { focus?: boolean; selection?: BloomComposerSelection },
    ) => {
      onValueChange(nextValue);
      updateSlashMenuState(nextValue);
      setPlusMenuOpen(false);

      if (options?.focus ?? true) {
        focusTextarea(options?.selection ?? "end");
      }
    },
    [focusTextarea, onValueChange, updateSlashMenuState],
  );

  const resetComposer = React.useCallback(() => {
    onValueChange("");
    setSlashMenuOpen(false);
    clearFiles();
    window.setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }, 0);
    focusTextarea();
  }, [clearFiles, focusTextarea, onValueChange]);

  React.useEffect(() => {
    if (!registerController) {
      return undefined;
    }

    registerController({
      focus: focusTextarea,
      getValue: () => value,
      isFocused: () =>
        typeof document !== "undefined" &&
        document.activeElement === textareaRef.current,
      isSlashMenuOpen: () => slashMenuOpen,
      setSlashMenuOpen,
      setValue: setComposerValue,
    });

    return () => {
      registerController(null);
    };
  }, [
    focusTextarea,
    registerController,
    setComposerValue,
    slashMenuOpen,
    value,
  ]);

  // Keep the height in step with drafts set from outside (shortcuts, prompts).
  React.useEffect(() => {
    resizeTextarea();
  }, [resizeTextarea, value]);

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return undefined;
    }

    const panel = root.closest("[data-ask-bloom-panel]");
    const panelElement = panel instanceof HTMLElement ? panel : null;

    const syncLayout = () => {
      const rect = root.getBoundingClientRect();
      setMeasuredWidth(rect.width);
      panelElement?.style.setProperty(
        "--ask-bloom-floating-input-height",
        `${Math.ceil(rect.height)}px`,
      );
    };

    syncLayout();

    if (typeof ResizeObserver === "undefined") {
      return () => {
        panelElement?.style.removeProperty("--ask-bloom-floating-input-height");
      };
    }

    const observer = new ResizeObserver(() => {
      syncLayout();
    });

    observer.observe(root);
    return () => {
      observer.disconnect();
      panelElement?.style.removeProperty("--ask-bloom-floating-input-height");
    };
  }, []);

  React.useEffect(() => {
    if (previousStreamingRef.current === isStreaming) {
      return;
    }

    previousStreamingRef.current = isStreaming;
    setStreamStatusMessage(
      isStreaming ? "Bloom is responding." : "Bloom response complete.",
    );
  }, [isStreaming]);

  React.useEffect(() => {
    if (voiceError) {
      notify(voiceError);
    }
  }, [notify, voiceError]);

  React.useEffect(() => {
    if (!voiceIsListening) {
      setRecordingElapsedSeconds(0);
      return undefined;
    }

    const startedAt = Date.now();
    setRecordingElapsedSeconds(0);

    const timerId = window.setInterval(() => {
      setRecordingElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);

    return () => window.clearInterval(timerId);
  }, [voiceIsListening]);

  React.useEffect(() => {
    if (voiceIsListening && !voiceRecordingActiveRef.current) {
      voiceBaseValueRef.current = value;
      ignoreVoiceTranscriptRef.current = false;
      setPlusMenuOpen(false);
      setSlashMenuOpen(false);
      focusTextarea();
    }

    if (!voiceIsListening && voiceRecordingActiveRef.current) {
      setSlashMenuOpen(value.trimStart().startsWith("/"));
    }

    voiceRecordingActiveRef.current = voiceIsListening;
  }, [focusTextarea, value, voiceIsListening]);

  React.useEffect(() => {
    if (!voiceTranscript) {
      return;
    }

    if (ignoreVoiceTranscriptRef.current) {
      resetVoiceTranscript();
      return;
    }

    const nextValue = appendVoiceTranscript(
      voiceBaseValueRef.current,
      voiceTranscript,
    );
    voiceBaseValueRef.current = nextValue;
    onValueChange(nextValue);
    updateSlashMenuState(nextValue);
    resetVoiceTranscript();
    focusTextarea();
  }, [
    focusTextarea,
    onValueChange,
    resetVoiceTranscript,
    updateSlashMenuState,
    voiceTranscript,
  ]);

  React.useEffect(() => {
    if (!voiceIsListening) {
      return;
    }

    const nextValue = appendVoiceTranscript(
      voiceBaseValueRef.current,
      voiceInterimTranscript,
    );
    onValueChange(nextValue);
    updateSlashMenuState(nextValue);
  }, [
    onValueChange,
    updateSlashMenuState,
    voiceInterimTranscript,
    voiceIsListening,
  ]);

  const closeOptions = React.useCallback(() => {
    setOptionsAnchor(null);
    focusTextarea();
  }, [focusTextarea]);

  const handleDropRejected = React.useCallback(
    (fileRejections: FileRejection[]) => {
      for (const rejection of fileRejections) {
        const errorCode = rejection.errors[0]?.code;
        if (errorCode === "file-too-large") {
          notify(`${rejection.file.name} exceeds the 10MB limit`);
        } else if (errorCode === "too-many-files") {
          notify(`You can attach up to ${MAX_BLOOM_ATTACHMENTS} files`);
        } else {
          notify(`${rejection.file.name} is not a supported file type`);
        }
      }
    },
    [notify],
  );

  const {
    getInputProps,
    getRootProps,
    isDragActive,
    open: openFileDialog,
  } = useDropzone({
    accept: BLOOM_ATTACHMENT_ACCEPT,
    disabled: attachDisabled,
    maxFiles: Math.max(0, MAX_BLOOM_ATTACHMENTS - files.length),
    maxSize: MAX_BLOOM_ATTACHMENT_BYTES,
    multiple: true,
    noClick: true,
    noKeyboard: true,
    onDrop: (acceptedFiles) => {
      void addFiles(acceptedFiles);
    },
    onDropRejected: handleDropRejected,
  });

  const submitMessage = React.useCallback(async () => {
    if (sendDisabled) {
      return;
    }

    if (voiceIsListening) {
      ignoreVoiceTranscriptRef.current = true;
      stopVoiceListening();
    }

    const message = trimmedValue || getFileOnlyPrompt(files.length);

    try {
      if (message.startsWith("/")) {
        const matched = matchSlashCommand(message);
        if (!matched) {
          notify("Unknown command. Try /customers, /stats, or /help.");
          return;
        }

        await executeSlashCommand(
          matched.command,
          matched.params,
          slashActionContext,
        );
      } else {
        await onSend(message, attachments);
      }

      resetComposer();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Unable to run that command.",
      );
    }
  }, [
    attachments,
    files.length,
    notify,
    onSend,
    resetComposer,
    sendDisabled,
    slashActionContext,
    stopVoiceListening,
    trimmedValue,
    voiceIsListening,
  ]);

  const handleInputChange = React.useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      onValueChange(event.target.value);
      updateSlashMenuState(event.target.value);
      resizeTextarea();
    },
    [onValueChange, resizeTextarea, updateSlashMenuState],
  );

  const handleInputKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const modifierPressed = event.metaKey || event.ctrlKey || event.altKey;

      if (
        event.key === "/" &&
        !modifierPressed &&
        !event.shiftKey &&
        value.trim().length === 0
      ) {
        setSlashMenuOpen(true);
      }

      if (slashMenuOpen) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          event.stopPropagation();
          slashMenuRef.current?.moveSelection("next");
          return;
        }

        if (event.key === "ArrowUp") {
          event.preventDefault();
          event.stopPropagation();
          slashMenuRef.current?.moveSelection("previous");
          return;
        }

        if (event.key === "Tab") {
          event.preventDefault();
          event.stopPropagation();
          slashMenuRef.current?.autocompleteHighlighted();
          return;
        }

        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          event.stopPropagation();
          slashMenuRef.current?.selectHighlighted();
          return;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          setSlashMenuOpen(false);
          return;
        }
      }

      if (event.key === "Escape") {
        event.currentTarget.blur();
        return;
      }

      if (event.key !== "Enter" || event.shiftKey) {
        return;
      }

      event.preventDefault();
      void submitMessage();
    },
    [slashMenuOpen, submitMessage, value],
  );

  const handleSelectMode = React.useCallback(
    (mode: BloomMode) => {
      onModeChange(mode);
      setPlusMenuOpen(false);
      focusTextarea();
    },
    [focusTextarea, onModeChange],
  );

  const handleSelectModel = React.useCallback(
    (model: BloomModelPreference) => {
      onModelPreferenceChange(model);
      setPlusMenuOpen(false);
      focusTextarea();
    },
    [focusTextarea, onModelPreferenceChange],
  );

  const handleResetMode = React.useCallback(() => {
    onModeChange(DEFAULT_MODE);
    focusTextarea();
  }, [focusTextarea, onModeChange]);

  const handleResetModel = React.useCallback(() => {
    onModelPreferenceChange(DEFAULT_MODEL);
    focusTextarea();
  }, [focusTextarea, onModelPreferenceChange]);

  const handleAttachFiles = React.useCallback(() => {
    setPlusMenuOpen(false);
    openFileDialog();
  }, [openFileDialog]);

  const handleOpenShortcuts = React.useCallback(() => {
    setPlusMenuOpen(false);
    openShortcuts();
  }, [openShortcuts]);

  const handleStartVoice = React.useCallback(() => {
    setPlusMenuOpen(false);
    setSlashMenuOpen(false);
    void startVoiceListening();
  }, [startVoiceListening]);

  const handleClearDraft = React.useCallback(() => {
    voiceBaseValueRef.current = "";
    resetVoiceTranscript();
    setComposerValue("", { focus: true });
  }, [resetVoiceTranscript, setComposerValue]);

  const { onKeyDown: dropzoneOnKeyDown, ...rootProps } = getRootProps();
  void dropzoneOnKeyDown;

  return (
    <Box
      ref={rootRef}
      data-ask-bloom-panel-input={isPage ? undefined : true}
      data-bloom-composer={layout}
      sx={{
        position: "relative",
        p: 0,
        bgcolor: "transparent",
        zIndex: 3,
        ...(isPage
          ? {
              width: { xs: "100%", sm: "min(100%, 52rem)" },
              mx: "auto",
              pointerEvents: "auto",
            }
          : {}),
        "@media (prefers-reduced-motion: reduce)": {
          "& *, & *::before, & *::after": {
            animation: "none",
            transition: "none",
            scrollBehavior: "auto",
          },
        },
      }}
    >
      <Box
        {...rootProps}
        sx={{
          position: "relative",
          bgcolor: "background.surface",
          border: "1px solid",
          borderColor: isFocused ? "primary.outlinedColor" : "brandNavy.200",
          borderRadius: "18px",
          padding: isPage ? "18px 18px 12px 18px" : "14px 14px 10px 14px",
          boxShadow: isFocused
            ? "0 0 0 1px var(--joy-palette-primary-outlinedColor), var(--joy-shadow-lg)"
            : "var(--joy-shadow-md)",
          transition: "border-color 200ms ease, box-shadow 200ms ease",
        }}
      >
        <input {...getInputProps()} hidden />

        {isDragActive ? (
          <Box
            aria-hidden="true"
            sx={{
              position: "absolute",
              inset: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              borderRadius: "var(--joy-radius-md)",
              border: "2px dashed",
              borderColor: "primary.outlinedBorder",
              bgcolor: "primary.softBg",
              color: "primary.plainColor",
              zIndex: 4,
              pointerEvents: "none",
            }}
          >
            <Typography level="body-sm" sx={{ color: "primary.plainColor" }}>
              Drop to attach
            </Typography>
          </Box>
        ) : null}

        <Box ref={composerAreaRef} sx={{ position: "relative" }}>
          <BloomSlashMenu
            ref={slashMenuRef}
            anchorRef={composerAreaRef}
            actionContext={slashActionContext}
            composerValue={value}
            open={slashMenuOpen && !voiceIsListening}
            onAutocomplete={(nextValue) =>
              setComposerValue(nextValue, { focus: true, selection: "end" })
            }
            onClose={() => setSlashMenuOpen(false)}
            onExecuted={resetComposer}
          />

          {voiceIsListening ? (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                minHeight: 48,
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <BloomVoiceWaveform
                  analyserNode={voiceAnalyserNode}
                  isRecording={voiceIsListening}
                />
                {voiceInterimTranscript ? (
                  <Typography
                    level="body-xs"
                    noWrap
                    sx={{ mt: "4px", color: "text.tertiary" }}
                  >
                    {voiceInterimTranscript}
                  </Typography>
                ) : null}
              </Box>
              <Typography
                level="body-xs"
                aria-live="polite"
                sx={{
                  flexShrink: 0,
                  color: "danger.plainColor",
                  fontVariantNumeric: "tabular-nums",
                  fontWeight: 600,
                }}
              >
                {formatRecordingElapsed(recordingElapsedSeconds)}
              </Typography>
            </Box>
          ) : (
            <>
              {isWelcome ? (
                <Typography
                  component="label"
                  htmlFor={textareaId}
                  sx={{
                    display: "block",
                    mb: "6px",
                    fontFamily: "var(--joy-fontFamily-display)",
                    fontSize: "15px",
                    fontWeight: 700,
                    color: "brandNavy.900",
                  }}
                >
                  What can I help with?
                </Typography>
              ) : null}
              <Box
                component="textarea"
                id={textareaId}
                ref={textareaRef}
                aria-label={isWelcome ? undefined : "Ask Bloom message"}
                aria-disabled={isSendInProgress}
                data-ask-bloom-panel-input={isPage ? undefined : "true"}
                placeholder={placeholder}
                value={value}
                onBlur={() => setIsFocused(false)}
                onChange={handleInputChange}
                onFocus={() => setIsFocused(true)}
                onKeyDown={handleInputKeyDown}
                sx={{
                  display: "block",
                  border: "none",
                  outline: "none",
                  backgroundColor: "transparent",
                  resize: "none",
                  width: "100%",
                  minHeight: isPage ? 48 : 24,
                  maxHeight: textareaMaxHeight,
                  overflowY: "auto",
                  fontSize: isPage
                    ? "var(--joy-fontSize-md)"
                    : "var(--joy-fontSize-sm)",
                  fontFamily: "var(--joy-fontFamily-body)",
                  fontWeight: 400,
                  color: "text.primary",
                  lineHeight: 1.5,
                  p: 0,
                  opacity: isSendInProgress ? 0.6 : 1,
                  pointerEvents: isSendInProgress ? "none" : "auto",
                  transition: "opacity 150ms ease",
                  "&::placeholder": {
                    color: "var(--joy-palette-text-tertiary)",
                    opacity: 1,
                  },
                }}
              />
            </>
          )}
        </Box>

        {hasFiles ? (
          <Box sx={{ mt: "8px" }}>
            <BloomFilePreview
              files={files}
              onRemove={removeFile}
              onRetry={retryFile}
              showCapabilityHint={isPage}
            />
          </Box>
        ) : null}

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            mt: "8px",
            minHeight: 32,
            flexWrap: "nowrap",
            position: "relative",
          }}
        >
          <Box
            sx={{
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <JoyTooltip title="Tools and modes" placement="top">
              <IconButton
                ref={plusButtonRef}
                aria-label="Tools and modes"
                aria-expanded={plusMenuOpen}
                color="neutral"
                size="sm"
                variant="plain"
                onClick={() => setPlusMenuOpen((current) => !current)}
                sx={{
                  ...toolbarIconButtonSx,
                  opacity: 0.7,
                  transition: "transform 150ms ease, opacity 150ms ease",
                  transform: plusMenuOpen ? "rotate(45deg)" : "none",
                  "&:hover": {
                    bgcolor: "background.level2",
                    opacity: 1,
                  },
                }}
              >
                <Plus size={16} strokeWidth={1.75} />
              </IconButton>
            </JoyTooltip>

            <BloomPlusMenu
              activeMode={activeMode}
              activeModel={modelPreference}
              modelOptions={modelOptions}
              open={plusMenuOpen}
              triggerRef={plusButtonRef}
              visibleModeOptions={modeOptions}
              onAttachFiles={handleAttachFiles}
              onClose={() => setPlusMenuOpen(false)}
              onOpenShortcuts={handleOpenShortcuts}
              onSelectMode={handleSelectMode}
              onSelectModel={handleSelectModel}
            />

            {conversationOptions && !isCompact ? (
              <BloomComposerOptionsPopover
                anchor={optionsAnchor}
                buttonRef={optionsButtonRef}
                isPinned={conversationOptions.isPinned}
                resourceLabel={conversationOptions.resourceLabel}
                resourceType={conversationOptions.resourceType}
                onClearFocus={conversationOptions.onClearFocus}
                onClose={closeOptions}
                onNewConversation={conversationOptions.onNewConversation}
                onOpenChange={setOptionsAnchor}
                onTogglePin={conversationOptions.onTogglePin}
                onUnsupported={notify}
              />
            ) : null}

            {showModePill || showModelPill ? (
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                {showModePill ? (
                  <BloomComposerSelectedToolBadge
                    Icon={activeModeOption.Icon}
                    label={`${activeModeOption.label} mode`}
                    onRemove={handleResetMode}
                  />
                ) : null}

                {showModelPill ? (
                  <BloomComposerSelectedToolBadge
                    Icon={Bot}
                    label={`${activeModelOption.label} model`}
                    onRemove={handleResetModel}
                  />
                ) : null}
              </Box>
            ) : null}
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }} />

          {hasText && !voiceIsListening ? (
            <JoyTooltip title="Clear message" placement="top">
              <IconButton
                aria-label="Clear message"
                color="neutral"
                disabled={isSendInProgress}
                size="sm"
                variant="plain"
                onClick={handleClearDraft}
                sx={{
                  ...toolbarIconButtonSx,
                  opacity: 0.7,
                  "&:hover": { bgcolor: "background.level2", opacity: 1 },
                }}
              >
                <X size={16} strokeWidth={1.75} />
              </IconButton>
            </JoyTooltip>
          ) : null}

          {voiceIsSupported ? (
            <JoyTooltip
              title={voiceIsListening ? "Stop recording" : "Voice input"}
              placement="top"
            >
              <IconButton
                aria-label={voiceIsListening ? "Stop recording" : "Voice input"}
                color={voiceIsListening ? "danger" : "neutral"}
                disabled={!voiceIsListening && isSendInProgress}
                size="sm"
                variant="plain"
                onClick={
                  voiceIsListening ? stopVoiceListening : handleStartVoice
                }
                sx={{
                  ...toolbarIconButtonSx,
                  color: voiceIsListening
                    ? "danger.plainColor"
                    : "text.secondary",
                  opacity: voiceIsListening ? 1 : 0.7,
                  position: "relative",
                  animation: voiceIsListening
                    ? "bloomComposerVoiceButtonPulse 1s ease-in-out infinite"
                    : "none",
                  "&:hover": {
                    bgcolor: "background.level2",
                    opacity: 1,
                  },
                  "&::after": voiceIsListening
                    ? {
                        content: '""',
                        position: "absolute",
                        inset: -3,
                        borderRadius: "inherit",
                        border: "2px solid",
                        borderColor: "danger.plainColor",
                        opacity: 0.4,
                        animation:
                          "bloomComposerVoiceRingPulse 1.2s ease-out infinite",
                      }
                    : undefined,
                  "@keyframes bloomComposerVoiceButtonPulse": {
                    "0%, 100%": { transform: "scale(1)" },
                    "50%": { transform: "scale(1.08)" },
                  },
                  "@keyframes bloomComposerVoiceRingPulse": {
                    "0%": { opacity: 0.4, transform: "scale(1)" },
                    "100%": { opacity: 0, transform: "scale(1.32)" },
                  },
                }}
              >
                {voiceIsListening ? (
                  <Square size={12} fill="currentColor" strokeWidth={0} />
                ) : (
                  <Mic size={16} strokeWidth={1.75} />
                )}
              </IconButton>
            </JoyTooltip>
          ) : null}

          <JoyTooltip title={sendButtonLabel} placement="top">
            <Box sx={{ display: "inline-flex", flexShrink: 0 }}>
              {showWelcomeSendPill ? (
                <Button
                  aria-label={sendButtonLabel}
                  disabled={sendDisabled}
                  onClick={() => void submitMessage()}
                  startDecorator={
                    isUploading || isSending ? (
                      <CircularProgress
                        size="sm"
                        sx={{
                          ...sendSpinnerSx,
                          "--CircularProgress-progressColor":
                            "var(--joy-palette-common-white)",
                        }}
                      />
                    ) : (
                      <Send size={16} strokeWidth={2} />
                    )
                  }
                  sx={{
                    ...sendButtonBaseSx,
                    height: 44,
                    minHeight: 44,
                    px: "16px",
                    gap: "8px",
                    fontFamily: "var(--joy-fontFamily-display)",
                    fontSize: "14px",
                    fontWeight: 700,
                  }}
                >
                  Ask Bloom
                </Button>
              ) : (
                <IconButton
                  aria-label={sendButtonLabel}
                  color={canStop ? "danger" : "primary"}
                  disabled={!canStop && sendDisabled}
                  size="sm"
                  variant={canStop ? "outlined" : "solid"}
                  onClick={canStop ? onStop : () => void submitMessage()}
                  sx={
                    canStop
                      ? {
                          ...sendButtonShapeSx,
                          "&:hover": {
                            bgcolor: "danger.softBg",
                            transform: "scale(1.06)",
                          },
                        }
                      : {
                          ...sendButtonShapeSx,
                          ...sendButtonBaseSx,
                        }
                  }
                >
                  {canStop ? (
                    <Square size={12} fill="currentColor" strokeWidth={0} />
                  ) : isSendInProgress || isUploading ? (
                    <CircularProgress
                      size="sm"
                      sx={{
                        ...sendSpinnerSx,
                        "--CircularProgress-progressColor":
                          "var(--joy-palette-common-white)",
                      }}
                    />
                  ) : (
                    <ArrowUp size={16} strokeWidth={2.5} />
                  )}
                </IconButton>
              )}
            </Box>
          </JoyTooltip>
        </Box>
      </Box>

      {isPage ? (
        <Typography
          level="body-xs"
          sx={{
            mt: 1,
            textAlign: "center",
            color: "neutral.700",
            fontSize: "0.75rem",
            lineHeight: 1.4,
            letterSpacing: "0.01em",
            userSelect: "none",
          }}
        >
          Bloom Assist can make mistakes. Double-check important details before
          acting on them.
        </Typography>
      ) : null}

      <Box
        aria-live="polite"
        sx={{
          position: "absolute",
          width: 1,
          height: 1,
          p: 0,
          m: -1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        {streamStatusMessage}
      </Box>

      <Snackbar
        autoHideDuration={2600}
        color="neutral"
        open={Boolean(snackbarMessage)}
        size="sm"
        variant="soft"
        onClose={() => setSnackbarMessage(null)}
        sx={{ bgcolor: "background.popup", color: "text.primary" }}
      >
        {snackbarMessage ?? ""}
      </Snackbar>
    </Box>
  );
}
