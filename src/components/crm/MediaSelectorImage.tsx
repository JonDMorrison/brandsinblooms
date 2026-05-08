import React, { useState, useImperativeHandle, forwardRef } from "react";
import { AlertTriangle, Camera, Upload, Sparkles, Wand2 } from "lucide-react";
import { AIImageLoadingOverlay } from "@/components/ui-legacy/AIImageLoadingOverlay";
import { useAIImageStudio } from "@/hooks/useAIImageStudio";
import { useToast } from "@/hooks/use-toast";
import { useAIImageGeneration } from "@/hooks/useAIImageGeneration";
import { getCurrentSeason } from "@/utils/seasonalUtils";

interface MediaSelectorImageProps {
  src?: string;
  onChange?: (src: string, metadata?: Record<string, unknown>) => void;
  contentContext?: string;
  className?: string;
  month?: string;
  weekNumber?: number;
  contentType?: "facebook" | "instagram" | "blog";
  imageGenerationStatus?: string | null;
}

export interface MediaSelectorImageHandle {
  openDialog: () => void;
}

// Helper function to get seasonal search query based on current date
const getSeasonalSearchQuery = (): string => {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const day = now.getDate();

  // Christmas season (Dec 1 - Dec 31)
  if (month === 11) {
    return "christmas decorations garden winter holidays";
  }

  // New Year / Winter (Jan 1 - Feb 28)
  if (month === 0 || month === 1) {
    return "winter garden snow frost evergreen";
  }

  // Early Spring (Mar 1 - Apr 30)
  if (month === 2 || month === 3) {
    return "spring flowers bloom garden tulips daffodils";
  }

  // Late Spring / Early Summer (May 1 - Jun 30)
  if (month === 4 || month === 5) {
    return "summer garden roses colorful flowers sunshine";
  }

  // Summer (Jul 1 - Aug 31)
  if (month === 6 || month === 7) {
    return "summer garden vegetables tomatoes sunflowers";
  }

  // Fall (Sep 1 - Oct 31)
  if (month === 8 || month === 9) {
    return "fall autumn garden pumpkins harvest leaves";
  }

  // Halloween / Thanksgiving prep (Nov 1 - Nov 30)
  if (month === 10) {
    if (day < 15) {
      return "fall garden harvest pumpkins mums chrysanthemums";
    } else {
      return "thanksgiving autumn harvest garden decorations";
    }
  }

  // Default fallback
  return "beautiful garden flowers plants";
};

export const MediaSelectorImage = forwardRef<
  MediaSelectorImageHandle,
  MediaSelectorImageProps
>(
  (
    {
      src = "",
      onChange,
      contentContext = "",
      className = "",
      month,
      weekNumber,
      contentType,
      imageGenerationStatus,
    },
    ref,
  ) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [isAutoPickGenerating, setIsAutoPickGenerating] = useState(false);
    const { toast } = useToast();
    const { generateSingleImage } = useAIImageGeneration();
    const { open } = useAIImageStudio();
    const hasImageFailure = imageGenerationStatus === "failed";

    // Expose openDialog method to parent components
    useImperativeHandle(ref, () => ({
      openDialog: () => {
        open({
          browseOnly: true,
          channel: contentType,
          contentContext,
          contextLabel: "Choose an image from your library, uploads, or AI.",
          defaultTab: "my-images",
          onSelect: handleImageSelect,
        });
      },
    }));

    const handleImageSelect = (
      imageUrl: string,
      metadata?: Record<string, unknown>,
    ) => {
      if (onChange) {
        onChange(imageUrl, metadata);
      } else {
        console.error("[MediaSelectorImage] onChange prop is missing!");
      }
    };

    const handleSelectClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      open({
        browseOnly: true,
        channel: contentType,
        contentContext,
        contextLabel: "Choose an image from your library, uploads, or AI.",
        defaultTab: "my-images",
        onSelect: handleImageSelect,
      });
    };

    // Handle Auto Pick button click
    const handleAutoPick = async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!onChange) return;

      setIsAutoPickGenerating(true);
      setIsGenerating(true);

      try {
        // Check if contentContext is available
        const hasValidContent =
          contentContext && contentContext.trim().length > 0;

        let contentCtx = "";
        let contentTitle = "";

        if (hasValidContent) {
          // Generate image based on contentContext
          contentCtx = contentContext;
          contentTitle = contentContext.substring(0, 100);
        } else {
          // Generate image based on garden, flowers, and current season
          const { season } = getCurrentSeason();
          contentCtx = `A beautiful garden scene with flowers and plants in ${season}. Vibrant colors and blooming flowers appropriate for the ${season} season.`;
          contentTitle = `${season.charAt(0).toUpperCase() + season.slice(1)} Garden Scene`;
        }
        const imageUrl = await generateSingleImage({
          contentContext: contentCtx,
          contentTitle,
          channel: contentType || "newsletter",
          uploadToStorage: true,
        });

        if (imageUrl) {
          onChange(imageUrl);
          toast({
            title: "Image generated!",
            description: "Your image has been added successfully.",
          });
        } else {
          throw new Error("Failed to generate image");
        }
      } catch (error: unknown) {
        console.error("[MediaSelectorImage] Auto Pick failed:", error);
        toast({
          title: "Generation failed",
          description: "Unable to generate image. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsAutoPickGenerating(false);
        setIsGenerating(false);
      }
    };

    return (
      <>
        <div
          className={`relative group w-full h-48 rounded-lg overflow-hidden flex items-center justify-center border-2 border-dashed transition-colors ${hasImageFailure ? "border-red-300 bg-red-50 hover:border-red-400" : "border-gray-300 bg-gray-100 hover:border-gray-400"} ${className}`}
        >
          {isGenerating && (
            <AIImageLoadingOverlay message="AI is creating your garden image..." />
          )}

          {src ? (
            <img
              src={src}
              alt="Selected content"
              className="object-cover w-full h-full"
              onLoad={() => {}}
              onError={(e) => console.error("🖼️ Image failed to load:", src, e)}
            />
          ) : (
            <div
              className={`text-center ${hasImageFailure ? "text-red-500" : "text-gray-400"}`}
            >
              {hasImageFailure ? (
                <AlertTriangle className="w-12 h-12 mx-auto mb-2" />
              ) : (
                <Camera className="w-12 h-12 mx-auto mb-2" />
              )}
              <span className="text-sm">
                {hasImageFailure
                  ? "Image generation failed"
                  : "No image selected"}
              </span>
            </div>
          )}

          {!isGenerating && (
            <div
              className={`absolute inset-0 transition-opacity flex flex-col gap-2 items-center justify-center z-50 pointer-events-none ${hasImageFailure ? "opacity-100 bg-red-950/5" : "opacity-0 group-hover:opacity-100"}`}
            >
              <button
                onClick={handleSelectClick}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors pointer-events-auto"
              >
                <Upload className="w-4 h-4" />
                Select Image
              </button>
              <button
                onClick={handleAutoPick}
                disabled={isAutoPickGenerating}
                className="bg-accent hover:bg-accent/90 text-accent-foreground px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed pointer-events-auto"
              >
                <Wand2 className="w-4 h-4" />
                {isAutoPickGenerating ? "Generating..." : "Auto Pick"}
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  open({
                    channel: contentType,
                    contentContext,
                    contextLabel:
                      "Generate with AI or switch to your saved images.",
                    defaultTab: "ai",
                    onSelect: handleImageSelect,
                  });
                }}
                className="bg-secondary hover:bg-secondary/90 text-secondary-foreground px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors pointer-events-auto"
              >
                <Sparkles className="w-4 h-4" />
                Generate with AI
              </button>
            </div>
          )}
        </div>

        {hasImageFailure && !src && (
          <p className="mt-2 text-sm text-red-600">
            Auto Pick uses your saved image prompt. You can retry now or choose
            an image manually.
          </p>
        )}
      </>
    );
  },
);
