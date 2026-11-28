import ImageUrlField from "../newsletter/ImageUrlField";
import * as React from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import CircularProgress from "@mui/joy/CircularProgress";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import LinearProgress from "@mui/joy/LinearProgress";
import Link from "@mui/joy/Link";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Tab from "@mui/joy/Tab";
import TabList from "@mui/joy/TabList";
import Tabs from "@mui/joy/Tabs";
import useMediaQuery from "@mui/material/useMediaQuery";
import {
  ArrowUp,
  Camera,
  Check,
  Images,
  Leaf,
  Link2,
  Repeat2,
  Search,
  ShoppingBag,
  Sparkles,
  Trash2,
  UploadCloud,
  Zap,
} from "lucide-react";
import type {
  CampaignImageFieldSourceRecord,
  CampaignImageGalleryItem,
  CampaignImageGallerySource,
  CampaignImageIndicatorSource,
} from "@/components/crm/studio/useStudioState";
import type {
  AIImageStudioAspectRatio,
  AIImageStudioCampaignContext,
  AIImageStudioSelectionMetadata,
} from "@/components/crm/ai-image-studio/types";
import { useAIImageGeneration } from "@/hooks/useAIImageGeneration";
import { useAIImageStudio } from "@/hooks/useAIImageStudio";
import { supabase } from "@/integrations/supabase/client";
import { useWebsiteProductImages } from "@/hooks/useWebsiteProductImages";
import { catalogNoMatchesMessage } from "@/lib/connectedContent";

const CAMPAIGN_IMAGE_BUCKET = "campaign-images";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const PUBLIC_COMPATIBLE_BUCKETS = new Set([
  "campaign-images",
  "content-assets",
  "global-ai-images",
]);

export type StudioImageAIAspectRatioHint = "landscape" | "portrait" | "square";

export type StudioImageAIRequest = {
  aiAspectRatioHint?: StudioImageAIAspectRatioHint;
  assignmentLabel?: string;
  blockContext?: string;
  blockId?: string;
  campaignContext?: AIImageStudioCampaignContext;
  contextType?: string;
  multiBlockFlow?: StudioImageAIMultiBlockFlow;
  onSelect?: (
    url: string,
    metadata?: AIImageStudioSelectionMetadata,
  ) => void | Promise<void>;
};

/**
 * Studio-side continuation flow: each step yields the next Studio request,
 * which the Studio page translates into an AI Image Studio target.
 */
export type StudioImageAIMultiBlockFlow = {
  advanceToNextTarget: () => StudioImageAIRequest | null;
  hasNextTarget: () => boolean;
};

export type StudioImageApplyEvent = {
  blockLabel?: string;
  gallerySource: CampaignImageGallerySource;
  prompt?: string;
  source: CampaignImageIndicatorSource;
  timestamp: number;
  url: string;
};

type StudioImageUploadProps = {
  aiAspectRatioHint?: StudioImageAIAspectRatioHint;
  blockContext?: string;
  blockId?: string;
  campaignContext?: AIImageStudioCampaignContext;
  campaignImages?: CampaignImageGalleryItem[];
  compact?: boolean;
  contextType?: string;
  defaultFilled?: boolean;
  emptyText?: string;
  height?: number | string;
  /** Caps the filled preview (e.g. 120 for logos) and shows the whole image. */
  maxPreviewHeight?: number;
  imageSourceRecord?: CampaignImageFieldSourceRecord | null;
  label: string;
  onApplyImage?: (event: StudioImageApplyEvent) => void;
  onChange?: (url: string) => void;
  onClearImage?: () => void;
  onRequestAIImage?: (request: StudioImageAIRequest) => void;
  /** Image block: show source tabs (My images, Products, This week's theme, Upload, Paste link). */
  sourceTabs?: boolean;
  value?: string;
};

type ImageSourceTab = "my-images" | "products" | "theme" | "upload" | "link";

const IMAGE_SOURCE_TABS: Array<{ value: ImageSourceTab; label: string }> = [
  { value: "my-images", label: "My images" },
  { value: "products", label: "Products" },
  { value: "theme", label: "This week's theme" },
  { value: "upload", label: "Upload" },
  { value: "link", label: "Paste link" },
];

function ProductImagePanel({ onPick }: { onPick: (url: string, altText: string) => void }) {
  const [search, setSearch] = React.useState("");
  const [query, setQuery] = React.useState("");
  React.useEffect(() => {
    const handle = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [search]);
  const products = useWebsiteProductImages(query, true);
  const productItems = products.data?.items ?? [];
  return (
    <Stack spacing={1} data-testid="image-source-products">
      <Input
        size="sm"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search your website products"
        startDecorator={<Search size={14} />}
        slotProps={{ input: { "aria-label": "Search products" } }}
      />
      {products.isLoading ? (
        <LinearProgress size="sm" />
      ) : products.isError ? (
        <Typography level="body-xs" sx={{ color: "danger.600" }}>
          {products.error instanceof Error ? products.error.message : "Could not load your website products."}
        </Typography>
      ) : productItems.length === 0 ? (
        <Typography level="body-xs" role="status" sx={{ color: "text.tertiary" }}>
          {catalogNoMatchesMessage({
            query,
            kindLabel: "product photos",
            siteNames: products.data?.siteNames ?? [],
          })}
        </Typography>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(76px, 1fr))",
            gap: 0.75,
            maxHeight: 260,
            overflowY: "auto",
          }}
        >
          {productItems.map((product) => (
            <Box
              key={product.id}
              component="button"
              type="button"
              title={product.title}
              aria-label={`Use photo of ${product.title}`}
              onClick={() => onPick(product.imageUrl, product.altText)}
              sx={{
                p: 0,
                border: "1px solid",
                borderColor: "neutral.200",
                borderRadius: "8px",
                overflow: "hidden",
                bgcolor: "background.surface",
                cursor: "pointer",
                textAlign: "left",
                "&:hover": { borderColor: "primary.400" },
                "&:focus-visible": { outline: "2px solid var(--joy-palette-primary-300)" },
              }}
            >
              <Box
                component="img"
                src={product.imageUrl}
                alt=""
                loading="lazy"
                sx={{ display: "block", width: "100%", aspectRatio: "1 / 1", objectFit: "cover" }}
              />
              <Typography level="body-xs" noWrap sx={{ px: 0.5, py: 0.25, fontSize: "11px" }}>
                {product.title}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Stack>
  );
}

type QuickGenerateState =
  | { mode: "collapsed" }
  | { mode: "error"; prompt: string }
  | { mode: "input" }
  | { mode: "loading"; prompt: string }
  | { mode: "preview"; prompt: string; url: string };

function resolveAIAspectRatio(
  hint?: StudioImageAIAspectRatioHint,
): AIImageStudioAspectRatio | undefined {
  switch (hint) {
    case "landscape":
      return "16:9";
    case "portrait":
      return "9:16";
    case "square":
      return "1:1";
    default:
      return undefined;
  }
}

function getPublicStorageBucket(imageUrl: string) {
  try {
    const url = new URL(imageUrl, window.location.origin);
    const marker = "/storage/v1/object/public/";
    const markerIndex = url.pathname.indexOf(marker);

    if (markerIndex < 0) {
      return null;
    }

    const storagePath = url.pathname.slice(markerIndex + marker.length);
    const [bucket] = storagePath.split("/");
    return bucket || null;
  } catch {
    return null;
  }
}

function getMimeTypeFromExtension(extension: string) {
  switch (extension.toLowerCase()) {
    case "gif":
      return "image/gif";
    case "jpeg":
    case "jpg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    default:
      return "image/png";
  }
}

function getSafeExtension(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();

  if (fromName && /^[a-z0-9]+$/.test(fromName)) {
    return fromName;
  }

  switch (file.type) {
    case "image/png":
      return "png";
    case "image/gif":
      return "gif";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}

function getSafeImageFileName(imageUrl: string, mimeType: string) {
  try {
    const url = new URL(imageUrl, window.location.origin);
    const pathName = url.pathname.split("/").pop() || "ai-image";
    const rawName = pathName.split("?")[0] || "ai-image";
    const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, "-");

    if (safeName.includes(".")) {
      return safeName;
    }

    const extension = getSafeExtension(
      new File(
        [],
        `image.${getMimeTypeFromExtension(mimeType).split("/")[1]}`,
        {
          type: mimeType,
        },
      ),
    );
    return `${safeName}.${extension}`;
  } catch {
    const extension = mimeType.split("/")[1] || "png";
    return `ai-image-${Date.now()}.${extension}`;
  }
}

function validateFile(file: File) {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return "Use a JPG, PNG, GIF, or WebP image.";
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return "Image must be 5MB or smaller.";
  }

  return null;
}

function getCampaignImageSourceFromMetadata(
  metadata?: AIImageStudioSelectionMetadata,
): CampaignImageGallerySource {
  switch (metadata?.source) {
    case "ai-generated":
      return "ai-generated";
    case "upload":
      return "upload";
    case "content_asset":
    case "global_image_gallery":
    default:
      return "library";
  }
}

function buildQuickGeneratePrompt(
  prompt: string,
  blockContext: string | undefined,
  aspectRatioHint: StudioImageAIAspectRatioHint | undefined,
) {
  const aspectRatioDirective =
    aspectRatioHint === "landscape"
      ? "Compose for a landscape 16:9 frame."
      : aspectRatioHint === "portrait"
        ? "Compose for a portrait 9:16 frame."
        : aspectRatioHint === "square"
          ? "Compose for a square 1:1 frame."
          : null;

  return [
    prompt,
    blockContext?.trim() ? `Field context: ${blockContext.trim()}.` : null,
    aspectRatioDirective,
  ]
    .filter(Boolean)
    .join(" ");
}

function getImageSourceIndicator(
  imageSourceRecord?: CampaignImageFieldSourceRecord | null,
) {
  switch (imageSourceRecord?.source) {
    case "ai-generated":
      return {
        icon: <Sparkles size={12} strokeWidth={1.9} />,
        label: "AI generated",
      };
    case "upload":
      return {
        icon: <UploadCloud size={12} strokeWidth={1.9} />,
        label: "Uploaded",
      };
    case "reused":
      return {
        icon: <Repeat2 size={12} strokeWidth={1.9} />,
        label: "Reused",
      };
    case "library":
      return {
        icon: <Images size={12} strokeWidth={1.9} />,
        label: "Library",
      };
    default:
      return null;
  }
}

export async function ensureCampaignStudioImageUrl(imageUrl: string) {
  const storageBucket = getPublicStorageBucket(imageUrl);

  if (storageBucket && PUBLIC_COMPATIBLE_BUCKETS.has(storageBucket)) {
    return imageUrl;
  }

  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(
      "Selected image could not be copied into campaign storage.",
    );
  }

  const blob = await response.blob();
  const fileType = ALLOWED_IMAGE_TYPES.has(blob.type)
    ? blob.type
    : getMimeTypeFromExtension(
        getSafeImageFileName(imageUrl, blob.type || "image/png")
          .split(".")
          .pop() || "png",
      );
  const fileName = getSafeImageFileName(imageUrl, fileType);
  const file = new File([blob], fileName, {
    type: fileType,
  });

  return uploadStudioImageFile(file);
}

export async function uploadStudioImageFile(file: File) {
  const validationError = validateFile(file);

  if (validationError) {
    throw new Error(validationError);
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  const userId = userData.user?.id;

  if (!userId) {
    throw new Error("Sign in to upload campaign images.");
  }

  const extension = getSafeExtension(file);
  const fileName = `${userId}/studio/${Date.now()}-${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(CAMPAIGN_IMAGE_BUCKET)
    .upload(fileName, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: urlData } = supabase.storage
    .from(CAMPAIGN_IMAGE_BUCKET)
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

export default function StudioImageUpload({
  aiAspectRatioHint,
  blockContext,
  blockId,
  campaignContext,
  campaignImages = [],
  compact,
  contextType = "email_block",
  defaultFilled = false,
  emptyText = "Upload image",
  height,
  maxPreviewHeight,
  imageSourceRecord,
  label,
  onApplyImage,
  onChange,
  onClearImage,
  onRequestAIImage,
  sourceTabs = false,
  value,
}: StudioImageUploadProps) {
  const [sourceTab, setSourceTab] = React.useState<ImageSourceTab>("upload");
  const { open } = useAIImageStudio();
  const isMobile = useMediaQuery("(max-width: 767.95px)");
  const prefersReducedMotion = useMediaQuery(
    "(prefers-reduced-motion: reduce)",
  );
  const { abortGeneration, generateSingleImageDetailed, isGenerating } =
    useAIImageGeneration();
  const [internalUrl, setInternalUrl] = React.useState(
    defaultFilled ? "preview" : "",
  );
  const [isDragActive, setIsDragActive] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [quickGenerateState, setQuickGenerateState] =
    React.useState<QuickGenerateState>({ mode: "collapsed" });
  const [quickGeneratePrompt, setQuickGeneratePrompt] = React.useState("");
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const lastFileRef = React.useRef<File | null>(null);
  const quickGenerateRequestRef = React.useRef(0);
  const resolvedHeight = compact ? (height ?? 72) : (height ?? 88);
  const resolvedUrl = value ?? internalUrl;
  const hasPreview = Boolean(resolvedUrl);
  const hasAITrigger = Boolean(blockContext?.trim());
  const quickGenerateActive = quickGenerateState.mode !== "collapsed";
  const quickGenerateBusy = quickGenerateState.mode === "loading";
  const previewAspectRatio =
    aiAspectRatioHint === "landscape" ? "16 / 10" : "1 / 1";
  const campaignGalleryItems = React.useMemo(
    () => campaignImages.slice(0, 8),
    [campaignImages],
  );
  const imageSourceIndicator = React.useMemo(
    () => getImageSourceIndicator(imageSourceRecord),
    [imageSourceRecord],
  );

  React.useEffect(() => {
    return () => {
      abortGeneration();
    };
  }, [abortGeneration]);

  const setResolvedUrl = React.useCallback(
    (nextUrl: string) => {
      if (value === undefined) {
        setInternalUrl(nextUrl);
      }

      onChange?.(nextUrl);
    },
    [onChange, value],
  );

  const buildApplyEvent = React.useCallback(
    (
      url: string,
      source: CampaignImageIndicatorSource,
      gallerySource: CampaignImageGallerySource,
      prompt?: string,
    ): StudioImageApplyEvent => ({
      blockLabel: campaignContext?.blockLabel,
      gallerySource,
      prompt,
      source,
      timestamp: Date.now(),
      url,
    }),
    [campaignContext?.blockLabel],
  );

  const handleAISelection = React.useCallback(
    async (
      imageUrl: string,
      metadata?: AIImageStudioSelectionMetadata,
      customOnSelect?: StudioImageAIRequest["onSelect"],
    ) => {
      try {
        const resolvedImageUrl = await ensureCampaignStudioImageUrl(imageUrl);

        if (customOnSelect) {
          await customOnSelect(resolvedImageUrl, metadata);
          return;
        }

        setResolvedUrl(resolvedImageUrl);
        onApplyImage?.(
          buildApplyEvent(
            resolvedImageUrl,
            getCampaignImageSourceFromMetadata(metadata),
            getCampaignImageSourceFromMetadata(metadata),
            metadata?.altText ||
              campaignContext?.contentSummary ||
              blockContext,
          ),
        );
        setErrorMessage(null);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Could not use the selected AI image.";
        setErrorMessage(message);
      }
    },
    [
      blockContext,
      buildApplyEvent,
      campaignContext?.contentSummary,
      onApplyImage,
      setResolvedUrl,
    ],
  );

  const openAIStudio = React.useCallback(
    (customOnSelect?: StudioImageAIRequest["onSelect"]) => {
      if (!hasAITrigger) {
        return;
      }

      const request: StudioImageAIRequest = {
        aiAspectRatioHint,
        blockContext,
        blockId,
        campaignContext,
        contextType,
        onSelect: (imageUrl, metadata) =>
          handleAISelection(imageUrl, metadata, customOnSelect),
      };

      if (onRequestAIImage) {
        onRequestAIImage(request);
        return;
      }

      open({
        aspectRatioHint: resolveAIAspectRatio(aiAspectRatioHint),
        blockId,
        campaignContext,
        channel: "newsletter",
        contentContext: blockContext,
        contextLabel: blockContext,
        contextType,
        defaultTab: "ai",
        onSelect: (imageUrl, metadata) => {
          void handleAISelection(imageUrl, metadata);
        },
      });
    },
    [
      aiAspectRatioHint,
      blockContext,
      blockId,
      campaignContext,
      contextType,
      handleAISelection,
      hasAITrigger,
      onRequestAIImage,
      open,
    ],
  );

  const uploadFile = React.useCallback(
    async (file: File) => {
      lastFileRef.current = file;
      setErrorMessage(null);
      setIsUploading(true);
      setProgress(18);

      try {
        setProgress(42);
        const publicUrl = await uploadStudioImageFile(file);
        setProgress(78);
        setResolvedUrl(publicUrl);
        onApplyImage?.(buildApplyEvent(publicUrl, "upload", "upload"));
        setProgress(100);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Upload failed.";
        setErrorMessage(message);
      } finally {
        window.setTimeout(() => {
          setIsUploading(false);
          setProgress(0);
        }, 240);

        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [buildApplyEvent, onApplyImage, setResolvedUrl],
  );

  const handleFiles = React.useCallback(
    (files: FileList | null) => {
      const file = files?.[0];

      if (!file) {
        return;
      }

      void uploadFile(file);
    },
    [uploadFile],
  );

  const resetQuickGenerateRequest = React.useCallback(() => {
    quickGenerateRequestRef.current += 1;
  }, []);

  const handleQuickGenerateSubmit = React.useCallback(async () => {
    const trimmedPrompt = quickGeneratePrompt.trim();

    if (!trimmedPrompt || quickGenerateBusy) {
      return;
    }

    const requestId = quickGenerateRequestRef.current + 1;
    quickGenerateRequestRef.current = requestId;
    setErrorMessage(null);
    setQuickGenerateState({ mode: "loading", prompt: trimmedPrompt });

    let enhancedPrompt = trimmedPrompt;

    try {
      const { data, error } = await supabase.functions.invoke(
        "enhance-image-prompt",
        {
          body: { campaignContext, prompt: trimmedPrompt },
        },
      );

      if (!error && typeof data?.enhancedPrompt === "string") {
        enhancedPrompt = data.enhancedPrompt.trim() || trimmedPrompt;
      }
    } catch {
      enhancedPrompt = trimmedPrompt;
    }

    const result = await generateSingleImageDetailed({
      channel: "newsletter",
      contentContext: buildQuickGeneratePrompt(
        enhancedPrompt,
        blockContext,
        aiAspectRatioHint,
      ),
      contentTitle: trimmedPrompt,
      uploadToStorage: true,
    });

    if (quickGenerateRequestRef.current !== requestId) {
      return;
    }

    if (result.aborted) {
      setQuickGenerateState({ mode: "input" });
      return;
    }

    if (!result.imageUrl || result.error) {
      setQuickGenerateState({ mode: "error", prompt: trimmedPrompt });
      return;
    }

    setQuickGenerateState({
      mode: "preview",
      prompt: enhancedPrompt,
      url: result.imageUrl,
    });
  }, [
    aiAspectRatioHint,
    blockContext,
    campaignContext,
    generateSingleImageDetailed,
    quickGenerateBusy,
    quickGeneratePrompt,
  ]);

  const handleQuickGenerateCancel = React.useCallback(() => {
    resetQuickGenerateRequest();

    if (quickGenerateBusy || isGenerating) {
      abortGeneration();
      setQuickGenerateState({ mode: "input" });
      return;
    }

    setQuickGenerateState({ mode: "collapsed" });
  }, [
    abortGeneration,
    isGenerating,
    quickGenerateBusy,
    resetQuickGenerateRequest,
  ]);

  const handleQuickGenerateUse = React.useCallback(async () => {
    if (quickGenerateState.mode !== "preview") {
      return;
    }

    try {
      const resolvedImageUrl = await ensureCampaignStudioImageUrl(
        quickGenerateState.url,
      );
      setResolvedUrl(resolvedImageUrl);
      onApplyImage?.(
        buildApplyEvent(
          resolvedImageUrl,
          "ai-generated",
          "ai-generated",
          quickGenerateState.prompt,
        ),
      );
      setQuickGeneratePrompt("");
      setQuickGenerateState({ mode: "collapsed" });
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not use generated image.",
      );
      setQuickGenerateState({
        mode: "error",
        prompt: quickGenerateState.prompt,
      });
    }
  }, [buildApplyEvent, onApplyImage, quickGenerateState, setResolvedUrl]);

  const handleQuickGenerateRetry = React.useCallback(() => {
    if (quickGenerateState.mode === "error") {
      setQuickGeneratePrompt(quickGenerateState.prompt);
    }

    if (quickGenerateState.mode === "preview") {
      setQuickGeneratePrompt(quickGenerateState.prompt);
    }

    setQuickGenerateState({ mode: "input" });
  }, [quickGenerateState]);

  return (
    <Stack
      spacing={0.5}
      sx={{ width: "100%", maxWidth: "100%", minWidth: 0, mb: "12px" }}
    >
      <Typography
        level="body-xs"
        sx={{
          maxWidth: "100%",
          fontSize: "12px",
          fontWeight: 650,
          letterSpacing: "0.01em",
          color: "neutral.700",
        }}
      >
        {label}
      </Typography>

      {campaignGalleryItems.length >= 2 ? (
        <Stack spacing={0.75} sx={{ width: "100%" }}>
          <Typography
            level="body-xs"
            sx={{
              color: "text.tertiary",
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            Recently used
          </Typography>
          <Stack
            direction="row"
            spacing={0.75}
            sx={{
              overflowX: "auto",
              pb: 0.25,
              scrollbarWidth: "thin",
              "&::-webkit-scrollbar": { height: 6 },
            }}
          >
            {campaignGalleryItems.map((image) => (
              <Sheet
                key={image.url}
                component="button"
                type="button"
                onClick={() => {
                  setResolvedUrl(image.url);
                  onApplyImage?.({
                    blockLabel: image.blockLabel,
                    gallerySource: image.source,
                    prompt: image.prompt,
                    source: "reused",
                    timestamp: Date.now(),
                    url: image.url,
                  });
                  setErrorMessage(null);
                }}
                sx={{
                  position: "relative",
                  width: 56,
                  minWidth: 56,
                  height: 56,
                  p: 0,
                  border: "1px solid",
                  borderColor: "neutral.200",
                  borderRadius: "6px",
                  overflow: "hidden",
                  bgcolor: "neutral.100",
                  cursor: "pointer",
                  "&:hover .studio-campaign-image-overlay": {
                    opacity: 1,
                  },
                }}
              >
                <Box
                  component="img"
                  alt={image.blockLabel ?? image.prompt ?? "Campaign image"}
                  loading="lazy"
                  src={image.url}
                  sx={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
                <Box
                  className="studio-campaign-image-overlay"
                  sx={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "rgba(15,23,42,0.4)",
                    color: "common.white",
                    opacity: 0,
                    transition: prefersReducedMotion
                      ? "none"
                      : "opacity 150ms ease",
                  }}
                >
                  <Check size={13} strokeWidth={2.2} />
                </Box>
                {image.source === "ai-generated" ? (
                  <Box
                    sx={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      width: 14,
                      height: 14,
                      borderRadius: "999px",
                      bgcolor: "primary.500",
                      color: "common.white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "sm",
                    }}
                  >
                    <Sparkles size={9} strokeWidth={2.2} />
                  </Box>
                ) : null}
              </Sheet>
            ))}
          </Stack>
        </Stack>
      ) : null}

      {sourceTabs ? (
        <Tabs
          value={sourceTab}
          onChange={(_event, next) => {
            if (typeof next === "string") setSourceTab(next as ImageSourceTab);
          }}
          size="sm"
          sx={{ bgcolor: "transparent" }}
        >
          <TabList
            data-testid="image-source-tabs"
            disableUnderline
            sx={{
              flexWrap: "wrap",
              gap: 0.5,
              p: 0.5,
              borderRadius: "8px",
              bgcolor: "neutral.50",
              "& .MuiTab-root": {
                flex: "1 1 auto",
                minHeight: 28,
                px: 1,
                borderRadius: "6px",
                fontSize: "12px",
                whiteSpace: "nowrap",
              },
            }}
          >
            {IMAGE_SOURCE_TABS.map((tab) => (
              <Tab key={tab.value} value={tab.value} disableIndicator>
                {tab.label}
              </Tab>
            ))}
          </TabList>
        </Tabs>
      ) : null}

      {sourceTabs && sourceTab === "my-images" ? (
        <Stack spacing={1} alignItems="flex-start" data-testid="image-source-my-images">
          <Typography level="body-xs" sx={{ color: "text.secondary" }}>
            Photos you have uploaded or used before.
          </Typography>
          <Button
            size="sm"
            variant="outlined"
            color="neutral"
            startDecorator={<Images size={15} />}
            onClick={() =>
              open({
                aspectRatioHint: resolveAIAspectRatio(aiAspectRatioHint),
                blockId,
                campaignContext,
                channel: "newsletter",
                contentContext: blockContext,
                contextLabel: blockContext,
                contextType,
                defaultTab: "my-images",
                onSelect: (imageUrl, metadata) => {
                  void handleAISelection(imageUrl, metadata);
                },
              })
            }
          >
            Open my images
          </Button>
        </Stack>
      ) : null}

      {sourceTabs && sourceTab === "products" ? (
        <ProductImagePanel
          onPick={(url, altText) => {
            setResolvedUrl(url);
            setErrorMessage(null);
            onApplyImage?.(buildApplyEvent(url, "reused", "library", altText));
          }}
        />
      ) : null}

      {sourceTabs && sourceTab === "theme" ? (
        <Stack direction="row" spacing={1} alignItems="flex-start" data-testid="image-source-theme">
          <Leaf size={16} style={{ flexShrink: 0, marginTop: 2, color: "var(--joy-palette-success-500)" }} />
          <Typography level="body-xs" sx={{ color: "text.secondary" }}>
            Photos for this week's theme will show here once weekly theme images are turned on.
          </Typography>
        </Stack>
      ) : null}

      {sourceTabs && sourceTab === "link" ? (
        <Stack spacing={0.5} data-testid="image-source-link">
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Link2 size={14} />
            <Typography level="body-xs" sx={{ color: "text.secondary" }}>
              Paste a link to a photo on the web.
            </Typography>
          </Stack>
          <ImageUrlField
            currentUrl={resolvedUrl ?? ""}
            expanded
            onApply={(url) => {
              setResolvedUrl(url);
              setErrorMessage(null);
              onApplyImage?.(buildApplyEvent(url, "reused", "library"));
            }}
          />
        </Stack>
      ) : null}

      <Box
        sx={{
          // The current photo stays visible on every tab; the drop zone only on Upload.
          display: sourceTabs && sourceTab !== "upload" && !hasPreview ? "none" : undefined,
          opacity: quickGenerateBusy ? 0.4 : 1,
          pointerEvents: quickGenerateBusy ? "none" : "auto",
          transition: prefersReducedMotion ? "none" : "opacity 150ms ease",
        }}
      >
        <Sheet
          key={hasPreview ? "preview" : "source"}
          variant="plain"
          sx={{
            position: "relative",
            width: "100%",
            maxWidth: "100%",
            boxSizing: "border-box",
            border: "1.5px solid",
            borderColor: isDragActive ? "primary.300" : "neutral.200",
            borderRadius: "12px",
            containerType: "inline-size",
            overflow: "hidden",
            bgcolor: "background.surface",
            transition: prefersReducedMotion
              ? "none"
              : "border-color 150ms ease, opacity 200ms ease",
            animation: prefersReducedMotion
              ? "none"
              : "studioImageSourceCardFade 200ms ease both",
            "@keyframes studioImageSourceCardFade": {
              from: { opacity: 0 },
              to: { opacity: 1 },
            },
            "&:hover .studio-image-preview-overlay, &:focus-within .studio-image-preview-overlay":
              {
                opacity: 1,
              },
            "&:hover .studio-image-actions, &:focus-within .studio-image-actions":
              {
                opacity: 1,
                transform: "translateY(0)",
                pointerEvents: "auto",
              },
          }}
        >
          <Box
            component="input"
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              handleFiles(event.target.files)
            }
            sx={{ display: "none" }}
          />

          {hasPreview ? (
            <Box
              sx={{
                position: "relative",
                aspectRatio: previewAspectRatio,
                ...(maxPreviewHeight ? { maxHeight: maxPreviewHeight, bgcolor: "background.level1" } : {}),
              }}
            >
              {resolvedUrl === "preview" ? (
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(135deg, rgba(15,23,42,0.18), rgba(15,23,42,0.08))",
                  }}
                />
              ) : (
                <Box
                  component="img"
                  alt={label}
                  src={resolvedUrl}
                  sx={{
                    width: "100%",
                    height: "100%",
                    maxHeight: maxPreviewHeight,
                    display: "block",
                    objectFit: maxPreviewHeight ? "contain" : "cover",
                    borderRadius: 0,
                  }}
                />
              )}

              {imageSourceIndicator ? (
                <Box
                  aria-label={imageSourceIndicator.label}
                  sx={{
                    position: "absolute",
                    top: 8,
                    left: 8,
                    width: 22,
                    height: 22,
                    borderRadius: "6px",
                    bgcolor: "rgba(255,255,255,0.85)",
                    backdropFilter: "blur(4px)",
                    WebkitBackdropFilter: "blur(4px)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color:
                      imageSourceRecord?.source === "ai-generated"
                        ? "primary.500"
                        : "text.secondary",
                    pointerEvents: "none",
                  }}
                >
                  {imageSourceIndicator.icon}
                </Box>
              ) : null}

              <Box
                className="studio-image-preview-overlay"
                sx={{
                  position: "absolute",
                  inset: 0,
                  opacity: 0,
                  transition: prefersReducedMotion
                    ? "none"
                    : "opacity 200ms ease",
                  background:
                    "linear-gradient(0deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.1) 60%, transparent 100%)",
                  pointerEvents: "none",
                }}
              />

              <Stack
                className="studio-image-actions"
                direction="row"
                spacing={1}
                sx={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 10,
                  zIndex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  px: 1,
                  opacity: 0,
                  pointerEvents: "none",
                  transform: "translateY(6px)",
                  transition: prefersReducedMotion
                    ? "none"
                    : "opacity 200ms ease, transform 200ms ease",
                }}
              >
                <Button
                  size="sm"
                  variant="soft"
                  color="neutral"
                  onClick={(event) => {
                    event.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  sx={{
                    bgcolor: "rgba(255,255,255,0.9)",
                    color: "text.primary",
                    "&:hover": { bgcolor: "common.white" },
                    fontSize: "12px",
                    fontWeight: 600,
                    borderRadius: "8px",
                    px: "12px",
                    minHeight: isMobile ? 44 : 30,
                  }}
                >
                  Change
                </Button>
                {hasAITrigger ? (
                  <Button
                    size="sm"
                    variant="solid"
                    color="primary"
                    startDecorator={<Sparkles size={14} strokeWidth={2} />}
                    onClick={(event) => {
                      event.stopPropagation();
                      openAIStudio();
                    }}
                    sx={{
                      fontSize: "12px",
                      fontWeight: 600,
                      borderRadius: "8px",
                      px: "12px",
                      minHeight: isMobile ? 44 : 30,
                    }}
                  >
                    AI Generate
                  </Button>
                ) : null}
                <IconButton
                  size="sm"
                  variant="soft"
                  color="danger"
                  aria-label="Remove photo"
                  onClick={(event) => {
                    event.stopPropagation();
                    setResolvedUrl("");
                    onClearImage?.();
                    setErrorMessage(null);
                  }}
                  sx={{
                    bgcolor: "rgba(255,255,255,0.9)",
                    color: "danger.500",
                    "&:hover": { bgcolor: "common.white" },
                    borderRadius: "8px",
                    minHeight: isMobile ? 44 : 30,
                    minWidth: isMobile ? 44 : 30,
                  }}
                >
                  <Trash2 size={14} strokeWidth={2} />
                </IconButton>
              </Stack>
            </Box>
          ) : (
            <Box
              sx={{
                minHeight: resolvedHeight,
                display: "flex",
                flexDirection: "row",
                "@container (max-width: 249px)": {
                  flexDirection: "column",
                },
              }}
            >
              <Box
                component="button"
                type="button"
                aria-label={emptyText}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsDragActive(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragActive(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setIsDragActive(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragActive(false);
                  handleFiles(event.dataTransfer.files);
                }}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  p: "20px 16px",
                  border: 0,
                  borderRight: hasAITrigger && !sourceTabs ? "1px solid" : 0,
                  borderColor: "neutral.100",
                  bgcolor: isDragActive ? "primary.50" : "transparent",
                  color: "inherit",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  gap: "6px",
                  transition: prefersReducedMotion
                    ? "none"
                    : "background-color 150ms ease",
                  "&:hover": {
                    bgcolor: isDragActive ? "primary.50" : "background.level1",
                  },
                  "&:focus-visible": {
                    outline: "2px solid var(--joy-palette-primary-300)",
                    outlineOffset: -2,
                  },
                  "@container (max-width: 249px)": {
                    borderRight: 0,
                    borderBottom: hasAITrigger && !sourceTabs ? "1px solid" : 0,
                    borderColor: "neutral.100",
                  },
                }}
              >
                <UploadCloud
                  size={24}
                  strokeWidth={1.9}
                  style={{
                    color: isDragActive
                      ? "var(--joy-palette-primary-500)"
                      : "var(--joy-palette-text-tertiary)",
                    transition: prefersReducedMotion
                      ? "none"
                      : "color 150ms ease",
                  }}
                />
                <Typography
                  level="body-xs"
                  sx={{
                    color: isDragActive ? "primary.600" : "text.secondary",
                    fontSize: "13px",
                    fontWeight: 600,
                    lineHeight: 1.2,
                  }}
                >
                  {isDragActive ? "Drop here" : "Upload"}
                </Typography>
                <Typography
                  level="body-xs"
                  sx={{
                    color: "text.tertiary",
                    fontSize: "11px",
                    lineHeight: 1.2,
                  }}
                >
                  or drag image
                </Typography>
              </Box>

              {hasAITrigger && !sourceTabs ? (
                <Box
                  component="button"
                  type="button"
                  onClick={() => openAIStudio()}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    p: "20px 16px",
                    border: 0,
                    bgcolor: "transparent",
                    color: "inherit",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    gap: "6px",
                    transition: prefersReducedMotion
                      ? "none"
                      : "background-color 150ms ease",
                    "&:hover": { bgcolor: "primary.50" },
                    "&:focus-visible": {
                      outline: "2px solid var(--joy-palette-primary-300)",
                      outlineOffset: -2,
                    },
                  }}
                >
                  <Sparkles
                    size={24}
                    strokeWidth={1.9}
                    style={{ color: "var(--joy-palette-primary-400)" }}
                  />
                  <Typography
                    level="body-xs"
                    sx={{
                      color: "text.secondary",
                      fontSize: "13px",
                      fontWeight: 600,
                      lineHeight: 1.2,
                    }}
                  >
                    Generate
                  </Typography>
                  <Typography
                    level="body-xs"
                    sx={{
                      color: "primary.400",
                      fontSize: "11px",
                      lineHeight: 1.2,
                    }}
                  >
                    with AI
                  </Typography>
                </Box>
              ) : null}
            </Box>
          )}

          {isUploading ? (
            <LinearProgress
              color="primary"
              determinate
              value={progress}
              size="sm"
              sx={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                borderRadius: 0,
                "--LinearProgress-thickness": "3px",
                "--LinearProgress-progressColor":
                  "var(--joy-palette-primary-400)",
                bgcolor: "primary.100",
              }}
            />
          ) : null}
        </Sheet>
      </Box>

      {sourceTabs && hasAITrigger ? (
        <Button
          size="sm"
          variant="plain"
          color="neutral"
          startDecorator={<Sparkles size={14} />}
          onClick={() => openAIStudio()}
          sx={{ alignSelf: "flex-start", fontWeight: 500 }}
        >
          Generate with AI
        </Button>
      ) : null}

      {hasAITrigger ? (
        <Stack spacing={0} sx={{ width: "100%" }}>
          <Stack
            direction="row"
            alignItems="center"
            spacing={0.5}
            sx={{ mt: "8px", px: "4px" }}
          >
            <Box
              sx={{
                color: "text.tertiary",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              <Zap size={14} strokeWidth={2} />
            </Box>
            <Link
              color="neutral"
              level="body-xs"
              onClick={() => {
                if (quickGenerateActive) {
                  handleQuickGenerateCancel();
                  return;
                }

                setQuickGenerateState({ mode: "input" });
              }}
              sx={{
                fontWeight: 500,
                cursor: "pointer",
              }}
              underline="none"
            >
              {quickGenerateActive ? "Cancel" : "Quick generate"}
            </Link>
          </Stack>
          <Box
            sx={{
              overflow: "hidden",
              maxHeight: quickGenerateActive ? 220 : 0,
              opacity: quickGenerateActive ? 1 : 0,
              transform: quickGenerateActive
                ? "translateY(0)"
                : "translateY(-6px)",
              transition: prefersReducedMotion
                ? "none"
                : "max-height 150ms ease, opacity 150ms ease, transform 150ms ease",
              mt: quickGenerateActive ? "8px" : 0,
            }}
          >
            <Box
              sx={{
                border: "1px solid",
                borderColor: "neutral.200",
                borderRadius: "10px",
                p: "4px",
                bgcolor: "background.surface",
              }}
            >
              {quickGenerateState.mode === "input" ? (
                <Stack direction="row" spacing={0.75}>
                  <Input
                    size="sm"
                    variant="plain"
                    color="neutral"
                    placeholder="Describe your image..."
                    value={quickGeneratePrompt}
                    onChange={(event) =>
                      setQuickGeneratePrompt(event.target.value)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        handleQuickGenerateCancel();
                        return;
                      }

                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleQuickGenerateSubmit();
                      }
                    }}
                    sx={{ flex: 1 }}
                  />
                  <IconButton
                    size="sm"
                    variant="solid"
                    color="primary"
                    disabled={!quickGeneratePrompt.trim()}
                    onClick={() => {
                      void handleQuickGenerateSubmit();
                    }}
                    sx={{ borderRadius: "8px", alignSelf: "center" }}
                  >
                    <ArrowUp size={14} strokeWidth={2.2} />
                  </IconButton>
                </Stack>
              ) : null}

              {quickGenerateState.mode === "loading" ? (
                <Stack
                  direction="row"
                  spacing={0.75}
                  alignItems="center"
                  sx={{ p: 0.75 }}
                >
                  <CircularProgress size="sm" />
                  <Typography level="body-sm">Generating...</Typography>
                </Stack>
              ) : null}

              {quickGenerateState.mode === "preview" ? (
                <Stack spacing={1} alignItems="center" sx={{ p: 0.75 }}>
                  <Box
                    component="img"
                    src={quickGenerateState.url}
                    alt={quickGenerateState.prompt}
                    sx={{
                      width: 120,
                      height: 80,
                      borderRadius: "10px",
                      objectFit: "cover",
                      display: "block",
                      border: "1px solid",
                      borderColor: "neutral.200",
                    }}
                  />
                  <Stack direction="row" spacing={0.75}>
                    <Button
                      size="sm"
                      variant="solid"
                      color="primary"
                      onClick={() => {
                        void handleQuickGenerateUse();
                      }}
                    >
                      Use
                    </Button>
                    <Button
                      size="sm"
                      variant="outlined"
                      color="neutral"
                      onClick={handleQuickGenerateRetry}
                    >
                      Try again
                    </Button>
                  </Stack>
                </Stack>
              ) : null}

              {quickGenerateState.mode === "error" ? (
                <Typography level="body-xs" color="danger" sx={{ p: 0.75 }}>
                  Generation failed.{" "}
                  <Link
                    color="danger"
                    level="body-xs"
                    onClick={handleQuickGenerateRetry}
                    sx={{ cursor: "pointer", fontWeight: 600 }}
                  >
                    Try again
                  </Link>
                </Typography>
              ) : null}
            </Box>
          </Box>
        </Stack>
      ) : null}

      {errorMessage ? (
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
        >
          <Typography
            level="body-xs"
            sx={{
              color: "danger.600",
              flex: 1,
              minWidth: 0,
              wordBreak: "break-word",
            }}
          >
            {errorMessage}
          </Typography>
          {lastFileRef.current ? (
            <Button
              size="sm"
              variant="plain"
              color="danger"
              onClick={() => {
                if (lastFileRef.current) {
                  void uploadFile(lastFileRef.current);
                }
              }}
              sx={{ minHeight: 24, fontSize: "11px", flexShrink: 0 }}
            >
              Retry
            </Button>
          ) : null}
        </Stack>
      ) : null}
      {sourceTabs ? null : (
        <ImageUrlField
          currentUrl={resolvedUrl ?? ""}
          onApply={(url) => {
            setResolvedUrl(url);
            setErrorMessage(null);
            onApplyImage?.(buildApplyEvent(url, "reused", "library"));
          }}
        />
      )}
    </Stack>
  );
}
