import React, { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui-legacy/card";
import { Button } from "@/components/ui-legacy/button";
import { Input } from "@/components/ui-legacy/input";
import { Textarea } from "@/components/ui-legacy/textarea";
import { Label } from "@/components/ui-legacy/label";
import { Switch } from "@/components/ui-legacy/switch";
import { Badge } from "@/components/ui-legacy/badge";
import { RichTextEditor } from "@/components/ui-legacy/rich-text-editor";
import { SafeHtml } from "@/components/ui-legacy/safe-html";
import { renderMarkdownToMagazineHtml } from "@/utils/renderMarkdown";
import { convertMarkdownToHtml } from "@/utils/markdownUtils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui-legacy/dropdown-menu";
import {
  Calendar,
  Mail,
  MessageSquare,
  Facebook,
  Instagram,
  Edit,
  Sparkles,
  Replace,
  Clock,
  Tag,
  FileText,
  Check,
  AlertTriangle,
  Eye,
} from "lucide-react";
import { format } from "date-fns";
import { parseMonthParam } from "@/utils/dateUtils";
import { usePlanWizard } from "../PlanWizardContext";
import { PlanItem } from "../constants";
import { generateMultiThemeSeasonalPlanContent } from "@/services/seasonalPlanGenerator";
import { MediaSelectorImage } from "@/components/crm/MediaSelectorImage";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLoading } from "@/contexts/LoadingContext";
import { ProgressiveLoadingCard } from "@/components/dashboard/ProgressiveLoadingCard";
import { SocialPostPreviewModal } from "@/components/publish/preview/SocialPostPreviewModal";
import { MergeTagsPreviewDialog } from "@/components/crm/MergeTagsPreviewDialog";
import { searchGalleryForPost } from "@/services/imageGallerySearch";
import { resolveImage } from "@/services/imageResolutionService";
import { resolveTenantMutationContext } from "@/utils/resolveTenantMutationContext";

interface PlanStepCalendarProps {
  onNext: () => void;
  onBack: () => void;
}

const typeConfig = {
  email: { icon: Mail, color: "bg-blue-500", label: "Email", emoji: "📧" },
  sms: {
    icon: MessageSquare,
    color: "bg-green-500",
    label: "SMS",
    emoji: "💬",
  },
  facebook: {
    icon: Facebook,
    color: "bg-blue-600",
    label: "Facebook",
    emoji: "📘",
  },
  instagram: {
    icon: Instagram,
    color: "bg-pink-500",
    label: "Instagram",
    emoji: "📱",
  },
  blog: { icon: FileText, color: "bg-purple-500", label: "Blog", emoji: "📝" },
};

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

const IMAGE_GENERATION_BATCH_SIZE = 6;

const IMAGE_CHANNEL_MAP: Record<
  Extract<PlanItem["type"], "email" | "blog" | "facebook" | "instagram">,
  "newsletter" | "blog" | "facebook" | "instagram"
> = {
  email: "newsletter",
  blog: "blog",
  facebook: "facebook",
  instagram: "instagram",
};

const isImageEligiblePlanItem = (item: Pick<PlanItem, "type">) =>
  item.type === "facebook" ||
  item.type === "instagram" ||
  item.type === "blog" ||
  item.type === "email";

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
    if (candidate && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "seasonal garden content";
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

const getImageGenerationErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Image generation failed";
};

interface GeneratedPlanItemImage {
  itemId: string;
  imageUrl: string;
  imageMetadata: NonNullable<PlanItem["imageMetadata"]>;
}

type ImageResolutionPhase = "searching" | "generating";

interface MultichannelResponseItem {
  channel?: "newsletter" | "instagram" | "facebook" | "blog" | "video";
  title?: string;
  body?: string;
  content?: string;
  caption?: string;
  blocks?: unknown[];
  markdown?: string;
  summary?: string;
}

const buildGeneratedPlanItemImage = (
  item: PlanItem,
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
  item: PlanItem,
  context: { tenantId: string; userId: string },
  options?: { forceGenerate?: boolean },
): Promise<GeneratedPlanItemImage> => {
  if (!isImageEligiblePlanItem(item)) {
    throw new Error(`Unsupported image generation type: ${item.type}`);
  }

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

export const PlanStepCalendar: React.FC<PlanStepCalendarProps> = ({
  onNext,
  onBack,
}) => {
  const {
    state,
    setItems,
    updateItem,
    toggleItem,
    replaceWeekContent,
    addWeekContent,
  } = usePlanWizard();
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [previewItem, setPreviewItem] = useState<PlanItem | null>(null);
  const [previewPlatform, setPreviewPlatform] = useState<
    "instagram" | "facebook"
  >("instagram");
  const [expandedBlogs, setExpandedBlogs] = useState<Set<string>>(new Set());
  const [featuredImage, setFeaturedImage] = useState<{
    url: string;
    metadata: NonNullable<PlanItem["imageMetadata"]>;
  } | null>(null);
  const [generatingImages, setGeneratingImages] = useState(false);
  const [imageGenerationProgress, setImageGenerationProgress] = useState({
    phase: "searching" as ImageResolutionPhase,
    completed: 0,
    total: 0,
  });
  const { setLoading, clearLoading } = useLoading();
  const [retryingImageItemIds, setRetryingImageItemIds] = useState<string[]>(
    [],
  );

  // Helper functions for blog expansion
  const toggleBlogExpansion = (itemId: string) => {
    const newExpanded = new Set(expandedBlogs);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedBlogs(newExpanded);
  };

  const truncateText = (text: string, maxLength: number = 300) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  const hydrateGeneratedItems = useCallback(
    async (generatedItems: PlanItem[]) => {
      const preparedItems = generatedItems.map(
        preparePlanItemForImageGeneration,
      );
      setItems(preparedItems);

      const itemsNeedingImages = preparedItems.filter(
        (item) => isImageEligiblePlanItem(item) && !item.imageUrl,
      );

      if (itemsNeedingImages.length === 0) {
        return;
      }

      const resolutionContext = await resolveTenantMutationContext({});

      const runGenerationPass = async (itemsForPass: PlanItem[]) => {
        let completedCount = 0;
        const failedItems: PlanItem[] = [];

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
              imageError: getImageGenerationErrorMessage(result.reason),
            });
          });
        }

        return failedItems;
      };

      const runGallerySearchPass = async (itemsForPass: PlanItem[]) => {
        let completedCount = 0;
        const itemsToGenerate: PlanItem[] = [];

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
                channel:
                  IMAGE_CHANNEL_MAP[
                    item.type as keyof typeof IMAGE_CHANNEL_MAP
                  ],
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

      setGeneratingImages(true);
      setImageGenerationProgress({
        phase: "searching",
        completed: 0,
        total: itemsNeedingImages.length,
      });

      const toastId = toast.loading(
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
            <span className="font-medium">Searching Image Library</span>
          </div>
          <span className="text-xs text-muted-foreground">
            Reusing tagged gallery images before generating anything new
          </span>
        </div>,
      );

      try {
        const itemsToGenerate = await runGallerySearchPass(itemsNeedingImages);

        let failedItems: PlanItem[] = [];

        if (itemsToGenerate.length > 0) {
          toast.loading(`Generating ${itemsToGenerate.length} new images...`, {
            id: toastId,
          });
          setImageGenerationProgress({
            phase: "generating",
            completed: 0,
            total: itemsToGenerate.length,
          });
          failedItems = await runGenerationPass(itemsToGenerate);
        } else {
          toast.loading("All images were resolved from the library.", {
            id: toastId,
          });
        }

        if (failedItems.length > 0) {
          toast.loading(`Retrying ${failedItems.length} failed images...`, {
            id: toastId,
          });
          setImageGenerationProgress({
            phase: "generating",
            completed: 0,
            total: failedItems.length,
          });
          failedItems = await runGenerationPass(failedItems);
        }

        if (failedItems.length > 0) {
          toast.error(
            `${failedItems.length} posts couldn't generate images. You can retry individually or launch without images.`,
            { id: toastId },
          );
        } else {
          const reusedCount =
            itemsNeedingImages.length - itemsToGenerate.length;
          toast.success(
            reusedCount > 0
              ? `Resolved ${reusedCount} from the library and generated ${itemsToGenerate.length} new images.`
              : `Generated images for ${itemsNeedingImages.length} posts.`,
            { id: toastId },
          );
        }
      } catch (error) {
        console.error("[PlanStepCalendar] Error generating AI images:", error);
        toast.error(
          "Image generation failed. You can retry individually or launch without images.",
          { id: toastId },
        );
      } finally {
        setGeneratingImages(false);
        setImageGenerationProgress({
          phase: "searching",
          completed: 0,
          total: 0,
        });
      }
    },
    [setItems, updateItem],
  );

  const handleRetrySingleImage = useCallback(
    async (item: PlanItem) => {
      if (retryingImageItemIds.includes(item.id)) {
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
        toast.success(
          result.imageMetadata.source === "gallery-reuse"
            ? `Reused a library image for ${item.title}`
            : `Image generated for ${item.title}`,
        );
      } catch (error) {
        const imageError = getImageGenerationErrorMessage(error);
        updateItem(item.id, {
          imageGenerationStatus: "failed",
          imageError,
        });
        toast.error(imageError);
      } finally {
        setRetryingImageItemIds((current) =>
          current.filter((itemId) => itemId !== item.id),
        );
      }
    },
    [retryingImageItemIds, updateItem],
  );

  // Generate initial seasonal content when component mounts
  useEffect(() => {
    if (state.themes.length > 0 && state.month && state.items.length === 0) {
      setIsInitialLoading(true);
      setLoading("plan-calendar", {
        isLoading: true,
        message: "Generating your content calendar...",
        priority: "page",
      });

      // Generate AI featured image
      const featuredPrompt = `${state.themes[0]?.label || "garden"} ${format(parseMonthParam(state.month), "MMMM")} professional showcase`;
      supabase.functions
        .invoke("generate-ai-image", {
          body: {
            contentContext: featuredPrompt,
            contentTitle: `${format(parseMonthParam(state.month), "MMMM")} Featured Garden`,
            channel: "instagram",
            uploadToStorage: true,
            storageBucket: "global-ai-images",
          },
        })
        .then(({ data, error }) => {
          if (!error && data?.imageUrl) {
            setFeaturedImage({
              url: data.imageUrl,
              metadata: {
                alt: featuredPrompt,
                source: "ai_generated_featured",
                globalImageId: data.globalImageId,
                tags: data.metadata?.tags || [],
              },
            });
          }
        })
        .catch((err) => {});

      generateMultiThemeSeasonalPlanContent(state.themes, state.month)
        .then(async (generatedItems) => {
          await hydrateGeneratedItems(generatedItems);
        })
        .catch((error) => {
          console.error("Error generating multi-theme content:", error);
          // Fallback to basic items if seasonal generation fails
          setItems([]);
          toast.error("Failed to generate content. Please try regenerating.");
        })
        .finally(() => {
          setIsInitialLoading(false);
          clearLoading("plan-calendar");
        });
    }
  }, [
    state.themes,
    state.month,
    state.items.length,
    setItems,
    setLoading,
    clearLoading,
    hydrateGeneratedItems,
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
    metadata?: PlanItem["imageMetadata"],
  ) => {
    updateItem(itemId, {
      imageUrl,
      imageMetadata: metadata,
      imageGenerationStatus: "completed",
      imageError: null,
    });
  };

  const applyFeaturedImage = (itemId: string) => {
    if (featuredImage) {
      updateItem(itemId, {
        imageUrl: featuredImage.url,
        imageMetadata: featuredImage.metadata,
        imageGenerationStatus: "completed",
        imageError: null,
      });
    }
  };

  // Regenerate content with AI
  const handleRegenerateWithAI = async () => {
    if (state.themes.length === 0 || !state.month) return;

    setIsRegenerating(true);
    setLoading("plan-regenerate", {
      isLoading: true,
      message:
        "Regenerating content with proper templates and MediaSelector...",
      priority: "page",
    });
    try {
      // Use the new multichannel content generation with proper templates
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      if (!currentUser) throw new Error("User not authenticated");

      const { data: me } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", currentUser.id)
        .single();

      const workspaceId = me?.tenant_id || currentUser.id;

      const response = await supabase.functions.invoke(
        "generate-multichannel-content",
        {
          body: {
            mode: "custom",
            userIdea: {
              title: state.themes.map((t) => t.label).join(" + "),
              notes: state.themes.map((t) => t.description).join("; "),
              tone: "professional and helpful",
            },
            workspaceId,
            channels: ["newsletter", "instagram", "facebook", "blog", "video"],
          },
        },
      );

      if (response.error) {
        throw new Error(response.error.message);
      }

      // Convert the multichannel response back to plan items
      if (response.data?.items) {
        const enhancedItems = await generateMultiThemeSeasonalPlanContent(
          state.themes,
          state.month,
        );

        // Enhance with AI-generated content from proper templates
        response.data.items.forEach(
          (aiItem: MultichannelResponseItem, index: number) => {
            const matchingItem = enhancedItems[index % enhancedItems.length];
            if (matchingItem) {
              if (aiItem.channel === "newsletter") {
                matchingItem.caption = aiItem.body || aiItem.content || "";
                matchingItem.enhancedContent = {
                  title: aiItem.title || matchingItem.title,
                  fullContent: aiItem.body || "",
                  blocks: aiItem.blocks || [],
                };
              } else if (
                aiItem.channel === "instagram" ||
                aiItem.channel === "facebook"
              ) {
                matchingItem.caption = aiItem.caption || aiItem.body || "";
              } else if (aiItem.channel === "blog") {
                matchingItem.enhancedContent = {
                  title: aiItem.title || matchingItem.title,
                  fullContent: aiItem.markdown || aiItem.body || "",
                  summary: aiItem.summary || "",
                };
              }
            }
          },
        );

        await hydrateGeneratedItems(enhancedItems);
      }

      toast.success(
        "Content regenerated with CRM templates and MediaSelector!",
      );
    } catch (error) {
      console.error("Error regenerating content:", error);
      toast.error("Failed to regenerate content. Using seasonal templates.");
      // Fallback to regular seasonal content
      try {
        const fallbackItems = await generateMultiThemeSeasonalPlanContent(
          state.themes,
          state.month,
        );
        await hydrateGeneratedItems(fallbackItems);
      } catch (fallbackError) {
        toast.error("Unable to regenerate content");
      }
    } finally {
      setIsRegenerating(false);
      clearLoading("plan-regenerate");
    }
  };

  // Group items by week
  const itemsByWeek = state.items.reduce(
    (acc, item) => {
      if (!acc[item.week]) acc[item.week] = [];
      acc[item.week].push(item);
      return acc;
    },
    {} as Record<number, PlanItem[]>,
  );

  const monthName = state.month
    ? format(parseMonthParam(state.month), "MMMM yyyy")
    : "";
  const itemsMissingImages = state.items.filter(
    (item) => isImageEligiblePlanItem(item) && !item.imageUrl,
  );

  // Get theme breakdown for display
  const themeBreakdown = state.themes.map((theme) => {
    const themeItems = state.items.filter((item) => item.themeId === theme.id);
    return {
      theme,
      count: themeItems.length,
      channels: [...new Set(themeItems.map((item) => item.type))],
    };
  });

  const isLoading = isInitialLoading || isRegenerating;

  // Show loading state during initial generation
  if (isInitialLoading && state.items.length === 0) {
    return (
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <Calendar className="h-8 w-8 text-primary" />
            <h2 className="text-3xl font-bold">Review Your Content Calendar</h2>
          </div>
          <p className="text-muted-foreground text-lg">
            Your multi-theme content plan for {monthName}
          </p>
        </div>

        <ProgressiveLoadingCard
          title="Generating Your Content Calendar"
          description="AI is creating personalized content based on your selected themes"
          expectedContent="Email campaigns, social media posts, and promotional content optimized for your business"
          isLoading={true}
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* AI Image Generation Progress Overlay */}
      {generatingImages && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <Card className="max-w-md w-full mx-4">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent" />
                  <Sparkles className="absolute inset-0 m-auto h-8 w-8 text-primary animate-pulse" />
                </div>

                <div className="text-center space-y-2">
                  <h3 className="text-lg font-semibold">
                    {imageGenerationProgress.phase === "searching"
                      ? "Searching Image Library"
                      : "Generating New Images"}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {imageGenerationProgress.phase === "searching"
                      ? "Checking your tagged gallery before generating anything new"
                      : "Creating new AI-generated images for the remaining posts"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {imageGenerationProgress.phase === "searching"
                      ? "Gallery matches resolve immediately when tags line up"
                      : "This may take 8-12 seconds per image"}
                  </p>
                </div>

                <div className="w-full space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span className="font-medium">
                      {imageGenerationProgress.completed} /{" "}
                      {imageGenerationProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-gray-300 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary h-full transition-all duration-500 ease-out"
                      style={{
                        width: `${(imageGenerationProgress.completed / imageGenerationProgress.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <Calendar className="h-8 w-8 text-primary" />
          <h2 className="text-3xl font-bold">Review Your Content Calendar</h2>
        </div>
        <p className="text-muted-foreground text-lg">
          Your multi-theme content plan for {monthName}. Edit, swap content
          packs, and add extra campaigns.
        </p>

        {/* Theme Breakdown */}
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {themeBreakdown.map(({ theme, count, channels }) => (
            <Badge key={theme.id} variant="secondary" className="gap-2">
              {theme.label}: {count} items (
              {channels.map((c) => typeConfig[c]?.emoji || c).join("")})
            </Badge>
          ))}
        </div>
      </div>

      {/* Content Calendar */}
      <div className="space-y-6">
        {!generatingImages && itemsMissingImages.length > 0 && (
          <Card className="border-amber-300 bg-amber-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-amber-900">
                    {itemsMissingImages.length} posts still have no image
                  </p>
                  <p className="text-sm text-amber-800">
                    You can retry failed items individually or continue to
                    review and launch with a warning.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        {Object.keys(itemsByWeek)
          .sort((a, b) => Number(a) - Number(b))
          .map((weekNum) => {
            const weekItems = itemsByWeek[Number(weekNum)];
            const weekLabel = getWeekLabel(Number(weekNum), state.month);

            return (
              <Card key={weekNum} className="overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-muted/50 to-muted/30">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      {weekLabel}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="gap-2">
                        <Replace className="h-4 w-4" />
                        Replace Pack
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 bg-muted/20">
                  <div className="space-y-4">
                    {weekItems.map((item, index) => {
                      const TypeIcon = typeConfig[item.type].icon;
                      const isEditing = editingItem === item.id;
                      const isImageMissing =
                        isImageEligiblePlanItem(item) && !item.imageUrl;
                      const showImageFailureState =
                        isImageMissing && !generatingImages;
                      const isRetryingImage = retryingImageItemIds.includes(
                        item.id,
                      );

                      return (
                        <Card
                          key={item.id}
                          className={`m-4 shadow-lg hover:shadow-xl transition-shadow duration-300 ${
                            !item.enabled ? "opacity-50" : ""
                          } ${
                            showImageFailureState
                              ? "border-red-300 ring-1 ring-red-200"
                              : ""
                          }`}
                        >
                          <CardContent className="p-6">
                            <div className="flex items-start gap-4">
                              {/* Type Icon & Featured Image Option */}
                              <div className="flex-shrink-0 space-y-2">
                                <div
                                  className={`w-10 h-10 rounded-full ${typeConfig[item.type].color} flex items-center justify-center text-white shadow-md`}
                                >
                                  <TypeIcon className="h-5 w-5" />
                                </div>
                                {featuredImage &&
                                  !item.imageUrl &&
                                  [
                                    "facebook",
                                    "instagram",
                                    "blog",
                                    "email",
                                  ].includes(item.type) && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        applyFeaturedImage(item.id)
                                      }
                                      className="w-10 h-10 p-0"
                                      title="Use featured image"
                                    >
                                      <img
                                        src={featuredImage.url}
                                        alt="Featured"
                                        className="w-full h-full object-cover rounded"
                                      />
                                    </Button>
                                  )}
                              </div>

                              {/* Content */}
                              <div className="flex-1 space-y-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      {typeConfig[item.type].label}
                                    </Badge>
                                    {item.themeName && (
                                      <Badge
                                        variant="secondary"
                                        className="text-xs"
                                      >
                                        {item.themeName}
                                      </Badge>
                                    )}
                                    <span className="text-sm text-muted-foreground">
                                      {format(item.date, "MMM d, yyyy")}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        setEditingItem(
                                          isEditing ? null : item.id,
                                        )
                                      }
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <div
                                      className="flex items-center gap-3 bg-muted/50 hover:bg-muted/70 px-3 py-2 rounded-lg cursor-pointer transition-colors group/toggle"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleItem(item.id);
                                      }}
                                      onKeyDown={(e) => {
                                        if (
                                          e.key === "Enter" ||
                                          e.key === " "
                                        ) {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          toggleItem(item.id);
                                        }
                                      }}
                                      role="button"
                                      tabIndex={0}
                                      aria-label={`Toggle ${item.enabled ? "off" : "on"}`}
                                      title="Click to toggle active/inactive"
                                    >
                                      <div className="flex items-center gap-2">
                                        <div
                                          className={`w-3 h-3 rounded-full transition-colors ${
                                            item.enabled
                                              ? "bg-green-500 group-hover/toggle:bg-green-600"
                                              : "bg-gray-300 group-hover/toggle:bg-gray-400"
                                          }`}
                                        />
                                        <span
                                          className={`text-sm font-medium transition-colors ${
                                            item.enabled
                                              ? "text-green-700 group-hover/toggle:text-green-800"
                                              : "text-gray-500 group-hover/toggle:text-gray-600"
                                          }`}
                                        >
                                          {item.enabled ? "Active" : "Inactive"}
                                        </span>
                                      </div>
                                      <Switch
                                        id={`toggle-${item.id}`}
                                        checked={item.enabled}
                                        onCheckedChange={() =>
                                          toggleItem(item.id)
                                        }
                                        onClick={(e) => e.stopPropagation()} // Prevent double toggle from container
                                        className="relative h-6 w-11 data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-300 border-2 data-[state=checked]:border-green-600 data-[state=unchecked]:border-gray-400 shadow-md transition-all duration-300 ease-in-out hover:shadow-lg hover:scale-105 active:scale-95 [&>span]:h-4 [&>span]:w-4 [&>span]:bg-white [&>span]:shadow-lg [&>span]:transition-all [&>span]:duration-300 [&>span]:ease-in-out data-[state=checked]:[&>span]:translate-x-5 data-[state=unchecked]:[&>span]:translate-x-0.5"
                                        data-switch
                                        aria-label={`Toggle ${item.enabled ? "off" : "on"}`}
                                      />
                                    </div>
                                  </div>
                                </div>

                                {isEditing ? (
                                  <div className="space-y-4 bg-muted/30 p-4 rounded-lg">
                                    <div>
                                      <Label htmlFor={`title-${item.id}`}>
                                        Title
                                      </Label>
                                      <Input
                                        id={`title-${item.id}`}
                                        value={item.title}
                                        onChange={(e) =>
                                          handleItemUpdate(
                                            item.id,
                                            "title",
                                            e.target.value,
                                          )
                                        }
                                        className="mt-1"
                                      />
                                    </div>
                                    {/* Email-specific fields first */}
                                    {item.type === "email" && (
                                      <>
                                        <div>
                                          <div className="flex items-center justify-between">
                                            <Label
                                              htmlFor={`subject-${item.id}`}
                                            >
                                              Subject Line
                                            </Label>
                                            <DropdownMenu>
                                              <DropdownMenuTrigger asChild>
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  className="gap-2"
                                                >
                                                  <Tag className="h-3 w-3" />
                                                  Merge Tags
                                                </Button>
                                              </DropdownMenuTrigger>
                                              <DropdownMenuContent
                                                align="end"
                                                className="w-64"
                                              >
                                                <DropdownMenuLabel>
                                                  Insert Tag
                                                </DropdownMenuLabel>
                                                <DropdownMenuItem
                                                  onClick={() =>
                                                    handleItemUpdate(
                                                      item.id,
                                                      "emailSubject",
                                                      (item.emailSubject ||
                                                        "") +
                                                        '{{ first_name | default: "Friend" }}',
                                                    )
                                                  }
                                                >
                                                  {
                                                    '{{ first_name | default: "Friend" }}'
                                                  }
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                  onClick={() =>
                                                    handleItemUpdate(
                                                      item.id,
                                                      "emailSubject",
                                                      (item.emailSubject ||
                                                        "") +
                                                        '{{ last_name | default: "" }}',
                                                    )
                                                  }
                                                >
                                                  {"{{ last_name }}"}
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuLabel>
                                                  Company Info
                                                </DropdownMenuLabel>
                                                <DropdownMenuItem
                                                  onClick={() =>
                                                    handleItemUpdate(
                                                      item.id,
                                                      "emailSubject",
                                                      (item.emailSubject ||
                                                        "") +
                                                        '{{ company.name | default: "Our Team" }}',
                                                    )
                                                  }
                                                >
                                                  {"{{ company.name }}"}
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuLabel>
                                                  Preview
                                                </DropdownMenuLabel>
                                                <MergeTagsPreviewDialog
                                                  emailContent={{
                                                    subject: item.emailSubject,
                                                    preheader:
                                                      item.emailPreheader,
                                                    body: item.caption,
                                                  }}
                                                  onMergeComplete={(
                                                    content,
                                                    field,
                                                  ) => {
                                                    if (field === "subject") {
                                                      handleItemUpdate(
                                                        item.id,
                                                        "emailSubject",
                                                        content,
                                                      );
                                                    }
                                                  }}
                                                >
                                                  <DropdownMenuItem
                                                    onSelect={(e) =>
                                                      e.preventDefault()
                                                    }
                                                  >
                                                    Preview with Customer...
                                                  </DropdownMenuItem>
                                                </MergeTagsPreviewDialog>
                                              </DropdownMenuContent>
                                            </DropdownMenu>
                                          </div>
                                          <Input
                                            id={`subject-${item.id}`}
                                            value={item.emailSubject || ""}
                                            onChange={(e) =>
                                              handleItemUpdate(
                                                item.id,
                                                "emailSubject",
                                                e.target.value,
                                              )
                                            }
                                            className="mt-1"
                                            placeholder="Enter email subject..."
                                          />
                                          <p className="text-xs text-muted-foreground mt-1">
                                            {item.emailSubject?.length || 0}/50
                                            characters
                                          </p>
                                        </div>
                                        <div>
                                          <div className="flex items-center justify-between">
                                            <Label
                                              htmlFor={`preheader-${item.id}`}
                                            >
                                              Preheader
                                            </Label>
                                            <DropdownMenu>
                                              <DropdownMenuTrigger asChild>
                                                <Button
                                                  variant="outline"
                                                  size="sm"
                                                  className="gap-2"
                                                >
                                                  <Tag className="h-3 w-3" />
                                                  Merge Tags
                                                </Button>
                                              </DropdownMenuTrigger>
                                              <DropdownMenuContent
                                                align="end"
                                                className="w-64"
                                              >
                                                <DropdownMenuLabel>
                                                  Insert Tag
                                                </DropdownMenuLabel>
                                                <DropdownMenuItem
                                                  onClick={() =>
                                                    handleItemUpdate(
                                                      item.id,
                                                      "emailPreheader",
                                                      (item.emailPreheader ||
                                                        "") +
                                                        '{{ first_name | default: "Friend" }}',
                                                    )
                                                  }
                                                >
                                                  {
                                                    '{{ first_name | default: "Friend" }}'
                                                  }
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                  onClick={() =>
                                                    handleItemUpdate(
                                                      item.id,
                                                      "emailPreheader",
                                                      (item.emailPreheader ||
                                                        "") +
                                                        '{{ last_name | default: "" }}',
                                                    )
                                                  }
                                                >
                                                  {"{{ last_name }}"}
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuLabel>
                                                  Company Info
                                                </DropdownMenuLabel>
                                                <DropdownMenuItem
                                                  onClick={() =>
                                                    handleItemUpdate(
                                                      item.id,
                                                      "emailPreheader",
                                                      (item.emailPreheader ||
                                                        "") +
                                                        '{{ company.name | default: "Our Team" }}',
                                                    )
                                                  }
                                                >
                                                  {"{{company_name}}"}
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuLabel>
                                                  Preview
                                                </DropdownMenuLabel>
                                                <MergeTagsPreviewDialog
                                                  emailContent={{
                                                    subject: item.emailSubject,
                                                    preheader:
                                                      item.emailPreheader,
                                                    body: item.caption,
                                                  }}
                                                  onMergeComplete={(
                                                    content,
                                                    field,
                                                  ) => {
                                                    if (field === "preheader") {
                                                      handleItemUpdate(
                                                        item.id,
                                                        "emailPreheader",
                                                        content,
                                                      );
                                                    }
                                                  }}
                                                >
                                                  <DropdownMenuItem
                                                    onSelect={(e) =>
                                                      e.preventDefault()
                                                    }
                                                  >
                                                    Preview with Customer...
                                                  </DropdownMenuItem>
                                                </MergeTagsPreviewDialog>
                                              </DropdownMenuContent>
                                            </DropdownMenu>
                                          </div>
                                          <Input
                                            id={`preheader-${item.id}`}
                                            value={item.emailPreheader || ""}
                                            onChange={(e) =>
                                              handleItemUpdate(
                                                item.id,
                                                "emailPreheader",
                                                e.target.value,
                                              )
                                            }
                                            className="mt-1"
                                            placeholder="Enter email preheader..."
                                          />
                                          <p className="text-xs text-muted-foreground mt-1">
                                            {item.emailPreheader?.length || 0}
                                            /90 characters
                                          </p>
                                        </div>
                                      </>
                                    )}

                                    <div>
                                      <Label htmlFor={`date-${item.id}`}>
                                        Date
                                      </Label>
                                      <Input
                                        id={`date-${item.id}`}
                                        type="date"
                                        value={format(item.date, "yyyy-MM-dd")}
                                        onChange={(e) => {
                                          const newDate = new Date(
                                            e.target.value,
                                          );
                                          handleItemUpdate(
                                            item.id,
                                            "date",
                                            newDate,
                                          );
                                        }}
                                        className="mt-1 max-w-xs"
                                      />
                                    </div>

                                    <div>
                                      <div className="flex items-center justify-between">
                                        <Label htmlFor={`caption-${item.id}`}>
                                          {item.type === "email"
                                            ? "Email Content"
                                            : item.type === "blog"
                                              ? "Blog Content"
                                              : "Caption"}
                                        </Label>
                                        {item.type === "email" && (
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                className="gap-2"
                                              >
                                                <Tag className="h-3 w-3" />
                                                Merge Tags
                                              </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent
                                              align="end"
                                              className="w-48"
                                            >
                                              <DropdownMenuLabel>
                                                Insert Tag
                                              </DropdownMenuLabel>
                                              <DropdownMenuItem
                                                onClick={() =>
                                                  handleItemUpdate(
                                                    item.id,
                                                    "caption",
                                                    item.caption +
                                                      "{{first_name}}",
                                                  )
                                                }
                                              >
                                                {"{{first_name}}"}
                                              </DropdownMenuItem>
                                              <DropdownMenuItem
                                                onClick={() =>
                                                  handleItemUpdate(
                                                    item.id,
                                                    "caption",
                                                    item.caption +
                                                      "{{last_name}}",
                                                  )
                                                }
                                              >
                                                {"{{last_name}}"}
                                              </DropdownMenuItem>
                                              <DropdownMenuItem
                                                onClick={() =>
                                                  handleItemUpdate(
                                                    item.id,
                                                    "caption",
                                                    item.caption + "{{email}}",
                                                  )
                                                }
                                              >
                                                {"{{email}}"}
                                              </DropdownMenuItem>
                                              <DropdownMenuSeparator />
                                              <DropdownMenuLabel>
                                                Company Info
                                              </DropdownMenuLabel>
                                              <DropdownMenuItem
                                                onClick={() =>
                                                  handleItemUpdate(
                                                    item.id,
                                                    "caption",
                                                    item.caption +
                                                      "{{company_name}}",
                                                  )
                                                }
                                              >
                                                {"{{company_name}}"}
                                              </DropdownMenuItem>
                                              <DropdownMenuItem
                                                onClick={() =>
                                                  handleItemUpdate(
                                                    item.id,
                                                    "caption",
                                                    item.caption +
                                                      "{{website}}",
                                                  )
                                                }
                                              >
                                                {"{{website}}"}
                                              </DropdownMenuItem>
                                              <DropdownMenuSeparator />
                                              <DropdownMenuLabel>
                                                Preview
                                              </DropdownMenuLabel>
                                              <MergeTagsPreviewDialog
                                                emailContent={{
                                                  subject: item.emailSubject,
                                                  preheader:
                                                    item.emailPreheader,
                                                  body: item.caption,
                                                }}
                                                onMergeComplete={(
                                                  content,
                                                  field,
                                                ) => {
                                                  if (field === "body") {
                                                    handleItemUpdate(
                                                      item.id,
                                                      "caption",
                                                      content,
                                                    );
                                                  }
                                                }}
                                              >
                                                <DropdownMenuItem
                                                  onSelect={(e) =>
                                                    e.preventDefault()
                                                  }
                                                >
                                                  Preview with Customer...
                                                </DropdownMenuItem>
                                              </MergeTagsPreviewDialog>
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        )}
                                      </div>
                                      {item.type === "email" ? (
                                        <RichTextEditor
                                          content={item.caption}
                                          onChange={(html) =>
                                            handleItemUpdate(
                                              item.id,
                                              "caption",
                                              html,
                                            )
                                          }
                                          placeholder="Write your email content here..."
                                          className="mt-1"
                                          editorClassName="min-h-[120px]"
                                        />
                                      ) : item.type === "blog" ? (
                                        <RichTextEditor
                                          content={
                                            item.enhancedContent?.fullContent ||
                                            item.caption
                                          }
                                          onChange={(html) => {
                                            const updatedEnhancedContent = {
                                              ...item.enhancedContent,
                                              fullContent: html,
                                              title:
                                                item.enhancedContent?.title ||
                                                item.title,
                                            };
                                            handleItemUpdate(
                                              item.id,
                                              "enhancedContent",
                                              updatedEnhancedContent,
                                            );
                                          }}
                                          placeholder="Write your blog content here..."
                                          className="mt-1"
                                          editorClassName="min-h-[200px]"
                                        />
                                      ) : (
                                        <Textarea
                                          id={`caption-${item.id}`}
                                          value={item.caption}
                                          onChange={(e) =>
                                            handleItemUpdate(
                                              item.id,
                                              "caption",
                                              e.target.value,
                                            )
                                          }
                                          rows={3}
                                          className="mt-1"
                                        />
                                      )}
                                    </div>
                                    {(item.type === "facebook" ||
                                      item.type === "instagram" ||
                                      item.type === "email" ||
                                      item.type === "blog") && (
                                      <div>
                                        <div className="flex items-center justify-between mb-2">
                                          <Label>Featured Image</Label>
                                          {featuredImage && !item.imageUrl && (
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={() =>
                                                applyFeaturedImage(item.id)
                                              }
                                              className="gap-2"
                                            >
                                              <Check className="h-3 w-3" />
                                              Use Featured Image
                                            </Button>
                                          )}
                                        </div>

                                        {featuredImage && !item.imageUrl && (
                                          <div className="mb-3 p-3 bg-muted/50 rounded-lg border border-dashed border-primary/30">
                                            <div className="flex items-start gap-3">
                                              <img
                                                src={featuredImage.url}
                                                alt="Featured"
                                                className="w-24 h-24 object-cover rounded"
                                              />
                                              <div className="flex-1 space-y-1">
                                                <p className="text-sm font-medium">
                                                  Theme Featured Image Available
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                  {featuredImage.metadata.alt}
                                                </p>
                                                {featuredImage.metadata
                                                  .photographer && (
                                                  <p className="text-xs text-muted-foreground">
                                                    Photo by{" "}
                                                    {
                                                      featuredImage.metadata
                                                        .photographer
                                                    }
                                                  </p>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        )}

                                        <div className="mt-2">
                                          <MediaSelectorImage
                                            src={item.imageUrl}
                                            onChange={(imageUrl, metadata) =>
                                              handleImageSelect(
                                                item.id,
                                                imageUrl,
                                                metadata,
                                              )
                                            }
                                            contentContext={getPlanItemImagePrompt(
                                              item,
                                            )}
                                            imageGenerationStatus={
                                              item.imageGenerationStatus
                                            }
                                            className="max-w-md"
                                          />
                                        </div>
                                      </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="flex justify-between pt-2">
                                      {(item.type === "facebook" ||
                                        item.type === "instagram") && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            setPreviewItem(item);
                                            setPreviewPlatform(
                                              item.type as
                                                | "instagram"
                                                | "facebook",
                                            );
                                          }}
                                          className="gap-2"
                                        >
                                          <Eye className="h-4 w-4" />
                                          Preview Post
                                        </Button>
                                      )}
                                      <div className="flex-1" />
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setEditingItem(null)}
                                        className="px-4"
                                      >
                                        Save & Close
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div
                                    className="space-y-3 cursor-pointer hover:bg-muted/20 -m-2 p-2 rounded-md transition-colors group/content"
                                    onClick={() => setEditingItem(item.id)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        setEditingItem(item.id);
                                      }
                                    }}
                                    role="button"
                                    tabIndex={0}
                                    aria-label="Click to edit content"
                                    title="Click to edit"
                                  >
                                    {/* Email header info at the top */}
                                    {item.type === "email" && (
                                      <div className="space-y-1 text-xs text-muted-foreground mb-3 p-2 bg-muted/30 rounded">
                                        {item.emailSubject && (
                                          <div>
                                            <span className="font-medium">
                                              Subject:
                                            </span>{" "}
                                            {item.emailSubject}
                                          </div>
                                        )}
                                        {item.emailPreheader && (
                                          <div>
                                            <span className="font-medium">
                                              Preheader:
                                            </span>{" "}
                                            {item.emailPreheader}
                                          </div>
                                        )}
                                        <div>
                                          <span className="font-medium">
                                            Date:
                                          </span>{" "}
                                          {format(item.date, "MMM d, yyyy")}
                                        </div>
                                      </div>
                                    )}

                                    <h4 className="font-medium group-hover/content:text-primary transition-colors">
                                      {item.title}
                                    </h4>

                                    {/* Content display */}
                                    {item.type === "email" ? (
                                      <div className="text-sm text-muted-foreground group-hover/content:text-foreground transition-colors">
                                        <SafeHtml
                                          content={item.caption}
                                          type="general"
                                          className="prose prose-sm max-w-none"
                                        />
                                      </div>
                                    ) : item.type === "blog" ? (
                                      <div className="text-sm text-muted-foreground group-hover/content:text-foreground transition-colors">
                                        {(() => {
                                          const fullContent =
                                            item.enhancedContent?.fullContent ||
                                            item.caption;
                                          const isExpanded = expandedBlogs.has(
                                            item.id,
                                          );
                                          const shouldTruncate =
                                            fullContent.length > 300;
                                          const displayContent =
                                            isExpanded || !shouldTruncate
                                              ? fullContent
                                              : truncateText(fullContent, 300);

                                          return (
                                            <>
                                              <div
                                                className="prose prose-sm max-w-none [&>*]:text-justify"
                                                dangerouslySetInnerHTML={{
                                                  __html:
                                                    renderMarkdownToMagazineHtml(
                                                      displayContent,
                                                    ),
                                                }}
                                              />
                                              {shouldTruncate && (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleBlogExpansion(
                                                      item.id,
                                                    );
                                                  }}
                                                  className="text-xs text-primary hover:text-primary/80 font-medium mt-2 block transition-colors"
                                                >
                                                  {isExpanded
                                                    ? "Show less"
                                                    : "Click to see more"}
                                                </button>
                                              )}
                                              {item.enhancedContent
                                                ?.fullContent &&
                                                item.enhancedContent.fullContent
                                                  .length > 200 && (
                                                  <div className="text-xs text-muted-foreground mt-2">
                                                    {
                                                      item.enhancedContent
                                                        .fullContent.length
                                                    }{" "}
                                                    characters
                                                  </div>
                                                )}
                                            </>
                                          );
                                        })()}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-muted-foreground group-hover/content:text-foreground transition-colors">
                                        {item.caption}
                                      </p>
                                    )}
                                    {item.imageUrl && (
                                      <div className="flex flex-wrap items-center gap-2">
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500 bg-opacity-20 text-sm text-green-600 font-medium">
                                          <Check className="h-3.5 w-3.5" />
                                          <span>Image selected</span>
                                        </div>
                                        {item.imageMetadata?.source ===
                                          "gallery-reuse" && (
                                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500 bg-opacity-15 text-sm text-blue-700 font-medium">
                                            <Sparkles className="h-3.5 w-3.5" />
                                            <span>From library</span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    {showImageFailureState && (
                                      <div className="flex items-start justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                                        <div className="flex items-start gap-2 text-red-700">
                                          <AlertTriangle className="h-4 w-4 mt-0.5" />
                                          <div>
                                            <p className="text-sm font-medium">
                                              Image generation failed
                                            </p>
                                            <p className="text-xs text-red-600">
                                              {item.imageError ||
                                                "This post still needs an image before launch."}
                                            </p>
                                          </div>
                                        </div>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="border-red-200 bg-white text-red-700 hover:bg-red-100"
                                          disabled={isRetryingImage}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            void handleRetrySingleImage(item);
                                          }}
                                        >
                                          {isRetryingImage
                                            ? "Generating..."
                                            : "Auto Pick"}
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-8">
        <Button
          variant="outline"
          onClick={onBack}
          size="lg"
          className="px-8"
          disabled={isLoading}
        >
          Back
        </Button>
        <Button
          onClick={onNext}
          size="lg"
          className="px-8"
          disabled={isLoading || state.items.length === 0}
        >
          Review & Launch
        </Button>
      </div>

      {/* Social Post Preview Modal */}
      {previewItem && (
        <SocialPostPreviewModal
          open={true}
          onClose={() => setPreviewItem(null)}
          platform={previewPlatform}
          onPlatformChange={(platform) => setPreviewPlatform(platform)}
          accountName="Your Business"
          caption={previewItem.caption}
          mediaUrl={previewItem.imageUrl || ""}
        />
      )}
    </div>
  );
};
