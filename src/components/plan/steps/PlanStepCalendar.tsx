import React, { useCallback, useEffect, useMemo, useState } from "react";
import Alert from "@mui/joy/Alert";
import AspectRatio from "@mui/joy/AspectRatio";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import CircularProgress from "@mui/joy/CircularProgress";
import Divider from "@mui/joy/Divider";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import LinearProgress from "@mui/joy/LinearProgress";
import Link from "@mui/joy/Link";
import Modal from "@mui/joy/Modal";
import ModalClose from "@mui/joy/ModalClose";
import ModalDialog from "@mui/joy/ModalDialog";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Snackbar from "@mui/joy/Snackbar";
import Stack from "@mui/joy/Stack";
import Switch from "@mui/joy/Switch";
import Textarea from "@mui/joy/Textarea";
import Typography from "@mui/joy/Typography";
import {
  AlertTriangle,
  Check,
  Clock,
  Eye,
  Facebook,
  FileText,
  Heart,
  ImagePlus,
  Instagram,
  Mail,
  MessageCircle,
  MessageSquare,
  Pencil,
  RefreshCw,
  Send,
  Share2,
  Store,
  Tags,
  ThumbsUp,
  type LucideIcon,
} from "lucide-react";
import { format } from "date-fns";
import { parseMonthParam } from "@/utils/dateUtils";
import { usePlanWizard } from "../PlanWizardContext";
import { PlanItem } from "../constants";
import { generateMultiThemeSeasonalPlanContent } from "@/services/seasonalPlanGenerator";
import {
  MediaSelectorImage,
  type MediaSelectorImageHandle,
} from "@/components/crm/MediaSelectorImage";
import { supabase } from "@/integrations/supabase/client";
import { SocialPostPreviewModal } from "@/components/publish/preview/SocialPostPreviewModal";
import { MergeTagsPreviewDialog } from "@/components/crm/MergeTagsPreviewDialog";
import { BlogContentViewer } from "../BlogContentViewer";
import { searchGalleryForPost } from "@/services/imageGallerySearch";
import { resolveImage } from "@/services/imageResolutionService";
import { resolveTenantMutationContext } from "@/utils/resolveTenantMutationContext";

interface PlanStepCalendarProps {
  onNext: () => void;
  onBack: () => void;
}

type ImageEligibleType = Extract<
  PlanItem["type"],
  "email" | "blog" | "facebook" | "instagram"
>;

type ImageEligiblePlanItem = PlanItem & { type: ImageEligibleType };
type ImageResolutionPhase = "searching" | "generating";
type PreviewPlatform = "instagram" | "facebook";

interface FeaturedImageState {
  url: string;
  metadata: NonNullable<PlanItem["imageMetadata"]>;
}

interface FeaturedImageResponse {
  imageUrl?: string;
  globalImageId?: string;
  metadata?: { tags?: string[] };
}

interface GeneratedPlanItemImage {
  itemId: string;
  imageUrl: string;
  imageMetadata: NonNullable<PlanItem["imageMetadata"]>;
}

interface ImageNoticeState {
  message: string;
  retryFeatured?: boolean;
  retryItems?: PlanItem[];
}

const CHANNEL_CONFIG: Record<
  PlanItem["type"],
  { icon: LucideIcon; label: string; previewPlatform?: PreviewPlatform }
> = {
  email: { icon: Mail, label: "Email" },
  sms: { icon: MessageSquare, label: "SMS" },
  facebook: { icon: Facebook, label: "Facebook", previewPlatform: "facebook" },
  instagram: {
    icon: Instagram,
    label: "Instagram",
    previewPlatform: "instagram",
  },
  blog: { icon: FileText, label: "Blog" },
};

const IMAGE_CHANNEL_MAP: Record<
  ImageEligibleType,
  "newsletter" | "blog" | "facebook" | "instagram"
> = {
  email: "newsletter",
  blog: "blog",
  facebook: "facebook",
  instagram: "instagram",
};

const IMAGE_GENERATION_BATCH_SIZE = 6;
const EDITABLE_CARD_TYPES = ["email", "sms", "facebook", "instagram", "blog"];

const getWeekLabel = (weekNum: number, month: string) => {
  const monthName = month ? format(parseMonthParam(month), "MMMM") : "";

  switch (weekNum) {
    case 1:
      return `Early ${monthName}`;
    case 2:
      return `Mid ${monthName}`;
    case 3:
      return `Late ${monthName}`;
    case 4:
      return `End ${monthName}`;
    default:
      return `Week ${weekNum}`;
  }
};

const isImageEligiblePlanItem = (
  item: PlanItem,
): item is ImageEligiblePlanItem =>
  item.type === "facebook" ||
  item.type === "instagram" ||
  item.type === "blog" ||
  item.type === "email";

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

const toDate = (date: Date | string) =>
  date instanceof Date ? date : new Date(date);

const parseDateInput = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const stripMarkup = (value: string) =>
  value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getDisplayContent = (item: PlanItem) => {
  if (item.type === "blog") {
    return (
      item.enhancedContent?.summary ||
      item.enhancedContent?.fullContent ||
      item.caption
    );
  }

  if (item.type === "email") {
    return stripMarkup(item.caption);
  }

  return item.caption;
};

const getBlogFullContent = (item: PlanItem) =>
  item.enhancedContent?.fullContent || item.caption;

const getBlogPreviewText = (item: PlanItem) =>
  stripMarkup(item.enhancedContent?.summary || getBlogFullContent(item));

const getBlogReadingTime = (item: PlanItem) => {
  if (item.enhancedContent?.readingTime) {
    return item.enhancedContent.readingTime;
  }

  const wordCount = getBlogFullContent(item)
    .split(/\s+/)
    .filter(Boolean).length;
  return `${Math.max(1, Math.ceil(wordCount / 200))} min read`;
};

const getSmsSegments = (message: string) =>
  Math.max(1, Math.ceil(message.length / 160));

const channelPreviewImageOverlay =
  "linear-gradient(to top, rgb(var(--joy-palette-common-blackChannel, 0 0 0) / 0.70) 0%, rgb(var(--joy-palette-common-blackChannel, 0 0 0) / 0.30) 40%, transparent 100%)";

const blogPreviewImageOverlay =
  "linear-gradient(to top, rgb(var(--joy-palette-common-blackChannel, 0 0 0) / 0.60) 0%, transparent 60%)";

const getImageSelectorContentType = (
  item: PlanItem,
): "facebook" | "instagram" | "blog" | undefined =>
  item.type === "facebook" || item.type === "instagram" || item.type === "blog"
    ? item.type
    : undefined;

const normalizeStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : undefined;

const normalizeImageMetadata = (
  metadata?: Record<string, unknown>,
): PlanItem["imageMetadata"] | undefined => {
  if (!metadata) return undefined;

  return {
    alt: typeof metadata.alt === "string" ? metadata.alt : undefined,
    photographer:
      typeof metadata.photographer === "string"
        ? metadata.photographer
        : undefined,
    photographer_url:
      typeof metadata.photographer_url === "string"
        ? metadata.photographer_url
        : undefined,
    source: typeof metadata.source === "string" ? metadata.source : undefined,
    unsplash_id:
      typeof metadata.unsplash_id === "string"
        ? metadata.unsplash_id
        : undefined,
    enhanced_query:
      typeof metadata.enhanced_query === "string"
        ? metadata.enhanced_query
        : undefined,
    globalImageId:
      typeof metadata.globalImageId === "string"
        ? metadata.globalImageId
        : undefined,
    tags: normalizeStringArray(metadata.tags),
    storagePath:
      typeof metadata.storagePath === "string"
        ? metadata.storagePath
        : undefined,
    generationTime:
      typeof metadata.generationTime === "number"
        ? metadata.generationTime
        : undefined,
    matchedTags: normalizeStringArray(metadata.matchedTags),
    matchScore:
      typeof metadata.matchScore === "number" ? metadata.matchScore : undefined,
  };
};

const preparePlanItemForImageGeneration = (item: PlanItem): PlanItem => {
  if (!isImageEligiblePlanItem(item)) {
    return item;
  }

  if (item.imageUrl) {
    return {
      ...item,
      imageGenerationStatus: "completed",
      imageError: null,
    };
  }

  return {
    ...item,
    imageGenerationStatus:
      item.imageGenerationStatus === "failed" ? "failed" : "pending",
    imageError: item.imageError ?? null,
  };
};

const getPlanItemImagePrompt = (
  item: Pick<PlanItem, "imageQuery" | "imageIdea" | "caption" | "title">,
) => {
  const candidates = [
    item.imageQuery,
    item.imageIdea,
    item.caption,
    item.title,
  ];

  for (const candidate of candidates) {
    if (candidate?.trim()) {
      return candidate.trim();
    }
  }

  return "seasonal garden content";
};

const buildGeneratedPlanItemImage = (
  item: ImageEligiblePlanItem,
  result: Awaited<ReturnType<typeof resolveImage>>,
): GeneratedPlanItemImage => {
  const contentTitle = item.title?.trim() || getPlanItemImagePrompt(item);

  return {
    itemId: item.id,
    imageUrl: result.imageUrl,
    imageMetadata: {
      alt: contentTitle,
      source: result.source,
      globalImageId: result.globalImageId,
      generationTime: result.generationTime,
      tags: result.tags ?? result.matchedTags ?? [],
      storagePath: result.storagePath,
      matchedTags: result.matchedTags,
      matchScore: result.matchScore,
    },
  };
};

const generatePlanItemImage = async (
  item: ImageEligiblePlanItem,
  context: { tenantId: string; userId: string },
  options?: { forceGenerate?: boolean },
): Promise<GeneratedPlanItemImage> => {
  const result = await resolveImage({
    channel: IMAGE_CHANNEL_MAP[item.type],
    contentTitle: item.title?.trim() || "",
    forceGenerate: options?.forceGenerate,
    imageQuery: getPlanItemImagePrompt(item),
    tenantId: context.tenantId,
    userId: context.userId,
  });

  return buildGeneratedPlanItemImage(item, result);
};

const GenerationSkeletonCard = () => (
  <Card variant="outlined" sx={{ minHeight: 228, overflow: "hidden", p: 2.5 }}>
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" spacing={2}>
        <Stack direction="row" spacing={1} sx={{ flex: 1 }}>
          <Skeleton height={28} variant="rectangular" width={86} />
          <Skeleton height={28} variant="rectangular" width={104} />
        </Stack>
        <Skeleton height={28} variant="rectangular" width={92} />
      </Stack>
      <Stack spacing={0.75}>
        <Skeleton level="title-sm" variant="text" width="64%" />
        <Skeleton level="body-sm" variant="text" width="100%" />
        <Skeleton level="body-sm" variant="text" width="92%" />
        <Skeleton level="body-sm" variant="text" width="70%" />
      </Stack>
      <Skeleton height={92} variant="rectangular" />
    </Stack>
  </Card>
);

const GenerationState = ({
  error,
  monthName,
  onRetry,
  progress,
}: {
  error: string | null;
  monthName: string;
  onRetry: () => void;
  progress: number;
}) => (
  <Stack spacing={2.5}>
    <Card variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack spacing={2}>
        <Stack spacing={0.75}>
          <Typography level="h3">Generating Your Content Calendar</Typography>
          <Typography color="neutral" level="body-md">
            AI is creating a multi-channel plan for{" "}
            {monthName || "your selected month"}.
          </Typography>
        </Stack>
        {error ? (
          <Alert
            color="danger"
            endDecorator={
              <Button color="danger" onClick={onRetry} size="sm" variant="soft">
                Retry
              </Button>
            }
            startDecorator={<AlertTriangle aria-hidden="true" size={18} />}
            variant="soft"
          >
            {error}
          </Alert>
        ) : (
          <Stack spacing={0.75}>
            <Stack direction="row" justifyContent="space-between">
              <Typography color="neutral" level="body-xs">
                Building content plan
              </Typography>
              <Typography color="neutral" level="body-xs">
                {Math.round(progress)}%
              </Typography>
            </Stack>
            <LinearProgress determinate value={progress} />
          </Stack>
        )}
      </Stack>
    </Card>

    {!error && (
      <Stack spacing={2}>
        {Array.from({ length: 4 }).map((_, index) => (
          <GenerationSkeletonCard key={index} />
        ))}
      </Stack>
    )}
  </Stack>
);

const ImageProgressModal = ({
  open,
  progress,
}: {
  open: boolean;
  progress: { phase: ImageResolutionPhase; completed: number; total: number };
}) => {
  const progressValue = progress.total
    ? (progress.completed / progress.total) * 100
    : 0;

  return (
    <Modal open={open}>
      <ModalDialog sx={{ maxWidth: 440, width: "calc(100% - 32px)", p: 3 }}>
        <Stack spacing={2.25}>
          <Stack spacing={0.75}>
            <Typography level="title-lg">
              {progress.phase === "searching"
                ? "Searching Image Library"
                : "Generating New Images"}
            </Typography>
            <Typography color="neutral" level="body-sm">
              {progress.phase === "searching"
                ? "Checking your tagged gallery before creating new visuals."
                : "Creating AI images for content that still needs visuals."}
            </Typography>
          </Stack>

          <Stack spacing={0.75}>
            <Stack direction="row" justifyContent="space-between">
              <Typography color="neutral" level="body-sm">
                Progress
              </Typography>
              <Typography level="body-sm">
                {progress.completed} / {progress.total}
              </Typography>
            </Stack>
            <LinearProgress determinate value={progressValue} />
          </Stack>
        </Stack>
      </ModalDialog>
    </Modal>
  );
};

const ImageStatusChip = ({
  isRetrying,
  item,
}: {
  isRetrying: boolean;
  item: PlanItem;
}) => {
  if (!isImageEligiblePlanItem(item)) {
    return (
      <Chip color="neutral" size="sm" variant="soft">
        No image required
      </Chip>
    );
  }

  if (item.imageUrl) {
    return (
      <Chip
        color="success"
        size="sm"
        startDecorator={<Check aria-hidden="true" size={14} />}
        variant="soft"
      >
        Image selected
      </Chip>
    );
  }

  if (item.imageGenerationStatus === "generating" || isRetrying) {
    return (
      <Chip
        color="neutral"
        size="sm"
        startDecorator={<CircularProgress size="sm" />}
        variant="soft"
      >
        Generating...
      </Chip>
    );
  }

  if (item.imageGenerationStatus === "failed") {
    return (
      <Chip color="danger" size="sm" variant="soft">
        Image failed
      </Chip>
    );
  }

  return (
    <Chip color="warning" size="sm" variant="soft">
      Image needed
    </Chip>
  );
};

const DecorativeEngagementBar = ({
  actions,
}: {
  actions: { icon: LucideIcon; label: string }[];
}) => (
  <Box
    sx={{
      display: "flex",
      gap: { xs: 1.5, sm: 2 },
      flexWrap: "wrap",
      px: 2,
      py: 1.5,
      borderTop: "1px solid",
      borderColor: "neutral.200",
    }}
  >
    {actions.map(({ icon: Icon, label }) => (
      <Stack alignItems="center" direction="row" key={label} spacing={0.75}>
        <Icon aria-hidden="true" color="currentColor" size={15} />
        <Typography level="body-xs" sx={{ color: "neutral.400" }}>
          {label}
        </Typography>
      </Stack>
    ))}
  </Box>
);

const PreviewImageFrame = ({
  disabled = false,
  item,
  onClick,
  overlayGradient,
  ratio,
}: {
  disabled?: boolean;
  item: PlanItem;
  onClick?: () => void;
  overlayGradient?: string;
  ratio: string;
}) => {
  const isGenerating = item.imageGenerationStatus === "generating";
  const isClickable = Boolean(onClick) && !disabled;

  return (
    <AspectRatio
      ratio={ratio}
      onClick={isClickable ? onClick : undefined}
      sx={{
        bgcolor: "neutral.100",
        cursor: isClickable ? "pointer" : "default",
        overflow: "hidden",
      }}
    >
      {isGenerating ? (
        <Box sx={{ width: "100%", height: "100%", position: "relative" }}>
          <Skeleton animation="wave" variant="overlay">
            <Box sx={{ width: "100%", height: "100%" }} />
          </Skeleton>
          <Stack
            alignItems="center"
            justifyContent="center"
            sx={{ inset: 0, position: "absolute" }}
          >
            <CircularProgress size="sm" />
          </Stack>
        </Box>
      ) : item.imageUrl ? (
        <Box sx={{ width: "100%", height: "100%", position: "relative" }}>
          <Box
            alt={item.title}
            component="img"
            src={item.imageUrl}
            sx={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transition: "transform 180ms ease",
              ...(isClickable
                ? {
                    "&:hover": {
                      transform: "scale(1.01)",
                    },
                  }
                : undefined),
            }}
          />
          {overlayGradient ? (
            <Box
              sx={{
                background: overlayGradient,
                inset: 0,
                pointerEvents: "none",
                position: "absolute",
              }}
            />
          ) : null}
        </Box>
      ) : (
        <Sheet
          variant="plain"
          sx={{
            width: "100%",
            height: "100%",
            bgcolor: "neutral.100",
            color: "neutral.400",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Stack alignItems="center" spacing={1} sx={{ px: 2 }}>
            <ImagePlus aria-hidden="true" size={32} />
            <Typography level="body-xs" sx={{ color: "neutral.400" }}>
              Click to add image
            </Typography>
          </Stack>
        </Sheet>
      )}
    </AspectRatio>
  );
};

const MergeTagsButton = ({
  item,
  onUpdate,
}: {
  item: PlanItem;
  onUpdate: <K extends keyof PlanItem>(
    id: string,
    field: K,
    value: PlanItem[K],
  ) => void;
}) => (
  <MergeTagsPreviewDialog
    emailContent={{
      subject: item.emailSubject,
      preheader: item.emailPreheader,
      body: item.caption,
    }}
    onMergeComplete={(content, field) => {
      if (field === "subject") {
        onUpdate(item.id, "emailSubject", content);
        return;
      }

      if (field === "preheader") {
        onUpdate(item.id, "emailPreheader", content);
        return;
      }

      onUpdate(item.id, "caption", content);
    }}
  >
    <Button
      color="neutral"
      size="sm"
      startDecorator={<Tags aria-hidden="true" size={15} />}
      variant="plain"
    >
      Merge Tags
    </Button>
  </MergeTagsPreviewDialog>
);

const DateEditor = ({
  item,
  onUpdate,
}: {
  item: PlanItem;
  onUpdate: <K extends keyof PlanItem>(
    id: string,
    field: K,
    value: PlanItem[K],
  ) => void;
}) => (
  <FormControl>
    <FormLabel>Date</FormLabel>
    <Input
      type="date"
      value={format(toDate(item.date), "yyyy-MM-dd")}
      onChange={(event) =>
        onUpdate(item.id, "date", parseDateInput(event.target.value))
      }
      sx={{ maxWidth: 240 }}
    />
  </FormControl>
);

const PlanContentCard = ({
  editing,
  featuredImage,
  isRetryingImage,
  item,
  onApplyFeaturedImage,
  onCloseEdit,
  onImageSelect,
  onOpenBlog,
  onOpenPreview,
  onRetryImage,
  onToggleEdit,
  onToggleEnabled,
  onUpdate,
}: {
  editing: boolean;
  featuredImage: FeaturedImageState | null;
  isRetryingImage: boolean;
  item: PlanItem;
  onApplyFeaturedImage: (itemId: string) => void;
  onCloseEdit: () => void;
  onImageSelect: (
    itemId: string,
    imageUrl: string,
    metadata?: Record<string, unknown>,
  ) => void;
  onOpenBlog: (item: PlanItem) => void;
  onOpenPreview: (item: PlanItem, platform: PreviewPlatform) => void;
  onRetryImage: (item: PlanItem) => void;
  onToggleEdit: (itemId: string) => void;
  onToggleEnabled: (item: PlanItem) => void;
  onUpdate: <K extends keyof PlanItem>(
    id: string,
    field: K,
    value: PlanItem[K],
  ) => void;
}) => {
  const config = CHANNEL_CONFIG[item.type];
  const TypeIcon = config.icon;
  const isDisabled = !item.enabled;
  const canShowSocialPreview =
    item.type === "facebook" || item.type === "instagram";
  const canShowImageEditor = isImageEligiblePlanItem(item);
  const contentLength = stripMarkup(getBlogFullContent(item)).length;
  const imageSelectorRef = React.useRef<MediaSelectorImageHandle | null>(null);
  const blogPreviewText = getBlogPreviewText(item);
  const emailBodyPreview = stripMarkup(item.caption);
  const instagramCaption = [item.caption, item.hashtags]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" ");

  const handleOpenImageSelector = useCallback(() => {
    if (!canShowImageEditor || isDisabled) {
      return;
    }

    imageSelectorRef.current?.openDialog();
  }, [canShowImageEditor, isDisabled]);

  const renderActionControls = () => (
    <Stack
      alignItems="center"
      direction="row"
      spacing={0.75}
      sx={{
        flexWrap: "wrap",
        justifyContent: { xs: "flex-start", sm: "flex-end" },
      }}
      useFlexGap
    >
      <Chip
        color="neutral"
        size="sm"
        startDecorator={<TypeIcon aria-hidden="true" size={14} />}
        variant="soft"
      >
        {config.label}
      </Chip>
      {item.themeName && (
        <Chip color="neutral" size="sm" variant="soft">
          {item.themeName}
        </Chip>
      )}
      <IconButton
        aria-label={`Edit ${item.title}`}
        color="neutral"
        disabled={isDisabled || !EDITABLE_CARD_TYPES.includes(item.type)}
        onClick={() => onToggleEdit(item.id)}
        size="sm"
        variant="plain"
      >
        <Pencil size={16} />
      </IconButton>
      <Switch
        checked={item.enabled}
        color={item.enabled ? "success" : "neutral"}
        onChange={() => onToggleEnabled(item)}
        size="sm"
      />
    </Stack>
  );

  const renderPreviewCard = () => {
    if (item.type === "facebook") {
      return (
        <Stack spacing={0}>
          <Box sx={{ p: 2 }}>
            <Stack
              alignItems={{ xs: "flex-start", sm: "center" }}
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              spacing={1.5}
            >
              <Stack alignItems="center" direction="row" spacing={1.5}>
                <Avatar color="neutral" size="sm" variant="soft">
                  <Store aria-hidden="true" size={14} />
                </Avatar>
                <Stack spacing={0.25}>
                  <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                    Storefront
                  </Typography>
                  <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                    {format(toDate(item.date), "MMM d, yyyy")}
                  </Typography>
                </Stack>
              </Stack>
              {renderActionControls()}
            </Stack>
          </Box>

          <PreviewImageFrame
            disabled={isDisabled}
            item={item}
            onClick={handleOpenImageSelector}
            ratio="16/9"
          />

          <Box sx={{ p: 2 }}>
            <Stack spacing={0.75}>
              <Typography level="title-sm" sx={{ fontWeight: 600 }}>
                {item.title}
              </Typography>
              <Typography
                level="body-sm"
                sx={{
                  color: "text.secondary",
                  display: "-webkit-box",
                  overflow: "hidden",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 3,
                }}
              >
                {item.caption}
              </Typography>
            </Stack>
          </Box>

          <DecorativeEngagementBar
            actions={[
              { icon: ThumbsUp, label: "Like" },
              { icon: MessageCircle, label: "Comment" },
              { icon: Share2, label: "Share" },
            ]}
          />
        </Stack>
      );
    }

    if (item.type === "instagram") {
      return (
        <Stack spacing={0}>
          <Box sx={{ p: 2 }}>
            <Stack
              alignItems={{ xs: "flex-start", sm: "center" }}
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              spacing={1.5}
            >
              <Stack alignItems="center" direction="row" spacing={1.5}>
                <Avatar color="neutral" size="sm" variant="soft">
                  <Store aria-hidden="true" size={14} />
                </Avatar>
                <Stack spacing={0.25}>
                  <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                    Storefront
                  </Typography>
                  <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                    {format(toDate(item.date), "MMM d, yyyy")}
                  </Typography>
                </Stack>
              </Stack>
              {renderActionControls()}
            </Stack>
          </Box>

          <PreviewImageFrame
            disabled={isDisabled}
            item={item}
            onClick={handleOpenImageSelector}
            ratio="1/1"
          />

          <Box sx={{ p: 2 }}>
            <Stack spacing={0.75}>
              <Typography level="title-sm" sx={{ fontWeight: 600 }}>
                {item.title}
              </Typography>
              <Typography
                level="body-sm"
                sx={{
                  color: "text.secondary",
                  display: "-webkit-box",
                  overflow: "hidden",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 2,
                }}
              >
                {instagramCaption || item.caption}
              </Typography>
            </Stack>
          </Box>

          <DecorativeEngagementBar
            actions={[
              { icon: Heart, label: "Like" },
              { icon: MessageCircle, label: "Comment" },
              { icon: Send, label: "Share" },
            ]}
          />
        </Stack>
      );
    }

    if (item.type === "email") {
      return (
        <Stack spacing={0}>
          <Box
            sx={{
              p: 2,
              bgcolor: "neutral.50",
              borderBottom: "1px solid",
              borderColor: "neutral.200",
            }}
          >
            <Stack
              alignItems={{ xs: "flex-start", sm: "center" }}
              direction={{ xs: "column", sm: "row" }}
              justifyContent="space-between"
              spacing={1.5}
            >
              <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                <Stack alignItems="baseline" direction="row" spacing={0.75}>
                  <Typography level="body-xs" sx={{ fontWeight: 600 }}>
                    Subject:
                  </Typography>
                  <Typography level="body-sm" sx={{ minWidth: 0 }}>
                    {item.emailSubject || item.title}
                  </Typography>
                </Stack>
                <Stack alignItems="baseline" direction="row" spacing={0.75}>
                  <Typography level="body-xs" sx={{ fontWeight: 600 }}>
                    Preheader:
                  </Typography>
                  <Typography
                    level="body-xs"
                    sx={{ color: "neutral.500", fontStyle: "italic" }}
                  >
                    {item.emailPreheader || "No preheader yet"}
                  </Typography>
                </Stack>
                <Typography level="body-xs" sx={{ color: "neutral.400" }}>
                  {format(toDate(item.date), "MMM d, yyyy")}
                </Typography>
              </Stack>
              {renderActionControls()}
            </Stack>
          </Box>

          <PreviewImageFrame
            disabled={isDisabled}
            item={item}
            onClick={handleOpenImageSelector}
            ratio="16/9"
          />

          <Box sx={{ p: 2 }}>
            <Stack spacing={1.25}>
              <Typography level="title-sm" sx={{ fontWeight: 600 }}>
                {item.title}
              </Typography>
              <Typography
                level="body-sm"
                sx={{
                  color: "text.secondary",
                  display: "-webkit-box",
                  overflow: "hidden",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 4,
                }}
              >
                {emailBodyPreview}
              </Typography>
              <ImageStatusChip isRetrying={isRetryingImage} item={item} />
            </Stack>
          </Box>
        </Stack>
      );
    }

    if (item.type === "blog") {
      return (
        <Stack spacing={0}>
          <PreviewImageFrame
            disabled={isDisabled}
            item={item}
            onClick={handleOpenImageSelector}
            overlayGradient={blogPreviewImageOverlay}
            ratio="2.5/1"
          />

          <Box sx={{ p: 2 }}>
            <Stack spacing={1.25}>
              <Stack
                alignItems={{ xs: "flex-start", sm: "center" }}
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                spacing={1.5}
              >
                <Stack
                  alignItems="center"
                  direction="row"
                  spacing={1}
                  sx={{ flexWrap: "wrap" }}
                  useFlexGap
                >
                  <Chip
                    color="neutral"
                    size="sm"
                    startDecorator={<FileText aria-hidden="true" size={14} />}
                    variant="soft"
                  >
                    Blog
                  </Chip>
                  {item.themeName && (
                    <Chip color="neutral" size="sm" variant="soft">
                      {item.themeName}
                    </Chip>
                  )}
                  <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                    {format(toDate(item.date), "MMM d, yyyy")}
                  </Typography>
                </Stack>
                <Stack alignItems="center" direction="row" spacing={0.75}>
                  <IconButton
                    aria-label={`Edit ${item.title}`}
                    color="neutral"
                    disabled={isDisabled}
                    onClick={() => onToggleEdit(item.id)}
                    size="sm"
                    variant="plain"
                  >
                    <Pencil size={16} />
                  </IconButton>
                  <Switch
                    checked={item.enabled}
                    color={item.enabled ? "success" : "neutral"}
                    onChange={() => onToggleEnabled(item)}
                    size="sm"
                  />
                </Stack>
              </Stack>

              <Typography level="title-md" sx={{ fontWeight: 700 }}>
                {item.title}
              </Typography>
              <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                {getBlogReadingTime(item)} · {contentLength} characters
              </Typography>
              <Typography
                level="body-sm"
                sx={{
                  color: "text.secondary",
                  display: "-webkit-box",
                  overflow: "hidden",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 3,
                }}
              >
                {blogPreviewText}
              </Typography>
              <Link
                component="button"
                level="body-xs"
                onClick={() => onOpenBlog(item)}
                type="button"
              >
                Click to see more
              </Link>
            </Stack>
          </Box>
        </Stack>
      );
    }

    const segmentCount = getSmsSegments(item.caption);

    return (
      <Stack spacing={0}>
        <Box sx={{ p: 2 }}>
          <Stack
            alignItems={{ xs: "flex-start", sm: "center" }}
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            spacing={1.5}
          >
            <Stack
              alignItems="center"
              direction="row"
              spacing={1}
              sx={{ flexWrap: "wrap" }}
              useFlexGap
            >
              <Chip
                color="neutral"
                size="sm"
                startDecorator={<MessageSquare aria-hidden="true" size={14} />}
                variant="soft"
              >
                SMS
              </Chip>
              {item.themeName && (
                <Chip color="neutral" size="sm" variant="soft">
                  {item.themeName}
                </Chip>
              )}
              <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                {format(toDate(item.date), "MMM d, yyyy")}
              </Typography>
            </Stack>
            <Stack alignItems="center" direction="row" spacing={0.75}>
              <IconButton
                aria-label={`Edit ${item.title}`}
                color="neutral"
                disabled={isDisabled}
                onClick={() => onToggleEdit(item.id)}
                size="sm"
                variant="plain"
              >
                <Pencil size={16} />
              </IconButton>
              <Switch
                checked={item.enabled}
                color={item.enabled ? "success" : "neutral"}
                onChange={() => onToggleEnabled(item)}
                size="sm"
              />
            </Stack>
          </Stack>
        </Box>

        <Box sx={{ p: 2, pt: 0 }}>
          <Box sx={{ bgcolor: "neutral.50", borderRadius: "xl", p: 2 }}>
            <Stack spacing={1.25}>
              <Sheet
                sx={{
                  bgcolor: "background.surface",
                  borderRadius: "lg",
                  boxShadow: "xs",
                  maxWidth: "85%",
                  p: 1.5,
                }}
              >
                <Typography level="body-sm" sx={{ whiteSpace: "pre-wrap" }}>
                  {item.caption}
                </Typography>
              </Sheet>
              <Typography level="body-xs" sx={{ color: "neutral.400" }}>
                {item.caption.length}/160 chars · {segmentCount} segment
                {segmentCount === 1 ? "" : "s"}
              </Typography>
            </Stack>
          </Box>
        </Box>
      </Stack>
    );
  };

  return (
    <Card
      variant="outlined"
      sx={{
        opacity: isDisabled ? 0.5 : 1,
        overflow: "hidden",
        p: 0,
        transition: "opacity 180ms ease, border-color 180ms ease",
      }}
    >
      <Stack spacing={2}>
        {renderPreviewCard()}

        {item.imageGenerationStatus === "failed" &&
          isImageEligiblePlanItem(item) && (
            <Box sx={{ px: 2, pb: editing ? 0 : 2 }}>
              <Alert
                color="danger"
                endDecorator={
                  <Button
                    color="danger"
                    disabled={isRetryingImage}
                    loading={isRetryingImage}
                    onClick={() => onRetryImage(item)}
                    size="sm"
                    variant="soft"
                  >
                    Retry
                  </Button>
                }
                variant="soft"
              >
                {item.imageError ||
                  "This item still needs an image before launch."}
              </Alert>
            </Box>
          )}

        {editing && !isDisabled && (
          <Sheet
            variant="outlined"
            sx={{
              mx: 2,
              mb: 2,
              borderRadius: "md",
              p: { xs: 2, sm: 2.5 },
              transition: "opacity 200ms ease",
            }}
          >
            <Stack spacing={2}>
              {item.type === "email" ? (
                <>
                  <Stack
                    alignItems={{ xs: "flex-start", sm: "center" }}
                    direction={{ xs: "column", sm: "row" }}
                    justifyContent="space-between"
                    spacing={1}
                  >
                    <Typography level="title-sm">Email content</Typography>
                    <MergeTagsButton item={item} onUpdate={onUpdate} />
                  </Stack>
                  <FormControl>
                    <FormLabel>Subject</FormLabel>
                    <Input
                      value={item.emailSubject || ""}
                      onChange={(event) =>
                        onUpdate(item.id, "emailSubject", event.target.value)
                      }
                    />
                    <Typography
                      color="neutral"
                      level="body-xs"
                      sx={{ mt: 0.5 }}
                    >
                      {(item.emailSubject || "").length}/50 characters
                    </Typography>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Preheader</FormLabel>
                    <Input
                      value={item.emailPreheader || ""}
                      onChange={(event) =>
                        onUpdate(item.id, "emailPreheader", event.target.value)
                      }
                    />
                    <Typography
                      color="neutral"
                      level="body-xs"
                      sx={{ mt: 0.5 }}
                    >
                      {(item.emailPreheader || "").length}/90 characters
                    </Typography>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Body</FormLabel>
                    <Textarea
                      minRows={5}
                      value={item.caption}
                      onChange={(event) =>
                        onUpdate(item.id, "caption", event.target.value)
                      }
                    />
                  </FormControl>
                  <DateEditor item={item} onUpdate={onUpdate} />
                </>
              ) : item.type === "blog" ? (
                <>
                  <FormControl>
                    <FormLabel>Title</FormLabel>
                    <Input
                      value={item.title}
                      onChange={(event) =>
                        onUpdate(item.id, "title", event.target.value)
                      }
                    />
                  </FormControl>
                  <DateEditor item={item} onUpdate={onUpdate} />
                  <Button
                    color="neutral"
                    onClick={() => onOpenBlog(item)}
                    size="sm"
                    startDecorator={<FileText aria-hidden="true" size={16} />}
                    variant="plain"
                  >
                    Click to see more
                  </Button>
                </>
              ) : item.type === "sms" ? (
                <>
                  <FormControl>
                    <FormLabel>Message body</FormLabel>
                    <Textarea
                      minRows={4}
                      value={item.caption}
                      onChange={(event) =>
                        onUpdate(item.id, "caption", event.target.value)
                      }
                    />
                    <Typography
                      color="neutral"
                      level="body-xs"
                      sx={{ mt: 0.5 }}
                    >
                      {item.caption.length} characters -{" "}
                      {getSmsSegments(item.caption)} segment
                      {getSmsSegments(item.caption) === 1 ? "" : "s"}
                    </Typography>
                  </FormControl>
                  <DateEditor item={item} onUpdate={onUpdate} />
                </>
              ) : (
                <>
                  <FormControl>
                    <FormLabel>Title</FormLabel>
                    <Input
                      value={item.title}
                      onChange={(event) =>
                        onUpdate(item.id, "title", event.target.value)
                      }
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Caption</FormLabel>
                    <Textarea
                      minRows={4}
                      value={item.caption}
                      onChange={(event) =>
                        onUpdate(item.id, "caption", event.target.value)
                      }
                    />
                    <Typography
                      color="neutral"
                      level="body-xs"
                      sx={{ mt: 0.5 }}
                    >
                      {item.caption.length} characters
                    </Typography>
                  </FormControl>
                  <DateEditor item={item} onUpdate={onUpdate} />
                </>
              )}

              {canShowImageEditor && (
                <Stack spacing={1.25}>
                  <Stack
                    alignItems={{ xs: "flex-start", sm: "center" }}
                    direction={{ xs: "column", sm: "row" }}
                    justifyContent="space-between"
                    spacing={1}
                  >
                    <Typography level="title-sm">Featured image</Typography>
                    {featuredImage && !item.imageUrl && (
                      <Button
                        color="neutral"
                        onClick={() => onApplyFeaturedImage(item.id)}
                        size="sm"
                        startDecorator={<Check aria-hidden="true" size={15} />}
                        variant="outlined"
                      >
                        Use Featured Image
                      </Button>
                    )}
                  </Stack>
                  {featuredImage && !item.imageUrl && (
                    <Card variant="outlined" sx={{ p: 1.5 }}>
                      <Stack direction="row" spacing={1.5}>
                        <Box
                          alt={featuredImage.metadata.alt || "Featured image"}
                          component="img"
                          src={featuredImage.url}
                          sx={{
                            aspectRatio: "1 / 1",
                            borderRadius: "sm",
                            flexShrink: 0,
                            objectFit: "cover",
                            width: 80,
                          }}
                        />
                        <Stack spacing={0.5}>
                          <Typography level="title-sm">
                            Theme featured image available
                          </Typography>
                          <Typography color="neutral" level="body-xs">
                            {featuredImage.metadata.alt}
                          </Typography>
                        </Stack>
                      </Stack>
                    </Card>
                  )}
                  <Box sx={{ maxWidth: 520 }}>
                    <MediaSelectorImage
                      contentContext={getPlanItemImagePrompt(item)}
                      contentType={getImageSelectorContentType(item)}
                      imageGenerationStatus={item.imageGenerationStatus}
                      onChange={(imageUrl, metadata) =>
                        onImageSelect(item.id, imageUrl, metadata)
                      }
                      src={item.imageUrl}
                    />
                  </Box>
                </Stack>
              )}

              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                spacing={1}
              >
                {canShowSocialPreview && config.previewPlatform ? (
                  <Button
                    color="neutral"
                    onClick={() => onOpenPreview(item, config.previewPlatform)}
                    size="sm"
                    startDecorator={<Eye aria-hidden="true" size={16} />}
                    variant="plain"
                  >
                    Preview Post
                  </Button>
                ) : (
                  <Box />
                )}
                <Button
                  color="neutral"
                  onClick={onCloseEdit}
                  size="sm"
                  variant="soft"
                >
                  Save & Close
                </Button>
              </Stack>
            </Stack>
          </Sheet>
        )}

        {canShowImageEditor && (
          <Box sx={{ display: "none" }}>
            <MediaSelectorImage
              ref={imageSelectorRef}
              contentContext={getPlanItemImagePrompt(item)}
              contentType={getImageSelectorContentType(item)}
              imageGenerationStatus={item.imageGenerationStatus}
              onChange={(imageUrl, metadata) =>
                onImageSelect(item.id, imageUrl, metadata)
              }
              src={item.imageUrl}
            />
          </Box>
        )}
      </Stack>
    </Card>
  );
};

export const PlanStepCalendar: React.FC<PlanStepCalendarProps> = ({
  onBack,
  onNext,
}) => {
  const { state, setItems, updateItem, toggleItem, replaceWeekContent } =
    usePlanWizard();
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [generationAttempted, setGenerationAttempted] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(8);
  const [contentGenerationError, setContentGenerationError] = useState<
    string | null
  >(null);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [previewItem, setPreviewItem] = useState<PlanItem | null>(null);
  const [previewPlatform, setPreviewPlatform] =
    useState<PreviewPlatform>("instagram");
  const [blogViewerItem, setBlogViewerItem] = useState<PlanItem | null>(null);
  const [featuredImage, setFeaturedImage] = useState<FeaturedImageState | null>(
    null,
  );
  const [generatingImages, setGeneratingImages] = useState(false);
  const [imageGenerationProgress, setImageGenerationProgress] = useState({
    phase: "searching" as ImageResolutionPhase,
    completed: 0,
    total: 0,
  });
  const [retryingImageItemIds, setRetryingImageItemIds] = useState<string[]>(
    [],
  );
  const [imageNotice, setImageNotice] = useState<ImageNoticeState | null>(null);
  const [replacingWeeks, setReplacingWeeks] = useState<number[]>([]);

  const monthName = state.month
    ? format(parseMonthParam(state.month), "MMMM yyyy")
    : "";

  const itemsByWeek = useMemo(
    () =>
      state.items.reduce(
        (acc, item) => {
          if (!acc[item.week]) acc[item.week] = [];
          acc[item.week].push(item);
          return acc;
        },
        {} as Record<number, PlanItem[]>,
      ),
    [state.items],
  );

  const sortedWeekNumbers = useMemo(
    () =>
      Object.keys(itemsByWeek)
        .map(Number)
        .sort((a, b) => a - b),
    [itemsByWeek],
  );

  const themeBreakdown = useMemo(
    () =>
      state.themes.map((theme) => {
        const themeItems = state.items.filter(
          (item) => item.themeId === theme.id,
        );
        const channels = Array.from(
          new Set(themeItems.map((item) => item.type)),
        );

        return {
          channels,
          count: themeItems.length,
          theme,
        };
      }),
    [state.items, state.themes],
  );

  const itemsMissingImages = useMemo(
    () =>
      state.items.filter(
        (item) => isImageEligiblePlanItem(item) && !item.imageUrl,
      ),
    [state.items],
  );

  const isBusy = isInitialLoading || replacingWeeks.length > 0;

  const handleGenerateFeaturedImage = useCallback(async () => {
    if (!state.month || state.themes.length === 0) return;

    const featuredPrompt = `${state.themes[0]?.label || "garden"} ${format(
      parseMonthParam(state.month),
      "MMMM",
    )} professional showcase`;

    try {
      const { data, error } =
        await supabase.functions.invoke<FeaturedImageResponse>(
          "generate-ai-image",
          {
            body: {
              contentContext: featuredPrompt,
              contentTitle: `${format(
                parseMonthParam(state.month),
                "MMMM",
              )} Featured Garden`,
              channel: "instagram",
              uploadToStorage: true,
              storageBucket: "global-ai-images",
            },
          },
        );

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.imageUrl) {
        throw new Error("No featured image was returned.");
      }

      setFeaturedImage({
        url: data.imageUrl,
        metadata: {
          alt: featuredPrompt,
          source: "ai_generated_featured",
          globalImageId: data.globalImageId,
          tags: data.metadata?.tags || [],
        },
      });
    } catch (error) {
      setImageNotice({
        message: `Featured image generation failed: ${getErrorMessage(
          error,
          "Unable to generate featured image.",
        )}`,
        retryFeatured: true,
      });
    }
  }, [state.month, state.themes]);

  const resolveImagesForItems = useCallback(
    async (itemsForResolution: PlanItem[]) => {
      const itemsNeedingImages = itemsForResolution
        .filter(isImageEligiblePlanItem)
        .filter((item) => !item.imageUrl);

      if (itemsNeedingImages.length === 0) return;

      setGeneratingImages(true);
      setImageGenerationProgress({
        phase: "searching",
        completed: 0,
        total: itemsNeedingImages.length,
      });

      try {
        const resolutionContext = await resolveTenantMutationContext({});

        const runGallerySearchPass = async (
          itemsForPass: ImageEligiblePlanItem[],
        ) => {
          let completedCount = 0;
          const itemsToGenerate: ImageEligiblePlanItem[] = [];

          for (
            let index = 0;
            index < itemsForPass.length;
            index += IMAGE_GENERATION_BATCH_SIZE
          ) {
            const batch = itemsForPass.slice(
              index,
              index + IMAGE_GENERATION_BATCH_SIZE,
            );

            batch.forEach((item) => {
              updateItem(item.id, {
                imageGenerationStatus: "generating",
                imageError: null,
              });
            });

            const batchResults = await Promise.allSettled(
              batch.map(async (item) => {
                const match = await searchGalleryForPost({
                  channel: IMAGE_CHANNEL_MAP[item.type],
                  contentTitle: item.title?.trim() || "",
                  imageQuery: getPlanItemImagePrompt(item),
                  tenantId: resolutionContext.tenantId,
                });

                return { item, match };
              }),
            );

            batchResults.forEach((result, resultIndex) => {
              const batchItem = batch[resultIndex];
              completedCount += 1;
              setImageGenerationProgress({
                phase: "searching",
                completed: completedCount,
                total: itemsForPass.length,
              });

              if (result.status === "fulfilled" && result.value.match) {
                const galleryMatch = result.value.match;
                updateItem(batchItem.id, {
                  imageUrl: galleryMatch.publicUrl,
                  imageMetadata: {
                    alt:
                      batchItem.title?.trim() ||
                      getPlanItemImagePrompt(batchItem),
                    source: "gallery-reuse",
                    globalImageId: galleryMatch.imageId,
                    matchedTags: galleryMatch.matchedTags,
                    matchScore: galleryMatch.matchScore,
                    storagePath: galleryMatch.storagePath,
                    tags: galleryMatch.matchedTags,
                  },
                  imageGenerationStatus: "completed",
                  imageError: null,
                });
                return;
              }

              itemsToGenerate.push(batchItem);
              updateItem(batchItem.id, {
                imageGenerationStatus: "pending",
                imageError: null,
              });
            });
          }

          return itemsToGenerate;
        };

        const runGenerationPass = async (
          itemsForPass: ImageEligiblePlanItem[],
        ) => {
          let completedCount = 0;
          const failedItems: ImageEligiblePlanItem[] = [];

          for (
            let index = 0;
            index < itemsForPass.length;
            index += IMAGE_GENERATION_BATCH_SIZE
          ) {
            const batch = itemsForPass.slice(
              index,
              index + IMAGE_GENERATION_BATCH_SIZE,
            );

            batch.forEach((item) => {
              updateItem(item.id, {
                imageGenerationStatus: "generating",
                imageError: null,
              });
            });

            const batchResults = await Promise.allSettled(
              batch.map((item) =>
                generatePlanItemImage(item, resolutionContext, {
                  forceGenerate: true,
                }),
              ),
            );

            batchResults.forEach((result, resultIndex) => {
              const batchItem = batch[resultIndex];
              completedCount += 1;
              setImageGenerationProgress({
                phase: "generating",
                completed: completedCount,
                total: itemsForPass.length,
              });

              if (result.status === "fulfilled") {
                updateItem(batchItem.id, {
                  imageUrl: result.value.imageUrl,
                  imageMetadata: result.value.imageMetadata,
                  imageGenerationStatus: "completed",
                  imageError: null,
                });
                return;
              }

              failedItems.push(batchItem);
              updateItem(batchItem.id, {
                imageGenerationStatus: "failed",
                imageError: getErrorMessage(
                  result.reason,
                  "Image generation failed",
                ),
              });
            });
          }

          return failedItems;
        };

        const itemsToGenerate = await runGallerySearchPass(itemsNeedingImages);
        let failedItems: ImageEligiblePlanItem[] = [];

        if (itemsToGenerate.length > 0) {
          setImageGenerationProgress({
            phase: "generating",
            completed: 0,
            total: itemsToGenerate.length,
          });
          failedItems = await runGenerationPass(itemsToGenerate);
        }

        if (failedItems.length > 0) {
          setImageGenerationProgress({
            phase: "generating",
            completed: 0,
            total: failedItems.length,
          });
          failedItems = await runGenerationPass(failedItems);
        }

        if (failedItems.length > 0) {
          setImageNotice({
            message: `${failedItems.length} content item${
              failedItems.length === 1 ? "" : "s"
            } could not generate images. Retry generation or choose images manually before launch.`,
            retryItems: failedItems,
          });
        }
      } catch (error) {
        setImageNotice({
          message: `Image generation failed: ${getErrorMessage(
            error,
            "Unable to generate images.",
          )}`,
          retryItems: itemsNeedingImages,
        });
      } finally {
        setGeneratingImages(false);
        setImageGenerationProgress({
          phase: "searching",
          completed: 0,
          total: 0,
        });
      }
    },
    [updateItem],
  );

  const hydrateGeneratedItems = useCallback(
    (generatedItems: PlanItem[]) => {
      const preparedItems = generatedItems.map(
        preparePlanItemForImageGeneration,
      );
      setItems(preparedItems);
      void resolveImagesForItems(preparedItems);
    },
    [resolveImagesForItems, setItems],
  );

  const handleGenerateCalendar = useCallback(async () => {
    if (state.themes.length === 0 || !state.month) return;

    setGenerationAttempted(true);
    setIsInitialLoading(true);
    setContentGenerationError(null);
    setGenerationProgress(12);
    void handleGenerateFeaturedImage();

    try {
      setGenerationProgress(36);
      const generatedItems = await generateMultiThemeSeasonalPlanContent(
        state.themes,
        state.month,
      );
      setGenerationProgress(82);
      hydrateGeneratedItems(generatedItems);
      setGenerationProgress(100);
    } catch (error) {
      setItems([]);
      setContentGenerationError(
        getErrorMessage(error, "Failed to generate content. Please try again."),
      );
    } finally {
      setIsInitialLoading(false);
    }
  }, [
    handleGenerateFeaturedImage,
    hydrateGeneratedItems,
    setItems,
    state.month,
    state.themes,
  ]);

  useEffect(() => {
    if (
      state.themes.length > 0 &&
      state.month &&
      state.items.length === 0 &&
      !generationAttempted &&
      !isInitialLoading
    ) {
      void handleGenerateCalendar();
    }
  }, [
    generationAttempted,
    handleGenerateCalendar,
    isInitialLoading,
    state.items.length,
    state.month,
    state.themes.length,
  ]);

  const handleItemUpdate = <K extends keyof PlanItem>(
    id: string,
    field: K,
    value: PlanItem[K],
  ) => {
    updateItem(id, { [field]: value } as Pick<PlanItem, K>);
  };

  const handleImageSelect = (
    itemId: string,
    imageUrl: string,
    metadata?: Record<string, unknown>,
  ) => {
    updateItem(itemId, {
      imageUrl,
      imageMetadata: normalizeImageMetadata(metadata),
      imageGenerationStatus: "completed",
      imageError: null,
    });
  };

  const handleRetrySingleImage = useCallback(
    async (item: PlanItem) => {
      if (
        !isImageEligiblePlanItem(item) ||
        retryingImageItemIds.includes(item.id)
      ) {
        return;
      }

      setRetryingImageItemIds((current) => [...current, item.id]);
      updateItem(item.id, {
        imageGenerationStatus: "generating",
        imageError: null,
      });

      try {
        const resolutionContext = await resolveTenantMutationContext({});
        const result = await generatePlanItemImage(item, resolutionContext);
        updateItem(item.id, {
          imageUrl: result.imageUrl,
          imageMetadata: result.imageMetadata,
          imageGenerationStatus: "completed",
          imageError: null,
        });
      } catch (error) {
        const imageError = getErrorMessage(error, "Image generation failed");
        updateItem(item.id, {
          imageGenerationStatus: "failed",
          imageError,
        });
        setImageNotice({ message: imageError, retryItems: [item] });
      } finally {
        setRetryingImageItemIds((current) =>
          current.filter((itemId) => itemId !== item.id),
        );
      }
    },
    [retryingImageItemIds, updateItem],
  );

  const handleRetryImageNotice = () => {
    if (!imageNotice) return;

    if (imageNotice.retryFeatured) {
      setImageNotice(null);
      void handleGenerateFeaturedImage();
      return;
    }

    if (imageNotice.retryItems?.length) {
      const retryItems = imageNotice.retryItems;
      setImageNotice(null);
      void resolveImagesForItems(retryItems);
    }
  };

  const applyFeaturedImage = (itemId: string) => {
    if (!featuredImage) return;

    updateItem(itemId, {
      imageUrl: featuredImage.url,
      imageMetadata: featuredImage.metadata,
      imageGenerationStatus: "completed",
      imageError: null,
    });
  };

  const handleToggleEnabled = (item: PlanItem) => {
    toggleItem(item.id);
    if (item.enabled && editingItem === item.id) {
      setEditingItem(null);
    }
  };

  const handleReplaceWeekContent = async (weekNumber: number) => {
    if (
      !state.month ||
      state.themes.length === 0 ||
      replacingWeeks.includes(weekNumber)
    ) {
      return;
    }

    setReplacingWeeks((current) => [...current, weekNumber]);

    try {
      const replacementItems = await generateMultiThemeSeasonalPlanContent(
        state.themes,
        state.month,
      );
      const preparedReplacementItems = replacementItems
        .map(preparePlanItemForImageGeneration)
        .filter((item) => item.week === weekNumber);
      const existingWeekItems = state.items.filter(
        (item) => item.week === weekNumber,
      );
      const themeIds = Array.from(
        new Set(
          [...existingWeekItems, ...preparedReplacementItems]
            .map((item) => item.themeId)
            .filter((themeId): themeId is string => Boolean(themeId)),
        ),
      );

      themeIds.forEach((themeId) => {
        replaceWeekContent(
          weekNumber,
          themeId,
          preparedReplacementItems.filter((item) => item.themeId === themeId),
        );
      });

      void resolveImagesForItems(preparedReplacementItems);
    } catch (error) {
      setImageNotice({
        message: `Could not replace ${getWeekLabel(
          weekNumber,
          state.month,
        )}: ${getErrorMessage(error, "Unable to regenerate this week.")}`,
      });
    } finally {
      setReplacingWeeks((current) =>
        current.filter((week) => week !== weekNumber),
      );
    }
  };

  const handleOpenPreview = (item: PlanItem, platform: PreviewPlatform) => {
    setPreviewItem(item);
    setPreviewPlatform(platform);
  };

  const blogViewerContent = blogViewerItem
    ? {
        title: blogViewerItem.title,
        caption: blogViewerItem.caption,
        enhancedContent: {
          title: blogViewerItem.enhancedContent?.title || blogViewerItem.title,
          description:
            blogViewerItem.enhancedContent?.summary || blogViewerItem.caption,
          fullContent: getBlogFullContent(blogViewerItem),
          tags: blogViewerItem.imageMetadata?.tags || [],
          readingTime: getBlogReadingTime(blogViewerItem),
        },
      }
    : null;

  if (state.themes.length === 0 || !state.month) {
    return (
      <Alert color="warning" variant="soft">
        Choose a target month and at least one theme before generating the
        calendar.
      </Alert>
    );
  }

  if (contentGenerationError && state.items.length === 0) {
    return (
      <GenerationState
        error={contentGenerationError}
        monthName={monthName}
        onRetry={() => void handleGenerateCalendar()}
        progress={generationProgress}
      />
    );
  }

  if (state.items.length === 0 || isInitialLoading) {
    return (
      <GenerationState
        error={null}
        monthName={monthName}
        onRetry={() => void handleGenerateCalendar()}
        progress={generationProgress}
      />
    );
  }

  return (
    <>
      <ImageProgressModal
        open={generatingImages}
        progress={imageGenerationProgress}
      />

      <Box
        sx={{
          bgcolor: "background.surface",
          borderRadius: { xs: "lg", md: "xl" },
        }}
      >
        <Box
          sx={{
            px: { xs: 0.75, sm: 1 },
            py: { xs: 0.75, sm: 1 },
          }}
        >
          <Stack spacing={{ xs: 3, md: 4 }} sx={{ pb: { xs: 3, md: 4 } }}>
            <Stack spacing={1.5} sx={{ textAlign: "center", px: 0.5 }}>
              <Typography level="h3">Review Your Content Calendar</Typography>
              <Typography color="neutral" level="body-md">
                Your multi-theme content plan for {monthName}. Edit drafts,
                replace weekly packs, and prepare images before launch.
              </Typography>
              <Stack
                direction="row"
                justifyContent="center"
                spacing={1}
                sx={{ flexWrap: "wrap", pt: 0.5 }}
                useFlexGap
              >
                {themeBreakdown.map(({ channels, count, theme }) => (
                  <Chip
                    color="neutral"
                    endDecorator={
                      <Stack direction="row" spacing={0.35}>
                        {channels.map((channel) => {
                          const ChannelIcon = CHANNEL_CONFIG[channel].icon;
                          return (
                            <ChannelIcon
                              aria-hidden="true"
                              key={channel}
                              size={12}
                            />
                          );
                        })}
                      </Stack>
                    }
                    key={theme.id}
                    size="sm"
                    variant="soft"
                  >
                    {theme.label} ({count})
                  </Chip>
                ))}
              </Stack>
            </Stack>

            <Stack spacing={2}>
              {sortedWeekNumbers.map((weekNumber) => {
                const weekItems = [...itemsByWeek[weekNumber]].sort(
                  (a, b) => toDate(a.date).getTime() - toDate(b.date).getTime(),
                );
                const isReplacingWeek = replacingWeeks.includes(weekNumber);

                return (
                  <Stack key={weekNumber} spacing={2}>
                    <Stack spacing={1}>
                      <Stack
                        alignItems="center"
                        direction="row"
                        justifyContent="space-between"
                        spacing={2}
                      >
                        <Stack alignItems="center" direction="row" spacing={1}>
                          <Clock aria-hidden="true" size={18} />
                          <Typography level="title-lg">
                            {getWeekLabel(weekNumber, state.month)}
                          </Typography>
                        </Stack>
                        <Button
                          color="neutral"
                          loading={isReplacingWeek}
                          onClick={() =>
                            void handleReplaceWeekContent(weekNumber)
                          }
                          size="sm"
                          startDecorator={
                            <RefreshCw aria-hidden="true" size={16} />
                          }
                          variant="plain"
                        >
                          Replace Pack
                        </Button>
                      </Stack>
                      <Divider />
                    </Stack>

                    <Stack spacing={2}>
                      {weekItems.map((item) => (
                        <PlanContentCard
                          editing={editingItem === item.id}
                          featuredImage={featuredImage}
                          isRetryingImage={retryingImageItemIds.includes(
                            item.id,
                          )}
                          item={item}
                          key={item.id}
                          onApplyFeaturedImage={applyFeaturedImage}
                          onCloseEdit={() => setEditingItem(null)}
                          onImageSelect={handleImageSelect}
                          onOpenBlog={setBlogViewerItem}
                          onOpenPreview={handleOpenPreview}
                          onRetryImage={(retryItem) =>
                            void handleRetrySingleImage(retryItem)
                          }
                          onToggleEdit={(itemId) =>
                            setEditingItem((current) =>
                              current === itemId ? null : itemId,
                            )
                          }
                          onToggleEnabled={handleToggleEnabled}
                          onUpdate={handleItemUpdate}
                        />
                      ))}
                    </Stack>
                  </Stack>
                );
              })}
            </Stack>
          </Stack>
        </Box>

        <Sheet
          sx={{
            bgcolor: "background.surface",
            borderTop: "1px solid",
            borderColor: "divider",
            boxShadow: "sm",
            bottom: 0,
            position: "sticky",
            px: { xs: 2, sm: 2.5 },
            py: { xs: 2, sm: 2.5 },
            zIndex: 10,
          }}
        >
          <Stack spacing={1.5}>
            {!generatingImages && itemsMissingImages.length > 0 && (
              <Alert color="warning" variant="soft">
                {itemsMissingImages.length} content item
                {itemsMissingImages.length === 1 ? "" : "s"} still need images
                before launch. Add images or retry generation before the final
                review.
              </Alert>
            )}
            <Stack direction="row" justifyContent="space-between" spacing={1.5}>
              <Button
                color="neutral"
                disabled={isBusy}
                onClick={onBack}
                size="lg"
                variant="outlined"
              >
                Back
              </Button>
              <Button
                color="primary"
                disabled={isBusy || state.items.length === 0}
                onClick={onNext}
                size="lg"
                variant="solid"
              >
                Continue to Preview
              </Button>
            </Stack>
          </Stack>
        </Sheet>
      </Box>

      {previewItem && (
        <SocialPostPreviewModal
          accountName="Your Business"
          caption={previewItem.caption}
          mediaUrl={previewItem.imageUrl || ""}
          onClose={() => setPreviewItem(null)}
          onPlatformChange={(platform) => setPreviewPlatform(platform)}
          open={true}
          platform={previewPlatform}
          scheduledFor={toDate(previewItem.date).toISOString()}
        />
      )}

      <Modal
        open={Boolean(blogViewerItem)}
        onClose={() => setBlogViewerItem(null)}
      >
        <ModalDialog
          sx={{
            maxHeight: "90vh",
            maxWidth: 900,
            overflow: "auto",
            width: "calc(100% - 32px)",
          }}
        >
          <ModalClose />
          <Typography level="title-lg" sx={{ pr: 3 }}>
            Blog Content
          </Typography>
          {blogViewerContent && (
            <BlogContentViewer blogItem={blogViewerContent} />
          )}
        </ModalDialog>
      </Modal>

      <Snackbar
        anchorOrigin={{ horizontal: "center", vertical: "bottom" }}
        autoHideDuration={7000}
        color="danger"
        onClose={() => setImageNotice(null)}
        open={Boolean(imageNotice)}
        variant="soft"
      >
        <Stack alignItems="center" direction="row" spacing={1.5}>
          <Typography level="body-sm">{imageNotice?.message}</Typography>
          {(imageNotice?.retryFeatured || imageNotice?.retryItems?.length) && (
            <Button
              color="danger"
              onClick={handleRetryImageNotice}
              size="sm"
              variant="plain"
            >
              Retry
            </Button>
          )}
        </Stack>
      </Snackbar>
    </>
  );
};
