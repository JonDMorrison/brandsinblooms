import * as React from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import Button from "@mui/joy/Button";
import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Skeleton from "@mui/joy/Skeleton";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, RefreshCw } from "lucide-react";
import type {
  AIImageStudioAspectRatio,
  AIImageStudioSelectionMetadata,
} from "@/components/crm/ai-image-studio/types";
import BlockDragOverlay from "@/components/crm/studio/BlockDragOverlay";
import BlockLibrary from "@/components/crm/studio/BlockLibrary";
import BlockPropertiesPanel from "@/components/crm/studio/BlockPropertiesPanel";
import { buildStudioCampaignContext } from "@/components/crm/studio/studioAIContext";
import type {
  StudioImageApplyEvent,
  StudioImageAIAspectRatioHint,
  StudioImageAIRequest,
} from "@/components/crm/studio/fields/StudioImageUpload";
import { ensureCampaignStudioImageUrl } from "@/components/crm/studio/fields/StudioImageUpload";
import StudioBottomBar from "@/components/crm/studio/StudioBottomBar";
import StudioCanvas from "@/components/crm/studio/StudioCanvas";
import StudioTopBar from "@/components/crm/studio/StudioTopBar";
import { STUDIO_BLOCK_LOOKUP } from "@/components/crm/studio/blockLibraryData";
import {
  DesignSystemProvider,
  useDesignSystem,
} from "@/contexts/DesignSystemContext";
import { useAIImageStudio } from "@/hooks/useAIImageStudio";
import { useGoogleFontsLoader } from "@/hooks/useGoogleFontsLoader";
import { useBeforeUnload } from "@/hooks/useBeforeUnload";
import type {
  CampaignEditorRecord,
  EditorCampaignType,
} from "@/lib/crm/campaignEditor";
import {
  fetchCampaignEditorRecord,
  persistCampaignDraft,
} from "@/lib/crm/campaignEditor";
import { CampaignDraftConflictError } from "@/lib/crm/campaignDraftPersistence";
import { supabase } from "@/integrations/supabase/client";
import type { ContentBlock } from "@/types/emailBuilder";
import type {
  GalleryImage,
  GalleryProduct,
  StudioBlock,
} from "@/types/studioBlocks";
import {
  STUDIO_CANVAS_APPEND_DROP_ID,
  STUDIO_CANVAS_EMPTY_DROP_ID,
  parseStudioInsertionDropId,
  type StudioDragData,
} from "@/components/crm/studio/studioCanvasTypes";
import {
  type StudioCampaignSnapshot,
  type StudioCampaignStatus,
  useStudioState,
} from "@/components/crm/studio/useStudioState";

const AUTO_SAVE_DELAY_MS = 3000;
const SAVE_FEEDBACK_RESET_MS = 2000;
const STUDIO_CHANNEL_CONNECT_DELAY_MS = 2000;
const STUDIO_CHANNEL_RETRY_INTERVAL_MS = 250;
const STUDIO_AI_PANEL_COLLAPSE_MS = 250;
const STUDIO_AI_SEQUENCE_CLEANUP_MS = 500;

type StudioSaveStatus =
  | "idle"
  | "saving"
  | "saved"
  | "error"
  | "conflict"
  | "failed";

const LEGACY_TO_STUDIO_BLOCK_TYPE: Record<string, StudioBlock["type"]> = {
  header: "email-safe-hero",
  text: "plain-text",
  image: "full-width-image",
  button: "call-to-action",
  cta: "call-to-action",
  product: "product-card",
};

const STUDIO_SOCIAL_PLATFORMS = new Set([
  "facebook",
  "instagram",
  "twitter",
  "linkedin",
  "youtube",
  "tiktok",
  "pinterest",
  "threads",
]);

function toStudioCampaignStatus(
  status: string | null | undefined,
): StudioCampaignStatus {
  switch (status?.toLowerCase()) {
    case "scheduled":
      return "Scheduled";
    case "sending":
    case "queued":
    case "processing":
      return "Sending";
    case "sent":
    case "completed":
      return "Sent";
    default:
      return "Draft";
  }
}

function toStudioBlockType(rawType: string): StudioBlock["type"] {
  const candidate = LEGACY_TO_STUDIO_BLOCK_TYPE[rawType] ?? rawType;
  return candidate in STUDIO_BLOCK_LOOKUP
    ? (candidate as StudioBlock["type"])
    : "plain-text";
}

function toStudioSocialLinks(
  socialLinks: ContentBlock["socialLinks"] | undefined,
): StudioBlock["socialLinks"] {
  if (!socialLinks) {
    return undefined;
  }

  return Object.entries(socialLinks).flatMap(([platform, value]) => {
    if (!STUDIO_SOCIAL_PLATFORMS.has(platform)) {
      return [];
    }

    return [
      {
        platform: platform as StudioBlock["socialLinks"][number]["platform"],
        enabled: Boolean(value?.enabled),
        url: typeof value?.url === "string" ? value.url : "",
      },
    ];
  });
}

function toLegacySocialLinks(
  socialLinks: StudioBlock["socialLinks"],
): ContentBlock["socialLinks"] | undefined {
  if (!Array.isArray(socialLinks) || socialLinks.length === 0) {
    return undefined;
  }

  return socialLinks.reduce<NonNullable<ContentBlock["socialLinks"]>>(
    (lookup, link) => {
      lookup[link.platform] = {
        enabled: link.enabled,
        url: link.url,
      };
      return lookup;
    },
    {},
  );
}

function toStudioBlock(block: ContentBlock, index: number): StudioBlock {
  const record = block as ContentBlock & Record<string, unknown>;
  const type = toStudioBlockType(
    typeof record.type === "string" ? record.type : "plain-text",
  );
  const galleryProducts = Array.isArray(record.galleryProducts)
    ? (record.galleryProducts as StudioBlock["galleryProducts"])
    : Array.isArray(block.galleryItems)
      ? block.galleryItems.map((item) => ({
          id: item.id,
          imageUrl: item.imageUrl,
          name: item.title,
          buttonUrl: item.url,
        }))
      : undefined;

  return {
    ...(record as StudioBlock),
    id:
      typeof record.id === "string" && record.id.length > 0
        ? record.id
        : `studio-block-${index}`,
    type,
    label:
      typeof record.label === "string" && record.label.trim().length > 0
        ? record.label
        : STUDIO_BLOCK_LOOKUP[type].name,
    order: typeof record.order === "number" ? record.order : index,
    visible: record.visible !== false,
    headline:
      typeof record.headline === "string"
        ? record.headline
        : typeof block.heading === "string"
          ? block.heading
          : typeof block.title === "string"
            ? block.title
            : undefined,
    subheading:
      typeof record.subheading === "string"
        ? record.subheading
        : typeof block.subtitle === "string"
          ? block.subtitle
          : undefined,
    body:
      typeof record.body === "string"
        ? record.body
        : typeof block.content === "string"
          ? block.content
          : undefined,
    imageUrl:
      typeof record.imageUrl === "string"
        ? record.imageUrl
        : typeof block.imageUrl === "string"
          ? block.imageUrl
          : typeof block.backgroundImageUrl === "string"
            ? block.backgroundImageUrl
            : undefined,
    imageAlt:
      typeof record.imageAlt === "string"
        ? record.imageAlt
        : typeof block.altText === "string"
          ? block.altText
          : undefined,
    buttonText:
      typeof record.buttonText === "string"
        ? record.buttonText
        : typeof block.buttonText === "string"
          ? block.buttonText
          : typeof block.ctaText === "string"
            ? block.ctaText
            : undefined,
    buttonUrl:
      typeof record.buttonUrl === "string"
        ? record.buttonUrl
        : typeof block.buttonUrl === "string"
          ? block.buttonUrl
          : typeof block.ctaUrl === "string"
            ? block.ctaUrl
            : undefined,
    quoteText:
      typeof record.quoteText === "string"
        ? record.quoteText
        : typeof block.quote === "string"
          ? block.quote
          : undefined,
    authorName:
      typeof record.authorName === "string"
        ? record.authorName
        : typeof block.author === "string"
          ? block.author
          : undefined,
    authorTitle:
      typeof record.authorTitle === "string"
        ? record.authorTitle
        : typeof block.authorTitle === "string"
          ? block.authorTitle
          : undefined,
    tagLabel:
      typeof record.tagLabel === "string"
        ? record.tagLabel
        : typeof block.issueNumber === "string"
          ? block.issueNumber
          : undefined,
    dateLabel:
      typeof record.dateLabel === "string"
        ? record.dateLabel
        : typeof block.publishDate === "string"
          ? block.publishDate
          : undefined,
    galleryProducts,
    socialLinks: Array.isArray(record.socialLinks)
      ? (record.socialLinks as StudioBlock["socialLinks"])
      : toStudioSocialLinks(block.socialLinks),
  };
}

function toStudioSnapshot(
  record: CampaignEditorRecord,
): StudioCampaignSnapshot {
  return {
    campaignName: record.name || "Untitled Campaign",
    campaignStatus: toStudioCampaignStatus(record.status),
    subjectLine: record.subjectLine,
    previewText: record.preheaderText,
    senderName: record.senderName,
    senderEmail: record.senderEmail,
    blocks: record.contentBlocks.map(toStudioBlock),
  };
}

function toPersistedContentBlocks(blocks: StudioBlock[]): ContentBlock[] {
  return blocks.map((block, index) => ({
    ...(block as ContentBlock),
    id: block.id,
    type: block.type as ContentBlock["type"],
    source: "manual",
    title: block.headline ?? block.label,
    content: block.body,
    imageUrl: block.imageUrl ?? null,
    altText: block.imageAlt,
    ctaText: block.buttonText,
    ctaUrl: block.buttonUrl,
    quote: block.quoteText,
    author: block.authorName,
    authorTitle: block.authorTitle,
    subtitle: block.subheading,
    issueNumber: block.tagLabel,
    publishDate: block.dateLabel,
    socialLinks: toLegacySocialLinks(block.socialLinks),
    order: typeof block.order === "number" ? block.order : index,
    visible: block.visible !== false,
  }));
}

function buildStudioFingerprint(snapshot: StudioCampaignSnapshot) {
  return JSON.stringify({
    campaignName: snapshot.campaignName.trim(),
    subjectLine: snapshot.subjectLine,
    previewText: snapshot.previewText,
    senderName: snapshot.senderName,
    senderEmail: snapshot.senderEmail,
    blocks: snapshot.blocks.map((block, index) => ({
      ...block,
      order: typeof block.order === "number" ? block.order : index,
      visible: block.visible !== false,
    })),
  });
}

function resolveStudioAIAspectRatio(
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

function getCampaignImageSourceFromMetadata(
  metadata?: AIImageStudioSelectionMetadata,
) {
  switch (metadata?.source) {
    case "ai-generated":
      return "ai-generated" as const;
    case "upload":
      return "upload" as const;
    case "content_asset":
    case "global_image_gallery":
    default:
      return "library" as const;
  }
}

function getImageGallerySlotCount(block: StudioBlock) {
  switch (block.layout) {
    case "grid-4":
      return 4;
    case "grid-6":
      return 6;
    case "feature-grid":
      return 3;
    default:
      return 3;
  }
}

function getImageGalleryFieldKey(blockId: string, slotIndex: number) {
  return `${blockId}:galleryImages:${slotIndex}`;
}

function getProductGalleryFieldKey(blockId: string, productId: string) {
  return `${blockId}:galleryProducts:${productId}:imageUrl`;
}

function buildStudioAIContextUpdate(request: StudioImageAIRequest) {
  return {
    assignmentLabel: request.assignmentLabel,
    blockId: request.blockId,
    campaignContext: request.campaignContext,
    contentContext: request.blockContext,
    contextLabel: request.blockContext,
    contextType: request.contextType ?? "email_block",
  };
}

function buildStudioAISelectHandler(request: StudioImageAIRequest) {
  return (
    imageUrl: string,
    metadata?: Parameters<NonNullable<StudioImageAIRequest["onSelect"]>>[1],
  ) => request.onSelect?.(imageUrl, metadata);
}

function StudioShellSkeleton() {
  return (
    <Sheet
      component="main"
      sx={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        bgcolor: "background.surface",
        display: "grid",
        gridTemplateRows: "52px minmax(0, 1fr) 36px",
      }}
    >
      <Sheet
        sx={{
          height: 52,
          bgcolor: "background.surface",
          boxShadow: "0 1px 0 0 rgba(0,0,0,0.06)",
        }}
      >
        <Box
          sx={{
            px: 2,
            height: 52,
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Skeleton
              variant="rectangular"
              width={32}
              height={32}
              sx={{ borderRadius: "8px" }}
            />
            <Skeleton variant="text" width={176} height={18} />
            <Skeleton
              variant="rectangular"
              width={62}
              height={20}
              sx={{ borderRadius: "4px" }}
            />
            <Skeleton variant="circular" width={30} height={30} />
          </Stack>

          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Skeleton
              variant="rectangular"
              width={30}
              height={30}
              sx={{ borderRadius: "8px" }}
            />
            <Skeleton
              variant="rectangular"
              width={30}
              height={30}
              sx={{ borderRadius: "8px" }}
            />
            <Skeleton
              variant="rectangular"
              width={30}
              height={30}
              sx={{ borderRadius: "8px" }}
            />
          </Stack>

          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            justifyContent="flex-end"
          >
            <Skeleton variant="text" width={84} height={14} />
            <Skeleton
              variant="rectangular"
              width={96}
              height={32}
              sx={{ borderRadius: "8px" }}
            />
            <Skeleton
              variant="rectangular"
              width={98}
              height={32}
              sx={{ borderRadius: "8px" }}
            />
          </Stack>
        </Box>
      </Sheet>

      <Box
        sx={{
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            md: "264px minmax(0, 1fr)",
          },
        }}
      >
        <Sheet
          sx={{
            display: { xs: "none", md: "grid" },
            gridTemplateRows: "auto minmax(0, 1fr)",
            minHeight: 0,
            bgcolor: "background.surface",
            boxShadow: "1px 0 0 0 rgba(0,0,0,0.06)",
          }}
        >
          <Box sx={{ p: 1.5 }}>
            <Skeleton
              variant="rectangular"
              height={34}
              sx={{ borderRadius: "8px" }}
            />
          </Box>

          <Box sx={{ px: 1.5, pb: 1.5, overflow: "hidden" }}>
            <Stack spacing={1}>
              <Skeleton variant="text" width="34%" height={12} />
              {Array.from({ length: 8 }, (_, index) => (
                <Skeleton
                  key={`studio-library-skeleton-${index}`}
                  variant="rectangular"
                  height={52}
                  sx={{ borderRadius: "8px" }}
                />
              ))}
            </Stack>
          </Box>
        </Sheet>

        <Box
          sx={{
            minWidth: 0,
            minHeight: 0,
            bgcolor: "neutral.50",
            display: "flex",
            justifyContent: "center",
            alignItems: "flex-start",
            pt: 4,
            px: 2,
          }}
        >
          <Skeleton
            variant="rectangular"
            sx={{
              width: { xs: "100%", sm: 480 },
              maxWidth: "100%",
              height: 600,
              borderRadius: "12px",
            }}
          />
        </Box>
      </Box>

      <Sheet
        sx={{
          height: 36,
          bgcolor: "background.surface",
          boxShadow: "0 -1px 0 0 rgba(0,0,0,0.06)",
        }}
      >
        <Box
          sx={{
            px: 2,
            height: 36,
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Skeleton variant="text" width={58} height={12} />
            <Skeleton variant="rectangular" width={1} height={14} />
            <Skeleton variant="text" width={70} height={12} />
          </Stack>
          <Skeleton
            variant="text"
            width={124}
            height={12}
            sx={{ justifySelf: "center" }}
          />
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            justifyContent="flex-end"
          >
            <Skeleton variant="circular" width={24} height={24} />
            <Skeleton variant="text" width={40} height={12} />
            <Skeleton variant="circular" width={24} height={24} />
            <Skeleton variant="rectangular" width={1} height={14} />
            <Skeleton variant="text" width={46} height={12} />
          </Stack>
        </Box>
      </Sheet>
    </Sheet>
  );
}

function CampaignStudioPageContent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const campaignId = id ?? "";
  const { designSystem } = useDesignSystem();
  const isMobileViewport = useMediaQuery("(max-width: 767.95px)");
  const {
    close: closeAIImageStudio,
    isOpen: isAIImageStudioDrawerOpen,
    open: openAIImageStudio,
    updateContext: updateAIImageStudioContext,
    updateOnSelect: updateAIImageStudioOnSelect,
  } = useAIImageStudio();

  const initialCampaignName = React.useMemo(
    () =>
      campaignId ? `Campaign ${campaignId.slice(0, 8)}` : "Untitled Campaign",
    [campaignId],
  );

  useGoogleFontsLoader(designSystem.fontUrls);

  const studio = useStudioState({ initialCampaignName, designSystem });
  const editorPath = campaignId
    ? `/crm/campaigns/${campaignId}/edit`
    : "/crm/campaigns";
  const campaignRecordRef = React.useRef<CampaignEditorRecord | null>(null);
  const activeCampaignType: EditorCampaignType =
    campaignRecordRef.current?.campaignType ?? "email";
  const channelRef = React.useRef<ReturnType<typeof supabase.channel> | null>(
    null,
  );
  const latestUpdatedAtRef = React.useRef<string | null>(null);
  const currentSnapshotRef = React.useRef<StudioCampaignSnapshot | null>(null);
  const savePromiseRef = React.useRef<Promise<string | null> | null>(null);
  const pendingSaveRequestedRef = React.useRef(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [saveStatus, setSaveStatus] = React.useState<StudioSaveStatus>("idle");
  const [saveMessage, setSaveMessage] = React.useState<string | null>(null);
  const [savedFingerprint, setSavedFingerprint] = React.useState("");
  const [lastSavedAt, setLastSavedAt] = React.useState<string | null>(null);
  const [externalUpdateMessage, setExternalUpdateMessage] = React.useState<
    string | null
  >(null);
  const [activeCanvasDragBlockId, setActiveCanvasDragBlockId] = React.useState<
    string | null
  >(null);
  const [aiStudioOpen, setAIStudioOpen] = React.useState(false);
  const [propertiesPanelSuppressed, setPropertiesPanelSuppressed] =
    React.useState(false);
  const [preservedBlockId, setPreservedBlockId] = React.useState<string | null>(
    null,
  );
  const [preservedScrollPosition, setPreservedScrollPosition] = React.useState<
    number | null
  >(null);
  const [loadRevision, setLoadRevision] = React.useState(0);
  const loadStudioCampaignRef = React.useRef(studio.loadCampaign);
  const isLoadingRef = React.useRef(isLoading);
  const saveStatusRef = React.useRef(saveStatus);
  const savedFingerprintRef = React.useRef(savedFingerprint);
  const propertiesPanelScrollPositionRef = React.useRef(0);
  const preservedBlockIdRef = React.useRef<string | null>(null);
  const aiStudioOpenTimerRef = React.useRef<ReturnType<
    typeof window.setTimeout
  > | null>(null);
  const aiStudioCleanupTimerRef = React.useRef<ReturnType<
    typeof window.setTimeout
  > | null>(null);
  const pendingExitAfterAICloseRef = React.useRef(false);
  const isRestoringPropertiesPanelRef = React.useRef(false);

  React.useEffect(() => {
    loadStudioCampaignRef.current = studio.loadCampaign;
  }, [studio.loadCampaign]);

  React.useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  React.useEffect(() => {
    saveStatusRef.current = saveStatus;
  }, [saveStatus]);

  React.useEffect(() => {
    savedFingerprintRef.current = savedFingerprint;
  }, [savedFingerprint]);

  const currentSnapshot = React.useMemo<StudioCampaignSnapshot>(
    () => ({
      campaignName: studio.campaignName,
      campaignStatus: studio.campaignStatus,
      subjectLine: studio.subjectLine,
      previewText: studio.previewText,
      senderName: studio.senderName,
      senderEmail: studio.senderEmail,
      blocks: studio.blocks,
    }),
    [
      studio.blocks,
      studio.campaignName,
      studio.campaignStatus,
      studio.previewText,
      studio.senderEmail,
      studio.senderName,
      studio.subjectLine,
    ],
  );

  React.useEffect(() => {
    currentSnapshotRef.current = currentSnapshot;
  }, [currentSnapshot]);

  const currentFingerprint = React.useMemo(
    () => buildStudioFingerprint(currentSnapshot),
    [currentSnapshot],
  );

  const hasUnsavedChanges =
    !isLoading && currentFingerprint !== savedFingerprint;
  const activeCanvasDragBlock = React.useMemo(
    () =>
      activeCanvasDragBlockId
        ? (studio.blocks.find(
            (block) => block.id === activeCanvasDragBlockId,
          ) ?? null)
        : null,
    [activeCanvasDragBlockId, studio.blocks],
  );
  const effectivePropertiesPanelOpen =
    studio.isPropertiesPanelOpen && !propertiesPanelSuppressed;

  const retryLoadCampaign = React.useCallback(() => {
    setLoadRevision((current) => current + 1);
  }, []);

  const clearAIChoreographyTimers = React.useCallback(() => {
    if (aiStudioOpenTimerRef.current !== null) {
      window.clearTimeout(aiStudioOpenTimerRef.current);
      aiStudioOpenTimerRef.current = null;
    }

    if (aiStudioCleanupTimerRef.current !== null) {
      window.clearTimeout(aiStudioCleanupTimerRef.current);
      aiStudioCleanupTimerRef.current = null;
    }
  }, []);

  const restoreAIStudioInteractionState = React.useCallback(() => {
    const nextSelectedBlockId =
      preservedBlockIdRef.current ?? preservedBlockId ?? studio.selectedBlockId;

    if (nextSelectedBlockId && studio.selectedBlockId !== nextSelectedBlockId) {
      studio.selectBlock(nextSelectedBlockId);
    }

    setAIStudioOpen(false);
    setPropertiesPanelSuppressed(false);
  }, [preservedBlockId, studio]);

  const saveDraft = React.useCallback(
    async (options?: { silent?: boolean }) => {
      if (!campaignId || isLoadingRef.current) {
        return null;
      }

      const record = campaignRecordRef.current;
      const snapshot = currentSnapshotRef.current;

      if (!record || !snapshot) {
        return null;
      }

      if (savePromiseRef.current) {
        pendingSaveRequestedRef.current = true;
        return savePromiseRef.current;
      }

      const fingerprint = buildStudioFingerprint(snapshot);

      if (fingerprint === savedFingerprintRef.current) {
        if (!options?.silent) {
          setSaveStatus("saved");
          setSaveMessage("All changes saved");
        }
        return campaignId;
      }

      const contentBlocks = toPersistedContentBlocks(snapshot.blocks);
      const sourceSegmentId =
        typeof record.metadata.sourceSegmentId === "string"
          ? record.metadata.sourceSegmentId
          : null;
      const sourcePersonaId =
        typeof record.metadata.sourcePersonaId === "string"
          ? record.metadata.sourcePersonaId
          : null;

      setSaveStatus("saving");
      setSaveMessage(
        options?.silent ? "Saving changes..." : "Saving campaign...",
      );

      const savePromise = persistCampaignDraft({
        campaignId,
        expectedUpdatedAt: latestUpdatedAtRef.current,
        campaignType: "email",
        status: record.status,
        name: snapshot.campaignName.trim() || "Untitled Campaign",
        subjectLine: snapshot.subjectLine,
        preheaderText: snapshot.previewText,
        senderName: snapshot.senderName,
        senderEmail: snapshot.senderEmail,
        fromEmailDomainId: record.fromEmailDomainId,
        replyTo: record.replyTo,
        contentBlocks,
        smsMessage: record.smsMessage,
        sendAt: record.scheduledAt ? new Date(record.scheduledAt) : null,
        sendImmediately: !record.scheduledAt,
        segments: record.segments,
        personas: record.personas,
        sourceContentTaskId: record.sourceContentTaskId,
        sourceSegmentId,
        sourcePersonaId,
      })
        .then((savedCampaign) => {
          latestUpdatedAtRef.current = savedCampaign.updatedAt;
          savedFingerprintRef.current = fingerprint;
          campaignRecordRef.current = {
            ...record,
            ...savedCampaign,
            contentBlocks,
            metadata: {
              ...record.metadata,
              replyTo: record.replyTo,
              sourceSegmentId,
              sourcePersonaId,
              contentBlocks,
            },
          };
          setSavedFingerprint(fingerprint);
          setLastSavedAt(savedCampaign.updatedAt ?? new Date().toISOString());
          setSaveStatus("saved");
          setSaveMessage("All changes saved");
          return savedCampaign.id;
        })
        .catch((error) => {
          if (error instanceof CampaignDraftConflictError) {
            setSaveStatus("conflict");
            setSaveMessage(error.message);
            setExternalUpdateMessage(
              "This campaign changed in another tab. Reload before continuing.",
            );
            return null;
          }

          setSaveStatus(options?.silent ? "error" : "failed");
          setSaveMessage("Could not save campaign changes.");
          return null;
        })
        .finally(() => {
          savePromiseRef.current = null;

          if (pendingSaveRequestedRef.current) {
            pendingSaveRequestedRef.current = false;
            void saveDraft({ silent: true });
          }
        });

      savePromiseRef.current = savePromise;
      return savePromise;
    },
    [campaignId],
  );

  const handleSave = React.useCallback(() => {
    void saveDraft({ silent: false });
  }, [saveDraft]);

  const completeExit = React.useCallback(async () => {
    if (hasUnsavedChanges || saveStatus === "saving") {
      const savedId = await saveDraft({ silent: false });

      if (!savedId) {
        return;
      }
    }

    navigate(editorPath);
  }, [editorPath, hasUnsavedChanges, navigate, saveDraft, saveStatus]);

  const finalizeAIChoreography = React.useCallback(() => {
    clearAIChoreographyTimers();
    isRestoringPropertiesPanelRef.current = false;
    setAIStudioOpen(false);
    setPropertiesPanelSuppressed(false);
    setPreservedScrollPosition(null);
    setPreservedBlockId(null);
    preservedBlockIdRef.current = null;

    if (pendingExitAfterAICloseRef.current) {
      pendingExitAfterAICloseRef.current = false;
      void completeExit();
    }
  }, [clearAIChoreographyTimers, completeExit]);

  const handleAIStudioClose = React.useCallback(() => {
    clearAIChoreographyTimers();
    isRestoringPropertiesPanelRef.current = true;
    restoreAIStudioInteractionState();

    aiStudioCleanupTimerRef.current = window.setTimeout(() => {
      if (isRestoringPropertiesPanelRef.current) {
        finalizeAIChoreography();
      }
    }, STUDIO_AI_SEQUENCE_CLEANUP_MS);
  }, [
    clearAIChoreographyTimers,
    finalizeAIChoreography,
    restoreAIStudioInteractionState,
  ]);

  const handleRequestAIImage = React.useCallback(
    (request: StudioImageAIRequest) => {
      const nextSelectedBlockId = request.blockId ?? studio.selectedBlockId;

      if (!nextSelectedBlockId) {
        return;
      }

      const normalizedRequest: StudioImageAIRequest = {
        ...request,
        blockId: nextSelectedBlockId,
      };

      if (aiStudioOpen || isAIImageStudioDrawerOpen) {
        updateAIImageStudioContext(
          buildStudioAIContextUpdate(normalizedRequest),
        );
        updateAIImageStudioOnSelect(
          buildStudioAISelectHandler(normalizedRequest),
        );
        return;
      }

      clearAIChoreographyTimers();
      pendingExitAfterAICloseRef.current = false;
      isRestoringPropertiesPanelRef.current = false;
      preservedBlockIdRef.current = nextSelectedBlockId;
      setPreservedBlockId(nextSelectedBlockId);
      setPreservedScrollPosition(propertiesPanelScrollPositionRef.current);
      setPropertiesPanelSuppressed(true);
      setAIStudioOpen(true);

      aiStudioOpenTimerRef.current = window.setTimeout(
        () => {
          openAIImageStudio({
            assignmentLabel: normalizedRequest.assignmentLabel,
            aspectRatioHint: resolveStudioAIAspectRatio(
              normalizedRequest.aiAspectRatioHint,
            ),
            blockId: nextSelectedBlockId,
            campaignContext: normalizedRequest.campaignContext,
            channel: "newsletter",
            contentContext: normalizedRequest.blockContext,
            contextLabel: normalizedRequest.blockContext,
            contextType: normalizedRequest.contextType ?? "email_block",
            defaultTab: "ai",
            multiBlockFlow: normalizedRequest.multiBlockFlow
              ? {
                  advanceToNextTarget: () => {
                    const nextTarget =
                      normalizedRequest.multiBlockFlow?.advanceToNextTarget() ??
                      null;

                    if (!nextTarget) {
                      return null;
                    }

                    updateAIImageStudioContext(
                      buildStudioAIContextUpdate(nextTarget),
                    );
                    updateAIImageStudioOnSelect(
                      buildStudioAISelectHandler(nextTarget),
                    );

                    return {
                      assignmentLabel: nextTarget.assignmentLabel,
                      blockId: nextTarget.blockId,
                      campaignContext: nextTarget.campaignContext,
                      contentContext: nextTarget.blockContext,
                      contextLabel: nextTarget.blockContext,
                      contextType: nextTarget.contextType ?? "email_block",
                      onSelect: buildStudioAISelectHandler(nextTarget),
                    };
                  },
                  hasNextTarget: () =>
                    normalizedRequest.multiBlockFlow?.hasNextTarget() ?? false,
                }
              : undefined,
            onClose: handleAIStudioClose,
            onSelect: (imageUrl, metadata) => {
              try {
                const selectionResult = normalizedRequest.onSelect?.(
                  imageUrl,
                  metadata,
                );

                if (
                  selectionResult &&
                  typeof (selectionResult as Promise<void>).then === "function"
                ) {
                  void selectionResult
                    .then(() => {
                      restoreAIStudioInteractionState();
                    })
                    .catch((error) => {
                      console.error(
                        "Campaign Studio AI image selection failed",
                        error,
                      );
                      restoreAIStudioInteractionState();
                    });

                  return;
                }

                restoreAIStudioInteractionState();
              } catch (error) {
                console.error(
                  "Campaign Studio AI image selection failed",
                  error,
                );
                restoreAIStudioInteractionState();
              }
            },
          });
        },
        isMobileViewport ? 200 : STUDIO_AI_PANEL_COLLAPSE_MS,
      );
    },
    [
      aiStudioOpen,
      clearAIChoreographyTimers,
      handleAIStudioClose,
      isAIImageStudioDrawerOpen,
      isMobileViewport,
      openAIImageStudio,
      preservedBlockId,
      restoreAIStudioInteractionState,
      studio.selectedBlockId,
      updateAIImageStudioContext,
      updateAIImageStudioOnSelect,
    ],
  );

  const handleTrackCampaignImageUsage = React.useCallback(
    (fieldKey: string, event: StudioImageApplyEvent | null) => {
      if (!event) {
        studio.setCampaignImageFieldSource(fieldKey, null);
        return;
      }

      studio.registerCampaignImage({
        blockLabel: event.blockLabel,
        prompt: event.prompt,
        source: event.gallerySource,
        timestamp: event.timestamp,
        url: event.url,
      });
      studio.setCampaignImageFieldSource(fieldKey, {
        source: event.source,
        timestamp: event.timestamp,
        url: event.url,
      });
    },
    [studio],
  );

  const isEditableTarget = React.useCallback((target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    if (target.isContentEditable) {
      return true;
    }

    return Boolean(
      target.closest(
        "input, textarea, select, [contenteditable='true'], [role='textbox']",
      ),
    );
  }, []);

  const buildApplyEvent = React.useCallback(
    (
      url: string,
      campaignContext: StudioImageAIRequest["campaignContext"],
      metadata?: AIImageStudioSelectionMetadata,
    ): StudioImageApplyEvent => ({
      blockLabel: campaignContext?.blockLabel,
      gallerySource: getCampaignImageSourceFromMetadata(metadata),
      prompt: metadata?.altText || campaignContext?.contentSummary || undefined,
      source: getCampaignImageSourceFromMetadata(metadata),
      timestamp: Date.now(),
      url,
    }),
    [],
  );

  const buildSingleFieldAIRequest = React.useCallback(
    ({
      aiAspectRatioHint,
      applyResolvedUrl,
      assignmentLabel,
      block,
      fieldKey,
    }: {
      aiAspectRatioHint: StudioImageAIAspectRatioHint;
      applyResolvedUrl: (resolvedUrl: string) => void;
      assignmentLabel: string;
      block: StudioBlock;
      fieldKey: string;
    }): StudioImageAIRequest => {
      const campaignContext = buildStudioCampaignContext({
        aspectRatioHint: aiAspectRatioHint,
        block,
        campaignName: studio.campaignName,
        campaignType: activeCampaignType,
      });

      return {
        aiAspectRatioHint,
        assignmentLabel,
        blockContext: assignmentLabel,
        blockId: block.id,
        campaignContext,
        onSelect: async (imageUrl, metadata) => {
          const resolvedImageUrl = await ensureCampaignStudioImageUrl(imageUrl);
          applyResolvedUrl(resolvedImageUrl);
          handleTrackCampaignImageUsage(
            fieldKey,
            buildApplyEvent(resolvedImageUrl, campaignContext, metadata),
          );
        },
      };
    },
    [
      activeCampaignType,
      buildApplyEvent,
      handleTrackCampaignImageUsage,
      studio.campaignName,
    ],
  );

  const buildImageGalleryAIRequest = React.useCallback(
    function buildImageGalleryAIRequest(
      blockId: string,
      slotIndex: number,
      includeFlow = true,
    ): StudioImageAIRequest | null {
      const block = studio.blocks.find((item) => item.id === blockId);

      if (!block || block.type !== "image-gallery") {
        return null;
      }

      const slotCount = Math.max(
        getImageGallerySlotCount(block),
        block.galleryImages?.length ?? 0,
      );
      const assignmentLabel = `Image Gallery — Slot ${slotIndex + 1} of ${slotCount}`;
      const campaignContext = buildStudioCampaignContext({
        aspectRatioHint: "square",
        block,
        campaignName: studio.campaignName,
        campaignType: activeCampaignType,
      });

      const onSelect: StudioImageAIRequest["onSelect"] = async (
        imageUrl,
        metadata,
      ) => {
        const resolvedImageUrl = await ensureCampaignStudioImageUrl(imageUrl);
        const latestBlock = studio.blocks.find((item) => item.id === blockId);

        if (!latestBlock || latestBlock.type !== "image-gallery") {
          return;
        }

        const nextImages = [...(latestBlock.galleryImages ?? [])];
        const currentImage = nextImages[slotIndex];
        nextImages[slotIndex] = currentImage
          ? { ...currentImage, url: resolvedImageUrl }
          : ({
              id: crypto.randomUUID(),
              url: resolvedImageUrl,
              alt: "",
              linkUrl: "",
            } satisfies GalleryImage);

        studio.updateBlockField(
          blockId,
          "galleryImages",
          nextImages.filter((image): image is GalleryImage => Boolean(image)),
        );
        handleTrackCampaignImageUsage(
          getImageGalleryFieldKey(blockId, slotIndex),
          buildApplyEvent(resolvedImageUrl, campaignContext, metadata),
        );
      };

      const slotIndexes = Array.from(
        { length: slotCount - slotIndex },
        (_, offset) => slotIndex + offset,
      );

      return {
        aiAspectRatioHint: "square",
        assignmentLabel,
        blockContext: assignmentLabel,
        blockId,
        campaignContext,
        multiBlockFlow:
          includeFlow && slotIndexes.length > 1
            ? (() => {
                let currentIndex = 0;

                return {
                  advanceToNextTarget: () => {
                    const nextSlotIndex = slotIndexes[currentIndex + 1];

                    if (nextSlotIndex === undefined) {
                      return null;
                    }

                    currentIndex += 1;
                    return buildImageGalleryAIRequest(
                      blockId,
                      nextSlotIndex,
                      false,
                    );
                  },
                  hasNextTarget: () => currentIndex + 1 < slotIndexes.length,
                };
              })()
            : undefined,
        onSelect,
      };
    },
    [
      activeCampaignType,
      buildApplyEvent,
      handleTrackCampaignImageUsage,
      studio.blocks,
      studio.campaignName,
      studio.updateBlockField,
    ],
  );

  const buildProductGalleryAIRequest = React.useCallback(
    function buildProductGalleryAIRequest(
      blockId: string,
      productIndex: number,
      includeFlow = true,
    ): StudioImageAIRequest | null {
      const block = studio.blocks.find((item) => item.id === blockId);

      if (!block || block.type !== "product-gallery") {
        return null;
      }

      const products = block.galleryProducts ?? [];
      const product = products[productIndex];

      if (!product) {
        return null;
      }

      const assignmentLabel = `Product Gallery — Cell ${productIndex + 1} of ${products.length}`;
      const campaignContext = buildStudioCampaignContext({
        aspectRatioHint: "portrait",
        block,
        campaignName: studio.campaignName,
        campaignType: activeCampaignType,
      });

      const onSelect: StudioImageAIRequest["onSelect"] = async (
        imageUrl,
        metadata,
      ) => {
        const resolvedImageUrl = await ensureCampaignStudioImageUrl(imageUrl);
        const latestBlock = studio.blocks.find((item) => item.id === blockId);

        if (!latestBlock || latestBlock.type !== "product-gallery") {
          return;
        }

        const nextProducts = (latestBlock.galleryProducts ?? []).map(
          (entry, index) =>
            index === productIndex
              ? { ...entry, imageUrl: resolvedImageUrl }
              : entry,
        );

        studio.updateBlockField(
          blockId,
          "galleryProducts",
          nextProducts as GalleryProduct[],
        );
        handleTrackCampaignImageUsage(
          getProductGalleryFieldKey(blockId, product.id),
          buildApplyEvent(resolvedImageUrl, campaignContext, metadata),
        );
      };

      const remainingIndexes = Array.from(
        { length: products.length - productIndex },
        (_, offset) => productIndex + offset,
      );

      return {
        aiAspectRatioHint: "portrait",
        assignmentLabel,
        blockContext: assignmentLabel,
        blockId,
        campaignContext,
        multiBlockFlow:
          includeFlow && remainingIndexes.length > 1
            ? (() => {
                let currentIndex = 0;

                return {
                  advanceToNextTarget: () => {
                    const nextProductIndex = remainingIndexes[currentIndex + 1];

                    if (nextProductIndex === undefined) {
                      return null;
                    }

                    currentIndex += 1;
                    return buildProductGalleryAIRequest(
                      blockId,
                      nextProductIndex,
                      false,
                    );
                  },
                  hasNextTarget: () =>
                    currentIndex + 1 < remainingIndexes.length,
                };
              })()
            : undefined,
        onSelect,
      };
    },
    [
      activeCampaignType,
      buildApplyEvent,
      handleTrackCampaignImageUsage,
      studio.blocks,
      studio.campaignName,
      studio.updateBlockField,
    ],
  );

  const buildDefaultAIRequestForSelectedBlock = React.useCallback(() => {
    const selectedBlock = studio.blocks.find(
      (block) => block.id === studio.selectedBlockId,
    );

    if (!selectedBlock) {
      return null;
    }

    switch (selectedBlock.type) {
      case "email-safe-hero":
        if (
          selectedBlock.heroStyle !== "image-overlay" &&
          selectedBlock.heroStyle !== "image-bottom"
        ) {
          return null;
        }

        return buildSingleFieldAIRequest({
          aiAspectRatioHint: "landscape",
          applyResolvedUrl: (resolvedUrl) =>
            studio.updateBlockField(selectedBlock.id, "imageUrl", resolvedUrl),
          assignmentLabel:
            selectedBlock.heroStyle === "image-overlay"
              ? "Email Safe Hero background image"
              : "Email Safe Hero hero image",
          block: selectedBlock,
          fieldKey: `${selectedBlock.id}:imageUrl`,
        });
      case "image-text":
        return buildSingleFieldAIRequest({
          aiAspectRatioHint: "square",
          applyResolvedUrl: (resolvedUrl) =>
            studio.updateBlockField(selectedBlock.id, "imageUrl", resolvedUrl),
          assignmentLabel: "Image + Text image",
          block: selectedBlock,
          fieldKey: `${selectedBlock.id}:imageUrl`,
        });
      case "graphic-hero":
        return buildSingleFieldAIRequest({
          aiAspectRatioHint: "landscape",
          applyResolvedUrl: (resolvedUrl) =>
            studio.updateBlockField(selectedBlock.id, "imageUrl", resolvedUrl),
          assignmentLabel: "Graphic Hero image",
          block: selectedBlock,
          fieldKey: `${selectedBlock.id}:imageUrl`,
        });
      case "full-width-image":
        return buildSingleFieldAIRequest({
          aiAspectRatioHint: "landscape",
          applyResolvedUrl: (resolvedUrl) =>
            studio.updateBlockField(selectedBlock.id, "imageUrl", resolvedUrl),
          assignmentLabel: "Full-Width Image block image",
          block: selectedBlock,
          fieldKey: `${selectedBlock.id}:imageUrl`,
        });
      case "newsletter-header":
        return buildSingleFieldAIRequest({
          aiAspectRatioHint: "landscape",
          applyResolvedUrl: (resolvedUrl) =>
            studio.updateBlockField(selectedBlock.id, "logoUrl", resolvedUrl),
          assignmentLabel: "Newsletter Header logo",
          block: selectedBlock,
          fieldKey: `${selectedBlock.id}:logoUrl`,
        });
      case "footer":
        return buildSingleFieldAIRequest({
          aiAspectRatioHint: "landscape",
          applyResolvedUrl: (resolvedUrl) =>
            studio.updateBlockField(selectedBlock.id, "logoUrl", resolvedUrl),
          assignmentLabel: "Footer logo",
          block: selectedBlock,
          fieldKey: `${selectedBlock.id}:logoUrl`,
        });
      case "quote":
        return buildSingleFieldAIRequest({
          aiAspectRatioHint: "square",
          applyResolvedUrl: (resolvedUrl) => {
            studio.updateBlockField(
              selectedBlock.id,
              "authorImageUrl",
              resolvedUrl,
            );
            studio.updateBlockField(
              selectedBlock.id,
              "authorAvatarUrl",
              resolvedUrl,
            );
          },
          assignmentLabel: "Quote author image",
          block: selectedBlock,
          fieldKey: `${selectedBlock.id}:authorImageUrl`,
        });
      case "product-card":
        return buildSingleFieldAIRequest({
          aiAspectRatioHint: "portrait",
          applyResolvedUrl: (resolvedUrl) =>
            studio.updateBlockField(selectedBlock.id, "imageUrl", resolvedUrl),
          assignmentLabel: "Product Card image",
          block: selectedBlock,
          fieldKey: `${selectedBlock.id}:imageUrl`,
        });
      case "image-gallery": {
        const slotCount = Math.max(
          getImageGallerySlotCount(selectedBlock),
          selectedBlock.galleryImages?.length ?? 0,
        );
        const firstEmptySlotIndex =
          (selectedBlock.galleryImages?.length ?? 0) < slotCount
            ? (selectedBlock.galleryImages?.length ?? 0)
            : 0;

        return buildImageGalleryAIRequest(
          selectedBlock.id,
          firstEmptySlotIndex,
        );
      }
      case "product-gallery": {
        const products = selectedBlock.galleryProducts ?? [];

        if (products.length === 0) {
          return null;
        }

        const firstEmptyProductIndex = products.findIndex(
          (product) => !product.imageUrl?.trim(),
        );

        return buildProductGalleryAIRequest(
          selectedBlock.id,
          firstEmptyProductIndex >= 0 ? firstEmptyProductIndex : 0,
        );
      }
      default:
        return null;
    }
  }, [
    buildImageGalleryAIRequest,
    buildProductGalleryAIRequest,
    buildSingleFieldAIRequest,
    studio.blocks,
    studio.selectedBlockId,
    studio.updateBlockField,
  ]);

  const handleStudioTreeKeyDown = React.useCallback<
    React.KeyboardEventHandler<HTMLElement>
  >(
    (event) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      const modifier = event.metaKey || event.ctrlKey;

      if (!modifier || !event.shiftKey || key !== "g") {
        return;
      }

      const request = buildDefaultAIRequestForSelectedBlock();

      if (!request) {
        return;
      }

      event.preventDefault();
      handleRequestAIImage(request);
    },
    [
      buildDefaultAIRequestForSelectedBlock,
      handleRequestAIImage,
      isEditableTarget,
    ],
  );

  const handlePropertiesPanelRestoreComplete = React.useCallback(() => {
    if (!isRestoringPropertiesPanelRef.current) {
      return;
    }

    finalizeAIChoreography();
  }, [finalizeAIChoreography]);

  const handleExit = React.useCallback(async () => {
    if (aiStudioOpen) {
      pendingExitAfterAICloseRef.current = true;

      if (isAIImageStudioDrawerOpen) {
        closeAIImageStudio();
      } else {
        finalizeAIChoreography();
      }

      return;
    }

    await completeExit();
  }, [
    aiStudioOpen,
    closeAIImageStudio,
    completeExit,
    finalizeAIChoreography,
    isAIImageStudioDrawerOpen,
  ]);

  React.useEffect(() => {
    return () => {
      clearAIChoreographyTimers();

      if (isAIImageStudioDrawerOpen) {
        closeAIImageStudio();
      }
    };
  }, [
    clearAIChoreographyTimers,
    closeAIImageStudio,
    isAIImageStudioDrawerOpen,
  ]);

  useBeforeUnload({
    when: hasUnsavedChanges || saveStatus === "saving",
    onBeforeUnload: () => {
      if (hasUnsavedChanges) {
        void saveDraft({ silent: true });
      }
    },
  });

  React.useEffect(() => {
    if (!campaignId) {
      setIsLoading(false);
      setLoadError("Campaign Studio requires a campaign id.");
      return;
    }

    let cancelled = false;

    const loadCampaign = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const record = await fetchCampaignEditorRecord(campaignId);

        if (cancelled) {
          return;
        }

        const snapshot = toStudioSnapshot(record);
        const fingerprint = buildStudioFingerprint(snapshot);

        campaignRecordRef.current = record;
        latestUpdatedAtRef.current = record.updatedAt;
        currentSnapshotRef.current = snapshot;
        loadStudioCampaignRef.current(snapshot);
        savedFingerprintRef.current = fingerprint;
        setSavedFingerprint(fingerprint);
        setLastSavedAt(record.updatedAt);
        setSaveStatus("idle");
        setSaveMessage(null);
        setExternalUpdateMessage(null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setLoadError(
          error instanceof Error ? error.message : "Failed to load campaign.",
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadCampaign();

    return () => {
      cancelled = true;
    };
  }, [campaignId, loadRevision]);

  React.useEffect(() => {
    if (
      !hasUnsavedChanges ||
      saveStatus === "saving" ||
      saveStatus === "conflict"
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void saveDraft({ silent: true });
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [hasUnsavedChanges, saveDraft, saveStatus]);

  React.useEffect(() => {
    if (saveStatus !== "saved" || hasUnsavedChanges) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSaveStatus((current) => (current === "saved" ? "idle" : current));
    }, SAVE_FEEDBACK_RESET_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [hasUnsavedChanges, saveStatus]);

  React.useEffect(() => {
    if (!campaignId) {
      return;
    }

    if (channelRef.current) {
      return;
    }

    let isDisposed = false;
    let connectTimerId: ReturnType<typeof window.setTimeout> | null = null;

    const subscribeToCampaignChanges = () => {
      if (isDisposed || channelRef.current) {
        return;
      }

      if (isLoadingRef.current) {
        connectTimerId = window.setTimeout(
          subscribeToCampaignChanges,
          STUDIO_CHANNEL_RETRY_INTERVAL_MS,
        );
        return;
      }

      const channel = supabase
        .channel(`campaign-studio-${campaignId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "crm_campaigns",
            filter: `id=eq.${campaignId}`,
          },
          (payload) => {
            const nextUpdatedAt =
              typeof payload.new.updated_at === "string"
                ? payload.new.updated_at
                : null;

            if (!nextUpdatedAt || saveStatusRef.current === "saving") {
              return;
            }

            if (
              latestUpdatedAtRef.current &&
              nextUpdatedAt === latestUpdatedAtRef.current
            ) {
              return;
            }

            setExternalUpdateMessage(
              "This campaign changed in another tab. Reload before continuing.",
            );
          },
        )
        .subscribe();

      channelRef.current = channel;
      connectTimerId = null;
    };

    connectTimerId = window.setTimeout(
      subscribeToCampaignChanges,
      STUDIO_CHANNEL_CONNECT_DELAY_MS,
    );

    return () => {
      isDisposed = true;

      if (connectTimerId !== null) {
        window.clearTimeout(connectTimerId);
      }

      const currentChannel = channelRef.current;
      channelRef.current = null;

      if (currentChannel) {
        void supabase.removeChannel(currentChannel);
      }
    };
  }, [campaignId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
  );

  const collisionDetection = React.useCallback<CollisionDetection>((args) => {
    const activeData = args.active.data.current as StudioDragData | undefined;

    if (activeData?.kind === "library-block") {
      const insertionContainers = args.droppableContainers.filter(
        (container) => {
          return parseStudioInsertionDropId(container.id) !== null;
        },
      );

      const insertionHits = pointerWithin({
        ...args,
        droppableContainers: insertionContainers,
      });

      if (insertionHits.length > 0) {
        return insertionHits;
      }

      const canvasContainers = args.droppableContainers.filter((container) => {
        return (
          container.id === STUDIO_CANVAS_APPEND_DROP_ID ||
          container.id === STUDIO_CANVAS_EMPTY_DROP_ID
        );
      });

      const canvasHits = pointerWithin({
        ...args,
        droppableContainers: canvasContainers,
      });

      if (canvasHits.length > 0) {
        return canvasHits;
      }

      return closestCenter({
        ...args,
        droppableContainers: [...insertionContainers, ...canvasContainers],
      });
    }

    const sortableContainers = args.droppableContainers.filter((container) => {
      return container.data.current?.kind === "canvas-block";
    });

    const pointerHits = pointerWithin({
      ...args,
      droppableContainers: sortableContainers,
    });

    if (pointerHits.length > 0) {
      return pointerHits;
    }

    return closestCenter({
      ...args,
      droppableContainers: sortableContainers,
    });
  }, []);

  const handleDragStart = React.useCallback(
    (event: DragStartEvent) => {
      const activeData = event.active.data.current as
        | StudioDragData
        | undefined;

      if (activeData?.kind === "library-block") {
        setActiveCanvasDragBlockId(null);
        studio.beginSidebarDrag(activeData.blockType);
        return;
      }

      if (activeData?.kind === "canvas-block") {
        setActiveCanvasDragBlockId(activeData.blockId);
      } else {
        setActiveCanvasDragBlockId(null);
      }

      studio.clearSidebarDragState();
    },
    [studio],
  );

  const handleDragOver = React.useCallback(
    (event: DragOverEvent) => {
      const activeData = event.active.data.current as
        | StudioDragData
        | undefined;

      if (activeData?.kind !== "library-block") {
        return;
      }

      const insertionIndex = parseStudioInsertionDropId(event.over?.id);

      if (insertionIndex !== null) {
        studio.setActiveDropIndex(insertionIndex);
        studio.setIsDraggingOverCanvas(true);
        return;
      }

      if (
        event.over?.id === STUDIO_CANVAS_APPEND_DROP_ID ||
        event.over?.id === STUDIO_CANVAS_EMPTY_DROP_ID
      ) {
        studio.setActiveDropIndex(null);
        studio.setIsDraggingOverCanvas(true);
        return;
      }

      studio.setActiveDropIndex(null);
      studio.setIsDraggingOverCanvas(false);
    },
    [studio],
  );

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const activeData = event.active.data.current as
        | StudioDragData
        | undefined;
      const overId = event.over?.id;

      if (activeData?.kind === "library-block") {
        const insertIndex = parseStudioInsertionDropId(overId);

        if (insertIndex !== null) {
          studio.addBlock(activeData.blockType, insertIndex);
        } else if (
          overId === STUDIO_CANVAS_APPEND_DROP_ID ||
          overId === STUDIO_CANVAS_EMPTY_DROP_ID
        ) {
          studio.addBlock(activeData.blockType);
        }

        setActiveCanvasDragBlockId(null);
        studio.clearSidebarDragState();
        return;
      }

      if (activeData?.kind === "canvas-block" && event.over) {
        const fromIndex = studio.blocks.findIndex(
          (block) => block.id === event.active.id,
        );
        const toIndex = studio.blocks.findIndex(
          (block) => block.id === event.over?.id,
        );

        if (fromIndex >= 0 && toIndex >= 0) {
          studio.moveBlock(fromIndex, toIndex);
        }
      }

      setActiveCanvasDragBlockId(null);
      studio.clearSidebarDragState();
    },
    [studio],
  );

  const handleDragCancel = React.useCallback(() => {
    setActiveCanvasDragBlockId(null);
    studio.clearSidebarDragState();
  }, [studio]);

  const handleFocusBlock = React.useCallback(
    (blockId: string) => {
      studio.selectBlock(blockId);

      requestAnimationFrame(() => {
        const blockElement = document.querySelector(
          `[data-studio-block-id="${blockId}"]`,
        );

        if (blockElement instanceof HTMLElement) {
          blockElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    },
    [studio],
  );

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }

      const key = event.key.toLowerCase();
      const modifier = event.metaKey || event.ctrlKey;

      if (modifier && key === "s") {
        event.preventDefault();
        void saveDraft({ silent: false });
        return;
      }

      if (aiStudioOpen) {
        return;
      }

      if (modifier && key === "z") {
        event.preventDefault();

        if (event.shiftKey) {
          console.log("Campaign Studio redo shortcut triggered");
        } else {
          console.log("Campaign Studio undo shortcut triggered");
        }

        return;
      }

      if (key === "escape") {
        studio.selectBlock(null);
        return;
      }

      if ((key === "delete" || key === "backspace") && studio.selectedBlockId) {
        event.preventDefault();
        studio.removeBlock(studio.selectedBlockId);
        return;
      }

      if (key === "tab" && studio.selectedBlockId) {
        event.preventDefault();
        studio.selectAdjacentBlock(event.shiftKey ? "previous" : "next");
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [aiStudioOpen, isEditableTarget, saveDraft, studio]);

  if (!campaignId) {
    return (
      <Sheet
        component="main"
        sx={{
          width: "100vw",
          height: "100vh",
          display: "grid",
          placeItems: "center",
          bgcolor: "background.surface",
        }}
      >
        <Stack spacing={2} alignItems="center">
          <Typography level="title-md">Campaign not found</Typography>
          <Button variant="solid" onClick={() => navigate("/crm/campaigns")}>
            Back to Campaigns
          </Button>
        </Stack>
      </Sheet>
    );
  }

  if (isLoading) {
    return <StudioShellSkeleton />;
  }

  if (loadError) {
    return (
      <Sheet
        component="main"
        sx={{
          width: "100vw",
          height: "100vh",
          display: "grid",
          placeItems: "center",
          bgcolor: "background.surface",
          px: 3,
        }}
      >
        <Stack spacing={2} alignItems="center" sx={{ maxWidth: 420 }}>
          <Sheet
            variant="soft"
            color="danger"
            sx={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AlertTriangle size={24} />
          </Sheet>
          <Typography level="title-md">
            Unable to load campaign studio
          </Typography>
          <Typography
            level="body-sm"
            sx={{ color: "neutral.600", textAlign: "center" }}
          >
            {loadError}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              color="neutral"
              onClick={() => navigate(editorPath)}
            >
              Back
            </Button>
            <Button
              variant="solid"
              startDecorator={<RefreshCw size={16} />}
              onClick={retryLoadCampaign}
            >
              Retry
            </Button>
          </Stack>
        </Stack>
      </Sheet>
    );
  }

  return (
    <Sheet
      component="main"
      onKeyDownCapture={handleStudioTreeKeyDown}
      sx={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        bgcolor: "background.surface",
        display: "grid",
        gridTemplateRows: "52px minmax(0, 1fr) 36px",
        "& button, & [role='button'], & input, & textarea": {
          transition: "all 120ms ease",
        },
        "& button:focus-visible, & [role='button']:focus-visible, & input:focus-visible, & textarea:focus-visible":
          {
            outline: "1.5px solid",
            outlineColor: "primary.300",
            outlineOffset: "2px",
          },
      }}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <Box
          sx={{
            position: "relative",
            zIndex:
              aiStudioOpen && !isMobileViewport
                ? (theme) => (theme.vars.zIndex.modal ?? theme.zIndex.modal) + 2
                : 1,
          }}
        >
          <StudioTopBar
            campaignId={campaignId}
            campaignName={studio.campaignName}
            onCampaignNameChange={studio.setCampaignName}
            campaignStatus={studio.campaignStatus}
            blockCount={studio.blocks.length}
            blocks={studio.blocks}
            deviceMode={studio.deviceMode}
            onDeviceModeChange={studio.setDeviceMode}
            subjectLine={studio.subjectLine}
            onSubjectLineChange={studio.setSubjectLine}
            previewText={studio.previewText}
            onPreviewTextChange={studio.setPreviewText}
            senderName={studio.senderName}
            onSenderNameChange={studio.setSenderName}
            senderEmail={studio.senderEmail}
            onSenderEmailChange={studio.setSenderEmail}
            saveStatus={saveStatus}
            saveMessage={saveMessage}
            hasUnsavedChanges={hasUnsavedChanges}
            externalUpdateMessage={externalUpdateMessage}
            onDismissExternalUpdate={() => setExternalUpdateMessage(null)}
            onSave={handleSave}
            onExit={() => {
              void handleExit();
            }}
            lastSavedAt={lastSavedAt}
          />
        </Box>

        <SortableContext
          items={studio.blocks.map((block) => block.id)}
          strategy={verticalListSortingStrategy}
        >
          <Box
            sx={{
              minHeight: 0,
              display: "grid",
              transition:
                "grid-template-columns 200ms cubic-bezier(0.4, 0, 0.2, 1)",
              gridTemplateColumns: {
                xs: "minmax(0, 1fr)",
                md: `264px minmax(0, 1fr) ${effectivePropertiesPanelOpen ? 340 : 0}px`,
              },
            }}
          >
            <Sheet
              sx={{
                display: { xs: "none", md: "flex" },
                minHeight: 0,
                bgcolor: "background.surface",
              }}
            >
              <BlockLibrary
                blocks={studio.blocks}
                onAddBlock={studio.addBlock}
                onSelectBlock={handleFocusBlock}
              />
            </Sheet>

            <Box
              sx={{
                minWidth: 0,
                minHeight: 0,
                pointerEvents: aiStudioOpen ? "none" : "auto",
              }}
            >
              <StudioCanvas
                blocks={studio.blocks}
                selectedBlockId={studio.selectedBlockId}
                canvasWidth={studio.canvasWidth}
                activeDropIndex={studio.activeDropIndex}
                isSidebarDragActive={Boolean(studio.activeSidebarDragBlock)}
                isDraggingOverCanvas={studio.isDraggingOverCanvas}
                recentlyAddedBlockId={studio.recentlyAddedBlockId}
                removingBlockIds={studio.removingBlockIds}
                onReorder={(blockId, instruction) => {
                  if (instruction.kind === "direction") {
                    studio.reorderBlock(blockId, instruction.direction);
                  }
                }}
                onSelect={studio.selectBlock}
                onDelete={studio.removeBlock}
                onDuplicate={studio.duplicateBlock}
                onInsertAt={(index, blockType) =>
                  studio.addBlock(blockType, index)
                }
                onDoubleClickBlock={studio.logFocusFirstPropertyField}
                onUpdateBlockField={studio.updateBlockField}
              />
            </Box>

            <BlockPropertiesPanel
              campaignImageGallery={studio.campaignImageGallery}
              campaignName={studio.campaignName}
              campaignType={activeCampaignType}
              selectedBlockId={studio.selectedBlockId}
              blocks={studio.blocks}
              open={studio.isPropertiesPanelOpen}
              onClose={() => studio.selectBlock(null)}
              onRequestAIImage={handleRequestAIImage}
              onTrackCampaignImageUsage={handleTrackCampaignImageUsage}
              onRestoreComplete={handlePropertiesPanelRestoreComplete}
              onScrollPositionChange={(scrollTop) => {
                propertiesPanelScrollPositionRef.current = scrollTop;
              }}
              onUpdateBlockField={studio.updateBlockField}
              resolveCampaignImageFieldSource={
                studio.resolveCampaignImageFieldSource
              }
              restoreScrollPosition={preservedScrollPosition}
              suppressed={propertiesPanelSuppressed}
            />
          </Box>
        </SortableContext>

        <StudioBottomBar
          blockCount={studio.blocks.length}
          wordCountEstimate={studio.estimatedWordCount}
          canvasWidth={studio.canvasWidth}
          dropLabel={
            studio.isDraggingOverCanvas
              ? (studio.activeSidebarDragBlock?.label ?? null)
              : null
          }
        />

        <DragOverlay>
          {studio.activeSidebarDragBlock ? (
            <BlockDragOverlay
              type={studio.activeSidebarDragBlock.type}
              label={studio.activeSidebarDragBlock.label}
            />
          ) : activeCanvasDragBlock ? (
            <BlockDragOverlay
              type={activeCanvasDragBlock.type}
              label={activeCanvasDragBlock.label}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </Sheet>
  );
}

export default function CampaignStudioPage() {
  return (
    <DesignSystemProvider>
      <CampaignStudioPageContent />
    </DesignSystemProvider>
  );
}
