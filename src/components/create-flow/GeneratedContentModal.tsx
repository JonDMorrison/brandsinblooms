import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  FormLabel,
  IconButton,
  Input,
  LinearProgress,
  Modal,
  ModalDialog,
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
import ChipDelete from "@mui/joy/ChipDelete";
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
  CheckCircle2,
  FileText,
  Hash,
  Image as ImageIcon,
  Images,
  Megaphone,
  Newspaper,
  Send,
  Sparkles,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { EditableNewsletterPreview } from "./EditableNewsletterPreview";
import { MediaSelector } from "@/components/image/MediaSelector";
import { sanitizeWeekNumbers } from "@/utils/weekNumberSanitizer";
import { sanitizeHtml } from "@/utils/htmlSanitizer";
import { supabase } from "@/integrations/supabase/client";
import { AIImageLoadingCard } from "@/components/image/AIImageLoadingCard";

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
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

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

  const sourceItems = useMemo(
    () => (query.data?.content.items || []).map(normalizeDraftItem),
    [query.data?.content.items],
  );

  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [dirty, setDirty] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState(0);
  const [hashtagInput, setHashtagInput] = useState("");
  const [mediaSelectorOpen, setMediaSelectorOpen] = useState(false);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [imageGenerationIndex, setImageGenerationIndex] = useState<
    number | null
  >(null);
  const [imageGenerationProgress, setImageGenerationProgress] = useState({
    completed: 0,
    total: 0,
  });
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

  const bundleSubtitle = useMemo(() => {
    const mode = query.data?.content.meta?.mode || "custom";
    return `${MODE_LABELS[mode]} · ${formatRelativeTime(query.data?.created_at)}`;
  }, [query.data?.content.meta?.mode, query.data?.created_at]);

  const activeItem = draftItems[activeTab] || null;
  const activeChannel = activeItem
    ? normalizeChannel(activeItem.channel)
    : "newsletter";
  const activeConfig = CHANNEL_CONFIG[activeChannel];
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
      next[index] = { ...(next[index] || {}), ...patch };
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
    setMediaSelectorOpen(false);
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
      } catch (error: any) {
        showSnackbar(error?.message || "Failed to save changes", "danger");
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

  const handleGenerateImage = useCallback(async () => {
    if (!activeItem) {
      return;
    }

    setImageGenerationIndex(activeTab);
    setImageGenerationProgress({ completed: 0, total: 1 });

    try {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!currentUser) {
        throw new Error("User not authenticated");
      }

      const contentContext =
        activeItem.imageQuery ||
        activeItem.body ||
        activeItem.caption ||
        activeItem.script ||
        activeItem.title ||
        "seasonal garden content";

      const { data, error } = await supabase.functions.invoke(
        "generate-ai-image",
        {
          body: {
            contentContext,
            contentTitle: activeItem.title || "",
            channel: normalizeChannel(activeItem.channel),
            uploadToStorage: true,
            storageBucket: "global-ai-images",
            userId: currentUser.id,
          },
        },
      );

      if (error || !data?.imageUrl) {
        throw error || new Error("Image generation failed");
      }

      editItem(activeTab, {
        media: {
          url: data.imageUrl,
          alt: activeItem.title || "AI-generated image",
          source: "ai_generated",
          globalImageId: data.globalImageId,
          tags: data.metadata?.tags || [],
        },
      });
      setImageGenerationProgress({ completed: 1, total: 1 });
      showSnackbar("New image generated", "success");
    } catch (error: any) {
      showSnackbar(error?.message || "Image generation failed", "danger");
    } finally {
      setImageGenerationIndex(null);
      setImageGenerationProgress({ completed: 0, total: 0 });
    }
  }, [activeItem, activeTab, editItem, showSnackbar]);

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

  const renderSocialPreview = (item: DraftItem) => {
    const previewText = sanitizeWeekNumbers(getPrimaryText(item));
    const hashtags = (item.hashtags || []).join(" ");

    return (
      <Card
        variant="outlined"
        sx={{
          borderRadius: "28px",
          borderColor: "neutral.200",
          overflow: "hidden",
          boxShadow: "sm",
        }}
      >
        <Stack spacing={0}>
          <Sheet sx={{ px: 2.5, py: 2, bgcolor: "background.level1" }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Sheet
                variant="soft"
                color="primary"
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 700,
                }}
              >
                {bundleTitle.slice(0, 1).toUpperCase()}
              </Sheet>
              <Stack spacing={0.25}>
                <Typography level="title-sm">{bundleTitle}</Typography>
                <Typography level="body-xs" color="neutral">
                  {activeConfig.previewLabel}
                </Typography>
              </Stack>
            </Stack>
          </Sheet>

          {item.media?.url ? (
            <Box
              component="img"
              src={item.media.url}
              alt={item.media.alt || item.title || activeConfig.label}
              sx={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover" }}
            />
          ) : (
            <Sheet
              variant="soft"
              color="neutral"
              sx={{
                aspectRatio: "16 / 9",
                display: "grid",
                placeItems: "center",
                color: "neutral.500",
              }}
            >
              <Stack spacing={1} alignItems="center">
                <ImageIcon size={26} />
                <Typography level="body-sm">No image selected yet</Typography>
              </Stack>
            </Sheet>
          )}

          <Stack spacing={1.25} sx={{ p: 2.5 }}>
            <Typography level="title-md">
              {item.title || `${activeConfig.label} draft`}
            </Typography>
            <Typography sx={{ whiteSpace: "pre-wrap", lineHeight: 1.65 }}>
              {previewText ||
                "Write the social copy in the editor to see it here."}
            </Typography>
            {hashtags ? (
              <Typography
                level="body-sm"
                sx={{ color: "primary.500", whiteSpace: "pre-wrap" }}
              >
                {hashtags}
              </Typography>
            ) : null}
          </Stack>
        </Stack>
      </Card>
    );
  };

  const renderBlogPreview = (item: DraftItem) => (
    <Card
      variant="outlined"
      sx={{
        borderRadius: "28px",
        borderColor: "neutral.200",
        overflow: "hidden",
        boxShadow: "sm",
      }}
    >
      {item.media?.url ? (
        <Box
          component="img"
          src={item.media.url}
          alt={item.media.alt || item.title || "Blog cover image"}
          sx={{ width: "100%", aspectRatio: "16 / 8", objectFit: "cover" }}
        />
      ) : null}
      <Stack spacing={2} sx={{ p: { xs: 2.5, md: 3 } }}>
        <Stack spacing={0.75}>
          <Typography level="h2">{item.title || "Untitled article"}</Typography>
          <Typography level="body-sm" color="neutral">
            {activeConfig.previewLabel}
          </Typography>
        </Stack>
        <Divider />
        <Box
          sx={{
            "& h1": { fontSize: "1.75rem", mb: 2 },
            "& h2": { fontSize: "1.45rem", mt: 3, mb: 1.5 },
            "& h3": { fontSize: "1.2rem", mt: 2.5, mb: 1 },
            "& p": { mb: 1.5, lineHeight: 1.8 },
            "& ul, & ol": { pl: 3, mb: 1.5 },
            "& li": { mb: 0.5 },
          }}
          dangerouslySetInnerHTML={{ __html: getBlogPreviewHtml(item) }}
        />
      </Stack>
    </Card>
  );

  const renderNewsletterPreview = (item: DraftItem) => (
    <Sheet
      variant="outlined"
      sx={{
        borderRadius: "28px",
        borderColor: "neutral.200",
        p: { xs: 1, md: 1.5 },
        bgcolor: "background.level1",
      }}
    >
      <EditableNewsletterPreview
        content={sanitizeWeekNumbers(item.body || "")}
        title={item.title || bundleTitle}
        onChange={(content) => editItem(activeTab, { body: content })}
        className="border-none shadow-none bg-transparent"
      />
    </Sheet>
  );

  const renderVideoPreview = (item: DraftItem) => (
    <Card
      variant="outlined"
      sx={{
        borderRadius: "28px",
        borderColor: "neutral.200",
        overflow: "hidden",
        boxShadow: "sm",
      }}
    >
      {item.media?.url ? (
        <Box
          component="img"
          src={item.media.url}
          alt={item.media.alt || item.title || "Video thumbnail"}
          sx={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover" }}
        />
      ) : null}
      <Stack spacing={1.5} sx={{ p: 2.5 }}>
        <Typography level="title-lg">
          {item.title || "Video concept"}
        </Typography>
        <Typography level="body-sm" color="neutral">
          {activeConfig.previewLabel}
        </Typography>
        <Sheet
          variant="soft"
          color="neutral"
          sx={{
            borderRadius: "20px",
            p: 2,
            whiteSpace: "pre-wrap",
            lineHeight: 1.7,
          }}
        >
          {sanitizeWeekNumbers(
            item.script || item.body || "No script drafted yet.",
          )}
        </Sheet>
      </Stack>
    </Card>
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
    const value = getPrimaryText(item);

    if (channel === "instagram" || channel === "facebook") {
      const limit = activeConfig.charLimit || 0;
      const overLimit = limit > 0 && value.length > limit;

      return (
        <FormControl>
          <FormLabel>{activeConfig.bodyLabel}</FormLabel>
          <Textarea
            minRows={10}
            maxRows={18}
            value={value}
            onChange={(event) =>
              handleTextChange(activeTab, event.target.value)
            }
            placeholder={`Write the ${activeConfig.bodyLabel.toLowerCase()} here...`}
          />
          <Stack direction="row" justifyContent="space-between" sx={{ mt: 1 }}>
            <Typography level="body-xs" color="neutral">
              Keep the lead line punchy and the CTA clear.
            </Typography>
            <Typography
              level="body-xs"
              color={overLimit ? "danger" : "neutral"}
            >
              {value.length} / {limit} chars
            </Typography>
          </Stack>
        </FormControl>
      );
    }

    if (channel === "blog") {
      return (
        <FormControl>
          <FormLabel>{activeConfig.bodyLabel}</FormLabel>
          <Sheet
            variant="outlined"
            sx={{
              borderRadius: "18px",
              overflow: "hidden",
              bgcolor: "background.body",
            }}
          >
            <RichTextEditor
              content={item.body || item.markdown || ""}
              onChange={(html) => editItem(activeTab, { body: html })}
              placeholder="Write and format the article body..."
              className="border-0"
            />
          </Sheet>
        </FormControl>
      );
    }

    if (channel === "video") {
      return (
        <FormControl>
          <FormLabel>{activeConfig.bodyLabel}</FormLabel>
          <Textarea
            minRows={12}
            maxRows={18}
            value={value}
            onChange={(event) =>
              handleTextChange(activeTab, event.target.value)
            }
            placeholder="Shape the video script here..."
          />
        </FormControl>
      );
    }

    return (
      <Sheet
        variant="soft"
        color="neutral"
        sx={{ borderRadius: "20px", p: 2.25 }}
      >
        <Typography level="title-sm">
          Newsletter body editing lives in the preview pane
        </Typography>
        <Typography level="body-sm" color="neutral" sx={{ mt: 0.5 }}>
          Use the newsletter preview’s edit mode to update the body while
          keeping the block-style structure in view.
        </Typography>
      </Sheet>
    );
  };

  return (
    <>
      <Modal open={open} onClose={handleRequestClose}>
        <ModalDialog
          layout="fullscreen"
          aria-modal="true"
          sx={{ p: 0, bgcolor: "background.surface" }}
        >
          <Sheet
            sx={{
              display: "flex",
              flexDirection: "column",
              height: "100%",
              backgroundColor: "background.surface",
            }}
          >
            <Sheet
              sx={{
                px: { xs: 2, md: 3 },
                pt: 2.5,
                pb: 2,
                borderBottom: "1px solid",
                borderColor: "divider",
                backgroundColor: "background.surface",
              }}
            >
              <Stack spacing={2}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="flex-start"
                >
                  <Stack spacing={0.75} sx={{ pr: 2 }}>
                    <Typography level="h2">{bundleTitle}</Typography>
                    <Typography level="body-sm" color="neutral">
                      {bundleSubtitle}
                    </Typography>
                  </Stack>
                  <IconButton
                    variant="plain"
                    color="neutral"
                    aria-label="Close generated content review"
                    onClick={handleRequestClose}
                  >
                    <X size={18} />
                  </IconButton>
                </Stack>

                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Chip size="sm" variant="soft" color="primary">
                    {`${draftItems.length} channels`}
                  </Chip>
                  <Chip
                    size="sm"
                    variant="soft"
                    color={approvedCount > 0 ? "success" : "neutral"}
                  >
                    {`${approvedCount} approved`}
                  </Chip>
                  <Chip
                    size="sm"
                    variant="soft"
                    color={approvedSocialCount > 0 ? "success" : "neutral"}
                  >
                    {`${approvedSocialCount} social ready`}
                  </Chip>
                  {dirtyCount > 0 ? (
                    <Chip size="sm" variant="soft" color="warning">
                      {`${dirtyCount} unsaved`}
                    </Chip>
                  ) : null}
                </Stack>

                {update.isPending ? <LinearProgress thickness={3} /> : null}
              </Stack>
            </Sheet>

            <Sheet sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
              {query.isLoading ? (
                <Stack
                  spacing={2.5}
                  role="status"
                  aria-live="polite"
                  sx={{ height: "100%", px: { xs: 2, md: 3 }, py: 2.5 }}
                >
                  <Skeleton variant="text" sx={{ width: 220, height: 36 }} />
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Skeleton
                      variant="rectangular"
                      sx={{ width: 92, height: 28, borderRadius: "999px" }}
                    />
                    <Skeleton
                      variant="rectangular"
                      sx={{ width: 104, height: 28, borderRadius: "999px" }}
                    />
                    <Skeleton
                      variant="rectangular"
                      sx={{ width: 116, height: 28, borderRadius: "999px" }}
                    />
                  </Stack>
                  <Box
                    sx={{
                      display: "grid",
                      gap: 2.5,
                      width: "100%",
                      gridTemplateColumns: {
                        xs: "1fr",
                        xl: "minmax(0, 1.15fr) minmax(340px, 0.85fr)",
                      },
                      alignItems: "start",
                    }}
                  >
                    <Card
                      variant="outlined"
                      sx={{ borderRadius: "24px", p: 2.5 }}
                    >
                      <Stack spacing={2}>
                        <Skeleton
                          variant="text"
                          sx={{ width: "34%", height: 28 }}
                        />
                        <Skeleton
                          variant="rectangular"
                          sx={{
                            width: "100%",
                            height: 320,
                            borderRadius: "24px",
                          }}
                        />
                        <Skeleton
                          variant="text"
                          sx={{ width: "86%", height: 18 }}
                        />
                        <Skeleton
                          variant="text"
                          sx={{ width: "72%", height: 18 }}
                        />
                      </Stack>
                    </Card>
                    <Card
                      variant="outlined"
                      sx={{ borderRadius: "24px", p: 2.5 }}
                    >
                      <Stack spacing={2}>
                        <Skeleton
                          variant="text"
                          sx={{ width: "28%", height: 24 }}
                        />
                        <Skeleton
                          variant="rectangular"
                          sx={{
                            width: "100%",
                            height: 44,
                            borderRadius: "14px",
                          }}
                        />
                        <Skeleton
                          variant="text"
                          sx={{ width: "32%", height: 24 }}
                        />
                        <Skeleton
                          variant="rectangular"
                          sx={{
                            width: "100%",
                            height: 200,
                            borderRadius: "18px",
                          }}
                        />
                        <Skeleton
                          variant="rectangular"
                          sx={{
                            width: "100%",
                            height: 240,
                            borderRadius: "22px",
                          }}
                        />
                      </Stack>
                    </Card>
                  </Box>
                  <Typography level="body-sm" color="neutral">
                    Loading generated content...
                  </Typography>
                </Stack>
              ) : draftItems.length === 0 ? (
                <Stack
                  spacing={1.5}
                  alignItems="center"
                  justifyContent="center"
                  sx={{ height: "100%", px: 3 }}
                >
                  <Typography level="h3">No generated content yet</Typography>
                  <Typography level="body-sm" color="neutral">
                    Generate a bundle first, then come back here to review,
                    edit, and approve it.
                  </Typography>
                </Stack>
              ) : (
                <Tabs
                  value={String(activeTab)}
                  onChange={(_, value) => {
                    if (value !== null) {
                      setActiveTab(Number(value));
                    }
                  }}
                  sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <Sheet
                    sx={{
                      px: { xs: 2, md: 3 },
                      py: 1.5,
                      borderBottom: "1px solid",
                      borderColor: "divider",
                      backgroundColor: "background.surface",
                    }}
                  >
                    <TabList
                      aria-label="Generated content channels"
                      sx={{ overflow: "auto", gap: 1, py: 0.5 }}
                    >
                      {draftItems.map((item, index) => {
                        const config =
                          CHANNEL_CONFIG[normalizeChannel(item.channel)];
                        const Icon = config.icon;
                        const tabId = `generated-content-tab-${index}`;
                        const panelId = `generated-content-panel-${index}`;

                        return (
                          <Tab
                            key={`${item.channel}-${index}`}
                            id={tabId}
                            aria-controls={panelId}
                            value={String(index)}
                            variant="outlined"
                            color={item._approved ? "success" : "neutral"}
                            sx={{
                              flex: "0 0 auto",
                              borderRadius: "999px",
                              minHeight: 44,
                              px: 1.5,
                            }}
                          >
                            <Stack
                              direction="row"
                              spacing={1}
                              alignItems="center"
                            >
                              <Icon size={15} />
                              <span>{config.label}</span>
                              {item._approved ? (
                                <Box
                                  sx={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    bgcolor: "success.500",
                                  }}
                                />
                              ) : null}
                            </Stack>
                          </Tab>
                        );
                      })}
                    </TabList>
                  </Sheet>

                  <Sheet
                    sx={{
                      flex: 1,
                      minHeight: 0,
                      overflow: "auto",
                      px: { xs: 2, md: 3 },
                      py: 2.5,
                    }}
                  >
                    {draftItems.map((item, index) => {
                      const config =
                        CHANNEL_CONFIG[normalizeChannel(item.channel)];
                      const ctaSuggestions = uniqueStrings([
                        ...(item.ctaSuggestions || []),
                        ...config.ctaFallbacks,
                      ]);

                      return (
                        <TabPanel
                          key={`${item.channel}-panel-${index}`}
                          id={`generated-content-panel-${index}`}
                          aria-labelledby={`generated-content-tab-${index}`}
                          value={String(index)}
                          sx={{ p: 0 }}
                        >
                          <Stack spacing={2.5}>
                            <Stack
                              direction={{ xs: "column", md: "row" }}
                              justifyContent="space-between"
                              spacing={1.5}
                            >
                              <Stack spacing={0.5}>
                                <Typography level="h3">
                                  {config.label}
                                </Typography>
                                <Typography level="body-sm" color="neutral">
                                  {config.description}
                                </Typography>
                              </Stack>
                              <Stack
                                direction="row"
                                spacing={1}
                                useFlexGap
                                flexWrap="wrap"
                                alignItems="center"
                              >
                                {dirty.has(index) ? (
                                  <Chip
                                    size="sm"
                                    variant="soft"
                                    color="warning"
                                  >
                                    Unsaved changes
                                  </Chip>
                                ) : null}
                                <Chip
                                  size="sm"
                                  variant="soft"
                                  color={item._approved ? "success" : "neutral"}
                                >
                                  {item._approved
                                    ? "Approved"
                                    : "Needs approval"}
                                </Chip>
                                <Button
                                  size="sm"
                                  variant={item._approved ? "soft" : "solid"}
                                  color={item._approved ? "success" : "primary"}
                                  startDecorator={<CheckCircle2 size={16} />}
                                  onClick={() => handleApproveToggle(index)}
                                >
                                  {item._approved ? "Approved" : "Approve item"}
                                </Button>
                              </Stack>
                            </Stack>

                            <Box
                              sx={{
                                display: "grid",
                                gap: 2.5,
                                gridTemplateColumns: {
                                  xs: "1fr",
                                  xl: "minmax(0, 1.15fr) minmax(340px, 0.85fr)",
                                },
                                alignItems: "start",
                              }}
                            >
                              <Stack spacing={2}>{renderPreview(item)}</Stack>

                              <Stack spacing={2}>
                                <FormControl>
                                  <FormLabel>Title</FormLabel>
                                  <Input
                                    value={item.title || ""}
                                    onChange={(event) =>
                                      editItem(index, {
                                        title: event.target.value,
                                      })
                                    }
                                    placeholder="Add a title for this draft"
                                  />
                                </FormControl>

                                {renderBodyEditor(item)}

                                {normalizeChannel(item.channel) ===
                                  "instagram" ||
                                normalizeChannel(item.channel) === "facebook" ||
                                (item.hashtags || []).length > 0 ? (
                                  <FormControl>
                                    <FormLabel>Hashtags</FormLabel>
                                    <Stack
                                      direction="row"
                                      spacing={1}
                                      useFlexGap
                                      flexWrap="wrap"
                                      sx={{ mb: 1.25 }}
                                    >
                                      {(item.hashtags || []).map((hashtag) => (
                                        <Chip
                                          key={hashtag}
                                          variant="soft"
                                          color="primary"
                                          endDecorator={
                                            <ChipDelete
                                              onDelete={() =>
                                                handleRemoveHashtag(hashtag)
                                              }
                                            />
                                          }
                                        >
                                          {hashtag}
                                        </Chip>
                                      ))}
                                    </Stack>
                                    <Stack
                                      direction={{ xs: "column", sm: "row" }}
                                      spacing={1}
                                    >
                                      <Input
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
                                        startDecorator={<Hash size={14} />}
                                        placeholder="Add hashtag"
                                      />
                                      <Button
                                        variant="soft"
                                        onClick={handleAddHashtag}
                                      >
                                        Add hashtag
                                      </Button>
                                    </Stack>
                                  </FormControl>
                                ) : null}

                                <FormControl>
                                  <FormLabel>CTA suggestions</FormLabel>
                                  <Stack
                                    direction="row"
                                    spacing={1}
                                    useFlexGap
                                    flexWrap="wrap"
                                  >
                                    {ctaSuggestions.map((cta) => (
                                      <Chip
                                        key={cta}
                                        variant={
                                          item._selectedCta === cta
                                            ? "solid"
                                            : "soft"
                                        }
                                        color={
                                          item._selectedCta === cta
                                            ? "primary"
                                            : "neutral"
                                        }
                                        onClick={() => handleSelectCta(cta)}
                                        sx={{ cursor: "pointer" }}
                                      >
                                        {cta}
                                      </Chip>
                                    ))}
                                  </Stack>
                                  <Typography
                                    level="body-xs"
                                    color="neutral"
                                    sx={{ mt: 1 }}
                                  >
                                    Selecting a CTA appends it to the draft so
                                    it is preserved in the next save.
                                  </Typography>
                                </FormControl>

                                <Card
                                  variant="outlined"
                                  sx={{ borderRadius: "22px", p: 2 }}
                                >
                                  <Stack spacing={1.5}>
                                    <Stack
                                      direction="row"
                                      justifyContent="space-between"
                                      alignItems="center"
                                    >
                                      <Typography level="title-sm">
                                        Featured image
                                      </Typography>
                                      {item.media?.source === "ai_generated" ? (
                                        <Chip
                                          size="sm"
                                          variant="soft"
                                          color="success"
                                        >
                                          AI generated
                                        </Chip>
                                      ) : null}
                                    </Stack>

                                    {item.media?.url ? (
                                      <Box
                                        component="img"
                                        src={item.media.url}
                                        alt={
                                          item.media.alt ||
                                          item.title ||
                                          "Selected content image"
                                        }
                                        sx={{
                                          width: "100%",
                                          aspectRatio: "16 / 9",
                                          objectFit: "cover",
                                          borderRadius: "18px",
                                        }}
                                      />
                                    ) : (
                                      <Sheet
                                        variant="soft"
                                        color="neutral"
                                        sx={{
                                          aspectRatio: "16 / 9",
                                          borderRadius: "18px",
                                          display: "grid",
                                          placeItems: "center",
                                        }}
                                      >
                                        <Stack spacing={1} alignItems="center">
                                          <ImageIcon size={22} />
                                          <Typography level="body-sm">
                                            No image selected yet
                                          </Typography>
                                        </Stack>
                                      </Sheet>
                                    )}

                                    <Stack
                                      direction={{ xs: "column", sm: "row" }}
                                      spacing={1}
                                      useFlexGap
                                    >
                                      <Button
                                        variant="solid"
                                        startDecorator={
                                          imageGenerationIndex === index ? (
                                            <CircularProgress
                                              size="sm"
                                              color="neutral"
                                            />
                                          ) : (
                                            <Sparkles size={16} />
                                          )
                                        }
                                        onClick={() =>
                                          void handleGenerateImage()
                                        }
                                        disabled={imageGenerationIndex !== null}
                                      >
                                        Generate new image
                                      </Button>
                                      <Button
                                        variant="soft"
                                        startDecorator={<Images size={16} />}
                                        onClick={() =>
                                          setMediaSelectorOpen(true)
                                        }
                                      >
                                        Choose from library
                                      </Button>
                                      <Button
                                        variant="plain"
                                        color="danger"
                                        startDecorator={<Trash2 size={16} />}
                                        onClick={() =>
                                          editItem(index, { media: null })
                                        }
                                        disabled={!item.media?.url}
                                      >
                                        Remove
                                      </Button>
                                    </Stack>
                                  </Stack>
                                </Card>
                              </Stack>
                            </Box>
                          </Stack>
                        </TabPanel>
                      );
                    })}
                  </Sheet>
                </Tabs>
              )}
            </Sheet>

            <Sheet
              sx={{
                px: { xs: 2, md: 3 },
                py: 2,
                borderTop: "1px solid",
                borderColor: "divider",
                backgroundColor: "background.surface",
              }}
            >
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1.5}
                justifyContent="space-between"
                alignItems={{ md: "center" }}
              >
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Chip
                    size="sm"
                    variant="soft"
                    color={approvedCount > 0 ? "success" : "neutral"}
                  >
                    {`${approvedCount} approved`}
                  </Chip>
                  <Chip
                    size="sm"
                    variant="soft"
                    color={approvedSocialCount > 0 ? "success" : "neutral"}
                  >
                    {`${approvedSocialCount} social ready`}
                  </Chip>
                  {dirtyCount > 0 ? (
                    <Chip size="sm" variant="soft" color="warning">
                      {`${dirtyCount} unsaved`}
                    </Chip>
                  ) : null}
                </Stack>

                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  useFlexGap
                >
                  <Button
                    variant="soft"
                    color="success"
                    startDecorator={<CheckCircle2 size={16} />}
                    onClick={handleApproveAll}
                    disabled={
                      draftItems.length === 0 ||
                      draftItems.every((item) => item._approved)
                    }
                  >
                    Approve all
                  </Button>
                  <Button
                    variant="solid"
                    color="primary"
                    startDecorator={
                      update.isPending ? (
                        <CircularProgress size="sm" color="neutral" />
                      ) : undefined
                    }
                    onClick={() => void persistDraftChanges()}
                    disabled={!hasUnsavedChanges || update.isPending}
                  >
                    Save changes
                  </Button>
                  <Button
                    variant="solid"
                    color="success"
                    startDecorator={<Send size={16} />}
                    onClick={() => void handlePublish()}
                    disabled={approvedSocialCount === 0 || update.isPending}
                  >
                    Publish approved social
                  </Button>
                </Stack>
              </Stack>
            </Sheet>
          </Sheet>
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
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              justifyContent="flex-end"
            >
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

      <Modal
        open={mediaSelectorOpen}
        onClose={() => setMediaSelectorOpen(false)}
      >
        <ModalDialog
          aria-modal="true"
          sx={{
            width: "min(96vw, 980px)",
            maxWidth: "100%",
            p: 0,
            overflow: "hidden",
          }}
        >
          <Sheet
            sx={{ p: 2.5, borderBottom: "1px solid", borderColor: "divider" }}
          >
            <Stack
              direction="row"
              justifyContent="space-between"
              spacing={2}
              alignItems="flex-start"
            >
              <Stack spacing={0.5}>
                <Typography level="h4">Choose from library</Typography>
                <Typography level="body-sm" color="neutral">
                  Browse suggestions and select the image that fits this draft
                  best.
                </Typography>
              </Stack>
              <IconButton
                variant="plain"
                color="neutral"
                aria-label="Close image library"
                onClick={() => setMediaSelectorOpen(false)}
              >
                <X size={18} />
              </IconButton>
            </Stack>
          </Sheet>
          <Sheet sx={{ p: 2.5, maxHeight: "75vh", overflow: "auto" }}>
            {activeItem ? (
              <MediaSelector
                selectedImageUrl={activeItem.media?.url}
                contentContext={activeItem.title || getPrimaryText(activeItem)}
                onImageSelect={(imageUrl: string, metadata?: any) => {
                  editItem(activeTab, {
                    media: {
                      url: imageUrl,
                      alt:
                        metadata?.alt_text ||
                        activeItem.media?.alt ||
                        activeItem.title ||
                        "Selected content image",
                      source: metadata?.source || "library",
                    },
                  });
                }}
              />
            ) : null}
          </Sheet>
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

      {imageGenerationIndex !== null ? (
        <Box
          sx={{
            position: "fixed",
            inset: 0,
            zIndex: 1600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(6px)",
            backgroundColor: "rgba(15, 23, 42, 0.2)",
          }}
        >
          <AIImageLoadingCard
            progress={
              imageGenerationProgress.total > 0
                ? imageGenerationProgress
                : undefined
            }
            message="Generating image"
            subtitle="This may take 8-12 seconds"
          />
        </Box>
      ) : null}
    </>
  );
}
