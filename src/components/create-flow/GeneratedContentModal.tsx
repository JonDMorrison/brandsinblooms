import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Box,
  Button,
  CircularProgress,
  Input,
  Modal,
  ModalDialog,
  ModalClose,
  Skeleton,
  Sheet,
  Snackbar,
  Stack,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Textarea,
  Typography,
} from "@mui/joy";
import {
  AutoAwesomeRounded,
  CheckCircleRounded,
  CloseRounded,
  SendRounded,
} from "@mui/icons-material";
import { RichTextEditor } from "@/components/ui-legacy/rich-text-editor";
import { useCreateFlow } from "@/state/useCreateFlow";
import {
  GeneratedBundle,
  GeneratedBundleItem,
  useGeneratedBundle,
} from "@/hooks/useGeneratedBundle";
import { useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  Megaphone,
  Newspaper,
  Sparkles,
  Video,
} from "lucide-react";
import { EditableNewsletterPreview } from "./EditableNewsletterPreview";
import { useAIImageStudio } from "@/hooks/useAIImageStudio";
import {
  useImageGenerationTracker,
  type ImageGenJob,
} from "@/hooks/useImageGenerationTracker";
import { retryBundleImageGeneration } from "@/utils/parallelImageGeneration";
import useMediaQuery from "@/hooks/use-media-query";
import { sanitizeWeekNumbers } from "@/utils/weekNumberSanitizer";
import { sanitizeHtml } from "@/utils/htmlSanitizer";
import type {
  AIImageStudioAspectRatio,
  AIImageStudioSelectionMetadata,
} from "@/components/crm/ai-image-studio/types";

interface GeneratedContentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ModalChannel = GeneratedBundleItem["channel"] | "email";
type EditableField =
  | "body"
  | "caption"
  | "script"
  | "markdown"
  | "text"
  | "content";

interface DraftMedia {
  url?: string;
  alt?: string;
  source?: string;
  globalImageId?: string;
  tags?: string[];
}

interface DraftItem extends Omit<GeneratedBundleItem, "channel" | "media"> {
  channel: ModalChannel;
  caption?: string;
  script?: string;
  markdown?: string;
  text?: string;
  content?: string;
  media?: DraftMedia | null;
  _selectedCta?: string | null;
}

type SnackbarColor = "success" | "danger" | "neutral";

const HTML_TAG_PATTERN = /<[^>]+>/;

const CHANNEL_CONFIG: Record<
  GeneratedBundleItem["channel"],
  {
    label: string;
    previewLabel: string;
    bodyLabel: string;
    description: string;
    icon: LucideIcon;
    charLimit?: number;
    ctaFallbacks: string[];
  }
> = {
  instagram: {
    label: "Instagram",
    previewLabel: "Instagram post preview",
    bodyLabel: "Caption",
    description:
      "Refine the social caption, hashtags, CTA, and featured image.",
    icon: Megaphone,
    charLimit: 2200,
    ctaFallbacks: [
      "Shop the collection",
      "Visit us this week",
      "Save this post",
    ],
  },
  facebook: {
    label: "Facebook",
    previewLabel: "Facebook post preview",
    bodyLabel: "Post copy",
    description:
      "Tighten the long-form post and make the CTA explicit before publishing.",
    icon: Megaphone,
    charLimit: 63206,
    ctaFallbacks: ["Learn more", "Message us today", "Plan your visit"],
  },
  blog: {
    label: "Blog",
    previewLabel: "Blog article preview",
    bodyLabel: "Article body",
    description:
      "Keep the article polished with a readable title, body, CTA, and cover image.",
    icon: FileText,
    ctaFallbacks: [
      "Read the full guide",
      "Book an in-store consult",
      "Browse related products",
    ],
  },
  newsletter: {
    label: "Newsletter",
    previewLabel: "Newsletter preview",
    bodyLabel: "Newsletter body",
    description:
      "Review the newsletter structure, fine-tune the copy, and confirm the lead image.",
    icon: Newspaper,
    ctaFallbacks: [
      "Shop featured picks",
      "Reply with questions",
      "Forward to a friend",
    ],
  },
  video: {
    label: "Video",
    previewLabel: "Video script preview",
    bodyLabel: "Script",
    description:
      "Polish the script, hook, CTA, and thumbnail before publishing elsewhere.",
    icon: Video,
    ctaFallbacks: [
      "Watch the full clip",
      "Follow for more tips",
      "Visit us for supplies",
    ],
  },
};

const MODE_LABELS: Record<GeneratedBundle["meta"]["mode"], string> = {
  custom: "Custom",
  event: "Event-based",
  holiday: "Holiday",
  seasonal: "Seasonal",
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const normalizeChannel = (
  channel: ModalChannel,
): GeneratedBundleItem["channel"] =>
  channel === "email" ? "newsletter" : channel;

const normalizeHashtag = (value: string) => {
  const trimmed = value.trim().replace(/^#+/, "").replace(/\s+/g, "");
  return trimmed ? `#${trimmed}` : "";
};

const uniqueStrings = (values: string[]) => {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (!value || seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
};

const normalizeDraftItem = (item: GeneratedBundleItem): DraftItem => ({
  ...item,
  body: item.body || "",
  hashtags: uniqueStrings(
    (item.hashtags || []).map(normalizeHashtag).filter(Boolean),
  ),
  ctaSuggestions: uniqueStrings(item.ctaSuggestions || []),
  media: item.media ? { ...item.media } : null,
  _selectedCta: null,
});

const STUDIO_ASPECT_RATIO_HINTS: Record<
  GeneratedBundleItem["channel"],
  AIImageStudioAspectRatio
> = {
  blog: "16:9",
  facebook: "16:9",
  instagram: "1:1",
  newsletter: "16:9",
  video: "16:9",
};

const IMAGE_GENERATION_MESSAGES: Record<
  GeneratedBundleItem["channel"],
  string
> = {
  blog: "Creating your blog header image...",
  facebook: "Generating your Facebook image...",
  instagram: "Crafting your Instagram visual...",
  newsletter: "Designing your newsletter image...",
  video: "Preparing your video thumbnail...",
};

const DEFAULT_CHANNEL: GeneratedBundleItem["channel"] = "newsletter";

const THIN_SCROLLBAR_SX = {
  "&::-webkit-scrollbar": { width: "4px" },
  "&::-webkit-scrollbar-thumb": {
    bgcolor: "neutral.300",
    borderRadius: "4px",
  },
} as const;

const EDIT_SECTION_LABEL_SX = {
  fontSize: "11px",
  fontWeight: 600,
  color: "neutral.500",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: "8px",
} as const;

const FEATURED_IMAGE_ASPECT_RATIO = "16 / 9";

const resolveChannel = (
  channel: ModalChannel,
): GeneratedBundleItem["channel"] => {
  const normalized = normalizeChannel(channel);

  return Object.prototype.hasOwnProperty.call(CHANNEL_CONFIG, normalized)
    ? normalized
    : DEFAULT_CHANNEL;
};

const getChannelConfig = (channel: ModalChannel) =>
  CHANNEL_CONFIG[resolveChannel(channel)];

const buildStudioContentSnippet = (item: DraftItem) =>
  sanitizeWeekNumbers(getPrimaryText(item))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);

const buildStudioInitialPrompt = (item: DraftItem, bundleTitle: string) => {
  const storedImageQuery = item.imageQuery?.trim();
  const channelConfig = getChannelConfig(item.channel);

  if (storedImageQuery) {
    return storedImageQuery;
  }

  return `${item.title?.trim() || bundleTitle} - ${channelConfig.label} content image`;
};

const buildStudioContentContext = (item: DraftItem, bundleTitle: string) => {
  const channelLabel = getChannelConfig(item.channel).label;
  const itemTitle = item.title?.trim();

  if (itemTitle && itemTitle !== bundleTitle) {
    return `${channelLabel} post about ${bundleTitle} - ${itemTitle}`;
  }

  return `${channelLabel} post about ${bundleTitle}`;
};

const mapStudioMetadataToDraftMedia = (
  item: DraftItem,
  imageUrl: string,
  metadata?: AIImageStudioSelectionMetadata,
): DraftMedia => ({
  url: imageUrl,
  alt:
    metadata?.altText ||
    item.media?.alt ||
    item.title ||
    "Selected content image",
  source: metadata?.source || "ai-generated",
  globalImageId: metadata?.globalImageId,
  tags: metadata?.tags?.map((tag) => tag.name).filter(Boolean),
});

const mapImageJobToDraftMedia = (
  item: DraftItem,
  job: ImageGenJob,
): DraftMedia => ({
  url: job.imageUrl || undefined,
  alt: item.media?.alt || item.title || "Generated content image",
  source: "ai-generated",
  globalImageId: job.globalImageId,
  tags: job.tags,
});

function EditSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Box sx={{ marginBottom: "20px" }}>
      <Typography sx={EDIT_SECTION_LABEL_SX}>{label}</Typography>
      {children}
    </Box>
  );
}

function GeneratingImageState({
  channel,
  startedAt,
}: {
  channel: GeneratedBundleItem["channel"];
  startedAt: number;
}) {
  const prefersReducedMotion = useMediaQuery(
    "(prefers-reduced-motion: reduce)",
  );
  const [showDurationHint, setShowDurationHint] = useState(
    Date.now() - startedAt >= 10000,
  );

  useEffect(() => {
    if (showDurationHint) {
      return;
    }

    const remainingDelay = Math.max(0, 10000 - (Date.now() - startedAt));
    const timeoutId = window.setTimeout(() => {
      setShowDurationHint(true);
    }, remainingDelay);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [showDurationHint, startedAt]);

  return (
    <Sheet
      variant="soft"
      color="neutral"
      sx={{
        position: "relative",
        aspectRatio: FEATURED_IMAGE_ASPECT_RATIO,
        borderRadius: "10px",
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        backgroundColor: "background.level1",
        backgroundImage:
          "linear-gradient(90deg, transparent 0%, rgba(var(--joy-palette-primary-mainChannel) / 0.08) 50%, transparent 100%)",
        backgroundSize: "200% 100%",
        animation: prefersReducedMotion
          ? "none"
          : "content-image-shimmer 2s ease-in-out infinite",
        "@keyframes content-image-shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      }}
    >
      <Stack
        spacing={1}
        alignItems="center"
        sx={{ padding: "0 16px", textAlign: "center" }}
      >
        {prefersReducedMotion ? (
          <Sparkles size={20} />
        ) : (
          <CircularProgress size="sm" variant="soft" color="primary" />
        )}
        <Typography level="body-xs" color="neutral">
          {IMAGE_GENERATION_MESSAGES[channel]}
        </Typography>
        {showDurationHint ? (
          <Typography level="body-xs" color="neutral">
            This usually takes 15-30 seconds
          </Typography>
        ) : null}
      </Stack>
    </Sheet>
  );
}

function FailedImageState({
  channel,
  onOpenStudio,
  onRetry,
}: {
  channel: GeneratedBundleItem["channel"];
  onOpenStudio: () => void;
  onRetry: () => void;
}) {
  return (
    <Sheet
      variant="soft"
      color="danger"
      sx={{
        aspectRatio: FEATURED_IMAGE_ASPECT_RATIO,
        borderRadius: "10px",
        display: "grid",
        placeItems: "center",
        bgcolor: "danger.50",
      }}
    >
      <Stack
        spacing={1.25}
        alignItems="center"
        sx={{ padding: "0 16px", textAlign: "center" }}
      >
        <AlertTriangle size={22} />
        <Typography level="body-sm" color="danger">
          Image generation failed
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" color="danger" size="sm" onClick={onRetry}>
            Retry
          </Button>
          <Button
            variant="plain"
            color="neutral"
            size="sm"
            onClick={onOpenStudio}
          >
            Open AI Studio
          </Button>
        </Stack>
      </Stack>
    </Sheet>
  );
}

const getPrimaryText = (item: DraftItem) => {
  const candidates = [
    item.body,
    item.markdown,
    item.script,
    item.caption,
    item.text,
    item.content,
  ].filter((value): value is string => Boolean(value));

  return candidates.sort((left, right) => right.length - left.length)[0] || "";
};

const getEditableField = (item: DraftItem): EditableField => {
  const channel = normalizeChannel(item.channel);

  if (channel === "instagram" || channel === "facebook") {
    const fields: EditableField[] = [
      "caption",
      "text",
      "content",
      "body",
      "markdown",
      "script",
    ];
    return (
      fields.find(
        (field) => typeof item[field] === "string" && item[field]?.length,
      ) || "caption"
    );
  }

  if (channel === "video") {
    return typeof item.script === "string" && item.script.length
      ? "script"
      : "body";
  }

  return "body";
};

const getBlogPreviewHtml = (item: DraftItem) => {
  const source = sanitizeWeekNumbers(item.body || item.markdown || "").trim();

  if (!source) {
    return "<p>No article content yet. Use the editor to start shaping the draft.</p>";
  }

  if (HTML_TAG_PATTERN.test(source)) {
    return sanitizeHtml(source);
  }

  const paragraphs = source
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map(
      (paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`,
    );

  return paragraphs.join("");
};

const formatRelativeTime = (isoDate?: string | null) => {
  if (!isoDate) {
    return "Generated recently";
  }

  const target = new Date(isoDate).getTime();
  if (Number.isNaN(target)) {
    return "Generated recently";
  }

  const diffMs = target - Date.now();
  const absSeconds = Math.round(Math.abs(diffMs) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (absSeconds < 60) {
    return `Generated ${rtf.format(Math.round(diffMs / 1000), "second")}`;
  }

  const absMinutes = Math.round(absSeconds / 60);
  if (absMinutes < 60) {
    return `Generated ${rtf.format(Math.round(diffMs / 60000), "minute")}`;
  }

  const absHours = Math.round(absMinutes / 60);
  if (absHours < 24) {
    return `Generated ${rtf.format(Math.round(diffMs / 3600000), "hour")}`;
  }

  const absDays = Math.round(absHours / 24);
  return `Generated ${rtf.format(Math.round(diffMs / 86400000), "day")}`;
};

export function GeneratedContentModal({
  open,
  onOpenChange,
}: GeneratedContentModalProps) {
  const { bundleId, snapshotId, setBundleIds } = useCreateFlow();
  const { query, update } = useGeneratedBundle(bundleId || undefined);
  const navigate = useNavigate();
  const { open: openImageStudio } = useAIImageStudio();
  const imageJobs = useImageGenerationTracker((state) =>
    bundleId ? state.jobs.get(bundleId) : undefined,
  );

  const sourceItems = useMemo(
    () => (query.data?.content.items || []).map(normalizeDraftItem),
    [query.data?.content.items],
  );

  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [dirty, setDirty] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState(0);
  const [hashtagInput, setHashtagInput] = useState("");
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [snackbarState, setSnackbarState] = useState<{
    open: boolean;
    color: SnackbarColor;
    message: string;
  }>({
    open: false,
    color: "neutral",
    message: "",
  });

  const showSnackbar = useCallback(
    (message: string, color: SnackbarColor = "neutral") => {
      setSnackbarState({ open: true, color, message });
    },
    [],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    if (dirty.size === 0) {
      setDraftItems(sourceItems);
    }
  }, [dirty.size, open, sourceItems]);

  useEffect(() => {
    if (draftItems.length === 0) {
      setActiveTab(0);
      return;
    }

    if (activeTab > draftItems.length - 1) {
      setActiveTab(0);
    }
  }, [activeTab, draftItems.length]);

  useEffect(() => {
    setHashtagInput("");
  }, [activeTab]);

  useEffect(() => {
    if (!bundleId || !imageJobs) {
      return;
    }

    const completedPatches = draftItems
      .map((item, index) => {
        const channel = resolveChannel(item.channel);
        const job = imageJobs.get(channel);

        if (item.media?.url || job?.status !== "completed" || !job.imageUrl) {
          return null;
        }

        return {
          index,
          media: mapImageJobToDraftMedia(item, job),
        };
      })
      .filter(
        (patch): patch is { index: number; media: DraftMedia } =>
          patch !== null,
      );

    if (completedPatches.length === 0) {
      return;
    }

    const patchesByIndex = new Map(
      completedPatches.map((patch) => [patch.index, patch.media]),
    );

    setDraftItems((currentItems) =>
      currentItems.map((item, index) => {
        if (item.media?.url) {
          return item;
        }

        const media = patchesByIndex.get(index);
        return media ? { ...item, media } : item;
      }),
    );
  }, [bundleId, draftItems, imageJobs]);

  const bundleTitle = useMemo(() => {
    const titleFromBundle = query.data?.content.sourceLabel?.trim();
    if (titleFromBundle) {
      return titleFromBundle;
    }

    const titleFromItems = draftItems
      .find((item) => item.title?.trim())
      ?.title?.trim();
    return titleFromItems || "Generated content bundle";
  }, [draftItems, query.data?.content.sourceLabel]);

  const bundleModeLabel = useMemo(() => {
    const mode = query.data?.content.meta?.mode || "custom";
    return MODE_LABELS[mode];
  }, [query.data?.content.meta?.mode]);

  const bundleTimeAgo = useMemo(
    () =>
      formatRelativeTime(query.data?.created_at).replace(/^Generated\s+/, ""),
    [query.data?.created_at],
  );

  const activeItem = draftItems[activeTab] || null;
  const approvedCount = draftItems.filter((item) => item._approved).length;
  const approvedSocialChannels = useMemo(
    () =>
      Array.from(
        new Set(
          draftItems.flatMap((item) => {
            const channel = normalizeChannel(item.channel);
            if (
              !item._approved ||
              (channel !== "instagram" && channel !== "facebook")
            ) {
              return [];
            }

            return [channel];
          }),
        ),
      ),
    [draftItems],
  );
  const approvedSocialCount = approvedSocialChannels.length;
  const dirtyCount = dirty.size;
  const hasUnsavedChanges = dirtyCount > 0;

  const editItem = useCallback((index: number, patch: Partial<DraftItem>) => {
    setDraftItems((prev) => {
      const next = [...prev];
      const currentItem = next[index];
      if (!currentItem) {
        return prev;
      }

      next[index] = { ...currentItem, ...patch };
      return next;
    });
    setDirty((prev) => {
      const n = new Set(prev);
      n.add(index);
      return n;
    });
  }, []);

  const finalizeClose = useCallback(() => {
    setConfirmCloseOpen(false);
    setDirty(new Set());
    setBundleIds(null, null);
    onOpenChange(false);
  }, [onOpenChange, setBundleIds]);

  const persistDraftChanges = useCallback(
    async (options?: { closeAfter?: boolean }) => {
      if (!query.data || !bundleId || dirty.size === 0) {
        if (options?.closeAfter) {
          finalizeClose();
        }
        return true;
      }

      const itemsToPersist = draftItems.map(
        ({ _selectedCta, ...item }) => item,
      );
      const nextContent: GeneratedBundle = {
        ...query.data.content,
        items: itemsToPersist as GeneratedBundleItem[],
      };

      try {
        const result = await update.mutateAsync({
          snapshotId: query.data.id || snapshotId || bundleId,
          content: nextContent,
        });

        const mergedItems = (
          result?.merged_content?.items || itemsToPersist
        ).map(normalizeDraftItem);
        setDraftItems(mergedItems);
        setDirty(new Set());
        showSnackbar("Changes saved", "success");

        if (options?.closeAfter) {
          finalizeClose();
        }

        return true;
      } catch (error) {
        showSnackbar(
          getErrorMessage(error, "Failed to save changes"),
          "danger",
        );
        return false;
      }
    },
    [
      bundleId,
      dirty.size,
      draftItems,
      finalizeClose,
      query.data,
      showSnackbar,
      snapshotId,
      update,
    ],
  );

  const handleRequestClose = useCallback(() => {
    if (update.isPending) {
      return;
    }

    if (hasUnsavedChanges) {
      setConfirmCloseOpen(true);
      return;
    }

    finalizeClose();
  }, [finalizeClose, hasUnsavedChanges, update.isPending]);

  const handleApproveToggle = useCallback(
    (index: number) => {
      const item = draftItems[index];
      if (!item) {
        return;
      }

      editItem(index, { _approved: !item._approved });
    },
    [draftItems, editItem],
  );

  const handleApproveAll = useCallback(() => {
    setDraftItems((prev) =>
      prev.map((item) => ({
        ...item,
        _approved: true,
      })),
    );

    setDirty((prev) => {
      const next = new Set(prev);
      draftItems.forEach((item, index) => {
        if (!item._approved) {
          next.add(index);
        }
      });
      return next;
    });
  }, [draftItems]);

  const handleTextChange = useCallback(
    (index: number, value: string) => {
      const item = draftItems[index];
      if (!item) {
        return;
      }

      const field = getEditableField(item);
      editItem(index, { [field]: value } as Partial<DraftItem>);
    },
    [draftItems, editItem],
  );

  const handleAddHashtag = useCallback(() => {
    if (!activeItem) {
      return;
    }

    const normalized = normalizeHashtag(hashtagInput);
    if (!normalized) {
      return;
    }

    editItem(activeTab, {
      hashtags: uniqueStrings([...(activeItem.hashtags || []), normalized]),
    });
    setHashtagInput("");
  }, [activeItem, activeTab, editItem, hashtagInput]);

  const handleRemoveHashtag = useCallback(
    (hashtag: string) => {
      if (!activeItem) {
        return;
      }

      editItem(activeTab, {
        hashtags: (activeItem.hashtags || []).filter(
          (value) => value !== hashtag,
        ),
      });
    },
    [activeItem, activeTab, editItem],
  );

  const appendCtaToItem = useCallback(
    (item: DraftItem, cta: string): Partial<DraftItem> => {
      const field = getEditableField(item);
      const currentValue = (item[field] || "") as string;
      if (currentValue.includes(cta)) {
        return { _selectedCta: item._selectedCta === cta ? null : cta };
      }

      if (
        (field === "body" || field === "markdown") &&
        HTML_TAG_PATTERN.test(currentValue)
      ) {
        return {
          [field]: `${currentValue}<p>${escapeHtml(cta)}</p>`,
          _selectedCta: cta,
        } as Partial<DraftItem>;
      }

      const nextValue = [currentValue.trim(), cta]
        .filter(Boolean)
        .join(currentValue.trim() ? "\n\n" : "");
      return {
        [field]: nextValue,
        _selectedCta: cta,
      } as Partial<DraftItem>;
    },
    [],
  );

  const handleSelectCta = useCallback(
    (cta: string) => {
      if (!activeItem) {
        return;
      }

      editItem(activeTab, appendCtaToItem(activeItem, cta));
    },
    [activeItem, activeTab, appendCtaToItem, editItem],
  );

  const handleOpenImageStudio = useCallback(
    (index: number, item: DraftItem) => {
      const channel = resolveChannel(item.channel);
      const channelConfig = getChannelConfig(item.channel);

      openImageStudio({
        aspectRatioHint: STUDIO_ASPECT_RATIO_HINTS[channel],
        assignmentLabel: item.title?.trim() || `${channelConfig.label} image`,
        channel,
        contentTitle: item.title?.trim() || bundleTitle,
        contentContext: buildStudioContentContext(item, bundleTitle),
        context: {
          source: "content-generation",
          channel,
          topicTitle: bundleTitle,
          topicDescription: item.summary?.trim() || channelConfig.description,
          contentSnippet: buildStudioContentSnippet(item),
        },
        contextLabel: `${channelConfig.label} image for ${item.title?.trim() || bundleTitle}`,
        contextType: "content_generation_bundle_item",
        defaultTab: "ai",
        initialPrompt: buildStudioInitialPrompt(item, bundleTitle),
        onSelect: (imageUrl, metadata) => {
          editItem(index, {
            media: mapStudioMetadataToDraftMedia(item, imageUrl, metadata),
          });
          showSnackbar("Image updated from AI Studio", "success");
        },
      });
    },
    [bundleTitle, editItem, openImageStudio, showSnackbar],
  );

  const handleRetryImageGeneration = useCallback(
    (item: DraftItem) => {
      if (!bundleId) {
        return;
      }

      const channel = resolveChannel(item.channel);
      void retryBundleImageGeneration({ bundleId, channel }).catch((error) => {
        console.error(
          `[GeneratedContentModal] Failed to retry ${channel} image generation`,
          error,
        );
      });
    },
    [bundleId],
  );

  const renderFeaturedImageArea = (index: number, item: DraftItem) => {
    const channel = resolveChannel(item.channel);
    const job = imageJobs?.get(channel);
    const imageUrl =
      item.media?.url ||
      (job?.status === "completed" ? job.imageUrl || undefined : undefined);

    if (imageUrl) {
      return (
        <Box
          sx={{
            position: "relative",
            borderRadius: "10px",
            overflow: "hidden",
            "&:hover .generated-content-image-overlay": {
              opacity: 1,
            },
          }}
        >
          <Box
            component="img"
            src={imageUrl}
            alt={item.media?.alt || item.title || "Selected content image"}
            sx={{
              width: "100%",
              aspectRatio: FEATURED_IMAGE_ASPECT_RATIO,
              objectFit: "cover",
              display: "block",
            }}
          />
          <Box
            className="generated-content-image-overlay"
            sx={{
              position: "absolute",
              inset: 0,
              bgcolor: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              opacity: 0,
              transition: "opacity 0.2s ease",
            }}
          >
            <Button
              size="sm"
              variant="solid"
              color="primary"
              onClick={() => handleOpenImageStudio(index, item)}
              sx={{ borderRadius: "8px", fontSize: "12px" }}
            >
              Change
            </Button>
            <Button
              size="sm"
              variant="solid"
              color="danger"
              onClick={() => editItem(index, { media: null })}
              sx={{ borderRadius: "8px", fontSize: "12px" }}
            >
              Remove
            </Button>
          </Box>
        </Box>
      );
    }

    if (job?.status === "generating") {
      return (
        <GeneratingImageState channel={channel} startedAt={job.startedAt} />
      );
    }

    if (job?.status === "failed") {
      return (
        <FailedImageState
          channel={channel}
          onRetry={() => handleRetryImageGeneration(item)}
          onOpenStudio={() => handleOpenImageStudio(index, item)}
        />
      );
    }

    return (
      <Box
        onClick={() => handleOpenImageStudio(index, item)}
        sx={{
          width: "100%",
          aspectRatio: FEATURED_IMAGE_ASPECT_RATIO,
          borderRadius: "10px",
          border: "1px dashed",
          borderColor: "neutral.300",
          bgcolor: "neutral.50",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "8px",
          cursor: "pointer",
          transition: "all 0.15s ease",
          "&:hover": {
            borderColor: "primary.300",
            bgcolor: "primary.50",
          },
        }}
      >
        <AutoAwesomeRounded
          htmlColor="var(--joy-palette-neutral-400)"
          style={{ fontSize: 24 }}
        />
        <Typography
          sx={{ fontSize: "12px", fontWeight: 500, color: "neutral.500" }}
        >
          Generate with AI Studio
        </Typography>
      </Box>
    );
  };

  const handlePublish = useCallback(async () => {
    if (!bundleId || approvedSocialCount === 0) {
      return;
    }

    const saved = await persistDraftChanges();
    if (!saved) {
      return;
    }

    const approvedParam = approvedSocialChannels.join(",");

    finalizeClose();
    navigate(
      `/publish?bundleId=${bundleId}&approved=${encodeURIComponent(approvedParam)}`,
    );
  }, [
    approvedSocialChannels,
    approvedSocialCount,
    bundleId,
    finalizeClose,
    navigate,
    persistDraftChanges,
  ]);

  const handleOpenNewsletterDraft = useCallback(
    async (item: DraftItem) => {
      if (!bundleId) {
        return;
      }

      const saved = await persistDraftChanges();
      if (!saved) {
        return;
      }

      const newsletterData = {
        title: item.title || bundleTitle,
        content: sanitizeWeekNumbers(item.body || getPrimaryText(item)),
        featuredImage: item.media?.url || "",
        bundleId,
      };
      const params = new URLSearchParams({
        type: "newsletter",
        bundleId,
        prefillData: JSON.stringify(newsletterData),
      });

      showSnackbar("Opening Campaign Draft", "success");
      finalizeClose();
      navigate(`/crm/campaigns/new?${params.toString()}`);
    },
    [
      bundleId,
      bundleTitle,
      finalizeClose,
      navigate,
      persistDraftChanges,
      showSnackbar,
    ],
  );

  const renderSocialPreview = (item: DraftItem) => {
    const config = getChannelConfig(item.channel);
    const channel = resolveChannel(item.channel);
    const previewText = sanitizeWeekNumbers(getPrimaryText(item));
    const hashtags = item.hashtags || [];

    return (
      <Box
        sx={{
          borderRadius: "12px",
          border: "1px solid",
          borderColor: "neutral.200",
          bgcolor: "background.surface",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            padding: "14px 16px",
            gap: "10px",
          }}
        >
          <Box
            sx={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              bgcolor: "primary.100",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "primary.600",
              fontWeight: 700,
              fontSize: "14px",
            }}
          >
            {bundleTitle.slice(0, 1).toUpperCase()}
          </Box>
          <Box>
            <Typography
              sx={{ fontSize: "13px", fontWeight: 600, color: "neutral.800" }}
            >
              {bundleTitle}
            </Typography>
            <Typography sx={{ fontSize: "11px", color: "neutral.400" }}>
              {config.label} post preview
            </Typography>
          </Box>
        </Box>

        {item.media?.url ? (
          <Box
            component="img"
            src={item.media.url}
            alt={item.media.alt || item.title || config.label}
            sx={{
              width: "100%",
              aspectRatio: channel === "instagram" ? "1 / 1" : "16 / 9",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : null}

        <Box sx={{ padding: "14px 16px" }}>
          <Typography
            sx={{
              fontSize: "13px",
              color: "neutral.700",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              maxHeight: "200px",
              overflowY: "auto",
              "&::-webkit-scrollbar": { width: "3px" },
              "&::-webkit-scrollbar-thumb": {
                bgcolor: "neutral.200",
                borderRadius: "3px",
              },
            }}
          >
            {previewText ||
              "Write the social copy in the editor to see it here."}
          </Typography>

          {hashtags.length > 0 ? (
            <Typography
              sx={{
                fontSize: "12px",
                color: "primary.500",
                marginTop: "8px",
                lineHeight: 1.5,
              }}
            >
              {hashtags.map((tag) => `#${tag.replace("#", "")}`).join(" ")}
            </Typography>
          ) : null}
        </Box>
      </Box>
    );
  };

  const renderBlogPreview = (item: DraftItem) => (
    <Box
      sx={{
        borderRadius: "12px",
        border: "1px solid",
        borderColor: "neutral.200",
        bgcolor: "background.surface",
        padding: "28px 24px",
        "& h2": {
          fontSize: "18px",
          fontWeight: 700,
          color: "neutral.800",
          marginBottom: "12px",
          marginTop: "24px",
        },
        "& p": {
          fontSize: "14px",
          lineHeight: 1.7,
          color: "neutral.600",
          marginBottom: "12px",
        },
        "& ul": {
          paddingLeft: "20px",
          marginBottom: "12px",
        },
        "& li": {
          fontSize: "14px",
          lineHeight: 1.7,
          color: "neutral.600",
          marginBottom: "4px",
        },
        "& strong": {
          fontWeight: 600,
          color: "neutral.700",
        },
      }}
    >
      {item.media?.url ? (
        <Box
          component="img"
          src={item.media.url}
          alt={item.media.alt || item.title || "Blog cover image"}
          sx={{
            width: "100%",
            aspectRatio: "16 / 9",
            objectFit: "cover",
            borderRadius: "8px",
            marginBottom: "20px",
          }}
        />
      ) : null}
      <Box dangerouslySetInnerHTML={{ __html: getBlogPreviewHtml(item) }} />
    </Box>
  );

  const renderNewsletterPreview = (item: DraftItem) => (
    <Box
      sx={{
        borderRadius: "12px",
        border: "1px solid",
        borderColor: "neutral.200",
        bgcolor: "background.surface",
        overflow: "hidden",
      }}
    >
      <EditableNewsletterPreview
        content={sanitizeWeekNumbers(item.body || "")}
        title={item.title || bundleTitle}
        onChange={(content) => editItem(activeTab, { body: content })}
      />
    </Box>
  );

  const renderVideoPreview = (item: DraftItem) => (
    <Box
      sx={{
        borderRadius: "12px",
        border: "1px solid",
        borderColor: "neutral.200",
        bgcolor: "background.surface",
        overflow: "hidden",
      }}
    >
      {item.media?.url ? (
        <Box
          component="img"
          src={item.media.url}
          alt={item.media.alt || item.title || "Video thumbnail"}
          sx={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover" }}
        />
      ) : (
        <Box
          sx={{
            width: "100%",
            aspectRatio: "16 / 9",
            bgcolor: "neutral.100",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "neutral.400",
          }}
        >
          <Video size={28} />
        </Box>
      )}
      <Box sx={{ padding: "20px 20px 22px 20px" }}>
        <Typography
          sx={{
            fontSize: "15px",
            fontWeight: 700,
            color: "neutral.800",
            marginBottom: "8px",
          }}
        >
          {item.title || "Video concept"}
        </Typography>
        <Typography
          sx={{
            fontSize: "13px",
            lineHeight: 1.7,
            color: "neutral.600",
            whiteSpace: "pre-wrap",
          }}
        >
          {sanitizeWeekNumbers(
            item.script || item.body || "No script drafted yet.",
          )}
        </Typography>
      </Box>
    </Box>
  );

  const renderPreview = (item: DraftItem) => {
    const channel = normalizeChannel(item.channel);

    if (channel === "instagram" || channel === "facebook") {
      return renderSocialPreview(item);
    }

    if (channel === "blog") {
      return renderBlogPreview(item);
    }

    if (channel === "video") {
      return renderVideoPreview(item);
    }

    return renderNewsletterPreview(item);
  };

  const renderBodyEditor = (item: DraftItem) => {
    const channel = normalizeChannel(item.channel);
    const config = getChannelConfig(item.channel);
    const value = getPrimaryText(item);

    if (channel === "instagram" || channel === "facebook") {
      const limit = config.charLimit || 0;

      return (
        <EditSection label={config.bodyLabel.toUpperCase()}>
          <Textarea
            variant="outlined"
            minRows={6}
            maxRows={12}
            value={value}
            onChange={(event) =>
              handleTextChange(activeTab, event.target.value)
            }
            placeholder={`Write the ${config.bodyLabel.toLowerCase()} here...`}
            sx={{
              borderRadius: "10px",
              fontSize: "13px",
              lineHeight: 1.6,
              "--Textarea-focusedHighlight": "var(--joy-palette-primary-500)",
            }}
          />
          <Typography
            sx={{
              fontSize: "11px",
              color: "neutral.400",
              textAlign: "right",
              marginTop: "4px",
            }}
          >
            {value.length} / {limit} chars
          </Typography>
        </EditSection>
      );
    }

    if (channel === "blog") {
      return (
        <EditSection label="BODY">
          <Sheet
            variant="outlined"
            sx={{
              borderRadius: "10px",
              overflow: "hidden",
              bgcolor: "background.surface",
            }}
          >
            <RichTextEditor
              content={item.body || item.markdown || ""}
              onChange={(html) => editItem(activeTab, { body: html })}
              placeholder="Write and format the article body..."
            />
          </Sheet>
        </EditSection>
      );
    }

    if (channel === "video") {
      return (
        <EditSection label={config.bodyLabel.toUpperCase()}>
          <Textarea
            variant="outlined"
            minRows={6}
            maxRows={12}
            value={value}
            onChange={(event) =>
              handleTextChange(activeTab, event.target.value)
            }
            placeholder="Shape the video script here..."
            sx={{
              borderRadius: "10px",
              fontSize: "13px",
              lineHeight: 1.6,
              "--Textarea-focusedHighlight": "var(--joy-palette-primary-500)",
            }}
          />
        </EditSection>
      );
    }

    return (
      <EditSection label="BODY">
        <Sheet
          variant="soft"
          color="neutral"
          sx={{ borderRadius: "10px", padding: "16px" }}
        >
          <Typography
            sx={{ fontSize: "13px", fontWeight: 600, color: "neutral.700" }}
          >
            Newsletter body editing lives in the preview pane
          </Typography>
          <Typography
            sx={{
              fontSize: "12px",
              color: "neutral.500",
              marginTop: "6px",
              lineHeight: 1.6,
            }}
          >
            Use the newsletter preview’s edit mode to update the body while
            keeping the block-style structure in view.
          </Typography>
        </Sheet>
      </EditSection>
    );
  };

  return (
    <>
      <Modal open={open} onClose={handleRequestClose}>
        <ModalDialog
          variant="plain"
          aria-modal="true"
          sx={{
            width: "100%",
            maxWidth: "1200px",
            height: "100%",
            maxHeight: "92vh",
            margin: "auto",
            borderRadius: "16px",
            padding: 0,
            overflow: "hidden",
            bgcolor: "background.surface",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            display: "flex",
            flexDirection: "column",
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          <Box
            sx={{ display: "flex", flexDirection: "column", height: "100%" }}
          >
            {query.isLoading ? (
              <>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    padding: "20px 28px 0 28px",
                  }}
                >
                  <Box sx={{ width: "100%", maxWidth: "320px" }}>
                    <Skeleton
                      variant="text"
                      sx={{ width: "220px", height: "28px" }}
                    />
                    <Box sx={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                      <Skeleton
                        variant="text"
                        sx={{ width: "90px", height: "16px" }}
                      />
                      <Skeleton
                        variant="text"
                        sx={{ width: "80px", height: "16px" }}
                      />
                      <Skeleton
                        variant="text"
                        sx={{ width: "72px", height: "16px" }}
                      />
                    </Box>
                  </Box>
                  <ModalClose
                    sx={{
                      position: "static",
                      borderRadius: "8px",
                      "--ModalClose-radius": "8px",
                    }}
                  />
                </Box>
                <Box sx={{ padding: "16px 28px 0 28px" }}>
                  <Skeleton
                    variant="rectangular"
                    sx={{ width: "100%", height: "48px", borderRadius: "10px" }}
                  />
                </Box>
                <Box
                  sx={{
                    flex: 1,
                    overflow: "hidden",
                    display: "flex",
                    borderTop: "1px solid",
                    borderColor: "neutral.100",
                    marginTop: "16px",
                  }}
                >
                  <Box
                    sx={{
                      width: "55%",
                      overflowY: "auto",
                      padding: "24px 28px",
                      borderRight: "1px solid",
                      borderColor: "neutral.100",
                      bgcolor: "neutral.50",
                      ...THIN_SCROLLBAR_SX,
                    }}
                  >
                    <Skeleton
                      variant="rectangular"
                      sx={{
                        width: "100%",
                        height: "420px",
                        borderRadius: "12px",
                      }}
                    />
                  </Box>
                  <Box
                    sx={{
                      width: "45%",
                      overflowY: "auto",
                      padding: "24px 24px",
                      ...THIN_SCROLLBAR_SX,
                    }}
                  >
                    <Stack spacing={2}>
                      <Skeleton
                        variant="text"
                        sx={{ width: "80px", height: "18px" }}
                      />
                      <Skeleton
                        variant="rectangular"
                        sx={{
                          width: "100%",
                          height: "44px",
                          borderRadius: "10px",
                        }}
                      />
                      <Skeleton
                        variant="text"
                        sx={{ width: "100px", height: "18px" }}
                      />
                      <Skeleton
                        variant="rectangular"
                        sx={{
                          width: "100%",
                          height: "220px",
                          borderRadius: "10px",
                        }}
                      />
                      <Skeleton
                        variant="text"
                        sx={{ width: "110px", height: "18px" }}
                      />
                      <Skeleton
                        variant="rectangular"
                        sx={{
                          width: "100%",
                          height: "210px",
                          borderRadius: "10px",
                        }}
                      />
                    </Stack>
                  </Box>
                </Box>
              </>
            ) : draftItems.length === 0 ? (
              <>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    padding: "20px 28px 0 28px",
                  }}
                >
                  <Box>
                    <Typography
                      level="title-lg"
                      sx={{
                        fontWeight: 700,
                        color: "neutral.800",
                        fontSize: "18px",
                      }}
                    >
                      {bundleTitle}
                    </Typography>
                    <Typography
                      level="body-sm"
                      sx={{ color: "neutral.500", marginTop: "4px" }}
                    >
                      Generate a bundle first, then review and approve it here.
                    </Typography>
                  </Box>
                  <ModalClose
                    sx={{
                      position: "static",
                      borderRadius: "8px",
                      "--ModalClose-radius": "8px",
                    }}
                    onClick={handleRequestClose}
                  />
                </Box>
                <Box
                  sx={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "24px",
                  }}
                >
                  <Box sx={{ textAlign: "center", maxWidth: "360px" }}>
                    <Typography
                      level="title-md"
                      sx={{ fontWeight: 700, color: "neutral.800" }}
                    >
                      No generated content yet
                    </Typography>
                    <Typography
                      level="body-sm"
                      sx={{
                        color: "neutral.500",
                        marginTop: "8px",
                        lineHeight: 1.6,
                      }}
                    >
                      Generate a content bundle first, then come back here to
                      review, edit, and approve each channel draft.
                    </Typography>
                  </Box>
                </Box>
              </>
            ) : (
              <Tabs
                value={activeTab}
                onChange={(_, value) => {
                  if (value !== null) {
                    setActiveTab(Number(value));
                  }
                }}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  minHeight: 0,
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    padding: "20px 28px 0 28px",
                  }}
                >
                  <Box>
                    <Typography
                      level="title-lg"
                      sx={{
                        fontWeight: 700,
                        color: "neutral.800",
                        fontSize: "18px",
                      }}
                    >
                      {bundleTitle}
                    </Typography>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginTop: "4px",
                        flexWrap: "wrap",
                      }}
                    >
                      <Typography level="body-xs" sx={{ color: "neutral.400" }}>
                        {bundleModeLabel} · Generated {bundleTimeAgo}
                      </Typography>
                      <Box
                        sx={{
                          width: "3px",
                          height: "3px",
                          borderRadius: "50%",
                          bgcolor: "neutral.300",
                        }}
                      />
                      <Typography level="body-xs" sx={{ color: "neutral.400" }}>
                        {draftItems.length} channels
                      </Typography>
                      <Box
                        sx={{
                          width: "3px",
                          height: "3px",
                          borderRadius: "50%",
                          bgcolor: "neutral.300",
                        }}
                      />
                      <Typography
                        level="body-xs"
                        sx={{
                          color:
                            approvedCount > 0 ? "success.600" : "neutral.400",
                        }}
                      >
                        {approvedCount} approved
                      </Typography>
                    </Box>
                  </Box>

                  <ModalClose
                    sx={{
                      position: "static",
                      borderRadius: "8px",
                      "--ModalClose-radius": "8px",
                    }}
                    onClick={handleRequestClose}
                  />
                </Box>

                <Box sx={{ padding: "16px 28px 0 28px" }}>
                  <TabList
                    disableUnderline
                    sx={{
                      gap: "4px",
                      bgcolor: "neutral.50",
                      borderRadius: "10px",
                      padding: "4px",
                      "--TabList-gap": "4px",
                      border: "1px solid",
                      borderColor: "neutral.100",
                    }}
                  >
                    {draftItems.map((item, index) => {
                      const config = getChannelConfig(item.channel);
                      const Icon = config.icon;

                      return (
                        <Tab
                          key={`${item.channel}-${index}`}
                          value={index}
                          disableIndicator
                          sx={{
                            borderRadius: "8px",
                            fontSize: "13px",
                            fontWeight: 600,
                            padding: "8px 16px",
                            color: "neutral.600",
                            minHeight: "auto",
                            "&::after": {
                              display: "none",
                            },
                            "&.Mui-selected": {
                              bgcolor: "background.surface",
                              color: "neutral.800",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                            },
                            "&:hover:not(.Mui-selected)": {
                              bgcolor: "neutral.100",
                            },
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <Icon size={14} />
                            {config.label}
                            {item._approved ? (
                              <Box
                                sx={{
                                  width: "6px",
                                  height: "6px",
                                  borderRadius: "50%",
                                  bgcolor: "success.500",
                                }}
                              />
                            ) : null}
                          </Box>
                        </Tab>
                      );
                    })}
                  </TabList>
                </Box>

                <Box
                  sx={{
                    flex: 1,
                    overflow: "hidden",
                    display: "flex",
                    borderTop: "1px solid",
                    borderColor: "neutral.100",
                    marginTop: "16px",
                  }}
                >
                  {draftItems.map((item, index) => {
                    const config = getChannelConfig(item.channel);
                    const ctaSuggestions = uniqueStrings([
                      ...(item.ctaSuggestions || []),
                      ...config.ctaFallbacks,
                    ]);
                    const isSocialChannel =
                      normalizeChannel(item.channel) === "instagram" ||
                      normalizeChannel(item.channel) === "facebook";
                    const canEditHashtags =
                      isSocialChannel || (item.hashtags || []).length > 0;

                    return (
                      <TabPanel
                        key={`${item.channel}-panel-${index}`}
                        value={index}
                        sx={{ padding: 0, flex: 1, minHeight: 0 }}
                      >
                        <Box
                          sx={{
                            height: "100%",
                            display: "flex",
                            borderTop: 0,
                          }}
                        >
                          <Box
                            sx={{
                              width: "55%",
                              overflowY: "auto",
                              padding: "24px 28px",
                              borderRight: "1px solid",
                              borderColor: "neutral.100",
                              bgcolor: "neutral.50",
                              ...THIN_SCROLLBAR_SX,
                            }}
                          >
                            {renderPreview(item)}
                          </Box>

                          <Box
                            sx={{
                              width: "45%",
                              overflowY: "auto",
                              padding: "24px 24px",
                              ...THIN_SCROLLBAR_SX,
                            }}
                          >
                            <Box
                              sx={{
                                display: "flex",
                                justifyContent: "flex-end",
                                marginBottom: "16px",
                              }}
                            >
                              {item._approved ? (
                                <Box
                                  sx={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    padding: "4px 12px",
                                    borderRadius: "100px",
                                    bgcolor: "success.50",
                                    border: "1px solid",
                                    borderColor: "success.200",
                                  }}
                                >
                                  <CheckCircleRounded
                                    htmlColor="var(--joy-palette-success-600)"
                                    style={{ fontSize: 14 }}
                                  />
                                  <Typography
                                    sx={{
                                      fontSize: "12px",
                                      fontWeight: 600,
                                      color: "success.700",
                                    }}
                                  >
                                    Approved
                                  </Typography>
                                </Box>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="soft"
                                  color="success"
                                  onClick={() => handleApproveToggle(index)}
                                  startDecorator={
                                    <CheckCircleRounded
                                      style={{ fontSize: 14 }}
                                    />
                                  }
                                  sx={{
                                    borderRadius: "100px",
                                    fontSize: "12px",
                                    fontWeight: 600,
                                  }}
                                >
                                  Approve
                                </Button>
                              )}
                            </Box>

                            {normalizeChannel(item.channel) === "newsletter" &&
                            item._approved ? (
                              <Box sx={{ marginBottom: "20px" }}>
                                <Button
                                  variant="outlined"
                                  color="neutral"
                                  size="sm"
                                  data-testid="send-to-block-builder"
                                  startDecorator={<Newspaper size={16} />}
                                  onClick={() =>
                                    void handleOpenNewsletterDraft(item)
                                  }
                                  sx={{
                                    borderRadius: "8px",
                                    fontSize: "13px",
                                    fontWeight: 600,
                                  }}
                                >
                                  Open Campaign Draft
                                </Button>
                              </Box>
                            ) : null}

                            <EditSection label="TITLE">
                              <Input
                                value={item.title || ""}
                                onChange={(event) =>
                                  editItem(index, {
                                    title: event.target.value,
                                  })
                                }
                                variant="outlined"
                                sx={{
                                  borderRadius: "10px",
                                  fontSize: "14px",
                                  fontWeight: 600,
                                  "--Input-focusedHighlight":
                                    "var(--joy-palette-primary-500)",
                                }}
                              />
                            </EditSection>

                            {renderBodyEditor(item)}

                            {canEditHashtags ? (
                              <EditSection label="HASHTAGS">
                                <Box
                                  sx={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: "6px",
                                    marginBottom: "8px",
                                  }}
                                >
                                  {(item.hashtags || []).map((tag) => (
                                    <Box
                                      key={tag}
                                      sx={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "4px",
                                        padding: "4px 10px",
                                        borderRadius: "100px",
                                        bgcolor: "primary.50",
                                        border: "1px solid",
                                        borderColor: "primary.100",
                                        fontSize: "12px",
                                        fontWeight: 500,
                                        color: "primary.700",
                                      }}
                                    >
                                      #{tag.replace("#", "")}
                                      <Box
                                        component="span"
                                        onClick={() => handleRemoveHashtag(tag)}
                                        sx={{
                                          cursor: "pointer",
                                          display: "flex",
                                          alignItems: "center",
                                          color: "primary.400",
                                          "&:hover": { color: "primary.700" },
                                          marginLeft: "2px",
                                        }}
                                      >
                                        <CloseRounded
                                          style={{ fontSize: 13 }}
                                        />
                                      </Box>
                                    </Box>
                                  ))}
                                </Box>
                                <Input
                                  placeholder="Add hashtag"
                                  value={hashtagInput}
                                  onChange={(event) =>
                                    setHashtagInput(event.target.value)
                                  }
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      handleAddHashtag();
                                    }
                                  }}
                                  variant="plain"
                                  size="sm"
                                  startDecorator={
                                    <Typography
                                      sx={{
                                        color: "neutral.400",
                                        fontSize: "13px",
                                      }}
                                    >
                                      #
                                    </Typography>
                                  }
                                  sx={{
                                    fontSize: "12px",
                                    borderRadius: "8px",
                                    bgcolor: "neutral.50",
                                    "--Input-focusedHighlight":
                                      "var(--joy-palette-primary-200)",
                                    maxWidth: "180px",
                                  }}
                                />
                              </EditSection>
                            ) : null}

                            <EditSection label="CTA SUGGESTIONS">
                              <Box
                                sx={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: "6px",
                                }}
                              >
                                {ctaSuggestions.map((cta) => {
                                  const selected = item._selectedCta === cta;

                                  return (
                                    <Box
                                      key={cta}
                                      onClick={() => handleSelectCta(cta)}
                                      sx={{
                                        padding: "6px 14px",
                                        borderRadius: "8px",
                                        border: "1px solid",
                                        borderColor: selected
                                          ? "primary.300"
                                          : "neutral.200",
                                        bgcolor: selected
                                          ? "primary.50"
                                          : "background.surface",
                                        fontSize: "12px",
                                        fontWeight: 500,
                                        color: selected
                                          ? "primary.700"
                                          : "neutral.600",
                                        cursor: "pointer",
                                        transition: "all 0.15s ease",
                                        "&:hover": {
                                          borderColor: "primary.300",
                                          bgcolor: "primary.50",
                                          color: "primary.700",
                                        },
                                      }}
                                    >
                                      {cta}
                                    </Box>
                                  );
                                })}
                              </Box>
                            </EditSection>

                            <EditSection label="FEATURED IMAGE">
                              {renderFeaturedImageArea(index, item)}
                            </EditSection>
                          </Box>
                        </Box>
                      </TabPanel>
                    );
                  })}
                </Box>

                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 28px",
                    borderTop: "1px solid",
                    borderColor: "neutral.100",
                    flexShrink: 0,
                  }}
                >
                  <Box
                    sx={{ display: "flex", alignItems: "center", gap: "12px" }}
                  >
                    <Typography sx={{ fontSize: "12px", color: "neutral.500" }}>
                      {approvedCount} of {draftItems.length} approved
                    </Typography>
                  </Box>

                  <Box sx={{ display: "flex", gap: "8px" }}>
                    <Button
                      variant="outlined"
                      color="neutral"
                      size="sm"
                      onClick={handleApproveAll}
                      disabled={
                        draftItems.length === 0 ||
                        draftItems.every((draftItem) => draftItem._approved)
                      }
                      startDecorator={
                        <CheckCircleRounded style={{ fontSize: 16 }} />
                      }
                      sx={{
                        borderRadius: "8px",
                        fontSize: "13px",
                        fontWeight: 600,
                      }}
                    >
                      Approve all
                    </Button>
                    <Button
                      variant="outlined"
                      color="neutral"
                      size="sm"
                      onClick={() => void persistDraftChanges()}
                      disabled={!hasUnsavedChanges || update.isPending}
                      sx={{
                        borderRadius: "8px",
                        fontSize: "13px",
                        fontWeight: 600,
                      }}
                    >
                      Save changes
                    </Button>
                    <Button
                      color="primary"
                      size="sm"
                      onClick={() => void handlePublish()}
                      disabled={approvedSocialCount === 0 || update.isPending}
                      startDecorator={<SendRounded style={{ fontSize: 16 }} />}
                      sx={{
                        borderRadius: "8px",
                        fontSize: "13px",
                        fontWeight: 600,
                      }}
                    >
                      Publish approved
                    </Button>
                  </Box>
                </Box>
              </Tabs>
            )}
          </Box>
        </ModalDialog>
      </Modal>

      <Modal
        open={confirmCloseOpen}
        onClose={() => !update.isPending && setConfirmCloseOpen(false)}
      >
        <ModalDialog
          aria-modal="true"
          variant="outlined"
          sx={{ maxWidth: 420 }}
        >
          <Stack spacing={2}>
            <Typography level="h4">Save changes before closing?</Typography>
            <Typography level="body-sm" color="neutral">
              You have unsaved edits in this content studio. Save them, discard
              them, or go back to keep editing.
            </Typography>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                variant="plain"
                color="neutral"
                onClick={() => setConfirmCloseOpen(false)}
                disabled={update.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="soft"
                color="danger"
                onClick={finalizeClose}
                disabled={update.isPending}
              >
                Discard
              </Button>
              <Button
                variant="solid"
                color="primary"
                startDecorator={
                  update.isPending ? (
                    <CircularProgress size="sm" color="neutral" />
                  ) : undefined
                }
                onClick={() => void persistDraftChanges({ closeAfter: true })}
                disabled={update.isPending}
              >
                Save
              </Button>
            </Stack>
          </Stack>
        </ModalDialog>
      </Modal>

      <Snackbar
        open={snackbarState.open}
        autoHideDuration={2000}
        color={snackbarState.color}
        variant="soft"
        onClose={() => setSnackbarState((prev) => ({ ...prev, open: false }))}
      >
        {snackbarState.message}
      </Snackbar>
    </>
  );
}
