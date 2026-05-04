import React from "react";
import Box from "@mui/joy/Box";
import Drawer from "@mui/joy/Drawer";
import Tab from "@mui/joy/Tab";
import TabList from "@mui/joy/TabList";
import Tabs from "@mui/joy/Tabs";
import useMediaQuery from "@mui/material/useMediaQuery";
import { supabase } from "@/integrations/supabase/client";
import { useAIImageGeneration } from "@/hooks/useAIImageGeneration";
import { AIChatPersistenceService } from "@/services/aiChatPersistence";
import type { MessageWithSession } from "@/services/aiChatPersistence";
import { toast } from "sonner";
import { AIImageStudioConversation } from "./AIImageStudioConversation";
import { AIImageStudioHeader } from "./AIImageStudioHeader";
import { AIImageStudioInputArea } from "./AIImageStudioInputArea";
import { AIImageStudioMediaBrowser } from "./AIImageStudioMediaBrowser";
import { AIImageStudioPreviewLightbox } from "./AIImageStudioPreviewLightbox";
import type {
  AIImageStudioAspectRatio,
  AIImageStudioDrawerProps,
  AIImageStudioGenerationConfig,
  AIImageStudioImageResult,
  AIImageStudioMessage,
  AIImageStudioSelectionMetadata,
  AIImageStudioTab,
} from "./types";

const DEFAULT_GENERATION_CONFIG: AIImageStudioGenerationConfig = {
  aspectRatio: "1:1",
  stylePreset: "photographic",
  quality: "standard",
};

const FALLBACK_THINKING_MESSAGES = [
  "Interpreting your vision...",
  "Composing the scene...",
  "Selecting color palette...",
  "Rendering details...",
  "Applying finishing touches...",
];

const INITIAL_HISTORY_MESSAGE_LIMIT = 100;
const LOAD_MORE_HISTORY_MESSAGE_LIMIT = 50;

const stylePromptDescriptors: Record<
  AIImageStudioGenerationConfig["stylePreset"],
  string
> = {
  photographic:
    "Photographic realism with studio-grade lighting and natural textures.",
  illustration:
    "Editorial illustration with layered botanical detail and clean composition.",
  watercolor:
    "Watercolor botanical artwork with gentle pigment bloom and paper texture.",
  minimalist:
    "Minimalist styling with restrained composition, clean negative space, and refined forms.",
  cinematic:
    "Cinematic art direction with dramatic light, atmosphere, and premium visual depth.",
};

const aspectRatioPromptDescriptors: Record<
  AIImageStudioGenerationConfig["aspectRatio"],
  string
> = {
  "1:1": "Compose the scene for a square 1:1 frame.",
  "16:9": "Compose the scene for a widescreen 16:9 frame.",
  "9:16": "Compose the scene for a portrait 9:16 frame.",
};

const qualityPromptDescriptors: Record<
  AIImageStudioGenerationConfig["quality"],
  string
> = {
  standard: "Balanced detail with clean, polished output.",
  hd: "High-definition detail with premium texture fidelity and crisp finishing.",
};

const LAST_USED_TAB_STORAGE_KEY = "ai-image-studio:last-tab";

function isAIImageStudioTab(value: string | null): value is AIImageStudioTab {
  return (
    value === "ai" ||
    value === "my-images" ||
    value === "unsplash" ||
    value === "upload"
  );
}

function normalizeThinkingMessages(thinkingText?: string | null) {
  if (!thinkingText) {
    return FALLBACK_THINKING_MESSAGES;
  }

  const extractedMessages = thinkingText
    .split(/\r?\n|(?<=[.!?])\s+/)
    .map((line) => line.replace(/^[-\d.\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 5);

  if (extractedMessages.length === 0) {
    return FALLBACK_THINKING_MESSAGES;
  }

  return extractedMessages;
}

function buildConfiguredPrompt(
  prompt: string,
  generationConfig: AIImageStudioGenerationConfig,
) {
  return [
    stylePromptDescriptors[generationConfig.stylePreset],
    aspectRatioPromptDescriptors[generationConfig.aspectRatio],
    qualityPromptDescriptors[generationConfig.quality],
    prompt,
  ].join(" ");
}

function resolveInlineError(errorText?: string | null) {
  const normalizedError = (errorText || "").toLowerCase();

  if (
    normalizedError.includes("policy") ||
    normalizedError.includes("safety") ||
    normalizedError.includes("flagged") ||
    normalizedError.includes("moderation")
  ) {
    return {
      errorKind: "policy" as const,
      message:
        "That prompt was flagged by our safety system. Try adjusting your description.",
    };
  }

  if (
    normalizedError.includes("timeout") ||
    normalizedError.includes("timed out")
  ) {
    return {
      errorKind: "timeout" as const,
      message: "Generation took too long. Let's try a simpler description.",
    };
  }

  return {
    errorKind: "api" as const,
    message: "I couldn't generate that image. Want to try again?",
  };
}

export function AIImageStudioDrawer({
  open,
  onClose,
  onImageSelect,
  aspectRatioHint,
  browseOnly = false,
  channel = "newsletter",
  contentContext = "",
  contextLabel,
  defaultTab = "ai",
  blockId,
  contextType = "email_block",
}: AIImageStudioDrawerProps) {
  const isMobile = useMediaQuery("(max-width: 767.95px)");
  const prefersReducedMotion = useMediaQuery(
    "(prefers-reduced-motion: reduce)",
  );
  const contentPaddingX = isMobile ? 2 : 3;
  const titleId = React.useId();
  const closeButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);
  const promptInputRef = React.useRef<HTMLTextAreaElement | null>(null);
  const activeGenerationRef = React.useRef<{
    loadingMessageId: string;
    prompt: string;
    requestId: string;
    sessionId: string;
  } | null>(null);
  const thinkingPhaseTimeoutRef = React.useRef<number | null>(null);
  const promptRevealSequenceRef = React.useRef(0);
  const closeAfterUseTimeoutRef = React.useRef<number | null>(null);

  const imageGenerationChannel =
    channel === "blog" || channel === "instagram" || channel === "facebook"
      ? channel
      : "newsletter";

  const [messages, setMessages] = React.useState<AIImageStudioMessage[]>([]);
  const [inputPrompt, setInputPrompt] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<AIImageStudioTab>("ai");
  const [generationConfig, setGenerationConfig] = React.useState(
    DEFAULT_GENERATION_CONFIG,
  );
  const [isEnhancing, setIsEnhancing] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [selectedImage, setSelectedImage] = React.useState<string | null>(null);
  const [selectedImageRecordId, setSelectedImageRecordId] = React.useState<
    string | null
  >(null);

  const [currentSessionId, setCurrentSessionId] = React.useState<string | null>(
    null,
  );
  const [historyLoadError, setHistoryLoadError] = React.useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = React.useState(false);
  const [isInitialLoad, setIsInitialLoad] = React.useState(true);
  const [hasMoreMessages, setHasMoreMessages] = React.useState(false);
  const [oldestLoadedTimestamp, setOldestLoadedTimestamp] = React.useState<
    string | null
  >(null);
  const [previewState, setPreviewState] = React.useState<{
    image: AIImageStudioImageResult;
    message: AIImageStudioMessage;
  } | null>(null);
  const { abortGeneration, generateSingleImageDetailed, isGenerating } =
    useAIImageGeneration();

  const lastMessageId =
    messages.length > 0 ? messages[messages.length - 1]?.id : null;

  const subtitle = React.useMemo(() => {
    if (contextLabel?.trim()) {
      return contextLabel;
    }

    if (browseOnly) {
      return "Choose from your recent images, Unsplash, or a fresh upload.";
    }

    return "Generate, browse, or upload without leaving your flow.";
  }, [browseOnly, contextLabel]);

  const clearThinkingPhaseTimer = React.useCallback(() => {
    if (thinkingPhaseTimeoutRef.current !== null) {
      window.clearTimeout(thinkingPhaseTimeoutRef.current);
      thinkingPhaseTimeoutRef.current = null;
    }
  }, []);

  const clearCloseAfterUseTimer = React.useCallback(() => {
    if (closeAfterUseTimeoutRef.current !== null) {
      window.clearTimeout(closeAfterUseTimeoutRef.current);
      closeAfterUseTimeoutRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    if (!open || isInitialLoad || !lastMessageId) {
      return;
    }

    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [isInitialLoad, lastMessageId, open]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [open]);

  React.useEffect(() => {
    return () => {
      clearThinkingPhaseTimer();
      clearCloseAfterUseTimer();
      abortGeneration();
    };
  }, [abortGeneration, clearCloseAfterUseTimer, clearThinkingPhaseTimer]);

  const initializeSession = React.useCallback(async () => {
    try {
      const sessionId = await AIChatPersistenceService.findOrCreateSession({
        contextId: blockId,
        contextType,
        channel,
      });
      setCurrentSessionId(sessionId);
    } catch (error) {
      console.error("Failed to initialize AI image studio session:", error);
      toast.error("Failed to initialize chat session");
    }
  }, [blockId, channel, contextType]);

  const convertGlobalMessagesToUI = React.useCallback(
    async (
      dbMessages: MessageWithSession[],
    ): Promise<AIImageStudioMessage[]> => {
      const uiMessages: AIImageStudioMessage[] = [];
      let lastSessionId: string | null = null;

      for (const dbMessage of dbMessages) {
        if (dbMessage.sessionId !== lastSessionId) {
          uiMessages.push({
            id: `divider-${dbMessage.sessionId}`,
            type: "session_divider",
            content: "",
            timestamp: new Date(dbMessage.session.createdAt),
            sessionInfo: {
              sessionId: dbMessage.session.id,
              title: dbMessage.session.title,
              contextType: dbMessage.session.contextType,
              channel: dbMessage.session.channel,
              createdAt: dbMessage.session.createdAt,
            },
          });
          lastSessionId = dbMessage.sessionId;
        }

        if (dbMessage.messageType === "user_prompt") {
          uiMessages.push({
            id: dbMessage.id,
            type: "user",
            content: dbMessage.content,
            prompt: dbMessage.content,
            sessionId: dbMessage.sessionId,
            timestamp: new Date(dbMessage.createdAt),
            userPrompt: dbMessage.content,
          });
          continue;
        }

        if (dbMessage.messageType === "thinking_text") {
          uiMessages.push({
            id: dbMessage.id,
            type: "thinking",
            content: dbMessage.content,
            sessionId: dbMessage.sessionId,
            timestamp: new Date(dbMessage.createdAt),
            isThinkingComplete: true,
            thinkingDuration:
              dbMessage.metadata?.thinking_duration ||
              dbMessage.metadata?.thinkingDuration,
          });
          continue;
        }

        if (dbMessage.messageType === "images") {
          const imageData = await AIChatPersistenceService.loadImagesForMessage(
            dbMessage.id,
          );

          uiMessages.push({
            id: dbMessage.id,
            type: "images",
            content: dbMessage.content,
            enhancedPrompt: imageData[0]?.enhancedPrompt,
            imageRecordIds: imageData.map((image) => image.id),
            images: imageData.map((image) => ({
              id: image.id,
              dimensions: image.dimensions,
              enhancedPrompt: image.enhancedPrompt,
              generationOrder: image.generationOrder,
              globalImageId: image.globalImageId,
              imageRecordId: image.id,
              imageUrl: image.imageUrl,
              mimeType: image.mimeType,
              tags: image.tags,
              userPrompt: image.userPrompt,
            })),
            prompt: imageData[0]?.userPrompt || undefined,
            sessionId: dbMessage.sessionId,
            timestamp: new Date(dbMessage.createdAt),
            userPrompt: imageData[0]?.userPrompt,
          });
          continue;
        }

        uiMessages.push({
          id: dbMessage.id,
          type: "assistant",
          content: dbMessage.content,
          sessionId: dbMessage.sessionId,
          timestamp: new Date(dbMessage.createdAt),
        });
      }

      return uiMessages;
    },
    [],
  );

  const loadInitialMessages = React.useCallback(async () => {
    setIsInitialLoad(true);
    setHistoryLoadError(false);

    try {
      const dbMessages = await AIChatPersistenceService.loadGlobalMessages(
        INITIAL_HISTORY_MESSAGE_LIMIT,
      );
      const uiMessages = await convertGlobalMessagesToUI(dbMessages);

      setMessages(uiMessages);
      setHasMoreMessages(dbMessages.length === INITIAL_HISTORY_MESSAGE_LIMIT);
      setOldestLoadedTimestamp(
        dbMessages.length > 0 ? dbMessages[0].createdAt : null,
      );
    } catch (error) {
      console.error("Failed to load AI image studio messages:", error);
      setHistoryLoadError(true);
      setMessages([]);
      setHasMoreMessages(false);
      setOldestLoadedTimestamp(null);
    } finally {
      setIsInitialLoad(false);
    }
  }, [convertGlobalMessagesToUI]);

  React.useEffect(() => {
    if (!open) {
      promptRevealSequenceRef.current += 1;
      clearThinkingPhaseTimer();
      clearCloseAfterUseTimer();
      abortGeneration();
      activeGenerationRef.current = null;
      setInputPrompt("");
      setGenerationConfig({
        ...DEFAULT_GENERATION_CONFIG,
        aspectRatio: aspectRatioHint || DEFAULT_GENERATION_CONFIG.aspectRatio,
      });
      setIsEnhancing(false);
      setIsSettingsOpen(false);
      setHistoryLoadError(false);
      setPreviewState(null);
      setSelectedImage(null);
      setSelectedImageRecordId(null);
      return;
    }

    const storedTab = window.sessionStorage.getItem(LAST_USED_TAB_STORAGE_KEY);
    const nextTab = isAIImageStudioTab(storedTab) ? storedTab : "ai";
    setActiveTab(defaultTab || nextTab);

    if (aspectRatioHint) {
      setGenerationConfig((currentConfig) => ({
        ...currentConfig,
        aspectRatio: aspectRatioHint,
      }));
    }

    if (blockId) {
      void initializeSession();
    }

    void loadInitialMessages();
  }, [
    abortGeneration,
    blockId,
    channel,
    clearCloseAfterUseTimer,
    clearThinkingPhaseTimer,
    contextType,
    initializeSession,
    loadInitialMessages,
    open,
    aspectRatioHint,
    defaultTab,
  ]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    window.sessionStorage.setItem(LAST_USED_TAB_STORAGE_KEY, activeTab);

    if (activeTab !== "ai") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      promptInputRef.current?.focus();
    }, 150);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeTab, open]);

  const handleSelectMedia = React.useCallback(
    async (imageUrl: string, metadata: AIImageStudioSelectionMetadata) => {
      onImageSelect(imageUrl, metadata);
      onClose();
    },
    [onClose, onImageSelect],
  );

  const buildGeneratedImageMetadata = React.useCallback(
    (image: AIImageStudioImageResult): AIImageStudioSelectionMetadata => ({
      altText:
        image.userPrompt ||
        image.enhancedPrompt ||
        contentContext ||
        "AI image",
      dimensions: image.dimensions || null,
      mimeType: image.mimeType || null,
      source: "ai-generated",
      tags: image.tags,
    }),
    [contentContext],
  );

  const loadMoreMessages = React.useCallback(async () => {
    if (!oldestLoadedTimestamp || isLoadingHistory) {
      return;
    }

    setIsLoadingHistory(true);

    try {
      const olderMessages = await AIChatPersistenceService.loadGlobalMessages(
        LOAD_MORE_HISTORY_MESSAGE_LIMIT,
        oldestLoadedTimestamp,
      );

      if (olderMessages.length === 0) {
        setHasMoreMessages(false);
        return;
      }

      const uiMessages = await convertGlobalMessagesToUI(olderMessages);
      setMessages((previousMessages) => [...uiMessages, ...previousMessages]);
      setOldestLoadedTimestamp(olderMessages[0].createdAt);
      setHasMoreMessages(
        olderMessages.length === LOAD_MORE_HISTORY_MESSAGE_LIMIT,
      );
    } catch (error) {
      console.error("Failed to load older AI image studio messages:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [convertGlobalMessagesToUI, isLoadingHistory, oldestLoadedTimestamp]);

  const handleConversationScroll = React.useCallback(() => {}, []);

  const ensureSessionId = React.useCallback(async () => {
    if (currentSessionId) {
      return currentSessionId;
    }

    const sessionId = await AIChatPersistenceService.findOrCreateSession({
      contextId: blockId || null,
      contextType,
      channel,
    });
    setCurrentSessionId(sessionId);
    return sessionId;
  }, [blockId, channel, contextType, currentSessionId]);

  const fetchThinkingMessages = React.useCallback(async (prompt: string) => {
    try {
      const { data, error } = await supabase.functions.invoke(
        "generate-thinking-text",
        {
          body: { prompt },
        },
      );

      if (error) {
        throw error;
      }

      return {
        statusMessages: normalizeThinkingMessages(data?.thinkingText),
        fullText: data?.thinkingText as string | undefined,
      };
    } catch (error) {
      console.error(
        "Failed to fetch AI image studio thinking messages:",
        error,
      );
      return {
        statusMessages: FALLBACK_THINKING_MESSAGES,
        fullText: null,
      };
    }
  }, []);

  const revealEnhancedPrompt = React.useCallback(async (text: string) => {
    const sequenceId = promptRevealSequenceRef.current + 1;
    promptRevealSequenceRef.current = sequenceId;

    setInputPrompt("");

    const words = text.split(/\s+/).filter(Boolean);
    let nextPrompt = "";

    for (const word of words) {
      if (promptRevealSequenceRef.current !== sequenceId) {
        return;
      }

      nextPrompt = nextPrompt ? `${nextPrompt} ${word}` : word;
      setInputPrompt(nextPrompt);

      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 30);
      });
    }
  }, []);

  const handleEnhancePrompt = React.useCallback(async () => {
    const trimmedPrompt = inputPrompt.trim();

    if (!trimmedPrompt || isEnhancing || isGenerating) {
      return;
    }

    setIsEnhancing(true);
    promptRevealSequenceRef.current += 1;

    try {
      const { data, error } = await supabase.functions.invoke(
        "enhance-image-prompt",
        {
          body: { prompt: trimmedPrompt },
        },
      );

      if (error) {
        throw error;
      }

      const enhancedPrompt = data?.enhancedPrompt || trimmedPrompt;
      await revealEnhancedPrompt(enhancedPrompt);

      window.requestAnimationFrame(() => {
        promptInputRef.current?.focus();
      });
    } catch (error) {
      console.error("Failed to enhance AI image studio prompt:", error);
    } finally {
      setIsEnhancing(false);
    }
  }, [inputPrompt, isEnhancing, isGenerating, revealEnhancedPrompt]);

  const generateImages = React.useCallback(
    async (prompt: string, options?: { clearPromptOnSuccess?: boolean }) => {
      const requestId = crypto.randomUUID();
      const promptWithContext = contentContext.trim()
        ? `${prompt} Context: ${contentContext.trim()}.`
        : prompt;
      const configuredPrompt = buildConfiguredPrompt(
        promptWithContext,
        generationConfig,
      );

      setSelectedImage(null);
      setSelectedImageRecordId(null);

      let sessionId: string;

      try {
        sessionId = await ensureSessionId();
      } catch (error) {
        console.error("Failed to initialize AI image studio session:", error);
        setMessages((previousMessages) => [
          ...previousMessages,
          {
            id: crypto.randomUUID(),
            type: "user",
            content: prompt,
            prompt,
            timestamp: new Date(),
            userPrompt: prompt,
          },
          {
            id: crypto.randomUUID(),
            type: "error",
            content: "I couldn't generate that image. Want to try again?",
            errorKind: "api",
            retryPrompt: prompt,
            timestamp: new Date(),
          },
        ]);
        setInputPrompt(prompt);
        return;
      }

      try {
        const userMessageId = await AIChatPersistenceService.saveMessage({
          sessionId,
          messageType: "user_prompt",
          content: prompt,
          metadata: {},
        });

        const loadingMessageId = crypto.randomUUID();

        setMessages((previousMessages) => [
          ...previousMessages,
          {
            id: userMessageId,
            type: "user",
            content: prompt,
            prompt,
            sessionId,
            timestamp: new Date(),
            userPrompt: prompt,
          },
          {
            id: loadingMessageId,
            type: "loading",
            content: "",
            loadingPhase: "acknowledged",
            prompt,
            aspectRatio: generationConfig.aspectRatio,
            generationConfig,
            sessionId,
            statusMessages: FALLBACK_THINKING_MESSAGES,
            timestamp: new Date(),
            userPrompt: prompt,
          },
        ]);

        activeGenerationRef.current = {
          loadingMessageId,
          prompt,
          requestId,
          sessionId,
        };

        clearThinkingPhaseTimer();
        thinkingPhaseTimeoutRef.current = window.setTimeout(() => {
          if (activeGenerationRef.current?.requestId !== requestId) {
            return;
          }

          setMessages((previousMessages) =>
            previousMessages.map((message) =>
              message.id === loadingMessageId
                ? {
                    ...message,
                    loadingPhase: "thinking",
                    statusMessages: FALLBACK_THINKING_MESSAGES,
                  }
                : message,
            ),
          );
        }, 1000);

        void (async () => {
          const thinkingResult = await fetchThinkingMessages(prompt);

          if (activeGenerationRef.current?.requestId !== requestId) {
            return;
          }

          setMessages((previousMessages) =>
            previousMessages.map((message) =>
              message.id === loadingMessageId
                ? {
                    ...message,
                    statusMessages: thinkingResult.statusMessages,
                  }
                : message,
            ),
          );

          if (thinkingResult.fullText) {
            await AIChatPersistenceService.saveMessage({
              sessionId,
              messageType: "thinking_text",
              content: thinkingResult.fullText,
              metadata: {},
            });
          }
        })();

        const imageResult = await generateSingleImageDetailed({
          contentContext: configuredPrompt,
          contentTitle: prompt,
          channel: imageGenerationChannel,
          uploadToStorage: true,
        });

        if (activeGenerationRef.current?.requestId !== requestId) {
          return;
        }

        clearThinkingPhaseTimer();

        const imageResults = imageResult.imageUrl
          ? [
              {
                dimensions: null,
                enhancedPrompt: configuredPrompt,
                globalImageId: imageResult.globalImageId,
                id: imageResult.globalImageId || crypto.randomUUID(),
                imageUrl: imageResult.imageUrl,
                mimeType: "image/png",
                tags: [],
                userPrompt: prompt,
              },
            ]
          : [];
        const globalImageIds = imageResult.globalImageId
          ? [imageResult.globalImageId]
          : [];

        if (imageResults.length === 0) {
          const resolvedError = resolveInlineError(imageResult.error);

          setMessages((previousMessages) =>
            previousMessages.map((message) =>
              message.id === loadingMessageId
                ? {
                    ...message,
                    type: "error",
                    content: resolvedError.message,
                    errorKind: resolvedError.errorKind,
                    retryPrompt: prompt,
                  }
                : message,
            ),
          );
          setInputPrompt(prompt);
          activeGenerationRef.current = null;
          return;
        }

        const imageMessageId = await AIChatPersistenceService.saveMessage({
          sessionId,
          messageType: "images",
          content: "Creation complete.",
          metadata: { image_count: imageResults.length },
        });

        if (globalImageIds.length === imageResults.length) {
          await AIChatPersistenceService.saveGeneratedImages({
            sessionId,
            messageId: imageMessageId,
            userPrompt: prompt,
            enhancedPrompt: configuredPrompt,
            images: globalImageIds.map((id, index) => ({
              globalImageId: id,
              order: index + 1,
            })),
          });

          const savedImages =
            await AIChatPersistenceService.loadImagesForMessage(imageMessageId);

          setMessages((previousMessages) =>
            previousMessages.map((message) =>
              message.id === loadingMessageId
                ? {
                    ...message,
                    id: imageMessageId,
                    type: "images",
                    content: "Creation complete.",
                    enhancedPrompt: configuredPrompt,
                    imageRecordIds: savedImages.map((image) => image.id),
                    images: savedImages.map((image) => ({
                      id: image.id,
                      dimensions: image.dimensions,
                      enhancedPrompt: image.enhancedPrompt,
                      generationOrder: image.generationOrder,
                      globalImageId: image.globalImageId,
                      imageRecordId: image.id,
                      imageUrl: image.imageUrl,
                      mimeType: image.mimeType,
                      tags: image.tags,
                      userPrompt: image.userPrompt,
                    })),
                    prompt,
                    sessionId,
                    timestamp: new Date(),
                    userPrompt: prompt,
                  }
                : message,
            ),
          );
        } else {
          setMessages((previousMessages) =>
            previousMessages.map((message) =>
              message.id === loadingMessageId
                ? {
                    ...message,
                    id: imageMessageId,
                    type: "images",
                    content: "Creation complete.",
                    enhancedPrompt: configuredPrompt,
                    images: imageResults,
                    prompt,
                    sessionId,
                    timestamp: new Date(),
                    userPrompt: prompt,
                  }
                : message,
            ),
          );
        }

        activeGenerationRef.current = null;

        if (options?.clearPromptOnSuccess ?? true) {
          setInputPrompt("");
        }
      } catch (error) {
        console.error("Error generating AI images:", error);
        clearThinkingPhaseTimer();

        const loadingMessageId = activeGenerationRef.current?.loadingMessageId;
        if (loadingMessageId) {
          const resolvedError = resolveInlineError(
            error instanceof Error ? error.message : null,
          );

          setMessages((previousMessages) =>
            previousMessages.map((message) =>
              message.id === loadingMessageId
                ? {
                    ...message,
                    type: "error",
                    content: resolvedError.message,
                    errorKind: resolvedError.errorKind,
                    retryPrompt: prompt,
                  }
                : message,
            ),
          );
        }

        setInputPrompt(prompt);
        activeGenerationRef.current = null;
      }
    },
    [
      clearThinkingPhaseTimer,
      contentContext,
      ensureSessionId,
      fetchThinkingMessages,
      generateSingleImageDetailed,
      generationConfig,
      imageGenerationChannel,
    ],
  );

  const submitPrompt = React.useCallback(async () => {
    const trimmedPrompt = inputPrompt.trim();

    if (!trimmedPrompt || isEnhancing || isGenerating) {
      return;
    }

    await generateImages(trimmedPrompt);
  }, [generateImages, inputPrompt, isEnhancing, isGenerating]);

  const handleFormSubmit = React.useCallback<
    React.FormEventHandler<HTMLFormElement>
  >(
    (event) => {
      event.preventDefault();
      void submitPrompt();
    },
    [submitPrompt],
  );

  const handlePromptKeyDown = React.useCallback<
    React.KeyboardEventHandler<HTMLTextAreaElement>
  >(
    (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void submitPrompt();
      }
    },
    [submitPrompt],
  );

  const handlePreviewImage = React.useCallback(
    (image: AIImageStudioImageResult, message: AIImageStudioMessage) => {
      setPreviewState({ image, message });
    },
    [],
  );

  const handleUseGeneratedImage = React.useCallback(
    async (image: AIImageStudioImageResult) => {
      if (image.imageRecordId && blockId) {
        void AIChatPersistenceService.markImageSelected({
          imageRecordId: image.imageRecordId,
          usedInContext: contextType,
          usedInId: blockId,
        }).catch((error) => {
          console.error("Failed to mark AI image selection:", error);
        });
      }

      onImageSelect(image.imageUrl, buildGeneratedImageMetadata(image));
      clearCloseAfterUseTimer();
      closeAfterUseTimeoutRef.current = window.setTimeout(() => {
        setPreviewState(null);
        onClose();
        closeAfterUseTimeoutRef.current = null;
      }, 400);
    },
    [
      blockId,
      buildGeneratedImageMetadata,
      clearCloseAfterUseTimer,
      contextType,
      onClose,
      onImageSelect,
    ],
  );

  const handleRegenerateFromResult = React.useCallback(
    (prompt: string) => {
      setInputPrompt(prompt);
      void generateImages(prompt, { clearPromptOnSuccess: false });
    },
    [generateImages],
  );

  const handleUseImage = React.useCallback(async () => {
    if (!selectedImage) {
      return;
    }

    if (selectedImageRecordId && blockId) {
      try {
        await AIChatPersistenceService.markImageSelected({
          imageRecordId: selectedImageRecordId,
          usedInContext: contextType,
          usedInId: blockId,
        });
      } catch (error) {
        console.error("Failed to mark AI image selection:", error);
      }
    }

    onImageSelect(selectedImage, {
      altText: inputPrompt || contentContext || "AI image",
      source: "ai-generated",
    });
    onClose();
  }, [
    blockId,
    contextType,
    contentContext,
    inputPrompt,
    onClose,
    onImageSelect,
    selectedImage,
    selectedImageRecordId,
  ]);

  const handleSuggestionSelect = React.useCallback((suggestion: string) => {
    console.info("[AIImageStudioDrawer] Suggestion selected:", suggestion);
    setInputPrompt(suggestion);

    window.requestAnimationFrame(() => {
      promptInputRef.current?.focus();
    });
  }, []);

  const handleRetry = React.useCallback(
    (prompt: string) => {
      setInputPrompt(prompt);

      window.requestAnimationFrame(() => {
        promptInputRef.current?.focus();
      });

      void generateImages(prompt, { clearPromptOnSuccess: false });
    },
    [generateImages],
  );

  const handleStopGeneration = React.useCallback(() => {
    const activeGeneration = activeGenerationRef.current;

    abortGeneration();
    clearThinkingPhaseTimer();

    if (!activeGeneration) {
      return;
    }

    activeGenerationRef.current = null;
    setInputPrompt(activeGeneration.prompt);
    setMessages((previousMessages) =>
      previousMessages.map((message) =>
        message.id === activeGeneration.loadingMessageId
          ? {
              ...message,
              type: "assistant",
              content:
                "Generation stopped. Adjust the prompt and try again when you're ready.",
              timestamp: new Date(),
            }
          : message,
      ),
    );
  }, [abortGeneration, clearThinkingPhaseTimer]);

  return (
    <>
      <Drawer
        anchor={isMobile ? "bottom" : "right"}
        aria-labelledby={titleId}
        aria-modal="true"
        keepMounted
        onClose={() => onClose()}
        open={open}
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: "rgba(0, 0, 0, 0.6)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              transition: prefersReducedMotion
                ? "none"
                : "opacity var(--Drawer-transitionDuration) var(--Drawer-transitionFunction)",
            },
          },
          content: {
            "aria-labelledby": titleId,
            "aria-modal": true,
            sx: {
              backgroundColor: "background.surface",
              boxShadow: "var(--joy-shadow-xl)",
              borderRadius: 0,
              border: "none",
              borderLeft: isMobile ? "none" : "1px solid",
              borderColor: "divider",
              width: isMobile ? "100vw" : "520px",
              maxWidth: "100vw",
              maxHeight: "100dvh",
              p: 0,
              overflow: "hidden",
            },
          },
        }}
        sx={{
          zIndex: (theme) => theme.vars.zIndex.modal ?? theme.zIndex.modal,
          "--Drawer-transitionDuration": prefersReducedMotion ? "0ms" : "300ms",
          "--Drawer-transitionFunction": "cubic-bezier(0.22, 1, 0.36, 1)",
          "--Drawer-horizontalSize": "520px",
          "--Drawer-verticalSize": "100dvh",
        }}
      >
        <Tabs
          onChange={(_, value) => {
            setActiveTab(value as AIImageStudioTab);
          }}
          sx={{ height: "100%" }}
          value={activeTab}
        >
          <Box
            sx={{
              position: "relative",
              isolation: "isolate",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              height: "100%",
              backgroundColor: "background.surface",
              "&::before": {
                content: '""',
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                background:
                  "radial-gradient(circle at 50% 0%, rgba(var(--joy-palette-primary-mainChannel) / 0.05) 0%, rgba(var(--joy-palette-primary-mainChannel) / 0.025) 24%, rgba(var(--joy-palette-primary-mainChannel) / 0) 60%)",
                zIndex: -1,
              },
              "@keyframes aiImageStudioTabFade": {
                from: {
                  opacity: 0,
                  transform: "translateY(8px)",
                },
                to: {
                  opacity: 1,
                  transform: "translateY(0)",
                },
              },
            }}
          >
            <AIImageStudioHeader
              closeButtonRef={closeButtonRef}
              onClose={onClose}
              paddingX={contentPaddingX}
              subtitle={subtitle}
              titleId={titleId}
            >
              <TabList
                disableUnderline
                sx={{
                  p: 0.5,
                  borderRadius: "999px",
                  backgroundColor: "background.level1",
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: 0.5,
                }}
                variant="plain"
              >
                <Tab indicatorInset value="ai">
                  AI Generate
                </Tab>
                <Tab indicatorInset value="my-images">
                  My Images
                </Tab>
                <Tab indicatorInset value="unsplash">
                  Unsplash
                </Tab>
                <Tab indicatorInset value="upload">
                  Upload
                </Tab>
              </TabList>
            </AIImageStudioHeader>

            <Box
              key={activeTab}
              sx={{
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                animation:
                  "aiImageStudioTabFade 220ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              {activeTab === "ai" ? (
                <AIImageStudioConversation
                  currentSessionId={currentSessionId}
                  hasMoreMessages={hasMoreMessages}
                  historyLoadError={historyLoadError}
                  isInitialLoad={isInitialLoad}
                  isLoadingHistory={isLoadingHistory}
                  messages={messages}
                  messagesEndRef={messagesEndRef}
                  onLoadMoreHistory={() => {
                    void loadMoreMessages();
                  }}
                  onPreviewImage={handlePreviewImage}
                  onRegenerate={handleRegenerateFromResult}
                  onRetry={handleRetry}
                  onRetryHistoryLoad={() => {
                    void loadInitialMessages();
                  }}
                  onScroll={handleConversationScroll}
                  onSuggestionSelect={handleSuggestionSelect}
                  onUseImage={(image) => handleUseGeneratedImage(image)}
                  paddingX={contentPaddingX}
                />
              ) : (
                <AIImageStudioMediaBrowser
                  activeTab={activeTab}
                  aspectRatioHint={aspectRatioHint}
                  contentContext={contentContext}
                  onSelect={handleSelectMedia}
                  paddingX={contentPaddingX}
                />
              )}

              <Box
                sx={{
                  overflow: "hidden",
                  maxHeight: activeTab === "ai" ? 420 : 0,
                  opacity: activeTab === "ai" ? 1 : 0,
                  transform:
                    activeTab === "ai" ? "translateY(0)" : "translateY(12px)",
                  pointerEvents: activeTab === "ai" ? "auto" : "none",
                  transition:
                    "max-height 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease, transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              >
                <AIImageStudioInputArea
                  generationConfig={generationConfig}
                  inputPrompt={inputPrompt}
                  isEnhancing={isEnhancing}
                  isProcessing={isGenerating}
                  isSettingsOpen={isSettingsOpen}
                  onConfigChange={setGenerationConfig}
                  onEnhancePrompt={handleEnhancePrompt}
                  onInputChange={setInputPrompt}
                  onKeyDown={handlePromptKeyDown}
                  onStopGeneration={handleStopGeneration}
                  onSubmit={handleFormSubmit}
                  onToggleSettings={() =>
                    setIsSettingsOpen((currentOpen) => !currentOpen)
                  }
                  onUseImage={handleUseImage}
                  paddingX={contentPaddingX}
                  promptInputRef={promptInputRef}
                  selectedImage={selectedImage}
                />
              </Box>
            </Box>
          </Box>
        </Tabs>
      </Drawer>

      <AIImageStudioPreviewLightbox
        image={previewState?.image || null}
        message={previewState?.message || null}
        onClose={() => setPreviewState(null)}
        onRegenerate={handleRegenerateFromResult}
        onUseImage={(image) => handleUseGeneratedImage(image)}
        open={!!previewState}
      />
    </>
  );
}
