import { useMemo, useState } from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import Divider from "@mui/joy/Divider";
import LinearProgress from "@mui/joy/LinearProgress";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Textarea from "@mui/joy/Textarea";
import Typography from "@mui/joy/Typography";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ProtectedPageWrapper } from "@/components/ProtectedPageWrapper";
import { PageContainer } from "@/components/joy/PageContainer";
import { CarouselImageSelector } from "@/components/social/CarouselImageSelector";
import { SocialPostPreviewModal } from "@/components/publish/preview/SocialPostPreviewModal";
import { useAIImageStudio } from "@/hooks/useAIImageStudio";
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  ImagePlus,
  Send,
  Sparkles,
  Wand2,
} from "lucide-react";
import { validateCarouselPost } from "@/utils/validateCarouselPost";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { resolveTenantMutationContext } from "@/utils/resolveTenantMutationContext";

const PLATFORM_LIMITS = {
  instagram: { caption: 2200, name: "Instagram" },
  facebook: { caption: 63206, name: "Facebook" },
} as const;

const PLATFORM_TIPS = {
  instagram: [
    "All images should share the same aspect ratio.",
    "Lead with the strongest image because it becomes the feed thumbnail.",
    "Use the caption to connect the slides into one clear story.",
  ],
  facebook: [
    "Mixed aspect ratios are allowed, but a consistent crop still reads better.",
    "The first image still carries most of the click-through weight.",
    "Treat the carousel like a mini-sequence instead of separate posts.",
  ],
} as const;

const CAROUSEL_STUDIO_TARGET_COUNT = {
  instagram: 5,
  facebook: 6,
} as const;

const CAROUSEL_STUDIO_ASPECT_RATIO = {
  instagram: "1:1",
  facebook: "16:9",
} as const;

const CAROUSEL_STUDIO_CONTEXT_CHANNEL = {
  instagram: "instagram_carousel",
  facebook: "facebook_carousel",
} as const;

const CarouselComposerPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const platform = (searchParams.get("platform") || "instagram") as
    | "instagram"
    | "facebook";
  const topicTitle = searchParams.get("topicTitle")?.trim() || "";
  const topicDescription = searchParams.get("topicDescription")?.trim() || "";

  const [caption, setCaption] = useState("");
  const [carouselImages, setCarouselImages] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [studioContinuation, setStudioContinuation] = useState<{
    lastFilledIndex: number;
    nextIndex: number;
  } | null>(null);
  const { open } = useAIImageStudio();

  const limits = PLATFORM_LIMITS[platform];
  const captionLength = caption.length;
  const generationContext =
    caption.trim() ||
    [topicTitle, topicDescription].filter(Boolean).join(". ") ||
    "Beautiful garden and nature scenes";
  const studioTargetCount = CAROUSEL_STUDIO_TARGET_COUNT[platform];
  const studioTopicTitle = topicTitle || `${limits.name} carousel`;
  const studioContextSnippet =
    (caption.trim() || topicDescription || generationContext)
      .trim()
      .slice(0, 100) || `${limits.name} carousel image`;

  const validation = useMemo(
    () =>
      validateCarouselPost(platform, {
        platform,
        accountId: "preview",
        caption,
        mediaUrls: carouselImages,
        isCarousel: true,
      }),
    [caption, carouselImages, platform],
  );

  const handleGenerateCaption = async () => {
    const promptSeed =
      caption.trim() ||
      [topicTitle, topicDescription].filter(Boolean).join(". ");

    if (!promptSeed) {
      toast.error("Add a topic or a draft caption first.");
      return;
    }

    setIsGeneratingCaption(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "generate-thinking-text",
        {
          body: {
            prompt: `Create an engaging ${platform} carousel caption based on this brief: ${promptSeed}. Make it concise, compelling, and optimized for ${platform} engagement. Include relevant emojis and hashtags when they help.`,
          },
        },
      );

      if (error) {
        throw error;
      }

      if (data?.thinking_text) {
        setCaption(data.thinking_text);
        toast.success("Caption enhanced with AI.");
      }
    } catch (error) {
      console.error("Failed to generate caption:", error);
      toast.error("Failed to generate caption.");
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  const openCarouselImageStudio = (
    slotIndex: number,
    options?: { continuationTargetCount?: number },
  ) => {
    const displayLimit = options?.continuationTargetCount || studioTargetCount;

    open({
      aspectRatioHint: CAROUSEL_STUDIO_ASPECT_RATIO[platform],
      assignmentLabel: `Slide ${slotIndex + 1}`,
      channel: platform,
      contentTitle: `${studioTopicTitle} - Slide ${slotIndex + 1}`,
      contentContext: `${limits.name} carousel image ${slotIndex + 1} for ${studioTopicTitle}${topicDescription ? ` - ${topicDescription}` : ""}`,
      context: {
        source: "content-generation",
        channel: CAROUSEL_STUDIO_CONTEXT_CHANNEL[platform],
        topicTitle: studioTopicTitle,
        topicDescription: topicDescription || generationContext,
        contentSnippet: studioContextSnippet,
      },
      contextLabel: `${limits.name} carousel slot ${slotIndex + 1} of ${displayLimit}`,
      contextType: "content_generation_carousel",
      defaultTab: "ai",
      initialPrompt: `${studioTopicTitle} - slide ${slotIndex + 1} ${limits.name} carousel image`,
      onSelect: (imageUrl) => {
        setCarouselImages((previousImages) => {
          const nextImages = [...previousImages];
          if (slotIndex >= nextImages.length) {
            nextImages.push(imageUrl);
          } else {
            nextImages[slotIndex] = imageUrl;
          }
          return nextImages;
        });

        if (
          options?.continuationTargetCount &&
          slotIndex + 1 < options.continuationTargetCount
        ) {
          setStudioContinuation({
            lastFilledIndex: slotIndex,
            nextIndex: slotIndex + 1,
          });
          return;
        }

        setStudioContinuation(null);
      },
    });
  };

  const handleOpenAddImageStudio = () => {
    if (carouselImages.length >= 10) {
      return;
    }

    setStudioContinuation(null);
    openCarouselImageStudio(carouselImages.length);
  };

  const handleStartSequentialStudioFill = () => {
    if (carouselImages.length >= studioTargetCount) {
      toast.message("All suggested carousel slots are already filled.");
      return;
    }

    setStudioContinuation(null);
    openCarouselImageStudio(carouselImages.length, {
      continuationTargetCount: studioTargetCount,
    });
  };

  const handleContinueStudioFill = () => {
    if (!studioContinuation) {
      return;
    }

    const nextIndex = studioContinuation.nextIndex;
    setStudioContinuation(null);
    openCarouselImageStudio(nextIndex, {
      continuationTargetCount: studioTargetCount,
    });
  };

  const handleCarouselImagesChange = (nextImages: string[]) => {
    setStudioContinuation(null);
    setCarouselImages(nextImages);
  };

  const handleImageSelect = (index: number) => {
    setStudioContinuation(null);
    openCarouselImageStudio(index);
  };

  const handlePublish = async () => {
    if (!validation.ok) {
      toast.error("Fix the validation errors before publishing.");
      return;
    }

    setIsPublishing(true);

    try {
      const { userId, tenantId } = await resolveTenantMutationContext({});
      const primaryImage = carouselImages[0];
      const attachments = {
        image: {
          url: primaryImage,
          alt: topicTitle || `${limits.name} carousel cover image`,
          thumb: primaryImage,
        },
        carousel: {
          isCarousel: true,
          mediaUrls: carouselImages,
          imageCount: carouselImages.length,
        },
      };

      const { data: createdTask, error: taskError } = await supabase
        .from("content_tasks")
        .insert({
          user_id: userId,
          tenant_id: tenantId,
          post_type: platform,
          ai_output: caption.trim(),
          image_url: primaryImage,
          attachments,
          image_metadata: {
            sourceCarouselComposer: {
              platform,
              topicTitle: topicTitle || null,
              topicDescription: topicDescription || null,
            },
          },
          status: "approved",
        })
        .select("id")
        .single();

      if (taskError) {
        throw taskError;
      }

      const { data: generatedContent, error: contentError } = await supabase
        .from("generated_content")
        .insert({
          user_id: userId,
          caption: caption.trim(),
          media_url: primaryImage,
          status: "DRAFT",
        })
        .select("id")
        .single();

      if (contentError) {
        throw contentError;
      }

      const { data, error } = await supabase.functions.invoke("publish-task", {
        body: {
          taskId: createdTask.id,
          contentId: generatedContent.id,
          platforms: [platform],
          caption: caption.trim(),
          imageUrl: primaryImage,
          mediaUrls: carouselImages,
          isCarousel: true,
        },
      });

      if (error) {
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.message || "Unknown publish error");
      }

      toast.success(`Carousel published to ${limits.name}.`);
      navigate("/content/library", {
        replace: true,
        state: {
          carouselPublishSuccess: true,
          carouselTopicTitle: topicTitle || null,
        },
      });
    } catch (error) {
      console.error("Failed to publish carousel:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to publish carousel. Please try again.",
      );
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <ProtectedPageWrapper>
      <PageContainer
        sx={{
          px: { xs: 2, md: 3 },
          py: { xs: 3, md: 4 },
          display: "flex",
          flexDirection: "column",
          gap: 3,
        }}
      >
        <Card
          variant="outlined"
          sx={{
            borderRadius: "28px",
            overflow: "hidden",
            borderColor: "neutral.200",
            background:
              "linear-gradient(135deg, rgba(var(--joy-palette-background-bodyChannel) / 0.98), rgba(var(--joy-palette-primary-mainChannel) / 0.08))",
          }}
        >
          {isPublishing ? <LinearProgress thickness={3} /> : null}
          <Stack
            direction={{ xs: "column", lg: "row" }}
            spacing={2}
            justifyContent="space-between"
            sx={{ p: { xs: 2.5, md: 3 } }}
          >
            <Stack spacing={1.25} sx={{ maxWidth: 760 }}>
              <Stack
                direction="row"
                spacing={1}
                useFlexGap
                flexWrap="wrap"
                alignItems="center"
              >
                <Button
                  variant="plain"
                  color="neutral"
                  startDecorator={<ArrowLeft size={16} />}
                  onClick={() => navigate("/content/library")}
                  sx={{ alignSelf: "flex-start", px: 0 }}
                >
                  Back to library
                </Button>
                <Chip size="sm" variant="soft" color="primary">
                  {limits.name} carousel
                </Chip>
                <Chip
                  size="sm"
                  variant="soft"
                  color={carouselImages.length >= 2 ? "success" : "neutral"}
                >
                  {`${carouselImages.length} images`}
                </Chip>
              </Stack>

              <Stack spacing={0.75}>
                <Typography level="h2">
                  Create {limits.name} carousel
                </Typography>
                <Typography
                  level="body-md"
                  sx={{ color: "neutral.600", maxWidth: 720 }}
                >
                  Build a multi-image carousel, refine the caption, and publish
                  it directly without leaving the composer.
                </Typography>
              </Stack>

              {topicTitle || topicDescription ? (
                <Sheet
                  variant="soft"
                  color="neutral"
                  sx={{ borderRadius: "20px", p: 2, maxWidth: 720 }}
                >
                  <Stack spacing={0.75}>
                    <Typography level="title-sm">
                      {topicTitle || "Campaign topic"}
                    </Typography>
                    {topicDescription ? (
                      <Typography level="body-sm" sx={{ color: "neutral.600" }}>
                        {topicDescription}
                      </Typography>
                    ) : null}
                  </Stack>
                </Sheet>
              ) : null}
            </Stack>

            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              useFlexGap
              alignSelf={{ lg: "flex-start" }}
            >
              <Button
                variant="soft"
                color="neutral"
                startDecorator={<Eye size={16} />}
                onClick={() => setShowPreview(true)}
                disabled={carouselImages.length < 2}
              >
                Preview
              </Button>
              <Button
                color="success"
                startDecorator={<Send size={16} />}
                loading={isPublishing}
                onClick={() => void handlePublish()}
                disabled={!validation.ok || isPublishing}
              >
                Publish carousel
              </Button>
            </Stack>
          </Stack>
        </Card>

        <Box
          sx={{
            display: "grid",
            gap: 3,
            gridTemplateColumns: {
              xs: "1fr",
              xl: "minmax(0, 1.5fr) minmax(340px, 0.9fr)",
            },
            alignItems: "start",
          }}
        >
          <Card
            variant="outlined"
            sx={{ borderRadius: "24px", p: { xs: 2, md: 2.5 }, gap: 2.5 }}
          >
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1.5}
              justifyContent="space-between"
              alignItems={{ xs: "stretch", md: "center" }}
            >
              <Stack spacing={0.5}>
                <Typography level="title-lg">Carousel images</Typography>
                <Typography level="body-sm" sx={{ color: "neutral.600" }}>
                  Add 2 to 10 images and reorder them into a single story arc.
                </Typography>
              </Stack>

              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                useFlexGap
              >
                <Button
                  variant="soft"
                  color="neutral"
                  startDecorator={<ImagePlus size={16} />}
                  onClick={handleOpenAddImageStudio}
                  disabled={carouselImages.length >= 10}
                >
                  Open AI Studio
                </Button>
                <Button
                  variant="soft"
                  color="primary"
                  startDecorator={<Wand2 size={16} />}
                  onClick={handleStartSequentialStudioFill}
                  disabled={carouselImages.length >= studioTargetCount}
                >
                  Generate images
                </Button>
              </Stack>
            </Stack>

            {studioContinuation ? (
              <Card
                variant="soft"
                color="primary"
                sx={{ borderRadius: "20px", p: 2, gap: 1.25 }}
              >
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  justifyContent="space-between"
                  alignItems={{ xs: "stretch", sm: "center" }}
                >
                  <Stack spacing={0.5}>
                    <Typography level="title-sm">
                      Image added to slot{" "}
                      {studioContinuation.lastFilledIndex + 1}
                    </Typography>
                    <Typography level="body-sm" sx={{ color: "neutral.700" }}>
                      Open AI Studio for slot {studioContinuation.nextIndex + 1}
                      ?
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button
                      variant="plain"
                      color="neutral"
                      onClick={() => setStudioContinuation(null)}
                    >
                      Not now
                    </Button>
                    <Button onClick={handleContinueStudioFill}>Continue</Button>
                  </Stack>
                </Stack>
              </Card>
            ) : null}

            <CarouselImageSelector
              images={carouselImages}
              onAddImage={handleOpenAddImageStudio}
              onChange={handleCarouselImagesChange}
              platform={platform}
              onImageClick={handleImageSelect}
            />
          </Card>

          <Stack spacing={2.5}>
            <Card
              variant="outlined"
              sx={{ borderRadius: "24px", p: { xs: 2, md: 2.5 }, gap: 2 }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1.5}
                justifyContent="space-between"
                alignItems={{ xs: "stretch", sm: "center" }}
              >
                <Stack spacing={0.5}>
                  <Typography level="title-lg">Caption</Typography>
                  <Typography level="body-sm" sx={{ color: "neutral.600" }}>
                    Use the topic brief or your own draft, then let AI tighten
                    it up.
                  </Typography>
                </Stack>

                <Button
                  variant="soft"
                  color="primary"
                  startDecorator={<Sparkles size={16} />}
                  loading={isGeneratingCaption}
                  onClick={() => void handleGenerateCaption()}
                >
                  Enhance caption
                </Button>
              </Stack>

              <Textarea
                minRows={9}
                maxRows={16}
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                placeholder={`Write your ${limits.name} carousel caption...`}
                maxLength={limits.caption}
              />

              <Stack
                direction="row"
                spacing={1}
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                  {captionLength.toLocaleString()}/
                  {limits.caption.toLocaleString()} characters
                </Typography>
                {captionLength > limits.caption * 0.9 ? (
                  <Chip size="sm" variant="soft" color="warning">
                    Approaching limit
                  </Chip>
                ) : null}
              </Stack>
            </Card>

            {validation.errors.length > 0 || validation.warnings.length > 0 ? (
              <Card
                variant="outlined"
                sx={{ borderRadius: "24px", p: { xs: 2, md: 2.5 }, gap: 1.5 }}
              >
                <Typography level="title-md">Validation</Typography>
                <Stack spacing={1.25}>
                  {validation.errors.map((error, index) => (
                    <Stack
                      key={`error-${index}`}
                      direction="row"
                      spacing={1}
                      alignItems="flex-start"
                    >
                      <AlertCircle size={16} />
                      <Typography level="body-sm" sx={{ color: "danger.700" }}>
                        {error}
                      </Typography>
                    </Stack>
                  ))}
                  {validation.warnings.map((warning, index) => (
                    <Stack
                      key={`warning-${index}`}
                      direction="row"
                      spacing={1}
                      alignItems="flex-start"
                    >
                      <AlertCircle size={16} />
                      <Typography level="body-sm" sx={{ color: "warning.700" }}>
                        {warning}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Card>
            ) : null}

            <Card
              variant="soft"
              color="neutral"
              sx={{ borderRadius: "24px", p: { xs: 2, md: 2.5 }, gap: 1.75 }}
            >
              <Stack spacing={0.75}>
                <Typography level="title-md">
                  {limits.name} carousel tips
                </Typography>
                <Typography level="body-sm" sx={{ color: "neutral.600" }}>
                  Keep the sequence coherent from slide one through the CTA on
                  the last frame.
                </Typography>
              </Stack>
              <Divider />
              <Stack spacing={1.25}>
                {PLATFORM_TIPS[platform].map((tip) => (
                  <Typography
                    key={tip}
                    level="body-sm"
                    sx={{ color: "neutral.700" }}
                  >
                    {tip}
                  </Typography>
                ))}
              </Stack>
            </Card>
          </Stack>
        </Box>
      </PageContainer>

      {showPreview && carouselImages.length >= 2 ? (
        <SocialPostPreviewModal
          open={showPreview}
          onClose={() => setShowPreview(false)}
          platform={platform}
          onPlatformChange={() => undefined}
          accountName="Your Account"
          caption={caption}
          mediaUrl={carouselImages[0]}
          mediaUrls={carouselImages}
          isCarousel
        />
      ) : null}
    </ProtectedPageWrapper>
  );
};

export default CarouselComposerPage;
