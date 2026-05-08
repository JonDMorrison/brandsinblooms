import { supabase } from "@/integrations/supabase/client";

export interface GenerateImageForChannelParams {
  prompt: string;
  userId: string;
  channel: "newsletter" | "blog" | "instagram" | "facebook";
  contentTitle: string;
  signal?: AbortSignal;
}

export interface GenerateImageForChannelResult {
  imageUrl: string | null;
  imageId?: string;
  globalImageId?: string;
  metadata?: {
    prompt?: string;
    generationTime?: number;
    storagePath?: string;
    channel?: string;
    tags?: unknown[];
    [key: string]: unknown;
  };
  error: string | null;
  aborted?: boolean;
}

export async function generateImageForChannel(
  params: GenerateImageForChannelParams,
): Promise<GenerateImageForChannelResult> {
  try {
    const { data, error } = await supabase.functions.invoke(
      "generate-ai-image",
      {
        body: {
          contentContext: params.prompt,
          contentTitle: params.contentTitle,
          channel: params.channel,
          uploadToStorage: true,
          userId: params.userId,
        },
        signal: params.signal,
      },
    );

    if (error) {
      return {
        imageUrl: null,
        error:
          error instanceof Error
            ? error.message
            : `Edge function error: ${JSON.stringify(error)}`,
      };
    }

    const imageUrl =
      typeof data?.imageUrl === "string" ? data.imageUrl.trim() : "";

    if (!imageUrl || !imageUrl.startsWith("http")) {
      return {
        imageUrl: null,
        imageId: data?.imageId,
        globalImageId: data?.globalImageId,
        metadata: data?.metadata,
        error: `Invalid image URL received: ${JSON.stringify(data)?.slice(0, 200)}`,
      };
    }

    return {
      imageUrl,
      imageId: data?.imageId,
      globalImageId: data?.globalImageId,
      metadata: data?.metadata,
      error: null,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return {
        imageUrl: null,
        error: "Generation cancelled",
        aborted: true,
      };
    }

    return {
      imageUrl: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
