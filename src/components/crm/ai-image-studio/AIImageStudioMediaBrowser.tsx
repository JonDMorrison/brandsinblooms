import React from "react";
import AspectRatio from "@mui/joy/AspectRatio";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import CircularProgress from "@mui/joy/CircularProgress";
import FormHelperText from "@mui/joy/FormHelperText";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useContentAssets } from "@/hooks/useContentAssets";
import { useUnsplash } from "@/hooks/useUnsplash";
import { supabase } from "@/integrations/supabase/client";
import {
  generateAttributionText,
  prepareUnsplashAssetFile,
} from "@/services/unsplashDownloadService";
import { extractImageSummary } from "@/utils/imageContentSummary";
import { toast } from "sonner";
import {
  Check,
  ImagePlus,
  Images,
  RefreshCw,
  Search,
  Sparkles,
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
  paddingX: number;
}

interface UnsplashBrowserImage {
  alt: string;
  download_location?: string;
  download_url?: string;
  id: string;
  photographer: string;
  photographer_url?: string;
  thumb?: string;
  thumb_url?: string;
  url: string;
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
  user_prompt: string;
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

function aspectRatioToValue(aspectRatio?: AIImageStudioAspectRatio) {
  switch (aspectRatio) {
    case "16:9":
      return "16 / 9";
    case "9:16":
      return "9 / 16";
    case "1:1":
    default:
      return "1 / 1";
  }
}

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

function MediaCard({
  actionLabel = "Use image",
  aspectRatio,
  isBusy,
  item,
  onClick,
  sourceLabel,
}: {
  actionLabel?: string;
  aspectRatio?: AIImageStudioAspectRatio;
  isBusy: boolean;
  item: {
    altText?: string;
    byline?: string;
    createdAt?: string;
    displayTitle: string;
    id: string;
    subtitle: string;
    thumbnailUrl: string;
  };
  onClick: () => void;
  sourceLabel: string;
}) {
  return (
    <Button
      color="neutral"
      disabled={isBusy}
      onClick={onClick}
      sx={{
        p: 0,
        overflow: "hidden",
        borderRadius: "20px",
        display: "block",
        textAlign: "left",
        backgroundColor: "transparent",
        border: "1px solid",
        borderColor: "divider",
        transition:
          "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: "md",
          borderColor: "primary.300",
          backgroundColor: "transparent",
        },
      }}
      variant="plain"
    >
      <Sheet
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "background.surface",
        }}
      >
        <AspectRatio ratio={aspectRatioToValue(aspectRatio)}>
          <Box sx={{ position: "relative", height: "100%" }}>
            <img
              alt={item.altText || item.displayTitle}
              loading="lazy"
              src={item.thumbnailUrl}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />

            <Stack
              direction="row"
              spacing={0.75}
              sx={{ position: "absolute", top: 10, left: 10, right: 10 }}
            >
              <Chip color="neutral" size="sm" variant="soft">
                {sourceLabel}
              </Chip>
              {item.createdAt ? (
                <Chip color="neutral" size="sm" variant="soft">
                  {new Date(item.createdAt).toLocaleDateString()}
                </Chip>
              ) : null}
            </Stack>

            <Box
              sx={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(180deg, rgba(7, 11, 8, 0.02) 20%, rgba(7, 11, 8, 0.64) 100%)",
              }}
            />

            <Stack
              spacing={0.75}
              sx={{
                position: "absolute",
                left: 12,
                right: 12,
                bottom: 12,
                color: "common.white",
              }}
            >
              <Typography level="title-sm" sx={{ color: "common.white" }}>
                {item.displayTitle}
              </Typography>
              <Typography
                level="body-xs"
                sx={{ color: "rgba(255,255,255,0.82)" }}
              >
                {item.subtitle}
              </Typography>
              {item.byline ? (
                <Typography
                  level="body-xs"
                  sx={{ color: "rgba(255,255,255,0.68)" }}
                >
                  {item.byline}
                </Typography>
              ) : null}
            </Stack>
          </Box>
        </AspectRatio>

        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ px: 1.25, py: 1 }}
        >
          <Typography level="body-xs" textColor="text.tertiary">
            {actionLabel}
          </Typography>
          {isBusy ? (
            <CircularProgress size="sm" thickness={3} />
          ) : (
            <IconButton color="primary" size="sm" variant="soft">
              <Check size={15} strokeWidth={2.2} />
            </IconButton>
          )}
        </Stack>
      </Sheet>
    </Button>
  );
}

function EmptyState({
  description,
  icon,
  title,
}: {
  description: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <Sheet
      sx={{
        borderRadius: "24px",
        border: "1px dashed",
        borderColor: "divider",
        backgroundColor: "background.level1",
        py: 6,
        px: 3,
      }}
      variant="soft"
    >
      <Stack spacing={1.25} alignItems="center" textAlign="center">
        <Box sx={{ color: "primary.500", display: "inline-flex" }}>{icon}</Box>
        <Typography level="title-sm">{title}</Typography>
        <Typography level="body-sm" textColor="text.tertiary">
          {description}
        </Typography>
      </Stack>
    </Sheet>
  );
}

export function AIImageStudioMediaBrowser({
  activeTab,
  aspectRatioHint,
  contentContext = "",
  onSelect,
  paddingX,
}: AIImageStudioMediaBrowserProps) {
  const { assets, loading: isAssetsLoading, uploadAsset } = useContentAssets();
  const {
    getCuratedCollectionImages,
    loading: isUnsplashLoading,
    searchImages,
  } = useUnsplash();
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
  const [unsplashQueryInput, setUnsplashQueryInput] = React.useState("");
  const [unsplashQuery, setUnsplashQuery] = React.useState("");
  const [unsplashResults, setUnsplashResults] = React.useState<
    UnsplashBrowserImage[]
  >([]);
  const [uploadHover, setUploadHover] = React.useState(false);
  const [activeSelectionId, setActiveSelectionId] = React.useState<
    string | null
  >(null);
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

  React.useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setUnsplashQuery(unsplashQueryInput.trim());
    }, 260);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [unsplashQueryInput]);

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

  React.useEffect(() => {
    if (activeTab !== "unsplash") {
      return;
    }

    let isCancelled = false;

    const loadUnsplashResults = async () => {
      try {
        const initialQuery =
          unsplashQuery || extractImageSummary(contentContext);
        const images = unsplashQuery
          ? await searchImages(unsplashQuery, true)
          : initialQuery
            ? await searchImages(initialQuery, true)
            : await getCuratedCollectionImages(1);

        if (isCancelled) {
          return;
        }

        setUnsplashResults(images as UnsplashBrowserImage[]);

        if (!unsplashQueryInput && initialQuery) {
          setUnsplashQueryInput(initialQuery);
        }
      } catch (error) {
        console.error("Failed to load Unsplash images:", error);
      }
    };

    void loadUnsplashResults();

    return () => {
      isCancelled = true;
    };
  }, [
    activeTab,
    contentContext,
    getCuratedCollectionImages,
    searchImages,
    unsplashQuery,
    unsplashQueryInput,
  ]);

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
  }, [librarySearch]);

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

  const handleUnsplashSelect = React.useCallback(
    async (image: UnsplashBrowserImage) => {
      setActiveSelectionId(`unsplash-${image.id}`);

      try {
        const file = await prepareUnsplashAssetFile({
          imageUrl: image.download_url || image.url,
          photographer: image.photographer,
          photographerUrl: image.photographer_url,
          unsplashId: image.id,
          downloadLocation: image.download_location,
        });

        const asset = await uploadAsset(file, ["unsplash", image.photographer]);
        if (!asset?.url) {
          throw new Error("Failed to store Unsplash image.");
        }

        await onSelect(asset.url, {
          altText: image.alt,
          attribution: generateAttributionText(
            image.photographer,
            image.photographer_url,
            "copy",
          ),
          dimensions: parseDimensions(asset.dimensions),
          photographer: image.photographer,
          photographerUrl: image.photographer_url,
          source: "unsplash",
          unsplashId: image.id,
        });
      } catch (error) {
        console.error("Unsplash selection failed:", error);
        toast.error("Couldn’t save that Unsplash image.");
      } finally {
        setActiveSelectionId(null);
      }
    },
    [onSelect, uploadAsset],
  );

  if (activeTab === "my-images") {
    return (
      <Box
        ref={panelRef}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          px: paddingX,
          py: 2,
        }}
      >
        <Stack spacing={2}>
          <Input
            placeholder="Search images, prompts, or file names..."
            startDecorator={<Search size={16} />}
            value={librarySearchInput}
            onChange={(event) => setLibrarySearchInput(event.target.value)}
          />

          {isAssetsLoading && libraryAiItems.length === 0 ? (
            <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
              <CircularProgress size="sm" thickness={3} />
            </Stack>
          ) : visibleLibraryItems.length === 0 ? (
            <EmptyState
              description="Generated images and uploads will appear here together once they land in your library."
              icon={<Images size={26} strokeWidth={1.9} />}
              title="No images yet"
            />
          ) : (
            <>
              <Box
                sx={{
                  display: "grid",
                  gap: 1.5,
                  gridTemplateColumns: {
                    xs: "repeat(2, minmax(0, 1fr))",
                    sm: "repeat(3, minmax(0, 1fr))",
                  },
                }}
              >
                {visibleLibraryItems.map((item) => (
                  <MediaCard
                    key={item.id}
                    aspectRatio={aspectRatioHint}
                    isBusy={activeSelectionId === item.id}
                    item={item}
                    onClick={() => {
                      void handleSelectExisting(item);
                    }}
                    sourceLabel={
                      item.source === "content_asset" ? "Upload" : "AI"
                    }
                  />
                ))}
              </Box>

              <Box ref={librarySentinelRef} sx={{ height: 24 }} />

              {isLibraryLoading ? (
                <Stack alignItems="center" sx={{ py: 1.5 }}>
                  <CircularProgress size="sm" thickness={3} />
                </Stack>
              ) : null}
            </>
          )}
        </Stack>
      </Box>
    );
  }

  if (activeTab === "unsplash") {
    return (
      <Box
        ref={panelRef}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          px: paddingX,
          py: 2,
        }}
      >
        <Stack spacing={2}>
          <Stack direction="row" spacing={1}>
            <Input
              placeholder="Search Unsplash…"
              startDecorator={<Search size={16} />}
              sx={{ flex: 1 }}
              value={unsplashQueryInput}
              onChange={(event) => setUnsplashQueryInput(event.target.value)}
            />
            <IconButton
              aria-label="Refresh Unsplash results"
              color="neutral"
              onClick={() => {
                setUnsplashQueryInput("");
                setUnsplashQuery("");
              }}
              size="sm"
              variant="plain"
            >
              <RefreshCw size={16} strokeWidth={1.9} />
            </IconButton>
          </Stack>

          <Typography level="body-sm" textColor="text.tertiary">
            Selecting an Unsplash image saves a stable copy into your library
            before it is used.
          </Typography>

          {isUnsplashLoading && unsplashResults.length === 0 ? (
            <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
              <CircularProgress size="sm" thickness={3} />
            </Stack>
          ) : unsplashResults.length === 0 ? (
            <EmptyState
              description="Try a broader subject or a seasonal phrase to surface editorial-quality photography."
              icon={<Sparkles size={26} strokeWidth={1.9} />}
              title="No Unsplash matches"
            />
          ) : (
            <Box
              sx={{
                display: "grid",
                gap: 1.5,
                gridTemplateColumns: {
                  xs: "repeat(2, minmax(0, 1fr))",
                  sm: "repeat(3, minmax(0, 1fr))",
                },
              }}
            >
              {unsplashResults.map((image) => (
                <MediaCard
                  key={image.id}
                  actionLabel="Save and use"
                  aspectRatio={aspectRatioHint}
                  isBusy={activeSelectionId === `unsplash-${image.id}`}
                  item={{
                    altText: image.alt,
                    byline: `Photo by ${image.photographer}`,
                    displayTitle: image.alt || "Unsplash photo",
                    id: image.id,
                    subtitle: "Unsplash",
                    thumbnailUrl: image.thumb_url || image.thumb || image.url,
                  }}
                  onClick={() => {
                    void handleUnsplashSelect(image);
                  }}
                  sourceLabel="Unsplash"
                />
              ))}
            </Box>
          )}
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      ref={panelRef}
      sx={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        px: paddingX,
        py: 2,
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
            <Box
              sx={{
                display: "grid",
                gap: 1.5,
                gridTemplateColumns: {
                  xs: "repeat(2, minmax(0, 1fr))",
                  sm: "repeat(3, minmax(0, 1fr))",
                },
              }}
            >
              {uploadItems.slice(0, 6).map((item) => (
                <MediaCard
                  key={item.id}
                  aspectRatio={aspectRatioHint}
                  isBusy={activeSelectionId === item.id}
                  item={item}
                  onClick={() => {
                    void handleSelectExisting(item);
                  }}
                  sourceLabel="Upload"
                />
              ))}
            </Box>
          </Stack>
        ) : null}
      </Stack>
    </Box>
  );
}
