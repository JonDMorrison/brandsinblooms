/**
 * Unified AI Image Generation Hook
 * Centralized hook for all AI image generation with parallel support
 */

import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AIImageGenerationOptions {
  contentContext: string;
  contentTitle?: string;
  channel: "newsletter" | "blog" | "instagram" | "facebook";
  uploadToStorage?: boolean;
  signal?: AbortSignal;
  providerOptions?: Record<string, unknown>;
}

export interface AIImageGenerationResult {
  imageUrl: string | null;
  imageId?: string;
  globalImageId?: string;
  metadata?: {
    prompt?: string;
    generationTime?: number;
    [key: string]: unknown;
  };
  error?: string;
  aborted?: boolean;
}

interface UseAIImageGenerationReturn {
  generateSingleImage: (
    options: AIImageGenerationOptions,
  ) => Promise<string | null>;
  generateSingleImageDetailed: (
    options: AIImageGenerationOptions,
  ) => Promise<AIImageGenerationResult>;
  generateMultipleImages: (
    options: AIImageGenerationOptions[],
  ) => Promise<Array<string | null>>;
  generateMultipleImagesDetailed: (
    options: AIImageGenerationOptions[],
  ) => Promise<AIImageGenerationResult[]>;
  abortGeneration: () => void;
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
  const abortControllerRef = useRef<AbortController | null>(null);

  const abortGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsGenerating(false);
  }, []);

  const connectAbortSignal = useCallback((signal?: AbortSignal) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (!signal) {
      return {
        signal: controller.signal,
        cleanup: () => {
          if (abortControllerRef.current === controller) {
            abortControllerRef.current = null;
          }
        },
      };
    }

    if (signal.aborted) {
      controller.abort();
    }

    const relayAbort = () => {
      controller.abort();
    };

    signal.addEventListener("abort", relayAbort, { once: true });

    return {
      signal: controller.signal,
      cleanup: () => {
        signal.removeEventListener("abort", relayAbort);
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      },
    };
  }, []);

  const invokeImageGeneration = useCallback(
    async (
      options: AIImageGenerationOptions,
      signal?: AbortSignal,
    ): Promise<AIImageGenerationResult> => {
      if (!user) {
        return {
          imageUrl: null,
          error: "No authenticated user found",
        };
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
              ...options.providerOptions,
            },
            signal,
          },
        );

        if (error) {
          throw error;
        }

        return {
          imageUrl: data?.imageUrl ?? null,
          imageId: data?.imageId,
          globalImageId: data?.globalImageId,
          metadata: data?.metadata,
        };
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return {
            imageUrl: null,
            aborted: true,
            error: "Generation cancelled",
          };
        }

        console.error("AI image generation error:", error);
        return {
          imageUrl: null,
          error:
            error instanceof Error
              ? error.message
              : "Unknown image generation error",
        };
      }
    },
    [user],
  );

  const generateSingleImageDetailed = useCallback(
    async (
      options: AIImageGenerationOptions,
    ): Promise<AIImageGenerationResult> => {
      if (!user) {
        console.error("No user found for AI image generation");
        return {
          imageUrl: null,
          error: "No authenticated user found",
        };
      }

      setIsGenerating(true);
      setProgress({ completed: 0, total: 1 });
      setErrors([]);

      const { cleanup, signal } = connectAbortSignal(options.signal);

      try {
        const result = await invokeImageGeneration(options, signal);

        if (result.error && !result.aborted) {
          setErrors([{ index: 0, error: result.error }]);
        }

        setProgress({ completed: 1, total: 1 });
        return result;
      } finally {
        cleanup();
        setIsGenerating(false);
      }
    },
    [connectAbortSignal, invokeImageGeneration, user],
  );

  const generateSingleImage = useCallback(
    async (options: AIImageGenerationOptions): Promise<string | null> => {
      const result = await generateSingleImageDetailed(options);
      return result.imageUrl;
    },
    [generateSingleImageDetailed],
  );

  const generateMultipleImagesDetailed = useCallback(
    async (
      optionsArray: AIImageGenerationOptions[],
    ): Promise<AIImageGenerationResult[]> => {
      if (!user) {
        console.error("No user found for AI image generation");
        return optionsArray.map(() => ({
          imageUrl: null,
          error: "No authenticated user found",
        }));
      }

      setIsGenerating(true);
      setProgress({ completed: 0, total: optionsArray.length });
      setErrors([]);

      const { cleanup, signal } = connectAbortSignal();

      try {
        const imagePromises = optionsArray.map(async (options, index) => {
          const result = await invokeImageGeneration(options, signal);

          if (result.error && !result.aborted) {
            console.error(
              `Failed to generate image ${index + 1}:`,
              result.error,
            );
            setErrors((prev) => [
              ...prev,
              { index, error: result.error ?? "Unknown error" },
            ]);
          }

          if (result.aborted) {
            setProgress((prev) => ({ ...prev, completed: prev.completed + 1 }));
            return result;
          }

          setProgress((prev) => ({ ...prev, completed: prev.completed + 1 }));
          return result;
        });

        const results = await Promise.all(imagePromises);
        return results;
      } finally {
        cleanup();
        setIsGenerating(false);
      }
    },
    [connectAbortSignal, invokeImageGeneration, user],
  );

  const generateMultipleImages = useCallback(
    async (
      optionsArray: AIImageGenerationOptions[],
    ): Promise<Array<string | null>> => {
      const results = await generateMultipleImagesDetailed(optionsArray);
      return results.map((result) => result.imageUrl);
    },
    [generateMultipleImagesDetailed],
  );

  return {
    generateSingleImage,
    generateSingleImageDetailed,
    generateMultipleImages,
    generateMultipleImagesDetailed,
    abortGeneration,
    isGenerating,
    progress,
    errors,
  };
};
