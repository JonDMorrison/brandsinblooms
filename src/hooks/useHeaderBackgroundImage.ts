import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Stage = "waiting" | "aggregating" | "fetching" | "complete" | "error";

interface Block {
  type: string;
  content: any;
  isGenerating?: boolean;
  backgroundImageUrl?: string;
}

interface ImageMetadata {
  photographer?: string;
  unsplashId?: string;
  alt?: string;
  globalImageId?: string;
  generatedSubtitle?: string;
}

interface UseHeaderBackgroundImageProps {
  blocks: Block[];
  campaignTitle: string;
  onImageReady: (imageUrl: string, metadata: ImageMetadata) => void;
  enabled?: boolean;
}

export const useHeaderBackgroundImage = ({
  blocks,
  campaignTitle,
  onImageReady,
  enabled = true,
}: UseHeaderBackgroundImageProps) => {
  const [stage, setStage] = useState<Stage>("waiting");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const generateHeaderImage = useCallback(async () => {
    if (!enabled || !campaignTitle) {
      return;
    }

    setIsGenerating(true);
    setStage("aggregating");
    setError(null);

    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("No authenticated user");
      }

      // PHASE 3: Aggregate content from all possible locations
      const aggregatedContent = blocks
        .map((b) => {
          const content = b.content;
          // Read from all possible locations
          const parts = [
            content?.title,
            content?.subtitle,
            content?.content,
            content?.text,
            // Also check direct properties in case content is a string
            typeof content === "string" ? content : "",
          ];
          return parts.filter(Boolean).join(" ").trim();
        })
        .filter(Boolean)
        .join(" ");
      setStage("fetching");

      // Generate subtitle text based on aggregated content (5-9 words, one line)
      let generatedSubtitle = "";
      try {
        const { data: subtitleData, error: subtitleError } =
          await supabase.functions.invoke("generate-subtitle", {
            body: {
              contentContext: aggregatedContent,
              campaignTitle: campaignTitle,
            },
          });

        if (!subtitleError && subtitleData?.subtitle) {
          generatedSubtitle = subtitleData.subtitle.trim();
        }
      } catch (err) {
        // Continue without subtitle if generation fails
      }

      // Generate AI image directly from content
      const { data: imageData, error: imageError } =
        await supabase.functions.invoke("generate-ai-image", {
          body: {
            contentContext: aggregatedContent,
            contentTitle: campaignTitle,
            channel: "newsletter",
            uploadToStorage: true,
            userId: user.id,
          },
        });

      if (imageError) {
        throw new Error(`Image generation failed: ${imageError.message}`);
      }
      const metadata: ImageMetadata = {
        photographer: "AI Generated",
        unsplashId: imageData.imageId,
        globalImageId: imageData.globalImageId,
        alt: imageData.metadata?.prompt || campaignTitle,
        generatedSubtitle,
      };

      setStage("complete");
      onImageReady(imageData.imageUrl, metadata);

      toast({
        title: "Header image generated",
        description: "AI-powered background applied successfully",
      });
    } catch (err: any) {
      console.error("[HEADER-BG] Error:", err);
      setStage("error");
      setError(err.message || "Failed to generate header image");

      toast({
        title: "Could not generate header image",
        description: "Using default background instead",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [blocks, campaignTitle, enabled, onImageReady, toast]);

  // Monitor when all blocks are ready (have content and not generating)
  useEffect(() => {
    if (!enabled || isGenerating || stage === "complete") {
      return;
    }

    // CRITICAL: Check if header block already has an image - prevent regeneration
    const headerBlock = blocks.find(
      (b) => b.type === "header" || b.type === "newsletter-header",
    );
    if (headerBlock?.backgroundImageUrl) {
      setStage("complete"); // Mark as complete to prevent future triggers
      return;
    }

    const allBlocksReady =
      blocks.length > 0 &&
      blocks.every((b) => {
        const hasContent =
          b.content &&
          (b.content.title ||
            b.content.subtitle ||
            b.content.content ||
            b.content.text);
        const notGenerating = !b.isGenerating;
        return hasContent && notGenerating;
      });

    if (allBlocksReady && stage === "waiting") {
      // Small delay to ensure all content is fully rendered
      setTimeout(() => {
        generateHeaderImage();
      }, 1000);
    }
  }, [blocks, enabled, isGenerating, stage, generateHeaderImage]);

  const retry = useCallback(() => {
    setStage("waiting");
    setError(null);
    generateHeaderImage();
  }, [generateHeaderImage]);

  return {
    stage,
    isGenerating,
    error,
    retry,
  };
};
