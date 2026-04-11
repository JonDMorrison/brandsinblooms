/**
 * Unified AI Image Generation Hook
 * Centralized hook for all AI image generation with parallel support
 */

import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface AIImageGenerationOptions {
  contentContext: string;
  contentTitle?: string;
  channel: "newsletter" | "blog" | "instagram" | "facebook";
  uploadToStorage?: boolean;
}

interface ImageResult {
  imageUrl: string | null;
  imageId?: string;
  metadata?: {
    prompt?: string;
    generationTime?: number;
  };
  error?: string;
}

interface UseAIImageGenerationReturn {
  generateSingleImage: (
    options: AIImageGenerationOptions,
  ) => Promise<string | null>;
  generateMultipleImages: (
    options: AIImageGenerationOptions[],
  ) => Promise<Array<string | null>>;
  isGenerating: boolean;
  progress: { completed: number; total: number };
  errors: Array<{ index: number; error: string }>;
}

export const useAIImageGeneration = (): UseAIImageGenerationReturn => {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [errors, setErrors] = useState<Array<{ index: number; error: string }>>(
    [],
  );

  const generateSingleImage = useCallback(
    async (options: AIImageGenerationOptions): Promise<string | null> => {
      if (!user) {
        console.error("❌ No user found for AI image generation");
        return null;
      }

      try {
        const { data, error } = await supabase.functions.invoke(
          "generate-ai-image",
          {
            body: {
              contentContext: options.contentContext,
              contentTitle: options.contentTitle,
              channel: options.channel,
              uploadToStorage: options.uploadToStorage ?? true,
              userId: user.id,
            },
          },
        );

        if (error) {
          console.error("❌ AI image generation error:", error);
          throw error;
        }
        return data.imageUrl;
      } catch (error: any) {
        console.error("❌ Exception in generateSingleImage:", error);
        return null;
      }
    },
    [user],
  );

  const generateMultipleImages = useCallback(
    async (
      optionsArray: AIImageGenerationOptions[],
    ): Promise<Array<string | null>> => {
      if (!user) {
        console.error("❌ No user found for AI image generation");
        return optionsArray.map(() => null);
      }

      setIsGenerating(true);
      setProgress({ completed: 0, total: optionsArray.length });
      setErrors([]);
      try {
        const imagePromises = optionsArray.map(async (options, index) => {
          try {
            const { data, error } = await supabase.functions.invoke(
              "generate-ai-image",
              {
                body: {
                  contentContext: options.contentContext,
                  contentTitle: options.contentTitle,
                  channel: options.channel,
                  uploadToStorage: options.uploadToStorage ?? true,
                  userId: user.id,
                },
              },
            );

            if (error) {
              throw error;
            }

            setProgress((prev) => ({ ...prev, completed: prev.completed + 1 }));
            return data.imageUrl;
          } catch (error: any) {
            console.error(`❌ Failed to generate image ${index + 1}:`, error);
            setErrors((prev) => [...prev, { index, error: error.message }]);
            setProgress((prev) => ({ ...prev, completed: prev.completed + 1 }));
            return null;
          }
        });

        const results = await Promise.all(imagePromises);
        return results;
      } finally {
        setIsGenerating(false);
      }
    },
    [user],
  );

  return {
    generateSingleImage,
    generateMultipleImages,
    isGenerating,
    progress,
    errors,
  };
};
