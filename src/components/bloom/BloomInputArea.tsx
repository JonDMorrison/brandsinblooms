import * as React from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/joy/Box";
import CircularProgress from "@mui/joy/CircularProgress";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Typography from "@mui/joy/Typography";
import { AnimatePresence, motion } from "framer-motion";
import { useDropzone, type FileRejection } from "react-dropzone";
import { toast } from "sonner";
import { ArrowUp, Plus, Square, X } from "lucide-react";
import { BloomFilePreview } from "@/components/bloom/BloomFilePreview";
import { BloomPlusMenu } from "@/components/bloom/BloomPlusMenu";
import {
  BloomSlashMenu,
  type BloomSlashMenuHandle,
} from "@/components/bloom/BloomSlashMenu";
import { BloomVoiceInput } from "@/components/bloom/BloomVoiceInput";
import { BloomVoiceWaveform } from "@/components/bloom/BloomVoiceWaveform";
import { JoyTextarea } from "@/components/joy/JoyTextarea";
import { JoyTooltip } from "@/components/joy/JoyTooltip";
import {
  executeSlashCommand,
  matchSlashCommand,
} from "@/components/bloom/utils/slashCommandRegistry";
import { useBloom } from "@/components/bloom/BloomContext";
import {
  BLOOM_ATTACHMENT_ACCEPT,
  MAX_BLOOM_ATTACHMENT_BYTES,
  MAX_BLOOM_ATTACHMENTS,
} from "@/components/bloom/bloomFileUtils";
import { useBloomFileUpload } from "@/hooks/bloom/useBloomFileUpload";
import { useBloomVoiceInput } from "@/hooks/bloom/useBloomVoiceInput";
import type {
  BloomMode,
  BloomModelPreference,
  BloomPageCategory,
} from "@/hooks/bloom/types";

const DEFAULT_MODE: BloomMode = "standard";
const DEFAULT_MODEL: BloomModelPreference = "auto";

const modeOptions: Array<{
  mode: BloomMode;
  label: string;
  description: string;
  shortcut: string;
}> = [
  {
    mode: "standard",
    label: "Standard",
    description: "Balanced responses",
    shortcut: "⌘1",
  },
  {
    mode: "reasoning",
    label: "Reasoning",
    description: "Step-by-step thinking",
    shortcut: "⌘2",
  },
  {
    mode: "research",
    label: "Research",
    description: "Multi-step analysis",
    shortcut: "⌘3",
  },
  {
    mode: "image",
    label: "Image",
    description: "Generate images",
    shortcut: "⌘4",
  },
];

const modelPreferenceOptions: Array<{
  value: BloomModelPreference;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    value: "auto",
    label: "Auto",
    shortLabel: "A",
    description: "Best model per query",
  },
  {
    value: "standard",
    label: "Standard",
    shortLabel: "S",
    description: "Faster responses",
  },
  {
    value: "pro",
    label: "Pro",
    shortLabel: "P",
    description: "Strongest analysis",
  },
];

const PAGE_PLACEHOLDERS: Partial<Record<BloomPageCategory, string>> = {
  dashboard: "Ask about today's performance...",
  customers: "Ask about your customers...",
  campaigns: "Ask about your campaigns...",
  products: "Ask about your products...",
  segments: "Ask about your segments...",
  analytics: "Ask about your analytics...",
  integrations: "Ask about your integrations...",
  settings: "Ask about your settings...",
};

const toolbarIconButtonSx = {
  width: 32,
  height: 32,
  minWidth: 32,
  minHeight: 32,
  borderRadius: "var(--joy-radius-md)",
  color: "neutral.600",
  "&:hover": {
    backgroundColor: "neutral.100",
    color: "neutral.800",
  },
  "&.Mui-focusVisible, &:focus-visible": {
    outline: 0,
    boxShadow: "0 0 0 2px rgba(var(--joy-palette-primary-mainChannel) / 0.18)",
  },
} as const;

const selectedPillSx = {
  appearance: "none",
  minWidth: 0,
  maxWidth: { xs: 96, sm: 128 },
  minHeight: 32,
  p: 0.25,
  border: "1px solid",
  borderColor: "primary.200",
  borderRadius: "var(--joy-radius-lg)",
  backgroundColor: "primary.50",
  color: "primary.800",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 0.25,
  flexShrink: 1,
  overflow: "hidden",
  transition:
    "color 150ms ease, background-color 150ms ease, border-color 150ms ease, transform 150ms ease",
  userSelect: "none",
  "&:hover": {
    backgroundColor: "primary.100",
    borderColor: "primary.300",
    color: "primary.900",
  },
  "&:hover .bloom-selected-pill-label, &:focus-visible .bloom-selected-pill-label":
    {
      backgroundColor: "background.surface",
    },
  "&:hover .bloom-selected-pill-clear, &:focus-visible .bloom-selected-pill-clear":
    {
      width: 22,
      opacity: 0.68,
      backgroundColor: "rgba(var(--joy-palette-primary-mainChannel) / 0.16)",
    },
  "&:active": {
    transform: "scale(0.98)",
  },
  "&:focus-visible": {
    outline: 0,
    boxShadow: "0 0 0 2px rgba(var(--joy-palette-primary-mainChannel) / 0.18)",
  },
} as const;

const selectedPillLabelSx = {
  minWidth: 0,
  minHeight: 26,
  px: 1,
  borderRadius: "calc(var(--joy-radius-lg) - 3px)",
  backgroundColor: "background.surface",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "background-color 150ms ease",
} as const;

const selectedPillClearSx = {
  width: 0,
  height: 26,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "calc(var(--joy-radius-lg) - 3px)",
  backgroundColor: "rgba(var(--joy-palette-primary-mainChannel) / 0.12)",
  color: "primary.800",
  flexShrink: 0,
  opacity: 0,
  overflow: "hidden",
  transition:
    "width 120ms ease, opacity 120ms ease, background-color 150ms ease",
} as const;

const getModelPreferenceOption = (value: BloomModelPreference) =>
  modelPreferenceOptions.find((option) => option.value === value) ??
  modelPreferenceOptions[0];

const getFileOnlyPrompt = (fileCount: number) =>
  fileCount === 1 ? "Review the attached file." : "Review the attached files.";

const normalizeVoiceTranscript = (transcript: string) =>
  transcript.replace(/\s+/g, " ").trim();

const appendVoiceTranscript = (baseValue: string, transcript: string) => {
  const normalizedTranscript = normalizeVoiceTranscript(transcript);
  if (!normalizedTranscript) {
    return baseValue;
  }

  const needsLeadingSpace = baseValue.length > 0 && !/\s$/.test(baseValue);
  return `${baseValue}${needsLeadingSpace ? " " : ""}${normalizedTranscript}`;
};

const formatRecordingElapsed = (elapsedSeconds: number) => {
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export function BloomInputArea() {
  const navigate = useNavigate();
  const {
    activeConversationId,
    activeMode,
    archiveConversation,
    createConversation,
    isStreaming,
    modelPreference,
    openShortcutsPanel,
    pageContext,
    composerDraft,
    registerComposerController,
    sendMessage,
    setActiveMode,
    setComposerDraft,
    setModelPreference,
  } = useBloom();
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const slashMenuRef = React.useRef<BloomSlashMenuHandle | null>(null);
  const composerContainerRef = React.useRef<HTMLDivElement | null>(null);
  const value = composerDraft;
  const setValue = setComposerDraft;
  const [composerFocused, setComposerFocused] = React.useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = React.useState(false);
  const [slashMenuOpen, setSlashMenuOpen] = React.useState(false);
  const [recordingElapsedSeconds, setRecordingElapsedSeconds] =
    React.useState(0);
  const voiceBaseValueRef = React.useRef("");
  const ignoreVoiceTranscriptRef = React.useRef(false);
  const voiceRecordingActiveRef = React.useRef(false);
  const plusButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const trimmedValue = value.trim();
  const hasText = value.length > 0;
  const ensureConversationId = React.useCallback(
    () =>
      activeConversationId
        ? Promise.resolve(activeConversationId)
        : createConversation(),
    [activeConversationId, createConversation],
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
    activeConversationId,
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
  const canSubmit = Boolean(trimmedValue || hasFiles);
  const sendDisabled = !canSubmit || isStreaming || hasUnreadyFiles;
  const attachDisabled = isStreaming || files.length >= MAX_BLOOM_ATTACHMENTS;
  const visibleModeOptions = modeOptions;
  const activeModeOption =
    visibleModeOptions.find((option) => option.mode === activeMode) ??
    visibleModeOptions[0] ??
    modeOptions[0];
  const activeModelOption = getModelPreferenceOption(modelPreference);
  const showModePill = activeMode !== DEFAULT_MODE;
  const showModelPill = modelPreference !== DEFAULT_MODEL;
  const placeholder =
    activeMode === "image"
      ? "Describe the image you'd like to create..."
      : (PAGE_PLACEHOLDERS[pageContext?.pageCategory ?? "other"] ??
        "Ask Bloom anything...");
  const slashActionContext = React.useMemo(
    () => ({
      activeConversationId,
      archiveConversation,
      createConversation,
      navigate,
      openShortcutsPanel,
      sendMessage: (text: string) => sendMessage(text),
      setActiveMode,
    }),
    [
      activeConversationId,
      archiveConversation,
      createConversation,
      navigate,
      openShortcutsPanel,
      sendMessage,
      setActiveMode,
    ],
  );

  const focusComposer = React.useCallback(
    (selection: "end" | "select-all" | "start" = "end") => {
      if (typeof window === "undefined") {
        return;
      }

      window.setTimeout(() => {
        const textarea = textareaRef.current;
        if (!textarea) {
          return;
        }

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
    [],
  );

  const updateSlashMenuState = React.useCallback((nextValue: string) => {
    setSlashMenuOpen(nextValue.trimStart().startsWith("/"));
  }, []);

  const setComposerValue = React.useCallback(
    (
      nextValue: string,
      options?: {
        focus?: boolean;
        selection?: "end" | "select-all" | "start";
      },
    ) => {
      setValue(nextValue);
      updateSlashMenuState(nextValue);
      setPlusMenuOpen(false);

      if (options?.focus ?? true) {
        focusComposer(options?.selection ?? "end");
      }
    },
    [focusComposer, setValue, updateSlashMenuState],
  );

  const handleSlashCommandExecuted = React.useCallback(() => {
    setValue("");
    setSlashMenuOpen(false);
    clearFiles();
  }, [clearFiles, setValue]);

  React.useEffect(() => {
    registerComposerController({
      focus: focusComposer,
      getValue: () => value,
      isFocused: () =>
        typeof document !== "undefined" &&
        document.activeElement === textareaRef.current,
      isSlashMenuOpen: () => slashMenuOpen,
      setSlashMenuOpen,
      setValue: setComposerValue,
    });

    return () => {
      registerComposerController(null);
    };
  }, [
    focusComposer,
    registerComposerController,
    setComposerValue,
    slashMenuOpen,
    value,
  ]);

  React.useEffect(() => {
    if (voiceError) {
      toast.error(voiceError);
    }
  }, [voiceError]);

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
      focusComposer("end");
    }

    if (!voiceIsListening && voiceRecordingActiveRef.current) {
      setSlashMenuOpen(value.trimStart().startsWith("/"));
    }

    voiceRecordingActiveRef.current = voiceIsListening;
  }, [focusComposer, value, voiceIsListening]);

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
    setValue(nextValue);
    updateSlashMenuState(nextValue);
    resetVoiceTranscript();
    focusComposer("end");
  }, [
    focusComposer,
    resetVoiceTranscript,
    setValue,
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
    setValue(nextValue);
    updateSlashMenuState(nextValue);
    focusComposer("end");
  }, [
    focusComposer,
    setValue,
    updateSlashMenuState,
    voiceInterimTranscript,
    voiceIsListening,
  ]);

  const handleStartVoiceInput = React.useCallback(() => {
    setPlusMenuOpen(false);
    setSlashMenuOpen(false);
    void startVoiceListening();
  }, [startVoiceListening]);

  const handleStopVoiceInput = React.useCallback(() => {
    stopVoiceListening();
  }, [stopVoiceListening]);

  const handleDropRejected = React.useCallback(
    (fileRejections: FileRejection[]) => {
      if (fileRejections.length === 0) {
        return;
      }

      for (const rejection of fileRejections) {
        const errorCode = rejection.errors[0]?.code;
        if (errorCode === "file-too-large") {
          toast.error("File exceeds 10MB limit", {
            description: rejection.file.name,
          });
        } else if (errorCode === "too-many-files") {
          toast.error("You can attach up to 3 files per message.");
        } else {
          toast.error("File type not supported", {
            description: rejection.file.name,
          });
        }
      }
    },
    [],
  );

  const { getInputProps, getRootProps, isDragActive, open } = useDropzone({
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
        const matchedCommand = matchSlashCommand(message);

        if (!matchedCommand) {
          toast.error("Unknown slash command", {
            description: "Try /customers, /stats, /navigate, or /help.",
          });
          return;
        }

        await executeSlashCommand(
          matchedCommand.command,
          matchedCommand.params,
          {
            activeConversationId,
            archiveConversation,
            createConversation,
            navigate,
            openShortcutsPanel,
            sendMessage: (text) => sendMessage(text),
            setActiveMode,
          },
        );
      } else {
        await sendMessage(message, attachments);
      }

      setValue("");
      setSlashMenuOpen(false);
      clearFiles();
    } catch (error) {
      if (error instanceof Error) {
        toast.error("Unable to run Bloom command", {
          description: error.message,
        });
      }

      // The mutation hook owns user-facing error feedback.
    }
  }, [
    activeConversationId,
    archiveConversation,
    attachments,
    clearFiles,
    createConversation,
    files.length,
    navigate,
    openShortcutsPanel,
    sendDisabled,
    sendMessage,
    setActiveMode,
    setValue,
    stopVoiceListening,
    trimmedValue,
    voiceIsListening,
  ]);

  const handleComposerBlur = React.useCallback(
    (event: React.FocusEvent<HTMLElement>) => {
      const nextFocus = event.relatedTarget;

      if (
        nextFocus instanceof Node &&
        event.currentTarget.contains(nextFocus)
      ) {
        return;
      }

      setComposerFocused(false);
    },
    [],
  );

  const clearComposer = () => {
    setComposerValue("", { focus: true });
    voiceBaseValueRef.current = "";
    resetVoiceTranscript();
  };

  const handleAttachFiles = () => {
    open();
    setPlusMenuOpen(false);
  };

  const handleSelectMode = (mode: BloomMode) => {
    setActiveMode(mode);
    setPlusMenuOpen(false);
  };

  const handleSelectModel = (model: BloomModelPreference) => {
    setModelPreference(model);
    setPlusMenuOpen(false);
  };

  const handleResetMode = () => {
    setActiveMode(DEFAULT_MODE);
    setPlusMenuOpen(false);
  };

  const handleResetModel = () => {
    setModelPreference(DEFAULT_MODEL);
    setPlusMenuOpen(false);
  };

  const handleOpenShortcuts = () => {
    setPlusMenuOpen(false);
    openShortcutsPanel();
  };

  return (
    <Box
      {...getRootProps()}
      sx={{
        flexShrink: 0,
        px: { xs: 1.25, sm: 2.5 },
        pt: { xs: 1, sm: 1.25 },
        pb: { xs: 1.25, sm: 5 },
        display: "flex",
        justifyContent: "center",
      }}
    >
      <Sheet
        variant="outlined"
        onBlurCapture={handleComposerBlur}
        onFocusCapture={() => setComposerFocused(true)}
        sx={{
          position: "relative",
          flexShrink: 0,
          width: { xs: "100%", sm: "min(100%, 52rem)" },
          transform: {
            xs: "translateY(-8px)",
            sm: "translateY(-14px)",
          },
          zIndex: 1,
          borderRadius: "16px",
          borderStyle: isDragActive ? "dashed" : "solid",
          borderColor: isDragActive
            ? "primary.300"
            : composerFocused
              ? "primary.300"
              : "neutral.200",
          backgroundColor: "background.surface",
          boxShadow: composerFocused
            ? "var(--joy-shadow-sm), 0 0 0 2px rgba(var(--joy-palette-primary-mainChannel) / 0.12)"
            : "var(--joy-shadow-sm)",
          overflow: "visible",
          transition:
            "border-color 150ms cubic-bezier(0.4, 0, 0.2, 1), border-style 150ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              zIndex: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "background.surface",
              color: "primary.700",
              fontSize: "var(--joy-fontSize-sm)",
              fontWeight: "var(--joy-fontWeight-md)",
              pointerEvents: "none",
            }}
          >
            Drop files here
          </Box>
        ) : null}

        <Box
          ref={composerContainerRef}
          sx={{
            position: "relative",
            minWidth: 0,
            pb: { xs: 0.75, sm: 4 },
            px: { xs: 1.5, sm: 1.5 },
          }}
        >
          <BloomSlashMenu
            ref={slashMenuRef}
            open={slashMenuOpen}
            anchorRef={composerContainerRef}
            composerValue={value}
            actionContext={slashActionContext}
            onAutocomplete={(nextValue) => {
              setComposerValue(nextValue, {
                focus: true,
                selection: "end",
              });
            }}
            onClose={() => setSlashMenuOpen(false)}
            onExecuted={handleSlashCommandExecuted}
          />

          <Box
            sx={{
              position: "relative",
              px: { xs: 2, sm: 4 },
              pt: { xs: 1.75, sm: 4 },
              pb: { xs: 0.75, sm: 4 },
            }}
          >
            <JoyTextarea
              ref={textareaRef}
              aria-label="Ask Bloom anything"
              minRows={3}
              maxRows={8}
              value={value}
              disabled={isStreaming}
              placeholder={placeholder}
              variant="plain"
              onValueChange={(nextValue) => {
                setValue(nextValue);
                updateSlashMenuState(nextValue);
              }}
              onKeyDown={(event: React.KeyboardEvent<HTMLTextAreaElement>) => {
                const modifierPressed =
                  event.metaKey || event.ctrlKey || event.altKey;

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

                if (event.key !== "Enter" || event.shiftKey) {
                  return;
                }

                event.preventDefault();
                void submitMessage();
              }}
              formControlSx={{ minWidth: 0 }}
              sx={{
                minHeight: "auto",
                borderRadius: 0,
                borderColor: "transparent",
                backgroundColor: "transparent",
                boxShadow: "none",
                color: "neutral.800",
                "--Textarea-paddingBlock": "0px",
                "--Textarea-paddingInline": "0px",
                "--Textarea-focusedThickness": "0px",
                "&:hover:not([data-disabled='true'])": {
                  borderColor: "transparent",
                  backgroundColor: "transparent",
                },
                "&:focus-within": {
                  borderColor: "transparent",
                  boxShadow: "none",
                },
                "&.Mui-focusVisible, &:focus-visible": {
                  outline: 0,
                  borderColor: "transparent",
                  boxShadow: "none",
                },
                "&[data-disabled='true'], &[aria-disabled='true']": {
                  borderColor: "transparent",
                  backgroundColor: "transparent",
                },
                "& .MuiTextarea-textarea": {
                  minHeight: 24,
                  resize: "none",
                  fontSize: "var(--joy-fontSize-md)",
                  lineHeight: "var(--joy-lineHeight-md)",
                },
              }}
            />
          </Box>

          {hasFiles ? (
            <Box sx={{ px: { xs: 2, sm: 2.5 }, py: { xs: 0.75, sm: 1 } }}>
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
              justifyContent: "space-between",
              gap: 1,
              px: { xs: 1.25, sm: 1.5 },
              py: { xs: 1, sm: 1.25 },
              minWidth: 0,
            }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
              }}
            >
              <AnimatePresence mode="wait" initial={false}>
                {voiceIsListening ? (
                  <motion.div
                    key="recording"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.12, ease: "easeOut" }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flex: 1,
                      minWidth: 0,
                      width: "100%",
                    }}
                  >
                    <Box
                      sx={{
                        flex: 1,
                        minWidth: 48,
                        height: 32,
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {voiceAnalyserNode ? (
                        <BloomVoiceWaveform
                          analyserNode={voiceAnalyserNode}
                          isRecording={voiceIsListening}
                        />
                      ) : (
                        <Box
                          aria-hidden="true"
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: 999,
                            backgroundColor: "danger.500",
                            animation:
                              "bloomVoiceFallbackPulse 1s ease-in-out infinite",
                            "@keyframes bloomVoiceFallbackPulse": {
                              "0%, 100%": {
                                opacity: 0.42,
                                transform: "scale(1)",
                              },
                              "50%": { opacity: 1, transform: "scale(1.35)" },
                            },
                            "@media (prefers-reduced-motion: reduce)": {
                              animation: "none",
                            },
                          }}
                        />
                      )}
                    </Box>

                    <Typography
                      level="body-xs"
                      aria-live="polite"
                      sx={{
                        color: "neutral.500",
                        fontVariantNumeric: "tabular-nums",
                        fontWeight: 600,
                        minWidth: 36,
                        textAlign: "right",
                      }}
                    >
                      {formatRecordingElapsed(recordingElapsedSeconds)}
                    </Typography>

                    <JoyTooltip title="Stop recording">
                      <Box sx={{ display: "inline-flex", flexShrink: 0 }}>
                        <IconButton
                          aria-label="Stop recording"
                          color="danger"
                          size="sm"
                          variant="soft"
                          onClick={handleStopVoiceInput}
                          sx={{
                            ...toolbarIconButtonSx,
                            color: "danger.700",
                            backgroundColor: "danger.100",
                            "&:hover": {
                              backgroundColor: "danger.200",
                              color: "danger.800",
                            },
                          }}
                        >
                          <Square
                            size={13}
                            strokeWidth={2.2}
                            fill="currentColor"
                          />
                        </IconButton>
                      </Box>
                    </JoyTooltip>
                  </motion.div>
                ) : (
                  <motion.div
                    key="normal"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.12, ease: "easeOut" }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      minWidth: 0,
                    }}
                  >
                    <Box
                      sx={{
                        position: "relative",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 0.75,
                        minWidth: 0,
                      }}
                    >
                      <JoyTooltip
                        title={plusMenuOpen ? "Close actions" : "Open actions"}
                      >
                        <Box sx={{ display: "inline-flex", flexShrink: 0 }}>
                          <IconButton
                            ref={plusButtonRef}
                            aria-label={
                              plusMenuOpen
                                ? "Close Bloom actions"
                                : "Open Bloom actions"
                            }
                            aria-expanded={plusMenuOpen}
                            aria-haspopup="menu"
                            color="neutral"
                            size="sm"
                            variant="plain"
                            onClick={() =>
                              setPlusMenuOpen((currentValue) => !currentValue)
                            }
                            sx={toolbarIconButtonSx}
                          >
                            <Box
                              component="span"
                              sx={{
                                display: "inline-flex",
                                transform: plusMenuOpen
                                  ? "rotate(45deg)"
                                  : "rotate(0deg)",
                                transition: "transform 200ms ease",
                              }}
                            >
                              <Plus size={18} strokeWidth={1.9} />
                            </Box>
                          </IconButton>
                        </Box>
                      </JoyTooltip>

                      <BloomPlusMenu
                        activeMode={activeMode}
                        activeModel={modelPreference}
                        modelOptions={modelPreferenceOptions}
                        onAttachFiles={handleAttachFiles}
                        onClose={() => setPlusMenuOpen(false)}
                        onOpenShortcuts={handleOpenShortcuts}
                        onSelectMode={handleSelectMode}
                        onSelectModel={handleSelectModel}
                        open={plusMenuOpen}
                        triggerRef={plusButtonRef}
                        visibleModeOptions={visibleModeOptions}
                      />

                      {showModePill || showModelPill ? (
                        <Box
                          sx={{
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 0.5,
                            minWidth: 0,
                          }}
                        >
                          {showModePill ? (
                            <Box
                              component="button"
                              type="button"
                              aria-pressed="true"
                              aria-label={`Reset mode from ${activeModeOption.label} to Standard`}
                              onClick={handleResetMode}
                              sx={selectedPillSx}
                            >
                              <Box
                                component="span"
                                className="bloom-selected-pill-label"
                                sx={selectedPillLabelSx}
                              >
                                <Typography
                                  level="body-xs"
                                  noWrap
                                  sx={{
                                    color: "inherit",
                                    fontWeight: 600,
                                    minWidth: 0,
                                  }}
                                >
                                  {activeModeOption.label}
                                </Typography>
                              </Box>
                              <Box
                                component="span"
                                aria-hidden="true"
                                className="bloom-selected-pill-clear"
                                sx={selectedPillClearSx}
                              >
                                <X size={14} strokeWidth={2} />
                              </Box>
                            </Box>
                          ) : null}

                          {showModelPill ? (
                            <Box
                              component="button"
                              type="button"
                              aria-pressed="true"
                              aria-label={`Reset model from ${activeModelOption.label} to Auto`}
                              onClick={handleResetModel}
                              sx={selectedPillSx}
                            >
                              <Box
                                component="span"
                                className="bloom-selected-pill-label"
                                sx={selectedPillLabelSx}
                              >
                                <Typography
                                  level="body-xs"
                                  noWrap
                                  sx={{
                                    color: "inherit",
                                    fontWeight: 600,
                                    minWidth: 0,
                                  }}
                                >
                                  {activeModelOption.label}
                                </Typography>
                              </Box>
                              <Box
                                component="span"
                                aria-hidden="true"
                                className="bloom-selected-pill-clear"
                                sx={selectedPillClearSx}
                              >
                                <X size={14} strokeWidth={2} />
                              </Box>
                            </Box>
                          ) : null}
                        </Box>
                      ) : null}
                    </Box>
                  </motion.div>
                )}
              </AnimatePresence>
            </Box>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 0.5,
                flexShrink: 0,
              }}
            >
              {voiceIsListening ? null : hasText ? (
                <JoyTooltip title="Clear message">
                  <Box sx={{ display: "inline-flex", flexShrink: 0 }}>
                    <IconButton
                      aria-label="Clear message"
                      color="neutral"
                      disabled={isStreaming}
                      size="sm"
                      variant="plain"
                      onClick={clearComposer}
                      sx={toolbarIconButtonSx}
                    >
                      <X size={18} strokeWidth={1.9} />
                    </IconButton>
                  </Box>
                </JoyTooltip>
              ) : (
                <BloomVoiceInput
                  disabled={isStreaming}
                  isSupported={voiceIsSupported}
                  onStartListening={handleStartVoiceInput}
                />
              )}

              <IconButton
                aria-label={isUploading ? "Uploading files" : "Send message"}
                color="primary"
                disabled={sendDisabled}
                size="sm"
                variant="solid"
                onClick={() => {
                  void submitMessage();
                }}
                sx={{
                  width: 32,
                  height: 32,
                  minWidth: 32,
                  minHeight: 32,
                  flexShrink: 0,
                  borderRadius: "var(--joy-radius-md)",
                  "&.Mui-disabled": {
                    opacity: 0.42,
                  },
                }}
              >
                {isStreaming || isUploading ? (
                  <CircularProgress
                    size="sm"
                    thickness={3}
                    sx={{ "--CircularProgress-size": "16px", color: "inherit" }}
                  />
                ) : (
                  <ArrowUp size={18} strokeWidth={2.15} />
                )}
              </IconButton>
            </Box>
          </Box>
        </Box>
      </Sheet>
    </Box>
  );
}
