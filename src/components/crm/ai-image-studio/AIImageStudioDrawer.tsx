import React from "react";
import Box from "@mui/joy/Box";
import Drawer from "@mui/joy/Drawer";
import Tab from "@mui/joy/Tab";
import TabList from "@mui/joy/TabList";
import Tabs from "@mui/joy/Tabs";
import useMediaQuery from "@mui/material/useMediaQuery";
import { STUDIO_BLOCK_LOOKUP } from "@/components/crm/studio/blockLibraryData";
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
  AIImageStudioCampaignContext,
  AIImageStudioContentGenerationContext,
  AIImageStudioDrawerProps,
  AIImageStudioGenerationConfig,
  AIImageStudioImageResult,
  AIImageStudioMessage,
  AIImageStudioOpenOptions,
  AIImageStudioSelectionMetadata,
  AIImageStudioTab,
} from "./types";

const DEFAULT_GENERATION_CONFIG: AIImageStudioGenerationConfig = {
  aspectRatio: "1:1",
  colorPalette: "auto",
  mood: "natural",
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

const HISTORY_MESSAGE_BATCH_SIZE = 10;

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

const moodPromptDescriptors: Record<
  AIImageStudioGenerationConfig["mood"],
  string | null
> = {
  natural: null,
  warm: "warm golden lighting, cozy atmosphere",
  cool: "cool blue-toned lighting, crisp atmosphere",
  dramatic: "dramatic chiaroscuro lighting, high contrast",
  soft: "soft diffused lighting, gentle and airy",
  vibrant: "vibrant saturated colors, bold and energetic",
};

const colorPalettePromptDescriptors: Record<
  AIImageStudioGenerationConfig["colorPalette"],
  string | null
> = {
  auto: null,
  "earth-tones": "using Earth Tones color palette",
  "fresh-greens": "using Fresh Greens color palette",
  "soft-pastels": "using Soft Pastels color palette",
  monochrome: "using Monochrome color palette",
};

const LAST_USED_TAB_STORAGE_KEY = "ai-image-studio:last-tab";

function isAIImageStudioTab(value: string | null): value is AIImageStudioTab {
  return value === "ai" || value === "my-images" || value === "upload";
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

function truncateSuggestionText(value: string, maxLength = 80) {
  const normalizedValue = value.replace(/\s+/g, " ").trim();

  if (normalizedValue.length <= maxLength) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, maxLength - 3).trimEnd()}...`;
}

function formatContentGenerationChannelLabel(channel?: string) {
  const normalizedChannel = (channel || "content")
    .replace(/[_-]+/g, " ")
    .trim();

  return normalizedChannel.replace(/\b\w/g, (character) =>
    character.toUpperCase(),
  );
}

function buildContentGenerationWelcomeSuggestions(
  context?: AIImageStudioContentGenerationContext | null,
) {
  const topicTitle = context?.topicTitle?.trim();

  if (!topicTitle) {
    return undefined;
  }

  const channelLabel = formatContentGenerationChannelLabel(context.channel);
  const suggestions = [
    `${topicTitle} - hero image`,
    `${topicTitle} - close-up product shot`,
    `${channelLabel} optimized - ${topicTitle}`,
    `Behind the scenes - ${topicTitle}`,
  ].map((suggestion) => truncateSuggestionText(suggestion, 96));

  return suggestions.filter(
    (suggestion, index) =>
      suggestions.findIndex(
        (candidate) => candidate.toLowerCase() === suggestion.toLowerCase(),
      ) === index,
  );
}

function buildContentGenerationWelcomeDescription(
  context?: AIImageStudioContentGenerationContext | null,
) {
  const topicTitle = context?.topicTitle?.trim();

  if (!topicTitle) {
    return undefined;
  }

  const channelLabel = formatContentGenerationChannelLabel(
    context.channel,
  ).toLowerCase();
  const summary =
    context?.topicDescription?.trim() || context?.contentSnippet?.trim() || "";

  if (!summary) {
    return `Create ${channelLabel} imagery for ${topicTitle} using the generated prompt or the suggestion chips below.`;
  }

  return `Create ${channelLabel} imagery for ${topicTitle}. ${truncateSuggestionText(summary, 132)}`;
}

function resolveRecommendedAspectRatio(
  aspectRatioHint?: AIImageStudioAspectRatio,
  campaignContext?: AIImageStudioCampaignContext,
) {
  if (aspectRatioHint) {
    return aspectRatioHint;
  }

  switch (campaignContext?.aspectRatioHint) {
    case "landscape":
      return "16:9";
    case "portrait":
      return "9:16";
    case "square":
      return "1:1";
    default:
      return null;
  }
}

function buildCampaignAwarePrompt(
  prompt: string,
  contentContext: string,
  campaignContext?: AIImageStudioCampaignContext,
) {
  const contextParts = [
    campaignContext?.campaignName
      ? `Campaign: ${campaignContext.campaignName}.`
      : null,
    campaignContext?.blockLabel
      ? `Target block: ${campaignContext.blockLabel}.`
      : null,
    campaignContext?.contentSummary
      ? `Visible copy cues: ${campaignContext.contentSummary}.`
      : null,
    contentContext.trim() ? `Field context: ${contentContext.trim()}.` : null,
  ].filter(Boolean);

  if (contextParts.length === 0) {
    return prompt;
  }

  return `${prompt} ${contextParts.join(" ")}`;
}

function buildBlockAwareThinkingMessages(
  thinkingText: string | null | undefined,
  campaignContext?: AIImageStudioCampaignContext,
) {
  const baseMessages = normalizeThinkingMessages(thinkingText);
  const blockLabel = campaignContext?.blockLabel?.trim();

  if (!blockLabel) {
    return baseMessages;
  }

  const normalizedBlockLabel = blockLabel.toLowerCase();
  if (
    baseMessages.some((message) =>
      message.toLowerCase().includes(normalizedBlockLabel),
    )
  ) {
    return baseMessages;
  }

  const contextualMessage = `Framing this for ${blockLabel}...`;
  return [baseMessages[0] ?? FALLBACK_THINKING_MESSAGES[0], contextualMessage]
    .concat(baseMessages.slice(1))
    .slice(0, 5);
}

function buildWelcomeSuggestions(
  campaignContext?: AIImageStudioCampaignContext,
) {
  const contentValues = Object.values(
    campaignContext?.blockContent ?? {},
  ).filter(Boolean);

  if (!campaignContext || contentValues.length === 0) {
    return undefined;
  }

  const blockFallbacks: Record<string, string> = {
    "call-to-action": "clean CTA hero image with strong focal product styling",
    "email-safe-hero": "premium hero image with seasonal floral storytelling",
    footer: "brand sign-off image with subtle botanical texture",
    "full-width-image":
      "immersive editorial scene with premium botanical detail",
    "graphic-hero": "bold campaign visual with refined color contrast",
    "image-gallery": "cohesive gallery set with elevated floral art direction",
    "image-text": "editorial lifestyle scene with room for supporting copy",
    "newsletter-header":
      "campaign masthead visual with elegant seasonal atmosphere",
    "plain-text": "supporting editorial image with calm premium composition",
    "product-card":
      "product spotlight with polished background and soft natural light",
    "product-gallery":
      "cohesive product series with premium merchandising detail",
    quote: "portrait-led lifestyle image with soft botanical depth",
    "social-follow":
      "brand-forward social graphic with refined botanical accents",
  };

  const headline =
    campaignContext.blockContent.headline ||
    campaignContext.blockContent.title ||
    campaignContext.blockContent.quoteText ||
    contentValues[0];
  const supportCopy =
    campaignContext.blockContent.subheading ||
    campaignContext.blockContent.bodyText ||
    campaignContext.blockContent.description ||
    contentValues[1];
  const fallback =
    blockFallbacks[campaignContext.blockType] ||
    `on-brand image for ${campaignContext.blockLabel}`;

  const suggestions = [
    headline ? `${headline}, premium botanical campaign image` : null,
    supportCopy
      ? `${supportCopy}, warm editorial lighting, refined composition`
      : null,
    `${campaignContext.campaignName}, ${fallback}`,
  ]
    .map((suggestion) =>
      suggestion ? truncateSuggestionText(suggestion) : null,
    )
    .filter((suggestion): suggestion is string => Boolean(suggestion));

  return suggestions.filter(
    (suggestion, index) =>
      suggestions.findIndex(
        (candidate) => candidate.toLowerCase() === suggestion.toLowerCase(),
      ) === index,
  );
}

function buildConfiguredPrompt(
  prompt: string,
  generationConfig: AIImageStudioGenerationConfig,
) {
  return [
    moodPromptDescriptors[generationConfig.mood],
    colorPalettePromptDescriptors[generationConfig.colorPalette],
    stylePromptDescriptors[generationConfig.stylePreset],
    aspectRatioPromptDescriptors[generationConfig.aspectRatio],
    qualityPromptDescriptors[generationConfig.quality],
    prompt,
  ]
    .filter(Boolean)
    .join(" ");
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

function mergePrependedMessages(
  existingMessages: AIImageStudioMessage[],
  olderMessages: AIImageStudioMessage[],
) {
  if (olderMessages.length === 0) {
    return existingMessages;
  }

  const lastOlderMessage = [...olderMessages]
    .reverse()
    .find((message) => message.type !== "session_divider");
  const firstExistingMessage = existingMessages.find(
    (message) => message.type !== "session_divider",
  );

  const shouldRemoveBoundaryDivider =
    !!lastOlderMessage?.sessionId &&
    lastOlderMessage.sessionId === firstExistingMessage?.sessionId &&
    existingMessages[0]?.type === "session_divider" &&
    existingMessages[0].sessionInfo?.sessionId === lastOlderMessage.sessionId;

  return [
    ...olderMessages,
    ...(shouldRemoveBoundaryDivider
      ? existingMessages.slice(1)
      : existingMessages),
  ];
}

export function AIImageStudioDrawer({
  open,
  onClose,
  onImageSelect: initialOnImageSelect,
  aspectRatioHint: initialAspectRatioHint,
  assignmentLabel: initialAssignmentLabel,
  browseOnly = false,
  channel = "newsletter",
  contentTitle: initialContentTitle,
  contentContext: initialContentContext = "",
  context: initialContext,
  contextLabel: initialContextLabel,
  campaignContext: initialCampaignContext,
  defaultTab = "ai",
  initialPrompt: initialInitialPrompt = "",
  blockId: initialBlockId,
  contextType: initialContextType = "email_block",
  getCurrentOptions,
  multiBlockFlow: initialMultiBlockFlow,
  subscribeToOptions,
}: AIImageStudioDrawerProps) {
  const isMobile = useMediaQuery("(max-width: 767.95px)");
  const isMobileLandscape = useMediaQuery(
    "(max-width: 767.95px) and (orientation: landscape)",
  );
  const prefersReducedMotion = useMediaQuery(
    "(prefers-reduced-motion: reduce)",
  );
  const contentPaddingX = isMobile ? 2 : 3;
  const titleId = React.useId();
  const closeButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const promptInputRef = React.useRef<HTMLTextAreaElement | null>(null);
  const mobileSwipeTimeoutRef = React.useRef<number | null>(null);
  const mobileSwipeGestureRef = React.useRef<{
    canDrag: boolean;
    isDragging: boolean;
    lastTimestamp: number;
    lastY: number;
    startX: number;
    startY: number;
    velocity: number;
  } | null>(null);
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
  const [selectionConfirmationLabel, setSelectionConfirmationLabel] =
    React.useState<string | null>(null);
  const [mobileKeyboardInset, setMobileKeyboardInset] = React.useState(0);
  const [mobileSwipeDismissDuration, setMobileSwipeDismissDuration] =
    React.useState(220);
  const [mobileSwipeOffset, setMobileSwipeOffset] = React.useState(0);
  const [mobileSwipePhase, setMobileSwipePhase] = React.useState<
    "idle" | "dragging" | "settling" | "dismissing"
  >("idle");
  const [mobileViewportHeight, setMobileViewportHeight] = React.useState(
    typeof window === "undefined" ? 0 : window.innerHeight,
  );

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
  const [liveOptions, setLiveOptions] =
    React.useState<AIImageStudioOpenOptions | null>(null);
  const { abortGeneration, generateSingleImageDetailed, isGenerating } =
    useAIImageGeneration();

  React.useEffect(() => {
    if (!open) {
      setLiveOptions(null);
      return;
    }

    const initialOptions = getCurrentOptions?.() ?? null;

    if (initialOptions) {
      setLiveOptions(initialOptions);
    }

    if (!subscribeToOptions) {
      return;
    }

    return subscribeToOptions((nextOptions) => {
      setLiveOptions(nextOptions);
    });
  }, [getCurrentOptions, open, subscribeToOptions]);

  const onImageSelect = liveOptions?.onSelect ?? initialOnImageSelect;
  const aspectRatioHint =
    liveOptions?.aspectRatioHint ?? initialAspectRatioHint;
  const assignmentLabel =
    liveOptions?.assignmentLabel ?? initialAssignmentLabel;
  const blockId = liveOptions?.blockId ?? initialBlockId;
  const campaignContext =
    liveOptions?.campaignContext ?? initialCampaignContext;
  const contentTitle = liveOptions?.contentTitle ?? initialContentTitle;
  const contentContext = liveOptions?.contentContext ?? initialContentContext;
  const contentGenerationContext =
    liveOptions?.context ?? initialContext ?? null;
  const contextLabel = liveOptions?.contextLabel ?? initialContextLabel;
  const contextType = liveOptions?.contextType ?? initialContextType;
  const initialPrompt = liveOptions?.initialPrompt ?? initialInitialPrompt;
  const multiBlockFlow = liveOptions?.multiBlockFlow ?? initialMultiBlockFlow;

  const subtitle = React.useMemo(() => {
    if (contextLabel?.trim()) {
      return contextLabel;
    }

    if (assignmentLabel?.trim()) {
      return assignmentLabel.trim();
    }

    if (browseOnly) {
      return "Choose from your recent images or a fresh upload.";
    }

    return "Generate, browse, or upload without leaving your flow.";
  }, [assignmentLabel, browseOnly, contextLabel]);

  const contextBreadcrumb = React.useMemo(() => {
    const targetLabel =
      assignmentLabel?.trim() || campaignContext?.blockLabel?.trim();

    if (campaignContext?.campaignName?.trim() && targetLabel) {
      return `For: ${campaignContext.campaignName} -> ${targetLabel}`;
    }

    const topicTitle = contentGenerationContext?.topicTitle?.trim();

    if (!topicTitle) {
      return undefined;
    }

    return `For: Content generation -> ${topicTitle}`;
  }, [assignmentLabel, campaignContext, contentGenerationContext]);

  const recommendedAspectRatio = React.useMemo(
    () => resolveRecommendedAspectRatio(aspectRatioHint, campaignContext),
    [aspectRatioHint, campaignContext],
  );

  const welcomeSuggestions = React.useMemo(
    () =>
      buildContentGenerationWelcomeSuggestions(contentGenerationContext) ||
      buildWelcomeSuggestions(campaignContext),
    [campaignContext, contentGenerationContext],
  );

  const welcomeBlockLabel = React.useMemo(
    () =>
      contentGenerationContext?.topicTitle?.trim() ||
      campaignContext?.blockLabel,
    [campaignContext, contentGenerationContext],
  );

  const welcomeDescription = React.useMemo(() => {
    const contentGenerationDescription =
      buildContentGenerationWelcomeDescription(contentGenerationContext);

    if (contentGenerationDescription) {
      return contentGenerationDescription;
    }

    const targetLabel =
      assignmentLabel?.trim() || campaignContext?.blockLabel?.trim();

    if (!targetLabel) {
      return undefined;
    }

    return `Use the live copy from this ${targetLabel} block as a starting point, then refine the art direction.`;
  }, [assignmentLabel, campaignContext, contentGenerationContext]);

  const selectionConfirmation = React.useMemo(() => {
    if (!selectionConfirmationLabel) {
      return null;
    }

    const blockLookupEntry = campaignContext?.blockType
      ? STUDIO_BLOCK_LOOKUP[
          campaignContext.blockType as keyof typeof STUDIO_BLOCK_LOOKUP
        ]
      : undefined;
    const BlockIcon = blockLookupEntry?.icon;

    return {
      blockLabel: selectionConfirmationLabel,
      icon: BlockIcon ? <BlockIcon size={16} strokeWidth={1.9} /> : undefined,
    };
  }, [campaignContext, selectionConfirmationLabel]);

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

  const clearMobileSwipeTimer = React.useCallback(() => {
    if (mobileSwipeTimeoutRef.current !== null) {
      window.clearTimeout(mobileSwipeTimeoutRef.current);
      mobileSwipeTimeoutRef.current = null;
    }
  }, []);

  const resetMobileSwipeState = React.useCallback(() => {
    mobileSwipeGestureRef.current = null;
    setMobileSwipeOffset(0);
    setMobileSwipePhase("idle");
    setMobileSwipeDismissDuration(220);
  }, []);

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
      clearMobileSwipeTimer();
      abortGeneration();
    };
  }, [
    abortGeneration,
    clearCloseAfterUseTimer,
    clearMobileSwipeTimer,
    clearThinkingPhaseTimer,
  ]);

  React.useEffect(() => {
    if (!isMobile || !open) {
      setMobileKeyboardInset(0);
      return;
    }

    const updateViewportMetrics = () => {
      const visualViewport = window.visualViewport;
      const nextViewportHeight = Math.round(
        visualViewport?.height ?? window.innerHeight,
      );
      const nextKeyboardInset = visualViewport
        ? Math.max(
            0,
            Math.round(
              window.innerHeight -
                (visualViewport.height + visualViewport.offsetTop),
            ),
          )
        : 0;

      setMobileViewportHeight(nextViewportHeight);
      setMobileKeyboardInset(nextKeyboardInset);
    };

    updateViewportMetrics();

    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener("resize", updateViewportMetrics);
    visualViewport?.addEventListener("scroll", updateViewportMetrics);
    window.addEventListener("resize", updateViewportMetrics);

    return () => {
      visualViewport?.removeEventListener("resize", updateViewportMetrics);
      visualViewport?.removeEventListener("scroll", updateViewportMetrics);
      window.removeEventListener("resize", updateViewportMetrics);
    };
  }, [isMobile, open]);

  React.useEffect(() => {
    if (!open) {
      clearMobileSwipeTimer();
      mobileSwipeGestureRef.current = null;

      if (mobileSwipePhase !== "dismissing") {
        resetMobileSwipeState();
        return;
      }

      mobileSwipeTimeoutRef.current = window.setTimeout(() => {
        resetMobileSwipeState();
        mobileSwipeTimeoutRef.current = null;
      }, mobileSwipeDismissDuration + 32);
      return;
    }

    resetMobileSwipeState();
  }, [
    clearMobileSwipeTimer,
    mobileSwipeDismissDuration,
    mobileSwipePhase,
    open,
    resetMobileSwipeState,
  ]);

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
            id: `divider-${dbMessage.sessionId}-${dbMessage.id}`,
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
        HISTORY_MESSAGE_BATCH_SIZE,
      );
      const uiMessages = await convertGlobalMessagesToUI(dbMessages);

      setMessages(uiMessages);
      setHasMoreMessages(dbMessages.length === HISTORY_MESSAGE_BATCH_SIZE);
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
      setIsInitialLoad(true);
      setIsLoadingHistory(false);
      setHasMoreMessages(true);
      setMessages([]);
      setOldestLoadedTimestamp(null);
      setHistoryLoadError(false);
      setPreviewState(null);
      setSelectionConfirmationLabel(null);
      setSelectedImage(null);
      setSelectedImageRecordId(null);
      return;
    }

    const storedTab = window.sessionStorage.getItem(LAST_USED_TAB_STORAGE_KEY);
    const nextTab = isAIImageStudioTab(storedTab) ? storedTab : "ai";
    setActiveTab(defaultTab || nextTab);
    setInputPrompt(initialPrompt.trim());

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
    initialPrompt,
    initializeSession,
    loadInitialMessages,
    open,
    aspectRatioHint,
    defaultTab,
  ]);

  React.useEffect(() => {
    if (!open || !aspectRatioHint) {
      return;
    }

    setGenerationConfig((currentConfig) =>
      currentConfig.aspectRatio === aspectRatioHint
        ? currentConfig
        : {
            ...currentConfig,
            aspectRatio: aspectRatioHint,
          },
    );
  }, [aspectRatioHint, open]);

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

  const scheduleCloseAfterSelection = React.useCallback(() => {
    clearCloseAfterUseTimer();
    closeAfterUseTimeoutRef.current = window.setTimeout(() => {
      onClose();
      closeAfterUseTimeoutRef.current = null;
    }, 500);
  }, [clearCloseAfterUseTimer, onClose]);

  const finalizeSelection = React.useCallback(
    (
      imageUrl: string,
      metadata?: AIImageStudioSelectionMetadata,
      confirmationLabel?: string,
    ) => {
      onImageSelect(imageUrl, metadata);
      setPreviewState(null);
      setSelectionConfirmationLabel(
        confirmationLabel ||
          assignmentLabel?.trim() ||
          campaignContext?.blockLabel?.trim() ||
          contentGenerationContext?.topicTitle?.trim() ||
          "selected block",
      );

      if (multiBlockFlow?.hasNextTarget()) {
        const targetLabel =
          confirmationLabel ||
          assignmentLabel?.trim() ||
          campaignContext?.blockLabel?.trim() ||
          contentGenerationContext?.topicTitle?.trim() ||
          "current target";

        setMessages((previousMessages) => [
          ...previousMessages,
          {
            id: crypto.randomUUID(),
            type: "assistant",
            content: `Applied to ${targetLabel}. Continue to the next target or finish here.`,
            actions: [
              { id: "next-target", label: "Next slot" },
              { id: "done", label: "Done" },
            ],
            timestamp: new Date(),
          },
        ]);
        return;
      }

      scheduleCloseAfterSelection();
    },
    [
      assignmentLabel,
      campaignContext,
      contentGenerationContext,
      multiBlockFlow,
      onImageSelect,
      scheduleCloseAfterSelection,
    ],
  );

  const handleSelectMedia = React.useCallback(
    async (imageUrl: string, metadata: AIImageStudioSelectionMetadata) => {
      finalizeSelection(imageUrl, metadata);
    },
    [finalizeSelection],
  );

  const buildGeneratedImageMetadata = React.useCallback(
    (image: AIImageStudioImageResult): AIImageStudioSelectionMetadata => ({
      altText:
        image.userPrompt ||
        image.enhancedPrompt ||
        contentTitle ||
        contentContext ||
        "AI image",
      dimensions: image.dimensions || null,
      globalImageId: image.globalImageId,
      mimeType: image.mimeType || null,
      source: "ai-generated",
      tags: image.tags,
    }),
    [contentContext, contentTitle],
  );

  const loadMoreMessages = React.useCallback(async () => {
    if (!oldestLoadedTimestamp || isLoadingHistory || !hasMoreMessages) {
      return;
    }

    setIsLoadingHistory(true);

    try {
      const olderMessages = await AIChatPersistenceService.loadGlobalMessages(
        HISTORY_MESSAGE_BATCH_SIZE,
        oldestLoadedTimestamp,
      );

      if (olderMessages.length === 0) {
        setHasMoreMessages(false);
        return;
      }

      const uiMessages = await convertGlobalMessagesToUI(olderMessages);
      setMessages((previousMessages) =>
        mergePrependedMessages(previousMessages, uiMessages),
      );
      setOldestLoadedTimestamp(olderMessages[0].createdAt);
      setHasMoreMessages(olderMessages.length === HISTORY_MESSAGE_BATCH_SIZE);
    } catch (error) {
      console.error("Failed to load older AI image studio messages:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [
    convertGlobalMessagesToUI,
    hasMoreMessages,
    isLoadingHistory,
    oldestLoadedTimestamp,
  ]);

  const handleConversationScroll = React.useCallback(() => {}, []);

  const canStartMobileSwipe = React.useCallback((target: HTMLElement) => {
    if (
      target.closest(
        "textarea, input, select, button, a, label, [role='button'], [role='tab'], [contenteditable='true']",
      )
    ) {
      return false;
    }

    if (target.closest("[data-ai-image-studio-drag-handle='true']")) {
      return true;
    }

    const scrollContainer = target.closest<HTMLElement>(
      "[data-ai-image-studio-scroll-container='true']",
    );

    if (!scrollContainer) {
      return true;
    }

    return scrollContainer.scrollTop <= 0;
  }, []);

  const handleMobileTouchStart = React.useCallback<
    React.TouchEventHandler<HTMLDivElement>
  >(
    (event) => {
      if (!isMobile || event.touches.length !== 1) {
        return;
      }

      const target = event.target;
      if (!(target instanceof HTMLElement) || !canStartMobileSwipe(target)) {
        mobileSwipeGestureRef.current = null;
        return;
      }

      const touch = event.touches[0];
      mobileSwipeGestureRef.current = {
        canDrag: true,
        isDragging: false,
        lastTimestamp: event.timeStamp,
        lastY: touch.clientY,
        startX: touch.clientX,
        startY: touch.clientY,
        velocity: 0,
      };
      clearMobileSwipeTimer();
      setMobileSwipePhase("idle");
      setMobileSwipeOffset(0);
    },
    [canStartMobileSwipe, clearMobileSwipeTimer, isMobile],
  );

  const handleMobileTouchMove = React.useCallback<
    React.TouchEventHandler<HTMLDivElement>
  >(
    (event) => {
      if (!isMobile || event.touches.length !== 1) {
        return;
      }

      const gesture = mobileSwipeGestureRef.current;
      if (!gesture?.canDrag) {
        return;
      }

      const touch = event.touches[0];
      const deltaX = touch.clientX - gesture.startX;
      const deltaY = touch.clientY - gesture.startY;

      if (!gesture.isDragging) {
        if (Math.abs(deltaY) < 6) {
          return;
        }

        if (deltaY <= 0 || Math.abs(deltaY) <= Math.abs(deltaX)) {
          gesture.canDrag = false;
          return;
        }

        gesture.isDragging = true;
        setMobileSwipePhase("dragging");
      }

      const deltaTime = Math.max(event.timeStamp - gesture.lastTimestamp, 1);
      gesture.velocity = (touch.clientY - gesture.lastY) / deltaTime;
      gesture.lastTimestamp = event.timeStamp;
      gesture.lastY = touch.clientY;

      if (event.cancelable) {
        event.preventDefault();
      }

      setMobileSwipeOffset(Math.max(0, deltaY));
    },
    [isMobile],
  );

  const handleMobileTouchEnd = React.useCallback<
    React.TouchEventHandler<HTMLDivElement>
  >(() => {
    if (!isMobile) {
      return;
    }

    const gesture = mobileSwipeGestureRef.current;
    if (!gesture) {
      return;
    }

    mobileSwipeGestureRef.current = null;

    if (!gesture.isDragging) {
      return;
    }

    const shouldDismiss = mobileSwipeOffset >= 80;

    if (!shouldDismiss) {
      setMobileSwipePhase("settling");
      setMobileSwipeOffset(0);
      clearMobileSwipeTimer();
      mobileSwipeTimeoutRef.current = window.setTimeout(
        () => {
          resetMobileSwipeState();
          mobileSwipeTimeoutRef.current = null;
        },
        prefersReducedMotion ? 0 : 240,
      );
      return;
    }

    const dismissVelocity = Math.abs(gesture.velocity);
    const dismissDuration = prefersReducedMotion
      ? 0
      : Math.max(
          140,
          Math.min(320, Math.round(260 - Math.min(dismissVelocity * 120, 120))),
        );

    setMobileSwipeDismissDuration(dismissDuration);
    setMobileSwipePhase("dismissing");
    window.requestAnimationFrame(() => {
      setMobileSwipeOffset(
        Math.max(mobileViewportHeight || window.innerHeight, mobileSwipeOffset),
      );
    });
    onClose();
  }, [
    clearMobileSwipeTimer,
    isMobile,
    mobileSwipeOffset,
    mobileViewportHeight,
    onClose,
    prefersReducedMotion,
    resetMobileSwipeState,
  ]);

  const mobileFooterMaxHeight = React.useMemo(() => {
    if (!isMobile || mobileViewportHeight <= 0) {
      return null;
    }

    if (isMobileLandscape) {
      return Math.max(180, Math.floor(mobileViewportHeight * 0.3));
    }

    return Math.min(420, Math.floor(mobileViewportHeight * 0.48));
  }, [isMobile, isMobileLandscape, mobileViewportHeight]);

  const mobileSwipeProgress =
    isMobile && mobileViewportHeight > 0
      ? Math.min(
          1,
          mobileSwipeOffset / Math.max(mobileViewportHeight * 0.45, 1),
        )
      : 0;
  const mobileBackdropOpacity = isMobile
    ? Math.max(0, 0.6 * (1 - mobileSwipeProgress))
    : 0.6;
  const mobileBackdropBlur = isMobile
    ? Math.max(0, 20 * (1 - mobileSwipeProgress))
    : 20;

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

  const fetchThinkingMessages = React.useCallback(
    async (prompt: string) => {
      try {
        const { data, error } = await supabase.functions.invoke(
          "generate-thinking-text",
          {
            body: { campaignContext, prompt },
          },
        );

        if (error) {
          throw error;
        }

        return {
          statusMessages: buildBlockAwareThinkingMessages(
            data?.thinkingText,
            campaignContext,
          ),
          fullText: data?.thinkingText as string | undefined,
        };
      } catch (error) {
        console.error(
          "Failed to fetch AI image studio thinking messages:",
          error,
        );
        return {
          statusMessages: buildBlockAwareThinkingMessages(
            null,
            campaignContext,
          ),
          fullText: null,
        };
      }
    },
    [campaignContext],
  );

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
          body: { campaignContext, prompt: trimmedPrompt },
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
  }, [
    campaignContext,
    inputPrompt,
    isEnhancing,
    isGenerating,
    revealEnhancedPrompt,
  ]);

  const generateImages = React.useCallback(
    async (prompt: string, options?: { clearPromptOnSuccess?: boolean }) => {
      const requestId = crypto.randomUUID();
      const promptWithContext = buildCampaignAwarePrompt(
        prompt,
        contentContext,
        campaignContext,
      );
      const configuredPrompt = buildConfiguredPrompt(
        promptWithContext,
        generationConfig,
      );

      setSelectionConfirmationLabel(null);
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
            statusMessages: buildBlockAwareThinkingMessages(
              null,
              campaignContext,
            ),
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
                    statusMessages: buildBlockAwareThinkingMessages(
                      null,
                      campaignContext,
                    ),
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
          contentTitle: contentTitle || prompt,
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
      campaignContext,
      clearThinkingPhaseTimer,
      contentContext,
      contentTitle,
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

      finalizeSelection(image.imageUrl, buildGeneratedImageMetadata(image));
    },
    [blockId, buildGeneratedImageMetadata, contextType, finalizeSelection],
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

    finalizeSelection(selectedImage, {
      altText: inputPrompt || contentTitle || contentContext || "AI image",
      source: "ai-generated",
    });
  }, [
    blockId,
    contextType,
    contentContext,
    contentTitle,
    finalizeSelection,
    inputPrompt,
    selectedImage,
    selectedImageRecordId,
  ]);

  const handleMessageAction = React.useCallback(
    (actionId: "done" | "next-target", message: AIImageStudioMessage) => {
      setMessages((previousMessages) =>
        previousMessages.map((entry) =>
          entry.id === message.id ? { ...entry, actions: undefined } : entry,
        ),
      );

      if (actionId === "done") {
        onClose();
        return;
      }

      const nextTarget = multiBlockFlow?.advanceToNextTarget() ?? null;

      if (!nextTarget) {
        onClose();
        return;
      }

      const nextLabel =
        nextTarget.assignmentLabel?.trim() ||
        nextTarget.campaignContext?.blockLabel?.trim() ||
        nextTarget.contextLabel?.trim() ||
        "next target";

      setActiveTab("ai");
      setInputPrompt("");
      setPreviewState(null);
      setSelectedImage(null);
      setSelectedImageRecordId(null);
      setSelectionConfirmationLabel(nextLabel);
      setMessages((previousMessages) => [
        ...previousMessages,
        {
          id: crypto.randomUUID(),
          type: "assistant",
          content: `Ready for ${nextLabel}.`,
          timestamp: new Date(),
        },
      ]);

      window.requestAnimationFrame(() => {
        promptInputRef.current?.focus();
      });
    },
    [multiBlockFlow, onClose],
  );

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
        key={isMobile ? "mobile" : "desktop"}
        anchor={isMobile ? "bottom" : "right"}
        aria-labelledby={titleId}
        aria-modal="true"
        onClose={() => onClose()}
        open={open}
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: `rgba(0, 0, 0, ${mobileBackdropOpacity})`,
              backdropFilter: `blur(${mobileBackdropBlur}px)`,
              WebkitBackdropFilter: `blur(${mobileBackdropBlur}px)`,
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
              width: isMobile ? "100vw" : "620px",
              maxWidth: "100vw",
              height: isMobile
                ? `${Math.max(mobileViewportHeight, 1)}px`
                : "100dvh",
              maxHeight: isMobile
                ? `${Math.max(mobileViewportHeight, 1)}px`
                : "100dvh",
              bottom: isMobile ? `${mobileKeyboardInset}px` : 0,
              p: 0,
              overflow: "hidden",
              transition:
                isMobile && mobileSwipePhase !== "idle"
                  ? prefersReducedMotion
                    ? "none"
                    : `transform ${mobileSwipeDismissDuration}ms cubic-bezier(0.22, 1, 0.36, 1), border-radius 220ms cubic-bezier(0.22, 1, 0.36, 1)`
                  : undefined,
              transform:
                isMobile && mobileSwipePhase !== "idle"
                  ? `translateY(${mobileSwipeOffset}px)`
                  : undefined,
            },
          },
        }}
        sx={{
          zIndex: (theme) =>
            (theme.vars.zIndex.modal ?? theme.zIndex.modal) + 120,
          "--Drawer-transitionDuration": prefersReducedMotion ? "0ms" : "300ms",
          "--Drawer-transitionFunction": "cubic-bezier(0.22, 1, 0.36, 1)",
          "--Drawer-horizontalSize": "620px",
          "--Drawer-verticalSize": "100dvh",
        }}
      >
        <Tabs
          onChange={(_, value) => {
            setActiveTab(value as AIImageStudioTab);
          }}
          sx={{ height: "100%", bgcolor: "transparent" }}
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
              backgroundColor: "background.body",
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
              contextBreadcrumb={contextBreadcrumb}
              isMobile={isMobile}
              onClose={onClose}
              paddingX={contentPaddingX}
              subtitle={subtitle}
              titleId={titleId}
            >
              <TabList
                disableUnderline
                sx={{
                  bgcolor: "background.level1",
                  borderRadius: "10px",
                  p: "4px",
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: "4px",
                  "& [role='tab']": {
                    minHeight: isMobile ? 44 : undefined,
                    minWidth: isMobile ? 44 : undefined,
                  },
                }}
                variant="plain"
              >
                <Tab
                  sx={{
                    bgcolor: "transparent",
                    color: "text.secondary",
                    fontWeight: 500,
                    borderRadius: "8px",
                    fontSize: "13px",
                    py: "6px",
                    px: "14px",
                    transition: "all 0.2s ease",
                    "&:hover": {
                      bgcolor: "background.level2",
                      color: "text.primary",
                    },
                    "&.Mui-selected": {
                      bgcolor: "background.surface",
                      color: "text.primary",
                      fontWeight: 600,
                      boxShadow: "sm",
                    },
                  }}
                  value="ai"
                >
                  AI Generate
                </Tab>
                <Tab
                  sx={{
                    bgcolor: "transparent",
                    color: "text.secondary",
                    fontWeight: 500,
                    borderRadius: "8px",
                    fontSize: "13px",
                    py: "6px",
                    px: "14px",
                    transition: "all 0.2s ease",
                    "&:hover": {
                      bgcolor: "background.level2",
                      color: "text.primary",
                    },
                    "&.Mui-selected": {
                      bgcolor: "background.surface",
                      color: "text.primary",
                      fontWeight: 600,
                      boxShadow: "sm",
                    },
                  }}
                  value="my-images"
                >
                  My Images
                </Tab>
                <Tab
                  sx={{
                    bgcolor: "transparent",
                    color: "text.secondary",
                    fontWeight: 500,
                    borderRadius: "8px",
                    fontSize: "13px",
                    py: "6px",
                    px: "14px",
                    transition: "all 0.2s ease",
                    "&:hover": {
                      bgcolor: "background.level2",
                      color: "text.primary",
                    },
                    "&.Mui-selected": {
                      bgcolor: "background.surface",
                      color: "text.primary",
                      fontWeight: 600,
                      boxShadow: "sm",
                    },
                  }}
                  value="upload"
                >
                  Upload
                </Tab>
              </TabList>
            </AIImageStudioHeader>

            <Box
              key={activeTab}
              onTouchCancel={handleMobileTouchEnd}
              onTouchEnd={handleMobileTouchEnd}
              onTouchMove={handleMobileTouchMove}
              onTouchStart={handleMobileTouchStart}
              sx={{
                flex: 1,
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                paddingInlineStart: isMobile
                  ? "env(safe-area-inset-left, 0px)"
                  : 0,
                paddingInlineEnd: isMobile
                  ? "env(safe-area-inset-right, 0px)"
                  : 0,
                animation:
                  "aiImageStudioTabFade 220ms cubic-bezier(0.22, 1, 0.36, 1)",
                "& button, & [role='button'], & [role='tab'], & .MuiChip-root":
                  isMobile
                    ? {
                        minHeight: 44,
                        minWidth: 44,
                      }
                    : undefined,
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
                  onMessageAction={handleMessageAction}
                  onLoadMoreHistory={loadMoreMessages}
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
                  welcomeBlockLabel={welcomeBlockLabel}
                  welcomeDescription={welcomeDescription}
                  welcomeSuggestions={welcomeSuggestions}
                />
              ) : (
                <AIImageStudioMediaBrowser
                  activeTab={activeTab}
                  aspectRatioHint={aspectRatioHint}
                  contentContext={contentContext}
                  onSelect={handleSelectMedia}
                  onTabChange={setActiveTab}
                  paddingX={contentPaddingX}
                />
              )}

              <Box
                sx={{
                  position: "sticky",
                  bottom: 0,
                  zIndex: 2,
                  flexShrink: 0,
                  backgroundColor: "background.surface",
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
                  footerMaxHeight={mobileFooterMaxHeight}
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
                  recommendedAspectRatio={recommendedAspectRatio}
                  selectionConfirmation={selectionConfirmation}
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
