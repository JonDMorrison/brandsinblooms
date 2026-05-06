import React from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import CircularProgress from "@mui/joy/CircularProgress";
import FormHelperText from "@mui/joy/FormHelperText";
import Input from "@mui/joy/Input";
import Link from "@mui/joy/Link";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useContentAssets } from "@/hooks/useContentAssets";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Image as ImageIcon,
  ImagePlus,
  Images,
  Search,
  Sparkles,
  Upload,
  UploadCloud,
} from "lucide-react";
import type {
  AIImageStudioAspectRatio,
  AIImageStudioImageDimensions,
  AIImageStudioImageTag,
  AIImageStudioSelectionMetadata,
  AIImageStudioTab,
} from "./types";

const LIBRARY_PAGE_SIZE = 24;

interface AIImageStudioMediaBrowserProps {
  activeTab: Exclude<AIImageStudioTab, "ai">;
  aspectRatioHint?: AIImageStudioAspectRatio;
  contentContext?: string;
  onSelect: (
    imageUrl: string,
    metadata: AIImageStudioSelectionMetadata,
  ) => void | Promise<void>;
  onTabChange?: (tab: AIImageStudioTab) => void;
  paddingX: number;
}

interface AIImageLibraryRow {
  created_at: string | null;
  enhanced_prompt: string | null;
  global_image_gallery: {
    content_context: string | null;
    content_title: string | null;
    created_at: string;
    dimensions: unknown;
    generation_prompt: string;
    id: string;
    mime_type: string | null;
    public_url: string;
    storage_bucket: string;
    storage_path: string;
  } | null;
  global_image_id: string;
}

type MediaLibraryItemSource = "content_asset" | "global_image_gallery";

interface MediaLibraryItem {
  altText?: string;
  createdAt: string;
  dimensions?: AIImageStudioImageDimensions | null;
  displayTitle: string;
  id: string;
  imageUrl: string;
  metadata: AIImageStudioSelectionMetadata;
  prompt?: string;
  source: MediaLibraryItemSource;
  storagePath?: string;
  subtitle: string;
  tags?: AIImageStudioImageTag[];
  thumbnailUrl: string;
}

const thinScrollbarSx = {
  scrollbarWidth: "thin",
  scrollbarColor: "var(--joy-palette-neutral-outlinedBorder) transparent",
  "&::-webkit-scrollbar": {
    width: "5px",
    height: "5px",
  },
  "&::-webkit-scrollbar-track": {
    backgroundColor: "transparent",
  },
  "&::-webkit-scrollbar-thumb": {
    backgroundColor: "rgba(var(--joy-palette-neutral-mainChannel) / 0.4)",
    borderRadius: "10px",
  },
  "&::-webkit-scrollbar-thumb:hover": {
    backgroundColor: "rgba(var(--joy-palette-neutral-mainChannel) / 0.7)",
  },
} as const;

const galleryGridSx = {
  display: "grid",
  gap: "10px",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
} as const;

const mediaPanelAnimationSx = {
  "@keyframes aiImageStudioGalleryShimmer": {
    from: {
      backgroundPosition: "200% 0",
    },
    to: {
      backgroundPosition: "-200% 0",
    },
  },
  "@keyframes aiImageStudioGalleryCardEnter": {
    from: {
      opacity: 0,
      transform: "translateY(8px)",
    },
    to: {
      opacity: 1,
      transform: "translateY(0)",
    },
  },
  "@keyframes aiImageStudioPreviewEnter": {
    from: {
      opacity: 0,
      transform: "scale(0.95)",
    },
    to: {
      opacity: 1,
      transform: "scale(1)",
    },
  },
} as const;

function parseDimensions(
  input: unknown,
): AIImageStudioImageDimensions | null | undefined {
  if (!input) {
    return null;
  }

  if (typeof input === "string") {
    const match = input.match(/^(\d+)x(\d+)$/i);
    if (!match) {
      return null;
    }

    return {
      width: Number(match[1]),
      height: Number(match[2]),
    };
  }

  if (typeof input === "object") {
    const candidate = input as { width?: unknown; height?: unknown };
    if (
      typeof candidate.width === "number" &&
      typeof candidate.height === "number"
    ) {
      return {
        width: candidate.width,
        height: candidate.height,
      };
    }
  }

  return null;
}

function buildContentAssetThumbnail(filePath: string) {
  return supabase.storage.from("content-assets").getPublicUrl(filePath, {
    transform: {
      width: 720,
      height: 720,
      resize: "cover",
    },
  }).data.publicUrl;
}

function buildGlobalImageThumbnail(
  bucket: string,
  path: string,
  fallbackUrl: string,
) {
  if (!bucket || !path) {
    return fallbackUrl;
  }

  return supabase.storage.from(bucket).getPublicUrl(path, {
    transform: {
      width: 720,
      height: 720,
      resize: "cover",
    },
  }).data.publicUrl;
}

function mergeUniqueLibraryItems(items: MediaLibraryItem[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }

    seen.add(item.id);
    return true;
  });
}

function formatMediaDate(createdAt?: string) {
  if (!createdAt) {
    return "";
  }

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getMediaSourceLabel(source: MediaLibraryItemSource) {
  return source === "global_image_gallery" ? "AI-generated" : "Uploaded";
}

function getMediaTitle(
  item: Pick<MediaLibraryItem, "altText" | "displayTitle" | "prompt">,
) {
  return item.displayTitle || item.prompt || item.altText || "Image";
}

function MediaCardSkeleton() {
  return (
    <Box
      sx={{
        aspectRatio: "1 / 1",
        borderRadius: "12px",
        bgcolor: "background.level1",
        overflow: "hidden",
        position: "relative",
        border: "1px solid",
        borderColor: "neutral.100",
        "&::after": {
          content: '""',
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, transparent, rgba(0,0,0,0.04), transparent)",
          backgroundSize: "200% 100%",
          animation: "aiImageStudioGalleryShimmer 1.4s ease-in-out infinite",
        },
      }}
    />
  );
}

function MediaCard({
  isBusy,
  isMobile,
  isRevealed,
  item,
  onPreview,
  onReveal,
  onUse,
}: {
  isBusy: boolean;
  isMobile: boolean;
  isRevealed: boolean;
  item: MediaLibraryItem;
  onPreview: () => void;
  onReveal: () => void;
  onUse: () => void;
}) {
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [loadFailed, setLoadFailed] = React.useState(false);
  const isAiGenerated = item.source === "global_image_gallery";
  const title = getMediaTitle(item);
  const dateLabel = formatMediaDate(item.createdAt);
  const overlayVisible = isMobile && isRevealed;

  React.useEffect(() => {
    setImageLoaded(false);
    setLoadFailed(false);
  }, [item.thumbnailUrl]);

  const handlePreviewClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();

      if (isMobile && !isRevealed) {
        onReveal();
        return;
      }

      onPreview();
    },
    [isMobile, isRevealed, onPreview, onReveal],
  );

  return (
    <Box
      data-ai-gallery-card="true"
      sx={{
        aspectRatio: "1 / 1",
        borderRadius: "12px",
        overflow: "hidden",
        position: "relative",
        cursor: "pointer",
        border: "1px solid",
        borderColor: "neutral.100",
        bgcolor: "background.level1",
        animation: "aiImageStudioGalleryCardEnter 300ms ease both",
        "&:hover .ai-gallery-card-overlay": !isMobile
          ? {
              opacity: 1,
            }
          : undefined,
        "&:hover .ai-gallery-card-image": !isMobile
          ? {
              transform: "scale(1.04)",
            }
          : undefined,
        "&:hover .ai-gallery-card-use": !isMobile
          ? {
              opacity: 1,
              pointerEvents: "auto",
              transform: "translateY(0)",
            }
          : undefined,
      }}
    >
      {!imageLoaded && !loadFailed ? (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            bgcolor: "background.level1",
            zIndex: 1,
            "&::after": {
              content: '""',
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(90deg, transparent, rgba(0,0,0,0.04), transparent)",
              backgroundSize: "200% 100%",
              animation:
                "aiImageStudioGalleryShimmer 1.4s ease-in-out infinite",
            },
          }}
        />
      ) : null}

      {loadFailed ? (
        <Stack
          alignItems="center"
          justifyContent="center"
          sx={{
            position: "absolute",
            inset: 0,
            bgcolor: "background.level2",
            color: "text.tertiary",
            opacity: 0.3,
            zIndex: 1,
          }}
        >
          <ImageIcon size={24} strokeWidth={1.8} />
        </Stack>
      ) : null}

      <Box
        component="img"
        alt={item.altText || title}
        className="ai-gallery-card-image"
        loading="lazy"
        onError={() => {
          setLoadFailed(true);
          setImageLoaded(false);
        }}
        onLoad={() => {
          setLoadFailed(false);
          setImageLoaded(true);
        }}
        src={item.thumbnailUrl}
        sx={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
          opacity: imageLoaded && !loadFailed ? 1 : 0,
          transform: overlayVisible ? "scale(1.04)" : "scale(1)",
          transition: "opacity 300ms ease, transform 0.4s ease",
        }}
      />

      <Box
        component="button"
        aria-label={`Preview ${title}`}
        onClick={handlePreviewClick}
        type="button"
        sx={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          border: "none",
          bgcolor: "transparent",
          p: 0,
          cursor: "pointer",
          "&:focus-visible": {
            outline: "2px solid var(--joy-palette-primary-300)",
            outlineOffset: -2,
          },
        }}
      />

      <Box
        aria-label={getMediaSourceLabel(item.source)}
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
          color: isAiGenerated ? "primary.500" : "text.secondary",
          zIndex: 4,
          pointerEvents: "none",
        }}
      >
        {isAiGenerated ? (
          <Sparkles size={12} strokeWidth={2} />
        ) : (
          <Upload size={12} strokeWidth={2} />
        )}
      </Box>

      <Box
        className="ai-gallery-card-overlay"
        sx={{
          position: "absolute",
          inset: 0,
          zIndex: 3,
          opacity: overlayVisible ? 1 : 0,
          pointerEvents: "none",
          transition: "opacity 200ms ease",
          background:
            "linear-gradient(0deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.15) 50%, transparent 100%)",
        }}
      >
        <Stack
          direction="row"
          alignItems="flex-end"
          justifyContent="space-between"
          spacing={1}
          sx={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            p: "10px 12px",
          }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              sx={{
                fontSize: "13px",
                fontWeight: 600,
                color: "common.white",
                lineHeight: 1.3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {title}
            </Typography>
            {dateLabel ? (
              <Typography
                sx={{
                  fontSize: "11px",
                  fontWeight: 400,
                  color: "common.white",
                  lineHeight: 1.3,
                  opacity: 0.65,
                  mt: "2px",
                }}
              >
                {dateLabel}
              </Typography>
            ) : null}
          </Box>

          <Button
            className="ai-gallery-card-use"
            color="primary"
            loading={isBusy}
            onClick={(event) => {
              event.stopPropagation();
              onUse();
            }}
            size="sm"
            sx={{
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 600,
              px: "14px",
              py: "5px",
              minHeight: isMobile ? 44 : 28,
              boxShadow: "sm",
              opacity: overlayVisible ? 1 : 0,
              transform: overlayVisible ? "translateY(0)" : "translateY(4px)",
              transition: "opacity 200ms ease, transform 200ms ease",
              pointerEvents: overlayVisible ? "auto" : "none",
              flexShrink: 0,
            }}
            variant="solid"
          >
            Use
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}

function MediaPreviewLightbox({
  isBusy,
  item,
  onClose,
  onUse,
}: {
  isBusy: boolean;
  item: MediaLibraryItem;
  onClose: () => void;
  onUse: () => void;
}) {
  const title = getMediaTitle(item);
  const dateLabel = formatMediaDate(item.createdAt);
  const sourceLabel = getMediaSourceLabel(item.source);

  return (
    <Box
      onClick={onClose}
      sx={{
        position: "absolute",
        inset: 0,
        zIndex: 10,
        bgcolor: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 3,
      }}
    >
      <Stack
        alignItems="center"
        spacing={2}
        onClick={(event) => event.stopPropagation()}
        sx={{
          width: "100%",
          height: "100%",
          maxWidth: 560,
          minHeight: 0,
          animation: "aiImageStudioPreviewEnter 250ms ease-out both",
        }}
      >
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Box
            component="img"
            alt={item.altText || title}
            src={item.imageUrl}
            sx={{
              display: "block",
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              borderRadius: "12px",
              boxShadow: "xl",
            }}
          />
        </Box>

        <Stack
          spacing={0.5}
          alignItems="center"
          textAlign="center"
          sx={{ maxWidth: 520 }}
        >
          <Typography
            sx={{
              fontSize: "13px",
              color: "common.white",
              opacity: 0.85,
              whiteSpace: "pre-wrap",
            }}
          >
            {title}
          </Typography>
          <Typography
            sx={{ fontSize: "13px", color: "common.white", opacity: 0.75 }}
          >
            {[dateLabel, sourceLabel].filter(Boolean).join(" · ")}
          </Typography>
        </Stack>

        <Stack
          direction="row"
          spacing={1.25}
          justifyContent="center"
          useFlexGap
          flexWrap="wrap"
        >
          <Button
            color="primary"
            loading={isBusy}
            onClick={() => onUse()}
            size="md"
            variant="solid"
          >
            Use This Image
          </Button>
          <Button
            color="neutral"
            onClick={onClose}
            size="md"
            sx={{
              borderColor: "rgba(255,255,255,0.3)",
              color: "common.white",
              "&:hover": {
                borderColor: "rgba(255,255,255,0.48)",
                bgcolor: "rgba(255,255,255,0.08)",
              },
            }}
            variant="outlined"
          >
            Close
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

function LibraryEmptyState({
  onGenerate,
  onUpload,
}: {
  onGenerate: () => void;
  onUpload: () => void;
}) {
  return (
    <Box
      sx={{
        minHeight: 360,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <Stack spacing={0.5} alignItems="center">
        <Box
          sx={{ color: "text.tertiary", opacity: 0.25, display: "inline-flex" }}
        >
          <Images size={48} strokeWidth={1.6} />
        </Box>
        <Typography
          sx={{
            fontSize: "15px",
            fontWeight: 500,
            color: "text.secondary",
            mt: "12px",
          }}
        >
          No images yet
        </Typography>
        <Typography
          sx={{ fontSize: "13px", color: "text.tertiary", mt: "4px" }}
        >
          Generate your first image or upload one
        </Typography>
        <Stack
          direction="row"
          spacing="10px"
          justifyContent="center"
          sx={{ mt: "16px" }}
        >
          <Button
            color="primary"
            onClick={onGenerate}
            size="sm"
            startDecorator={<Sparkles size={14} strokeWidth={2} />}
            variant="solid"
          >
            Generate with AI
          </Button>
          <Button
            color="neutral"
            onClick={onUpload}
            size="sm"
            startDecorator={<Upload size={14} strokeWidth={2} />}
            variant="outlined"
          >
            Upload
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

function SearchEmptyState({ onClearSearch }: { onClearSearch: () => void }) {
  return (
    <Box
      sx={{
        minHeight: 320,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <Stack spacing={0.75} alignItems="center">
        <Box
          sx={{ color: "text.tertiary", opacity: 0.3, display: "inline-flex" }}
        >
          <Search size={32} strokeWidth={1.8} />
        </Box>
        <Typography sx={{ fontSize: "14px", color: "text.secondary" }}>
          No images match your search
        </Typography>
        <Link
          component="button"
          level="body-sm"
          color="primary"
          onClick={onClearSearch}
          underline="none"
        >
          Clear search
        </Link>
      </Stack>
    </Box>
  );
}

export function AIImageStudioMediaBrowser({
  activeTab,
  onSelect,
  onTabChange,
  paddingX,
}: AIImageStudioMediaBrowserProps) {
  const isMobile = useMediaQuery("(max-width: 767.95px)");
  const { assets, loading: isAssetsLoading, uploadAsset } = useContentAssets();
  const [libraryAiItems, setLibraryAiItems] = React.useState<
    MediaLibraryItem[]
  >([]);
  const [libraryPage, setLibraryPage] = React.useState(0);
  const [hasMoreLibraryAi, setHasMoreLibraryAi] = React.useState(true);
  const [isLibraryLoading, setIsLibraryLoading] = React.useState(false);
  const [visibleLibraryCount, setVisibleLibraryCount] =
    React.useState(LIBRARY_PAGE_SIZE);
  const [librarySearchInput, setLibrarySearchInput] = React.useState("");
  const [librarySearch, setLibrarySearch] = React.useState("");
  const [uploadHover, setUploadHover] = React.useState(false);
  const [activeSelectionId, setActiveSelectionId] = React.useState<
    string | null
  >(null);
  const [revealedCardId, setRevealedCardId] = React.useState<string | null>(
    null,
  );
  const [previewItem, setPreviewItem] = React.useState<MediaLibraryItem | null>(
    null,
  );
  const librarySentinelRef = React.useRef<HTMLDivElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const uploadInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setLibrarySearch(librarySearchInput.trim().toLowerCase());
    }, 220);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [librarySearchInput]);

  const loadLibraryPage = React.useCallback(
    async (nextPage: number) => {
      if (isLibraryLoading) {
        return;
      }

      setIsLibraryLoading(true);

      try {
        const from = (nextPage - 1) * LIBRARY_PAGE_SIZE;
        const to = from + LIBRARY_PAGE_SIZE - 1;
        const { data, error } = await supabase
          .from("ai_assistant_generated_images")
          .select(
            `
              created_at,
              enhanced_prompt,
              global_image_id,
              user_prompt,
              global_image_gallery!inner(
                id,
                content_context,
                content_title,
                created_at,
                dimensions,
                generation_prompt,
                mime_type,
                public_url,
                storage_bucket,
                storage_path
              )
            `,
          )
          .order("created_at", { ascending: false })
          .range(from, to);

        if (error) {
          throw error;
        }

        const rows = (data || []) as AIImageLibraryRow[];
        const imageIds = rows.map((row) => row.global_image_id);

        let tagsByImageId = new Map<string, AIImageStudioImageTag[]>();
        if (imageIds.length > 0) {
          const { data: tagsData, error: tagsError } = await supabase
            .from("global_image_tags")
            .select("confidence_score, image_id, tag_category, tag_name")
            .in("image_id", imageIds);

          if (!tagsError) {
            tagsByImageId = (tagsData || []).reduce((map, tag) => {
              const nextTags = map.get(tag.image_id) || [];
              nextTags.push({
                name: tag.tag_name,
                category: tag.tag_category,
                confidence: tag.confidence_score,
              });
              map.set(tag.image_id, nextTags);
              return map;
            }, new Map<string, AIImageStudioImageTag[]>());
          }
        }

        const nextItems = rows
          .filter(
            (
              row,
            ): row is AIImageLibraryRow & {
              global_image_gallery: NonNullable<
                AIImageLibraryRow["global_image_gallery"]
              >;
            } => !!row.global_image_gallery,
          )
          .map((row) => {
            const gallery = row.global_image_gallery;
            const dimensions = parseDimensions(gallery.dimensions);
            const tags = tagsByImageId.get(row.global_image_id) || [];
            const displayTitle =
              gallery.content_title || row.user_prompt || "AI creation";
            return {
              id: `gallery-${gallery.id}`,
              createdAt: row.created_at || gallery.created_at,
              dimensions,
              displayTitle,
              imageUrl: gallery.public_url,
              metadata: {
                altText: row.user_prompt,
                dimensions,
                mimeType: gallery.mime_type,
                source: "global_image_gallery",
                tags,
              },
              prompt: row.user_prompt,
              source: "global_image_gallery" as const,
              storagePath: gallery.storage_path,
              subtitle:
                row.enhanced_prompt ||
                gallery.content_context ||
                "AI generated",
              tags,
              thumbnailUrl: buildGlobalImageThumbnail(
                gallery.storage_bucket,
                gallery.storage_path,
                gallery.public_url,
              ),
            } satisfies MediaLibraryItem;
          });

        setLibraryAiItems((previousItems) =>
          mergeUniqueLibraryItems([...previousItems, ...nextItems]),
        );
        setLibraryPage(nextPage);
        setHasMoreLibraryAi(rows.length === LIBRARY_PAGE_SIZE);
      } catch (error) {
        console.error("Failed to load AI image library:", error);
        toast.error("Couldn’t load your recent images.");
      } finally {
        setIsLibraryLoading(false);
      }
    },
    [isLibraryLoading],
  );

  React.useEffect(() => {
    if (activeTab !== "my-images" || libraryPage > 0) {
      return;
    }

    void loadLibraryPage(1);
  }, [activeTab, libraryPage, loadLibraryPage]);

  const uploadItems = React.useMemo<MediaLibraryItem[]>(() => {
    return assets.map((asset) => ({
      id: `asset-${asset.id}`,
      createdAt: asset.created_at,
      dimensions: parseDimensions(asset.dimensions),
      displayTitle: asset.name,
      imageUrl: asset.url || "/placeholder.svg",
      metadata: {
        altText: asset.name,
        dimensions: parseDimensions(asset.dimensions),
        source: "content_asset",
      },
      source: "content_asset",
      subtitle:
        asset.type === "image" ? "Uploaded to your library" : asset.type,
      thumbnailUrl: buildContentAssetThumbnail(asset.file_path),
    }));
  }, [assets]);

  const filteredLibraryItems = React.useMemo(() => {
    const combined = [...uploadItems, ...libraryAiItems]
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime(),
      )
      .filter((item) => {
        if (!librarySearch) {
          return true;
        }

        const haystack = [
          item.displayTitle,
          item.subtitle,
          item.prompt,
          item.metadata.altText,
          item.tags?.map((tag) => tag.name).join(" "),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(librarySearch);
      });

    return combined;
  }, [libraryAiItems, librarySearch, uploadItems]);

  const visibleLibraryItems = React.useMemo(
    () => filteredLibraryItems.slice(0, visibleLibraryCount),
    [filteredLibraryItems, visibleLibraryCount],
  );

  const loadMoreLibraryItems = React.useCallback(async () => {
    if (isLibraryLoading) {
      return;
    }

    const nextVisibleCount = visibleLibraryCount + LIBRARY_PAGE_SIZE;

    if (
      !librarySearch &&
      nextVisibleCount > filteredLibraryItems.length &&
      hasMoreLibraryAi
    ) {
      await loadLibraryPage(libraryPage + 1);
    }

    setVisibleLibraryCount(nextVisibleCount);
  }, [
    filteredLibraryItems.length,
    hasMoreLibraryAi,
    isLibraryLoading,
    libraryPage,
    librarySearch,
    loadLibraryPage,
    visibleLibraryCount,
  ]);

  React.useEffect(() => {
    setVisibleLibraryCount(LIBRARY_PAGE_SIZE);
    setRevealedCardId(null);
  }, [librarySearch]);

  React.useEffect(() => {
    setRevealedCardId(null);
    setPreviewItem(null);
  }, [activeTab]);

  React.useEffect(() => {
    if (!previewItem) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreviewItem(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewItem]);

  React.useEffect(() => {
    if (
      activeTab !== "my-images" ||
      !librarySentinelRef.current ||
      !panelRef.current
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMoreLibraryItems();
        }
      },
      {
        root: panelRef.current,
        rootMargin: "240px 0px",
      },
    );

    observer.observe(librarySentinelRef.current);

    return () => {
      observer.disconnect();
    };
  }, [activeTab, loadMoreLibraryItems]);

  const handleSelectExisting = React.useCallback(
    async (item: MediaLibraryItem) => {
      setActiveSelectionId(item.id);

      try {
        await onSelect(item.imageUrl, item.metadata);
      } finally {
        setActiveSelectionId(null);
      }
    },
    [onSelect],
  );

  const handleUploadFile = React.useCallback(
    async (file: File) => {
      setActiveSelectionId(`upload-${file.name}`);

      try {
        const asset = await uploadAsset(file, []);
        if (!asset?.url) {
          throw new Error("Upload did not return a public URL.");
        }

        await onSelect(asset.url, {
          altText: file.name,
          dimensions: parseDimensions(asset.dimensions),
          source: "upload",
        });
      } catch (error) {
        console.error("Upload selection failed:", error);
      } finally {
        setActiveSelectionId(null);
      }
    },
    [onSelect, uploadAsset],
  );

  const handlePanelClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!isMobile) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        !target.closest("[data-ai-gallery-card='true']")
      ) {
        setRevealedCardId(null);
      }
    },
    [isMobile],
  );

  const clearLibrarySearch = React.useCallback(() => {
    setLibrarySearchInput("");
    setLibrarySearch("");
  }, []);

  const renderMediaCard = React.useCallback(
    (item: MediaLibraryItem) => (
      <MediaCard
        key={item.id}
        isBusy={activeSelectionId === item.id}
        isMobile={isMobile}
        isRevealed={revealedCardId === item.id}
        item={item}
        onPreview={() => setPreviewItem(item)}
        onReveal={() => setRevealedCardId(item.id)}
        onUse={() => {
          setRevealedCardId(null);
          void handleSelectExisting(item);
        }}
      />
    ),
    [activeSelectionId, handleSelectExisting, isMobile, revealedCardId],
  );

  const previewOverlay = previewItem ? (
    <MediaPreviewLightbox
      isBusy={activeSelectionId === previewItem.id}
      item={previewItem}
      onClose={() => setPreviewItem(null)}
      onUse={() => {
        const item = previewItem;
        setPreviewItem(null);
        setRevealedCardId(null);
        void handleSelectExisting(item);
      }}
    />
  ) : null;

  const isInitialLibraryLoading =
    !librarySearch &&
    visibleLibraryItems.length === 0 &&
    (isAssetsLoading || libraryPage === 0 || isLibraryLoading);
  const hasSearchResultsEmptyState =
    !!librarySearch &&
    filteredLibraryItems.length === 0 &&
    !isInitialLibraryLoading;
  const hasLibraryEmptyState =
    !librarySearch &&
    filteredLibraryItems.length === 0 &&
    !isInitialLibraryLoading;

  if (activeTab === "my-images") {
    return (
      <Box
        ref={panelRef}
        data-ai-image-studio-scroll-container="true"
        onClick={handlePanelClick}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: previewItem ? "hidden" : "auto",
          overscrollBehaviorY: "contain",
          bgcolor: "background.body",
          px: paddingX,
          py: 2,
          position: "relative",
          WebkitOverflowScrolling: "touch",
          ...thinScrollbarSx,
          ...mediaPanelAnimationSx,
        }}
      >
        <Stack spacing={2} sx={{ minHeight: "100%" }}>
          <Input
            placeholder="Search images, prompts, or file names..."
            startDecorator={<Search size={16} />}
            value={librarySearchInput}
            onChange={(event) => setLibrarySearchInput(event.target.value)}
          />

          {isInitialLibraryLoading ? (
            <Box sx={galleryGridSx}>
              {Array.from({ length: 6 }).map((_, index) => (
                <MediaCardSkeleton key={index} />
              ))}
            </Box>
          ) : hasSearchResultsEmptyState ? (
            <SearchEmptyState onClearSearch={clearLibrarySearch} />
          ) : hasLibraryEmptyState ? (
            <LibraryEmptyState
              onGenerate={() => onTabChange?.("ai")}
              onUpload={() => onTabChange?.("upload")}
            />
          ) : (
            <>
              <Box sx={galleryGridSx}>
                {visibleLibraryItems.map((item) => renderMediaCard(item))}
              </Box>

              <Box ref={librarySentinelRef} sx={{ height: 1 }} />

              {isLibraryLoading ? (
                <Stack alignItems="center" sx={{ my: "16px" }}>
                  <CircularProgress color="neutral" size="sm" variant="soft" />
                </Stack>
              ) : null}
            </>
          )}
        </Stack>

        {previewOverlay}
      </Box>
    );
  }

  return (
    <Box
      ref={panelRef}
      data-ai-image-studio-scroll-container="true"
      onClick={handlePanelClick}
      sx={{
        flex: 1,
        minHeight: 0,
        overflowY: previewItem ? "hidden" : "auto",
        overscrollBehaviorY: "contain",
        bgcolor: "background.body",
        px: paddingX,
        py: 2,
        position: "relative",
        WebkitOverflowScrolling: "touch",
        ...thinScrollbarSx,
        ...mediaPanelAnimationSx,
      }}
    >
      <Stack spacing={2.5}>
        <Sheet
          onDragEnter={(event) => {
            event.preventDefault();
            setUploadHover(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setUploadHover(false);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(event) => {
            event.preventDefault();
            setUploadHover(false);
            const file = event.dataTransfer.files?.[0];
            if (file) {
              void handleUploadFile(file);
            }
          }}
          sx={{
            borderRadius: "28px",
            border: "1px dashed",
            borderColor: uploadHover ? "primary.400" : "divider",
            backgroundColor: uploadHover
              ? "rgba(var(--joy-palette-primary-mainChannel) / 0.06)"
              : "background.level1",
            transition: "border-color 180ms ease, background-color 180ms ease",
            px: 3,
            py: 5,
          }}
          variant="soft"
        >
          <Stack spacing={1.5} alignItems="center" textAlign="center">
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: "18px",
                backgroundColor:
                  "rgba(var(--joy-palette-primary-mainChannel) / 0.12)",
                color: "primary.600",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <UploadCloud size={24} strokeWidth={1.9} />
            </Box>
            <Typography level="title-md">Upload an image</Typography>
            <Typography level="body-sm" textColor="text.tertiary">
              Drag a file here or browse your device. Uploaded images land in My
              Images immediately.
            </Typography>
            <Button
              onClick={() => uploadInputRef.current?.click()}
              startDecorator={<ImagePlus size={16} />}
              variant="solid"
            >
              Choose file
            </Button>
            <FormHelperText>
              PNG, JPG, WebP, or GIF. Best results come from images wider than
              1200px.
            </FormHelperText>
          </Stack>
        </Sheet>

        <input
          ref={uploadInputRef}
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void handleUploadFile(file);
            }

            event.target.value = "";
          }}
          type="file"
        />

        {uploadItems.length > 0 ? (
          <Stack spacing={1.25}>
            <Typography level="title-sm">Recent uploads</Typography>
            <Box sx={galleryGridSx}>
              {uploadItems.slice(0, 6).map((item) => renderMediaCard(item))}
            </Box>
          </Stack>
        ) : null}
      </Stack>

      {previewOverlay}
    </Box>
  );
}
