import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useParams } from "react-router-dom";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useSegmentCounts } from "@/hooks/useSegmentCounts";
import { useTenant } from "@/hooks/useTenant";
import { useCampaignCloning } from "@/hooks/useCampaignCloning";
import {
  Loader2,
  Mail,
  Users,
  Sparkles,
  Send,
  Eye,
  Lock,
  X,
} from "lucide-react";
import { useSenderConfiguration } from "@/hooks/useSenderConfiguration";
import { SenderVerificationModal } from "./campaigns/SenderVerificationModal";
import { CampaignSendConfirmationModal } from "./campaigns/CampaignSendConfirmationModal";
import { CleanEmailBlockEditor } from "./CleanEmailBlockEditor";
import { StructurePicker } from "./StructurePicker";
import { EmailHealthScore } from "./EmailHealthScore";
import { FullEmailPreview } from "./FullEmailPreview";
import { ContentBlock } from "@/types/emailBuilder";
import { convertNewsletterToCRM } from "@/utils/newsletterToCrmSync";
import { supabase } from "@/integrations/supabase/client";
import {
  saveCampaignAsDraft,
  sendCampaign,
  CampaignData,
  updateCampaignSchedule,
  unscheduleCampaign,
  sendScheduledCampaignNow,
} from "@/utils/crmCampaignService";
import { imageGenerationService } from "@/services/imageGenerationService";
import { SaveIndicator } from "@/components/crm/SaveIndicator";
// Footer HTML is generated server-side in send-test-email and send-email-campaign edge functions
import { useFooterSettings } from "@/hooks/useFooterSettings";
import { useCompanyInfo } from "@/hooks/useCompanyInfo";
import { useBrandDefaults } from "@/hooks/useBrandDefaults";
import {
  generateNewsletterBlocks,
  getFallbackBlocks,
} from "@/services/newsletterBlockGenerator";
import { fetchSmartImage } from "@/services/unsplashService";
import { useGeneratedBundle } from "@/hooks/useGeneratedBundle";
import { CampaignSetupWizard } from "./campaign-setup/CampaignSetupWizard";
import { AIWriterDialog } from "./ai-writer/AIWriterDialog";
import { AIPersonalizationDialog } from "./AIPersonalizationDialog";
import { SenderStatusIndicator } from "./campaigns/SenderStatusIndicator";
import { CampaignActionBar } from "./CampaignActionBar";
import { ScheduleOption } from "./ScheduleSelector";
import { ScheduledCampaignBanner } from "./ScheduledCampaignBanner";
import { CampaignDeliveryStatusCard } from "./CampaignDeliveryStatusCard";
import { CampaignReadiness } from "./CampaignReadiness";
import { createBlockPrompt } from "@/utils/blockPromptBuilder";
import {
  normalizeAIResponse,
  applyAIToBlock,
} from "@/lib/newsletter/aiMapping";
import { usePagePersistence } from "@/hooks/usePagePersistence";
import { DomainHealthBanner } from "@/components/crm/email/DomainHealthBanner";
import {
  normalizeBlockForSave,
  normalizeBlockFromDatabase,
  DatabaseBlock,
} from "@/utils/blockFieldMapping";
import {
  getEmailSafeImageUrl,
  isEmailSafeImageUrl,
  debugBlockImageUrls,
} from "@/utils/emailImageUrl";
import {
  OPACITY_DEFAULTS,
  normalizeOpacityToDecimal,
} from "@/utils/opacityUtils";
import { useSaveQueue } from "@/hooks/useSaveQueue";
import { DraftRestorationDialog } from "./DraftRestorationDialog";
import { useBeforeUnload } from "@/hooks/useBeforeUnload";
import { AutoSaveStatusBar } from "./AutoSaveStatusBar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { generateCampaignSessionId } from "@/types/campaign";
import { sanitizeCampaignTitle } from "@/utils/weekNumberSanitizer";

// Helper function to generate images for blocks using batch API
interface ImageGenerationContext {
  title: string;
  description: string;
  seasonalFocus: string;
  weekNumber?: number;
}

async function generateImagesForBlocks(
  blocks: ContentBlock[],
  context: ImageGenerationContext,
  usedImageIds: Set<string>,
  setUsedImageIds: React.Dispatch<React.SetStateAction<Set<string>>>,
  setBlocks: React.Dispatch<React.SetStateAction<ContentBlock[]>>,
): Promise<void> {
  try {

    // Find all blocks that need images
    const blocksNeedingImages = blocks
      .map((block, index) => {
        return { block, index };
      })
      .filter(({ block, index }) => {
        const shouldFetch =
          block.type === "image" || block.type === "image-text";
        const needsImage =
          shouldFetch && (!block.imageUrl || block.imageUrl === "loading");
        if (shouldFetch) {
        }
        return needsImage;
      });


    if (blocksNeedingImages.length === 0) {

      // CRITICAL FIX: Clear isGeneratingImage for all blocks that already have images
      // This prevents the infinite "Generating..." UI state when templates come with pre-loaded images
      setBlocks((prev) =>
        prev.map((b) => {
          const hasImage =
            b.type === "header" || b.type === "newsletter-header"
              ? !!(b.backgroundImageUrl && b.backgroundImageUrl !== "loading")
              : !!(b.imageUrl && b.imageUrl !== "loading");

          if (hasImage && b.isGeneratingImage) {
            return { ...b, isGeneratingImage: false, isLoadingImage: false };
          }
          return b;
        }),
      );
      return;
    }


    // Process each block sequentially to track uniqueness
    for (
      let iteration = 0;
      iteration < blocksNeedingImages.length;
      iteration++
    ) {
      const { block, index: blockIndex } = blocksNeedingImages[iteration];
      try {

        // Build content context with strong fallbacks to ensure we never pass empty string
        const contentContext = (
          block.body ||
          block.content ||
          block.headline ||
          block.title ||
          context.description ||
          context.title ||
          "Beautiful garden center plants and flowers for seasonal display"
        ).trim();

        const contentTitle = (
          block.headline ||
          block.title ||
          context.title ||
          "Garden Newsletter"
        ).trim();

        // Final safety check - ensure we have valid content
        if (!contentContext || contentContext.length < 5) {
          const genericContext = `${context.seasonalFocus || "seasonal"} garden plants and flowers`;
        }

        const finalContentContext =
          contentContext.length >= 5
            ? contentContext
            : `${context.seasonalFocus || "seasonal"} garden plants and flowers for display`;


        // Use the same image generation service as social posts with exclusion list
        const result = await imageGenerationService.fetchImageForChannel({
          channel: "newsletter",
          contentContext: finalContentContext,
          contentTitle: contentTitle,
          useAIKeywords: true,
          fallbackKeywords: [
            "garden plants flowers",
            "garden center nursery",
            "seasonal gardening",
          ],
          excludeImageIds: Array.from(usedImageIds),
        });

        if (result && result.imageUrl) {

          // PHASE 4: Update this specific block with the image while preserving content
          setBlocks((prev) =>
            prev.map((b, i) => {
              if (i === blockIndex) {
                return {
                  ...b, // Preserve ALL existing properties including content
                  imageUrl: result.imageUrl,
                  imageId: result.imageId,
                  altText: result.metadata?.usedQuery || contentTitle,
                  isLoadingImage: false,
                  isGeneratingImage: false, // ✅ Clear generating flag once image is ready
                  // CRITICAL: Preserve content flags
                  hasGeneratedContent:
                    b.hasGeneratedContent || !!(b.headline || b.body),
                  contentGeneratedAt: b.contentGeneratedAt,
                  contentVersion: b.contentVersion,
                };
              }
              return b;
            }),
          );

          // Add to used images tracker
          if (result.imageId) {
            setUsedImageIds((prev) => new Set([...prev, result.imageId!]));
          }
        } else {
          setBlocks((prev) =>
            prev.map((b, i) =>
              i === blockIndex
                ? {
                    ...b,
                    imageUrl: "",
                    isLoadingImage: false,
                    isGeneratingImage: false,
                  }
                : b,
            ),
          );
        }

        // Small delay between requests to avoid rate limiting
        if (iteration < blocksNeedingImages.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      } catch (blockError) {
        console.error(
          `❌ Failed to generate image for block ${blockIndex}:`,
          blockError,
        );

        // Clear loading state for this block
        setBlocks((prev) =>
          prev.map((b, i) => {
            if (i === blockIndex) {
              return {
                ...b,
                imageUrl: "",
                isLoadingImage: false,
                isGeneratingImage: false,
              };
            }
            return b;
          }),
        );
      }
    }

  } catch (error) {
    console.error("❌ Image generation failed:", error);
    // Clear all loading states on error
    setBlocks((prev) =>
      prev.map((b) =>
        (b as any).shouldFetchImage
          ? {
              ...b,
              imageUrl: "",
              isLoadingImage: false,
              isGeneratingImage: false,
            }
          : b,
      ),
    );
  }
}

// Helper function to fetch image for blocks with missing images
// DETERMINISTIC IMAGE BEHAVIOR - respects autoImageMode and shouldFetchImage
const getOrFetchImage = async (
  contentObj: any,
  block: any,
): Promise<string | null> => {
  const blockType = block.block_type || block.type;
  const isHeader = blockType === "header" || blockType === "newsletter-header";

  // CRITICAL: Never fetch images for plain text blocks
  if (blockType === "text") {
    return null;
  }

  // RULE 1: If autoImageMode is false, never fetch images
  // Return whatever image the block currently has
  if (contentObj?.autoImageMode === false) {
    const existingImage = isHeader
      ? contentObj.backgroundImageUrl || block.image_url
      : contentObj.imageUrl || block.image_url;
    return existingImage || null;
  }

  // RULE 2: If shouldFetchImage is explicitly false, never fetch
  if (contentObj?.shouldFetchImage === false) {
    const existingImage = isHeader
      ? contentObj.backgroundImageUrl || block.image_url
      : contentObj.imageUrl || block.image_url;
    return existingImage || null;
  }

  // Check for existing valid image URL (from content OR from database column)
  const existingImageUrl = isHeader
    ? contentObj?.backgroundImageUrl || block.image_url
    : contentObj?.imageUrl || block.image_url;

  // RULE 3: If autoImageMode is true and an image already exists, return it
  if (existingImageUrl && existingImageUrl.trim() !== "") {
    return existingImageUrl;
  }

  // RULE 4: Only fetch if shouldFetchImage is true AND no image exists
  if (contentObj?.shouldFetchImage !== true) {
    return null;
  }

  // Generate image based on block content
  const searchQuery =
    contentObj?.headline ||
    contentObj?.title ||
    contentObj?.body ||
    "garden plants";

  try {
    const imageData = await fetchSmartImage(searchQuery, "", true);
    if (imageData?.url) {
      // Save the image URL back to the database
      const updateContent = {
        ...contentObj,
        shouldFetchImage: false, // Clear flag after successful fetch
        autoImageMode: true, // Mark as auto-mode
      };

      if (isHeader) {
        updateContent.backgroundImageUrl = imageData.url;
      } else {
        updateContent.imageUrl = imageData.url;
      }
      updateContent.altText = imageData.alt;

      const { error } = await supabase
        .from("campaign_blocks")
        .update({
          content: updateContent,
          image_url: imageData.url,
        })
        .eq("id", block.id);

      if (error) {
      } else {
      }

      return imageData.url;
    }
  } catch (error) {
  }

  return null;
};

// Post type rotation for varied content styles
const POST_TYPE_ROTATION = [
  "instagram",
  "facebook",
  "blog",
  "video",
  "newsletter",
];

// Generate appropriate preheader text based on content and campaign name
const generatePreheaderText = (
  content: string,
  campaignName: string,
): string => {
  const lowerContent = content.toLowerCase();
  const lowerCampaign = campaignName.toLowerCase();

  // Check for specific plant types
  if (
    lowerContent.includes("hydrangea") ||
    lowerCampaign.includes("hydrangea")
  ) {
    return "Essential tips for planting and caring for beautiful hydrangeas in your garden";
  }

  if (lowerContent.includes("rose") || lowerCampaign.includes("rose")) {
    return "Expert advice for growing stunning roses all season long";
  }

  if (lowerContent.includes("tomato") || lowerCampaign.includes("tomato")) {
    return "Everything you need to know for a successful tomato harvest";
  }

  // Check for general gardening activities
  if (lowerContent.includes("planting") || lowerCampaign.includes("planting")) {
    return "Professional planting techniques for your garden success";
  }

  if (lowerContent.includes("care") || lowerCampaign.includes("care")) {
    return "Expert care tips for thriving plants and gardens";
  }

  if (lowerContent.includes("summer")) {
    return "Summer gardening tips to keep your plants thriving in the heat";
  }

  if (lowerContent.includes("spring")) {
    return "Spring preparation guides for a successful growing season";
  }

  return "Expert gardening tips delivered to your inbox";
};

// Auto-fill header with campaign title for new newsletters
const autoFillHeaderTitle = (
  blocks: ContentBlock[],
  campaignTitle: string,
): ContentBlock[] => {
  if (!campaignTitle || campaignTitle === "Newsletter Campaign") return blocks;

  // Sanitize the title to remove week number references
  const sanitizedTitle = sanitizeCampaignTitle(campaignTitle);

  return blocks.map((block) => {
    if (
      block.type === "header" &&
      (!block.title || block.title === "Campaign Title" || block.title === "")
    ) {
      return {
        ...block,
        title: sanitizedTitle,
        headline: sanitizedTitle,
      };
    }
    return block;
  });
};

// Extract gardening-specific keywords from text content
const extractGardenKeywords = (text: string): string[] => {
  if (!text) return [];

  const lowerText = text.toLowerCase();
  const PRIORITY_TERMS = [
    // Flowers
    "hydrangea",
    "hydrangeas",
    "rose",
    "roses",
    "tulip",
    "tulips",
    "daffodil",
    "lavender",
    "peony",
    "peonies",
    "dahlia",
    "dahlias",
    "sunflower",
    "sunflowers",
    "lily",
    "lilies",
    // Vegetables and herbs
    "tomato",
    "tomatoes",
    "pepper",
    "lettuce",
    "basil",
    "rosemary",
    "carrot",
    "cucumber",
    // Activities
    "pruning",
    "planting",
    "fertilizing",
    "mulching",
    "composting",
    "watering",
    "harvesting",
    // Seasons
    "winter",
    "spring",
    "summer",
    "fall",
    "autumn",
    "frost",
    "seasonal",
    // Garden elements
    "greenhouse",
    "compost",
    "tools",
    "soil",
    "seeds",
    "seedling",
  ];

  return PRIORITY_TERMS.filter((term) => lowerText.includes(term));
};

// Create contextual image queries for weekly theme newsletters
// Mimics the successful AIWriterDialog.createImageKeywords approach
const createWeeklyThemeImageQuery = (
  weekContext: {
    title: string;
    description: string;
    seasonalFocus: string;
    heroQuery?: string;
    weekNumber?: number;
  },
  blockContent: {
    headline?: string;
    body?: string;
  },
  blockIndex: number,
  totalBlocks: number,
): string => {
  // Use the FULL week theme title as the primary topic (not just extracted keywords)
  const topicKeywords = weekContext.title.toLowerCase();


  // Check for special topics that need specific handling
  // Holiday/seasonal themes
  if (
    topicKeywords.includes("holiday") ||
    topicKeywords.includes("christmas") ||
    topicKeywords.includes("decorations") ||
    topicKeywords.includes("celebrations")
  ) {
    const holidaySectionKeywords: { [key: number]: string } = {
      0: `${weekContext.title} featured display garden center`,
      1: `${weekContext.title} arrangements natural evergreen`,
      2: `${weekContext.title} garden elements festive`,
      3: `${weekContext.title} seasonal plants display`,
    };
    const query =
      holidaySectionKeywords[blockIndex] || `${weekContext.title} garden`;
    return query;
  }

  // Winter/frost themes
  if (
    topicKeywords.includes("winter") ||
    topicKeywords.includes("frost") ||
    topicKeywords.includes("cold") ||
    topicKeywords.includes("protection")
  ) {
    const winterSectionKeywords: { [key: number]: string } = {
      0: `${weekContext.title} featured winter garden`,
      1: `${weekContext.title} protection mulching`,
      2: `${weekContext.title} garden tools winter`,
      3: `${weekContext.title} healthy plants cold weather`,
    };
    const query =
      winterSectionKeywords[blockIndex] || `${weekContext.title} garden`;
    return query;
  }

  // Hydrangea (known problematic case with specific handling)
  if (topicKeywords.includes("hydrangea")) {
    const hydrangeaSectionKeywords: { [key: number]: string } = {
      0: "hydrangea featured summer garden",
      1: "hydrangea care tips pruning",
      2: "hydrangea garden center display varieties",
      3: "hydrangea healthy plants blooming",
    };
    const query =
      hydrangeaSectionKeywords[blockIndex] || "hydrangea summer garden";
    return query;
  }

  // Check if AI-generated block content has specific plant/topic mentions
  const blockText =
    `${blockContent.headline || ""} ${blockContent.body || ""}`.toLowerCase();
  const specificKeywords = extractGardenKeywords(blockText);

  if (
    specificKeywords.length > 0 &&
    specificKeywords[0] !== topicKeywords.split(" ")[0]
  ) {
    // Block content mentions a different specific plant/topic
    const specificTopic = specificKeywords[0];
    const sectionKeywords: { [key: number]: string } = {
      0: `${specificTopic} ${weekContext.seasonalFocus} featured beautiful`,
      1: `${specificTopic} care growing tips garden`,
      2: `${specificTopic} garden center display nursery`,
      3: `${specificTopic} healthy plants ${weekContext.seasonalFocus}`,
    };
    const query =
      sectionKeywords[blockIndex] ||
      `${specificTopic} ${weekContext.seasonalFocus} garden`;
    return query;
  }

  // Default: Use full week title with descriptive modifiers based on block position
  const sectionKeywords: { [key: number]: string } = {
    0: `${weekContext.title} featured beautiful garden`, // Hero/Featured
    1: `${weekContext.title} ${weekContext.seasonalFocus} care tips`, // Main content
    2: `${weekContext.title} garden center display`, // Secondary
    3: `${weekContext.title} healthy plants nursery`, // CTA
  };

  const query =
    sectionKeywords[blockIndex] ||
    `${weekContext.title} ${weekContext.seasonalFocus} garden`;
  return query;
};

// Normalize blocks to ensure consistency - convert all to image-text for weekly themes
// PHASE 1: Updated to respect user content and lifecycle flags
const normalizeBlocks = (blocks: ContentBlock[]): ContentBlock[] => {
  return blocks.map((block) => {
    // CRITICAL CHANGE: Convert all content blocks to image-text for weekly themes
    if (block.type === "image-text" || block.type === "image") {
      // Extract headline from content if not already present
      let headline = block.headline || block.title || "";
      if (!headline && (block.content || block.body)) {
        const textContent = block.content || block.body || "";
        // Try to extract first line as headline if it looks like a heading
        const lines = textContent.split("\n").filter((line) => line.trim());
        if (lines.length > 0) {
          const firstLine = lines[0].trim();
          // If first line is short and looks like a heading, use it as headline
          if (firstLine.length < 100 && firstLine.length > 5) {
            headline = firstLine
              .replace(/^#+\s*/, "")
              .replace(/^\*\*(.*?)\*\*$/, "$1"); // Remove markdown
          }
        }
      }

      // CRITICAL FIX: Only set default if content was never generated AND user hasn't edited
      // Respect empty strings if userEdited is true (user intentionally cleared the field)
      if (!headline && !block.hasGeneratedContent && !block.userEdited) {
        headline = "Content Headline";
      }

      const body = block.body || block.content || "";
      // Only set default body if no content, never generated, and user hasn't edited
      const finalBody =
        !body && !block.hasGeneratedContent && !block.userEdited
          ? "Add your content here"
          : body;


      // CRITICAL FIX: Clear isGeneratingImage if block already has a valid image
      const hasValidImage = !!(
        block.imageUrl &&
        block.imageUrl !== "loading" &&
        block.imageUrl !== ""
      );

      return {
        ...block,
        type: "image-text" as const, // Convert to image-text for weekly themes
        layout: block.layout || "full-width",
        headline: headline || block.headline,
        body: finalBody || block.body,
        imageUrl: block.imageUrl || "",
        shouldFetchImage: !block.imageUrl, // Only fetch if no image
        isGeneratingImage: hasValidImage
          ? false
          : block.isGeneratingImage || false, // Clear if image exists
        isWeeklyTheme: true,
        hasGeneratedContent: block.hasGeneratedContent || !!(headline || body),
      };
    }

    return block;
  });
};

interface CRMCampaignCreatorProps {
  campaignSlug?: string;
  contentTaskId?: string | null;
}

export const CRMCampaignCreator: React.FC<CRMCampaignCreatorProps> = ({
  campaignSlug,
  contentTaskId: propContentTaskId,
}) => {
  // (debug-only console logs removed)

  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  // (debug-only console logs removed)

  // 🚨 UNIFIED PREFILL LOGIC - Single source of truth for all prefill sources
  // Parse prefill sources ONCE during render (not in effects)
  const typeParam = searchParams.get("type");
  const prefillDataParam = searchParams.get("prefillData");
  const bundleIdParam = searchParams.get("bundleId");
  const urlContentTaskId = searchParams.get("contentTaskId");
  const templateIdParam = searchParams.get("templateId");
  const finalContentTaskId = propContentTaskId || urlContentTaskId;
  const { query: bundleQuery } = useGeneratedBundle(bundleIdParam || undefined);

  // Parse URL personas early
  const personaParam = searchParams.get("persona");
  const segmentIdParam = searchParams.get("segment");
  const isSegmentLocked = searchParams.get("locked") === "true";

  let initialPersonas: any[] = [];
  if (personaParam) {
    try {
      initialPersonas = [JSON.parse(decodeURIComponent(personaParam))];
      // (debug-only console logs removed)
    } catch (error) {
      console.error("❌ Failed to parse persona parameter:", error);
    }
  }

  const { counts: segmentCounts } = useSegmentCounts();

  const [campaignName, setCampaignName] = useState("");

  const [subjectLine, setSubjectLine] = useState("");

  const [preheaderText, setPreheaderText] = useState("");

  const [blocks, setBlocks] = useState<ContentBlock[]>([]);

  // Track used images to prevent duplicates
  const [usedImageIds, setUsedImageIds] = useState<Set<string>>(new Set());

  // CRITICAL: Track lastModifiedAt for DB vs localStorage coordination
  const [lastModifiedAt, setLastModifiedAt] = useState<string>(
    new Date().toISOString(),
  );

  // UNIFIED PREFILL REF - Ensures prefill runs exactly once
  const hasAppliedPrefillRef = useRef(false);

  // Draft restoration dialog state
  const [showDraftDialog, setShowDraftDialog] = useState(false);

  // Schedule state
  const [schedule, setSchedule] = useState<ScheduleOption>({ type: "now" });
  const skipNextSchedulePersistRef = useRef(false);
  const [campaignControlBusyAction, setCampaignControlBusyAction] = useState<
    "pause" | "resume" | "stop" | null
  >(null);

  const { cloneCampaign, isCloning: isCloningCampaign } = useCampaignCloning();
  const [lockedScheduleDialogOpen, setLockedScheduleDialogOpen] =
    useState(false);
  const [lockedScheduleDialogMessage, setLockedScheduleDialogMessage] =
    useState<string>("");
  const [lockedScheduleDialogStatus, setLockedScheduleDialogStatus] =
    useState<string>("draft");
  const [pendingLockedSchedule, setPendingLockedSchedule] = useState<{
    date: Date;
    timezone: string;
  } | null>(null);
  const [isApplyingLockedScheduleChoice, setIsApplyingLockedScheduleChoice] =
    useState(false);

  // Campaign status tracking (for scheduled campaigns)
  const [campaignStatus, setCampaignStatus] = useState<string>("draft");
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [isScheduleProcessing, setIsScheduleProcessing] = useState(false);
  const isContentLocked =
    campaignStatus === "sending" || campaignStatus === "sent";

  const isScheduleLockedMessage = useCallback((message: string) => {
    const normalized = (message || "").toLowerCase();
    return (
      normalized.includes("locked") ||
      normalized.includes("already in progress") ||
      normalized.includes("already processed") ||
      normalized.includes("already in progress") ||
      normalized.includes("sent")
    );
  }, []);

  const openLockedScheduleDialog = useCallback(
    (params: {
      message: string;
      desiredSchedule?: { date: Date; timezone: string };
      statusOverride?: string;
    }) => {
      const normalized = (params.message || "").toLowerCase();
      const inferredStatus = normalized.includes("sent")
        ? "sent"
        : normalized.includes("sending") ||
            normalized.includes("in progress") ||
            normalized.includes("already in progress")
          ? "sending"
          : "draft";

      const status = params.statusOverride || inferredStatus;

      setLockedScheduleDialogMessage(params.message || "");
      setLockedScheduleDialogStatus(status);

      if (params.desiredSchedule && status === "sent") {
        setPendingLockedSchedule({
          date: params.desiredSchedule.date,
          timezone: params.desiredSchedule.timezone,
        });
      } else {
        setPendingLockedSchedule(null);
      }

      setLockedScheduleDialogOpen(true);
    },
    [
      setLockedScheduleDialogMessage,
      setLockedScheduleDialogOpen,
      setLockedScheduleDialogStatus,
      setPendingLockedSchedule,
    ],
  );

  useEffect(() => {
    if (hasAppliedPrefillRef.current) {
      return;
    }

    // Handle prefillData from URL (direct newsletter prefill)
    if (typeParam === "newsletter" && prefillDataParam) {
      try {
        const prefillData = JSON.parse(decodeURIComponent(prefillDataParam));

        const headerBlock: ContentBlock = {
          id: `prefill-header-${Date.now()}`,
          type: "header" as const,
          title: prefillData.title || "Newsletter Campaign",
          headline: prefillData.title || "Newsletter Campaign",
          source: "manual" as const,
          status: "empty",
        };

        const contentBlock: ContentBlock = {
          id: `prefill-content-${Date.now()}`,
          type: "image-text" as const,
          layout: "image-left" as const,
          headline: "Newsletter Content",
          body:
            prefillData.content || "Your newsletter content will appear here.",
          imageUrl: prefillData.featuredImage || "",
          source: "manual" as const,
          status: prefillData.content ? "ai-generated" : "empty",
        };

        setBlocks([headerBlock, contentBlock]);
        setCampaignName(prefillData.title || "Newsletter Campaign");
        setSubjectLine(prefillData.title || "Newsletter Campaign");
        setPreheaderText(
          `${prefillData.title || "Newsletter"} - Expert insights delivered to your inbox`,
        );

        // Mark prefill as applied and update timestamp
        hasAppliedPrefillRef.current = true;
        setLastModifiedAt(new Date().toISOString());

        // Clean URL
        const url = new URL(window.location.href);
        url.searchParams.delete("prefillData");
        window.history.replaceState({}, "", url.toString());

        toast({
          title: "Newsletter content loaded!",
          description: `Successfully loaded: "${prefillData.title}"`,
        });
      } catch (error) {
        console.error("🚨 UNIFIED PREFILL: Parse error", error);
      }
    }

    // Note: Other prefill sources (bundleId, templateId, contentTaskId) are handled
    // in their respective useEffects but they check hasAppliedPrefillRef first
  }, [typeParam, prefillDataParam, toast]);

  const [selectedPersonas, setSelectedPersonas] = useState<any[]>(() => {
    return initialPersonas;
  });
  const [selectedSegments, setSelectedSegments] = useState<any[]>([]);

  // Initialize selectedSegments from URL
  useEffect(() => {
    const loadSegmentFromUrl = async () => {
      if (!segmentIdParam) {
        return;
      }

      try {

        // Check if it's a predefined segment (string ID) or custom segment (UUID format)
        const isCustomSegment =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            segmentIdParam,
          );

        if (isCustomSegment) {
          // Fetch custom segment
          const { data: segmentData, error } = await supabase
            .from("crm_segments") // Changed from custom_segments to crm_segments
            .select("*")
            .eq("id", segmentIdParam)
            .maybeSingle();


          if (error) {
            console.error("❌ Error fetching custom segment:", error);
            return;
          }

          if (segmentData) {
            // Get actual customer count for this segment
            const { count: customerCount, error: countError } = await supabase
              .from("customer_segments")
              .select("*", { count: "exact", head: true })
              .eq("segment_id", segmentData.id);

            if (countError) {
              console.error(
                "❌ Error counting customers for segment:",
                countError,
              );
            }

            setSelectedSegments([
              {
                id: segmentData.id,
                name: segmentData.name,
                type: "custom",
                customer_count: customerCount || 0, // Use customer_count to match AudienceSelector
              },
            ]);
          } else {
          }
        } else {
          // Handle predefined segment - match exact names from CustomerSegmentsSection
          const predefinedSegments = {
            "new-customers": { name: "New Customers", id: "new-customers" },
            "loyalty-members": {
              name: "Loyalty Members",
              id: "loyalty-members",
            },
            "high-value": { name: "High-Value Customers", id: "high-value" }, // Fixed: was 'High Value Customers'
            "lapsed-customers": {
              name: "Lapsed Customers",
              id: "lapsed-customers",
            },
            "seasonal-shoppers": {
              name: "Seasonal Shoppers",
              id: "seasonal-shoppers",
            },
            "frequent-buyers": {
              name: "Frequent Buyers",
              id: "frequent-buyers",
            },
          };

          const predefinedSegment =
            predefinedSegments[
              segmentIdParam as keyof typeof predefinedSegments
            ];
          if (predefinedSegment) {
            // Get the actual count from segmentCounts hook
            const actualCount =
              segmentCounts[segmentIdParam as keyof typeof segmentCounts] || 0;

            setSelectedSegments([
              {
                id: predefinedSegment.id,
                name: predefinedSegment.name,
                type: "predefined",
                customer_count: actualCount, // Use customer_count to match AudienceSelector
              },
            ]);
          } else {
          }
        }
      } catch (error) {
        console.error("❌ Error loading segment from URL:", error);
      }
    };

    // Always try to load if we have a segmentIdParam, regardless of current selectedSegments length
    if (segmentIdParam) {
      loadSegmentFromUrl();
    }
  }, [segmentIdParam, supabase, segmentCounts]); // Added segmentCounts dependency

  // Initialize selectedPersonas from URL only once - don't override user selections
  useEffect(() => {
    if (initialPersonas.length > 0 && selectedPersonas.length === 0) {
      setSelectedPersonas(initialPersonas);
    }
    // Removed the logic that keeps overriding user selections with URL personas
  }, [initialPersonas]);
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [suggestionsOn, setSuggestionsOn] = useState(() => {
    try { return localStorage.getItem("bloom_suggestions") !== "off"; } catch { return true; }
  });
  const [lastSaved, setLastSaved] = useState<Date | undefined>();
  const [saveError, setSaveError] = useState(false);
  const [sourceContentInfo, setSourceContentInfo] = useState<{
    taskId: string;
    campaignTitle: string;
    contentPreview: string;
  } | null>(null);
  const [existingCampaignId, setExistingCampaignId] = useState<string | null>(
    null,
  );
  const [loadingExistingCampaign, setLoadingExistingCampaign] = useState(false);
  const [generatingBlocks, setGeneratingBlocks] = useState<Set<string>>(
    new Set(),
  );
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [showAIWriter, setShowAIWriter] = useState(false);
  const [sending, setSending] = useState(false);
  const [showSenderConfirmation, setShowSenderConfirmation] = useState(false);
  const [showSendConfirmation, setShowSendConfirmation] = useState(false);
  const [pendingSendFlow, setPendingSendFlow] = useState(false);
  const [showAIImageDialog, setShowAIImageDialog] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  const refreshCampaignStatusFromDb = useCallback(
    async (campaignId: string) => {
      const { data: rows, error } = await supabase
        .from("crm_campaigns")
        .select("status, scheduled_at")
        .eq("id", campaignId)
        .limit(1);

      if (error) {
        if (import.meta.env.DEV) {
        }
        return;
      }

      const data = Array.isArray(rows) ? rows[0] : null;

      if (data?.status) {
        setCampaignStatus(data.status);
      }
      setScheduledAt(data?.scheduled_at ?? null);
    },
    [],
  );

  const handlePauseCampaignSending = useCallback(async () => {
    if (!existingCampaignId) {
      toast({
        title: "Pause unavailable",
        description: "Save the campaign first.",
        variant: "destructive",
      });
      return;
    }

    setCampaignControlBusyAction("pause");
    const { data, error } = await supabase.rpc("pause_email_campaign_sending", {
      p_campaign_id: existingCampaignId,
    });
    setCampaignControlBusyAction(null);

    if (error) {
      toast({
        title: "Pause failed",
        description: error.message || "Action failed",
        variant: "destructive",
      });
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    toast({
      title: "Campaign paused",
      description: `Paused ${row?.messages_paused ?? 0} messages and ${row?.jobs_paused ?? 0} jobs.`,
    });
    await refreshCampaignStatusFromDb(existingCampaignId);
  }, [existingCampaignId, refreshCampaignStatusFromDb, toast]);

  const handleResumeCampaignSending = useCallback(async () => {
    if (!existingCampaignId) {
      toast({
        title: "Resume unavailable",
        description: "Save the campaign first.",
        variant: "destructive",
      });
      return;
    }

    setCampaignControlBusyAction("resume");
    const { data, error } = await supabase.rpc(
      "resume_email_campaign_sending",
      {
        p_campaign_id: existingCampaignId,
      },
    );
    setCampaignControlBusyAction(null);

    if (error) {
      toast({
        title: "Resume failed",
        description: error.message || "Action failed",
        variant: "destructive",
      });
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    toast({
      title: "Campaign resumed",
      description: `Resumed ${row?.messages_resumed ?? 0} messages and ${row?.jobs_resumed ?? 0} jobs.`,
    });
    await refreshCampaignStatusFromDb(existingCampaignId);
  }, [existingCampaignId, refreshCampaignStatusFromDb, toast]);

  const handleStopCampaignSending = useCallback(async () => {
    if (!existingCampaignId) {
      toast({
        title: "Stop unavailable",
        description: "Save the campaign first.",
        variant: "destructive",
      });
      return;
    }

    setCampaignControlBusyAction("stop");
    const { data, error } = await supabase.rpc(
      "stop_email_campaign_sending" as never,
      {
        p_campaign_id: existingCampaignId,
        p_reason: "stopped_by_user",
      } as never,
    );
    setCampaignControlBusyAction(null);

    if (error) {
      toast({
        title: "Stop failed",
        description: error.message || "Action failed",
        variant: "destructive",
      });
      return;
    }

    const row = (Array.isArray(data as any) ? (data as any)[0] : data) as any;
    toast({
      title: "Campaign stopped",
      description: `Stopped ${row?.messages_stopped ?? 0} messages and ${row?.jobs_stopped ?? 0} jobs.`,
    });
    await refreshCampaignStatusFromDb(existingCampaignId);
  }, [existingCampaignId, refreshCampaignStatusFromDb, toast]);

  // Sender configuration for domain verification
  const {
    senderConfig,
    loading: loadingSenderConfig,
    refetch: refetchSenderConfig,
  } = useSenderConfiguration();

  // Tenant context for customer count
  const { tenant } = useTenant();

  const isUuidLike = React.useCallback((value: string) => {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }, []);

  // Total customer count for "All Contacts" audience
  const [totalCustomerCount, setTotalCustomerCount] = useState<number>(0);

  const [campaignAudienceRecipientCount, setCampaignAudienceRecipientCount] =
    useState<number | null>(null);

  // Fetch total customer count when tenant is available
  useEffect(() => {
    const fetchTotalCustomerCount = async () => {
      if (!tenant?.id) return;

      const { count, error } = await supabase
        .from("crm_customers")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", tenant.id);

      if (!error && count !== null) {
        setTotalCustomerCount(count);
      }
    };

    fetchTotalCustomerCount();
  }, [tenant?.id]);

  const computeAudienceRecipientCount = useCallback(
    async (params: {
      segmentIds: string[];
      personaIds: string[];
    }): Promise<number> => {
      if (!tenant?.id) return 0;

      const segmentIds = (params.segmentIds || []).filter(isUuidLike);
      const personaIds = (params.personaIds || []).filter(Boolean);

      if (segmentIds.length === 0 && personaIds.length === 0) {
        return totalCustomerCount;
      }

      const PAGE_SIZE = 1000;

      const fetchIdsPaged = async (
        queryFactory: (from: number, to: number) => any,
        rowToId: (row: any) => string | null,
      ): Promise<Set<string>> => {
        const ids = new Set<string>();
        for (let from = 0; ; from += PAGE_SIZE) {
          const to = from + PAGE_SIZE - 1;
          const { data, error } = await queryFactory(from, to);
          if (error) throw error;
          (data || []).forEach((row: any) => {
            const id = rowToId(row);
            if (id) ids.add(id);
          });
          if (!data || data.length < PAGE_SIZE) break;
        }
        return ids;
      };

      let segmentCustomerIds: Set<string> | null = null;
      if (segmentIds.length > 0) {
        segmentCustomerIds = await fetchIdsPaged(
          (from, to) =>
            supabase
              .from("customer_segments")
              .select("customer_id")
              .in("segment_id", segmentIds)
              .range(from, to),
          (row) => {
            const id = String(row?.customer_id || "");
            return isUuidLike(id) ? id : null;
          },
        );
      }

      let personaCustomerIds: Set<string> | null = null;
      if (personaIds.length > 0) {
        const uuidPersonas = personaIds.filter(isUuidLike);
        const predefinedPersonas = personaIds.filter((p) => !isUuidLike(p));

        const combined = new Set<string>();

        if (uuidPersonas.length > 0) {
          const idsFromJunction = await fetchIdsPaged(
            (from, to) =>
              supabase
                .from("customer_personas")
                .select("customer_id")
                .in("persona_id", uuidPersonas)
                .range(from, to),
            (row) => {
              const id = String(row?.customer_id || "");
              return isUuidLike(id) ? id : null;
            },
          );
          idsFromJunction.forEach((id) => combined.add(id));

          const idsFromLegacy = await fetchIdsPaged(
            (from, to) =>
              supabase
                .from("crm_customers")
                .select("id")
                .eq("tenant_id", tenant.id)
                .in("persona_id", uuidPersonas)
                .range(from, to),
            (row) => {
              const id = String(row?.id || "");
              return isUuidLike(id) ? id : null;
            },
          );
          idsFromLegacy.forEach((id) => combined.add(id));
        }

        if (predefinedPersonas.length > 0) {
          const idsFromPredefined = await fetchIdsPaged(
            (from, to) =>
              supabase
                .from("customer_personas")
                .select("customer_id")
                .in("predefined_persona_id", predefinedPersonas)
                .range(from, to),
            (row) => {
              const id = String(row?.customer_id || "");
              return isUuidLike(id) ? id : null;
            },
          );
          idsFromPredefined.forEach((id) => combined.add(id));
        }

        personaCustomerIds = combined;
      }

      if (segmentCustomerIds && personaCustomerIds) {
        const [small, big] =
          segmentCustomerIds.size <= personaCustomerIds.size
            ? [segmentCustomerIds, personaCustomerIds]
            : [personaCustomerIds, segmentCustomerIds];

        let intersectionCount = 0;
        for (const id of small) {
          if (big.has(id)) intersectionCount++;
        }
        return intersectionCount;
      }

      if (segmentCustomerIds) return segmentCustomerIds.size;
      if (personaCustomerIds) return personaCustomerIds.size;
      return 0;
    },
    [tenant?.id, totalCustomerCount, isUuidLike],
  );

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!tenant?.id) return;

      // Prefer in-memory targeting when the user has made selections in this session.
      // (If we always read from DB for existing campaigns, the confirmation dialog
      // can temporarily show stale "All Contacts" while targeting is being persisted.)
      const stateSegmentIds = (selectedSegments || [])
        .map((s: any) => String(s?.id || "").trim())
        .filter(Boolean);
      const statePersonaIds = (selectedPersonas || [])
        .map((p: any) => String(p?.id || "").trim())
        .filter(Boolean);

      if (stateSegmentIds.length > 0 || statePersonaIds.length > 0) {
        try {
          const count = await computeAudienceRecipientCount({
            segmentIds: stateSegmentIds,
            personaIds: statePersonaIds,
          });
          if (!cancelled) setCampaignAudienceRecipientCount(count);
        } catch (error) {
          console.error("❌ Failed to resolve campaign audience count:", error);
          if (!cancelled) setCampaignAudienceRecipientCount(null);
        }
        return;
      }

      // Otherwise, when editing an existing campaign, derive from DB-sourced targeting.
      const campaignId = existingCampaignId;
      if (campaignId) {
        try {
          const { data: campaignRow, error: campaignErr } = await supabase
            .from("crm_campaigns")
            .select("id, tenant_id, segment_id, persona_ids")
            .eq("id", campaignId)
            .maybeSingle();
          if (campaignErr) throw campaignErr;

          const { data: segRows, error: segErr } = await supabase
            .from("campaign_segments")
            .select("segment_id")
            .eq("campaign_id", campaignId);
          if (segErr) throw segErr;

          const { data: personaRows, error: personaErr } = await supabase
            .from("campaign_personas")
            .select("persona_id")
            .eq("campaign_id", campaignId);
          if (personaErr) throw personaErr;

          const segmentIds = Array.from(
            new Set(
              [
                ...(segRows || [])
                  .map((r: any) => String(r?.segment_id || ""))
                  .filter(Boolean),
                String((campaignRow as any)?.segment_id || "").trim(),
              ].filter(Boolean),
            ),
          );

          const personaFromCampaignField: string[] = Array.isArray(
            (campaignRow as any)?.persona_ids,
          )
            ? ((campaignRow as any).persona_ids as any[])
                .map((p) => String(p || "").trim())
                .filter(Boolean)
            : [];

          const personaIds = Array.from(
            new Set([
              ...personaFromCampaignField,
              ...(personaRows || [])
                .map((r: any) => String(r?.persona_id || "").trim())
                .filter(Boolean),
            ]),
          );

          const count = await computeAudienceRecipientCount({
            segmentIds,
            personaIds,
          });
          if (!cancelled) setCampaignAudienceRecipientCount(count);
          return;
        } catch (error) {
          console.error(
            "❌ Failed to resolve campaign audience count from DB:",
            error,
          );
          // Fall through to state-based estimate
        }
      }

      // New/unsaved campaign with no explicit selection: All Contacts.
      if (!cancelled) setCampaignAudienceRecipientCount(totalCustomerCount);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    tenant?.id,
    existingCampaignId,
    selectedSegments,
    selectedPersonas,
    computeAudienceRecipientCount,
  ]);

  // Footer and company data - pass campaignId to load campaign-specific styling
  const { footerSettings, campaignOverrides, setCampaignOverrides } =
    useFooterSettings(existingCampaignId || undefined);
  const { companyInfo } = useCompanyInfo();
  const brandDefaults = useBrandDefaults();

  // Log company info changes for debugging footer issues
  useEffect(() => {
  }, [companyInfo]);

  // Auto-save functionality with queue-based protection
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { persistState, restoreState, clearPersistedState } =
    usePagePersistence<any>({
      key: "crm-campaign-creator",
      sessionId: existingCampaignId || campaignSlug || "new",
    });
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();
  const { enqueueSave, cancelPendingSaves } = useSaveQueue();
  const isCreatingDraftRef = useRef(false);

  // Create a draft campaign if none exists (auto-save for new campaigns)
  const createDraftCampaign = useCallback(async (): Promise<string | null> => {
    if (!user?.id || isCreatingDraftRef.current) {
      return null;
    }

    // Don't create draft if we already have an existing campaign
    if (existingCampaignId) {
      return existingCampaignId;
    }

    isCreatingDraftRef.current = true;

    try {

      // Ensure tenant_id is set; RLS policies typically rely on it.
      let tenantId = tenant?.id;
      if (!tenantId) {
        const { data: userRows, error: userRowError } = await supabase
          .from("users")
          .select("tenant_id")
          .eq("id", user.id)
          .limit(1);

        if (userRowError) {
        }

        const userRow = Array.isArray(userRows) ? userRows[0] : null;
        tenantId = userRow?.tenant_id ?? null;
      }

      if (!tenantId) {
        return null;
      }

      const { data: insertedRows, error } = await supabase
        .from("crm_campaigns")
        .insert({
          tenant_id: tenantId,
          name: campaignName || "Untitled Draft",
          subject_line: subjectLine || "",
          preheader: preheaderText || "",
          sender_name: senderConfig?.displayName || null,
          sender_email: senderConfig?.senderEmail || null,
          from_email_domain_id: senderConfig?.fromEmailDomainId || null,
          status: "draft",
          user_id: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("id");

      if (error) {
        console.error("❌ Failed to create draft campaign:", error);
        return null;
      }

      const inserted = Array.isArray(insertedRows) ? insertedRows[0] : null;
      if (!inserted?.id) {
        console.error("❌ Failed to create draft campaign: no row returned");
        return null;
      }

      setExistingCampaignId(inserted.id);

      // Update URL to include the new campaign ID
      const url = new URL(window.location.href);
      navigate(`/crm/campaigns/${inserted.id}`, { replace: true });

      return inserted.id;
    } catch (error) {
      console.error("❌ Error creating draft campaign:", error);
      return null;
    } finally {
      isCreatingDraftRef.current = false;
    }
  }, [
    user?.id,
    tenant?.id,
    existingCampaignId,
    campaignName,
    subjectLine,
    preheaderText,
    senderConfig?.displayName,
    senderConfig?.senderEmail,
    senderConfig?.fromEmailDomainId,
    navigate,
  ]);

  // Auto-persist schedule changes so the Scheduled state survives refresh.
  // (Without this, choosing a date/time only updates local UI state until the user hits the main Send/Schedule flow.)
  useEffect(() => {
    const persistSchedule = async () => {
      if (skipNextSchedulePersistRef.current) {
        skipNextSchedulePersistRef.current = false;
        return;
      }

      // Persist scheduled date/time immediately
      if (schedule.type === "scheduled" && schedule.date) {
        // UX guard: never allow rescheduling an in-flight send.
        // For already-sent campaigns, offer a safe "Duplicate & Schedule" flow.
        if (campaignStatus === "sending" || campaignStatus === "sent") {
          const statusMessage =
            campaignStatus === "sending"
              ? "This campaign is already sending. You can't change its schedule right now."
              : "This campaign was already sent. To schedule it again, duplicate it and schedule the copy.";

          setPendingLockedSchedule({
            date: schedule.date,
            timezone: schedule.timezone,
          });
          setLockedScheduleDialogMessage(statusMessage);
          setLockedScheduleDialogStatus(campaignStatus);
          setLockedScheduleDialogOpen(true);

          // Revert UI selection back to "Now" so it doesn't look like it saved.
          skipNextSchedulePersistRef.current = true;
          setSchedule({ type: "now" });
          return;
        }

        // Only auto-persist schedule edits for campaigns that are already scheduled.
        // New schedules should be confirmed via the CampaignSendConfirmationModal.
        if (campaignStatus !== "scheduled") {
          return;
        }

        setIsScheduleProcessing(true);
        try {
          let campaignId = existingCampaignId;
          if (!campaignId) {
            campaignId = await createDraftCampaign();
          }
          if (!campaignId) {
            toast({
              title: "Schedule not saved",
              description:
                "We couldn't create a draft campaign to save this schedule. Please try again.",
              variant: "destructive",
            });
            return;
          }

          let didShowFailureToast = false;
          const success = await updateCampaignSchedule(
            campaignId,
            schedule.date.toISOString(),
            schedule.timezone,
            {
              silent: true,
              onFailureMessage: (message) => {
                if (isScheduleLockedMessage(message)) {
                  openLockedScheduleDialog({
                    message,
                    desiredSchedule: {
                      date: schedule.date as Date,
                      timezone: schedule.timezone,
                    },
                  });

                  // Revert UI selection back to "Now" so it doesn't look like it saved.
                  skipNextSchedulePersistRef.current = true;
                  setSchedule({ type: "now" });
                  return;
                }

                didShowFailureToast = true;
                toast({
                  title: "Schedule not saved",
                  description: message,
                  variant: "destructive",
                });
              },
            },
          );

          if (success) {
            setCampaignStatus("scheduled");
            setScheduledAt(schedule.date.toISOString());
          } else {
            if (!didShowFailureToast) {
              toast({
                title: "Schedule not saved",
                description:
                  "We couldn't save your schedule. Please try again.",
                variant: "destructive",
              });
            }
          }
        } finally {
          setIsScheduleProcessing(false);
        }

        return;
      }

      // Persist clearing the schedule too
      if (
        schedule.type === "now" &&
        existingCampaignId &&
        campaignStatus === "scheduled"
      ) {
        setIsScheduleProcessing(true);
        try {
          const success = await unscheduleCampaign(existingCampaignId, {
            silent: true,
            onFailureMessage: (message) => {
              if (isScheduleLockedMessage(message)) {
                openLockedScheduleDialog({
                  message,
                  statusOverride: campaignStatus,
                });
                return;
              }
              toast({
                title: "Schedule update failed",
                description: message,
                variant: "destructive",
              });
            },
          });
          if (success) {
            setCampaignStatus("draft");
            setScheduledAt(null);
          } else {
            toast({
              title: "Schedule update failed",
              description: "We couldn't remove the schedule. Please try again.",
              variant: "destructive",
            });
          }
        } finally {
          setIsScheduleProcessing(false);
        }
      }
    };

    void persistSchedule();
  }, [
    schedule.type,
    schedule.date,
    schedule.timezone,
    existingCampaignId,
    campaignStatus,
    createDraftCampaign,
    isScheduleLockedMessage,
    openLockedScheduleDialog,
    toast,
  ]);

  // Warn user before leaving with unsaved changes
  useBeforeUnload({
    when: hasUnsavedChanges && !isAutoSaving,
    message: "You have unsaved changes. Are you sure you want to leave?",
    onBeforeUnload: () => {
      // Try to save immediately before unload
      if (existingCampaignId && hasUnsavedChanges) {
        // Use sendBeacon or sync request for reliability
        // Note: async operations may not complete before unload
        // The sessionStorage persistence will help recover
        persistState(
          {
            campaignName,
            subjectLine,
            preheaderText,
            blocks,
            showPreview,
            selectedPersonas,
            selectedSegments,
          },
          lastModifiedAt,
        );
      }
    },
  });

  const autoSaveCampaign = useCallback(
    async (campaignData: {
      blocks: ContentBlock[];
      campaign_name: string;
      subject_line: string;
      preheader: string;
    }) => {
      if (!existingCampaignId) {
        return;
      }

      // Enqueue the save operation to prevent race conditions
      return enqueueSave(async () => {
        let retryCount = 0;
        const maxRetries = 3;

        const attemptSave = async (): Promise<void> => {
          try {
            setIsAutoSaving(true);

            // Validate required fields
            if (!campaignData.campaign_name?.trim()) {
              throw new Error("Campaign name is required");
            }

            // Step 1: Update campaign metadata
            const { error: campaignError } = await supabase
              .from("crm_campaigns")
              .update({
                name: campaignData.campaign_name,
                subject_line: campaignData.subject_line,
                preheader: campaignData.preheader,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existingCampaignId);

            if (campaignError) {
              console.error("❌ Campaign update failed:", campaignError);
              throw new Error(
                `Campaign update failed: ${campaignError.message}`,
              );
            }

            // Step 2: Save blocks separately - update existing, insert new

            if (campaignData.blocks.length > 0) {
              // Fetch existing blocks to preserve their IDs
              const { data: existingBlocks } = await supabase
                .from("campaign_blocks")
                .select("id, order_index")
                .eq("campaign_id", existingCampaignId);

              const existingBlockMap = new Map(
                (existingBlocks || []).map((b) => [b.order_index, b.id]),
              );

              const blocksToUpdate: any[] = [];
              const blocksToInsert: any[] = [];

              campaignData.blocks.forEach((block, index) => {
                const existingId = existingBlockMap.get(index);

                // CANONICAL: Use normalizeBlockForSave for consistent field mapping
                const normalizedBlock = normalizeBlockForSave(block, index);
                const blockData = {
                  campaign_id: existingCampaignId,
                  ...normalizedBlock,
                };

                // Validate required fields
                if (!blockData.block_type) {
                  throw new Error(
                    `Block ${index} is missing required block_type`,
                  );
                }

                if (existingId) {
                  // Update existing block
                  blocksToUpdate.push({ ...blockData, id: existingId });
                } else {
                  // Insert new block
                  blocksToInsert.push(blockData);
                }
              });

              // Delete blocks that are no longer needed
              const { error: deleteError } = await supabase
                .from("campaign_blocks")
                .delete()
                .eq("campaign_id", existingCampaignId)
                .gte("order_index", campaignData.blocks.length);

              if (deleteError) {
              }

              // Update existing blocks
              if (blocksToUpdate.length > 0) {
                for (const block of blocksToUpdate) {
                  const { error: updateError } = await supabase
                    .from("campaign_blocks")
                    .update(block)
                    .eq("id", block.id);

                  if (updateError) {
                    console.error("❌ Block update failed:", updateError);
                    throw new Error(
                      `Block update failed: ${updateError.message}`,
                    );
                  }
                }
              }

              // Insert new blocks
              if (blocksToInsert.length > 0) {
                const { error: insertError } = await supabase
                  .from("campaign_blocks")
                  .insert(blocksToInsert);

                if (insertError) {
                  console.error("❌ Block insert failed:", insertError);
                  throw new Error(
                    `Block insert failed: ${insertError.message}`,
                  );
                }
              }
            } else {
              // Delete all blocks if none provided
              await supabase
                .from("campaign_blocks")
                .delete()
                .eq("campaign_id", existingCampaignId);
            }

            setLastSaved(new Date());
            setSaveError(false);
          } catch (error: any) {
            console.error(
              "❌ Auto-save error (attempt",
              retryCount + 1,
              "):",
              error,
            );

            const isRetryable =
              error?.message?.includes("network") ||
              error?.message?.includes("timeout") ||
              error?.message?.includes("temporary");

            if (retryCount < maxRetries && isRetryable) {
              retryCount++;
              await new Promise((resolve) => setTimeout(resolve, 2000));
              return attemptSave();
            }

            setSaveError(true);

            let errorMessage =
              "Your changes may not be saved. Please try again.";
            if (error?.message?.includes("Campaign name is required")) {
              errorMessage = "Campaign name is required to save.";
            } else if (error?.message?.includes("network")) {
              errorMessage =
                "Network error. Check your connection and try again.";
            } else if (
              error?.message?.includes("Block") &&
              error?.message?.includes("missing")
            ) {
              errorMessage =
                "Some blocks have invalid data. Please check your content.";
            }

            toast({
              title: "Auto-save failed",
              description: errorMessage,
              variant: "destructive",
            });

            throw error;
          } finally {
            setIsAutoSaving(false);
          }
        };

        return attemptSave();
      });
    },
    [existingCampaignId, enqueueSave, toast],
  );

  const persistCampaignAudienceToDb = useCallback(
    async (campaignId: string) => {
      if (!campaignId) return;

      // Only persist DB-safe IDs (UUIDs) to FK-backed tables/columns.
      const segmentIds = (selectedSegments || [])
        .map((s: any) => String(s?.id || "").trim())
        .filter((id) => id.length > 0 && isUuidLike(id));

      const personaIds = (selectedPersonas || [])
        .map((p: any) => String(p?.id || "").trim())
        .filter(Boolean);

      return enqueueSave(async () => {
        // Keep join tables in sync with current selection.
        const [{ error: delSegErr }, { error: delPersErr }] = await Promise.all(
          [
            supabase
              .from("campaign_segments")
              .delete()
              .eq("campaign_id", campaignId),
            supabase
              .from("campaign_personas")
              .delete()
              .eq("campaign_id", campaignId),
          ],
        );

        if (delSegErr) throw delSegErr;
        if (delPersErr) throw delPersErr;

        // Single segment is stored on crm_campaigns.segment_id (FK) for legacy compatibility.
        // Multiple segments are stored in campaign_segments.
        if (segmentIds.length === 1) {
          const { error: updateErr } = await supabase
            .from("crm_campaigns")
            .update({ segment_id: segmentIds[0] })
            .eq("id", campaignId);
          if (updateErr) throw updateErr;
        } else {
          const { error: clearErr } = await supabase
            .from("crm_campaigns")
            .update({ segment_id: null })
            .eq("id", campaignId);
          if (clearErr) throw clearErr;

          if (segmentIds.length > 1) {
            const { error: insertErr } = await supabase
              .from("campaign_segments")
              .insert(
                segmentIds.map((segmentId) => ({
                  campaign_id: campaignId,
                  segment_id: segmentId,
                })),
              );
            if (insertErr) throw insertErr;
          }
        }

        // Persist personas as both an array field (crm_campaigns.persona_ids)
        // and a join table (campaign_personas) for compatibility across screens.
        const { error: personaFieldErr } = await supabase
          .from("crm_campaigns")
          .update({ persona_ids: personaIds.length > 0 ? personaIds : [] })
          .eq("id", campaignId);
        if (personaFieldErr) throw personaFieldErr;

        const uuidPersonaIds = personaIds.filter((id) => isUuidLike(id));
        if (uuidPersonaIds.length > 0) {
          const { error: personaInsertErr } = await supabase
            .from("campaign_personas")
            .insert(
              uuidPersonaIds.map((personaId) => ({
                campaign_id: campaignId,
                persona_id: personaId,
              })),
            );
          if (personaInsertErr) throw personaInsertErr;
        }
      });
    },
    [enqueueSave, isUuidLike, selectedPersonas, selectedSegments],
  );

  const audiencePersistTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Persist audience selection so refresh restores the chosen segment(s)/persona(s).
  useEffect(() => {
    // Avoid persisting while we are still loading the campaign.
    if (loadingExistingCampaign) return;

    // Cancel any pending persist
    if (audiencePersistTimeoutRef.current) {
      clearTimeout(audiencePersistTimeoutRef.current);
      audiencePersistTimeoutRef.current = null;
    }

    const hasAudienceSelection =
      (selectedSegments?.length || 0) > 0 ||
      (selectedPersonas?.length || 0) > 0;

    // If nothing is selected and we don't have a campaign yet, nothing to do.
    if (!hasAudienceSelection && !existingCampaignId) return;

    // Debounce to avoid hammering DB while user clicks around.
    audiencePersistTimeoutRef.current = setTimeout(() => {
      void (async () => {
        let campaignId = existingCampaignId;
        if (!campaignId) {
          // Create a draft so the targeting survives refresh.
          campaignId = await createDraftCampaign();
        }
        if (!campaignId) return;
        try {
          await persistCampaignAudienceToDb(campaignId);
        } catch (error) {
          if (import.meta.env.DEV) {
          }
        }
      })();
    }, 800);

    return () => {
      if (audiencePersistTimeoutRef.current) {
        clearTimeout(audiencePersistTimeoutRef.current);
        audiencePersistTimeoutRef.current = null;
      }
    };
  }, [
    selectedSegments,
    selectedPersonas,
    existingCampaignId,
    loadingExistingCampaign,
    createDraftCampaign,
    persistCampaignAudienceToDb,
  ]);

  // Immediate save for critical updates like image generation
  // Uses a 500ms batching window to collect concurrent image saves
  const imageSaveBatchRef = useRef<{
    timeout: NodeJS.Timeout | null;
    pendingBlocks: ContentBlock[] | null;
  }>({ timeout: null, pendingBlocks: null });

  const immediateAutoSave = useCallback(
    (campaignData: {
      blocks: ContentBlock[];
      campaign_name: string;
      subject_line: string;
      preheader: string;
    }) => {
      if (!existingCampaignId) return;

      // Cancel any pending debounced saves to avoid conflicts
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }

      // Store latest blocks for batching
      imageSaveBatchRef.current.pendingBlocks = campaignData.blocks;

      // If there's already a batch timeout, let it handle the save
      if (imageSaveBatchRef.current.timeout) {
        return;
      }

      // Set up batch window - wait 500ms to collect concurrent image updates
      imageSaveBatchRef.current.timeout = setTimeout(() => {
        const blocksToSave = imageSaveBatchRef.current.pendingBlocks;
        imageSaveBatchRef.current.timeout = null;
        imageSaveBatchRef.current.pendingBlocks = null;

        if (blocksToSave) {
          autoSaveCampaign({
            blocks: blocksToSave,
            campaign_name: campaignData.campaign_name,
            subject_line: campaignData.subject_line,
            preheader: campaignData.preheader,
          });
        }
      }, 500);
    },
    [existingCampaignId, autoSaveCampaign],
  );

  // Handler for AI-generated content
  const handleAIContentGenerated = async (aiData: {
    campaignName: string;
    subjectLine: string;
    preheaderText: string;
    blocks: ContentBlock[];
  }) => {

    // Update campaign fields
    setCampaignName(aiData.campaignName);
    setSubjectLine(aiData.subjectLine);
    setPreheaderText(aiData.preheaderText);
    setBlocks(aiData.blocks);

    // If we have an existing campaign, trigger auto-save
    if (existingCampaignId) {
      debouncedAutoSave({
        blocks: aiData.blocks,
        campaign_name: aiData.campaignName,
        subject_line: aiData.subjectLine,
        preheader: aiData.preheaderText,
      });
    }
  };

  // Handle progressive image updates as they complete
  const handleBlockImageGenerated = (blockId: string, imageUrl: string) => {
    setBlocks((prevBlocks) => {

      const updatedBlocks = prevBlocks.map((block) => {
        if (block.id === blockId) {
          // CRITICAL FIX: For header blocks, update backgroundImageUrl; for others, update imageUrl
          const isHeaderBlock =
            block.type === "header" || block.type === "newsletter-header";


          return {
            ...block,
            ...(isHeaderBlock
              ? { backgroundImageUrl: imageUrl || undefined }
              : { imageUrl: imageUrl || undefined }),
            isGeneratingImage: false,
            imageGenerationError: undefined,
            // DETERMINISTIC IMAGE BEHAVIOR: Clear shouldFetchImage after generation
            shouldFetchImage: false,
            // Keep autoImageMode as is - it was set when generation was triggered
          };
        }
        return block;
      });

      // CRITICAL FIX: Use IMMEDIATE save (not debounced) for image generation
      // Images must be persisted immediately to survive page refreshes
      if (existingCampaignId && imageUrl) {
        immediateAutoSave({
          blocks: updatedBlocks,
          campaign_name: campaignName,
          subject_line: subjectLine,
          preheader: preheaderText,
        });
      }

      return updatedBlocks;
    });
  };

  // Handle image generation failures
  const handleBlockImageFailed = (blockId: string, error: string) => {
    setBlocks((prevBlocks) =>
      prevBlocks.map((block) =>
        block.id === blockId
          ? { ...block, isGeneratingImage: false, imageGenerationError: error }
          : block,
      ),
    );
  };

  // Retry image generation for a failed block
  const retryImageGeneration = async (blockId: string) => {
    const block = blocks.find((b) => b.id === blockId);
    if (!block) return;


    // Mark as generating
    setBlocks((prevBlocks) =>
      prevBlocks.map((b) =>
        b.id === blockId
          ? { ...b, isGeneratingImage: true, imageGenerationError: undefined }
          : b,
      ),
    );

    try {
      const contentContext = (
        block.body ||
        block.content ||
        campaignName
      ).trim();
      const contentTitle = (
        block.headline ||
        block.title ||
        campaignName
      ).trim();

      const { data, error } = await supabase.functions.invoke(
        "generate-ai-image",
        {
          body: {
            contentContext,
            contentTitle,
            channel: "newsletter",
            uploadToStorage: true,
          },
        },
      );

      if (error) throw error;

      handleBlockImageGenerated(blockId, data.imageUrl);

      toast({
        title: "Image Generated",
        description: "Successfully generated the image.",
      });
    } catch (error: any) {
      handleBlockImageFailed(blockId, error.message);

      toast({
        title: "Generation Failed",
        description: "Could not generate image. Please try again.",
        variant: "destructive",
      });
    }
  };

  const debouncedAutoSave = useCallback(
    (campaignData: {
      blocks: ContentBlock[];
      campaign_name: string;
      subject_line: string;
      preheader: string;
    }) => {
      // Cancel any pending auto-save
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      // Increased debounce time from 2s to 5s to reduce rapid saves
      autoSaveTimeoutRef.current = setTimeout(() => {
        autoSaveCampaign(campaignData);
      }, 5000);
    },
    [autoSaveCampaign],
  );

  // Cleanup timeout and pending saves on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      if (imageSaveBatchRef.current.timeout) {
        clearTimeout(imageSaveBatchRef.current.timeout);
      }
      cancelPendingSaves();
    };
  }, [cancelPendingSaves]);

  // Auto-enhance new newsletters without templates
  const [enhancing, setEnhancing] = useState(false);

  useEffect(() => {
    const route = searchParams;
    const isNewNewsletter =
      route.get("type") === "newsletter" &&
      !route.get("templateId") &&
      !route.get("contentTaskId") &&
      !existingCampaignId &&
      blocks.length > 0 &&
      !enhancing;

    if (!isNewNewsletter) return;

    let cancelled = false;

    async function enhanceAll() {
      setEnhancing(true);

      const topic =
        campaignName ||
        blocks.find((b) => b.title || b.headline)?.title ||
        "Weekly Gardening Tips";

      try {
        const enhanced = await Promise.allSettled(
          blocks.map(async (block) => {
            if (block.type === "header" || block.type === "divider") {
              return block;
            }

            const currentIndex = blocks.indexOf(block);
            const previousBlocks = blocks
              .slice(0, currentIndex)
              .filter((b) => b.type !== "header" && b.type !== "divider");

            const payload = {
              prompt: `Create newsletter content for: ${topic.trim()}`,
              type: "email_block",
              postType: "newsletter",
              campaignTitle: topic.trim(),
              campaignContext: "",
              blockIndex: currentIndex,
              previousBlocks,
              totalBlocks: blocks.length,
            };

            const { data, error } = await supabase.functions.invoke(
              "generate-email-content",
              {
                body: payload,
              },
            );


            if (error) return block;

            const { normalizeAIResponse, applyAIToBlock } =
              await import("@/lib/newsletter/aiMapping");
            const normalizedAI = normalizeAIResponse(data);
            let updatedBlock = applyAIToBlock(block, normalizedAI);

            // Defensive handling for placeholder titles
            if (
              updatedBlock.title === "AI Generated Content" ||
              !updatedBlock.title
            ) {
              updatedBlock.title =
                normalizedAI.title || topic.trim() || "Newsletter Content";
            }
            if (
              updatedBlock.headline === "AI Generated Content" ||
              !updatedBlock.headline
            ) {
              updatedBlock.headline =
                normalizedAI.title || topic.trim() || "Newsletter Content";
            }

            return updatedBlock;
          }),
        );

        const enhancedBlocks = enhanced.map((result, i) =>
          result.status === "fulfilled" ? result.value : blocks[i],
        );

        if (!cancelled) {
          // Apply image fallback for blocks that need images
          const blocksWithImages = await Promise.all(
            enhancedBlocks.map(async (block) => {
              if (
                (block.type === "image-text" || block.type === "hero") &&
                !block.imageUrl
              ) {
                const imageQuery =
                  block.title || block.headline || campaignName || "garden";
                try {
                  const imageData = await fetchSmartImage(imageQuery, "", true);
                  if (imageData?.url) {
                    return {
                      ...block,
                      imageUrl: imageData.url,
                      altText: imageData.alt,
                    };
                  }
                } catch (error) {
                }
              }
              return block;
            }),
          );

          setBlocks(blocksWithImages);
          const contentCount = blocksWithImages.filter(
            (b) => (b.body || b.content)?.length,
          ).length;

          toast({
            title: "AI Enhancement Complete",
            description: `Generated ${contentCount} blocks with AI content and images`,
          });
        }
      } catch (error) {
        console.error("[AI] Auto-enhance failed:", error);
        if (!cancelled) {
          toast({
            title: "Auto-enhancement failed",
            description: "Manual content editing is still available",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) {
          setEnhancing(false);
        }
      }
    }

    // Delay to ensure blocks have fully loaded
    const timer = setTimeout(enhanceAll, 1000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    searchParams,
    existingCampaignId,
    blocks.length,
    campaignName,
    enhancing,
    supabase,
    toast,
  ]);

  // Handle direct prefill data from query parameters (SIMPLIFIED & FORCED)
  useEffect(() => {
    const type = searchParams.get("type");
    const prefillDataParam = searchParams.get("prefillData");

    // Nothing to do; avoid noisy logging on every render.
    if (!type && !prefillDataParam) return;


    if (type === "newsletter" && prefillDataParam) {

      try {
        const prefillData = JSON.parse(decodeURIComponent(prefillDataParam));

        // Create new blocks with the newsletter data
        const newBlocks: ContentBlock[] = [
          {
            id: `newsletter-header-${Date.now()}`,
            type: "header",
            title: prefillData.title || "Newsletter",
            headline: prefillData.title || "Newsletter",
            source: "manual",
          },
          {
            id: `newsletter-content-${Date.now()}`,
            type: "image-text",
            headline: "Newsletter Content",
            body: prefillData.content || "Newsletter content will appear here",
            imageUrl: prefillData.featuredImage || "",
            source: "manual",
          },
        ];


        // Set the blocks and campaign info
        setBlocks(newBlocks);
        if (prefillData.title) {
          setCampaignName(prefillData.title);
          setSubjectLine(prefillData.title);
        }

      } catch (error) {
      }
    } else {
    }
  }, [searchParams]);

  // Direct prefill from URL parameters
  useEffect(() => {
    const prefillDataParam = searchParams.get("prefillData");
    if (!prefillDataParam) return;

    try {

      const prefillData = JSON.parse(decodeURIComponent(prefillDataParam));

      // Simplified deduplication - only 10 seconds to avoid blocking legitimate transfers
      const prefillKey = `crm-direct-prefill-simple`;
      const lastPrefillTime = localStorage.getItem(prefillKey);
      const currentTime = Date.now();
      const tenSeconds = 10 * 1000; // 10 seconds

      if (
        lastPrefillTime &&
        currentTime - parseInt(lastPrefillTime) < tenSeconds
      ) {
        return;
      }


      // Clean URL immediately to avoid re-processing
      const url = new URL(window.location.href);
      url.searchParams.delete("prefillData");
      const qs = url.searchParams.toString();
      window.history.replaceState({}, "", url.pathname + (qs ? `?${qs}` : ""));

      // Set campaign name and subject
      if (prefillData.title) {
        setCampaignName(prefillData.title);
        setSubjectLine(prefillData.title);
      }

      // Create blocks from prefilled content
      const newBlocks: ContentBlock[] = [];

      // Add header block
      const headerBlock = {
        id: `header-${Date.now()}`,
        type: "header" as const,
        title: prefillData.title || "Newsletter",
        headline: prefillData.title || "Newsletter",
        fontSize: "text-3xl",
        textAlign: "center" as const,
        backgroundColor: "#ffffff",
        textColor: "#1a202c",
        source: "manual" as const,
      };
      newBlocks.push(headerBlock);

      // Add main content block
      if (prefillData.content) {
        const contentBlock = {
          id: `content-${Date.now()}`,
          type: "image-text" as const,
          layout: "image-right" as const,
          headline: "Newsletter Content",
          body: prefillData.content,
          imageUrl: prefillData.featuredImage || "",
          altText: "Newsletter featured image",
          source: "manual" as const,
        };
        newBlocks.push(contentBlock);
      }

      // Set preheader
      const preheader = generatePreheaderText(
        prefillData.content || "",
        prefillData.title || "Newsletter",
      );
      setPreheaderText(preheader);

      // Apply blocks
      const normalizedBlocks = normalizeBlocks(
        autoFillHeaderTitle(newBlocks, prefillData.title || ""),
      );
      setBlocks(normalizedBlocks);

      // Store timestamp to prevent re-processing
      localStorage.setItem(prefillKey, currentTime.toString());

      toast({
        title: "Newsletter content loaded",
        description: `Successfully prefilled content from newsletter: "${prefillData.title}"`,
      });

    } catch (error) {
      console.error("❌ [DEBUG] Failed to process direct prefill data:", error);
      toast({
        title: "Prefill failed",
        description: "Could not load newsletter content. Please try again.",
        variant: "destructive",
      });
    }
  }, [searchParams]);

  // Prefill from Generated Bundle (newsletter) - HIGH PRIORITY
  useEffect(() => {
    const type = searchParams.get("type");
    if (type !== "newsletter") return;

    // Skip if template-picker flow is active
    if (searchParams.get("flow") === "template-picker") return;

    if (!bundleIdParam) return;
    if (bundleQuery.isLoading || !bundleQuery.data) return;

    const cleanUrl = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("bundleId");
      const qs = url.searchParams.toString();
      window.history.replaceState({}, "", url.pathname + (qs ? `?${qs}` : ""));
    };

    // Simplified guard: allow refilling if it's been more than 5 minutes since last prefill
    const prefillKey = `crm-prefill:${bundleIdParam}-v3`;
    const lastPrefillTime = localStorage.getItem(prefillKey);
    const currentTime = Date.now();
    const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds

    if (
      lastPrefillTime &&
      currentTime - parseInt(lastPrefillTime) < fiveMinutes
    ) {
      cleanUrl();
      return;
    }


    try {
      const items = (bundleQuery.data.content?.items || []) as any[];
      const newsletterItem =
        items.find((i: any) => i.channel === "newsletter") ||
        items.find((i: any) => i.channel === "blog") ||
        items[0];
      if (!newsletterItem) {
        return;
      }

      const title = newsletterItem.title || "Newsletter";
      const body = newsletterItem.body || "";


      setCampaignName(title);
      setSubjectLine(title);
      setPreheaderText(generatePreheaderText(body, title));

      // Use robust converter to build 4–5 blocks preview from YAML/Markdown
      const result = convertNewsletterToCRM(body, title);
      const normalizedBlocks = normalizeBlocks(result.blocks);

      setBlocks(normalizedBlocks);

      // Store current timestamp instead of 'done'
      localStorage.setItem(prefillKey, currentTime.toString());

      toast({
        title: "Newsletter content loaded",
        description: `Prefilled ${normalizedBlocks.length} content blocks from your newsletter.`,
      });

      cleanUrl();
    } catch (e) {
      console.error("❌ CRM prefill from bundle failed:", e);
      toast({
        title: "Prefill failed",
        description: "Could not load newsletter content. Please try again.",
        variant: "destructive",
      });
    }
  }, [
    bundleIdParam,
    bundleQuery.data,
    bundleQuery.isLoading,
    searchParams,
    toast,
  ]);

  // Fallback: Prefill from contentTaskId when no bundleId is available
  useEffect(() => {
    const type = searchParams.get("type");
    if (type !== "newsletter") return;

    // Skip if template-picker flow is active
    if (searchParams.get("flow") === "template-picker") return;

    if (bundleIdParam) return; // Skip if bundleId is available (higher priority)
    if (!finalContentTaskId) return;

    const prefillFromContentTask = async () => {

      try {
        // Fetch the content task data
        const { data: taskData, error } = await supabase
          .from("content_tasks")
          .select("*")
          .eq("id", finalContentTaskId)
          .single();

        if (error) {
          console.error("❌ Failed to fetch content task:", error);
          return;
        }

        if (!taskData) {
          return;
        }


        const title = `${taskData.post_type || "Newsletter"} Campaign - ${new Date().toLocaleDateString()}`;
        const content = taskData.ai_output || "";

        if (!content) {
          return;
        }

        // Set campaign data from content task
        setCampaignName(title);
        setSubjectLine(title);
        setPreheaderText(generatePreheaderText(content, title));

        // Convert content to CRM blocks
        const result = convertNewsletterToCRM(content, title);
        const normalizedBlocks = normalizeBlocks(result.blocks);

        setBlocks(normalizedBlocks);

        toast({
          title: "Newsletter content loaded",
          description: `Prefilled ${normalizedBlocks.length} content blocks from newsletter task.`,
        });
      } catch (error) {
        console.error("❌ Failed to prefill from content task:", error);
        toast({
          title: "Prefill failed",
          description:
            "Could not load newsletter content from task. Please try again.",
          variant: "destructive",
        });
      }
    };

    // Add a small delay to avoid conflicts with other initialization logic
    const timer = setTimeout(prefillFromContentTask, 500);
    return () => clearTimeout(timer);
  }, [finalContentTaskId, bundleIdParam, searchParams, toast]);

  // Guard flags to prevent multiple processing runs
  const processedTemplateRef = useRef<string | null>(null);
  const processedExistingCampaignRef = useRef<string | null>(null);
  const processedContentTaskRef = useRef<string | null>(null);

  // Check for existing campaign and load session data
  useEffect(() => {
    const checkExistingCampaign = async () => {

      // Check if this is a truly fresh campaign start (no content loading params)
      const hasTemplateId = searchParams.get("templateId");
      const hasBundleId = searchParams.get("bundleId");
      const hasPrefillData = searchParams.get("prefillData");
      const hasTemplatePickerFlow =
        searchParams.get("flow") === "template-picker";
      const isFreshStart =
        campaignSlug === "new" &&
        !hasTemplateId &&
        !hasBundleId &&
        !hasPrefillData &&
        !finalContentTaskId &&
        !hasTemplatePickerFlow;

      if (isFreshStart) {
        // CRITICAL FIX: Clear any persisted state to prevent cross-contamination
        clearPersistedState();
        // Reset all state to defaults
        setBlocks([]);
        setCampaignName("");
        setSubjectLine("");
        setPreheaderText("");
        setSelectedPersonas([]);
        setSelectedSegments([]);
        return; // Exit early - don't restore anything
      }

      // Try to restore from persisted state (for tab switches, etc.)
      const restoredData = restoreState();
      if (restoredData && !existingCampaignId) {
        const persistedState = restoredData.state;
        setCampaignName(persistedState.campaignName);
        setSubjectLine(persistedState.subjectLine);
        setPreheaderText(persistedState.preheaderText);
        setBlocks(persistedState.blocks);
        setShowPreview(persistedState.showPreview);

        // Restore flow parameter if persisted
        if (persistedState.flow && !searchParams.get("flow")) {
          const url = new URL(window.location.href);
          url.searchParams.set("flow", persistedState.flow);
          window.history.replaceState({}, "", url.toString());
        }

        // Only restore personas if no URL persona parameter exists
        if (persistedState.selectedPersonas && initialPersonas.length === 0) {
          setSelectedPersonas(persistedState.selectedPersonas);
        } else if (initialPersonas.length > 0) {
        } else {
        }

        if (persistedState.selectedSegments) {
          setSelectedSegments(persistedState.selectedSegments);
        }
      }

      // Handle newsletter template processing (from picker)
      const templateId = searchParams.get("templateId");
      const layout = searchParams.get("layout");
      const source = searchParams.get("source");

      if (templateId && source === "picker") {
        // Guard: Only process template once
        const templateKey = `${templateId}-${layout}-${source}`;
        if (processedTemplateRef.current === templateKey) {
          return;
        }

        processedTemplateRef.current = templateKey;

        try {
          setLoading(true);

          // Extract week number from templateId (e.g., "weekly-theme-45" → 45)
          const weekMatch = templateId.match(/weekly-theme-(\d+)/);
          const weekNumber = weekMatch ? parseInt(weekMatch[1]) : null;

          // Load weekly theme data from master_campaign_templates if week number found
          let weeklyThemeData: any = null;
          if (weekNumber) {
            const { data: themeData, error: themeError } = await supabase
              .from("master_campaign_templates")
              .select("*")
              .eq("week_number", weekNumber)
              .maybeSingle();

            if (!themeError && themeData) {
              weeklyThemeData = themeData;
            } else {
            }
          }

          // Fetch the newsletter ideas to get the template
          const { data, error } = await supabase.rpc("fn_get_newsletter_ideas");

          if (error) throw error;

          const ideas = Array.isArray(data) ? (data as any[]) : [];
          let selectedIdea = ideas.find((idea) => idea.id === templateId);

          // If template not found in ideas but we have weekly theme data, use that
          if (!selectedIdea && weeklyThemeData) {
            selectedIdea = {
              id: templateId,
              title: weeklyThemeData.title,
              description:
                weeklyThemeData.content_ideas || weeklyThemeData.theme,
              category: "weekly",
              seasonal_focus:
                weeklyThemeData.seasonal_focus || weeklyThemeData.theme,
              weekNumber: weekNumber,
              templateBlocks: [
                {
                  type: "header",
                  title: weeklyThemeData.title,
                  body:
                    weeklyThemeData.content_ideas ||
                    weeklyThemeData.seasonal_focus ||
                    "Discover what's growing this week and get expert tips for your garden.",
                },
                {
                  type: "image-text",
                  content:
                    weeklyThemeData.content_ideas ||
                    "Weekly themed content for your newsletter.",
                },
                {
                  type: "image-text",
                  title: "Seasonal Focus",
                  content:
                    weeklyThemeData.seasonal_focus ||
                    `Featured content and ideas for week ${weekNumber}.`,
                },
              ],
            };
          }

          if (selectedIdea) {

            // Set campaign details from template
            setCampaignName(selectedIdea.title || "Newsletter Campaign");
            setSubjectLine(selectedIdea.title || "Newsletter");
            setPreheaderText(
              generatePreheaderText(
                selectedIdea.description || "",
                selectedIdea.title || "",
              ),
            );

            // Generate blocks using the new newsletter block generator
            const templateBlocks = selectedIdea.templateBlocks || [];
            const layoutType =
              (layout as "block-builder" | "simple-email") || "block-builder";


            let crmBlocks: ContentBlock[];
            try {
              // First, generate basic template blocks
              crmBlocks = generateNewsletterBlocks({
                topic: selectedIdea.title || "Newsletter Campaign",
                layout: layoutType,
                templateBlocks: templateBlocks,
              });

              if (crmBlocks.length === 0) {
                crmBlocks = getFallbackBlocks(
                  selectedIdea.title || "Newsletter Campaign",
                );
              }

              // STEP 1: Set loading states for both text and images
              // PHASE 6: Guard against accidental loading flag resets
              const blocksWithLoadingStates = normalizeBlocks(crmBlocks).map(
                (b) => {
                  // Determine if this block should fetch images
                  const needsImage =
                    b.type === "image" || b.type === "image-text";

                  // CRITICAL: Template placeholder titles that should be replaced
                  const templatePlaceholders = [
                    "Featured Story",
                    "Main Article",
                    "Secondary Feature",
                    "Call to Action",
                    "Content Headline",
                    "Seasonal Spotlight",
                    "Tips & How-To",
                  ];

                  const isTemplatePlaceholder =
                    templatePlaceholders.includes(b.headline || "") ||
                    templatePlaceholders.includes(b.title || "");

                  // CRITICAL: Don't mark as loading if content already exists AND it's not a template placeholder
                  const hasExistingContent =
                    !isTemplatePlaceholder &&
                    !!(b.headline || b.body) &&
                    b.headline !== "⏳ Generating content..." &&
                    b.headline !== "Content Headline";

                  return {
                    ...b,
                    // Only set loading text if no real content exists (template placeholders don't count)
                    headline:
                      b.type === "header" || hasExistingContent
                        ? b.headline
                        : "⏳ Generating content...",
                    body:
                      b.type === "header" || hasExistingContent ? b.body : "",
                    content:
                      b.type === "header" || hasExistingContent
                        ? b.content
                        : "",

                    // Mark blocks that should fetch images
                    shouldFetchImage: needsImage,

                    // Image loading states
                    imageUrl: needsImage ? "loading" : b.imageUrl,
                    source: "template" as const,

                    // CRITICAL: Don't reset loading flag if content already generated
                    isLoadingContent:
                      !hasExistingContent && b.type !== "header",
                    isLoadingImage: needsImage,

                    // Preserve content generation flags
                    hasGeneratedContent:
                      b.hasGeneratedContent || hasExistingContent,
                  };
                },
              );

              setBlocks(blocksWithLoadingStates);

              // STEP 2: Generate AI content for ALL blocks (await completion)

              try {
                const enhancedBlocks = await Promise.all(
                  crmBlocks.map(async (block, index) => {
                    // Skip header blocks from AI enhancement to keep clean titles
                    if (block.type === "header") {
                      return block;
                    }

                    try {

                      const postType =
                        POST_TYPE_ROTATION[index % POST_TYPE_ROTATION.length];
                      const previousBlocks = crmBlocks
                        .slice(0, index)
                        .filter(
                          (b) => b.type !== "header" && b.type !== "divider",
                        );

                      const response = await supabase.functions.invoke(
                        "generate-email-content",
                        {
                          body: {
                            prompt: `Create newsletter content for: ${selectedIdea.title}`,
                            type: "email_block",
                            postType: postType,
                            campaignTitle:
                              selectedIdea.title || "Newsletter Campaign",
                            campaignContext: selectedIdea.description || "",
                            blockIndex: index,
                            previousBlocks,
                            totalBlocks: crmBlocks.length,
                          },
                        },
                      );

                      if (response.error) {
                        return block; // Return original block if AI fails
                      }

                      const aiResult = response.data;
                      if (aiResult && aiResult.title && aiResult.content) {

                        // PHASE 2: Apply AI content to block and mark as permanently generated
                        const needsImage =
                          block.type === "image" || block.type === "image-text";
                        return {
                          ...block,
                          title: aiResult.title,
                          headline: aiResult.title,
                          content: aiResult.content,
                          body: aiResult.content,
                          ctaText: aiResult.cta_text || block.ctaText,
                          ctaUrl: aiResult.cta_url || block.ctaUrl,
                          shouldFetchImage: needsImage, // Mark if needs image
                          isLoadingContent: false, // Mark content as loaded

                          // NEW: Mark content as permanently generated
                          hasGeneratedContent: true,
                          contentGeneratedAt: Date.now(),
                          contentVersion: (block.contentVersion || 0) + 1,
                        };
                      } else {
                        return { ...block, isLoadingContent: false };
                      }
                    } catch (blockError) {
                      return { ...block, isLoadingContent: false }; // Return original block if enhancement fails
                    }
                  }),
                );


                // STEP 3: Update blocks with AI-generated content (images still loading)
                // PHASE 2: Use functional update to preserve content flags
                let contentReadyBlocks: ContentBlock[] = [];
                setBlocks((prevBlocks) => {
                  contentReadyBlocks = normalizeBlocks(
                    autoFillHeaderTitle(
                      enhancedBlocks,
                      selectedIdea.title || "Newsletter Campaign",
                    ),
                  ).map((b) => {
                    const needsImage =
                      b.type === "image" || b.type === "image-text";
                    const prev = prevBlocks.find((p) => p.id === b.id);
                    return {
                      ...b,
                      shouldFetchImage: needsImage,
                      imageUrl: needsImage ? "loading" : b.imageUrl,
                      isLoadingImage: needsImage,
                      source: "template" as const,
                      // Preserve content generation flags from previous state
                      hasGeneratedContent:
                        prev?.hasGeneratedContent || b.hasGeneratedContent,
                      contentGeneratedAt:
                        prev?.contentGeneratedAt || b.contentGeneratedAt,
                      contentVersion: prev?.contentVersion || b.contentVersion,
                    };
                  });
                  return contentReadyBlocks;
                });
                crmBlocks = contentReadyBlocks;

                // STEP 4: Generate images from AI-generated content
                const weekContext = {
                  title: selectedIdea.title || "Garden Newsletter",
                  description: selectedIdea.description || "",
                  seasonalFocus:
                    selectedIdea.seasonal_focus ||
                    selectedIdea.description ||
                    "seasonal",
                  weekNumber: selectedIdea.weekNumber,
                };

                // Generate images asynchronously (don't await to avoid blocking UI)
                generateImagesForBlocks(
                  contentReadyBlocks,
                  weekContext,
                  usedImageIds,
                  setUsedImageIds,
                  setBlocks,
                ).catch((err) =>
                  console.error("❌ Image generation error:", err),
                );
              } catch (enhancementError) {
                console.error(
                  "❌ Block enhancement failed, using template blocks:",
                  enhancementError,
                );
                // Keep the template blocks as fallback
              }
            } catch (error) {
              console.error("❌ Error generating blocks:", error);
              crmBlocks = getFallbackBlocks(
                selectedIdea.title || "Newsletter Campaign",
              );
            }

            toast({
              title: "Template Applied",
              description: `Newsletter template "${selectedIdea.title}" has been applied successfully with ${crmBlocks.length} blocks for ${layoutType} layout.`,
            });

            // Clean up flow parameter after successful processing
            const url = new URL(window.location.href);
            url.searchParams.delete("flow");
            const cleanUrl = url.toString();
            window.history.replaceState({}, "", cleanUrl);

          } else {

            // If we have weekly theme data, use that as a backup
            if (weeklyThemeData) {
              const topic = weeklyThemeData.title;
              const description =
                weeklyThemeData.content_ideas || weeklyThemeData.theme;

              setCampaignName(topic);
              setSubjectLine(topic);
              setPreheaderText(generatePreheaderText(description, topic));

              const layoutType =
                (layout as "block-builder" | "simple-email") || "block-builder";

              let crmBlocks = generateNewsletterBlocks({
                topic: topic,
                layout: layoutType,
                templateBlocks: [],
              });

              if (crmBlocks.length === 0) {
                crmBlocks = getFallbackBlocks(topic);
              }

              // Set loading states for content and images
              const blocksWithLoadingStates = normalizeBlocks(crmBlocks).map(
                (b) => {
                  const needsImage =
                    b.type === "image" || b.type === "image-text";
                  return {
                    ...b,
                    headline:
                      b.type === "header"
                        ? b.headline
                        : "⏳ Generating content...",
                    body: b.type === "header" ? b.body : "",
                    shouldFetchImage: needsImage,
                    imageUrl: needsImage ? "loading" : b.imageUrl,
                    source: "template" as const,
                    isLoadingContent: b.type !== "header",
                    isLoadingImage: needsImage,
                  };
                },
              );

              setBlocks(blocksWithLoadingStates);

              // Generate AI content for blocks
              const enhancedBlocks = await Promise.all(
                crmBlocks.map(async (block, index) => {
                  if (block.type === "header") return block;

                  try {
                    const postType =
                      POST_TYPE_ROTATION[index % POST_TYPE_ROTATION.length];
                    const previousBlocks = crmBlocks
                      .slice(0, index)
                      .filter(
                        (b) => b.type !== "header" && b.type !== "divider",
                      );

                    const response = await supabase.functions.invoke(
                      "generate-email-content",
                      {
                        body: {
                          prompt: `Create newsletter content for: ${topic}`,
                          type: "email_block",
                          postType: postType,
                          campaignTitle: topic,
                          campaignContext: description,
                          blockIndex: index,
                          previousBlocks,
                          totalBlocks: crmBlocks.length,
                        },
                      },
                    );

                    if (
                      response.error ||
                      !response.data?.title ||
                      !response.data?.content
                    ) {
                      return block;
                    }

                    const aiResult = response.data;
                    const needsImage =
                      block.type === "image" || block.type === "image-text";
                    return {
                      ...block,
                      title: aiResult.title,
                      headline: aiResult.title,
                      content: aiResult.content,
                      body: aiResult.content,
                      ctaText: aiResult.cta_text || block.ctaText,
                      ctaUrl: aiResult.cta_url || block.ctaUrl,
                      shouldFetchImage: needsImage,
                      isLoadingContent: false,
                    };
                  } catch (blockError) {
                    return { ...block, isLoadingContent: false };
                  }
                }),
              );

              // Update blocks with AI content
              const contentReadyBlocks = normalizeBlocks(
                autoFillHeaderTitle(enhancedBlocks, topic),
              ).map((b) => {
                const needsImage =
                  b.type === "image" || b.type === "image-text";
                return {
                  ...b,
                  shouldFetchImage: needsImage,
                  imageUrl: needsImage ? "loading" : b.imageUrl,
                  isLoadingImage: needsImage,
                  source: "template" as const,
                };
              });

              setBlocks(contentReadyBlocks);

              // Generate images from AI content
              const weekContext = {
                title: topic,
                description: description,
                seasonalFocus: weeklyThemeData.seasonal_focus || description,
                weekNumber: weekNumber || undefined,
              };

              generateImagesForBlocks(
                contentReadyBlocks,
                weekContext,
                usedImageIds,
                setUsedImageIds,
                setBlocks,
              ).catch((err) =>
                console.error("❌ Image generation error:", err),
              );

              toast({
                title: "Template Applied",
                description: `Weekly theme "${topic}" has been applied successfully.`,
              });

              // Clean up flow parameter
              const url = new URL(window.location.href);
              url.searchParams.delete("flow");
              window.history.replaceState({}, "", url.toString());

              setLoading(false);
              return;
            }

            // Final fallback: use URL parameters

            const safeDecodeURIComponent = (value: string) => {
              try {
                return decodeURIComponent(value);
              } catch (error) {
                return value;
              }
            };

            const urlTitle = safeDecodeURIComponent(
              searchParams.get("title") || "",
            );
            const urlDescription = safeDecodeURIComponent(
              searchParams.get("description") || "",
            );

            const topic =
              urlTitle || weeklyThemeData?.title || "Newsletter Campaign";
            const description =
              urlDescription || weeklyThemeData?.content_ideas || topic;

            // Generate blocks based on layout and topic
            const layoutType =
              (layout as "block-builder" | "simple-email") || "block-builder";
            const sanitizedTopic = sanitizeCampaignTitle(topic);
            setCampaignName(sanitizedTopic);
            setSubjectLine(sanitizedTopic.replace(" Newsletter", ""));
            setPreheaderText(
              generatePreheaderText(description, sanitizedTopic),
            );


            let crmBlocks = generateNewsletterBlocks({
              topic: topic,
              layout: layoutType,
              templateBlocks: [],
            });

            if (crmBlocks.length === 0) {
              crmBlocks = getFallbackBlocks(topic);
            }

            // Set loading states for content and images (same as successful path)
            const blocksWithLoadingStates = normalizeBlocks(crmBlocks).map(
              (b) => {
                const needsImage =
                  b.type === "image" || b.type === "image-text";
                return {
                  ...b,
                  headline:
                    b.type === "header"
                      ? b.headline
                      : "⏳ Generating content...",
                  body: b.type === "header" ? b.body : "",
                  shouldFetchImage: needsImage,
                  imageUrl: needsImage ? "loading" : b.imageUrl,
                  source: "template" as const,
                  isLoadingContent: b.type !== "header",
                  isLoadingImage: needsImage,
                };
              },
            );

            setBlocks(blocksWithLoadingStates);

            // TEMPLATE REUSE: Only reuse content when explicitly provided via template_id or source_campaign_id
            // REMOVED: Fuzzy ilike name matching that caused cross-contamination between campaigns
            // Template reuse is now explicit and ID-based, not name-pattern based

            // If a specific templateId was provided via URL params, use it for explicit template lookup
            if (templateIdParam) {
              try {
                const {
                  data: { user },
                } = await supabase.auth.getUser();
                if (user) {
                  // EXPLICIT template lookup - only matches exact template_id
                  const { data: templateCampaign, error } = await supabase
                    .from("crm_campaigns")
                    .select(
                      `
                      id,
                      name,
                      subject_line,
                      preheader,
                      metadata,
                      campaign_blocks(*)
                    `,
                    )
                    .eq("user_id", user.id)
                    .eq("template_id", templateIdParam)
                    .eq("status", "draft")
                    .limit(1)
                    .maybeSingle();

                  if (
                    !error &&
                    templateCampaign &&
                    ((templateCampaign.metadata as any)?.content_blocks
                      ?.length > 0 ||
                      templateCampaign.campaign_blocks?.length > 0)
                  ) {

                    // Use campaign_blocks if available, otherwise metadata
                    const blocksData =
                      templateCampaign.campaign_blocks?.length > 0
                        ? templateCampaign.campaign_blocks
                        : (templateCampaign.metadata as any)?.content_blocks ||
                          [];

                    // Convert existing blocks back to our format
                    const existingBlocks = blocksData.map(
                      (block: any, index: number) => {
                        const blockType =
                          block.block_type || block.type || "text";
                        const isHeaderBlock =
                          blockType === "header" ||
                          blockType === "newsletter-header";

                        return {
                          id: block.id || `existing_${Date.now()}_${index}`,
                          type: blockType,
                          title: block.title || "",
                          content: block.content || "",
                          headline: block.headline || block.title || "",
                          body:
                            block.body ||
                            (typeof block.content === "string"
                              ? block.content
                              : ""),
                          ...(isHeaderBlock
                            ? { backgroundImageUrl: block.image_url || "" }
                            : { imageUrl: block.image_url || "" }),
                          ctaText: block.cta_text || "",
                          ctaUrl: block.cta_url || "",
                          source: block.source || "template",
                          personaTag: block.persona_tag || "general",
                          layout: block.layout || "full-width",
                          alignment: "left",
                          textAlign: "left",
                          padding: "medium",
                          visible: true,
                          collapsed: false,
                          status: "ai-generated" as const,
                        };
                      },
                    );

                    setBlocks(normalizeBlocks(existingBlocks));
                    setExistingCampaignId(templateCampaign.id);
                    setCampaignName(templateCampaign.name);
                    setSubjectLine(templateCampaign.subject_line || topic);
                    setPreheaderText(
                      templateCampaign.preheader ||
                        generatePreheaderText(topic, description),
                    );

                    return; // Skip AI generation since we have template content
                  }
                }
              } catch (error) {
              }
            }

            // Add AI content generation for fallback blocks
            // Guard against duplicate campaign creation from rapid clicks
            if (existingCampaignId) {
              setLoading(false);
              return;
            }
            setTimeout(async () => {
              // Double-check inside setTimeout to catch race conditions
              if (existingCampaignId) {
                return;
              }
              try {
                const enhancedBlocks = [...crmBlocks];

                // Mark all content blocks as generating
                const contentBlockIds = enhancedBlocks
                  .filter(
                    (block) =>
                      block.type !== "header" && block.type !== "divider",
                  )
                  .map((block) => block.id);
                setGeneratingBlocks(new Set(contentBlockIds));

                for (let i = 0; i < enhancedBlocks.length; i++) {
                  const block = enhancedBlocks[i];

                  if (block.type === "header" || block.type === "divider") {
                    continue;
                  }

                  try {
                    const blockPrompt = createBlockPrompt(
                      block,
                      topic,
                      description,
                      i,
                    );
                    const payload = {
                      prompt: blockPrompt,
                      type: "email_block",
                      postType: "newsletter",
                    };

                    const { data, error } = await supabase.functions.invoke(
                      "generate-email-content",
                      {
                        body: payload,
                      },
                    );

                    if (error) {
                      continue;
                    }

                    if (data?.content) {
                      // Use the same AI mapping logic as AIWriterDialog
                      const normalizedAI = normalizeAIResponse(data);
                      const aiEnhancedBlock = applyAIToBlock(
                        block,
                        normalizedAI,
                      );

                      enhancedBlocks[i] = aiEnhancedBlock;
                    }

                    // PHASE 2: Update blocks incrementally with functional update
                    setBlocks((prev) => {
                      const normalized = normalizeBlocks([...enhancedBlocks]);
                      return normalized.map((block) => {
                        const prevBlock = prev.find((p) => p.id === block.id);
                        return {
                          ...block,
                          hasGeneratedContent:
                            prevBlock?.hasGeneratedContent ||
                            block.hasGeneratedContent,
                          contentGeneratedAt:
                            prevBlock?.contentGeneratedAt ||
                            block.contentGeneratedAt,
                          contentVersion:
                            prevBlock?.contentVersion || block.contentVersion,
                        };
                      });
                    });

                    // Remove this block from generating set
                    setGeneratingBlocks((prev) => {
                      const newSet = new Set(prev);
                      newSet.delete(block.id);
                      return newSet;
                    });
                  } catch (error) {
                    console.error(
                      `Failed to enhance fallback block ${i}:`,
                      error,
                    );
                    // Remove from generating set even on error
                    setGeneratingBlocks((prev) => {
                      const newSet = new Set(prev);
                      newSet.delete(block.id);
                      return newSet;
                    });
                  }
                }


                // Generate images for blocks with AI content
                const weekContext = {
                  title: topic,
                  description: description,
                  seasonalFocus: weeklyThemeData?.seasonal_focus || description,
                  weekNumber: weekNumber || undefined,
                };

                generateImagesForBlocks(
                  enhancedBlocks,
                  weekContext,
                  usedImageIds,
                  setUsedImageIds,
                  setBlocks,
                ).catch((err) =>
                  console.error("❌ [FallbackAI] Image generation error:", err),
                );

                // Auto-save the generated content as a draft
                try {
                  const {
                    data: { user },
                  } = await supabase.auth.getUser();
                  if (user) {
                    const campaignData = {
                      name: topic,
                      subject: subjectLine || topic,
                      preheader:
                        preheaderText ||
                        generatePreheaderText(topic, description),
                      sender_name: senderConfig?.displayName || "BloomSuite",
                      sender_email: senderConfig?.senderEmail || "",
                      from_email_domain_id:
                        senderConfig?.fromEmailDomainId || null,
                      content: "", // HTML will be generated when needed
                      segments: [],
                      schedule: { type: "immediate" as const },
                      content_blocks: enhancedBlocks,
                    };

                    const savedCampaign =
                      await saveCampaignAsDraft(campaignData);
                    setExistingCampaignId(savedCampaign.id);
                  }
                } catch (error) {
                }
              } catch (error) {
                console.error(
                  "Failed to enhance fallback blocks with AI:",
                  error,
                );
                // Clear all generating states on major error
                setGeneratingBlocks(new Set());
              }
            }, 500);
          }
        } catch (error) {
          console.error("❌ Error processing template:", error);
          toast({
            title: "Template Error",
            description:
              "Failed to load the selected template. Starting with a blank campaign.",
            variant: "destructive",
          });
        } finally {
          setLoading(false);
        }
        return;
      }

      // Handle direct campaign slug (when editing existing campaign)
      // This takes priority over content task conversion
      if (campaignSlug) {
        // Check if campaignSlug is a valid UUID (existing campaign) or just a slug (new campaign)
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const isValidUUID = uuidRegex.test(campaignSlug);


        if (isValidUUID) {
          // Guard: Only process existing campaign once
          if (processedExistingCampaignRef.current === campaignSlug) {
            return;
          }

          setLoadingExistingCampaign(true);
          try {
            await loadExistingCampaign(campaignSlug);
            setExistingCampaignId(campaignSlug);
            processedExistingCampaignRef.current = campaignSlug;
          } catch (error) {
            console.error("❌ Error loading campaign by UUID:", error);
            // Allow retry on next effect run (e.g. once auth is ready)
            processedExistingCampaignRef.current = null;
            toast({
              title: "Error",
              description: "Failed to load campaign data",
              variant: "destructive",
            });
          } finally {
            setLoadingExistingCampaign(false);
          }
          return;
        } else {
          // Continue to the content task conversion logic below
        }
      }

      const contentTaskId = finalContentTaskId;
      if (!contentTaskId) return;

      // Guard: Only process content task once
      if (processedContentTaskRef.current === contentTaskId) {
        return;
      }
      processedContentTaskRef.current = contentTaskId;

      setLoadingExistingCampaign(true);
      try {
        // Check if content task is already linked to a CRM campaign
        const { data: contentTask, error } = await supabase
          .from("content_tasks")
          .select("linked_crm_campaign_id")
          .eq("id", contentTaskId)
          .single();

        if (error) throw error;

        if (contentTask?.linked_crm_campaign_id) {
          // Load existing CRM campaign data
          await loadExistingCampaign(contentTask.linked_crm_campaign_id);
          setExistingCampaignId(contentTask.linked_crm_campaign_id);
        } else {
          // No existing campaign, proceed with conversion
          const title = searchParams.get("title");
          const content = searchParams.get("content");
          const type = searchParams.get("type");

          if (type === "newsletter" && !converting && blocks.length === 0) {
            handleNewsletterConversion(
              contentTaskId,
              title || "",
              content || "",
            );
          }
        }
      } catch (error) {
        console.error("Error checking existing campaign:", error);
        // Fall back to normal conversion if check fails
        const title = searchParams.get("title");
        const content = searchParams.get("content");
        const type = searchParams.get("type");

        if (type === "newsletter" && !converting && blocks.length === 0) {
          handleNewsletterConversion(contentTaskId, title || "", content || "");
        }
      } finally {
        setLoadingExistingCampaign(false);
      }
    };

    checkExistingCampaign();
  }, [
    searchParams.get("templateId"),
    searchParams.get("layout"),
    searchParams.get("source"),
    finalContentTaskId,
    campaignSlug,
    user?.id,
  ]);

  // Additional useEffect to monitor blocks changes
  useEffect(() => {
  }, [blocks]);

  // Initialize blank newsletter with default blocks
  const blankNewsletterInitialized = useRef(false);
  useEffect(() => {
    const isBlankNewsletter =
      searchParams.get("type") === "newsletter" &&
      !searchParams.get("templateId") &&
      !searchParams.get("contentTaskId") &&
      !existingCampaignId &&
      !campaignSlug &&
      blocks.length === 0 &&
      !blankNewsletterInitialized.current;

    if (isBlankNewsletter) {
      blankNewsletterInitialized.current = true;

      setCampaignName("Newsletter Campaign");
      setSubjectLine("Weekly Garden Update");
      setPreheaderText("Essential gardening tips delivered to your inbox");

      // Generate default newsletter blocks
      const defaultBlocks = getFallbackBlocks("Newsletter Campaign");
      setBlocks(defaultBlocks);

    }
  }, [
    searchParams.get("type"),
    searchParams.get("templateId"),
    searchParams.get("contentTaskId"),
    existingCampaignId,
    campaignSlug,
    blocks.length,
  ]);

  const loadExistingCampaign = async (campaignId: string) => {
    try {

      // Load campaign details
      const { data: campaign, error: campaignError } = await supabase
        .from("crm_campaigns")
        .select("*")
        .eq("id", campaignId)
        .single();


      if (campaignError) throw campaignError;

      // Load campaign blocks
      const { data: campaignBlocks, error: blocksError } = await supabase
        .from("campaign_blocks")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("order_index");


      if (blocksError) throw blocksError;

      // Load campaign targeting (segments + personas) so UI reflects stored audience
      const [campaignSegmentsResult, campaignPersonasResult] =
        await Promise.all([
          supabase
            .from("campaign_segments")
            .select("segment_id")
            .eq("campaign_id", campaignId),
          supabase
            .from("campaign_personas")
            .select("persona_id")
            .eq("campaign_id", campaignId),
        ]);

      if (campaignSegmentsResult.error) throw campaignSegmentsResult.error;
      if (campaignPersonasResult.error) throw campaignPersonasResult.error;

      const persistedSegmentIds = (campaignSegmentsResult.data || [])
        .map((r: any) => String(r?.segment_id || ""))
        .filter(Boolean);

      // Single-segment campaigns store segment directly on crm_campaigns.segment_id
      const campaignSingleSegmentId = String(
        (campaign as any)?.segment_id || "",
      );
      const allSegmentIds = Array.from(
        new Set([
          ...persistedSegmentIds,
          ...(campaignSingleSegmentId ? [campaignSingleSegmentId] : []),
        ]),
      );

      const personaFromCampaignField: string[] = Array.isArray(
        (campaign as any)?.persona_ids,
      )
        ? ((campaign as any).persona_ids as any[])
            .map((p) => String(p || ""))
            .filter(Boolean)
        : [];

      const persistedPersonaIds = (campaignPersonasResult.data || [])
        .map((r: any) => String(r?.persona_id || ""))
        .filter(Boolean);

      const allPersonaIds = Array.from(
        new Set([...personaFromCampaignField, ...persistedPersonaIds]),
      );

      // Hydrate persona details
      if (allPersonaIds.length > 0) {
        const { data: personas, error: personaDetailError } = await supabase
          .from("crm_personas")
          .select("id, persona_name, persona_description, is_custom")
          .in("id", allPersonaIds);

        if (personaDetailError) throw personaDetailError;

        const foundById = new Map(
          (personas || []).map((p: any) => [String(p.id), p]),
        );
        const hydrated = allPersonaIds
          .map((id) => foundById.get(id) || null)
          .filter(Boolean);

        setSelectedPersonas(hydrated as any[]);
      } else {
        setSelectedPersonas([]);
      }

      // Hydrate segment details (support UUID segments and system string segments)
      if (allSegmentIds.length > 0) {
        const uuidSegmentIds = allSegmentIds.filter(isUuidLike);

        const [crmSegmentsResult, customSegmentsResult] = await Promise.all([
          uuidSegmentIds.length > 0
            ? supabase
                .from("crm_segments")
                .select("id, name, description, customer_count")
                .in("id", uuidSegmentIds)
            : Promise.resolve({ data: [], error: null } as any),
          uuidSegmentIds.length > 0
            ? supabase
                .from("custom_segments")
                .select("id, name, customer_count")
                .in("id", uuidSegmentIds)
            : Promise.resolve({ data: [], error: null } as any),
        ]);

        if (crmSegmentsResult.error) throw crmSegmentsResult.error;
        if (customSegmentsResult.error) throw customSegmentsResult.error;

        const hydratedSegments: any[] = [];

        const crmById = new Map(
          (crmSegmentsResult.data || []).map((s: any) => [String(s.id), s]),
        );
        const customById = new Map(
          (customSegmentsResult.data || []).map((s: any) => [String(s.id), s]),
        );

        for (const id of allSegmentIds) {
          if (isUuidLike(id)) {
            const seg = crmById.get(id) || customById.get(id) as any;
            if (seg) {
              hydratedSegments.push({
                id: (seg as any).id,
                name: (seg as any).name,
                description: (seg as any).description || undefined,
                type: "custom",
                customer_count: (seg as any).customer_count || 0,
              });
              continue;
            }
          }

          // System/predefined segment fallback
          const predefinedSegments: Record<string, string> = {
            "new-customers": "New Customers",
            "loyalty-members": "Loyalty Members",
            "high-value": "High-Value Customers",
            "lapsed-customers": "Lapsed Customers",
            "seasonal-shoppers": "Seasonal Shoppers",
            "frequent-buyers": "Frequent Buyers",
          };
          const name = predefinedSegments[id] || id;
          const countFromHook = (segmentCounts as any)?.[id] || 0;
          hydratedSegments.push({
            id,
            name,
            type: "predefined",
            customer_count: countFromHook,
          });
        }

        setSelectedSegments(hydratedSegments);
      } else {
        setSelectedSegments([]);
      }

      // Restore campaign state
      setCampaignName(campaign.name);
      setSubjectLine(campaign.subject_line || campaign.name); // Handle missing subject field
      setPreheaderText(campaign.preheader || "");

      // Restore scheduled campaign state
      setCampaignStatus(campaign.status || "draft");
      setScheduledAt(campaign.scheduled_at || null);

      // Sync schedule state with loaded campaign
      if (campaign.status === "scheduled" && campaign.scheduled_at) {
        const metadata = campaign.metadata as Record<string, unknown> | null;
        skipNextSchedulePersistRef.current = true;
        setSchedule({
          type: "scheduled",
          date: new Date(campaign.scheduled_at),
          timezone:
            (metadata?.scheduled_timezone as string) ||
            Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
      } else {
        skipNextSchedulePersistRef.current = true;
        setSchedule({ type: "now" });
      }


      // CANONICAL: Use normalizeBlockFromDatabase for consistent field mapping
      const contentBlocks: ContentBlock[] = (
        (campaignBlocks || []) as DatabaseBlock[]
      ).map(normalizeBlockFromDatabase);

      setBlocks(contentBlocks);

      toast({
        title: "Campaign Loaded",
        description: `Continuing where you left off with ${contentBlocks.length} blocks.`,
      });

    } catch (error) {
      console.error("Error loading existing campaign:", error);
      toast({
        title: "Load Error",
        description: "Failed to load existing campaign. Starting fresh.",
        variant: "destructive",
      });
    }
  };

  const handleNewsletterConversion = async (
    contentTaskId: string,
    title: string,
    urlContent: string,
  ) => {
    if (converting) return; // Prevent multiple conversions

    setConverting(true);

    try {

      let fullContent = urlContent;

      // Always try to fetch from database for valid UUID
      if (
        contentTaskId &&
        contentTaskId.length === 36 &&
        contentTaskId.includes("-")
      ) {
        try {
          const { data: contentTask, error } = await supabase
            .from("content_tasks")
            .select(
              `
              ai_output,
              campaigns!inner(title, theme)
            `,
            )
            .eq("id", contentTaskId)
            .single();

          if (!error && contentTask?.ai_output) {
            fullContent = contentTask.ai_output;

            // Set source content info for verification
            setSourceContentInfo({
              taskId: contentTaskId,
              campaignTitle: contentTask.campaigns?.title || "Unknown Campaign",
              contentPreview: fullContent.substring(0, 150) + "...",
            });

          }
        } catch (dbError) {
        }
      }

      if (!fullContent) {
        throw new Error("No content available for conversion");
      }


      // First, try to get preserved newsletter images from the content task
      let preservedImages = {};
      try {
        if (contentTaskId) {
          const { data: attachmentsData } = await supabase
            .from("content_tasks")
            .select("attachments")
            .eq("id", contentTaskId)
            .single();

          if (
            attachmentsData?.attachments &&
            typeof attachmentsData.attachments === "object" &&
            attachmentsData.attachments !== null &&
            "newsletter_images" in attachmentsData.attachments
          ) {
            const attachments = attachmentsData.attachments as Record<
              string,
              any
            >;
            preservedImages = attachments.newsletter_images;
          }
        }
      } catch (imageError) {
      }

      // Use the enhanced newsletter conversion system with preserved images
      const result = convertNewsletterToCRM(fullContent, title, contentTaskId);

      if (!result.blocks || result.blocks.length === 0) {
        throw new Error("Conversion resulted in no blocks");
      }

      // Pre-fill campaign settings
      setCampaignName(result.campaignTitle);
      setSubjectLine(result.campaignTitle);
      // Generate content-specific preheader
      const preheaderText = generatePreheaderText(
        fullContent,
        result.campaignTitle,
      );
      setPreheaderText(preheaderText);

      // Set blocks with layout and images
      const crmBlocks = result.blocks;

      setBlocks(normalizeBlocks(crmBlocks));

      toast({
        title: "Newsletter Converted!",
        description: `Converted newsletter into ${crmBlocks.length} email blocks.`,
      });
    } catch (error) {
      console.error("❌ Newsletter conversion failed:", error);

      // Create fallback block so user isn't stuck
      const fallbackBlock: ContentBlock = {
        id: "fallback-block",
        type: "image-text",
        layout: "full-width",
        title: "Newsletter Content",
        content:
          "Your newsletter content will appear here. You can edit this block or add new ones below.",
        imageUrl: "",
        shouldFetchImage: true,
        isGeneratingImage: true,
        source: "manual",
      };

      setBlocks([fallbackBlock]);
      setCampaignName(title || "Newsletter Campaign");
      setSubjectLine("Your Newsletter Update");

      toast({
        title: "Conversion Issue",
        description:
          "Created a basic template. Please edit the content as needed.",
        variant: "destructive",
      });
    } finally {
      setConverting(false);
    }
  };

  const generateEmailHTML = useCallback((): string => {
    // Helper function to get granular fonts with fallback logic
    const getGranularFonts = () => {
      const defaultFont = {
        url: "https://fonts.googleapis.com/css2?family=Quicksand:wght@400;500;600;700&display=swap",
        css: "'Quicksand', sans-serif",
      };

      // Get each font type with fallback to selectedFont, then to Quicksand
      const headlineFont =
        (companyInfo?.headlineFont?.fontFamilyCss ||
          companyInfo?.selectedFont?.fontFamilyCss ||
          defaultFont.css) + ", Arial, sans-serif";
      const subheadingFont =
        (companyInfo?.subheadingFont?.fontFamilyCss ||
          companyInfo?.selectedFont?.fontFamilyCss ||
          defaultFont.css) + ", Arial, sans-serif";
      const bodyFont =
        (companyInfo?.bodyFont?.fontFamilyCss ||
          companyInfo?.selectedFont?.fontFamilyCss ||
          defaultFont.css) + ", Arial, sans-serif";
      const buttonFont =
        (companyInfo?.buttonFont?.fontFamilyCss ||
          companyInfo?.selectedFont?.fontFamilyCss ||
          defaultFont.css) + ", Arial, sans-serif";

      // Collect all unique font URLs for loading
      const fontUrls = [
        companyInfo?.headlineFont?.googleFontsUrl,
        companyInfo?.subheadingFont?.googleFontsUrl,
        companyInfo?.bodyFont?.googleFontsUrl,
        companyInfo?.buttonFont?.googleFontsUrl,
        companyInfo?.selectedFont?.googleFontsUrl,
      ].filter(
        (url, index, self) => url && self.indexOf(url) === index, // Remove duplicates and nulls
      );

      // If no fonts configured, use default
      if (fontUrls.length === 0) {
        fontUrls.push(defaultFont.url);
      }

      return {
        headlineFont,
        subheadingFont,
        bodyFont,
        buttonFont,
        fontUrls,
      };
    };

    const fonts = getGranularFonts();
    const emailContent = generateEmailContentWithStyles(fonts);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <!-- Force light mode in email clients to prevent dark mode color inversion -->
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <title>${subjectLine || "Email Campaign"}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  ${fonts.fontUrls.map((url) => `<link href="${url}" rel="stylesheet">`).join("\n  ")}
  <style>
    /* Force light color scheme - prevents email clients from inverting colors */
    :root { color-scheme: light only; }

    /* Dark mode protection - force header text to stay white */
    @media (prefers-color-scheme: dark) {
      .email-header-text { color: #ffffff !important; }
      h1, h2, h3 { color: inherit !important; }
    }

    /* Outlook dark mode protection */
    [data-ogsc], [data-ogsb] {
      color: inherit !important;
      background-color: inherit !important;
    }

    /* Gmail dark mode protection */
    u + .body .email-header-text { color: #ffffff !important; }

    ${fonts.fontUrls.map((url) => `@import url('${url}');`).join("\n    ")}

    /* Typography system with granular fonts */
    h1 { font-family: ${fonts.headlineFont}; }
    h2, h3 { font-family: ${fonts.subheadingFont}; }
    p, td, li, div { font-family: ${fonts.bodyFont}; }
    a.button, .cta-button { font-family: ${fonts.buttonFont}; }

    /* Reset and base styles */
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }

    /* Mobile responsive styles */
    @media only screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
        max-width: 100% !important;
      }
      .content-block {
        padding: 16px !important;
      }
      /* Enforce minimum readable font size on mobile */
      .content-block p,
      .content-block div,
      .content-block td,
      .content-block li {
        font-size: 16px !important;
        line-height: 1.5 !important;
      }
      .content-block h1 {
        font-size: 24px !important;
        line-height: 1.2 !important;
      }
      .content-block h2 {
        font-size: 20px !important;
        line-height: 1.3 !important;
      }
      /* Header/banner block mobile styles */
      .email-header-text {
        padding-left: 16px !important;
        padding-right: 16px !important;
      }
      .mobile-center {
        text-align: center !important;
      }
      .mobile-full-width {
        width: 100% !important;
        display: block !important;
        padding-left: 0 !important;
        padding-right: 0 !important;
        padding-bottom: 20px !important;
      }
      .mobile-full-width img {
        width: 100% !important;
        height: auto !important;
      }
      .mobile-stack table,
      .mobile-stack tbody,
      .mobile-stack tr,
      .mobile-stack td {
        display: block !important;
        width: 100% !important;
      }
      .mobile-stack td {
        padding-left: 0 !important;
        padding-right: 0 !important;
        padding-bottom: 20px !important;
      }
      /* Footer three-column to single-column stacking on mobile */
      .footer-column {
        display: block !important;
        width: 100% !important;
        text-align: center !important;
        padding: 12px 8px !important;
      }
      .footer-social {
        text-align: center !important;
        margin-top: 16px !important;
      }
      .cta-button {
        display: block !important;
        width: 90% !important;
        max-width: 300px !important;
        margin: 0 auto !important;
        padding: 12px 24px !important;
        font-size: 16px !important;
        text-align: center !important;
        box-sizing: border-box !important;
      }
      img {
        max-width: 100% !important;
        height: auto !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8f9fa; font-family: ${fonts.bodyFont};">
  ${emailContent}
</body>
</html>`;
  }, [blocks, subjectLine, senderConfig, companyInfo, footerSettings]);

  // Helper function to convert hex color + opacity to RGBA for email compatibility
  const hexToRgba = (hex: string, opacity: number): string => {
    const cleanHex = hex.replace("#", "");
    const r = parseInt(cleanHex.substr(0, 2), 16);
    const g = parseInt(cleanHex.substr(2, 2), 16);
    const b = parseInt(cleanHex.substr(4, 2), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  const generateEmailContentWithStyles = useCallback(
    (fonts: any): string => {
      // Fonts are now passed as parameter from generateEmailHTML

      // Helper to check if headline is a default block type label that should not be displayed
      const isBlockTypeLabel = (text: string | undefined): boolean => {
        if (!text) return false;
        const blockTypeLabels = [
          "Full-Width Image",
          "Background Image Section",
          "Background Image",
          "Image Left, Text Right",
          "Image Right, Text Left",
          "Two Column Layout",
          "Newsletter Header",
          "Untitled Block",
          "Untitled",
        ];
        return blockTypeLabels.includes(text.trim());
      };

      // Helper to check if block should hide all text content (headline and body)
      const shouldHideContent = (block: ContentBlock): boolean => {
        const hideContentTitles = [
          "Background Image",
          "Background Image Section",
          "Full-Width Image",
        ];
        return (
          hideContentTitles.includes(block.title?.trim() || "") ||
          hideContentTitles.includes(block.headline?.trim() || "")
        );
      };

      let html = `
      <div class="email-container" style="width: 100%; background: white;">
        <div class="content-block" style="padding: 30px 32px;">
    `;

      // Debug: Log any blocks with unsafe image URLs before rendering
      debugBlockImageUrls(blocks);

      let renderedBlockCount = 0;
      blocks.forEach((block) => {
        if (!block || block.visible === false) return; // Skip null/hidden blocks

        try {
        // CRITICAL: Sanitize all image URLs for email safety
        // Only allow https:// URLs from trusted sources (Supabase storage, Unsplash, etc.)
        const safeImageUrl = getEmailSafeImageUrl(block.imageUrl);
        const safeBackgroundImageUrl = getEmailSafeImageUrl(
          block.backgroundImageUrl,
        );

        // Image styling from block properties
        const imgBorderRadius = ({ none: '0px', soft: '8px', round: '16px', circle: '50%' } as Record<string, string>)[(block as any).imageBorderRadius] || '8px';
        const imgMaxWidth = ({ full: '100%', large: '80%', medium: '60%', small: '40%' } as Record<string, string>)[(block as any).imageMaxWidth] || '100%';

        // DEBUG: Log block data for newsletter-header blocks
        if (block.type === "newsletter-header" || block.type === "header") {
        }

        // Insert spacer between blocks (not before the first one)
        const htmlLenBefore = html.length;

        // CANONICAL: Use both headline and title as fallbacks for text display
        const blockHeadline = block.headline || block.title || "";
        const blockBody = block.body || block.content || "";

        switch (block.type) {
          case "header":
            const headerAlign = block.textAlign || "center";
            // Use shared opacity utility for WYSIWYG consistency with builder preview
            const headerOpacity = normalizeOpacityToDecimal(
              block.backgroundOpacity,
              OPACITY_DEFAULTS.colorOverlay,
            );
            const headerBgColor = block.backgroundColor || "#1f2937";
            // Use campaign name as fallback headline for header blocks
            const headerHeadline = blockHeadline || campaignName || "";

            // Header blocks should always show text — use company name as last-resort fallback
            const headerDisplayTitle = headerHeadline && !isBlockTypeLabel(headerHeadline)
              ? sanitizeCampaignTitle(headerHeadline)
              : (companyInfo?.companyName || campaignName || "");

            if (safeBackgroundImageUrl) {
              // Table-based layout with background image and RGBA overlay for email compatibility
              // Use nested div structure so overlay sits ON TOP of background image
              const overlayColor = hexToRgba(
                block.backgroundColor || "#000000",
                headerOpacity,
              );
              html += `
              <!--[if mso | IE]>
              <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td>
              <![endif]-->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="background-image: url(${safeBackgroundImageUrl}); background-size: cover; background-position: center;">
                    <!--[if gte mso 9]>
                    <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;">
                    <v:fill type="frame" src="${safeBackgroundImageUrl}" color="${headerBgColor}" />
                    <v:textbox style="mso-fit-shape-to-text:true" inset="0,0,0,0">
                    <![endif]-->
                    <!-- Overlay div sits on top of background image -->
                    <div style="background-color: ${overlayColor}; padding: 40px 24px; text-align: ${headerAlign};">
                      ${headerDisplayTitle ? `<h1 class="email-header-text" style="font-size: 34px; font-weight: 700; margin: 0 0 16px 0; font-family: ${fonts.headlineFont}; color: ${block.textColor || "#ffffff"} !important;">${headerDisplayTitle}</h1>` : ""}
                      ${blockBody ? `<div class="email-header-text" style="font-size: 18px; margin: 0; opacity: 0.9; font-family: ${fonts.bodyFont}; color: ${block.textColor || "#ffffff"} !important;">${blockBody}</div>` : ""}
                    </div>
                    <!--[if gte mso 9]>
                    </v:textbox>
                    </v:rect>
                    <![endif]-->
                  </td>
                </tr>
              </table>
              <!--[if mso | IE]>
              </td></tr></table>
              <![endif]-->
            `;
            } else {
              // Simple solid background
              html += `
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="background-color: ${headerBgColor}; padding: 40px 24px; text-align: ${headerAlign};">
                    ${headerDisplayTitle ? `<h1 class="email-header-text" style="font-size: 34px; font-weight: 700; margin: 0 0 16px 0; font-family: ${fonts.headlineFont}; color: ${block.textColor || "#ffffff"} !important;">${headerDisplayTitle}</h1>` : ""}
                    ${blockBody ? `<div class="email-header-text" style="font-size: 18px; margin: 0; opacity: 0.9; font-family: ${fonts.bodyFont}; color: ${block.textColor || "#ffffff"} !important;">${blockBody}</div>` : ""}
                  </td>
                </tr>
              </table>
            `;
            }
            break;

          // Email Safe Hero - two-column on desktop (text left, image right), stacked on mobile
          // Uses light neutral background (#f5f5f7) and near-black text (#111111) to prevent
          // dark mode inversion issues in email clients like Gmail mobile
          case "email-safe-hero":
            const safeHeroAlign = block.alignment || "left";
            const safeHeroBgColor = block.backgroundColor || "#f5f5f7";
            const safeHeroTextColor = block.textColor || "#111111";
            const safeHeroButtonColor =
              block.buttonColor || companyInfo?.brandPrimaryColor || "#22c55e";

            // Build text content column
            const safeHeroTextHtml = `
              ${block.eyebrow ? `<p style="font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0; color: ${safeHeroTextColor} !important; opacity: 0.6;">${block.eyebrow}</p>` : ""}
              ${blockHeadline && !isBlockTypeLabel(blockHeadline) ? `<h1 style="font-size: 34px; font-weight: 700; margin: 0 0 12px 0; font-family: ${fonts.headlineFont}; color: ${safeHeroTextColor} !important; line-height: 1.2;">${sanitizeCampaignTitle(blockHeadline)}</h1>` : ""}
              ${block.subtitle ? `<p style="font-size: 16px; margin: 0 0 8px 0; color: ${safeHeroTextColor} !important; opacity: 0.8; line-height: 1.5;">${block.subtitle}</p>` : ""}
              ${block.body ? `<div style="font-size: 16px; margin: 0 0 16px 0; color: ${safeHeroTextColor} !important; line-height: 1.6;">${block.body}</div>` : ""}
              ${block.publishDate ? `<p style="font-size: 12px; margin: 0 0 16px 0; color: ${safeHeroTextColor} !important; opacity: 0.6;">${new Date(block.publishDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>` : ""}
              ${block.ctaText && block.ctaUrl ? `
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top: 16px;">
                  <tr>
                    <td align="center" style="border-radius: 9999px; background: ${safeHeroButtonColor};">
                      <a href="${block.ctaUrl}" class="cta-button" style="display: inline-block; width: auto; padding: 12px 24px; background: ${safeHeroButtonColor}; color: #ffffff !important; text-decoration: none; border-radius: 9999px; font-weight: 600; font-family: ${fonts.buttonFont}; font-size: 14px;">${block.ctaText}</a>
                    </td>
                  </tr>
                </table>
              ` : ""}
            `;

            if (safeImageUrl) {
              // Two-column layout: text left (60%), image right (40%)
              html += `
              <!-- Email Safe Hero: Two-column desktop, stacked mobile -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: ${safeHeroBgColor};">
                <tr>
                  <td align="center" style="padding: 0;">
                    <!--[if mso]>
                    <table role="presentation" width="640" align="center" cellpadding="0" cellspacing="0" border="0"><tr>
                    <td width="384" valign="middle">
                    <![endif]-->
                    <div style="display: inline-block; width: 100%; max-width: 384px; vertical-align: middle;" class="mobile-full-width">
                      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                        <tr>
                          <td align="${safeHeroAlign}" style="padding: 32px 24px; font-family: ${fonts.bodyFont}; color: ${safeHeroTextColor} !important;">
                            ${safeHeroTextHtml}
                          </td>
                        </tr>
                      </table>
                    </div>
                    <!--[if mso]>
                    </td><td width="256" valign="middle">
                    <![endif]-->
                    <div style="display: inline-block; width: 100%; max-width: 256px; vertical-align: middle;" class="mobile-full-width">
                      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                        <tr>
                          <td align="center" style="padding: 16px;">
                            <img
                              src="${safeImageUrl}"
                              alt="${block.altText || blockHeadline || ""}"
                              style="display: block; width: 100%; max-width: 256px; height: auto; border: 0; outline: none; text-decoration: none; border-radius: 8px;"
                            />
                          </td>
                        </tr>
                      </table>
                    </div>
                    <!--[if mso]>
                    </td></tr></table>
                    <![endif]-->
                  </td>
                </tr>
              </table>
            `;
            } else {
              // No image — full-width text-only layout
              html += `
              <!-- Email Safe Hero: Text only (no image) -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: ${safeHeroBgColor};">
                <tr>
                  <td align="center" style="padding: 32px 16px; background-color: ${safeHeroBgColor};">
                    <table role="presentation" border="0" cellspacing="0" cellpadding="0" width="100%" style="max-width: 640px;">
                      <tr>
                        <td align="${safeHeroAlign}" style="font-family: ${fonts.bodyFont}; color: ${safeHeroTextColor} !important;">
                          ${safeHeroTextHtml}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            `;
            }
            break;

          // NEW: Graphic Hero - single clickable image (text baked in)
          case "graphic-hero":
            // Use empty alt if not provided (no "Untitled" or "Hero image" defaults)
            const graphicHeroAlt = block.altText || "";
            // Graphic hero images are always user-uploaded — fall back to original URL
            // if the safety check strips it (e.g. uncommon CDN domain)
            const graphicHeroImgUrl = safeImageUrl || block.imageUrl || "";

            if (graphicHeroImgUrl) {
              html += `
              <!-- Graphic Hero: Full-width clickable image -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 0;">
                    ${block.ctaUrl ? `<a href="${block.ctaUrl}" target="_blank" style="display: block;">` : ""}
                      <img
                        src="${graphicHeroImgUrl}"
                        alt="${graphicHeroAlt}"
                        style="display: block; width: 100%; max-width: 640px; border: 0; outline: none; text-decoration: none;"
                      />
                    ${block.ctaUrl ? `</a>` : ""}
                  </td>
                </tr>
              </table>
            `;
            } else {
              // No image at all — render a visible placeholder so the block isn't invisible
              html += `
              <!-- Graphic Hero: Missing image placeholder -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding: 40px 20px; background-color: #f1f5f9; border-radius: 8px;">
                    <p style="margin: 0; font-size: 14px; color: #94a3b8; font-family: sans-serif;">Add your graphic hero image</p>
                  </td>
                </tr>
              </table>
            `;
            }
            break;

          case "image":
            // Check if this is a two-column layout - if so, render like image-text
            const isImageTwoColumnLayout =
              block.layout === "two-column-left" ||
              block.layout === "two-column-right";

            if (isImageTwoColumnLayout) {
              // Render as two-column layout (same logic as image-text)
              const isImgLeft = block.layout === "two-column-left";
              const imgTcTextAlign = block.textAlign || "left";
              const imgTcTextColor = companyInfo?.brandTextColor || "#475569";
              const imgTcHeadlineColor =
                companyInfo?.brandTextColor || "#1f2937";
              const imgTcButtonColor =
                block.buttonColor ||
                companyInfo?.brandPrimaryColor ||
                "#22c55e";
              const imgTcCtaText = block.ctaText || block.buttonText;
              const imgTcCtaUrl = block.ctaUrl || block.buttonUrl;

              // If no image, render as text-only block
              if (!safeImageUrl) {
                html += `
                <div style="margin: 20px 0; padding: 20px; ${block.backgroundColor ? `background-color: ${block.backgroundColor};` : ""} border-radius: 8px; text-align: ${imgTcTextAlign};">
                  ${blockHeadline && !isBlockTypeLabel(blockHeadline) ? `<h2 style="font-size: 24px; font-weight: 600; margin: 0 0 16px 0; color: ${imgTcHeadlineColor}; font-family: ${fonts.subheadingFont};">${blockHeadline}</h2>` : ""}
                  ${blockBody ? `<div style="color: ${imgTcTextColor}; line-height: 1.6; margin: 0; font-family: ${fonts.bodyFont};">${blockBody}</div>` : ""}
                  ${
                    imgTcCtaText && imgTcCtaUrl
                      ? `
                    <div style="margin-top: 20px;">
                      <a href="${imgTcCtaUrl}" style="display: inline-block; padding: 12px 24px; background: ${imgTcButtonColor}; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-family: ${fonts.buttonFont};">
                        ${imgTcCtaText}
                      </a>
                    </div>
                  `
                      : ""
                  }
                </div>
              `;
              } else {
                // Build image cell HTML - USE SAFE URL
                let imgTcImageHtml = `<img src="${safeImageUrl}" alt="${block.altText || ""}" style="width: ${imgMaxWidth}; height: auto; border-radius: ${imgBorderRadius}; display: block;${imgMaxWidth !== '100%' ? ' margin: 0 auto;' : ''}" />`;

                // Build text content HTML
                let imgTcCleanBody = blockBody || "";
                imgTcCleanBody = imgTcCleanBody.replace(
                  /color:\s*#[0-9a-fA-F]{3,6};?/gi,
                  "",
                );
                imgTcCleanBody = imgTcCleanBody.replace(
                  /color:\s*rgb\([^)]+\);?/gi,
                  "",
                );
                imgTcCleanBody = imgTcCleanBody.replace(
                  /color:\s*rgba\([^)]+\);?/gi,
                  "",
                );

                const imgTcTextContentHtml = `
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                  <tr>
                    <td style="padding: 0; vertical-align: top;">
                      ${
                        blockHeadline && !isBlockTypeLabel(blockHeadline)
                          ? `
                        <h2 style="font-size: 24px; font-weight: 600; margin: 0 0 16px 0; color: ${imgTcHeadlineColor} !important; font-family: ${fonts.subheadingFont}; line-height: 1.3; display: block;">
                          ${blockHeadline}
                        </h2>
                      `
                          : ""
                      }
                      ${
                        imgTcCleanBody
                          ? `
                        <div style="color: ${imgTcTextColor} !important; line-height: 1.6; margin: 0 0 16px 0; font-family: ${fonts.bodyFont}; font-size: 16px; display: block;">
                          ${imgTcCleanBody}
                        </div>
                      `
                          : ""
                      }
                      ${
                        imgTcCtaText && imgTcCtaUrl
                          ? `
                        <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-top: 20px;">
                          <tr>
                            <td style="border-radius: 6px; background: ${imgTcButtonColor};">
                              <a href="${imgTcCtaUrl}" style="display: inline-block; padding: 12px 24px; background: ${imgTcButtonColor}; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600; font-family: ${fonts.buttonFont}; font-size: 16px;">
                                ${imgTcCtaText}
                              </a>
                            </td>
                          </tr>
                        </table>
                      `
                          : ""
                      }
                    </td>
                  </tr>
                </table>
              `;

                // Render with image and text in two-column layout
                html += `
                <div style="margin: 20px 0; padding: 20px; ${block.backgroundColor ? `background-color: ${block.backgroundColor};` : ""} border-radius: 8px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse: collapse;" class="mobile-stack">
                    <tr>
                      ${
                        isImgLeft
                          ? `
                        <td width="50%" style="display: inline-block; vertical-align: top; width: 50%; padding-right: 20px;" class="mobile-full-width mobile-stack">
                          ${imgTcImageHtml}
                        </td>
                        <td width="50%" style="display: inline-block; vertical-align: top; width: 50%; padding-left: 20px; text-align: left;" class="mobile-full-width mobile-stack">
                          ${imgTcTextContentHtml}
                        </td>
                      `
                          : `
                        <td width="50%" style="display: inline-block; vertical-align: top; width: 50%; padding-right: 20px; text-align: left;" class="mobile-full-width mobile-stack">
                          ${imgTcTextContentHtml}
                        </td>
                        <td width="50%" style="display: inline-block; vertical-align: top; width: 50%; padding-left: 20px;" class="mobile-full-width mobile-stack">
                          ${imgTcImageHtml}
                        </td>
                      `
                      }
                    </tr>
                  </table>
                </div>
              `;
              }
              break;
            }

            // Only render single-column image block if it has an imageUrl
            if (safeImageUrl) {

              const imgAlign = block.textAlign || "center";
              const imgTextColor = companyInfo?.brandTextColor || "#475569";
              const imgHeadlineColor = companyInfo?.brandTextColor || "#1f2937";
              const imgButtonColor =
                block.buttonColor ||
                companyInfo?.brandPrimaryColor ||
                "#22c55e";
              const imgCtaText = block.ctaText || block.buttonText;
              const imgCtaUrl = block.ctaUrl || block.buttonUrl;

              // Build image with overlay if configured - USE SAFE URL
              let imageHtml = "";
              if (
                block.overlayOpacity &&
                block.overlayOpacity > 0 &&
                block.overlayColor
              ) {
                // Use shared opacity utility for WYSIWYG consistency with builder preview
                const normalizedOverlayOpacity = normalizeOpacityToDecimal(
                  block.overlayOpacity,
                  OPACITY_DEFAULTS.colorOverlay,
                );
                const overlayRgba = hexToRgba(
                  block.overlayColor,
                  normalizedOverlayOpacity,
                );
                imageHtml = `
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; border-radius: 8px; overflow: hidden;">
                  <tr>
                    <td background="${safeImageUrl}" bgcolor="${block.overlayColor}" style="background-image: url('${safeImageUrl}'); background-size: cover; background-position: center; background-repeat: no-repeat; border-radius: 8px;">
                      <!--[if gte mso 9]>
                      <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px;">
                      <v:fill type="frame" src="${safeImageUrl}" color="${block.overlayColor}" opacity="${Math.round(normalizedOverlayOpacity * 65535)}" />
                      <v:textbox style="mso-fit-shape-to-text:true" inset="0,0,0,0">
                      <![endif]-->
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                            <td style="padding: 150px 20px; background-color: ${overlayRgba};">
                            ${block.caption ? `<p style="margin: 0; color: #ffffff; text-align: center; font-family: ${fonts.bodyFont};">${block.caption}</p>` : "&nbsp;"}
                          </td>
                        </tr>
                      </table>
                      <!--[if gte mso 9]>
                      </v:textbox>
                      </v:rect>
                      <![endif]-->
                    </td>
                  </tr>
                </table>
              `;
              } else {
                imageHtml = `<img src="${safeImageUrl}" alt="${block.altText || ""}" style="max-width: ${imgMaxWidth}; height: auto; border-radius: ${imgBorderRadius}; display: block;${imgMaxWidth !== '100%' ? ' margin: 0 auto;' : ''}" />`;
              }

              html += `
              <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                <tr>
                  <td style="padding-top: 16px; padding-bottom: 20px; text-align: ${imgAlign}; ${block.backgroundColor ? `background-color: ${block.backgroundColor}; padding: 16px 20px 20px 20px; border-radius: 8px;` : ""}">
                ${imageHtml}
                ${!shouldHideContent(block) && blockHeadline && !isBlockTypeLabel(blockHeadline) ? `<h2 style="font-size: 24px; font-weight: 600; margin: 16px 0; color: ${imgHeadlineColor}; font-family: ${fonts.subheadingFont}; text-align: ${imgAlign};">${blockHeadline}</h2>` : ""}
                ${!shouldHideContent(block) && blockBody ? `<div style="color: ${imgTextColor}; line-height: 1.6; margin: 0; font-family: ${fonts.bodyFont}; text-align: ${imgAlign};">${blockBody}</div>` : ""}
                ${
                  imgCtaText && imgCtaUrl
                    ? `
                  <div style="margin-top: 20px;">
                    <a href="${imgCtaUrl}" style="display: inline-block; padding: 12px 24px; background: ${imgButtonColor}; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-family: ${fonts.buttonFont};">
                      ${imgCtaText}
                    </a>
                  </div>
                `
                    : ""
                }
                  </td>
                </tr>
              </table>
            `;
            }
            break;

          case "image-text":
            const isImageLeft =
              block.layout === "image-left" ||
              block.layout === "two-column-left" ||
              !block.layout;
            const itTextAlign = block.textAlign || "left";
            // Use brand text color with fallbacks
            const itTextColor = companyInfo?.brandTextColor || "#475569";
            const itHeadlineColor = companyInfo?.brandTextColor || "#1f2937";
            const buttonColor =
              block.buttonColor || companyInfo?.brandPrimaryColor || "#22c55e";
            const ctaText = block.ctaText || block.buttonText;
            const ctaUrl = block.ctaUrl || block.buttonUrl;


            // If no safe image, render as text-only block
            if (!safeImageUrl) {
              html += `
              <div style="margin: 20px 0; padding: 20px; ${block.backgroundColor ? `background-color: ${block.backgroundColor};` : ""} border-radius: 8px; text-align: ${itTextAlign};">
                ${blockHeadline && !isBlockTypeLabel(blockHeadline) ? `<h2 style="font-size: 24px; font-weight: 600; margin: 0 0 16px 0; color: ${itHeadlineColor}; font-family: ${fonts.subheadingFont};">${blockHeadline}</h2>` : ""}
                ${blockBody ? `<div style="color: ${itTextColor}; line-height: 1.6; margin: 0; font-family: ${fonts.bodyFont};">${blockBody}</div>` : ""}
                ${
                  ctaText && ctaUrl
                    ? `
                  <div style="margin-top: 20px;">
                    <a href="${ctaUrl}" style="display: inline-block; padding: 12px 24px; background: ${buttonColor}; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-family: ${fonts.buttonFont};">
                      ${ctaText}
                    </a>
                  </div>
                `
                    : ""
                }
              </div>
            `;
            } else {
              // Build image cell HTML with overlay support
              let imageCellHtml = "";
              if (
                block.overlayOpacity &&
                block.overlayOpacity > 0 &&
                block.overlayColor
              ) {
                // Use shared opacity utility for WYSIWYG consistency with builder preview
                const normalizedOverlayOpacity = normalizeOpacityToDecimal(
                  block.overlayOpacity,
                  OPACITY_DEFAULTS.colorOverlay,
                );
                const overlayRgba = hexToRgba(
                  block.overlayColor,
                  normalizedOverlayOpacity,
                );
                // Use table with background and semi-transparent inner content for overlay - USE SAFE URL
                imageCellHtml = `
                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; border-radius: 8px; overflow: hidden; height: 100%;">
                  <tr>
                    <td background="${safeImageUrl}" bgcolor="${block.overlayColor}" style="background-image: url('${safeImageUrl}'); background-size: cover; background-position: center; background-repeat: no-repeat; border-radius: 8px; vertical-align: top;">
                      <!--[if gte mso 9]>
                      <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:100%;">
                      <v:fill type="frame" src="${safeImageUrl}" color="${block.overlayColor}" opacity="${Math.round(normalizedOverlayOpacity * 65535)}" />
                      <v:textbox style="mso-fit-shape-to-text:true" inset="0,0,0,0">
                      <![endif]-->
                      <div style="min-height: 250px; background-color: ${overlayRgba};">&nbsp;</div>
                      <!--[if gte mso 9]>
                      </v:textbox>
                      </v:rect>
                      <![endif]-->
                    </td>
                  </tr>
                </table>
              `;
              } else {
                imageCellHtml = `<img src="${safeImageUrl}" alt="${block.altText || ""}" style="width: ${imgMaxWidth}; height: auto; border-radius: ${imgBorderRadius}; display: block;${imgMaxWidth !== '100%' ? ' margin: 0 auto;' : ''}" />`;
              }

              // Build text content HTML with proper table structure for email compatibility
              // Strip any inline color styles from body content and force dark colors
              let cleanBody = blockBody || "";
              // Remove any color styles from the body content
              cleanBody = cleanBody.replace(
                /color:\s*#[0-9a-fA-F]{3,6};?/gi,
                "",
              );
              cleanBody = cleanBody.replace(/color:\s*rgb\([^)]+\);?/gi, "");
              cleanBody = cleanBody.replace(/color:\s*rgba\([^)]+\);?/gi, "");
              cleanBody = cleanBody.replace(/color:\s*white;?/gi, "");
              cleanBody = cleanBody.replace(/color:\s*#fff;?/gi, "");
              cleanBody = cleanBody.replace(/color:\s*#ffffff;?/gi, "");

              const textContentHtml = `
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
                <tr>
                  <td style="padding: 0; vertical-align: top;">
                    ${
                      blockHeadline && !isBlockTypeLabel(blockHeadline)
                        ? `
                      <h2 style="font-size: 24px; font-weight: 600; margin: 0 0 16px 0; color: ${itHeadlineColor} !important; font-family: ${fonts.subheadingFont}; line-height: 1.3; display: block;">
                        ${blockHeadline}
                      </h2>
                    `
                        : ""
                    }
                    ${
                      cleanBody
                        ? `
                      <div style="color: ${itTextColor} !important; line-height: 1.6; margin: 0 0 16px 0; font-family: ${fonts.bodyFont}; font-size: 16px; display: block;">
                        ${cleanBody}
                      </div>
                    `
                        : ""
                    }
                    ${
                      ctaText && ctaUrl
                        ? `
                      <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-top: 20px;">
                        <tr>
                          <td style="border-radius: 6px; background: ${buttonColor};">
                            <a href="${ctaUrl}" style="display: inline-block; padding: 12px 24px; background: ${buttonColor}; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600; font-family: ${fonts.buttonFont}; font-size: 16px;">
                              ${ctaText}
                            </a>
                          </td>
                        </tr>
                      </table>
                    `
                        : ""
                    }
                  </td>
                </tr>
              </table>
            `;

              // Render with image and text in two-column layout using mobile-responsive table structure
              html += `
              <div style="margin: 20px 0; padding: 20px; ${block.backgroundColor ? `background-color: ${block.backgroundColor};` : ""} border-radius: 8px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse: collapse;" class="mobile-stack">
                  <tr>
                    ${
                      isImageLeft
                        ? `
                      <td width="50%" style="display: inline-block; vertical-align: top; width: 50%; padding-right: 20px;" class="mobile-full-width mobile-stack">
                        ${imageCellHtml}
                      </td>
                      <td width="50%" style="display: inline-block; vertical-align: top; width: 50%; padding-left: 20px; text-align: left;" class="mobile-full-width mobile-stack">
                        ${textContentHtml}
                      </td>
                    `
                        : `
                      <td width="50%" style="display: inline-block; vertical-align: top; width: 50%; padding-right: 20px; text-align: left;" class="mobile-full-width mobile-stack">
                        ${textContentHtml}
                      </td>
                      <td width="50%" style="display: inline-block; vertical-align: top; width: 50%; padding-left: 20px;" class="mobile-full-width mobile-stack">
                        ${imageCellHtml}
                      </td>
                    `
                    }
                  </tr>
                </table>
              </div>
            `;
            }
            break;

          case "button":
            const btnAlign = block.textAlign || "center";
            html += `
             <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
               <tr>
                 <td style="padding: 16px 0 24px 0; text-align: ${btnAlign};">
                   ${blockHeadline ? `<h3 style="color: ${block.textColor || companyInfo?.brandTextColor || "#1f2937"}; margin: 0 0 10px 0; font-size: 20px; font-family: ${fonts.subheadingFont}; font-weight: 600;">${blockHeadline}</h3>` : ""}
                   ${blockBody ? `<div style="color: ${companyInfo?.brandTextColor || "#64748b"}; margin: 0 0 20px 0; line-height: 1.6; font-family: ${fonts.bodyFont};">${blockBody}</div>` : ""}
                   <table cellpadding="0" cellspacing="0" border="0" role="presentation" ${btnAlign === "center" ? 'align="center"' : ""} style="margin: 0 auto;">
                     <tr>
                       <td align="center" style="border-radius: 6px; background: ${block.buttonColor || companyInfo?.brandPrimaryColor || "#22c55e"}; text-align: center;">
                         <a href="${block.buttonUrl || "#"}" class="cta-button" style="display: inline-block; width: auto; padding: 12px 24px; background: ${block.buttonColor || companyInfo?.brandPrimaryColor || "#22c55e"}; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-family: ${fonts.buttonFont}; text-align: center;">
                           ${block.buttonText || "Learn More"}
                         </a>
                       </td>
                     </tr>
                   </table>
                 </td>
               </tr>
             </table>
          `;
            break;

          case "divider":
            const divColor = block.textColor || "#e2e8f0";
            const divStyle = (typeof block.content === "string" && block.content) || "solid";
            const divThickness = block.dividerThickness || 1;
            const divSpacingMap: Record<string, string> = { none: "0", small: "8px", medium: "16px", large: "32px" };
            const divSpacing = divSpacingMap[block.margin || "medium"] || "16px";
            html += `
            <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
              <tr>
                <td style="padding: ${divSpacing} 0;">
                  ${divStyle !== "space" ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
                    <tr>
                      <td style="border-top: ${divThickness}px ${divStyle} ${divColor}; font-size: 0; line-height: 0;">&nbsp;</td>
                    </tr>
                  </table>` : ""}
                </td>
              </tr>
            </table>
          `;
            break;

          case "social-follow":
            // SKIP: Social follow blocks should not render in email HTML
            // The server-side footer now handles all social links
            // This prevents duplicate social icons in sent emails
            break;

          case "newsletter-header":
            // DEBUG: Log overlay values for newsletter-header blocks

            const nhTextColor = block.textColor || "#ffffff";
            const nhBackgroundColor = block.backgroundColor || "#1f2937";
            // Use shared opacity utility for WYSIWYG consistency with preview
            const nhColorOverlayOpacity = normalizeOpacityToDecimal(
              block.colorOverlayOpacity,
              OPACITY_DEFAULTS.colorOverlay,
            );
            const nhDarkOverlayOpacity = normalizeOpacityToDecimal(
              block.darkOverlayOpacity,
              OPACITY_DEFAULTS.darkOverlay,
            );
            const nhTextAlign = block.textAlign || "center";


            // Use campaign name then company name as fallback headline for newsletter-header blocks
            const nhHeadline =
              block.title || block.headline || campaignName || companyInfo?.companyName || "";

            // Format publish date if exists
            let formattedDate = "";
            if (block.publishDate) {
              try {
                const date = new Date(block.publishDate);
                formattedDate = date.toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                });
              } catch (e) {
                formattedDate = block.publishDate;
              }
            }

            // Sanitize newsletter-header background image URL for email safety
            const safeNhBackgroundUrl = getEmailSafeImageUrl(
              block.backgroundImageUrl,
            );

            if (safeNhBackgroundUrl) {
              // Table-based layout with nested tables for multiple overlays (color + dark) for email compatibility
              const colorOverlay = hexToRgba(
                nhBackgroundColor,
                nhColorOverlayOpacity,
              );
              const darkOverlay =
                nhDarkOverlayOpacity > 0
                  ? hexToRgba("#000000", nhDarkOverlayOpacity)
                  : "";

              // Combine overlays using linear-gradient for better email client support
              const combinedOverlay = darkOverlay
                ? `linear-gradient(${darkOverlay}, ${darkOverlay}), linear-gradient(${colorOverlay}, ${colorOverlay})`
                : `linear-gradient(${colorOverlay}, ${colorOverlay})`;

              html += `
              <!--[if mso | IE]>
              <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td>
              <![endif]-->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0; border-radius: 8px; overflow: hidden; min-height: 300px;">
                <tr>
                  <td style="background-image: ${combinedOverlay}, url(${safeNhBackgroundUrl}); background-size: cover; background-position: center; padding: 60px 20px; text-align: ${nhTextAlign};">
                    <!--[if gte mso 9]>
                    <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:600px; height:300px;">
                    <v:fill type="frame" src="${safeNhBackgroundUrl}" color="${nhBackgroundColor}" opacity="${nhColorOverlayOpacity * 100}%" />
                    <v:textbox style="mso-fit-shape-to-text:true" inset="0,0,0,0">
                    <![endif]-->
                    <div>
                      ${nhHeadline ? `<h1 class="email-header-text" style="font-size: 42px; font-weight: 700; margin: 0 0 16px 0; font-family: ${fonts.headlineFont}; color: ${nhTextColor} !important; line-height: 1.2;">${nhHeadline}</h1>` : ""}
                      ${block.subtitle ? `<p class="email-header-text" style="font-size: 20px; margin: 0 0 24px 0; font-family: ${fonts.subheadingFont}; color: ${nhTextColor} !important; line-height: 1.4;">${block.subtitle}</p>` : ""}
                      ${
                        block.issueNumber || formattedDate
                          ? `
                        <div style="margin: 16px 0;">
                          ${block.issueNumber ? `<span class="email-header-text" style="color: ${nhTextColor} !important; font-size: 16px; font-family: ${fonts.bodyFont}; margin-right: 20px;">Issue #${block.issueNumber}</span>` : ""}
                          ${formattedDate ? `<span class="email-header-text" style="color: ${nhTextColor} !important; font-size: 16px; font-family: ${fonts.bodyFont};">${formattedDate}</span>` : ""}
                        </div>
                      `
                          : ""
                      }
                      ${
                        (block.ctaText || block.buttonText) &&
                        (block.ctaUrl || block.buttonUrl)
                          ? `
                        <table cellpadding="0" cellspacing="0" border="0" ${nhTextAlign === "center" ? 'align="center"' : ""} style="margin-top: 32px;">
                          <tr>
                            <td style="background-color: ${block.buttonColor || companyInfo?.brandPrimaryColor || "#22c55e"}; border-radius: 6px; padding: 14px 32px;">
                              <a href="${block.ctaUrl || block.buttonUrl}" style="display: inline-block; color: white; text-decoration: none; font-weight: 600; font-size: 16px; font-family: ${fonts.buttonFont};">
                                ${block.ctaText || block.buttonText}
                              </a>
                            </td>
                          </tr>
                        </table>
                      `
                          : ""
                      }
                    </div>
                    <!--[if gte mso 9]>
                    </v:textbox>
                    </v:rect>
                    <![endif]-->
                  </td>
                </tr>
              </table>
              <!--[if mso | IE]>
              </td></tr></table>
              <![endif]-->
            `;
            } else {
              // Simple solid background without image
              html += `
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="background-color: ${nhBackgroundColor}; padding: 60px 20px; text-align: ${nhTextAlign}; min-height: 300px;">
                    ${nhHeadline ? `<h1 class="email-header-text" style="font-size: 42px; font-weight: 700; margin: 0 0 16px 0; font-family: ${fonts.headlineFont}; color: ${nhTextColor} !important; line-height: 1.2;">${nhHeadline}</h1>` : ""}
                    ${block.subtitle ? `<p class="email-header-text" style="font-size: 20px; margin: 0 0 24px 0; font-family: ${fonts.subheadingFont}; color: ${nhTextColor} !important; line-height: 1.4;">${block.subtitle}</p>` : ""}
                    ${
                      block.issueNumber || formattedDate
                        ? `
                      <div style="margin: 16px 0;">
                        ${block.issueNumber ? `<span class="email-header-text" style="color: ${nhTextColor} !important; font-size: 16px; font-family: ${fonts.bodyFont}; margin-right: 20px;">Issue #${block.issueNumber}</span>` : ""}
                        ${formattedDate ? `<span class="email-header-text" style="color: ${nhTextColor} !important; font-size: 16px; font-family: ${fonts.bodyFont};">${formattedDate}</span>` : ""}
                      </div>
                    `
                        : ""
                    }
                    ${
                      (block.ctaText || block.buttonText) &&
                      (block.ctaUrl || block.buttonUrl)
                        ? `
                      <table cellpadding="0" cellspacing="0" border="0" ${nhTextAlign === "center" ? 'align="center"' : ""} style="margin-top: 32px;">
                        <tr>
                          <td style="background-color: ${block.buttonColor || companyInfo?.brandPrimaryColor || "#22c55e"}; border-radius: 6px; padding: 14px 32px;">
                            <a href="${block.ctaUrl || block.buttonUrl}" style="display: inline-block; color: white; text-decoration: none; font-weight: 600; font-size: 16px; font-family: ${fonts.buttonFont};">
                              ${block.ctaText || block.buttonText}
                            </a>
                          </td>
                        </tr>
                      </table>
                    `
                        : ""
                    }
                  </td>
                </tr>
              </table>
            `;
            }
            break;

          case "image-gallery":
            // Check if this is a product gallery (has galleryItems) or image gallery (has galleryImages)
            const galleryItems = (block as any).galleryItems || [];
            const galleryImages = (block as any).galleryImages || [];

            if (galleryItems.length > 0) {
              // Product Gallery Mode (2x2 grid with badges)
              const productHeadline = block.headline || block.title || "";
              const productBody = block.body || block.content || "";
              const productCtaText = block.ctaText || block.buttonText || "";
              const productCtaUrl = block.ctaUrl || block.buttonUrl || "";
              const brandColor = "#8B4B5C"; // Dusty rose
              const bgColor = "#FAF9F6"; // Warm cream

              // Limit to 4 items for 2x2 grid
              const items = galleryItems.slice(0, 4);

              // Build product cards HTML (2 per row for email compatibility)
              let productRowsHtml = "";
              for (let i = 0; i < items.length; i += 2) {
                const item1 = items[i];
                const item2 = items[i + 1];

                const buildProductCard = (item: any) => {
                  if (!item)
                    return '<td class="product-cell" width="50%" style="padding: 8px;"></td>';

                  // Sanitize gallery item image URL for email safety
                  const safeGalleryItemUrl = getEmailSafeImageUrl(
                    item.imageUrl,
                  );

                  const badgeHtml = item.badgeText
                    ? `
                  <div style="position: absolute; top: 8px; right: 8px; background-color: ${brandColor}; color: #ffffff; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 600;">
                    ${item.badgeText}
                  </div>
                `
                    : "";

                  const linkStart = item.url
                    ? `<a href="${item.url}" style="text-decoration: none; color: inherit;">`
                    : "";
                  const linkEnd = item.url ? "</a>" : "";

                  return `
                  <td class="product-cell" width="50%" style="padding: 8px; vertical-align: top;">
                    ${linkStart}
                    <div style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                      <div style="position: relative;">
                        ${
                          safeGalleryItemUrl
                            ? `
                          <img src="${safeGalleryItemUrl}" alt="${item.title || "Product"}" style="width: 100%; height: auto; aspect-ratio: 1; object-fit: cover; display: block;" />
                        `
                            : `
                          <div style="width: 100%; padding-top: 100%; background-color: #f3f4f6;"></div>
                        `
                        }
                        ${badgeHtml}
                      </div>
                      ${
                        item.title
                          ? `
                        <div style="padding: 16px; text-align: center;">
                          <p style="margin: 0; font-size: 12px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; color: #374151; font-family: ${fonts.bodyFont};">
                            ${item.title}
                          </p>
                        </div>
                      `
                          : ""
                      }
                    </div>
                    ${linkEnd}
                  </td>
                `;
                };

                productRowsHtml += `
                <tr>
                  ${buildProductCard(item1)}
                  ${buildProductCard(item2)}
                </tr>
              `;
              }

              html += `
              <style>
                @media only screen and (max-width: 480px) {
                  .product-cell {
                    width: 100% !important;
                    display: block !important;
                  }
                }
              </style>
              <div style="background-color: ${bgColor}; padding: 32px 16px; margin: 20px 0; border-radius: 8px;">
                <div style="width: 100%;">
                  ${
                    productHeadline
                      ? `
                    <h2 style="font-size: 28px; font-weight: 700; text-align: center; margin: 0 0 8px 0; color: ${companyInfo?.brandTextColor || "#1f2937"}; font-family: ${fonts.headlineFont};">
                      ${productHeadline}
                    </h2>
                  `
                      : ""
                  }
                  ${
                    productBody
                      ? `
                    <p style="font-size: 16px; text-align: center; margin: 0 0 24px 0; color: ${companyInfo?.brandTextColor || "#6b7280"}; font-family: ${fonts.bodyFont};">
                      ${productBody}
                    </p>
                  `
                      : ""
                  }

                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                    ${productRowsHtml}
                  </table>

                  ${
                    productCtaText && productCtaUrl
                      ? `
                    <div style="text-align: center; margin-top: 32px;">
                      <a href="${productCtaUrl}" style="display: inline-block; padding: 14px 32px; background-color: ${brandColor}; color: #ffffff; text-decoration: none; border-radius: 999px; font-weight: 600; font-size: 16px; font-family: ${fonts.buttonFont};">
                        ${productCtaText}
                      </a>
                    </div>
                  `
                      : ""
                  }
                </div>
              </div>
            `;
            } else if (galleryImages.length > 0) {
              // Standard Image Gallery Mode (3/6/9 images)
              const galleryHeadline = block.headline || block.title || "";
              const galleryBody = block.body || block.content || "";
              const galleryCtaText = block.ctaText || block.buttonText || "";
              const galleryCtaUrl = block.ctaUrl || block.buttonUrl || "";

              // Build image grid (3 per row)
              let imageRowsHtml = "";
              for (let i = 0; i < galleryImages.length; i += 3) {
                const row = galleryImages.slice(i, i + 3);
                const cellWidth = Math.floor(100 / 3);

                imageRowsHtml += '<tr class="gallery-row">';
                for (let j = 0; j < 3; j++) {
                  const img = row[j];
                  // Sanitize gallery image URL for email safety
                  const safeGalleryImageUrl = getEmailSafeImageUrl(img?.url);
                  if (safeGalleryImageUrl) {
                    imageRowsHtml += `
                    <td class="gallery-cell" width="${cellWidth}%" style="padding: 4px; vertical-align: top;">
                      <img src="${safeGalleryImageUrl}" alt="${img.alt || "Gallery image"}" style="width: 100%; aspect-ratio: 4/3; object-fit: cover; border-radius: 8px; display: block;" />
                    </td>
                  `;
                  } else {
                    imageRowsHtml += `<td class="gallery-cell" width="${cellWidth}%" style="padding: 4px;"></td>`;
                  }
                }
                imageRowsHtml += "</tr>";
              }

              html += `
              <style>
                @media only screen and (max-width: 480px) {
                  .gallery-cell {
                    width: 100% !important;
                    display: block !important;
                    padding: 8px 4px !important;
                  }
                  .gallery-row {
                    display: block !important;
                  }
                }
              </style>
              <div style="padding: 24px 16px; margin: 20px 0;">
                ${
                  galleryHeadline
                    ? `
                  <h2 style="font-size: 24px; font-weight: 600; text-align: center; margin: 0 0 8px 0; color: #1f2937; font-family: ${fonts.headlineFont};">
                    ${galleryHeadline}
                  </h2>
                `
                    : ""
                }
                ${
                  galleryBody
                    ? `
                  <p style="font-size: 16px; text-align: center; margin: 0 0 24px 0; color: #6b7280; font-family: ${fonts.bodyFont};">
                    ${galleryBody}
                  </p>
                `
                    : ""
                }

                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                  ${imageRowsHtml}
                </table>

                ${
                  galleryCtaText && galleryCtaUrl
                    ? `
                  <div style="text-align: center; margin-top: 24px;">
                    <a href="${galleryCtaUrl}" style="display: inline-block; padding: 12px 24px; background-color: ${companyInfo?.brandPrimaryColor || "#22c55e"}; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-family: ${fonts.buttonFont};">
                      ${galleryCtaText}
                    </a>
                  </div>
                `
                    : ""
                }
              </div>
            `;
            }
            break;

          case "footer":
            // Footer rendering is handled separately at the end of the function
            // This case is just for the switch statement - actual footer HTML is added below
            break;
        }

        // Add spacer between blocks if this block emitted HTML
        if (html.length > htmlLenBefore) {
          renderedBlockCount++;
          // Spacer row: reliable in all email clients including Outlook
          html += `
          <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation">
            <tr><td style="height: 8px; font-size: 8px; line-height: 8px;">&nbsp;</td></tr>
          </table>`;
        }
        } catch (blockErr) {
          console.error(`[EMAIL-HTML] Block ${block.id} (${block.type}) failed to render:`, blockErr);
        }
      });

      // IMPORTANT: Do NOT generate footer here - the server-side edge function
      // (send-test-email, send-email-campaign) will generate the footer with
      // correct PNG social icons. This prevents duplicate footers.

      html += `
        </div>
      </div>
    `;

      return html;
    },
    [blocks, senderConfig, companyInfo, footerSettings, campaignOverrides],
  );

  const handleSave = async () => {

    if (!campaignName.trim() || !subjectLine.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide both a campaign name and subject line.",
        variant: "destructive",
      });
      return;
    }


    setLoading(true);
    setSaveError(false);

    try {
      if (existingCampaignId) {
        // Update existing campaign

        await autoSaveCampaign({
          blocks,
          campaign_name: campaignName,
          subject_line: subjectLine,
          preheader: preheaderText,
        });

        // Ensure audience selection is persisted as part of an explicit Save.
        await persistCampaignAudienceToDb(existingCampaignId);


        toast({
          title: "Campaign Updated!",
          description: "Your email campaign has been updated successfully.",
        });
      } else {
        // Create new campaign

        // Generate HTML content for the campaign
        const htmlContent = generateEmailHTML();

        // Convert blocks to the format expected by the campaign service
        const campaignBlocks = blocks.map((block, index) => ({
          block_type: block.type as
            | "header"
            | "text"
            | "image"
            | "button"
            | "divider",
          content: {
            headline: block.headline,
            body: block.body,
            content: block.content,
            layout: block.layout,
            imageUrl: block.imageUrl,
            altText: block.altText,
            buttonText: block.buttonText,
            buttonUrl: block.buttonUrl,
            buttonColor: block.buttonColor,
            backgroundColor: block.backgroundColor,
            textAlign: block.textAlign,
            fontSize: block.fontSize,
            fontFamily: block.fontFamily,
          },
          image_url: block.imageUrl,
          cta_url: block.buttonUrl,
          cta_text: block.buttonText,
          source: block.source || "manual",
          order_index: index,
        }));

        // Prepare campaign data for saving
        const campaignData: CampaignData = {
          name: campaignName,
          subject: subjectLine,
          sender_name: senderConfig?.displayName || "BloomSuite",
          sender_email: senderConfig?.senderEmail || "",
          from_email_domain_id: senderConfig?.fromEmailDomainId || null,
          content: htmlContent,
          preheader: preheaderText,
          // Persist segments to DB so refresh doesn't revert to "All Contacts"
          segments: (selectedSegments || []).filter((s: any) =>
            isUuidLike(String(s?.id || "")),
          ),
          schedule: {
            type: "immediate",
          },
          content_blocks: campaignBlocks,
          newsletter_sync: finalContentTaskId
            ? {
                source_task_id: finalContentTaskId,
                sync_status: "synced",
                original_blocks_count: blocks.length,
              }
            : undefined,
        };


        // Save campaign using the service
        const result = await saveCampaignAsDraft(campaignData);

        // Persist personas + join tables (service currently handles segments only).
        await persistCampaignAudienceToDb(result.id);


        toast({
          title: "Campaign Created!",
          description: "Your email campaign has been saved as a draft.",
        });
      }

      setLastSaved(new Date());

      // Navigate back to campaigns list
      navigate("/crm/campaigns");
    } catch (error) {
      console.error("❌ Error saving campaign:", error);
      setSaveError(true);

      toast({
        title: "Save Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to save campaign. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const scheduleTriggeredConfirmationRef = useRef(false);

  const openSendConfirmation = useCallback(
    async (origin: "send" | "schedule") => {
      scheduleTriggeredConfirmationRef.current = origin === "schedule";

      // Validate required fields
      if (!campaignName.trim()) {
        toast({
          title: "Campaign name required",
          description: "Please enter a campaign name before sending.",
          variant: "destructive",
        });
        if (origin === "schedule") {
          skipNextSchedulePersistRef.current = true;
          setSchedule({ type: "now" });
        }
        return;
      }

      if (!subjectLine.trim()) {
        toast({
          title: "Subject line required",
          description: "Please enter a subject line before sending.",
          variant: "destructive",
        });
        if (origin === "schedule") {
          skipNextSchedulePersistRef.current = true;
          setSchedule({ type: "now" });
        }
        return;
      }

      // Sender config can briefly be unavailable while tenant/user context hydrates.
      // Avoid opening the SenderVerificationModal in that window (it causes a two-click send).
      if (loadingSenderConfig || !senderConfig) {
        if (!pendingSendFlow) {
          setPendingSendFlow(true);
          toast({
            title: "Loading sender settings",
            description:
              "Please wait a moment while we load your email sending configuration.",
          });
          // Best-effort refresh; hook will also re-run when tenant/user becomes available.
          refetchSenderConfig();
        }
        return;
      }

      // Campaigns must use an operational custom domain (no fallback senders)
      if (!senderConfig?.isVerified || !senderConfig?.senderEmail) {
        setShowSenderConfirmation(true);
        return;
      }

      // Show the send confirmation modal with audience summary
      setShowSendConfirmation(true);
    },
    [
      campaignName,
      subjectLine,
      loadingSenderConfig,
      senderConfig,
      pendingSendFlow,
      refetchSenderConfig,
      toast,
    ],
  );

  const handleSendCampaign = async () => {
    await openSendConfirmation("send");
  };

  const handleScheduleChange = useCallback(
    (newSchedule: ScheduleOption) => {
      setSchedule(newSchedule);

      if (newSchedule.type === "scheduled" && newSchedule.date) {
        void openSendConfirmation("schedule");
      }
    },
    [openSendConfirmation],
  );

  // If the user clicked Send while sender config was still loading, automatically
  // continue the flow once senderConfig becomes available.
  useEffect(() => {
    if (!pendingSendFlow) return;
    if (loadingSenderConfig) return;
    if (!senderConfig) return;

    setPendingSendFlow(false);

    if (!senderConfig.isVerified || !senderConfig.senderEmail) {
      setShowSenderConfirmation(true);
      return;
    }

    void openSendConfirmation("send");
  }, [
    pendingSendFlow,
    loadingSenderConfig,
    senderConfig,
    openSendConfirmation,
  ]);

  const proceedWithSending = async () => {
    try {
      setSending(true);

      if (!senderConfig?.isVerified || !senderConfig?.senderEmail) {
        toast({
          title: "Custom domain required",
          description: "Verify a sending domain before sending campaigns.",
          variant: "destructive",
        });
        setShowSenderConfirmation(true);
        return;
      }

      // Pre-flight validation
      if (!blocks || blocks.length === 0) {
        toast({
          title: "No content",
          description:
            "Please add content blocks to your email before sending.",
          variant: "destructive",
        });
        return;
      }

      const campaignData: CampaignData = {
        id: existingCampaignId || undefined, // CRITICAL: Pass existing ID to UPDATE instead of creating duplicate
        name: campaignName,
        subject: subjectLine,
        sender_name: senderConfig?.displayName || "Garden Center",
        sender_email: senderConfig?.senderEmail || "",
        from_email_domain_id: senderConfig?.fromEmailDomainId || null,
        content: generateEmailHTML(),
        preheader: preheaderText,
        // Only persist DB-safe segment IDs (UUIDs) to FK-backed storage.
        segments: (selectedSegments || []).filter((s: any) =>
          isUuidLike(String(s?.id || "")),
        ),
        schedule:
          schedule.type === "scheduled"
            ? { type: "scheduled", send_at: schedule.date?.toISOString() }
            : { type: "immediate" },
        content_blocks: blocks,
      };

      // Step 1: Save as draft
      let campaign;
      try {
        campaign = await saveCampaignAsDraft(campaignData);
        if (!campaign?.id) {
          throw new Error("Campaign save returned no ID");
        }

        // If this was a brand-new campaign, persist the ID in state + URL so refresh can reload
        // the scheduled status (and other campaign data) from the database.
        if (!existingCampaignId) {
          setExistingCampaignId(campaign.id);
          navigate(`/crm/campaigns/${campaign.id}`, { replace: true });
        }
      } catch (saveError: any) {
        console.error("❌ Campaign save failed:", saveError);
        toast({
          title: "Failed to save campaign",
          description:
            saveError.message ||
            "Could not save your campaign. Please try again.",
          variant: "destructive",
        });
        return;
      }

      // If the user chose a scheduled send, persist the schedule and exit.
      // (Do NOT invoke the send edge function for scheduled campaigns.)
      if (schedule.type === "scheduled" && schedule.date) {

        const success = await updateCampaignSchedule(
          campaign.id,
          schedule.date.toISOString(),
          schedule.timezone,
          {
            silent: true,
            onFailureMessage: (message) => {
              if (isScheduleLockedMessage(message)) {
                openLockedScheduleDialog({
                  message,
                  desiredSchedule: {
                    date: schedule.date as Date,
                    timezone: schedule.timezone,
                  },
                });
                return;
              }

              toast({
                title: "Schedule not saved",
                description: message,
                variant: "destructive",
              });
            },
          },
        );

        if (success) {
          skipNextSchedulePersistRef.current = true;
          setCampaignStatus("scheduled");
          setScheduledAt(schedule.date.toISOString());
          toast({
            title: "Campaign scheduled",
            description:
              "Your campaign is scheduled and will send at the chosen time.",
          });
        }

        return;
      }

      // Step 2: Send via edge function
      const { data: sendResult, error: sendError } =
        await supabase.functions.invoke("send-email-campaign", {
          body: { campaignId: campaign.id },
        });

      // Handle edge function errors
      if (sendError) {
        console.error("❌ Edge function error:", sendError);

        const contextBody = (sendError as any)?.context?.body;
        let parsedBody: any = undefined;

        if (typeof contextBody === "string" && contextBody.length > 0) {
          try {
            parsedBody = JSON.parse(contextBody);
          } catch {
            parsedBody = { error: contextBody };
          }
        } else if (contextBody && typeof contextBody === "object") {
          parsedBody = contextBody;
        }

        const extractedMessage =
          typeof parsedBody?.error === "string"
            ? parsedBody.error
            : typeof parsedBody?.message === "string"
              ? parsedBody.message
              : "";

        throw new Error(
          extractedMessage ||
            sendError.message ||
            "Failed to invoke email service",
        );
      }

      // Handle error responses from edge function
      if (sendResult?.error) {
        console.error("❌ Send result error:", sendResult.error, sendResult);
        throw new Error(sendResult.error);
      }

      const sentCount = sendResult?.metrics?.sent || 0;

      toast({
        title: "Campaign sent!",
        description: `Your campaign "${campaignName}" has been sent to ${sentCount} customers. View analytics to see delivery progress.`,
      });

      // Navigate to campaign analytics
      navigate(`/crm/campaigns/${campaign.id}/analytics`);
    } catch (error: any) {
      console.error("❌ Send failed:", error);

      // Parse error message for user-friendly display
      const errorMsg = error.message || "";
      let title = "Send failed";
      let description =
        "There was an error sending your campaign. Please try again.";

      if (
        errorMsg.includes("Email service not configured") ||
        errorMsg.includes("RESEND")
      ) {
        title = "Email service unavailable";
        description =
          "The email service is not configured. Please contact support.";
      } else if (
        errorMsg.includes("No opted-in recipients") ||
        errorMsg.includes("not opted in")
      ) {
        title = "No eligible recipients";
        description =
          "No customers in your audience have opted in to receive emails. Check that contacts have email consent enabled.";
      } else if (
        errorMsg.includes("No contacts found") ||
        errorMsg.includes("No customers found")
      ) {
        title = "No recipients found";
        description =
          "No customers found in the selected audience with valid email addresses.";
      } else if (errorMsg.includes("quota") || errorMsg.includes("limit")) {
        title = "Sending limit reached";
        description =
          "You've reached your email sending limit. Upgrade your plan or wait until your quota resets.";
      } else if (errorMsg.includes("blocked") || errorMsg.includes("paused")) {
        title = "Campaign blocked";
        description =
          "This campaign is blocked due to sender configuration or delivery policy. Check campaign sender settings and domain status.";
      } else if (
        errorMsg.includes("Authentication") ||
        errorMsg.includes("JWT")
      ) {
        title = "Session expired";
        description = "Please sign in again to continue.";
      } else if (errorMsg) {
        description = errorMsg;
      }

      toast({
        title,
        description,
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  // =====================================================
  // SCHEDULED CAMPAIGN MANAGEMENT HANDLERS
  // =====================================================

  const handleEditSchedule = async (newSchedule: ScheduleOption) => {
    if (
      !existingCampaignId ||
      newSchedule.type !== "scheduled" ||
      !newSchedule.date
    ) {
      return;
    }

    if (campaignStatus === "sending" || campaignStatus === "sent") {
      openLockedScheduleDialog({
        message:
          campaignStatus === "sending"
            ? "This campaign is already sending. You can't change its schedule right now."
            : "This campaign was already sent. To schedule it again, duplicate it and schedule the copy.",
        desiredSchedule: {
          date: newSchedule.date,
          timezone: newSchedule.timezone,
        },
        statusOverride: campaignStatus,
      });
      return;
    }

    setIsScheduleProcessing(true);
    try {
      const success = await updateCampaignSchedule(
        existingCampaignId,
        newSchedule.date.toISOString(),
        newSchedule.timezone,
        {
          silent: true,
          onFailureMessage: (message) => {
            if (isScheduleLockedMessage(message)) {
              openLockedScheduleDialog({
                message,
                desiredSchedule: {
                  date: newSchedule.date as Date,
                  timezone: newSchedule.timezone,
                },
              });
              return;
            }

            toast({
              title: "Schedule not saved",
              description: message,
              variant: "destructive",
            });
          },
        },
      );

      if (success) {
        setSchedule(newSchedule);
        setScheduledAt(newSchedule.date.toISOString());
        setCampaignStatus("scheduled");
      }
    } finally {
      setIsScheduleProcessing(false);
    }
  };

  const handleUnschedule = async () => {
    if (!existingCampaignId) return;

    if (campaignStatus === "sending" || campaignStatus === "sent") {
      openLockedScheduleDialog({
        message:
          campaignStatus === "sending"
            ? "This campaign is already sending. You can't remove its schedule right now."
            : "This campaign was already sent. Scheduling changes are disabled.",
        statusOverride: campaignStatus,
      });
      return;
    }

    setIsScheduleProcessing(true);
    try {
      const success = await unscheduleCampaign(existingCampaignId, {
        silent: true,
        onFailureMessage: (message) => {
          if (isScheduleLockedMessage(message)) {
            openLockedScheduleDialog({
              message,
            });
            return;
          }
          toast({
            title: "Schedule update failed",
            description: message,
            variant: "destructive",
          });
        },
      });

      if (success) {
        setSchedule({ type: "now" });
        setScheduledAt(null);
        setCampaignStatus("draft");
      }
    } finally {
      setIsScheduleProcessing(false);
    }
  };

  const handleSendScheduledNow = async () => {
    if (!existingCampaignId) return;

    setIsScheduleProcessing(true);
    setSending(true);
    try {
      const result = await sendScheduledCampaignNow(existingCampaignId);

      if (result.success) {
        setCampaignStatus("sent");
        setScheduledAt(null);
        setSchedule({ type: "now" });
        navigate("/crm/campaigns");
      } else {
        setCampaignStatus("failed");
      }
    } finally {
      setIsScheduleProcessing(false);
      setSending(false);
    }
  };

  // Memoize email HTML to update when blocks or other dependencies change
  // Wrapped in try/catch so a single bad block can't crash the entire page render
  const emailHTMLContent = useMemo(() => {
    try {
      return generateEmailHTML();
    } catch (err) {
      console.error("[CRM CAMPAIGN CREATOR] Email HTML generation failed:", err);
      return "<div style='padding:24px;color:#666;'>Unable to render email preview.</div>";
    }
  }, [generateEmailHTML, campaignOverrides]);

  if (converting) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">
            Converting newsletter to email campaign...
          </p>
        </div>
      </div>
    );
  }

  // Check if any blocks are still generating images
  // ROBUST CHECK: Only consider generating if isGeneratingImage=true AND doesn't already have a valid image
  const hasGeneratingImages = blocks.some((b) => {
    if (!b.isGeneratingImage) return false;

    // Check if block already has a valid image (shouldn't be considered "generating")
    const isHeaderType = b.type === "header" || b.type === "newsletter-header";
    const hasValidImage = isHeaderType
      ? !!(b.backgroundImageUrl && b.backgroundImageUrl !== "loading")
      : !!(b.imageUrl && b.imageUrl !== "loading");

    return !hasValidImage; // Only count as generating if no valid image yet
  });

  return (
    <>
      <AlertDialog
        open={lockedScheduleDialogOpen}
        onOpenChange={(open) => {
          setLockedScheduleDialogOpen(open);
          if (!open) {
            setLockedScheduleDialogMessage("");
            setPendingLockedSchedule(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {lockedScheduleDialogStatus === "sending"
                ? "Campaign already in progress"
                : lockedScheduleDialogStatus === "sent"
                  ? "Campaign already processed"
                  : "Campaign schedule locked"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {lockedScheduleDialogMessage ||
                "This campaign can't be rescheduled right now."}
              {lockedScheduleDialogStatus === "sent" &&
              pendingLockedSchedule ? (
                <>
                  <br />
                  <br />
                  This campaign has already been processed, so it can't be
                  rescheduled. If you continue, we'll create a duplicate
                  campaign and apply this schedule to the copy.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isApplyingLockedScheduleChoice}>
              Cancel
            </AlertDialogCancel>

            {lockedScheduleDialogStatus === "sent" &&
            !!pendingLockedSchedule ? (
              <AlertDialogAction
                disabled={
                  isCloningCampaign ||
                  isApplyingLockedScheduleChoice ||
                  !existingCampaignId
                }
                onClick={async () => {
                  if (!existingCampaignId || !pendingLockedSchedule) return;

                  setIsApplyingLockedScheduleChoice(true);
                  try {
                    const clonedId = await cloneCampaign(existingCampaignId, {
                      clearScheduling: true,
                      newName: campaignName
                        ? `${campaignName} (Resend)`
                        : undefined,
                    });

                    if (!clonedId) {
                      toast({
                        title: "Could not duplicate campaign",
                        description:
                          "We couldn't create a new copy to schedule. Please try again.",
                        variant: "destructive",
                      });
                      return;
                    }

                    const scheduledOk = await updateCampaignSchedule(
                      clonedId,
                      pendingLockedSchedule.date.toISOString(),
                      pendingLockedSchedule.timezone,
                      {
                        silent: true,
                        onFailureMessage: (message) => {
                          toast({
                            title: "Schedule not saved",
                            description: message,
                            variant: "destructive",
                          });
                        },
                      },
                    );

                    if (!scheduledOk) {
                      return;
                    }

                    setLockedScheduleDialogOpen(false);
                    navigate(`/crm/campaigns/${clonedId}`);
                  } finally {
                    setIsApplyingLockedScheduleChoice(false);
                  }
                }}
              >
                Duplicate &amp; Schedule
              </AlertDialogAction>
            ) : (
              <AlertDialogAction
                disabled={isApplyingLockedScheduleChoice}
                onClick={() => setLockedScheduleDialogOpen(false)}
              >
                OK
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sticky Action Bar */}
      <CampaignActionBar
        campaignId={existingCampaignId}
        campaignStatus={campaignStatus}
        campaignName={campaignName}
        subjectLine={subjectLine}
        blocks={blocks}
        selectedSegments={selectedSegments}
        senderConfig={senderConfig}
        loadingSenderConfig={loadingSenderConfig}
        lastSaved={lastSaved}
        isAutoSaving={isAutoSaving}
        saveError={saveError}
        sending={sending}
        loading={loading}
        hasGeneratingImages={hasGeneratingImages}
        schedule={schedule}
        onScheduleChange={handleScheduleChange}
        onSend={handleSendCampaign}
        onSave={handleSave}
        onPreview={() => setShowPreview(true)}
        onAudience={() => setShowSetupWizard(true)}
        onAIWriter={() => setShowAIWriter(true)}
        isEditMode={!!existingCampaignId}
      />

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <DomainHealthBanner />
        {/* Scheduled Campaign Banner - shows when campaign is scheduled */}
        <ScheduledCampaignBanner
          campaignId={existingCampaignId}
          status={campaignStatus}
          scheduledAt={scheduledAt}
          timezone={
            schedule.type === "scheduled" ? schedule.timezone : undefined
          }
          onEditSchedule={handleEditSchedule}
          onSendNow={handleSendScheduledNow}
          onUnschedule={handleUnschedule}
          onPause={handlePauseCampaignSending}
          onResume={handleResumeCampaignSending}
          onStop={handleStopCampaignSending}
          campaignControlBusyAction={campaignControlBusyAction}
          isProcessing={isScheduleProcessing}
        />

        <CampaignDeliveryStatusCard
          campaignId={existingCampaignId}
          timezone={
            schedule.type === "scheduled" ? schedule.timezone : undefined
          }
        />

        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {existingCampaignId
              ? "Edit Email Campaign"
              : "Create Email Campaign"}
          </h1>
          <p className="text-muted-foreground">
            Build and customize your email campaign
          </p>
        </div>

        {/* Campaign Settings */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="campaign-name">Campaign Name</Label>
              <Input
                id="campaign-name"
                value={campaignName}
                onChange={(e) => {
                  setCampaignName(e.target.value);
                  // Auto-save campaign settings when they change
                  if (existingCampaignId) {
                    debouncedAutoSave({
                      blocks,
                      campaign_name: e.target.value,
                      subject_line: subjectLine,
                      preheader: preheaderText,
                    });
                  }
                }}
                placeholder="Enter campaign name"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="subject-line">Subject Line</Label>
              <Input
                id="subject-line"
                value={subjectLine}
                onChange={(e) => {
                  setSubjectLine(e.target.value);
                  // Auto-save campaign settings when they change
                  if (existingCampaignId) {
                    debouncedAutoSave({
                      blocks,
                      campaign_name: campaignName,
                      subject_line: e.target.value,
                      preheader: preheaderText,
                    });
                  }
                }}
                placeholder="Enter subject line"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="preheader">Preheader Text</Label>
              <Input
                id="preheader"
                value={preheaderText}
                onChange={(e) => {
                  setPreheaderText(e.target.value);
                  // Auto-save campaign settings when they change
                  if (existingCampaignId) {
                    debouncedAutoSave({
                      blocks,
                      campaign_name: campaignName,
                      subject_line: subjectLine,
                      preheader: e.target.value,
                    });
                  }
                }}
                placeholder="Optional preheader text"
                className="mt-1"
              />
            </div>
          </div>

          {/* Campaign Readiness Checklist */}
          <CampaignReadiness
            campaignName={campaignName}
            subjectLine={subjectLine}
            blocks={blocks}
            selectedSegments={selectedSegments}
            senderConfig={senderConfig}
            onEditAudience={() => setShowSetupWizard(true)}
            onSenderModalClose={refetchSenderConfig}
          />
        </div>

        {/* Campaign Setup Wizard */}
        <CampaignSetupWizard
          open={showSetupWizard}
          onClose={() => {
            setShowSetupWizard(false);
            // Immediately persist audience data when wizard closes
            persistState({
              campaignName,
              subjectLine,
              preheaderText,
              blocks,
              showPreview,
              selectedPersonas,
              selectedSegments,
            });
          }}
          selectedPersonas={selectedPersonas}
          selectedSegments={selectedSegments}
          onPersonasChange={(personas) => {
            setSelectedPersonas(personas);
          }}
          onSegmentsChange={setSelectedSegments}
          lockedSegmentIds={
            isSegmentLocked && segmentIdParam ? [segmentIdParam] : []
          }
        />

        {/* Email Content Builder - Full Width */}
        <Card className="relative">
          {/* Content Lock Overlay - shown when campaign is scheduled */}
          {isContentLocked && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
              <div className="text-center p-6">
                <Lock className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                <h3 className="font-semibold text-lg mb-2">Content Locked</h3>
                <p className="text-muted-foreground mb-4 max-w-md">
                  This campaign is{" "}
                  {campaignStatus === "sending"
                    ? "currently sending"
                    : "scheduled"}
                  .
                  {(campaignStatus as string) === "scheduled" &&
                    " Unschedule to edit content."}
                </p>
                {(campaignStatus as string) === "scheduled" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUnschedule}
                    disabled={isScheduleProcessing}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Unschedule to Edit
                  </Button>
                )}
              </div>
            </div>
          )}
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle>Email Content</CardTitle>
                {brandDefaults.loaded && (
                  <a
                    href="/profile/brand-colors"
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors"
                    title="Brand colors auto-applied to new blocks. Click to update brand settings."
                  >
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: brandDefaults.primaryColor }} />
                    Brand Applied
                  </a>
                )}
                <EmailHealthScore
                  blocks={blocks}
                  subjectLine={subjectLine}
                  preheaderText={preheaderText}
                />
                {blocks.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = !suggestionsOn;
                      setSuggestionsOn(next);
                      try { localStorage.setItem("bloom_suggestions", next ? "on" : "off"); } catch {}
                    }}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                      suggestionsOn
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-border bg-muted text-muted-foreground"
                    }`}
                    title={suggestionsOn ? "Click to hide suggestions" : "Click to show suggestions"}
                  >
                    💡 Suggestions {suggestionsOn ? "on" : "off"}
                  </button>
                )}
              </div>
              {!existingCampaignId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAIWriter(true)}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Write with AI
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* Structure picker for new campaigns with no blocks */}
            {blocks.length === 0 && !existingCampaignId && !showAIWriter && (
              <StructurePicker
                gardenCenterName={companyInfo?.name || "Your Garden Center"}
                primaryColor={brandDefaults.primaryColor}
                onSelect={(selectedBlocks, name, subject) => {
                  setBlocks(selectedBlocks);
                  if (name) setCampaignName(name);
                  if (subject) setSubjectLine(subject);
                }}
              />
            )}
            <CleanEmailBlockEditor
              blocks={blocks}
              brandDefaults={brandDefaults}
              preheaderText={preheaderText}
              suggestionsEnabled={suggestionsOn}
              onBlocksChange={(newBlocks) => {
                // Block changes when content is locked
                if (isContentLocked) {
                  toast({
                    title: "Content Locked",
                    description: "Unschedule the campaign to edit content.",
                    variant: "destructive",
                  });
                  return;
                }


                // DEBUG: Log overlay values for header blocks when blocks change
                newBlocks.forEach((block, idx) => {
                  if (
                    block.type === "newsletter-header" ||
                    block.type === "header"
                  ) {
                  }
                });

                // Prevent accidental clearing of blocks unless it's intentional
                if (newBlocks.length === 0 && blocks.length > 0) {
                  return;
                }

                setBlocks(newBlocks);
                setHasUnsavedChanges(true);

                // Auto-save when blocks change
                if (newBlocks.length > 0) {
                  if (existingCampaignId) {
                    debouncedAutoSave({
                      blocks: newBlocks,
                      campaign_name: campaignName,
                      subject_line: subjectLine,
                      preheader: preheaderText,
                    });
                  } else if (campaignName && newBlocks.length > 1) {
                    // Auto-create draft for new campaigns with meaningful content
                    createDraftCampaign();
                  }
                }
              }}
              generatingBlocks={generatingBlocks}
              campaignId={existingCampaignId || undefined}
              campaignName={campaignName}
              onOpenAIImageDialog={(blockId) => {
                setEditingBlockId(blockId);
                setShowAIImageDialog(true);
              }}
              onFooterStylingChange={(styling) => {
                // Update local campaign overrides so email preview reflects changes immediately
                setCampaignOverrides((prev) => ({
                  ...prev,
                  footerStyling: styling,
                  footerBackgroundColor:
                    styling.backgroundColor || prev.footerBackgroundColor,
                }));
              }}
            />
          </CardContent>
        </Card>

        {/* Full Email Preview Modal with Dynamic Footer */}
        <FullEmailPreview
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          subject={subjectLine}
          content={emailHTMLContent}
          campaignId={existingCampaignId}
          senderName={senderConfig?.displayName}
          senderEmail={senderConfig?.senderEmail}
        />

        {/* AI Writer Dialog */}
        <AIWriterDialog
          open={showAIWriter}
          onOpenChange={setShowAIWriter}
          onContentGenerated={handleAIContentGenerated}
          onBlockImageGenerated={handleBlockImageGenerated}
          onBlockImageGenerationFailed={handleBlockImageFailed}
        />

        {/* AI Image Personalization Dialog */}
        <AIPersonalizationDialog
          open={showAIImageDialog}
          onOpenChange={setShowAIImageDialog}
          onImageSelect={(imageUrl) => {

            if (editingBlockId) {
              const blockToUpdate = blocks.find((b) => b.id === editingBlockId);

              if (blockToUpdate) {
                // Update the appropriate image field based on block type
                // Clear generation flags to prevent skeleton loader from showing
                const imageUpdate =
                  blockToUpdate.type === "newsletter-header"
                    ? {
                        backgroundImageUrl: imageUrl,
                        altText: "AI Generated Image",
                        isGeneratingImage: false,
                        shouldFetchImage: false,
                        autoImageMode: false, // User manually selected, prevent auto-regeneration
                      }
                    : {
                        imageUrl,
                        altText: "AI Generated Image",
                        isGeneratingImage: false,
                        shouldFetchImage: false,
                        autoImageMode: false, // User manually selected, prevent auto-regeneration
                      };


                // Create a completely new array with new object references to force React re-render
                const updatedBlocks = blocks.map((b) =>
                  b.id === editingBlockId
                    ? { ...b, ...imageUpdate, _updateTimestamp: Date.now() } // Add timestamp to force change detection
                    : b,
                );


                setBlocks(updatedBlocks);

                // Trigger auto-save to persist the changes
                if (existingCampaignId) {
                  debouncedAutoSave({
                    blocks: updatedBlocks,
                    campaign_name: campaignName,
                    subject_line: subjectLine,
                    preheader: preheaderText,
                  });
                }

                toast({
                  title: "Image updated!",
                  description:
                    "AI-generated image has been applied to your block.",
                });
              } else {
                console.error("🖼️ [AIPersonalizationDialog] Block not found!");
              }
            } else {
              console.error(
                "🖼️ [AIPersonalizationDialog] No editing block ID!",
              );
            }
            setShowAIImageDialog(false);
            setEditingBlockId(null);
          }}
        />

        {/* Campaign Send Confirmation Modal */}
        <CampaignSendConfirmationModal
          isOpen={showSendConfirmation}
          onClose={() => {
            setShowSendConfirmation(false);

            if (scheduleTriggeredConfirmationRef.current) {
              scheduleTriggeredConfirmationRef.current = false;

              // If the user picked a schedule but cancelled confirmation,
              // revert UI back to Send Now (draft should not be scheduled).
              if (campaignStatus !== "scheduled") {
                skipNextSchedulePersistRef.current = true;
                setSchedule({ type: "now" });
              }
            }
          }}
          onConfirm={() => {
            scheduleTriggeredConfirmationRef.current = false;
            setShowSendConfirmation(false);
            proceedWithSending();
          }}
          campaignName={campaignName}
          selectedSegments={selectedSegments}
          selectedPersonas={selectedPersonas}
          totalRecipients={
            existingCampaignId
              ? campaignAudienceRecipientCount !== null
                ? campaignAudienceRecipientCount
                : loadingExistingCampaign
                  ? 0
                  : Number.NaN
              : campaignAudienceRecipientCount !== null
                ? campaignAudienceRecipientCount
                : selectedSegments.length === 0 && selectedPersonas.length === 0
                  ? totalCustomerCount
                  : selectedPersonas.reduce(
                      (total, persona) =>
                        total +
                        (persona.customerCount || persona.customer_count || 0),
                      0,
                    ) +
                    selectedSegments.reduce(
                      (total, segment) =>
                        total +
                        (segment.customerCount || segment.customer_count || 0),
                      0,
                    )
          }
          schedule={
            schedule.type === "scheduled" && schedule.date
              ? {
                  type: "scheduled",
                  sendAt: schedule.date,
                  timezone: schedule.timezone,
                }
              : { type: "immediate" }
          }
          senderIdentity={{
            senderName: senderConfig?.displayName || "—",
            senderEmail: senderConfig?.senderEmail || "—",
            replyToEmail: senderConfig?.replyToEmail || null,
            sendingDomain: senderConfig?.domain || null,
          }}
          loading={sending}
        />

        {/* Sender Setup Modal (custom domain required) */}
        <SenderVerificationModal
          open={showSenderConfirmation}
          onOpenChange={(open) => {
            setShowSenderConfirmation(open);
            if (!open) {
              refetchSenderConfig();
            }
          }}
          senderConfig={senderConfig}
        />

        {/* 🚨 EMERGENCY MANUAL PREFILL BUTTON */}
        {searchParams.get("type") === "newsletter" &&
          searchParams.get("prefillData") && (
            <div
              style={{
                position: "fixed",
                top: "10px",
                right: "10px",
                zIndex: 9999,
              }}
            >
              <button
                onClick={() => {
                  console.error("🚨🚨🚨 MANUAL BUTTON CLICKED");
                  const prefillDataParam = searchParams.get("prefillData");
                  if (prefillDataParam) {
                    try {
                      const parsedData = JSON.parse(
                        decodeURIComponent(prefillDataParam),
                      );
                      console.error(
                        "🚨 MANUAL: Successfully parsed data =",
                        parsedData,
                      );

                      // Create blocks directly
                      const newBlocks = [
                        {
                          id: `manual-header-${Date.now()}`,
                          type: "header" as const,
                          title: parsedData.title || "Newsletter",
                          headline: parsedData.title || "Newsletter",
                          source: "manual" as const,
                        },
                      ];

                      console.error("🚨 MANUAL: Setting blocks =", newBlocks);
                      setBlocks(newBlocks);
                      setCampaignName(parsedData.title || "Newsletter");
                      setSubjectLine(parsedData.title || "Newsletter");

                      toast({
                        title: "Manual prefill completed",
                        description: "Newsletter content loaded manually",
                      });
                    } catch (error) {
                      console.error("🚨 MANUAL: Error =", error);
                    }
                  }
                }}
                style={{
                  background: "red",
                  color: "white",
                  padding: "10px",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                🚨 MANUAL PREFILL
              </button>
            </div>
          )}
      </div>
    </>
  );
};
