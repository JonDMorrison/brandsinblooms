import { useEffect, useMemo, useRef, useState } from "react";
import AspectRatio from "@mui/joy/AspectRatio";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import DialogActions from "@mui/joy/DialogActions";
import DialogContent from "@mui/joy/DialogContent";
import DialogTitle from "@mui/joy/DialogTitle";
import Input from "@mui/joy/Input";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import Option from "@mui/joy/Option";
import Select from "@mui/joy/Select";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Tab from "@mui/joy/Tab";
import TabList from "@mui/joy/TabList";
import Tabs from "@mui/joy/Tabs";
import Typography from "@mui/joy/Typography";
import { formatDistanceToNow } from "date-fns";
import {
  BookText,
  CalendarDays,
  Clapperboard,
  ExternalLink,
  Facebook,
  FileStack,
  Instagram,
  MoreHorizontal,
  Newspaper,
  PanelsTopLeft,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { GeneratedContentModal } from "@/components/create-flow/GeneratedContentModal";
import { CreateFlowDialog } from "@/components/create-flow/CreateFlowDialog";
import type { CreateFlowRetryDraft } from "@/components/create-flow/createFlowTypes";
import { ContentLibraryGenerationStatusCard } from "@/components/content-library/ContentLibraryGenerationStatusCard";
import {
  JoyDropdownMenu,
  JoyDropdownMenuContent,
  JoyDropdownMenuItem,
  JoyDropdownMenuTrigger,
} from "@/components/joy/JoyDropdownMenu";
import {
  useContentLibrary,
  useContentLibraryCount,
  useDeleteBundle,
} from "@/hooks/useContentLibrary";
import type {
  Channel,
  ContentSummary,
  LibraryChannelFilter,
  LibraryMode,
  LibrarySort,
} from "@/lib/content/libraryTypes";
import { useDebounce } from "@/hooks/useDebounce";
import { useToast } from "@/hooks/use-toast";
import { useCreateFlow } from "@/state/useCreateFlow";

const PAGE_SIZE = 24;

type ModeTabValue = Exclude<LibraryMode, "event"> | "all";
type ChannelSelectValue = LibraryChannelFilter | "all";

const MODE_OPTIONS: Array<{ value: ModeTabValue; label: string }> = [
  { value: "all", label: "All" },
  { value: "seasonal", label: "Seasonal" },
  { value: "holiday", label: "Holiday" },
  { value: "custom", label: "Custom" },
];

const CHANNEL_OPTIONS: Array<{ value: ChannelSelectValue; label: string }> = [
  { value: "all", label: "All Channels" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "blog", label: "Blog" },
  { value: "newsletter", label: "Newsletter" },
  { value: "carousel", label: "Carousel" },
];

const SORT_OPTIONS: Array<{ value: LibrarySort; label: string }> = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];

const CHANNEL_META: Record<
  Channel | "carousel",
  { label: string; icon: typeof Instagram }
> = {
  instagram: { label: "Instagram", icon: Instagram },
  facebook: { label: "Facebook", icon: Facebook },
  newsletter: { label: "Newsletter", icon: Newspaper },
  blog: { label: "Blog", icon: BookText },
  video: { label: "Video", icon: Clapperboard },
  carousel: { label: "Carousel", icon: PanelsTopLeft },
};

const MODE_META: Record<
  LibraryMode,
  { label: string; color: "neutral" | "success" | "warning" | "primary" }
> = {
  event: { label: "Event", color: "neutral" },
  seasonal: { label: "Seasonal", color: "success" },
  holiday: { label: "Holiday", color: "warning" },
  custom: { label: "Custom", color: "primary" },
};

function useQueryParams() {
  const location = useLocation();
  return useMemo(() => new URLSearchParams(location.search), [location.search]);
}

function getInitialMode(value: string | null): ModeTabValue {
  if (value === "seasonal" || value === "holiday" || value === "custom") {
    return value;
  }

  return "all";
}

function getInitialChannel(value: string | null): ChannelSelectValue {
  if (
    value === "facebook" ||
    value === "instagram" ||
    value === "blog" ||
    value === "newsletter" ||
    value === "carousel"
  ) {
    return value;
  }

  return "all";
}

function getInitialSort(value: string | null): LibrarySort {
  return value === "oldest" ? "oldest" : "newest";
}

function getBundleDisplayName(bundle: {
  title?: string;
  sourceLabel?: string;
  mode: LibraryMode;
  channels?: Channel[];
  updatedAt: string;
}): string {
  const previewTitle = (bundle.title || bundle.sourceLabel || "").trim();
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      previewTitle,
    );

  if (previewTitle && !isUuid && !/^untitled$/i.test(previewTitle)) {
    return previewTitle;
  }

  const modeLabel = MODE_META[bundle.mode].label;
  const primaryChannel = bundle.channels?.[0];
  const channelLabel = primaryChannel
    ? CHANNEL_META[primaryChannel].label
    : "Multi-channel";

  return `${modeLabel} • ${channelLabel} • ${new Date(bundle.updatedAt).toLocaleDateString()}`;
}

function getRelativeDate(date: string) {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

function getApprovalLabel(bundle: ContentSummary) {
  if (bundle.totalItems > 0 && bundle.approvedCount === bundle.totalItems) {
    return { text: "All approved", color: "success.600" };
  }

  return {
    text: `${bundle.approvedCount} of ${bundle.totalItems} approved`,
    color: "neutral.500",
  };
}

function getBundleChannels(bundle: ContentSummary) {
  const channels = [...bundle.channels];

  if (bundle.hasMixedCarousel) {
    channels.push("carousel" as Channel);
  }

  return Array.from(new Set(channels));
}

function getPrimaryPlaceholderChannel(bundle: ContentSummary) {
  const channels = getBundleChannels(bundle);
  return (channels[0] as Channel | "carousel" | undefined) || "carousel";
}

function getPublishChannel(
  bundle: ContentSummary,
): "instagram" | "facebook" | null {
  if (bundle.approvedCount === 0) {
    return null;
  }

  if (bundle.channels.includes("instagram")) {
    return "instagram";
  }

  if (bundle.channels.includes("facebook")) {
    return "facebook";
  }

  return null;
}

function replaceQueryParams(mutator: (params: URLSearchParams) => void) {
  const url = new URL(window.location.href);
  mutator(url.searchParams);
  const nextSearch = url.searchParams.toString();
  const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ""}${url.hash}`;
  window.history.replaceState(window.history.state, "", nextUrl);
}

function BundleCard({
  bundle,
  isHighlighted,
  onOpen,
  onPublish,
  onDelete,
}: {
  bundle: ContentSummary;
  isHighlighted: boolean;
  onOpen: (bundle: ContentSummary) => void;
  onPublish: (bundle: ContentSummary) => void;
  onDelete: (bundle: ContentSummary) => void;
}) {
  const bundleTitle = getBundleDisplayName(bundle);
  const approval = getApprovalLabel(bundle);
  const bundleChannels = getBundleChannels(bundle);
  const publishChannel = getPublishChannel(bundle);
  const PlaceholderIcon =
    CHANNEL_META[getPrimaryPlaceholderChannel(bundle)].icon;

  return (
    <Card
      variant="outlined"
      role="button"
      aria-label={`Open ${bundleTitle}`}
      tabIndex={0}
      onClick={() => onOpen(bundle)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(bundle);
          return;
        }

        if (event.key === "Delete") {
          event.preventDefault();
          onDelete(bundle);
        }
      }}
      sx={{
        height: "100%",
        p: 0,
        overflow: "hidden",
        borderColor: isHighlighted ? "primary.300" : "neutral.200",
        boxShadow: isHighlighted ? "md" : "sm",
        cursor: "pointer",
        transition:
          "border-color 220ms ease, box-shadow 220ms ease, transform 220ms ease",
        animation: isHighlighted
          ? "content-library-card-highlight 2s ease-out 1"
          : undefined,
        "&:hover": {
          borderColor: "primary.300",
          boxShadow: "md",
          transform: "translateY(-2px)",
        },
        "&:focus-visible": {
          outline: "2px solid",
          outlineColor: "primary.400",
          outlineOffset: 2,
        },
        "@keyframes content-library-card-highlight": {
          "0%": {
            borderColor: "var(--joy-palette-primary-300)",
            boxShadow:
              "0 0 0 0 rgba(var(--joy-palette-primary-mainChannel) / 0.26)",
          },
          "45%": {
            borderColor: "var(--joy-palette-primary-300)",
            boxShadow:
              "0 0 0 8px rgba(var(--joy-palette-primary-mainChannel) / 0.08)",
          },
          "100%": {
            borderColor: "var(--joy-palette-neutral-200)",
            boxShadow: "var(--joy-shadow-sm)",
          },
        },
      }}
    >
      <AspectRatio ratio="16 / 9" sx={{ borderRadius: 0 }}>
        {bundle.thumbnail ? (
          <Box
            component="img"
            src={bundle.thumbnail}
            alt={`${bundleTitle} featured image`}
            loading="lazy"
            sx={{ objectFit: "cover" }}
          />
        ) : (
          <Sheet
            variant="soft"
            color="neutral"
            sx={{
              height: "100%",
              display: "grid",
              placeItems: "center",
              background:
                "linear-gradient(135deg, rgba(var(--joy-palette-neutral-mainChannel) / 0.06), rgba(var(--joy-palette-primary-mainChannel) / 0.08))",
            }}
          >
            <Stack spacing={1} alignItems="center">
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: "999px",
                  display: "grid",
                  placeItems: "center",
                  color: "neutral.500",
                  backgroundColor:
                    "rgba(var(--joy-palette-common-whiteChannel) / 0.72)",
                  boxShadow: "sm",
                  "& .lucide": {
                    width: 24,
                    height: 24,
                  },
                }}
              >
                <PlaceholderIcon />
              </Box>
              <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                {bundle.totalItems} item{bundle.totalItems === 1 ? "" : "s"}
              </Typography>
            </Stack>
          </Sheet>
        )}
      </AspectRatio>

      <Stack spacing={1.5} sx={{ p: 2 }}>
        <Stack direction="row" spacing={1.5} justifyContent="space-between">
          <Stack spacing={0.5} sx={{ minWidth: 0 }}>
            <Typography
              level="title-md"
              sx={{
                color: "neutral.900",
                lineHeight: 1.35,
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {bundleTitle}
            </Typography>
            {bundle.sourceLabel && bundle.sourceLabel !== bundleTitle ? (
              <Typography
                level="body-xs"
                sx={{
                  color: "neutral.500",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {bundle.sourceLabel}
              </Typography>
            ) : null}
          </Stack>

          <Box onClick={(event) => event.stopPropagation()}>
            <JoyDropdownMenu>
              <JoyDropdownMenuTrigger
                variant="plain"
                color="neutral"
                size="sm"
                aria-label={`Actions for ${bundleTitle}`}
              >
                <MoreHorizontal size={16} />
              </JoyDropdownMenuTrigger>
              <JoyDropdownMenuContent>
                <JoyDropdownMenuItem
                  startDecorator={<ExternalLink size={16} />}
                  onClick={() => onOpen(bundle)}
                >
                  Open
                </JoyDropdownMenuItem>
                {publishChannel ? (
                  <JoyDropdownMenuItem
                    startDecorator={<Sparkles size={16} />}
                    onClick={() => onPublish(bundle)}
                  >
                    Publish
                  </JoyDropdownMenuItem>
                ) : null}
                <JoyDropdownMenuItem
                  destructive
                  startDecorator={<Trash2 size={16} />}
                  onClick={() => onDelete(bundle)}
                >
                  Delete
                </JoyDropdownMenuItem>
              </JoyDropdownMenuContent>
            </JoyDropdownMenu>
          </Box>
        </Stack>

        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          alignItems="center"
          flexWrap="wrap"
        >
          <Stack direction="row" spacing={0.5} alignItems="center">
            <CalendarDays size={14} />
            <Typography level="body-xs" sx={{ color: "neutral.500" }}>
              {getRelativeDate(bundle.createdAt)}
            </Typography>
          </Stack>

          <Chip
            size="sm"
            variant="soft"
            color={MODE_META[bundle.mode].color}
            sx={{ borderRadius: "999px" }}
          >
            {MODE_META[bundle.mode].label}
          </Chip>

          <Stack direction="row" spacing={0.5} alignItems="center">
            {bundleChannels.map((channelKey) => {
              const meta = CHANNEL_META[channelKey as Channel | "carousel"];
              const ChannelIcon = meta.icon;

              return (
                <Box
                  key={channelKey}
                  title={meta.label}
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: "999px",
                    display: "grid",
                    placeItems: "center",
                    color: "neutral.500",
                    backgroundColor: "background.level1",
                    border: "1px solid",
                    borderColor: "neutral.200",
                    "& .lucide": {
                      width: 14,
                      height: 14,
                    },
                  }}
                >
                  <ChannelIcon />
                </Box>
              );
            })}
          </Stack>
        </Stack>

        <Typography level="body-xs" sx={{ color: approval.color }}>
          {approval.text}
        </Typography>
      </Stack>
    </Card>
  );
}

function BundleCardSkeleton() {
  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        p: 0,
        overflow: "hidden",
        borderColor: "neutral.200",
        boxShadow: "sm",
      }}
    >
      <AspectRatio ratio="16 / 9" sx={{ borderRadius: 0 }}>
        <Skeleton
          variant="rectangular"
          sx={{ width: "100%", height: "100%" }}
        />
      </AspectRatio>

      <Stack spacing={1.5} sx={{ p: 2 }}>
        <Stack direction="row" spacing={1.5} justifyContent="space-between">
          <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
            <Skeleton variant="text" sx={{ width: "72%", height: 24 }} />
            <Skeleton variant="text" sx={{ width: "48%", height: 16 }} />
          </Stack>
          <Skeleton variant="circular" sx={{ width: 28, height: 28 }} />
        </Stack>

        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <Skeleton
            variant="rectangular"
            sx={{ width: 92, height: 24, borderRadius: "999px" }}
          />
          <Skeleton
            variant="rectangular"
            sx={{ width: 76, height: 24, borderRadius: "999px" }}
          />
          <Skeleton
            variant="rectangular"
            sx={{ width: 88, height: 24, borderRadius: "999px" }}
          />
        </Stack>

        <Skeleton variant="text" sx={{ width: "36%", height: 18 }} />
        <Skeleton variant="text" sx={{ width: "94%", height: 18 }} />
      </Stack>
    </Card>
  );
}

export const BundleLibrary = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useQueryParams();
  const { toast } = useToast();
  const { setBundleIds } = useCreateFlow();

  const queryBundleId = params.get("doc_id") || params.get("bundleId");
  const [trackedBundleId, setTrackedBundleId] = useState<string | null>(
    queryBundleId,
  );
  const [highlightedBundles, setHighlightedBundles] = useState<Set<string>>(
    new Set(),
  );
  const [activeGenerationBundleId, setActiveGenerationBundleId] = useState<
    string | null
  >(queryBundleId);
  const [generationSurfaceDismissed, setGenerationSurfaceDismissed] =
    useState(false);
  const [retryDraft, setRetryDraft] = useState<CreateFlowRetryDraft | null>(
    null,
  );
  const [search, setSearch] = useState(params.get("q") || "");
  const [mode, setMode] = useState<ModeTabValue>(
    getInitialMode(params.get("mode")),
  );
  const [channel, setChannel] = useState<ChannelSelectValue>(
    getInitialChannel(params.get("channel")),
  );
  const [sort, setSort] = useState<LibrarySort>(
    getInitialSort(params.get("sort")),
  );
  const [page, setPage] = useState<number>(
    Math.max(1, parseInt(params.get("page") || "1", 10) || 1),
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [bundleToDelete, setBundleToDelete] = useState<ContentSummary | null>(
    null,
  );
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const processedTrackedBundleIdRef = useRef<string | null>(null);
  const debouncedSearch = useDebounce(search, 200);

  useEffect(() => {
    setTrackedBundleId(queryBundleId);
    setActiveGenerationBundleId(queryBundleId);
    setGenerationSurfaceDismissed(false);
  }, [queryBundleId]);

  useEffect(() => {
    const state = location.state as {
      carouselPublishSuccess?: boolean;
      carouselTopicTitle?: string | null;
    } | null;

    if (!state?.carouselPublishSuccess) {
      return;
    }

    toast({
      title: "Carousel published",
      description: state.carouselTopicTitle
        ? `Published ${state.carouselTopicTitle}.`
        : "Your carousel was published successfully.",
    });

    navigate(`${location.pathname}${location.search}`, {
      replace: true,
      state: null,
    });
  }, [location.pathname, location.search, location.state, navigate, toast]);

  const { data, isLoading } = useContentLibrary({
    search: debouncedSearch,
    mode,
    channel,
    page,
    pageSize: PAGE_SIZE,
    sort,
  });

  const countQuery = useContentLibraryCount({
    search: debouncedSearch,
    mode,
    channel,
  });

  const del = useDeleteBundle();
  const items = data?.items || [];
  const filteredCount = countQuery.data ?? data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  const hasActiveFilters =
    Boolean(search.trim()) || mode !== "all" || channel !== "all";

  useEffect(() => {
    if (!isLoading) {
      setHasLoadedOnce(true);
    }
  }, [isLoading]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    if (!trackedBundleId || items.length === 0) {
      if (!trackedBundleId) {
        processedTrackedBundleIdRef.current = null;
      }
      return;
    }

    if (processedTrackedBundleIdRef.current === trackedBundleId) {
      return;
    }

    const matchingBundle = items.find(
      (item) => item.bundleId === trackedBundleId,
    );
    if (!matchingBundle) {
      return;
    }

    processedTrackedBundleIdRef.current = trackedBundleId;
    setActiveGenerationBundleId(null);
    setGenerationSurfaceDismissed(false);
    setHighlightedBundles((previous) => new Set(previous).add(trackedBundleId));

    const timeoutId = window.setTimeout(() => {
      setHighlightedBundles((previous) => {
        const next = new Set(previous);
        next.delete(trackedBundleId);
        return next;
      });

      replaceQueryParams((queryParams) => {
        queryParams.delete("from");
        queryParams.delete("doc_id");
        queryParams.delete("bundleId");
      });
      setTrackedBundleId(null);
    }, 2000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [items, trackedBundleId]);

  const clearGenerationQueryParams = () => {
    replaceQueryParams((queryParams) => {
      queryParams.delete("from");
      queryParams.delete("doc_id");
      queryParams.delete("bundleId");
    });
    setTrackedBundleId(null);
  };

  const queueHighlight = (bundleId: string, clearQueryParam = false) => {
    setHighlightedBundles((previous) => new Set(previous).add(bundleId));

    window.setTimeout(() => {
      setHighlightedBundles((previous) => {
        const next = new Set(previous);
        next.delete(bundleId);
        return next;
      });

      if (clearQueryParam) {
        clearGenerationQueryParams();
      }
    }, 2000);
  };

  const openBundle = (bundle: ContentSummary, snapshotId?: string) => {
    setBundleIds(bundle.bundleId, snapshotId || bundle.snapshotId || null);
    setModalOpen(true);
    window.dispatchEvent(
      new CustomEvent("library_card_open", {
        detail: { bundleId: bundle.bundleId },
      }),
    );
  };

  const openPublishPortal = (bundle: ContentSummary) => {
    const publishChannel = getPublishChannel(bundle);
    if (!publishChannel) {
      return;
    }

    navigate(`/publish?bundleId=${bundle.bundleId}`);
  };

  const handleGenerationDismiss = () => {
    setGenerationSurfaceDismissed(true);
    setActiveGenerationBundleId(null);
    clearGenerationQueryParams();
  };

  const handleGenerationReady = (
    generatedBundleId: string,
    _generatedSnapshotId?: string,
  ) => {
    queueHighlight(generatedBundleId, true);
    setActiveGenerationBundleId(null);
    setGenerationSurfaceDismissed(false);
  };

  const handleGenerationFailed = () => {
    if (generationSurfaceDismissed) {
      setActiveGenerationBundleId(null);
      clearGenerationQueryParams();
    }
  };

  const handleGenerationReview = (
    generatedBundleId: string,
    generatedSnapshotId?: string,
  ) => {
    openBundle(
      {
        bundleId: generatedBundleId,
        snapshotId: generatedSnapshotId,
        mode: "custom",
        channels: [],
        approvedCount: 0,
        totalItems: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      generatedSnapshotId,
    );
    setActiveGenerationBundleId(null);
    setGenerationSurfaceDismissed(false);
    clearGenerationQueryParams();
  };

  const handleGenerationRetry = (draft: CreateFlowRetryDraft | null) => {
    setRetryDraft(draft);
    setCreateDialogOpen(true);
    setActiveGenerationBundleId(null);
    setGenerationSurfaceDismissed(false);
    clearGenerationQueryParams();
  };

  const handleCreateDialogOpenChange = (nextOpen: boolean) => {
    setCreateDialogOpen(nextOpen);
    if (!nextOpen) {
      setRetryDraft(null);
    }
  };

  const handleDelete = async () => {
    if (!bundleToDelete) {
      return;
    }

    try {
      window.dispatchEvent(
        new CustomEvent("library_delete_confirm", {
          detail: { bundleId: bundleToDelete.bundleId },
        }),
      );

      await del.mutateAsync({
        bundleId: bundleToDelete.bundleId,
        deletedAt: new Date().toISOString(),
      });

      toast({
        title: "Content bundle deleted",
        description: "The bundle was removed from your content library.",
      });
      setBundleToDelete(null);
    } catch (error) {
      toast({
        title: "Delete failed",
        description:
          error instanceof Error
            ? error.message
            : "We couldn't delete this content bundle.",
        variant: "destructive",
      });
    }
  };

  const handleResetFilters = () => {
    setSearch("");
    setMode("all");
    setChannel("all");
    setSort("newest");
    setPage(1);
  };

  const countLabel =
    filteredCount === 0
      ? "No results"
      : `${filteredCount} bundle${filteredCount === 1 ? "" : "s"}`;

  return (
    <Stack
      spacing={3}
      sx={{ minHeight: "calc(100vh - 8.5rem)", color: "neutral.900" }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "center" }}
      >
        <Stack spacing={0.5}>
          <Typography level="h3" sx={{ fontWeight: "lg" }}>
            My Content
          </Typography>
          <Typography level="body-sm" sx={{ color: "neutral.500" }}>
            Previously generated posts, newsletters, and more.
          </Typography>
        </Stack>

        <Button
          color="primary"
          startDecorator={<Sparkles size={16} />}
          onClick={() => {
            setRetryDraft(null);
            setCreateDialogOpen(true);
          }}
        >
          Create Content
        </Button>
      </Stack>

      {activeGenerationBundleId ? (
        <ContentLibraryGenerationStatusCard
          bundleId={activeGenerationBundleId}
          hidden={generationSurfaceDismissed}
          onDismiss={handleGenerationDismiss}
          onReview={handleGenerationReview}
          onRetry={handleGenerationRetry}
          onReady={handleGenerationReady}
          onFailed={handleGenerationFailed}
        />
      ) : null}

      <Sheet
        variant="plain"
        sx={{
          p: { xs: 2, md: 2.5 },
          borderRadius: "xl",
          backgroundColor: "background.surface",
          border: "1px solid",
          borderColor: "neutral.200",
          boxShadow: "sm",
        }}
      >
        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", xl: "row" }}
            spacing={1.5}
            justifyContent="space-between"
            alignItems={{ xs: "stretch", xl: "center" }}
          >
            <Tabs
              value={mode}
              onChange={(_event, value) => {
                if (typeof value === "string") {
                  setMode(value as ModeTabValue);
                  setPage(1);
                }
              }}
              sx={{ minWidth: 0 }}
            >
              <TabList
                disableUnderline
                disableIndicator
                sx={{
                  gap: 0.5,
                  p: 0.5,
                  borderRadius: "xl",
                  bgcolor: "background.level1",
                  alignSelf: "flex-start",
                  flexWrap: "wrap",
                }}
              >
                {MODE_OPTIONS.map((option) => (
                  <Tab
                    key={option.value}
                    value={option.value}
                    sx={{
                      minHeight: 34,
                      px: 1.75,
                      borderRadius: "lg",
                      fontWeight: 600,
                      color: "neutral.500",
                      transition:
                        "background-color 160ms ease, box-shadow 160ms ease, color 160ms ease",
                      '&[aria-selected="true"]': {
                        color: "neutral.900",
                        bgcolor: "background.surface",
                        boxShadow: "sm",
                      },
                    }}
                  >
                    {option.label}
                  </Tab>
                ))}
              </TabList>
            </Tabs>

            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1}
              useFlexGap
              alignItems={{ xs: "stretch", md: "center" }}
              sx={{ width: { xs: "100%", xl: "auto" } }}
            >
              <Select<ChannelSelectValue>
                value={channel}
                size="sm"
                variant="outlined"
                onChange={(_event, value) => {
                  if (value) {
                    setChannel(value);
                    setPage(1);
                  }
                }}
                sx={{ minWidth: { xs: "100%", md: 160 } }}
              >
                {CHANNEL_OPTIONS.map((option) => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Select>

              <Select<LibrarySort>
                value={sort}
                size="sm"
                variant="outlined"
                onChange={(_event, value) => {
                  if (value) {
                    setSort(value);
                    setPage(1);
                  }
                }}
                sx={{ minWidth: { xs: "100%", md: 160 } }}
              >
                {SORT_OPTIONS.map((option) => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Select>

              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                startDecorator={<Search size={16} />}
                placeholder="Search by title or topic"
                variant="outlined"
                size="sm"
                sx={{ width: { xs: "100%", md: 260 } }}
              />
            </Stack>
          </Stack>

          <Typography level="body-sm" sx={{ color: "neutral.500" }}>
            {countLabel}
          </Typography>
        </Stack>
      </Sheet>

      <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {isLoading || !hasLoadedOnce ? (
          <Box
            role="status"
            aria-live="polite"
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns:
                "repeat(auto-fill, minmax(min(100%, 300px), 1fr))",
              alignItems: "stretch",
            }}
          >
            {Array.from({ length: 6 }).map((_, index) => (
              <BundleCardSkeleton key={`bundle-skeleton-${index}`} />
            ))}
          </Box>
        ) : items.length === 0 && !activeGenerationBundleId ? (
          <Box
            sx={{
              minHeight: "calc(100vh - 21rem)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Stack
              spacing={3}
              alignItems="center"
              sx={{ maxWidth: 520, textAlign: "center" }}
            >
              <Box
                sx={{
                  width: 84,
                  height: 84,
                  borderRadius: "24px",
                  display: "grid",
                  placeItems: "center",
                  color: "neutral.400",
                  background:
                    "linear-gradient(135deg, rgba(var(--joy-palette-neutral-mainChannel) / 0.06), rgba(var(--joy-palette-primary-mainChannel) / 0.09))",
                  border: "1px solid",
                  borderColor: "neutral.200",
                  boxShadow: "sm",
                  "& .lucide": {
                    width: 48,
                    height: 48,
                  },
                }}
              >
                {hasActiveFilters ? <Search /> : <FileStack />}
              </Box>

              <Stack spacing={1.25}>
                <Typography level="title-lg">
                  {hasActiveFilters
                    ? "No bundles match these filters"
                    : "Your content library is empty"}
                </Typography>
                <Typography level="body-md" sx={{ color: "neutral.500" }}>
                  {hasActiveFilters
                    ? "Try adjusting your search or filter selections to find a content bundle."
                    : "Create your first AI-generated content — posts, newsletters, and more — in seconds."}
                </Typography>
              </Stack>

              <Button
                color="primary"
                size="lg"
                startDecorator={
                  hasActiveFilters ? undefined : <Sparkles size={18} />
                }
                onClick={() => {
                  if (hasActiveFilters) {
                    handleResetFilters();
                    return;
                  }

                  setRetryDraft(null);
                  setCreateDialogOpen(true);
                }}
              >
                {hasActiveFilters
                  ? "Reset filters"
                  : "Create your first content"}
              </Button>
            </Stack>
          </Box>
        ) : (
          <Stack spacing={2.5} sx={{ flex: 1 }}>
            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns:
                  "repeat(auto-fill, minmax(min(100%, 300px), 1fr))",
                alignItems: "stretch",
              }}
            >
              {items.map((bundle) => (
                <BundleCard
                  key={bundle.bundleId}
                  bundle={bundle}
                  isHighlighted={highlightedBundles.has(bundle.bundleId)}
                  onOpen={(selectedBundle) => openBundle(selectedBundle)}
                  onPublish={openPublishPortal}
                  onDelete={setBundleToDelete}
                />
              ))}
            </Box>

            {filteredCount > PAGE_SIZE ? (
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                justifyContent="space-between"
                alignItems={{ xs: "stretch", sm: "center" }}
              >
                <Typography level="body-sm" sx={{ color: "neutral.500" }}>
                  Page {page} of {totalPages}
                </Typography>

                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button
                    variant="outlined"
                    size="sm"
                    disabled={page === 1}
                    onClick={() =>
                      setPage((currentPage) => Math.max(1, currentPage - 1))
                    }
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outlined"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((currentPage) => currentPage + 1)}
                  >
                    Next
                  </Button>
                </Stack>
              </Stack>
            ) : null}
          </Stack>
        )}
      </Box>

      <GeneratedContentModal open={modalOpen} onOpenChange={setModalOpen} />
      <CreateFlowDialog
        open={createDialogOpen}
        onOpenChange={handleCreateDialogOpenChange}
        initialDraft={retryDraft}
      />

      <Modal
        open={Boolean(bundleToDelete)}
        onClose={() => setBundleToDelete(null)}
      >
        <ModalDialog
          aria-modal="true"
          variant="outlined"
          color="danger"
          sx={{ maxWidth: 480 }}
        >
          <DialogTitle>Delete this content bundle?</DialogTitle>
          <DialogContent>
            This will permanently remove all generated posts, newsletters, and
            images in this bundle. This action cannot be undone.
          </DialogContent>
          <DialogActions>
            <Button
              variant="plain"
              color="neutral"
              onClick={() => setBundleToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              color="danger"
              loading={del.isPending}
              onClick={() => {
                void handleDelete();
              }}
            >
              Delete
            </Button>
          </DialogActions>
        </ModalDialog>
      </Modal>
    </Stack>
  );
};
