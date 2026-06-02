/*
ASK-BLOOM-FIX-04 — Bloom Assist tool integration compatibility matrix

Voice input (useBloomVoiceInput / BloomVoiceWaveform)
  Q1: YES — useBloomVoiceInput is a standalone Web Speech API hook with no BloomContext dependency.
  Q2: None — imported directly; transcript appended into local inputValue.
  Q3: Works at sidebar width; waveform canvas is full-width, recording area reduced to ~80px.

File attachments (useBloomFileUpload / BloomFilePreview / bloomFileUtils)
  Q1: PARTIAL — useBloomFileUpload reads useAuth + useTenant directly and takes the conversation id as a
      parameter (no useBloom). bloomFileUtils + BloomFilePreview are pure.
  Q2: Thin adapter — pass AskBloomProvider state.conversationId and an ensureConversationId() that resolves
      the existing id (provider exposes no createConversation, so attaching requires an active conversation).
  Q3: Works; preview chips stack vertically and wrap at sidebar width.
  NOTE: AskBloomProvider.sendMessage(content) takes text only and useAskBloomStreaming hardcodes
      attachments: [], so uploaded files cannot be transmitted yet (see TODO in submitMessage).

Slash commands (slashCommandRegistry / BloomSlashMenu)
  Q1: PARTIAL — registry + menu are pure but require a BloomActionContext.
  Q2: Thin adapter — map navigate (react-router), sendMessage, setActiveMode (local), and map
      createConversation/archiveConversation onto askBloom.newConversation.
  Q3: BloomSlashMenu width is 100% of the anchor, so it fits the sidebar input.

Mode & model (BloomPlusMenu + pills)
  Q1: PARTIAL — BloomPlusMenu is fully prop-driven (no BloomContext), safe to import directly.
  Q2: Local activeMode/modelPreference state drives the menu + removable pills.
  Q3: minWidth 300 popup fits sidebars >= 320px.
  NOTE: AskBloomProvider.sendMessage + useAskBloomStreaming do not forward mode/model yet (see TODO).

Active tool loading pill (BloomToolLoadingPill)
  Q1: NO — depends on BloomMotionContext (useBloomReducedMotion) and AskBloomProvider exposes no
      activeToolCall stream state.
  Q2: Skipped here; belongs in AskBloomConversationArea once activeToolCall is exposed (see TODO below).
  // TODO: Expose activeToolCall from useAskBloomStreaming, then render a loading pill in
  //       AskBloomConversationArea (above this input) when a tool is executing.
*/

import * as React from "react";
import { useNavigate } from "react-router-dom";
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
import type { BloomMode, BloomModelPreference } from "@/hooks/bloom/types";
import { useAskBloom } from "@/providers/AskBloomProvider";

const DEFAULT_MODE: BloomMode = "standard";
const DEFAULT_MODEL: BloomModelPreference = "auto";

type AskBloomModeOption = {
  mode: BloomMode;
  label: string;
  triggerLabel: string;
  description: string;
  shortcut: string;
  Icon: LucideIcon;
};

type AskBloomModelOption = {
  value: BloomModelPreference;
  label: string;
  description: string;
};

const modeOptions: AskBloomModeOption[] = [
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

const modelOptions: AskBloomModelOption[] = [
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

const getModeOption = (mode: BloomMode): AskBloomModeOption =>
  modeOptions.find((option) => option.mode === mode) ?? modeOptions[0];

const getModelOption = (value: BloomModelPreference): AskBloomModelOption =>
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

type AskBloomOptionsPopoverProps = {
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

function AskBloomOptionsPopover({
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
}: AskBloomOptionsPopoverProps) {
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

type AskBloomSelectedToolBadgeProps = {
  Icon: LucideIcon;
  label: string;
  onRemove: () => void;
};

function AskBloomSelectedToolBadge({
  Icon,
  label,
  onRemove,
}: AskBloomSelectedToolBadgeProps) {
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

function AskBloomInput() {
  const askBloom = useAskBloom();
  const { state, sendMessage, cancelStream: stopStreaming } = askBloom;
  const navigate = useNavigate();
  const [inputValue, setInputValue] = React.useState("");
  const [isFocused, setIsFocused] = React.useState(false);
  const [activeMode, setActiveMode] = React.useState<BloomMode>(DEFAULT_MODE);
  const [modelPreference, setModelPreference] =
    React.useState<BloomModelPreference>(DEFAULT_MODEL);
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
  const previousStreamingRef = React.useRef(state.isStreaming);
  const voiceBaseValueRef = React.useRef("");
  const ignoreVoiceTranscriptRef = React.useRef(false);
  const voiceRecordingActiveRef = React.useRef(false);
  const resourceLabel = state.resourceFocus?.resourceLabel ?? null;
  const resourceType = state.resourceFocus?.resourceType ?? null;
  const trimmedValue = inputValue.trim();
  const effectiveWidth = measuredWidth ?? state.panelWidth;
  const isCompact = effectiveWidth < 360;

  const showSnackbar = React.useCallback((message: string) => {
    setSnackbarMessage(message);
  }, []);

  const focusTextarea = React.useCallback(() => {
    window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  }, []);

  const resizeTextarea = React.useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, []);

  const ensureConversationId = React.useCallback(() => {
    if (state.conversationId) {
      return Promise.resolve(state.conversationId);
    }

    return Promise.reject(
      new Error(
        "Send a message to start a conversation before attaching files.",
      ),
    );
  }, [state.conversationId]);

  const {
    addFiles,
    clearFiles,
    files,
    hasUnreadyFiles,
    isUploading,
    removeFile,
    retryFile,
  } = useBloomFileUpload({
    activeConversationId: state.conversationId,
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
  const hasSubmitContent = trimmedValue.length > 0 || hasFiles;
  const isSendInProgress =
    state.isTransitioning || state.isSendingMessage || state.isStreaming;
  const sendDisabled = !hasSubmitContent || isSendInProgress || hasUnreadyFiles;
  const attachDisabled =
    isSendInProgress || files.length >= MAX_BLOOM_ATTACHMENTS;
  const activeModeOption = getModeOption(activeMode);
  const activeModelOption = getModelOption(modelPreference);
  const showModePill = activeMode !== DEFAULT_MODE;
  const showModelPill = modelPreference !== DEFAULT_MODEL;
  const activeModelBadgeIcon = Bot;

  const updateSlashMenuState = React.useCallback((nextValue: string) => {
    setSlashMenuOpen(nextValue.trimStart().startsWith("/"));
  }, []);

  const slashActionContext = React.useMemo<BloomActionContext>(
    () => ({
      activeConversationId: state.conversationId,
      // Ask Bloom has no archive action; /clear starts a fresh conversation instead.
      archiveConversation: () => {
        askBloom.newConversation();
        return Promise.resolve();
      },
      // Ask Bloom does not expose createConversation; /new resets to a new conversation.
      createConversation: () => {
        askBloom.newConversation();
        return Promise.resolve(state.conversationId ?? "");
      },
      navigate: (path) => navigate(path),
      openShortcutsPanel: () =>
        showSnackbar("Keyboard shortcuts are available in full Bloom."),
      sendMessage: (text) => {
        sendMessage(text);
        return Promise.resolve();
      },
      setActiveMode: (mode) => setActiveMode(mode),
    }),
    [askBloom, navigate, sendMessage, showSnackbar, state.conversationId],
  );

  const setComposerValue = React.useCallback(
    (nextValue: string) => {
      setInputValue(nextValue);
      updateSlashMenuState(nextValue);
      window.setTimeout(() => {
        resizeTextarea();
        textareaRef.current?.focus();
      }, 0);
    },
    [resizeTextarea, updateSlashMenuState],
  );

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
    if (previousStreamingRef.current === state.isStreaming) {
      return;
    }

    previousStreamingRef.current = state.isStreaming;
    setStreamStatusMessage(
      state.isStreaming ? "Bloom is responding." : "Bloom response complete.",
    );
  }, [state.isStreaming]);

  React.useEffect(() => {
    if (voiceError) {
      showSnackbar(voiceError);
    }
  }, [showSnackbar, voiceError]);

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
      voiceBaseValueRef.current = inputValue;
      ignoreVoiceTranscriptRef.current = false;
      setPlusMenuOpen(false);
      setSlashMenuOpen(false);
      focusTextarea();
    }

    if (!voiceIsListening && voiceRecordingActiveRef.current) {
      setSlashMenuOpen(inputValue.trimStart().startsWith("/"));
    }

    voiceRecordingActiveRef.current = voiceIsListening;
  }, [focusTextarea, inputValue, voiceIsListening]);

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
    setInputValue(nextValue);
    updateSlashMenuState(nextValue);
    resetVoiceTranscript();
    focusTextarea();
  }, [
    focusTextarea,
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
    setInputValue(nextValue);
    updateSlashMenuState(nextValue);
  }, [updateSlashMenuState, voiceInterimTranscript, voiceIsListening]);

  const closeOptions = React.useCallback(() => {
    setOptionsAnchor(null);
    focusTextarea();
  }, [focusTextarea]);

  const handleDropRejected = React.useCallback(
    (fileRejections: FileRejection[]) => {
      for (const rejection of fileRejections) {
        const errorCode = rejection.errors[0]?.code;
        if (errorCode === "file-too-large") {
          showSnackbar(`${rejection.file.name} exceeds the 10MB limit`);
        } else if (errorCode === "too-many-files") {
          showSnackbar(`You can attach up to ${MAX_BLOOM_ATTACHMENTS} files`);
        } else {
          showSnackbar(`${rejection.file.name} is not a supported file type`);
        }
      }
    },
    [showSnackbar],
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
          showSnackbar("Unknown command. Try /customers, /stats, or /help.");
          return;
        }

        await executeSlashCommand(
          matched.command,
          matched.params,
          slashActionContext,
        );
      } else {
        // TODO: Forward activeMode, modelPreference, and ready attachments once
        // AskBloomProvider.sendMessage and useAskBloomStreaming accept mode/model/attachment payloads.
        sendMessage(message);
        if (hasFiles) {
          showSnackbar("Attachments aren't sent yet — coming soon.");
        }
      }

      setInputValue("");
      setSlashMenuOpen(false);
      if (hasFiles) {
        files.forEach((file) => removeFile(file.id));
      } else {
        clearFiles();
      }
      window.setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
        focusTextarea();
      }, 0);
    } catch (error) {
      showSnackbar(
        error instanceof Error ? error.message : "Unable to run that command.",
      );
    }
  }, [
    clearFiles,
    files,
    focusTextarea,
    hasFiles,
    removeFile,
    sendDisabled,
    sendMessage,
    showSnackbar,
    slashActionContext,
    stopVoiceListening,
    trimmedValue,
    voiceIsListening,
  ]);

  const handleInputChange = React.useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputValue(event.target.value);
      updateSlashMenuState(event.target.value);
      resizeTextarea();
    },
    [resizeTextarea, updateSlashMenuState],
  );

  const handleInputKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const modifierPressed = event.metaKey || event.ctrlKey || event.altKey;

      if (
        event.key === "/" &&
        !modifierPressed &&
        !event.shiftKey &&
        inputValue.trim().length === 0
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
    [inputValue, slashMenuOpen, submitMessage],
  );

  const handleSelectMode = React.useCallback(
    (mode: BloomMode) => {
      setActiveMode(mode);
      setPlusMenuOpen(false);
      focusTextarea();
    },
    [focusTextarea],
  );

  const handleSelectModel = React.useCallback(
    (model: BloomModelPreference) => {
      setModelPreference(model);
      setPlusMenuOpen(false);
      focusTextarea();
    },
    [focusTextarea],
  );

  const handleResetMode = React.useCallback(() => {
    setActiveMode(DEFAULT_MODE);
    focusTextarea();
  }, [focusTextarea]);

  const handleResetModel = React.useCallback(() => {
    setModelPreference(DEFAULT_MODEL);
    focusTextarea();
  }, [focusTextarea]);

  const handleAttachFiles = React.useCallback(() => {
    setPlusMenuOpen(false);
    openFileDialog();
  }, [openFileDialog]);

  const handleOpenShortcuts = React.useCallback(() => {
    setPlusMenuOpen(false);
    showSnackbar("Keyboard shortcuts are available in full Bloom.");
  }, [showSnackbar]);

  const handleStartVoice = React.useCallback(() => {
    setPlusMenuOpen(false);
    setSlashMenuOpen(false);
    void startVoiceListening();
  }, [startVoiceListening]);

  const handleTogglePin = React.useCallback(() => {
    if (state.isPinned) {
      askBloom.unpinConversation();
      return;
    }

    askBloom.pinConversation();
  }, [askBloom, state.isPinned]);

  const { onKeyDown: dropzoneOnKeyDown, ...rootProps } = getRootProps();
  void dropzoneOnKeyDown;

  return (
    <Box
      ref={rootRef}
      data-ask-bloom-panel-input
      sx={{
        position: "relative",
        p: 0,
        bgcolor: "transparent",
        zIndex: 3,
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
          borderColor: isFocused
            ? "primary.outlinedColor"
            : "neutral.outlinedBorder",
          borderRadius: "var(--joy-radius-lg)",
          padding: "12px 14px 8px 14px",
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
            composerValue={inputValue}
            open={slashMenuOpen && !voiceIsListening}
            onAutocomplete={setComposerValue}
            onClose={() => setSlashMenuOpen(false)}
            onExecuted={() => {
              setInputValue("");
              setSlashMenuOpen(false);
              window.setTimeout(() => {
                if (textareaRef.current) {
                  textareaRef.current.style.height = "auto";
                }
                focusTextarea();
              }, 0);
            }}
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
            <Box
              component="textarea"
              ref={textareaRef}
              aria-label="Ask Bloom message"
              aria-disabled={isSendInProgress}
              data-ask-bloom-panel-input="true"
              placeholder="What can we help you with?"
              value={inputValue}
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
                minHeight: 24,
                maxHeight: 120,
                overflowY: "auto",
                fontSize: "var(--joy-fontSize-sm)",
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
          )}
        </Box>

        {hasFiles ? (
          <Box sx={{ mt: "8px" }}>
            <BloomFilePreview
              files={files}
              onRemove={removeFile}
              onRetry={retryFile}
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

            {!isCompact ? (
              <AskBloomOptionsPopover
                anchor={optionsAnchor}
                buttonRef={optionsButtonRef}
                isPinned={state.isPinned}
                resourceLabel={resourceLabel}
                resourceType={resourceType}
                onClearFocus={askBloom.clearResourceFocus}
                onClose={closeOptions}
                onNewConversation={askBloom.newConversation}
                onOpenChange={setOptionsAnchor}
                onTogglePin={handleTogglePin}
                onUnsupported={showSnackbar}
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
                  <AskBloomSelectedToolBadge
                    Icon={activeModeOption.Icon}
                    label={`${activeModeOption.label} mode`}
                    onRemove={handleResetMode}
                  />
                ) : null}

                {showModelPill ? (
                  <AskBloomSelectedToolBadge
                    Icon={activeModelBadgeIcon}
                    label={`${activeModelOption.label} model`}
                    onRemove={handleResetModel}
                  />
                ) : null}
              </Box>
            ) : null}
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }} />

          {voiceIsSupported ? (
            <JoyTooltip
              title={voiceIsListening ? "Stop recording" : "Voice input"}
              placement="top"
            >
              <IconButton
                aria-label={voiceIsListening ? "Stop recording" : "Voice input"}
                color={voiceIsListening ? "danger" : "neutral"}
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
                    ? "askBloomVoiceButtonPulse 1s ease-in-out infinite"
                    : "none",
                  "&:hover": {
                    bgcolor: "background.level2",
                    opacity: voiceIsListening ? 1 : 1,
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
                          "askBloomVoiceRingPulse 1.2s ease-out infinite",
                      }
                    : undefined,
                  "@keyframes askBloomVoiceButtonPulse": {
                    "0%, 100%": { transform: "scale(1)" },
                    "50%": { transform: "scale(1.08)" },
                  },
                  "@keyframes askBloomVoiceRingPulse": {
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

          <JoyTooltip
            title={
              state.isStreaming
                ? "Stop response"
                : state.isSendingMessage
                  ? "Sending message"
                  : "Send message"
            }
            placement="top"
          >
            <Box sx={{ display: "inline-flex", flexShrink: 0 }}>
              <IconButton
                aria-label={
                  state.isStreaming
                    ? "Stop response"
                    : state.isSendingMessage
                      ? "Sending message"
                      : "Send message"
                }
                color={state.isStreaming ? "danger" : "primary"}
                disabled={!state.isStreaming && sendDisabled}
                size="sm"
                variant={state.isStreaming ? "outlined" : "solid"}
                onClick={
                  state.isStreaming ? stopStreaming : () => void submitMessage()
                }
                sx={{
                  width: 30,
                  height: 30,
                  minWidth: 30,
                  minHeight: 30,
                  borderRadius: "50%",
                  p: 0,
                  transition:
                    "background-color 150ms ease, border-color 150ms ease, color 150ms ease, transform 150ms ease, opacity 150ms ease",
                  "&:hover": state.isStreaming
                    ? {
                        bgcolor: "danger.softBg",
                        transform: "scale(1.06)",
                      }
                    : {
                        transform: "scale(1.06)",
                      },
                  "&:active": {
                    transform: "scale(0.95)",
                  },
                  "&.Mui-disabled": {
                    opacity: 0.35,
                    cursor: "not-allowed",
                    transform: "none",
                  },
                  "&.Mui-disabled:hover": {
                    transform: "none",
                  },
                }}
              >
                {state.isStreaming ? (
                  <Square size={12} fill="currentColor" strokeWidth={0} />
                ) : state.isSendingMessage ? (
                  <CircularProgress
                    color="primary"
                    size="sm"
                    sx={{
                      "--CircularProgress-size": "16px",
                      "--CircularProgress-trackThickness": "2px",
                      "--CircularProgress-progressThickness": "2px",
                    }}
                  />
                ) : isUploading ? (
                  <CircularProgress
                    color="primary"
                    size="sm"
                    sx={{
                      "--CircularProgress-size": "16px",
                      "--CircularProgress-trackThickness": "2px",
                      "--CircularProgress-progressThickness": "2px",
                    }}
                  />
                ) : (
                  <ArrowUp size={16} strokeWidth={2.5} />
                )}
              </IconButton>
            </Box>
          </JoyTooltip>
        </Box>
      </Box>

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

export default AskBloomInput;
