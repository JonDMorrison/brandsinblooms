import * as React from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Switch from "@mui/joy/Switch";
import Typography from "@mui/joy/Typography";
import {
  ChevronDown,
  DollarSign,
  GripVertical,
  ImagePlus,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { STUDIO_BLOCK_LOOKUP } from "@/components/crm/studio/blockLibraryData";
import {
  SocialIcon,
  SOCIAL_PLATFORM_LABELS,
  SOCIAL_PLATFORM_ORDER,
} from "@/components/crm/studio/icons/SocialIcons";
import type { StudioBlock } from "@/components/crm/studio/studioCanvasTypes";
import StudioAlignmentToggle from "@/components/crm/studio/fields/StudioAlignmentToggle";
import StudioColorPicker from "@/components/crm/studio/fields/StudioColorPicker";
import StudioImageUpload, {
  ensureCampaignStudioImageUrl,
  type StudioImageApplyEvent,
  type StudioImageAIAspectRatioHint,
  type StudioImageAIRequest,
  uploadStudioImageFile,
} from "@/components/crm/studio/fields/StudioImageUpload";
import type { AIImageStudioSelectionMetadata } from "@/components/crm/ai-image-studio/types";
import LayoutPresetPicker from "@/components/crm/studio/fields/LayoutPresetPicker";
import StudioRichTextField from "@/components/crm/studio/fields/StudioRichTextField";
import StudioSliderField from "@/components/crm/studio/fields/StudioSliderField";
import StudioSwitchField from "@/components/crm/studio/fields/StudioSwitchField";
import StudioTextField from "@/components/crm/studio/fields/StudioTextField";
import StudioToggleField from "@/components/crm/studio/fields/StudioToggleField";
import { useDesignSystem } from "@/contexts/DesignSystemContext";
import type { EditorCampaignType } from "@/lib/crm/campaignEditor";
import {
  getStudioLayoutPresets,
  type LayoutPreset,
} from "@/lib/studio/layoutPresets";
import { buildStudioCampaignContext } from "@/components/crm/studio/studioAIContext";
import type {
  CampaignImageFieldSourceRecord,
  CampaignImageGalleryItem,
} from "@/components/crm/studio/useStudioState";
import type {
  GalleryImage,
  GalleryProduct,
  SocialLink,
  StudioSocialPlatform,
} from "@/types/studioBlocks";

type OnUpdateBlockField = (
  blockId: string,
  field: keyof StudioBlock,
  value: StudioBlock[keyof StudioBlock],
) => void;

type UpdateField = (
  field: keyof StudioBlock,
  value: StudioBlock[keyof StudioBlock],
) => void;

type RequestAIImage = (request: StudioImageAIRequest) => void;

type TrackCampaignImageUsage = (
  fieldKey: string,
  event: StudioImageApplyEvent | null,
) => void;

type ResolveCampaignImageFieldSource = (
  fieldKey: string,
  url?: string,
) => CampaignImageFieldSourceRecord | null;

type BlockPropertiesPanelProps = {
  campaignImageGallery: CampaignImageGalleryItem[];
  campaignName: string;
  campaignType: EditorCampaignType;
  selectedBlockId: string | null;
  blocks: StudioBlock[];
  open: boolean;
  onClose: () => void;
  onRequestAIImage?: RequestAIImage;
  onTrackCampaignImageUsage?: TrackCampaignImageUsage;
  onRestoreComplete?: () => void;
  onScrollPositionChange?: (scrollTop: number) => void;
  onUpdateBlockField: OnUpdateBlockField;
  resolveCampaignImageFieldSource?: ResolveCampaignImageFieldSource;
  restoreScrollPosition?: number | null;
  suppressed?: boolean;
};

type PanelSectionProps = {
  title: string;
  children: React.ReactNode;
};

type CollapsibleSectionProps = {
  label: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
  children: React.ReactNode;
  warningText?: string;
  description?: string;
};

function PanelSection({ title, children }: PanelSectionProps) {
  return (
    <Stack
      spacing={0}
      sx={{
        pb: 1.75,
        maxWidth: "100%",
        boxSizing: "border-box",
      }}
    >
      <Typography
        level="body-xs"
        sx={{
          px: 2.5,
          pt: 2.5,
          pb: 1,
          maxWidth: "100%",
          fontSize: "10px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "primary.400",
        }}
      >
        {title}
      </Typography>
      <Stack
        spacing={1.75}
        sx={{
          px: 2.5,
          minWidth: 0,
          maxWidth: "100%",
          boxSizing: "border-box",
        }}
      >
        {children}
      </Stack>
    </Stack>
  );
}

function CollapsibleSection({
  label,
  enabled,
  onToggle,
  children,
  warningText,
  description,
}: CollapsibleSectionProps) {
  return (
    <Stack
      spacing={enabled ? 1.5 : 0.25}
      sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
    >
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        justifyContent="space-between"
        sx={{ width: "100%", minWidth: 0 }}
      >
        <Stack spacing={0.35} sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            level="body-xs"
            sx={{
              fontSize: "12.5px",
              fontWeight: 650,
              letterSpacing: "0.01em",
              color: "neutral.700",
            }}
          >
            {label}
          </Typography>
          {description ? (
            <Typography
              level="body-xs"
              sx={{ color: "neutral.500", fontSize: "11px", lineHeight: 1.45 }}
            >
              {description}
            </Typography>
          ) : null}
        </Stack>
        <Switch
          size="sm"
          color="primary"
          checked={enabled}
          onChange={(event) => onToggle(event.target.checked)}
          sx={inlineSwitchSx}
        />
      </Stack>
      <Box
        sx={{
          maxHeight: enabled ? "1000px" : "0px",
          overflow: "hidden",
          opacity: enabled ? 1 : 0,
          transition: "max-height 250ms ease, opacity 200ms ease",
          pointerEvents: enabled ? "auto" : "none",
        }}
      >
        <Stack spacing={1.75} sx={{ pt: 0.25 }}>
          {children}
          {warningText ? (
            <Typography
              level="body-xs"
              sx={{ color: "warning.500", fontSize: "11px", lineHeight: 1.45 }}
            >
              {warningText}
            </Typography>
          ) : null}
        </Stack>
      </Box>
    </Stack>
  );
}

const inlineInputSx = {
  width: "100%",
  maxWidth: "100%",
  minWidth: 0,
  boxSizing: "border-box",
  overflow: "hidden",
  borderRadius: "10px",
  "--Input-focusedThickness": "0px",
  "--Input-focusedHighlight": "transparent",
  border: "1.5px solid",
  bgcolor: "#ffffff",
  borderColor: "neutral.200",
  fontSize: "13px",
  "--Input-minHeight": "36px",
  "&:hover:not(:focus-within)": {
    borderColor: "neutral.300",
  },
  "&:focus-within": {
    borderColor: "primary.400",
    boxShadow: "0 0 0 3px var(--joy-palette-primary-100)",
    outline: "none",
  },
  "& input": {
    minWidth: 0,
    width: "100%",
  },
  "& input:focus": {
    outline: "none",
  },
} as const;

const inlineSwitchSx = {
  "--Switch-trackBackground": "var(--joy-palette-neutral-200)",
  "--Switch-trackWidth": "34px",
  "--Switch-trackHeight": "20px",
  "--Switch-thumbSize": "16px",
  "&.Joy-checked": {
    "--Switch-trackBackground": "var(--joy-palette-primary-400)",
  },
  "& .JoySwitch-thumb": {
    bgcolor: "#ffffff",
    boxShadow: "0 1px 3px rgba(15, 23, 42, 0.22)",
  },
} as const;

function PlatformRow({
  icon,
  label,
  defaultValue,
}: {
  icon: React.ReactNode;
  label: string;
  defaultValue: string;
}) {
  const [enabled, setEnabled] = React.useState(defaultValue.length > 0);

  return (
    <Sheet
      variant="plain"
      sx={{
        borderRadius: "8px",
        p: 1,
        bgcolor: "neutral.50",
      }}
    >
      <Stack spacing={0.75}>
        <Stack direction="row" spacing={1} alignItems="center">
          {icon}
          <Typography
            level="body-xs"
            sx={{ fontSize: "12px", fontWeight: 500, color: "neutral.600" }}
          >
            {label}
          </Typography>
          <Box sx={{ ml: "auto" }}>
            <Switch
              size="sm"
              color="primary"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              sx={inlineSwitchSx}
            />
          </Box>
        </Stack>
        <Input
          size="sm"
          variant="outlined"
          placeholder="https://..."
          defaultValue={defaultValue}
          sx={inlineInputSx}
        />
      </Stack>
    </Sheet>
  );
}

function ProductEntryRow({ index }: { index: number }) {
  return (
    <Sheet
      variant="plain"
      sx={{
        borderRadius: "8px",
        p: 1,
        bgcolor: "neutral.50",
      }}
    >
      <Stack spacing={1}>
        <Typography
          level="body-xs"
          sx={{ fontSize: "12px", fontWeight: 500, color: "neutral.600" }}
        >
          Product {index + 1}
        </Typography>
        <Stack
          direction="row"
          spacing={1}
          alignItems="flex-start"
          sx={{ width: "100%", minWidth: 0, flexWrap: "wrap" }}
        >
          <Box sx={{ width: 96, maxWidth: "100%", flexShrink: 0 }}>
            <StudioImageUpload
              label="Image"
              compact
              defaultFilled={index === 0}
              aiAspectRatioHint="portrait"
              blockContext={`Product Gallery item ${index + 1} image`}
            />
          </Box>
          <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
            <StudioTextField
              label="Name"
              placeholder="Product name"
              defaultValue={index === 0 ? "Signature Bouquet" : undefined}
            />
            <Stack
              direction="row"
              spacing={0.75}
              sx={{ width: "100%", minWidth: 0 }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <StudioTextField
                  label="Price"
                  placeholder="$0.00"
                  defaultValue={index === 0 ? "$48.00" : undefined}
                />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <StudioTextField
                  label="Badge"
                  placeholder="Badge"
                  defaultValue={index === 0 ? "Best Seller" : undefined}
                />
              </Box>
            </Stack>
          </Stack>
        </Stack>
      </Stack>
    </Sheet>
  );
}

function renderSections(
  sections: Array<{ id: string; title: string; content: React.ReactNode }>,
) {
  return sections.map((section) => (
    <PanelSection key={section.id} title={section.title}>
      {section.content}
    </PanelSection>
  ));
}

function applyPreset(
  block: StudioBlock,
  preset: LayoutPreset,
  updateBlockField: OnUpdateBlockField,
) {
  updateBlockField(block.id, "layoutPreset", preset.key);
  Object.entries(preset.fields).forEach(([field, value]) => {
    updateBlockField(
      block.id,
      field as keyof StudioBlock,
      value as StudioBlock[keyof StudioBlock],
    );
  });
}

function HeroStyleIcon({
  variant,
  block,
}: {
  variant: string;
  block: StudioBlock;
}) {
  const background =
    variant === "gradient"
      ? `linear-gradient(135deg, ${block.gradientFrom ?? "#ff6b6b"}, ${block.gradientTo ?? "#ffd93d"})`
      : variant === "image-overlay"
        ? `linear-gradient(135deg, color-mix(in srgb, ${block.overlayColor ?? "#000000"} 65%, transparent), rgba(0,0,0,0.18)), linear-gradient(45deg, rgba(96,125,139,0.75), rgba(38,50,56,0.9))`
        : variant === "image-bottom"
          ? `linear-gradient(to bottom, ${block.backgroundColor ?? "#f8f9fa"} 0 56%, rgba(203,213,225,0.95) 56% 100%)`
          : (block.backgroundColor ?? "#1a1a2e");

  return (
    <Box
      sx={{
        width: 12,
        height: 12,
        borderRadius: "4px",
        background:
          variant === "image-overlay" && block.imageUrl
            ? `linear-gradient(135deg, color-mix(in srgb, ${block.overlayColor ?? "#000000"} 62%, transparent), rgba(0,0,0,0.16)), url(${block.imageUrl}) center / cover`
            : variant === "image-bottom" && block.imageUrl
              ? `linear-gradient(to bottom, ${block.backgroundColor ?? "#f8f9fa"} 0 52%, transparent 52% 100%), url(${block.imageUrl}) center bottom / cover`
              : background,
        border: variant === "image-bottom" ? "1px solid" : 0,
        borderColor: "neutral.200",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.24)",
      }}
    />
  );
}

function ButtonSizeVisual({ width }: { width: number }) {
  return (
    <Box
      sx={{
        width,
        height: 4,
        borderRadius: 999,
        bgcolor: "currentColor",
        boxShadow: "0 0 0 3px var(--joy-palette-primary-50)",
      }}
    />
  );
}

const IMAGE_POSITION_TO_LAYOUT = {
  left: "image-left",
  right: "image-right",
  top: "image-top",
  overlay: "image-overlay",
} as const;

const IMAGE_POSITION_TO_PRESET = {
  left: "image-text-left",
  right: "image-text-right",
  top: "image-text-top",
  overlay: "image-text-overlay",
} as const;

const GRAPHIC_HERO_OVERLAY_COLOR_PRESETS = [
  "#000000",
  "#1e293b",
  "#1a3a2a",
  "#2d1b4e",
  "#2c1810",
];

function moveArrayItem<T>(
  items: T[],
  sourceIndex: number,
  targetIndex: number,
) {
  if (
    sourceIndex < 0 ||
    targetIndex < 0 ||
    sourceIndex >= items.length ||
    targetIndex >= items.length ||
    sourceIndex === targetIndex
  ) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(sourceIndex, 1);
  nextItems.splice(targetIndex, 0, movedItem);
  return nextItems;
}

function createGalleryImage(url: string): GalleryImage {
  return {
    id: crypto.randomUUID(),
    url,
    alt: "",
    linkUrl: "",
  };
}

function createGalleryProduct(): GalleryProduct {
  return {
    id: crypto.randomUUID(),
    imageUrl: "",
    name: "",
    price: "",
    originalPrice: "",
    description: "",
    badgeText: "",
    badgeColor: "#111827",
    buttonText: "",
    buttonUrl: "",
  };
}

function getNormalizedSocialLinks(
  existingLinks: SocialLink[] = [],
): SocialLink[] {
  const orderedPlatforms = [
    ...existingLinks.map((link) => link.platform),
    ...SOCIAL_PLATFORM_ORDER.filter(
      (platform) => !existingLinks.some((link) => link.platform === platform),
    ),
  ];

  return orderedPlatforms.map((platform) => {
    const existingLink = existingLinks.find(
      (link) => link.platform === platform,
    );

    return {
      platform,
      url: existingLink?.url ?? "",
      enabled: existingLink?.enabled ?? false,
    };
  });
}

function mergeSocialLink(
  links: SocialLink[],
  platform: StudioSocialPlatform,
  fields: Partial<SocialLink>,
) {
  return links.map((link) =>
    link.platform === platform ? { ...link, ...fields } : link,
  );
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

function getImageGalleryFieldKey(blockId: string, slotIndex: number) {
  return `${blockId}:galleryImages:${slotIndex}`;
}

function getProductGalleryFieldKey(blockId: string, productId: string) {
  return `${blockId}:galleryProducts:${productId}:imageUrl`;
}

function ImageGalleryManager({
  block,
  campaignContext,
  campaignImageGallery,
  onTrackCampaignImageUsage,
  updateField,
  onRequestAIImage,
  resolveCampaignImageFieldSource,
}: {
  block: StudioBlock;
  campaignContext: StudioImageAIRequest["campaignContext"];
  campaignImageGallery: CampaignImageGalleryItem[];
  onTrackCampaignImageUsage?: TrackCampaignImageUsage;
  updateField: UpdateField;
  onRequestAIImage?: RequestAIImage;
  resolveCampaignImageFieldSource?: ResolveCampaignImageFieldSource;
}) {
  const images = block.galleryImages ?? [];
  const [activeSlotIndex, setActiveSlotIndex] = React.useState<number | null>(
    images.length > 0 ? 0 : null,
  );
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const slotInputRef = React.useRef<HTMLInputElement | null>(null);
  const multiInputRef = React.useRef<HTMLInputElement | null>(null);
  const pendingSlotIndexRef = React.useRef<number | null>(null);
  const slotCount = Math.max(getImageGallerySlotCount(block), images.length);
  const activeImage =
    activeSlotIndex === null ? null : (images[activeSlotIndex] ?? null);

  const setImages = React.useCallback(
    (nextImages: GalleryImage[]) => updateField("galleryImages", nextImages),
    [updateField],
  );

  const trackSlotImage = React.useCallback(
    (slotIndex: number, event: StudioImageApplyEvent | null) => {
      onTrackCampaignImageUsage?.(
        getImageGalleryFieldKey(block.id, slotIndex),
        event,
      );
    },
    [block.id, onTrackCampaignImageUsage],
  );

  React.useEffect(() => {
    if (activeSlotIndex === null) {
      if (images.length > 0) {
        setActiveSlotIndex(0);
      }
      return;
    }

    if (activeSlotIndex >= slotCount) {
      setActiveSlotIndex(slotCount > 0 ? slotCount - 1 : null);
    }
  }, [activeSlotIndex, images.length, slotCount]);

  const setImageAtSlot = React.useCallback(
    (
      slotIndex: number,
      nextUrl: string,
      event?: StudioImageApplyEvent | null,
    ) => {
      const nextImages = [...images];
      const currentImage = nextImages[slotIndex];
      nextImages[slotIndex] = currentImage
        ? { ...currentImage, url: nextUrl }
        : createGalleryImage(nextUrl);
      setImages(
        nextImages.filter((image): image is GalleryImage => Boolean(image)),
      );
      setActiveSlotIndex(slotIndex);
      trackSlotImage(slotIndex, event ?? null);
    },
    [images, setImages, trackSlotImage],
  );

  const buildSlotLabel = React.useCallback(
    (slotIndex: number) =>
      `Image Gallery — Slot ${slotIndex + 1} of ${slotCount}`,
    [slotCount],
  );

  const buildSlotSelectionHandler = React.useCallback(
    (slotIndex: number) =>
      async (imageUrl: string, metadata?: AIImageStudioSelectionMetadata) => {
        try {
          const resolvedImageUrl = await ensureCampaignStudioImageUrl(imageUrl);
          setImageAtSlot(slotIndex, resolvedImageUrl, {
            blockLabel: campaignContext?.blockLabel,
            gallerySource: getCampaignImageSourceFromMetadata(metadata),
            prompt:
              metadata?.altText || campaignContext?.contentSummary || undefined,
            source: getCampaignImageSourceFromMetadata(metadata),
            timestamp: Date.now(),
            url: resolvedImageUrl,
          });
          setErrorMessage(null);
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Could not use the selected AI image.";
          setErrorMessage(message);
        }
      },
    [campaignContext, setImageAtSlot],
  );

  const buildSlotContinuationFlow = React.useCallback(
    (startingSlotIndex: number) => {
      const slotIndexes = Array.from(
        { length: slotCount - startingSlotIndex },
        (_, offset) => startingSlotIndex + offset,
      );

      if (slotIndexes.length <= 1) {
        return undefined;
      }

      let currentIndex = 0;

      return {
        advanceToNextTarget: () => {
          const nextSlotIndex = slotIndexes[currentIndex + 1];

          if (nextSlotIndex === undefined) {
            return null;
          }

          currentIndex += 1;
          setActiveSlotIndex(nextSlotIndex);

          return {
            aiAspectRatioHint: "square",
            assignmentLabel: buildSlotLabel(nextSlotIndex),
            blockContext: buildSlotLabel(nextSlotIndex),
            blockId: block.id,
            campaignContext,
            onSelect: buildSlotSelectionHandler(nextSlotIndex),
          } satisfies StudioImageAIRequest;
        },
        hasNextTarget: () => currentIndex + 1 < slotIndexes.length,
      } satisfies NonNullable<StudioImageAIRequest["multiBlockFlow"]>;
    },
    [
      block.id,
      buildSlotLabel,
      buildSlotSelectionHandler,
      campaignContext,
      slotCount,
    ],
  );

  const requestAIForSlot = React.useCallback(
    (slotIndex: number, request?: StudioImageAIRequest) => {
      if (!onRequestAIImage) {
        return;
      }

      setActiveSlotIndex(slotIndex);

      onRequestAIImage({
        ...(request ?? {
          aiAspectRatioHint: "square",
          blockContext: buildSlotLabel(slotIndex),
          blockId: block.id,
          campaignContext,
          onSelect: buildSlotSelectionHandler(slotIndex),
        }),
        assignmentLabel: buildSlotLabel(slotIndex),
        blockContext: buildSlotLabel(slotIndex),
        blockId: block.id,
        campaignContext,
        multiBlockFlow: buildSlotContinuationFlow(slotIndex),
      });
    },
    [
      block.id,
      buildSlotContinuationFlow,
      buildSlotLabel,
      buildSlotSelectionHandler,
      campaignContext,
      onRequestAIImage,
    ],
  );

  const handleGenerateAllWithAI = React.useCallback(() => {
    if (!onRequestAIImage || slotCount === 0) {
      return;
    }

    const firstEmptySlotIndex = images.length < slotCount ? images.length : 0;
    requestAIForSlot(firstEmptySlotIndex);
  }, [images.length, onRequestAIImage, requestAIForSlot, slotCount]);

  const uploadFiles = React.useCallback(
    async (files: FileList | null, targetIndex: number | null) => {
      const selectedFiles = Array.from(files ?? []);

      if (selectedFiles.length === 0) {
        return;
      }

      setUploading(true);
      setErrorMessage(null);

      try {
        const uploadedImages = await Promise.all(
          selectedFiles.map(async (file) =>
            createGalleryImage(await uploadStudioImageFile(file)),
          ),
        );

        if (targetIndex === null) {
          const nextImages = [...images, ...uploadedImages];
          setImages(nextImages);
          setActiveSlotIndex(nextImages.length - uploadedImages.length);
          uploadedImages.forEach((image, index) => {
            trackSlotImage(images.length + index, {
              blockLabel: campaignContext?.blockLabel,
              gallerySource: "upload",
              source: "upload",
              timestamp: Date.now(),
              url: image.url,
            });
          });
          return;
        }

        const [firstImage] = uploadedImages;

        if (!firstImage) {
          return;
        }

        const nextImages = [...images];
        const currentImage = nextImages[targetIndex];
        nextImages[targetIndex] = {
          ...firstImage,
          id: currentImage?.id ?? firstImage.id,
          alt: currentImage?.alt ?? firstImage.alt,
          linkUrl: currentImage?.linkUrl ?? firstImage.linkUrl,
        };
        const compactImages = nextImages.filter(
          (image): image is GalleryImage => Boolean(image),
        );
        setImages(compactImages);
        setActiveSlotIndex(targetIndex);
        trackSlotImage(targetIndex, {
          blockLabel: campaignContext?.blockLabel,
          gallerySource: "upload",
          source: "upload",
          timestamp: Date.now(),
          url: firstImage.url,
        });
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Upload failed.",
        );
      } finally {
        setUploading(false);
        pendingSlotIndexRef.current = null;

        if (slotInputRef.current) {
          slotInputRef.current.value = "";
        }

        if (multiInputRef.current) {
          multiInputRef.current.value = "";
        }
      }
    },
    [campaignContext?.blockLabel, images, setImages, trackSlotImage],
  );

  const updateImage = React.useCallback(
    (imageId: string, fields: Partial<GalleryImage>) => {
      setImages(
        images.map((image) =>
          image.id === imageId ? { ...image, ...fields } : image,
        ),
      );
    },
    [images, setImages],
  );

  const removeImage = React.useCallback(
    (imageId: string) => {
      const removedIndex = images.findIndex((image) => image.id === imageId);
      const nextImages = images.filter((image) => image.id !== imageId);
      setImages(nextImages);
      if (removedIndex >= 0) {
        trackSlotImage(removedIndex, null);
      }
      setActiveSlotIndex((current) => {
        if (current === null) {
          return nextImages.length > 0 ? 0 : null;
        }

        return current >= nextImages.length
          ? nextImages.length > 0
            ? nextImages.length - 1
            : null
          : current;
      });
    },
    [images, setImages, trackSlotImage],
  );

  return (
    <Stack spacing={1}>
      <Box
        component="input"
        ref={slotInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          void uploadFiles(event.target.files, pendingSlotIndexRef.current)
        }
        sx={{ display: "none" }}
      />
      <Box
        component="input"
        ref={multiInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
          void uploadFiles(event.target.files, null)
        }
        sx={{ display: "none" }}
      />
      <Box
        sx={{
          width: "100%",
          maxWidth: "100%",
          overflow: "hidden",
          boxSizing: "border-box",
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 0.75,
        }}
      >
        {Array.from({ length: slotCount }).map((_slot, index) => {
          const image = images[index];
          const selected = index === activeSlotIndex;

          return (
            <Sheet
              key={image?.id ?? `gallery-empty-${index}`}
              component="button"
              type="button"
              variant="plain"
              draggable={Boolean(image)}
              onDragStart={(event) => {
                setDraggedIndex(index);
                event.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(event) => {
                if (draggedIndex !== null && image) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }
              }}
              onDrop={(event) => {
                event.preventDefault();

                if (draggedIndex !== null && image) {
                  setImages(moveArrayItem(images, draggedIndex, index));
                }

                setDraggedIndex(null);
              }}
              onDragEnd={() => setDraggedIndex(null)}
              onClick={() => {
                setActiveSlotIndex(index);

                if (image) {
                  return;
                }

                pendingSlotIndexRef.current = index;
                slotInputRef.current?.click();
              }}
              sx={{
                position: "relative",
                width: "100%",
                aspectRatio: "1 / 1",
                p: 0,
                border: image ? "1px solid" : "1.5px dashed",
                borderColor: selected ? "primary.400" : "neutral.200",
                outline: selected ? "2px solid" : "0 solid transparent",
                outlineColor: selected ? "primary.200" : "transparent",
                borderRadius: "10px",
                overflow: "hidden",
                bgcolor: image ? "neutral.100" : "neutral.50",
                cursor: image ? "grab" : "pointer",
                "&:hover .gallery-manager-actions": { opacity: 1 },
              }}
            >
              {image ? (
                <>
                  <Box
                    component="img"
                    src={image.url}
                    alt={image.alt}
                    draggable={false}
                    sx={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                  <Stack
                    className="gallery-manager-actions"
                    direction="row"
                    spacing={0.25}
                    sx={{
                      position: "absolute",
                      inset: 0,
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: "rgba(0,0,0,0.28)",
                      color: "#ffffff",
                      opacity: 0,
                      transition: "opacity 120ms ease",
                    }}
                  >
                    <GripVertical size={13} />
                    <IconButton
                      variant="plain"
                      color="neutral"
                      size="sm"
                      aria-label="Generate image with AI"
                      onClick={(event) => {
                        event.stopPropagation();
                        requestAIForSlot(index);
                      }}
                      sx={{ minWidth: 20, minHeight: 20, color: "#ffffff" }}
                    >
                      <Sparkles size={12} />
                    </IconButton>
                    <IconButton
                      variant="plain"
                      color="neutral"
                      size="sm"
                      aria-label="Remove image"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeImage(image.id);
                      }}
                      sx={{ minWidth: 20, minHeight: 20, color: "#ffffff" }}
                    >
                      <X size={12} />
                    </IconButton>
                  </Stack>
                </>
              ) : (
                <Stack
                  spacing={0.25}
                  alignItems="center"
                  justifyContent="center"
                >
                  <ImagePlus size={16} />
                  <Typography level="body-xs" sx={{ fontSize: "10px" }}>
                    {uploading ? "..." : "Add"}
                  </Typography>
                  {onRequestAIImage ? (
                    <Button
                      size="sm"
                      variant="plain"
                      color="primary"
                      startDecorator={<Sparkles size={12} />}
                      onClick={(event) => {
                        event.stopPropagation();
                        requestAIForSlot(index);
                      }}
                      sx={{ minHeight: 22, px: 0.25, fontSize: "10px" }}
                    >
                      AI
                    </Button>
                  ) : null}
                </Stack>
              )}
            </Sheet>
          );
        })}
      </Box>
      <Stack direction="row" spacing={0.75} flexWrap="wrap">
        <Button
          variant="soft"
          color="neutral"
          size="sm"
          startDecorator={<Plus size={14} />}
          onClick={() => multiInputRef.current?.click()}
          sx={{
            alignSelf: "flex-start",
            borderRadius: "10px",
            fontSize: "13px",
            px: 1.5,
            bgcolor: "rgba(15, 23, 42, 0.04)",
          }}
        >
          Add Images
        </Button>
        {onRequestAIImage ? (
          <Button
            variant="soft"
            color="primary"
            size="sm"
            startDecorator={<Sparkles size={14} />}
            onClick={handleGenerateAllWithAI}
            sx={{ borderRadius: "10px", fontSize: "13px", px: 1.5 }}
          >
            Generate all with AI
          </Button>
        ) : null}
      </Stack>
      {errorMessage ? (
        <Typography level="body-xs" sx={{ color: "danger.600" }}>
          {errorMessage}
        </Typography>
      ) : null}
      {activeSlotIndex !== null ? (
        <Sheet
          variant="plain"
          sx={{
            p: 1.25,
            borderRadius: "12px",
            bgcolor: "neutral.50",
            border: "1px solid",
            borderColor: "neutral.200",
          }}
        >
          <Stack spacing={0.9}>
            <Typography
              level="body-xs"
              sx={{
                fontSize: "11px",
                fontWeight: 700,
                color: "primary.500",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              Gallery Slot {activeSlotIndex + 1}
            </Typography>
            <StudioImageUpload
              label="Image"
              height={84}
              emptyText="Upload image"
              value={activeImage?.url ?? ""}
              onChange={(value) => setImageAtSlot(activeSlotIndex, value)}
              blockContext={buildSlotLabel(activeSlotIndex)}
              aiAspectRatioHint="square"
              blockId={block.id}
              campaignContext={campaignContext}
              campaignImages={campaignImageGallery}
              imageSourceRecord={resolveCampaignImageFieldSource?.(
                getImageGalleryFieldKey(block.id, activeSlotIndex),
                activeImage?.url,
              )}
              onApplyImage={(event) => trackSlotImage(activeSlotIndex, event)}
              onClearImage={() => trackSlotImage(activeSlotIndex, null)}
              onRequestAIImage={(request) =>
                requestAIForSlot(activeSlotIndex, request)
              }
            />
            {activeImage ? (
              <>
                <StudioTextField
                  label="Alt Text"
                  placeholder="Describe this image"
                  value={activeImage.alt}
                  onChange={(value) =>
                    updateImage(activeImage.id, { alt: value })
                  }
                />
                <StudioTextField
                  label="Link URL"
                  placeholder="https://..."
                  type="url"
                  value={activeImage.linkUrl ?? ""}
                  onChange={(value) =>
                    updateImage(activeImage.id, { linkUrl: value })
                  }
                />
              </>
            ) : (
              <Typography
                level="body-xs"
                sx={{ color: "neutral.500", fontSize: "11px" }}
              >
                Upload or generate an image for this slot.
              </Typography>
            )}
          </Stack>
        </Sheet>
      ) : null}
    </Stack>
  );
}

function ProductGalleryManager({
  block,
  campaignContext,
  campaignImageGallery,
  onTrackCampaignImageUsage,
  updateField,
  onRequestAIImage,
  resolveCampaignImageFieldSource,
}: {
  block: StudioBlock;
  campaignContext: StudioImageAIRequest["campaignContext"];
  campaignImageGallery: CampaignImageGalleryItem[];
  onTrackCampaignImageUsage?: TrackCampaignImageUsage;
  updateField: UpdateField;
  onRequestAIImage?: RequestAIImage;
  resolveCampaignImageFieldSource?: ResolveCampaignImageFieldSource;
}) {
  const products = block.galleryProducts ?? [];
  const [expandedProductId, setExpandedProductId] = React.useState<
    string | null
  >(products[0]?.id ?? null);
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);

  const setProducts = React.useCallback(
    (nextProducts: GalleryProduct[]) =>
      updateField("galleryProducts", nextProducts),
    [updateField],
  );

  const updateProduct = React.useCallback(
    (productId: string, fields: Partial<GalleryProduct>) => {
      setProducts(
        products.map((product) =>
          product.id === productId ? { ...product, ...fields } : product,
        ),
      );
    },
    [products, setProducts],
  );

  const trackProductImage = React.useCallback(
    (productId: string, event: StudioImageApplyEvent | null) => {
      onTrackCampaignImageUsage?.(
        getProductGalleryFieldKey(block.id, productId),
        event,
      );
    },
    [block.id, onTrackCampaignImageUsage],
  );

  const buildProductCellLabel = React.useCallback(
    (index: number) =>
      `Product Gallery — Cell ${index + 1} of ${products.length}`,
    [products.length],
  );

  const buildProductSelectionHandler = React.useCallback(
    (productId: string) =>
      async (imageUrl: string, metadata?: AIImageStudioSelectionMetadata) => {
        const resolvedImageUrl = await ensureCampaignStudioImageUrl(imageUrl);
        updateProduct(productId, { imageUrl: resolvedImageUrl });
        trackProductImage(productId, {
          blockLabel: campaignContext?.blockLabel,
          gallerySource: getCampaignImageSourceFromMetadata(metadata),
          prompt:
            metadata?.altText || campaignContext?.contentSummary || undefined,
          source: getCampaignImageSourceFromMetadata(metadata),
          timestamp: Date.now(),
          url: resolvedImageUrl,
        });
      },
    [campaignContext, trackProductImage, updateProduct],
  );

  const buildProductContinuationFlow = React.useCallback(
    (startingIndex: number) => {
      const remainingProducts = products.slice(startingIndex);

      if (remainingProducts.length <= 1) {
        return undefined;
      }

      let currentIndex = 0;

      return {
        advanceToNextTarget: () => {
          const nextProduct = remainingProducts[currentIndex + 1];
          const nextProductIndex = startingIndex + currentIndex + 1;

          if (!nextProduct) {
            return null;
          }

          currentIndex += 1;
          setExpandedProductId(nextProduct.id);

          return {
            aiAspectRatioHint: "portrait",
            assignmentLabel: buildProductCellLabel(nextProductIndex),
            blockContext: buildProductCellLabel(nextProductIndex),
            blockId: block.id,
            campaignContext,
            onSelect: buildProductSelectionHandler(nextProduct.id),
          } satisfies StudioImageAIRequest;
        },
        hasNextTarget: () => currentIndex + 1 < remainingProducts.length,
      } satisfies NonNullable<StudioImageAIRequest["multiBlockFlow"]>;
    },
    [
      block.id,
      buildProductCellLabel,
      buildProductSelectionHandler,
      campaignContext,
      products,
    ],
  );

  const requestAIForProduct = React.useCallback(
    (index: number, productId: string, request?: StudioImageAIRequest) => {
      if (!onRequestAIImage) {
        return;
      }

      setExpandedProductId(productId);

      onRequestAIImage({
        ...(request ?? {
          aiAspectRatioHint: "portrait",
          blockContext: buildProductCellLabel(index),
          blockId: block.id,
          campaignContext,
          onSelect: buildProductSelectionHandler(productId),
        }),
        assignmentLabel: buildProductCellLabel(index),
        blockContext: buildProductCellLabel(index),
        blockId: block.id,
        campaignContext,
        multiBlockFlow: buildProductContinuationFlow(index),
      });
    },
    [
      block.id,
      buildProductCellLabel,
      buildProductContinuationFlow,
      buildProductSelectionHandler,
      campaignContext,
      onRequestAIImage,
    ],
  );

  const removeProduct = React.useCallback(
    (productId: string) => {
      const nextProducts = products.filter(
        (product) => product.id !== productId,
      );
      setProducts(nextProducts);
      setExpandedProductId((current) =>
        current === productId ? (nextProducts[0]?.id ?? null) : current,
      );
    },
    [products, setProducts],
  );

  return (
    <Stack spacing={1}>
      {products.map((product, index) => {
        const expanded = product.id === expandedProductId;
        const hasName = Boolean(product.name?.trim());
        const hasPrice = Boolean(product.price?.trim());

        return (
          <Sheet
            key={product.id}
            variant="plain"
            onDragOver={(event) => {
              if (draggedIndex !== null) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }
            }}
            onDrop={(event) => {
              event.preventDefault();

              if (draggedIndex !== null) {
                setProducts(moveArrayItem(products, draggedIndex, index));
              }

              setDraggedIndex(null);
            }}
            sx={{
              borderRadius: "12px",
              p: 1,
              bgcolor: "neutral.50",
              border: "1px solid",
              borderColor: expanded ? "primary.200" : "neutral.200",
            }}
          >
            <Stack spacing={1}>
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ width: "100%", minWidth: 0 }}
              >
                <IconButton
                  variant="plain"
                  color="neutral"
                  size="sm"
                  aria-label="Drag product"
                  draggable
                  onDragStart={(event) => {
                    setDraggedIndex(index);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => setDraggedIndex(null)}
                  sx={{ minWidth: 24, minHeight: 24, cursor: "grab" }}
                >
                  <GripVertical size={14} />
                </IconButton>
                <Box
                  onClick={() =>
                    setExpandedProductId((current) =>
                      current === product.id ? null : product.id,
                    )
                  }
                  sx={{
                    width: 42,
                    height: 42,
                    borderRadius: "6px",
                    overflow: "hidden",
                    bgcolor: "neutral.100",
                    border: "1px solid",
                    borderColor: "neutral.200",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  {product.imageUrl ? (
                    <Box
                      component="img"
                      src={product.imageUrl}
                      alt=""
                      sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <Stack
                      sx={{ width: "100%", height: "100%" }}
                      alignItems="center"
                      justifyContent="center"
                    >
                      <ImagePlus size={15} />
                    </Stack>
                  )}
                </Box>
                <Stack
                  spacing={0.1}
                  onClick={() =>
                    setExpandedProductId((current) =>
                      current === product.id ? null : product.id,
                    )
                  }
                  sx={{ minWidth: 0, flex: 1, cursor: "pointer" }}
                >
                  <Typography
                    level="body-xs"
                    noWrap
                    sx={{
                      fontSize: "12px",
                      fontWeight: 700,
                      color: "neutral.700",
                    }}
                  >
                    {hasName ? product.name : `Product ${index + 1}`}
                  </Typography>
                  <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                    {hasPrice ? product.price : "$0.00"}
                  </Typography>
                </Stack>
                <IconButton
                  variant="plain"
                  color="neutral"
                  size="sm"
                  aria-label={expanded ? "Collapse product" : "Expand product"}
                  onClick={() =>
                    setExpandedProductId((current) =>
                      current === product.id ? null : product.id,
                    )
                  }
                  sx={{
                    minWidth: 24,
                    minHeight: 24,
                    transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 180ms ease",
                  }}
                >
                  <ChevronDown size={14} />
                </IconButton>
                <IconButton
                  variant="plain"
                  color="neutral"
                  size="sm"
                  aria-label="Delete product"
                  onClick={() => removeProduct(product.id)}
                  sx={{
                    minWidth: 24,
                    minHeight: 24,
                    "&:hover": { color: "danger.500" },
                  }}
                >
                  <Trash2 size={14} />
                </IconButton>
              </Stack>
              {expanded ? (
                <Stack spacing={0.85}>
                  <StudioImageUpload
                    label="Image"
                    height={72}
                    emptyText="Upload image"
                    value={product.imageUrl}
                    onChange={(value) =>
                      updateProduct(product.id, { imageUrl: value })
                    }
                    blockContext={buildProductCellLabel(index)}
                    aiAspectRatioHint="portrait"
                    blockId={block.id}
                    campaignContext={campaignContext}
                    campaignImages={campaignImageGallery}
                    imageSourceRecord={resolveCampaignImageFieldSource?.(
                      getProductGalleryFieldKey(block.id, product.id),
                      product.imageUrl,
                    )}
                    onApplyImage={(event) =>
                      trackProductImage(product.id, event)
                    }
                    onClearImage={() => trackProductImage(product.id, null)}
                    onRequestAIImage={(request) =>
                      requestAIForProduct(index, product.id, request)
                    }
                  />
                  <StudioTextField
                    label="Name"
                    placeholder="Product name"
                    value={product.name}
                    onChange={(value) =>
                      updateProduct(product.id, { name: value })
                    }
                  />
                  <Stack
                    direction="row"
                    spacing={0.75}
                    sx={{ width: "100%", minWidth: 0 }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <StudioTextField
                        label="Price"
                        placeholder="$29.99"
                        startDecorator={<DollarSign size={14} />}
                        value={product.price}
                        onChange={(value) =>
                          updateProduct(product.id, { price: value })
                        }
                      />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <StudioTextField
                        label="Original"
                        placeholder="$39.99"
                        value={product.originalPrice ?? ""}
                        onChange={(value) =>
                          updateProduct(product.id, { originalPrice: value })
                        }
                      />
                    </Box>
                  </Stack>
                  <StudioTextField
                    label="Description"
                    multiline
                    minRows={2}
                    placeholder="Short description"
                    value={product.description ?? ""}
                    onChange={(value) =>
                      updateProduct(product.id, { description: value })
                    }
                  />
                  <StudioTextField
                    label="Badge Text"
                    placeholder="SALE"
                    value={product.badgeText ?? ""}
                    onChange={(value) =>
                      updateProduct(product.id, { badgeText: value })
                    }
                  />
                  {product.badgeText?.trim() ? (
                    <StudioColorPicker
                      label="Badge Color"
                      value={product.badgeColor ?? "#111827"}
                      onChange={(value) =>
                        updateProduct(product.id, { badgeColor: value })
                      }
                    />
                  ) : null}
                  <StudioTextField
                    label="Button Text"
                    placeholder="Shop Now"
                    value={product.buttonText ?? ""}
                    onChange={(value) =>
                      updateProduct(product.id, { buttonText: value })
                    }
                  />
                  <StudioTextField
                    label="Button URL"
                    placeholder="https://..."
                    type="url"
                    value={product.buttonUrl ?? ""}
                    onChange={(value) =>
                      updateProduct(product.id, { buttonUrl: value })
                    }
                  />
                </Stack>
              ) : null}
            </Stack>
          </Sheet>
        );
      })}
      <Button
        variant="soft"
        color="neutral"
        size="sm"
        startDecorator={<Plus size={14} />}
        onClick={() => {
          const product = createGalleryProduct();
          setProducts([...products, product]);
          setExpandedProductId(product.id);
        }}
        sx={{
          borderRadius: "10px",
          fontSize: "13px",
          fontWeight: 500,
          alignSelf: "flex-start",
        }}
      >
        Add Product
      </Button>
    </Stack>
  );
}

function SocialLinksManager({
  block,
  updateField,
  fieldKey = "socialLinks",
}: {
  block: StudioBlock;
  updateField: UpdateField;
  fieldKey?: "socialLinks" | "footerSocialLinks";
}) {
  const sourceLinks =
    fieldKey === "footerSocialLinks"
      ? (block.footerSocialLinks ?? [])
      : (block.socialLinks ?? []);
  const links = getNormalizedSocialLinks(sourceLinks);
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
  const [expandedPlatform, setExpandedPlatform] =
    React.useState<StudioSocialPlatform | null>(
      links.find((link) => link.enabled)?.platform ?? null,
    );

  const resolvedIconStyle =
    block.iconStyle ?? block.socialIconStyle ?? "filled";
  const resolvedIconSize = block.iconSize ?? block.socialIconSize ?? "md";
  const resolvedColorMode =
    block.iconColorMode ??
    (block.socialColorMode === "monochrome" ? "mono" : block.socialColorMode) ??
    "brand";

  const setLinks = React.useCallback(
    (nextLinks: SocialLink[]) => updateField(fieldKey, nextLinks),
    [fieldKey, updateField],
  );

  return (
    <Stack spacing={1}>
      {links.map((link, index) => (
        <Sheet
          key={link.platform}
          variant="plain"
          onDragOver={(event) => {
            if (draggedIndex !== null) {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }
          }}
          onDrop={(event) => {
            event.preventDefault();

            if (draggedIndex !== null) {
              setLinks(moveArrayItem(links, draggedIndex, index));
            }

            setDraggedIndex(null);
          }}
          sx={{
            borderRadius: "12px",
            p: 1,
            bgcolor: "neutral.50",
            border: "1px solid",
            borderColor:
              expandedPlatform === link.platform
                ? "primary.200"
                : "neutral.200",
          }}
        >
          <Stack spacing={0.75}>
            <Stack
              direction="row"
              spacing={0.75}
              alignItems="center"
              onClick={() =>
                setExpandedPlatform((current) =>
                  current === link.platform ? null : link.platform,
                )
              }
              sx={{ cursor: "pointer" }}
            >
              <IconButton
                variant="plain"
                color="neutral"
                size="sm"
                aria-label={`Drag ${SOCIAL_PLATFORM_LABELS[link.platform]}`}
                draggable
                onDragStart={(event) => {
                  setDraggedIndex(index);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => setDraggedIndex(null)}
                sx={{ minWidth: 24, minHeight: 24, cursor: "grab" }}
              >
                <GripVertical size={14} />
              </IconButton>
              <SocialIcon
                platform={link.platform}
                size={24}
                variant={resolvedIconStyle}
                color={
                  resolvedColorMode === "custom"
                    ? block.customIconColor
                    : resolvedColorMode === "mono"
                      ? block.textColor
                      : undefined
                }
              />
              <Typography
                level="body-xs"
                sx={{ fontSize: "12px", fontWeight: 700, color: "neutral.700" }}
              >
                {SOCIAL_PLATFORM_LABELS[link.platform]}
              </Typography>
              <Box sx={{ ml: "auto" }}>
                <Switch
                  size="sm"
                  color="primary"
                  checked={link.enabled}
                  onChange={(event) =>
                    setLinks(
                      mergeSocialLink(links, link.platform, {
                        enabled: event.target.checked,
                      }),
                    )
                  }
                  sx={inlineSwitchSx}
                />
              </Box>
              <ChevronDown
                size={14}
                style={{
                  transform:
                    expandedPlatform === link.platform
                      ? "rotate(180deg)"
                      : "rotate(0deg)",
                  transition: "transform 180ms ease",
                }}
              />
            </Stack>
            <Box
              sx={{
                display: "grid",
                gridTemplateRows:
                  expandedPlatform === link.platform ? "1fr" : "0fr",
                transition: "grid-template-rows 180ms ease",
              }}
            >
              <Box sx={{ overflow: "hidden" }}>
                <Input
                  size="sm"
                  variant="outlined"
                  placeholder="https://..."
                  value={link.url}
                  disabled={!link.enabled}
                  onChange={(event) =>
                    setLinks(
                      mergeSocialLink(links, link.platform, {
                        url: event.target.value,
                      }),
                    )
                  }
                  sx={{
                    ...inlineInputSx,
                    mt: expandedPlatform === link.platform ? 0.25 : 0,
                    opacity: expandedPlatform === link.platform ? 1 : 0,
                    transition: "opacity 180ms ease, margin-top 180ms ease",
                  }}
                />
              </Box>
            </Box>
          </Stack>
        </Sheet>
      ))}
    </Stack>
  );
}

function PanelContent({
  block,
  campaignImageGallery,
  campaignName,
  campaignType,
  onTrackCampaignImageUsage,
  onUpdateBlockField,
  onRequestAIImage,
  resolveCampaignImageFieldSource,
}: {
  block: StudioBlock;
  campaignImageGallery: CampaignImageGalleryItem[];
  campaignName: string;
  campaignType: EditorCampaignType;
  onTrackCampaignImageUsage?: TrackCampaignImageUsage;
  onUpdateBlockField: OnUpdateBlockField;
  onRequestAIImage?: RequestAIImage;
  resolveCampaignImageFieldSource?: ResolveCampaignImageFieldSource;
}) {
  const { designSystem } = useDesignSystem();
  const {
    heroPresets,
    graphicHeroPresets,
    fullWidthImagePresets,
    newsletterHeaderPresets,
    imageTextPresets,
    plainTextPresets,
    quotePresets,
    productCardPresets,
    imageGalleryPresets,
    productGalleryPresets,
    ctaPresets,
    socialFollowPresets,
    dividerPresets,
    spacerPresets,
    footerPresets,
  } = React.useMemo(() => getStudioLayoutPresets(designSystem), [designSystem]);
  const updateField = React.useCallback(
    (field: keyof StudioBlock, value: StudioBlock[keyof StudioBlock]) => {
      onUpdateBlockField(block.id, field, value);
    },
    [block.id, onUpdateBlockField],
  );
  const buildAIUploadProps = React.useCallback(
    ({
      aiAspectRatioHint,
      blockContext,
      fieldKey,
      value,
    }: {
      aiAspectRatioHint: StudioImageAIAspectRatioHint;
      blockContext: string;
      fieldKey: string;
      value?: string;
    }) => {
      const campaignContext = buildStudioCampaignContext({
        aspectRatioHint: aiAspectRatioHint,
        block,
        campaignName,
        campaignType,
      });

      return {
        aiAspectRatioHint,
        blockContext,
        blockId: block.id,
        campaignContext,
        campaignImages: campaignImageGallery,
        imageSourceRecord: resolveCampaignImageFieldSource?.(fieldKey, value),
        onApplyImage: (event: StudioImageApplyEvent) =>
          onTrackCampaignImageUsage?.(fieldKey, event),
        onClearImage: () => onTrackCampaignImageUsage?.(fieldKey, null),
        onRequestAIImage,
      };
    },
    [
      block,
      block.id,
      campaignImageGallery,
      campaignName,
      campaignType,
      onRequestAIImage,
      onTrackCampaignImageUsage,
      resolveCampaignImageFieldSource,
    ],
  );
  const selectPreset = React.useCallback(
    (preset: LayoutPreset) => applyPreset(block, preset, onUpdateBlockField),
    [block, onUpdateBlockField],
  );

  switch (block.type) {
    case "email-safe-hero":
      return (
        <Stack
          spacing={0.75}
          sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
        >
          <LayoutPresetPicker
            presets={heroPresets}
            selectedKey={block.layoutPreset}
            onSelect={selectPreset}
          />
          <Stack
            spacing={0.75}
            sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
          >
            {renderSections([
              {
                id: "content",
                title: "Content",
                content: (
                  <>
                    <StudioTextField
                      label="Eyebrow"
                      placeholder="Optional label"
                      value={block.tagLabel ?? ""}
                      onChange={(value) => updateField("tagLabel", value)}
                    />
                    <StudioTextField
                      label="Headline"
                      placeholder="Enter headline"
                      value={block.headline ?? ""}
                      onChange={(value) => updateField("headline", value)}
                      aiDecorator
                    />
                    <StudioTextField
                      label="Subheading"
                      placeholder="Enter subheading"
                      value={block.subheading ?? ""}
                      onChange={(value) => updateField("subheading", value)}
                      aiDecorator
                    />
                    <StudioTextField
                      label="Body Text"
                      multiline
                      minRows={3}
                      placeholder="Enter body text"
                      value={block.body ?? ""}
                      onChange={(value) => updateField("body", value)}
                    />
                  </>
                ),
              },
              {
                id: "hero-layout",
                title: "Hero Layout",
                content: (
                  <>
                    <StudioToggleField
                      label="Hero Style"
                      options={[
                        {
                          label: "Solid",
                          value: "solid",
                          icon: <HeroStyleIcon variant="solid" block={block} />,
                        },
                        {
                          label: "Gradient",
                          value: "gradient",
                          icon: (
                            <HeroStyleIcon variant="gradient" block={block} />
                          ),
                        },
                        {
                          label: "Overlay",
                          value: "image-overlay",
                          icon: (
                            <HeroStyleIcon
                              variant="image-overlay"
                              block={block}
                            />
                          ),
                        },
                        {
                          label: "Image",
                          value: "image-bottom",
                          icon: (
                            <HeroStyleIcon
                              variant="image-bottom"
                              block={block}
                            />
                          ),
                        },
                      ]}
                      value={block.heroStyle ?? "solid"}
                      onChange={(value) =>
                        updateField(
                          "heroStyle",
                          value as StudioBlock["heroStyle"],
                        )
                      }
                    />
                    <StudioAlignmentToggle
                      label="Text Alignment"
                      value={block.textAlign ?? "center"}
                      onChange={(value) => updateField("textAlign", value)}
                    />
                  </>
                ),
              },
              {
                id: "hero-style",
                title: "Colors & Image",
                content: (
                  <>
                    {block.heroStyle === "gradient" ? (
                      <>
                        <StudioColorPicker
                          label="Gradient Start"
                          value={block.gradientFrom ?? "#ff6b6b"}
                          onChange={(value) =>
                            updateField("gradientFrom", value)
                          }
                        />
                        <StudioColorPicker
                          label="Gradient End"
                          value={block.gradientTo ?? "#ffd93d"}
                          onChange={(value) => updateField("gradientTo", value)}
                        />
                      </>
                    ) : (
                      <StudioColorPicker
                        label="Background Color"
                        value={block.backgroundColor ?? "#1a1a2e"}
                        onChange={(value) =>
                          updateField("backgroundColor", value)
                        }
                      />
                    )}
                    {block.heroStyle === "image-overlay" ||
                    block.heroStyle === "image-bottom" ? (
                      <>
                        <StudioImageUpload
                          label={
                            block.heroStyle === "image-overlay"
                              ? "Background Image"
                              : "Hero Image"
                          }
                          emptyText="Upload or drag image"
                          value={block.imageUrl ?? ""}
                          onChange={(value) => updateField("imageUrl", value)}
                          {...buildAIUploadProps({
                            aiAspectRatioHint: "landscape",
                            blockContext:
                              block.heroStyle === "image-overlay"
                                ? "Email Safe Hero background image"
                                : "Email Safe Hero hero image",
                            fieldKey: `${block.id}:imageUrl`,
                            value: block.imageUrl ?? "",
                          })}
                        />
                        <StudioTextField
                          label="Image Alt Text"
                          placeholder="Describe this image"
                          value={block.imageAlt ?? ""}
                          onChange={(value) => updateField("imageAlt", value)}
                        />
                      </>
                    ) : null}
                    {block.heroStyle === "image-overlay" ? (
                      <>
                        <StudioSliderField
                          label="Overlay Opacity"
                          min={0}
                          max={100}
                          defaultValue={45}
                          value={block.overlayOpacity ?? 45}
                          onChange={(value) =>
                            updateField("overlayOpacity", value)
                          }
                        />
                        <StudioColorPicker
                          label="Overlay Color"
                          value={block.overlayColor ?? "#000000"}
                          onChange={(value) =>
                            updateField("overlayColor", value)
                          }
                        />
                      </>
                    ) : null}
                    <StudioColorPicker
                      label="Text Color"
                      value={block.textColor ?? "#ffffff"}
                      onChange={(value) => updateField("textColor", value)}
                    />
                  </>
                ),
              },
              {
                id: "button",
                title: "Button",
                content: (
                  <>
                    <StudioTextField
                      label="Button Text"
                      placeholder="Button label"
                      value={block.buttonText ?? ""}
                      onChange={(value) => updateField("buttonText", value)}
                    />
                    <StudioTextField
                      label="Button URL"
                      placeholder="https://..."
                      type="url"
                      value={block.buttonUrl ?? ""}
                      onChange={(value) => updateField("buttonUrl", value)}
                    />
                    <StudioToggleField
                      label="Button Size"
                      options={[
                        {
                          label: "Small",
                          value: "sm",
                          visual: <ButtonSizeVisual width={12} />,
                        },
                        {
                          label: "Medium",
                          value: "md",
                          visual: <ButtonSizeVisual width={20} />,
                        },
                        {
                          label: "Large",
                          value: "lg",
                          visual: <ButtonSizeVisual width={28} />,
                        },
                      ]}
                      layout="stacked"
                      iconPlacement="top"
                      value={block.buttonSize ?? "md"}
                      onChange={(value) =>
                        updateField(
                          "buttonSize",
                          value as StudioBlock["buttonSize"],
                        )
                      }
                    />
                    <StudioColorPicker
                      label="Button Color"
                      value={block.buttonColor ?? "#ffffff"}
                      onChange={(value) => updateField("buttonColor", value)}
                    />
                    <StudioColorPicker
                      label="Button Text Color"
                      value={block.buttonTextColor ?? "#1a1a2e"}
                      onChange={(value) =>
                        updateField("buttonTextColor", value)
                      }
                    />
                    <StudioSwitchField
                      label="Rounded Corners"
                      checked={block.buttonRounded ?? true}
                      onChange={(value) => updateField("buttonRounded", value)}
                    />
                  </>
                ),
              },
            ])}
          </Stack>
        </Stack>
      );
    case "image-text":
      return (
        <Stack
          spacing={0.75}
          sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
        >
          <LayoutPresetPicker
            presets={imageTextPresets}
            selectedKey={block.layoutPreset}
            onSelect={selectPreset}
          />
          <Stack
            spacing={0.75}
            sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
          >
            {renderSections([
              {
                id: "image",
                title: "Image",
                content: (
                  <>
                    <StudioImageUpload
                      label="Image"
                      height={100}
                      emptyText="Upload or drag image"
                      value={block.imageUrl ?? ""}
                      onChange={(value) => updateField("imageUrl", value)}
                      {...buildAIUploadProps({
                        aiAspectRatioHint: "square",
                        blockContext: "Image + Text image",
                        fieldKey: `${block.id}:imageUrl`,
                        value: block.imageUrl ?? "",
                      })}
                    />
                    <StudioTextField
                      label="Alt Text"
                      placeholder="Describe this image"
                      value={block.imageAlt ?? ""}
                      onChange={(value) => updateField("imageAlt", value)}
                    />
                    <StudioToggleField
                      label="Image Fit"
                      options={[
                        { label: "Cover", value: "cover" },
                        { label: "Contain", value: "contain" },
                      ]}
                      value={block.imageFit ?? "cover"}
                      onChange={(value) =>
                        updateField(
                          "imageFit",
                          value as StudioBlock["imageFit"],
                        )
                      }
                    />
                    <StudioSliderField
                      label="Image Border Radius"
                      min={0}
                      max={20}
                      step={2}
                      defaultValue={8}
                      value={block.borderRadius ?? 8}
                      onChange={(value) => updateField("borderRadius", value)}
                    />
                    <StudioToggleField
                      label="Image Ratio"
                      options={[
                        { label: "Auto", value: "auto" },
                        { label: "1:1", value: "1:1" },
                        { label: "4:3", value: "4:3" },
                        { label: "16:9", value: "16:9" },
                      ]}
                      value={block.imageRatio ?? "auto"}
                      onChange={(value) =>
                        updateField(
                          "imageRatio",
                          value as StudioBlock["imageRatio"],
                        )
                      }
                    />
                  </>
                ),
              },
              {
                id: "content",
                title: "Content",
                content: (
                  <>
                    <StudioTextField
                      label="Headline"
                      placeholder="Enter headline"
                      value={block.headline ?? ""}
                      onChange={(value) => updateField("headline", value)}
                      aiDecorator
                    />
                    <StudioTextField
                      label="Subheading"
                      placeholder="Enter subheading"
                      value={block.subheading ?? ""}
                      onChange={(value) => updateField("subheading", value)}
                      aiDecorator
                    />
                    <StudioRichTextField
                      label="Body Text"
                      minRows={3}
                      value={block.body ?? ""}
                      onChange={(value) => updateField("body", value)}
                      placeholder="Write the main message..."
                    />
                    <StudioTextField
                      label="Button Text"
                      placeholder="Learn more"
                      value={block.buttonText ?? ""}
                      onChange={(value) => updateField("buttonText", value)}
                    />
                    <StudioTextField
                      label="Button URL"
                      placeholder="https://..."
                      type="url"
                      value={block.buttonUrl ?? ""}
                      onChange={(value) => updateField("buttonUrl", value)}
                    />
                  </>
                ),
              },
              ...(block.buttonText?.trim()
                ? [
                    {
                      id: "button-style",
                      title: "Button Style",
                      content: (
                        <CollapsibleSection
                          label="Customize Button"
                          enabled
                          onToggle={() => {}}
                          description="Refine the CTA once the button has copy"
                        >
                          <StudioToggleField
                            label="Button Style"
                            options={[
                              { label: "Filled", value: "filled" },
                              { label: "Outlined", value: "outlined" },
                              { label: "Link", value: "link" },
                            ]}
                            value={block.buttonStyle ?? "filled"}
                            onChange={(value) =>
                              updateField(
                                "buttonStyle",
                                value as StudioBlock["buttonStyle"],
                              )
                            }
                          />
                          <StudioColorPicker
                            label="Button Color"
                            value={block.buttonColor ?? "#111827"}
                            onChange={(value) =>
                              updateField("buttonColor", value)
                            }
                          />
                          <StudioColorPicker
                            label="Button Text Color"
                            value={block.buttonTextColor ?? "#ffffff"}
                            onChange={(value) =>
                              updateField("buttonTextColor", value)
                            }
                          />
                          <StudioToggleField
                            label="Button Size"
                            options={[
                              {
                                label: "S",
                                value: "sm",
                                visual: <ButtonSizeVisual width={12} />,
                              },
                              {
                                label: "M",
                                value: "md",
                                visual: <ButtonSizeVisual width={20} />,
                              },
                              {
                                label: "L",
                                value: "lg",
                                visual: <ButtonSizeVisual width={28} />,
                              },
                            ]}
                            layout="stacked"
                            iconPlacement="top"
                            value={block.buttonSize ?? "md"}
                            onChange={(value) =>
                              updateField(
                                "buttonSize",
                                value as StudioBlock["buttonSize"],
                              )
                            }
                          />
                          <StudioSwitchField
                            label="Rounded"
                            checked={block.buttonRounded ?? true}
                            onChange={(value) =>
                              updateField("buttonRounded", value)
                            }
                          />
                          <StudioSwitchField
                            label="Full Width"
                            checked={block.fullWidthButton ?? false}
                            onChange={(value) =>
                              updateField("fullWidthButton", value)
                            }
                          />
                        </CollapsibleSection>
                      ),
                    },
                  ]
                : []),
              ...(block.layout === "image-overlay" ||
              block.layoutPreset === "image-text-overlay"
                ? [
                    {
                      id: "overlay",
                      title: "Overlay",
                      content: (
                        <CollapsibleSection
                          label="Show Overlay"
                          enabled={block.showOverlay ?? true}
                          onToggle={(value) =>
                            updateField("showOverlay", value)
                          }
                        >
                          <StudioColorPicker
                            label="Overlay Color"
                            value={block.overlayColor ?? "#000000"}
                            onChange={(value) =>
                              updateField("overlayColor", value)
                            }
                          />
                          <StudioSliderField
                            label="Overlay Opacity"
                            min={0}
                            max={100}
                            step={5}
                            defaultValue={52}
                            value={block.overlayOpacity ?? 52}
                            onChange={(value) =>
                              updateField("overlayOpacity", value)
                            }
                          />
                        </CollapsibleSection>
                      ),
                    },
                  ]
                : []),
              {
                id: "style",
                title: "Style",
                content: (
                  <>
                    <StudioColorPicker
                      label="Background Color"
                      value={block.backgroundColor ?? "#ffffff"}
                      onChange={(value) =>
                        updateField("backgroundColor", value)
                      }
                    />
                    <StudioColorPicker
                      label="Text Color"
                      value={block.textColor ?? "#111827"}
                      onChange={(value) => updateField("textColor", value)}
                    />
                    <StudioAlignmentToggle
                      label="Text Alignment"
                      value={block.textAlign ?? "left"}
                      onChange={(value) => updateField("textAlign", value)}
                    />
                    <StudioSliderField
                      label="Content Padding"
                      min={12}
                      max={48}
                      step={4}
                      defaultValue={24}
                      value={block.contentPadding ?? 24}
                      onChange={(value) => updateField("contentPadding", value)}
                    />
                    <StudioToggleField
                      label="Column Split"
                      options={[
                        { label: "40/60", value: "40/60" },
                        { label: "50/50", value: "50/50" },
                        { label: "60/40", value: "60/40" },
                      ]}
                      value={block.columnSplit ?? "50/50"}
                      onChange={(value) =>
                        updateField(
                          "columnSplit",
                          value as StudioBlock["columnSplit"],
                        )
                      }
                    />
                  </>
                ),
              },
            ])}
          </Stack>
        </Stack>
      );
    case "plain-text":
      return (
        <Stack
          spacing={0.75}
          sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
        >
          <LayoutPresetPicker
            presets={plainTextPresets}
            selectedKey={block.layoutPreset}
            onSelect={selectPreset}
          />
          <Stack
            spacing={0.75}
            sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
          >
            {renderSections([
              {
                id: "content",
                title: "Content",
                content: (
                  <StudioRichTextField
                    label="Body Text"
                    minRows={5}
                    value={block.body ?? ""}
                    onChange={(value) => updateField("body", value)}
                    placeholder="Write the paragraph body..."
                  />
                ),
              },
              {
                id: "typography",
                title: "Typography",
                content: (
                  <>
                    <StudioToggleField
                      label="Font Size"
                      options={[
                        { label: "Small", value: "sm" },
                        { label: "Medium", value: "md" },
                        { label: "Large", value: "lg" },
                      ]}
                      value={block.fontSizePreset ?? block.fontSize ?? "md"}
                      onChange={(value) => {
                        updateField(
                          "fontSizePreset",
                          value as StudioBlock["fontSizePreset"],
                        );
                        updateField(
                          "fontSize",
                          value as StudioBlock["fontSize"],
                        );
                      }}
                    />
                    <StudioSliderField
                      label="Line Height"
                      min={1.3}
                      max={2.2}
                      step={0.1}
                      defaultValue={1.6}
                      value={block.lineHeightValue ?? block.lineHeight ?? 1.6}
                      onChange={(value) => {
                        updateField("lineHeightValue", value);
                        updateField("lineHeight", value);
                      }}
                    />
                    <StudioToggleField
                      label="Font Weight"
                      options={[
                        { label: "Normal", value: "normal" },
                        { label: "Medium", value: "medium" },
                      ]}
                      value={block.fontWeightPreset ?? "normal"}
                      onChange={(value) =>
                        updateField(
                          "fontWeightPreset",
                          value as StudioBlock["fontWeightPreset"],
                        )
                      }
                    />
                  </>
                ),
              },
              {
                id: "style",
                title: "Style",
                content: (
                  <>
                    <StudioColorPicker
                      label="Text Color"
                      value={block.textColor ?? "#111827"}
                      onChange={(value) => updateField("textColor", value)}
                    />
                    <StudioColorPicker
                      label="Background Color"
                      value={block.backgroundColor ?? "#ffffff"}
                      onChange={(value) =>
                        updateField("backgroundColor", value)
                      }
                    />
                    <StudioAlignmentToggle
                      label="Text Alignment"
                      value={block.textAlign ?? "left"}
                      onChange={(value) => updateField("textAlign", value)}
                    />
                    <StudioSliderField
                      label="Content Padding"
                      min={12}
                      max={56}
                      step={4}
                      defaultValue={28}
                      value={block.contentPadding ?? 28}
                      onChange={(value) => updateField("contentPadding", value)}
                    />
                  </>
                ),
              },
              ...(block.layout === "side-accent" || block.layout === "boxed"
                ? [
                    {
                      id: "accent",
                      title: "Accent",
                      content: (
                        <CollapsibleSection
                          label="Show Accent"
                          enabled={block.showAccent ?? true}
                          onToggle={(value) => updateField("showAccent", value)}
                        >
                          <StudioColorPicker
                            label="Accent Color"
                            value={block.accentColor ?? "#111827"}
                            onChange={(value) =>
                              updateField("accentColor", value)
                            }
                          />
                          <StudioSliderField
                            label="Accent Thickness"
                            min={2}
                            max={6}
                            step={1}
                            defaultValue={3}
                            value={block.accentThickness ?? 3}
                            onChange={(value) =>
                              updateField("accentThickness", value)
                            }
                          />
                          {block.layout === "boxed" ? (
                            <StudioSliderField
                              label="Box Border Radius"
                              min={0}
                              max={16}
                              step={2}
                              defaultValue={12}
                              value={block.boxBorderRadius ?? 12}
                              onChange={(value) =>
                                updateField("boxBorderRadius", value)
                              }
                            />
                          ) : null}
                        </CollapsibleSection>
                      ),
                    },
                  ]
                : []),
            ])}
          </Stack>
        </Stack>
      );
    case "call-to-action":
      return (
        <Stack
          spacing={0.75}
          sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
        >
          <LayoutPresetPicker
            presets={ctaPresets}
            selectedKey={block.layoutPreset}
            onSelect={selectPreset}
          />
          <Stack
            spacing={0.75}
            sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
          >
            {renderSections([
              {
                id: "content",
                title: "Content",
                content: (
                  <>
                    <StudioTextField
                      label="Headline"
                      placeholder="Enter headline"
                      value={block.headline ?? ""}
                      onChange={(value) => updateField("headline", value)}
                      aiDecorator
                    />
                    <StudioRichTextField
                      label="Description"
                      minRows={2}
                      value={block.body ?? ""}
                      onChange={(value) => updateField("body", value)}
                      placeholder="Add a short description"
                    />
                  </>
                ),
              },
              {
                id: "primary-button",
                title: "Primary Button",
                content: (
                  <>
                    <StudioTextField
                      label="Button Text"
                      placeholder="Get Started"
                      value={block.buttonText ?? ""}
                      onChange={(value) => updateField("buttonText", value)}
                    />
                    <StudioTextField
                      label="Button URL"
                      placeholder="https://..."
                      type="url"
                      value={block.buttonUrl ?? ""}
                      onChange={(value) => updateField("buttonUrl", value)}
                    />
                    <StudioToggleField
                      label="Button Style"
                      options={[
                        { label: "Filled", value: "filled" },
                        { label: "Outlined", value: "outlined" },
                        { label: "Ghost", value: "ghost" },
                      ]}
                      value={block.buttonStyle ?? "filled"}
                      onChange={(value) =>
                        updateField(
                          "buttonStyle",
                          value as StudioBlock["buttonStyle"],
                        )
                      }
                    />
                    <StudioToggleField
                      label="Button Size"
                      options={[
                        {
                          label: "S",
                          value: "sm",
                          visual: <ButtonSizeVisual width={12} />,
                        },
                        {
                          label: "M",
                          value: "md",
                          visual: <ButtonSizeVisual width={20} />,
                        },
                        {
                          label: "L",
                          value: "lg",
                          visual: <ButtonSizeVisual width={28} />,
                        },
                      ]}
                      layout="stacked"
                      iconPlacement="top"
                      value={block.buttonSize ?? "md"}
                      onChange={(value) =>
                        updateField(
                          "buttonSize",
                          value as StudioBlock["buttonSize"],
                        )
                      }
                    />
                    <StudioColorPicker
                      label="Button Color"
                      value={block.buttonColor ?? "#111827"}
                      onChange={(value) => updateField("buttonColor", value)}
                    />
                    <StudioColorPicker
                      label="Button Text Color"
                      value={block.buttonTextColor ?? "#ffffff"}
                      onChange={(value) =>
                        updateField("buttonTextColor", value)
                      }
                    />
                    <StudioSwitchField
                      label="Rounded"
                      checked={block.buttonRounded ?? true}
                      onChange={(value) => updateField("buttonRounded", value)}
                    />
                    <StudioSwitchField
                      label="Full Width"
                      checked={block.fullWidthButton ?? false}
                      onChange={(value) =>
                        updateField("fullWidthButton", value)
                      }
                    />
                  </>
                ),
              },
              {
                id: "secondary-link",
                title: "Secondary Link",
                content: (
                  <CollapsibleSection
                    label="Show Secondary Link"
                    enabled={block.showSecondaryLink ?? false}
                    onToggle={(value) =>
                      updateField("showSecondaryLink", value)
                    }
                  >
                    <StudioTextField
                      label="Link Text"
                      placeholder="Learn more"
                      value={block.secondaryLinkText ?? ""}
                      onChange={(value) =>
                        updateField("secondaryLinkText", value)
                      }
                    />
                    <StudioTextField
                      label="Link URL"
                      placeholder="https://..."
                      type="url"
                      value={block.secondaryLinkUrl ?? ""}
                      onChange={(value) =>
                        updateField("secondaryLinkUrl", value)
                      }
                    />
                    <StudioColorPicker
                      label="Link Color"
                      value={block.linkColor ?? block.textColor ?? "#111827"}
                      onChange={(value) => updateField("linkColor", value)}
                    />
                  </CollapsibleSection>
                ),
              },
              {
                id: "style",
                title: "Style",
                content: (
                  <>
                    <StudioColorPicker
                      label="Background Color"
                      value={block.backgroundColor ?? "#ffffff"}
                      onChange={(value) =>
                        updateField("backgroundColor", value)
                      }
                    />
                    <StudioColorPicker
                      label="Text Color"
                      value={block.textColor ?? "#111827"}
                      onChange={(value) => updateField("textColor", value)}
                    />
                    <StudioAlignmentToggle
                      label="Text Alignment"
                      value={block.textAlign ?? "center"}
                      onChange={(value) => updateField("textAlign", value)}
                    />
                    <StudioSliderField
                      label="Vertical Padding"
                      min={12}
                      max={64}
                      step={4}
                      defaultValue={32}
                      value={block.verticalPadding ?? 32}
                      onChange={(value) =>
                        updateField("verticalPadding", value)
                      }
                    />
                  </>
                ),
              },
            ])}
          </Stack>
        </Stack>
      );
    case "graphic-hero":
      return (
        <Stack
          spacing={0.75}
          sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
        >
          <LayoutPresetPicker
            presets={graphicHeroPresets}
            selectedKey={block.layoutPreset}
            onSelect={selectPreset}
          />
          <Stack
            spacing={0.75}
            sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
          >
            {renderSections([
              {
                id: "image",
                title: "Image",
                content: (
                  <>
                    <StudioImageUpload
                      label="Hero Image"
                      height={120}
                      emptyText="Upload or drag image"
                      value={block.imageUrl ?? ""}
                      onChange={(value) => updateField("imageUrl", value)}
                      {...buildAIUploadProps({
                        aiAspectRatioHint: "landscape",
                        blockContext: "Graphic Hero image",
                        fieldKey: `${block.id}:imageUrl`,
                        value: block.imageUrl ?? "",
                      })}
                    />
                    <StudioTextField
                      label="Alt Text"
                      placeholder="Describe this image for accessibility"
                      value={block.imageAlt ?? ""}
                      onChange={(value) => updateField("imageAlt", value)}
                    />
                    <Stack
                      spacing={0.5}
                      sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
                    >
                      <StudioTextField
                        label="Link URL"
                        placeholder="https://..."
                        type="url"
                        value={block.linkUrl ?? ""}
                        onChange={(value) => updateField("linkUrl", value)}
                      />
                      <Typography
                        level="body-xs"
                        sx={{
                          color: "neutral.400",
                          fontSize: "11px",
                          lineHeight: 1.45,
                        }}
                      >
                        Entire image becomes clickable
                      </Typography>
                    </Stack>
                    <StudioToggleField
                      label="Image Fit"
                      options={[
                        { label: "Cover", value: "cover" },
                        { label: "Contain", value: "contain" },
                        { label: "Fill", value: "fill" },
                      ]}
                      value={block.imageFit ?? "cover"}
                      onChange={(value) =>
                        updateField(
                          "imageFit",
                          value as StudioBlock["imageFit"],
                        )
                      }
                    />
                    <Stack
                      spacing={0.5}
                      sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
                    >
                      <StudioSliderField
                        label="Max Height"
                        min={200}
                        max={600}
                        step={20}
                        defaultValue={400}
                        value={block.maxHeight ?? 400}
                        onChange={(value) => updateField("maxHeight", value)}
                      />
                      <Typography
                        level="body-xs"
                        sx={{
                          color: "neutral.400",
                          fontSize: "11px",
                          lineHeight: 1.45,
                        }}
                      >
                        Limit image height on desktop
                      </Typography>
                    </Stack>
                  </>
                ),
              },
              {
                id: "overlay",
                title: "Overlay",
                content: (
                  <CollapsibleSection
                    label="Show Overlay"
                    enabled={block.showOverlay ?? false}
                    onToggle={(value) => updateField("showOverlay", value)}
                  >
                    <StudioColorPicker
                      label="Overlay Color"
                      value={block.overlayColor ?? "#000000"}
                      onChange={(value) => updateField("overlayColor", value)}
                      presets={GRAPHIC_HERO_OVERLAY_COLOR_PRESETS}
                      expandedPresets={[]}
                    />
                    <StudioSliderField
                      label="Overlay Opacity"
                      min={10}
                      max={90}
                      step={5}
                      defaultValue={45}
                      value={block.overlayOpacity ?? 45}
                      onChange={(value) => updateField("overlayOpacity", value)}
                    />
                    <StudioToggleField
                      label="Gradient Direction"
                      options={[
                        { label: "Uniform", value: "uniform" },
                        { label: "Top Fade", value: "top-to-bottom" },
                        { label: "Bottom Fade", value: "bottom-to-top" },
                      ]}
                      value={block.overlayGradientDirection ?? "uniform"}
                      onChange={(value) =>
                        updateField(
                          "overlayGradientDirection",
                          value as StudioBlock["overlayGradientDirection"],
                        )
                      }
                    />
                  </CollapsibleSection>
                ),
              },
              {
                id: "text-overlay",
                title: "Text Overlay",
                content: (
                  <CollapsibleSection
                    label="Show Text Overlay"
                    enabled={block.showTextOverlay ?? false}
                    onToggle={(value) => updateField("showTextOverlay", value)}
                    warningText={
                      block.showTextOverlay && !block.showOverlay
                        ? "Enable overlay for better text readability"
                        : undefined
                    }
                  >
                    <StudioTextField
                      label="Headline"
                      placeholder="Enter headline"
                      value={block.headline ?? ""}
                      onChange={(value) => updateField("headline", value)}
                      aiDecorator
                    />
                    <StudioTextField
                      label="Subheading"
                      placeholder="Enter subheading"
                      value={block.subheading ?? ""}
                      onChange={(value) => updateField("subheading", value)}
                      aiDecorator
                    />
                    <StudioToggleField
                      label="Text Position"
                      options={[
                        { label: "Top", value: "top" },
                        { label: "Center", value: "center" },
                        { label: "Bottom", value: "bottom" },
                      ]}
                      value={block.textPosition ?? "center"}
                      onChange={(value) =>
                        updateField(
                          "textPosition",
                          value as StudioBlock["textPosition"],
                        )
                      }
                    />
                    <StudioAlignmentToggle
                      label="Text Alignment"
                      value={block.textAlign ?? "center"}
                      onChange={(value) => updateField("textAlign", value)}
                    />
                    <StudioColorPicker
                      label="Text Color"
                      value={block.textColor ?? "#ffffff"}
                      onChange={(value) => updateField("textColor", value)}
                    />
                    <StudioSwitchField
                      label="Text Shadow"
                      checked={block.textShadow ?? true}
                      onChange={(value) => updateField("textShadow", value)}
                    />
                  </CollapsibleSection>
                ),
              },
              {
                id: "button",
                title: "Button",
                content: (
                  <CollapsibleSection
                    label="Show Button"
                    enabled={block.showButton ?? false}
                    onToggle={(value) => updateField("showButton", value)}
                  >
                    <StudioTextField
                      label="Button Text"
                      placeholder="Learn More"
                      value={block.buttonText ?? ""}
                      onChange={(value) => updateField("buttonText", value)}
                    />
                    <StudioTextField
                      label="Button URL"
                      placeholder="https://..."
                      type="url"
                      value={block.buttonUrl ?? ""}
                      onChange={(value) => updateField("buttonUrl", value)}
                    />
                    <StudioToggleField
                      label="Button Style"
                      options={[
                        { label: "Filled", value: "filled" },
                        { label: "Outlined", value: "outlined" },
                        { label: "Ghost", value: "ghost" },
                      ]}
                      value={block.buttonStyle ?? "filled"}
                      onChange={(value) =>
                        updateField(
                          "buttonStyle",
                          value as StudioBlock["buttonStyle"],
                        )
                      }
                    />
                    <StudioColorPicker
                      label="Button Color"
                      value={block.buttonColor ?? "#ffffff"}
                      onChange={(value) => updateField("buttonColor", value)}
                    />
                    <StudioColorPicker
                      label="Button Text Color"
                      value={block.buttonTextColor ?? "#000000"}
                      onChange={(value) =>
                        updateField("buttonTextColor", value)
                      }
                    />
                    <StudioToggleField
                      label="Button Size"
                      options={[
                        {
                          label: "S",
                          value: "sm",
                          visual: <ButtonSizeVisual width={12} />,
                        },
                        {
                          label: "M",
                          value: "md",
                          visual: <ButtonSizeVisual width={20} />,
                        },
                        {
                          label: "L",
                          value: "lg",
                          visual: <ButtonSizeVisual width={28} />,
                        },
                      ]}
                      layout="stacked"
                      iconPlacement="top"
                      value={block.buttonSize ?? "md"}
                      onChange={(value) =>
                        updateField(
                          "buttonSize",
                          value as StudioBlock["buttonSize"],
                        )
                      }
                    />
                    <StudioSwitchField
                      label="Rounded Corners"
                      checked={block.buttonRounded ?? true}
                      onChange={(value) => updateField("buttonRounded", value)}
                    />
                  </CollapsibleSection>
                ),
              },
              {
                id: "style",
                title: "Style",
                content: (
                  <>
                    <StudioSliderField
                      label="Border Radius"
                      min={0}
                      max={24}
                      step={2}
                      defaultValue={0}
                      value={block.borderRadius ?? 0}
                      onChange={(value) => updateField("borderRadius", value)}
                    />
                    <StudioSwitchField
                      label="Inset Padding"
                      checked={
                        block.insetPadding ?? block.imagePadding ?? false
                      }
                      onChange={(value) => {
                        updateField("insetPadding", value);
                        updateField("imagePadding", value);
                      }}
                    />
                    <StudioSwitchField
                      label="Show Shadow"
                      checked={block.showShadow ?? false}
                      onChange={(value) => updateField("showShadow", value)}
                    />
                    <StudioSwitchField
                      label="Show Caption Bar"
                      checked={block.showCaptionBar ?? false}
                      onChange={(value) => updateField("showCaptionBar", value)}
                    />
                    {block.showCaptionBar ? (
                      <StudioColorPicker
                        label="Caption Bar Color"
                        value={block.captionBarColor ?? "#1e293b"}
                        onChange={(value) =>
                          updateField("captionBarColor", value)
                        }
                      />
                    ) : null}
                    <StudioColorPicker
                      label="Background Color"
                      value={block.backgroundColor ?? "#ffffff"}
                      onChange={(value) =>
                        updateField("backgroundColor", value)
                      }
                    />
                  </>
                ),
              },
            ])}
          </Stack>
        </Stack>
      );
    case "full-width-image":
      return (
        <Stack
          spacing={0.75}
          sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
        >
          <LayoutPresetPicker
            presets={fullWidthImagePresets}
            selectedKey={block.layoutPreset}
            onSelect={selectPreset}
          />
          <Stack
            spacing={0.75}
            sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
          >
            {renderSections([
              {
                id: "image",
                title: "Image",
                content: (
                  <>
                    <StudioImageUpload
                      label="Hero Image"
                      height={120}
                      emptyText="Upload or drag image"
                      value={block.imageUrl ?? ""}
                      onChange={(value) => updateField("imageUrl", value)}
                      {...buildAIUploadProps({
                        aiAspectRatioHint: "landscape",
                        blockContext: "Full-Width Image block image",
                        fieldKey: `${block.id}:imageUrl`,
                        value: block.imageUrl ?? "",
                      })}
                    />
                    <StudioTextField
                      label="Alt Text"
                      placeholder="Describe this image"
                      value={block.imageAlt ?? ""}
                      onChange={(value) => updateField("imageAlt", value)}
                    />
                    <Stack
                      spacing={0.5}
                      sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
                    >
                      <StudioTextField
                        label="Link URL"
                        placeholder="https://..."
                        type="url"
                        value={block.linkUrl ?? ""}
                        onChange={(value) => updateField("linkUrl", value)}
                      />
                      <Typography
                        level="body-xs"
                        sx={{
                          color: "neutral.400",
                          fontSize: "11px",
                          lineHeight: 1.45,
                        }}
                      >
                        Entire image becomes clickable
                      </Typography>
                    </Stack>
                    <StudioToggleField
                      label="Image Fit"
                      options={[
                        { label: "Cover", value: "cover" },
                        { label: "Contain", value: "contain" },
                      ]}
                      value={block.imageFit ?? "cover"}
                      onChange={(value) =>
                        updateField(
                          "imageFit",
                          value as StudioBlock["imageFit"],
                        )
                      }
                    />
                    <StudioSliderField
                      label="Max Height"
                      min={150}
                      max={600}
                      step={10}
                      defaultValue={400}
                      value={block.maxHeight ?? 400}
                      onChange={(value) => updateField("maxHeight", value)}
                    />
                  </>
                ),
              },
              {
                id: "caption",
                title: "Caption",
                content: (
                  <CollapsibleSection
                    label="Show Caption"
                    enabled={
                      block.showCaption ?? Boolean(block.caption?.trim())
                    }
                    onToggle={(value) => updateField("showCaption", value)}
                  >
                    <StudioTextField
                      label="Caption Text"
                      placeholder="Photo by..."
                      value={block.caption ?? ""}
                      onChange={(value) => updateField("caption", value)}
                      aiDecorator
                    />
                    <StudioAlignmentToggle
                      label="Caption Alignment"
                      value={block.captionAlignment ?? "center"}
                      onChange={(value) =>
                        updateField("captionAlignment", value)
                      }
                    />
                    <StudioColorPicker
                      label="Caption Color"
                      value={block.captionColor ?? block.textColor ?? "#6b7280"}
                      onChange={(value) => {
                        updateField("captionColor", value);
                        updateField("textColor", value);
                      }}
                    />
                  </CollapsibleSection>
                ),
              },
              {
                id: "style",
                title: "Style",
                content: (
                  <>
                    <StudioSliderField
                      label="Border Radius"
                      min={0}
                      max={24}
                      step={2}
                      defaultValue={0}
                      value={block.borderRadius ?? 0}
                      onChange={(value) => updateField("borderRadius", value)}
                    />
                    <StudioSwitchField
                      label="Inset Padding"
                      checked={
                        block.insetPadding ?? block.imagePadding ?? false
                      }
                      onChange={(value) => {
                        updateField("insetPadding", value);
                        updateField("imagePadding", value);
                      }}
                    />
                    <StudioSwitchField
                      label="Show Shadow"
                      checked={block.showShadow ?? false}
                      onChange={(value) => updateField("showShadow", value)}
                    />
                    <StudioColorPicker
                      label="Background Color"
                      value={block.backgroundColor ?? "#ffffff"}
                      onChange={(value) =>
                        updateField("backgroundColor", value)
                      }
                    />
                  </>
                ),
              },
            ])}
          </Stack>
        </Stack>
      );
    case "divider":
      return (
        <Stack
          spacing={0.75}
          sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
        >
          <LayoutPresetPicker
            presets={dividerPresets}
            selectedKey={block.layoutPreset}
            onSelect={selectPreset}
          />
          <Stack
            spacing={0.75}
            sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
          >
            {renderSections([
              {
                id: "variant",
                title: "Variant",
                content: (
                  <>
                    <StudioToggleField
                      label="Divider Type"
                      options={[
                        { label: "Simple", value: "simple-line" },
                        { label: "Dashed", value: "dashed-line" },
                        { label: "Dotted", value: "dotted-line" },
                        { label: "Ornament", value: "ornamental" },
                      ]}
                      value={block.layout ?? "simple-line"}
                      onChange={(value) => {
                        updateField("layout", value);
                        const resolvedLineType =
                          value === "dashed-line"
                            ? "dashed"
                            : value === "dotted-line"
                              ? "dotted"
                              : "solid";
                        updateField(
                          "lineType",
                          resolvedLineType as StudioBlock["lineType"],
                        );
                        updateField(
                          "lineStyle",
                          resolvedLineType as StudioBlock["lineStyle"],
                        );
                        updateField("showOrnament", value === "ornamental");
                      }}
                    />
                    <StudioAlignmentToggle
                      label="Alignment"
                      value={block.textAlign ?? "center"}
                      onChange={(value) => updateField("textAlign", value)}
                    />
                  </>
                ),
              },
              {
                id: "line",
                title: "Line",
                content: (
                  <>
                    <StudioToggleField
                      label="Line Style"
                      options={[
                        { label: "Solid", value: "solid" },
                        { label: "Dashed", value: "dashed" },
                        { label: "Dotted", value: "dotted" },
                      ]}
                      value={block.lineType ?? block.lineStyle ?? "solid"}
                      onChange={(value) => {
                        updateField(
                          "lineType",
                          value as StudioBlock["lineType"],
                        );
                        updateField(
                          "lineStyle",
                          value as StudioBlock["lineStyle"],
                        );
                      }}
                    />
                    <StudioColorPicker
                      label="Line Color"
                      value={block.lineColor ?? "#d1d5db"}
                      onChange={(value) => updateField("lineColor", value)}
                    />
                    <StudioSliderField
                      label="Line Thickness"
                      min={1}
                      max={6}
                      step={1}
                      defaultValue={1}
                      value={block.lineThickness ?? 1}
                      onChange={(value) => updateField("lineThickness", value)}
                    />
                    <StudioSliderField
                      label="Line Width"
                      min={24}
                      max={100}
                      step={1}
                      defaultValue={100}
                      value={block.lineWidth ?? 100}
                      onChange={(value) => updateField("lineWidth", value)}
                    />
                  </>
                ),
              },
              {
                id: "ornament-spacing",
                title: "Ornament & Spacing",
                content: (
                  <>
                    <CollapsibleSection
                      label="Show Ornament"
                      enabled={
                        block.showOrnament ?? block.layout === "ornamental"
                      }
                      onToggle={(value) => {
                        updateField("showOrnament", value);
                        updateField(
                          "layout",
                          value ? "ornamental" : "simple-line",
                        );
                      }}
                    >
                      <StudioToggleField
                        label="Symbol"
                        options={[
                          { label: "Star", value: "✦" },
                          { label: "Dot", value: "●" },
                          { label: "Diamond", value: "◆" },
                          { label: "Spark", value: "★" },
                          { label: "Dash", value: "─" },
                        ]}
                        value={block.ornamentSymbol ?? "✦"}
                        onChange={(value) =>
                          updateField(
                            "ornamentSymbol",
                            value as StudioBlock["ornamentSymbol"],
                          )
                        }
                      />
                      <StudioColorPicker
                        label="Ornament Color"
                        value={block.ornamentColor ?? "#111827"}
                        onChange={(value) =>
                          updateField("ornamentColor", value)
                        }
                      />
                      <StudioSliderField
                        label="Ornament Size"
                        min={12}
                        max={28}
                        step={2}
                        defaultValue={16}
                        value={block.ornamentSize ?? 16}
                        onChange={(value) => updateField("ornamentSize", value)}
                      />
                    </CollapsibleSection>
                    <StudioColorPicker
                      label="Background Color"
                      value={block.backgroundColor ?? "#ffffff"}
                      onChange={(value) =>
                        updateField("backgroundColor", value)
                      }
                    />
                    <StudioSliderField
                      label="Padding Above"
                      min={0}
                      max={72}
                      step={4}
                      defaultValue={20}
                      value={block.paddingTop ?? 20}
                      onChange={(value) => updateField("paddingTop", value)}
                    />
                    <StudioSliderField
                      label="Padding Below"
                      min={0}
                      max={72}
                      step={4}
                      defaultValue={20}
                      value={block.paddingBottom ?? 20}
                      onChange={(value) => updateField("paddingBottom", value)}
                    />
                  </>
                ),
              },
            ])}
          </Stack>
        </Stack>
      );
    case "image-gallery":
      return (
        <Stack
          spacing={0.75}
          sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
        >
          <LayoutPresetPicker
            presets={imageGalleryPresets}
            selectedKey={block.layoutPreset}
            onSelect={selectPreset}
          />
          <Stack
            spacing={0.75}
            sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
          >
            {renderSections([
              {
                id: "images",
                title: "Images",
                content: (
                  <ImageGalleryManager
                    block={block}
                    campaignContext={buildStudioCampaignContext({
                      aspectRatioHint: "square",
                      block,
                      campaignName,
                      campaignType,
                    })}
                    campaignImageGallery={campaignImageGallery}
                    onTrackCampaignImageUsage={onTrackCampaignImageUsage}
                    updateField={updateField}
                    onRequestAIImage={onRequestAIImage}
                    resolveCampaignImageFieldSource={
                      resolveCampaignImageFieldSource
                    }
                  />
                ),
              },
              {
                id: "layout",
                title: "Layout",
                content: (
                  <>
                    <StudioToggleField
                      label="Grid Columns"
                      options={[
                        { label: "2", value: "2" },
                        { label: "3", value: "3" },
                        { label: "4", value: "4" },
                      ]}
                      value={String(block.gridColumns ?? 3)}
                      onChange={(value) =>
                        updateField("gridColumns", Number(value))
                      }
                    />
                    <StudioSliderField
                      label="Image Height"
                      min={120}
                      max={280}
                      step={10}
                      defaultValue={180}
                      value={block.imageHeight ?? 180}
                      onChange={(value) => updateField("imageHeight", value)}
                    />
                    <StudioSliderField
                      label="Gap"
                      min={4}
                      max={20}
                      step={2}
                      defaultValue={8}
                      value={block.gridGap ?? 8}
                      onChange={(value) => updateField("gridGap", value)}
                    />
                    <StudioSliderField
                      label="Border Radius"
                      min={0}
                      max={16}
                      step={2}
                      defaultValue={6}
                      value={block.borderRadius ?? 6}
                      onChange={(value) => updateField("borderRadius", value)}
                    />
                  </>
                ),
              },
              {
                id: "style",
                title: "Style",
                content: (
                  <>
                    <StudioSwitchField
                      label="Show Shadow"
                      checked={block.showShadow ?? false}
                      onChange={(value) => updateField("showShadow", value)}
                    />
                    <StudioColorPicker
                      label="Background Color"
                      value={block.backgroundColor ?? "#ffffff"}
                      onChange={(value) =>
                        updateField("backgroundColor", value)
                      }
                    />
                  </>
                ),
              },
            ])}
          </Stack>
        </Stack>
      );
    case "product-gallery":
      return (
        <Stack
          spacing={0.75}
          sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
        >
          <LayoutPresetPicker
            presets={productGalleryPresets}
            selectedKey={block.layoutPreset}
            onSelect={selectPreset}
          />
          <Stack
            spacing={0.75}
            sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
          >
            {renderSections([
              {
                id: "products",
                title: "Products",
                content: (
                  <ProductGalleryManager
                    block={block}
                    campaignContext={buildStudioCampaignContext({
                      aspectRatioHint: "portrait",
                      block,
                      campaignName,
                      campaignType,
                    })}
                    campaignImageGallery={campaignImageGallery}
                    onTrackCampaignImageUsage={onTrackCampaignImageUsage}
                    updateField={updateField}
                    onRequestAIImage={onRequestAIImage}
                    resolveCampaignImageFieldSource={
                      resolveCampaignImageFieldSource
                    }
                  />
                ),
              },
              {
                id: "layout",
                title: "Layout",
                content: (
                  <>
                    <StudioToggleField
                      label="Columns"
                      options={[
                        { label: "1", value: "1" },
                        { label: "2", value: "2" },
                        { label: "3", value: "3" },
                      ]}
                      value={String(block.gridColumns ?? 2)}
                      onChange={(value) =>
                        updateField("gridColumns", Number(value))
                      }
                    />
                    <StudioSliderField
                      label="Image Height"
                      min={120}
                      max={260}
                      step={10}
                      defaultValue={160}
                      value={block.imageHeight ?? 160}
                      onChange={(value) => updateField("imageHeight", value)}
                    />
                    <StudioSliderField
                      label="Card Gap"
                      min={8}
                      max={24}
                      step={2}
                      defaultValue={16}
                      value={block.cardGap ?? 16}
                      onChange={(value) => updateField("cardGap", value)}
                    />
                    <StudioSwitchField
                      label="Show Badges"
                      checked={block.showBadges ?? true}
                      onChange={(value) => updateField("showBadges", value)}
                    />
                    <StudioSwitchField
                      label="Show Prices"
                      checked={block.showPrices ?? true}
                      onChange={(value) => updateField("showPrices", value)}
                    />
                    <StudioSwitchField
                      label="Show Original Prices"
                      checked={block.showOriginalPrice ?? false}
                      onChange={(value) =>
                        updateField("showOriginalPrice", value)
                      }
                    />
                    <StudioSwitchField
                      label="Show Description"
                      checked={block.showDescription ?? true}
                      onChange={(value) =>
                        updateField("showDescription", value)
                      }
                    />
                    <StudioSwitchField
                      label="Show CTA Buttons"
                      checked={block.showCtaButtons ?? true}
                      onChange={(value) => updateField("showCtaButtons", value)}
                    />
                  </>
                ),
              },
              {
                id: "style",
                title: "Style",
                content: (
                  <>
                    <StudioColorPicker
                      label="Background Color"
                      value={block.backgroundColor ?? "#ffffff"}
                      onChange={(value) =>
                        updateField("backgroundColor", value)
                      }
                    />
                    <StudioColorPicker
                      label="Card Background"
                      value={block.cardBackgroundColor ?? "#ffffff"}
                      onChange={(value) =>
                        updateField("cardBackgroundColor", value)
                      }
                    />
                    <StudioSwitchField
                      label="Show Card Border"
                      checked={block.showCardBorder ?? block.showBorder ?? true}
                      onChange={(value) => {
                        updateField("showCardBorder", value);
                        updateField("showBorder", value);
                      }}
                    />
                    <StudioSliderField
                      label="Card Border Radius"
                      min={0}
                      max={20}
                      step={2}
                      defaultValue={12}
                      value={block.cardBorderRadius ?? 12}
                      onChange={(value) =>
                        updateField("cardBorderRadius", value)
                      }
                    />
                  </>
                ),
              },
            ])}
          </Stack>
        </Stack>
      );
    case "social-follow":
      return (
        <Stack
          spacing={0.75}
          sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
        >
          <LayoutPresetPicker
            presets={socialFollowPresets}
            selectedKey={block.layoutPreset}
            onSelect={selectPreset}
          />
          <Stack
            spacing={0.75}
            sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
          >
            {renderSections([
              {
                id: "social-links",
                title: "Social Links",
                content: (
                  <SocialLinksManager block={block} updateField={updateField} />
                ),
              },
              {
                id: "layout",
                title: "Layout",
                content: (
                  <>
                    <StudioTextField
                      label="Label"
                      placeholder="Follow us"
                      value={block.socialLabel ?? ""}
                      onChange={(value) => updateField("socialLabel", value)}
                    />
                    <StudioToggleField
                      label="Variant"
                      options={[
                        { label: "Icons", value: "icon-row" },
                        { label: "Label", value: "label-row" },
                        { label: "List", value: "vertical-list" },
                      ]}
                      value={block.layout ?? "icon-row"}
                      onChange={(value) => updateField("layout", value)}
                    />
                    <StudioAlignmentToggle
                      label="Alignment"
                      value={block.textAlign ?? "center"}
                      onChange={(value) => updateField("textAlign", value)}
                    />
                  </>
                ),
              },
              {
                id: "icon-style",
                title: "Icon Style",
                content: (
                  <>
                    <StudioToggleField
                      label="Icon Shape"
                      options={[
                        { label: "Filled", value: "filled" },
                        { label: "Outline", value: "outlined" },
                        { label: "Square", value: "square" },
                        { label: "Minimal", value: "minimal" },
                      ]}
                      value={
                        block.iconStyle ?? block.socialIconStyle ?? "filled"
                      }
                      onChange={(value) => {
                        updateField(
                          "iconStyle",
                          value as StudioBlock["iconStyle"],
                        );
                        updateField(
                          "socialIconStyle",
                          value as StudioBlock["socialIconStyle"],
                        );
                      }}
                    />
                    <StudioToggleField
                      label="Icon Size"
                      options={[
                        { label: "Small", value: "sm" },
                        { label: "Medium", value: "md" },
                        { label: "Large", value: "lg" },
                      ]}
                      value={block.iconSize ?? block.socialIconSize ?? "md"}
                      onChange={(value) => {
                        updateField(
                          "iconSize",
                          value as StudioBlock["iconSize"],
                        );
                        updateField(
                          "socialIconSize",
                          value as StudioBlock["socialIconSize"],
                        );
                      }}
                    />
                    <StudioToggleField
                      label="Color Mode"
                      options={[
                        { label: "Brand", value: "brand" },
                        { label: "Mono", value: "mono" },
                        { label: "Custom", value: "custom" },
                      ]}
                      value={
                        block.iconColorMode ??
                        (block.socialColorMode === "monochrome"
                          ? "mono"
                          : block.socialColorMode) ??
                        "brand"
                      }
                      onChange={(value) => {
                        updateField(
                          "iconColorMode",
                          value as StudioBlock["iconColorMode"],
                        );
                        updateField(
                          "socialColorMode",
                          (value === "mono"
                            ? "monochrome"
                            : value) as StudioBlock["socialColorMode"],
                        );
                      }}
                    />
                    {(block.iconColorMode ??
                      (block.socialColorMode === "monochrome"
                        ? "mono"
                        : block.socialColorMode)) === "custom" ? (
                      <StudioColorPicker
                        label="Custom Icon Color"
                        value={block.customIconColor ?? "#111827"}
                        onChange={(value) =>
                          updateField("customIconColor", value)
                        }
                      />
                    ) : null}
                    <StudioSliderField
                      label="Icon Spacing"
                      min={8}
                      max={20}
                      step={2}
                      defaultValue={12}
                      value={block.iconSpacing ?? 12}
                      onChange={(value) => updateField("iconSpacing", value)}
                    />
                  </>
                ),
              },
              {
                id: "style",
                title: "Style",
                content: (
                  <>
                    <StudioColorPicker
                      label="Background Color"
                      value={block.backgroundColor ?? "#ffffff"}
                      onChange={(value) =>
                        updateField("backgroundColor", value)
                      }
                    />
                    <StudioColorPicker
                      label="Text Color"
                      value={block.textColor ?? "#111827"}
                      onChange={(value) => updateField("textColor", value)}
                    />
                    <StudioSliderField
                      label="Vertical Padding"
                      min={8}
                      max={56}
                      step={4}
                      defaultValue={24}
                      value={block.verticalPadding ?? 24}
                      onChange={(value) =>
                        updateField("verticalPadding", value)
                      }
                    />
                  </>
                ),
              },
            ])}
          </Stack>
        </Stack>
      );
    case "footer":
      return (
        <Stack
          spacing={0.75}
          sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
        >
          <LayoutPresetPicker
            presets={footerPresets}
            selectedKey={block.layoutPreset}
            onSelect={selectPreset}
          />
          <Stack
            spacing={0.75}
            sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
          >
            {renderSections([
              {
                id: "content",
                title: "Content",
                content: (
                  <>
                    <StudioTextField
                      label="Business Name"
                      placeholder="Your Business"
                      value={block.businessName ?? ""}
                      onChange={(value) => updateField("businessName", value)}
                    />
                    <StudioTextField
                      label="Address"
                      multiline
                      minRows={3}
                      placeholder={"123 Main St\nCity, State"}
                      value={block.address ?? ""}
                      onChange={(value) => updateField("address", value)}
                    />
                    <StudioTextField
                      label="Copyright Text"
                      placeholder="© 2026 Your Business"
                      value={block.copyright ?? block.copyrightText ?? ""}
                      onChange={(value) => {
                        updateField("copyright", value);
                        updateField("copyrightText", value);
                      }}
                    />
                    <StudioRichTextField
                      label="Compliance Text"
                      minRows={3}
                      value={block.complianceText ?? ""}
                      onChange={(value) => updateField("complianceText", value)}
                      placeholder="You are receiving this email because you opted in at your business."
                    />
                  </>
                ),
              },
              {
                id: "branding",
                title: "Branding",
                content: (
                  <>
                    <StudioImageUpload
                      label="Logo"
                      height={72}
                      emptyText="Upload logo"
                      value={block.logoUrl ?? ""}
                      onChange={(value) => updateField("logoUrl", value)}
                      {...buildAIUploadProps({
                        aiAspectRatioHint: "landscape",
                        blockContext: "Footer logo",
                        fieldKey: `${block.id}:logoUrl`,
                        value: block.logoUrl ?? "",
                      })}
                    />
                    <StudioSliderField
                      label="Logo Size"
                      min={24}
                      max={80}
                      step={4}
                      defaultValue={40}
                      value={block.logoSize ?? 40}
                      onChange={(value) => updateField("logoSize", value)}
                    />
                    <StudioAlignmentToggle
                      label="Logo Alignment"
                      value={block.logoAlignment ?? "left"}
                      onChange={(value) => updateField("logoAlignment", value)}
                    />
                  </>
                ),
              },
              {
                id: "links",
                title: "Links",
                content: (
                  <>
                    <StudioSwitchField
                      label="Show Unsubscribe"
                      checked
                      disabled
                      description="Always required for compliance"
                    />
                    <StudioSwitchField
                      label="Show Manage Preferences"
                      checked={block.showManagePreferences !== false}
                      onChange={(value) =>
                        updateField("showManagePreferences", value)
                      }
                    />
                    <StudioSwitchField
                      label="Show Website Link"
                      checked={block.showWebsiteLink ?? false}
                      onChange={(value) =>
                        updateField("showWebsiteLink", value)
                      }
                    />
                    {block.showWebsiteLink ? (
                      <StudioTextField
                        label="Website URL"
                        placeholder="https://..."
                        type="url"
                        value={block.websiteUrl ?? ""}
                        onChange={(value) => updateField("websiteUrl", value)}
                      />
                    ) : null}
                  </>
                ),
              },
              {
                id: "social",
                title: "Social",
                content: (
                  <CollapsibleSection
                    label="Show Social Icons"
                    enabled={block.showSocialInFooter ?? false}
                    onToggle={(value) =>
                      updateField("showSocialInFooter", value)
                    }
                  >
                    <SocialLinksManager
                      block={block}
                      updateField={updateField}
                      fieldKey="footerSocialLinks"
                    />
                    <StudioToggleField
                      label="Icon Style"
                      options={[
                        { label: "Filled", value: "filled" },
                        { label: "Outlined", value: "outlined" },
                        { label: "Minimal", value: "minimal" },
                      ]}
                      value={block.footerIconStyle ?? "filled"}
                      onChange={(value) =>
                        updateField(
                          "footerIconStyle",
                          value as StudioBlock["footerIconStyle"],
                        )
                      }
                    />
                    <StudioColorPicker
                      label="Icon Color"
                      value={block.footerIconColor ?? "#cbd5e1"}
                      onChange={(value) =>
                        updateField("footerIconColor", value)
                      }
                    />
                  </CollapsibleSection>
                ),
              },
              {
                id: "style",
                title: "Style",
                content: (
                  <>
                    <StudioColorPicker
                      label="Background Color"
                      value={block.backgroundColor ?? "#1e293b"}
                      onChange={(value) =>
                        updateField("backgroundColor", value)
                      }
                    />
                    <StudioColorPicker
                      label="Text Color"
                      value={block.textColor ?? "#ffffff"}
                      onChange={(value) => updateField("textColor", value)}
                    />
                    <StudioColorPicker
                      label="Link Color"
                      value={block.linkColor ?? "#cbd5e1"}
                      onChange={(value) => updateField("linkColor", value)}
                    />
                    <StudioColorPicker
                      label="Divider Color"
                      value={
                        block.dividerBelowColor ?? "rgba(255,255,255,0.16)"
                      }
                      onChange={(value) =>
                        updateField("dividerBelowColor", value)
                      }
                    />
                    <StudioSliderField
                      label="Vertical Padding"
                      min={16}
                      max={56}
                      step={4}
                      defaultValue={32}
                      value={block.verticalPadding ?? 32}
                      onChange={(value) =>
                        updateField("verticalPadding", value)
                      }
                    />
                  </>
                ),
              },
            ])}
          </Stack>
        </Stack>
      );
    case "newsletter-header":
      return (
        <Stack
          spacing={0.75}
          sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
        >
          <LayoutPresetPicker
            presets={newsletterHeaderPresets}
            selectedKey={block.layoutPreset}
            onSelect={selectPreset}
          />
          <Stack
            spacing={0.75}
            sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
          >
            {renderSections([
              {
                id: "content",
                title: "Content",
                content: (
                  <>
                    <StudioTextField
                      label="Header Title"
                      placeholder="Newsletter title"
                      value={block.headline ?? ""}
                      onChange={(value) => updateField("headline", value)}
                      aiDecorator
                    />
                    <StudioTextField
                      label="Date Label"
                      placeholder="May 2026"
                      value={block.dateLabel ?? ""}
                      onChange={(value) => updateField("dateLabel", value)}
                    />
                    <StudioTextField
                      label="Tagline"
                      placeholder="Your weekly garden update"
                      value={block.tagline ?? ""}
                      onChange={(value) => updateField("tagline", value)}
                    />
                  </>
                ),
              },
              {
                id: "branding",
                title: "Branding",
                content: (
                  <>
                    <StudioImageUpload
                      label="Logo"
                      height={72}
                      emptyText="Upload logo"
                      value={block.logoUrl ?? ""}
                      onChange={(value) => updateField("logoUrl", value)}
                      {...buildAIUploadProps({
                        aiAspectRatioHint: "landscape",
                        blockContext: "Newsletter Header logo",
                        fieldKey: `${block.id}:logoUrl`,
                        value: block.logoUrl ?? "",
                      })}
                    />
                    <StudioSliderField
                      label="Logo Size"
                      min={24}
                      max={80}
                      step={4}
                      defaultValue={40}
                      value={block.logoSize ?? 40}
                      onChange={(value) => updateField("logoSize", value)}
                    />
                    <StudioAlignmentToggle
                      label="Logo Alignment"
                      value={block.logoAlignment ?? "left"}
                      onChange={(value) => updateField("logoAlignment", value)}
                    />
                    <StudioToggleField
                      label="Logo Shape"
                      options={[
                        { label: "Square", value: "square" },
                        { label: "Rounded", value: "rounded" },
                        { label: "Circle", value: "circle" },
                      ]}
                      value={block.logoShape ?? "rounded"}
                      onChange={(value) =>
                        updateField(
                          "logoShape",
                          value as StudioBlock["logoShape"],
                        )
                      }
                    />
                  </>
                ),
              },
              {
                id: "style",
                title: "Style",
                content: (
                  <>
                    <StudioColorPicker
                      label="Background Color"
                      value={block.backgroundColor ?? "#ffffff"}
                      onChange={(value) =>
                        updateField("backgroundColor", value)
                      }
                    />
                    <StudioColorPicker
                      label="Text Color"
                      value={block.textColor ?? "#1a1a2e"}
                      onChange={(value) => updateField("textColor", value)}
                    />
                    <StudioSwitchField
                      label="Show Divider Below"
                      checked={
                        block.showDividerBelow ?? block.showDivider ?? true
                      }
                      onChange={(value) => {
                        updateField("showDividerBelow", value);
                        updateField("showDivider", value);
                      }}
                    />
                    {(block.showDividerBelow ?? block.showDivider) ? (
                      <StudioColorPicker
                        label="Divider Color"
                        value={block.dividerBelowColor ?? "#e2e8f0"}
                        onChange={(value) =>
                          updateField("dividerBelowColor", value)
                        }
                      />
                    ) : null}
                    <StudioSliderField
                      label="Vertical Padding"
                      min={12}
                      max={48}
                      step={4}
                      defaultValue={20}
                      value={block.verticalPadding ?? 20}
                      onChange={(value) =>
                        updateField("verticalPadding", value)
                      }
                    />
                  </>
                ),
              },
            ])}
          </Stack>
        </Stack>
      );
    case "quote":
      return (
        <Stack
          spacing={0.75}
          sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
        >
          <LayoutPresetPicker
            presets={quotePresets}
            selectedKey={block.layoutPreset}
            onSelect={selectPreset}
          />
          <Stack
            spacing={0.75}
            sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
          >
            {renderSections([
              {
                id: "content",
                title: "Content",
                content: (
                  <>
                    <StudioRichTextField
                      label="Quote Text"
                      minRows={3}
                      aiDecorator
                      value={block.quoteText ?? ""}
                      onChange={(value) => updateField("quoteText", value)}
                      placeholder="Enter quote"
                    />
                    <StudioTextField
                      label="Author Name"
                      placeholder="Jane Smith"
                      value={block.authorName ?? ""}
                      onChange={(value) => updateField("authorName", value)}
                    />
                    <StudioTextField
                      label="Author Title"
                      placeholder="CEO, Garden Co."
                      value={block.authorTitle ?? ""}
                      onChange={(value) => updateField("authorTitle", value)}
                    />
                  </>
                ),
              },
              {
                id: "author-image",
                title: "Author Image",
                content: (
                  <CollapsibleSection
                    label="Show Author Image"
                    enabled={
                      block.showAuthorImage ??
                      Boolean(
                        (block.authorImageUrl ?? block.authorAvatarUrl)?.trim(),
                      )
                    }
                    onToggle={(value) => updateField("showAuthorImage", value)}
                  >
                    <StudioImageUpload
                      label="Author Avatar"
                      height={56}
                      emptyText="Upload avatar"
                      value={
                        block.authorImageUrl ?? block.authorAvatarUrl ?? ""
                      }
                      onChange={(value) => {
                        updateField("authorImageUrl", value);
                        updateField("authorAvatarUrl", value);
                      }}
                      {...buildAIUploadProps({
                        aiAspectRatioHint: "square",
                        blockContext: "Quote author image",
                        fieldKey: `${block.id}:authorImageUrl`,
                        value:
                          block.authorImageUrl ?? block.authorAvatarUrl ?? "",
                      })}
                    />
                    <StudioSliderField
                      label="Avatar Size"
                      min={32}
                      max={64}
                      step={4}
                      defaultValue={48}
                      value={block.authorAvatarSize ?? 48}
                      onChange={(value) =>
                        updateField("authorAvatarSize", value)
                      }
                    />
                  </CollapsibleSection>
                ),
              },
              {
                id: "style",
                title: "Style",
                content: (
                  <>
                    <StudioColorPicker
                      label="Accent Color"
                      value={block.accentColor ?? "#111827"}
                      onChange={(value) => updateField("accentColor", value)}
                    />
                    <StudioColorPicker
                      label="Background Color"
                      value={block.backgroundColor ?? "#ffffff"}
                      onChange={(value) =>
                        updateField("backgroundColor", value)
                      }
                    />
                    <StudioColorPicker
                      label="Text Color"
                      value={block.textColor ?? "#111827"}
                      onChange={(value) => updateField("textColor", value)}
                    />
                    <StudioAlignmentToggle
                      label="Text Alignment"
                      value={block.textAlign ?? "left"}
                      onChange={(value) => updateField("textAlign", value)}
                    />
                    <StudioToggleField
                      label="Font Style"
                      options={[
                        { label: "Italic", value: "italic" },
                        { label: "Normal", value: "normal" },
                      ]}
                      value={block.fontStyle ?? "italic"}
                      onChange={(value) =>
                        updateField(
                          "fontStyle",
                          value as StudioBlock["fontStyle"],
                        )
                      }
                    />
                    <StudioSliderField
                      label="Quote Mark Size"
                      min={32}
                      max={72}
                      step={4}
                      defaultValue={48}
                      value={block.quoteMarkSize ?? 48}
                      onChange={(value) => updateField("quoteMarkSize", value)}
                    />
                    <StudioSliderField
                      label="Content Padding"
                      min={16}
                      max={48}
                      step={4}
                      defaultValue={32}
                      value={block.contentPadding ?? 32}
                      onChange={(value) => updateField("contentPadding", value)}
                    />
                  </>
                ),
              },
            ])}
          </Stack>
        </Stack>
      );
    case "product-card":
      return (
        <Stack
          spacing={0.75}
          sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
        >
          <LayoutPresetPicker
            presets={productCardPresets}
            selectedKey={block.layoutPreset}
            onSelect={selectPreset}
          />
          <Stack
            spacing={0.75}
            sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
          >
            {renderSections([
              {
                id: "product",
                title: "Product",
                content: (
                  <>
                    <StudioTextField
                      label="Product Name"
                      placeholder="Product name"
                      value={block.productName ?? ""}
                      onChange={(value) => updateField("productName", value)}
                      aiDecorator
                    />
                    <StudioTextField
                      label="Price"
                      placeholder="$29.99"
                      startDecorator={<DollarSign size={14} />}
                      value={block.productPrice ?? ""}
                      onChange={(value) => updateField("productPrice", value)}
                    />
                    <Stack
                      spacing={0.5}
                      sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
                    >
                      <StudioTextField
                        label="Original Price"
                        placeholder="$39.99"
                        value={block.originalPrice ?? ""}
                        onChange={(value) =>
                          updateField("originalPrice", value)
                        }
                      />
                      <Typography
                        level="body-xs"
                        sx={{
                          color: "neutral.400",
                          fontSize: "11px",
                          lineHeight: 1.45,
                        }}
                      >
                        Shows as strikethrough
                      </Typography>
                    </Stack>
                    <StudioRichTextField
                      label="Description"
                      minRows={2}
                      value={block.productDescription ?? ""}
                      onChange={(value) =>
                        updateField("productDescription", value)
                      }
                      placeholder="Short description"
                    />
                  </>
                ),
              },
              {
                id: "badge",
                title: "Badge",
                content: (
                  <CollapsibleSection
                    label="Show Badge"
                    enabled={
                      block.showBadges ?? Boolean(block.badgeText?.trim())
                    }
                    onToggle={(value) => updateField("showBadges", value)}
                  >
                    <StudioTextField
                      label="Badge Text"
                      placeholder="SALE"
                      value={block.badgeText ?? ""}
                      onChange={(value) => updateField("badgeText", value)}
                    />
                    <StudioColorPicker
                      label="Badge Color"
                      value={block.badgeColor ?? "#111827"}
                      onChange={(value) => updateField("badgeColor", value)}
                    />
                    <StudioColorPicker
                      label="Badge Text Color"
                      value={block.badgeTextColor ?? "#ffffff"}
                      onChange={(value) => updateField("badgeTextColor", value)}
                    />
                    <StudioToggleField
                      label="Badge Position"
                      options={[
                        { label: "Top Left", value: "top-left" },
                        { label: "Top Right", value: "top-right" },
                      ]}
                      value={block.badgePosition ?? "top-left"}
                      onChange={(value) =>
                        updateField(
                          "badgePosition",
                          value as StudioBlock["badgePosition"],
                        )
                      }
                    />
                  </CollapsibleSection>
                ),
              },
              {
                id: "image",
                title: "Image",
                content: (
                  <>
                    <StudioImageUpload
                      label="Product Image"
                      height={100}
                      emptyText="Upload product image"
                      value={block.imageUrl ?? ""}
                      onChange={(value) => updateField("imageUrl", value)}
                      {...buildAIUploadProps({
                        aiAspectRatioHint: "portrait",
                        blockContext: "Product Card image",
                        fieldKey: `${block.id}:imageUrl`,
                        value: block.imageUrl ?? "",
                      })}
                    />
                    <StudioToggleField
                      label="Image Fit"
                      options={[
                        { label: "Cover", value: "cover" },
                        { label: "Contain", value: "contain" },
                      ]}
                      value={block.imageFit ?? "cover"}
                      onChange={(value) =>
                        updateField(
                          "imageFit",
                          value as StudioBlock["imageFit"],
                        )
                      }
                    />
                    <StudioSliderField
                      label="Image Border Radius"
                      min={0}
                      max={16}
                      step={2}
                      defaultValue={8}
                      value={block.borderRadius ?? 8}
                      onChange={(value) => updateField("borderRadius", value)}
                    />
                  </>
                ),
              },
              {
                id: "cta",
                title: "CTA",
                content: (
                  <>
                    <StudioTextField
                      label="Button Text"
                      placeholder="Shop Now"
                      value={block.buttonText ?? ""}
                      onChange={(value) => updateField("buttonText", value)}
                    />
                    <StudioTextField
                      label="Button URL"
                      placeholder="https://..."
                      type="url"
                      value={block.buttonUrl ?? ""}
                      onChange={(value) => updateField("buttonUrl", value)}
                    />
                    <StudioToggleField
                      label="Button Style"
                      options={[
                        { label: "Filled", value: "filled" },
                        { label: "Outlined", value: "outlined" },
                        { label: "Link", value: "link" },
                      ]}
                      value={block.buttonStyle ?? "filled"}
                      onChange={(value) =>
                        updateField(
                          "buttonStyle",
                          value as StudioBlock["buttonStyle"],
                        )
                      }
                    />
                    <StudioColorPicker
                      label="Button Color"
                      value={block.buttonColor ?? "#111827"}
                      onChange={(value) => updateField("buttonColor", value)}
                    />
                    <StudioColorPicker
                      label="Button Text Color"
                      value={block.buttonTextColor ?? "#ffffff"}
                      onChange={(value) =>
                        updateField("buttonTextColor", value)
                      }
                    />
                    <StudioSwitchField
                      label="Full Width Button"
                      checked={block.fullWidthButton ?? false}
                      onChange={(value) =>
                        updateField("fullWidthButton", value)
                      }
                    />
                  </>
                ),
              },
              {
                id: "style",
                title: "Style",
                content: (
                  <>
                    <StudioColorPicker
                      label="Background Color"
                      value={block.backgroundColor ?? "#ffffff"}
                      onChange={(value) =>
                        updateField("backgroundColor", value)
                      }
                    />
                    <StudioColorPicker
                      label="Text Color"
                      value={block.textColor ?? "#111827"}
                      onChange={(value) => updateField("textColor", value)}
                    />
                    <StudioSwitchField
                      label="Show Card Border"
                      checked={block.showCardBorder ?? block.showBorder ?? true}
                      onChange={(value) => {
                        updateField("showCardBorder", value);
                        updateField("showBorder", value);
                      }}
                    />
                    <StudioSliderField
                      label="Card Border Radius"
                      min={0}
                      max={16}
                      step={2}
                      defaultValue={12}
                      value={block.cardBorderRadius ?? 12}
                      onChange={(value) =>
                        updateField("cardBorderRadius", value)
                      }
                    />
                  </>
                ),
              },
            ])}
          </Stack>
        </Stack>
      );
    case "spacer":
      return (
        <Stack
          spacing={0.75}
          sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
        >
          <LayoutPresetPicker
            presets={spacerPresets}
            selectedKey={block.layoutPreset}
            onSelect={selectPreset}
          />
          <Stack
            spacing={0.75}
            sx={{ width: "100%", maxWidth: "100%", minWidth: 0 }}
          >
            {renderSections([
              {
                id: "layout",
                title: "Layout",
                content: (
                  <>
                    <StudioSliderField
                      label="Spacer Height"
                      min={0}
                      max={120}
                      step={4}
                      defaultValue={32}
                      value={block.spacerHeight ?? 32}
                      onChange={(value) => updateField("spacerHeight", value)}
                    />
                    <StudioSwitchField
                      label="Show Dotted Outline"
                      checked={block.showDottedOutline ?? true}
                      onChange={(value) =>
                        updateField("showDottedOutline", value)
                      }
                    />
                    <StudioColorPicker
                      label="Background Color"
                      value={block.backgroundColor ?? "transparent"}
                      onChange={(value) =>
                        updateField("backgroundColor", value)
                      }
                    />
                  </>
                ),
              },
            ])}
          </Stack>
        </Stack>
      );
    default:
      return null;
  }
}

export default function BlockPropertiesPanel({
  campaignImageGallery,
  campaignName,
  campaignType,
  selectedBlockId,
  blocks,
  open,
  onClose,
  onRequestAIImage,
  onTrackCampaignImageUsage,
  onRestoreComplete,
  onScrollPositionChange,
  onUpdateBlockField,
  resolveCampaignImageFieldSource,
  restoreScrollPosition,
  suppressed = false,
}: BlockPropertiesPanelProps) {
  const block = React.useMemo(
    () => blocks.find((item) => item.id === selectedBlockId) ?? null,
    [blocks, selectedBlockId],
  );
  const blockDefinition = block ? STUDIO_BLOCK_LOOKUP[block.type] : null;
  const Icon = blockDefinition?.icon;
  const panelVisible = open && !suppressed;
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const pendingRestoreRef = React.useRef(false);
  const previousPanelVisibleRef = React.useRef(panelVisible);

  React.useEffect(() => {
    if (panelVisible && !previousPanelVisibleRef.current) {
      pendingRestoreRef.current = true;
    }

    previousPanelVisibleRef.current = panelVisible;
  }, [panelVisible]);

  React.useLayoutEffect(() => {
    if (
      panelVisible &&
      scrollContainerRef.current &&
      typeof restoreScrollPosition === "number"
    ) {
      scrollContainerRef.current.scrollTop = restoreScrollPosition;
    }
  }, [panelVisible, restoreScrollPosition, selectedBlockId]);

  return (
    <Sheet
      onTransitionEnd={(event) => {
        if (!pendingRestoreRef.current || !panelVisible) {
          return;
        }

        if (
          event.propertyName !== "width" &&
          event.propertyName !== "transform"
        ) {
          return;
        }

        pendingRestoreRef.current = false;
        onRestoreComplete?.();
      }}
      sx={{
        display: "grid",
        position: { xs: "fixed", md: "relative" },
        inset: { xs: 0, md: "auto" },
        width: { xs: "100vw", md: 340 },
        maxWidth: "100%",
        boxSizing: "border-box",
        minHeight: 0,
        height: { xs: "100dvh", md: "auto" },
        gridTemplateRows: "auto minmax(0, 1fr)",
        overflow: "hidden",
        bgcolor: "background.surface",
        borderTop: { xs: "none", md: "none" },
        borderTopColor: { xs: "rgba(15, 23, 42, 0.08)", md: "transparent" },
        boxShadow: panelVisible
          ? {
              xs: "0 -18px 32px -24px rgba(15, 23, 42, 0.35)",
              md: "-1px 0 0 0 rgba(15, 23, 42, 0.06), -14px 0 30px -28px rgba(15, 23, 42, 0.35)",
            }
          : "none",
        transition:
          "width 200ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 200ms ease, transform 200ms cubic-bezier(0.22, 1, 0.36, 1), opacity 120ms ease",
        transform: {
          xs: panelVisible ? "translateY(0)" : "translateY(100%)",
          md: "none",
        },
        opacity: panelVisible ? 1 : 0,
        pointerEvents: panelVisible ? "auto" : "none",
        zIndex: (theme) =>
          panelVisible
            ? (theme.vars.zIndex.modal ?? theme.zIndex.modal) - 2
            : "auto",
      }}
    >
      <Sheet
        sx={{
          minHeight: 52,
          px: 2.5,
          py: { xs: 1.25, md: 1 },
          pt: { xs: "calc(12px + env(safe-area-inset-top, 0px))", md: 1 },
          boxShadow: panelVisible ? "0 1px 0 0 rgba(15, 23, 42, 0.07)" : "none",
          opacity: panelVisible ? 1 : 0,
          transition: "opacity 120ms ease, box-shadow 200ms ease",
          pointerEvents: panelVisible ? "auto" : "none",
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ minWidth: 0, flex: 1 }}
          >
            {Icon ? (
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: "10px",
                  bgcolor: "primary.50",
                  color: "primary.600",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: "inset 0 0 0 1px var(--joy-palette-primary-100)",
                }}
              >
                <Icon size={16} />
              </Box>
            ) : null}
            <Typography
              level="title-sm"
              noWrap
              sx={{ fontSize: "15px", fontWeight: 600, color: "neutral.800" }}
            >
              {blockDefinition?.name ?? "Block Properties"}
            </Typography>
          </Stack>
          <IconButton
            variant="plain"
            color="neutral"
            size="sm"
            aria-label="Close block properties"
            onClick={onClose}
            sx={{
              minWidth: 32,
              minHeight: 32,
              borderRadius: "8px",
              color: "neutral.500",
              "&:hover": { bgcolor: "primary.50", color: "primary.700" },
              "&:focus-visible": {
                outline: "2px solid",
                outlineColor: "primary.400",
                outlineOffset: 2,
              },
            }}
          >
            <X size={16} />
          </IconButton>
        </Stack>
      </Sheet>

      <Box
        ref={scrollContainerRef}
        onScroll={(event) => {
          onScrollPositionChange?.(event.currentTarget.scrollTop);
        }}
        sx={{
          minHeight: 0,
          overflowX: "hidden",
          overflowY: "auto",
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
          px: 0,
          py: {
            xs: "0 0 calc(16px + env(safe-area-inset-bottom, 0px))",
            md: 0,
          },
          opacity: panelVisible ? 1 : 0,
          transition: panelVisible
            ? "opacity 120ms ease 100ms"
            : "opacity 120ms ease 0ms",
          pointerEvents: panelVisible ? "auto" : "none",
        }}
      >
        {block ? (
          <PanelContent
            key={block.id}
            block={block}
            campaignImageGallery={campaignImageGallery}
            campaignName={campaignName}
            campaignType={campaignType}
            onTrackCampaignImageUsage={onTrackCampaignImageUsage}
            onRequestAIImage={onRequestAIImage}
            onUpdateBlockField={onUpdateBlockField}
            resolveCampaignImageFieldSource={resolveCampaignImageFieldSource}
          />
        ) : null}
      </Box>
    </Sheet>
  );
}
