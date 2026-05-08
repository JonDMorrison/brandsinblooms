import { supabase } from "@/integrations/supabase/client";
import {
  searchGalleryForPost,
  type GallerySearchChannel,
} from "@/services/imageGallerySearch";

interface ResolveImageParams {
  imageQuery: string;
  contentTitle: string;
  channel: GallerySearchChannel;
  tenantId: string;
  userId: string;
  forceGenerate?: boolean;
}

export interface ResolvedImageResult {
  imageUrl: string;
  globalImageId?: string;
  source: "gallery-reuse" | "ai_generated";
  matchedTags?: string[];
  matchScore?: number;
  storagePath?: string;
  tags?: string[];
  generationTime?: number;
}

function normalizeGeneratedTags(rawTags: unknown): string[] {
  if (!Array.isArray(rawTags)) {
    return [];
  }

  return rawTags
    .map((tag) => {
      if (typeof tag === "string") {
        return tag;
      }

      if (
        tag &&
        typeof tag === "object" &&
        "name" in tag &&
        typeof tag.name === "string"
      ) {
        return tag.name;
      }

      return null;
    })
    .filter((tag): tag is string => Boolean(tag));
}

export async function resolveImage(
  params: ResolveImageParams,
): Promise<ResolvedImageResult> {
  if (!params.forceGenerate) {
    const galleryMatch = await searchGalleryForPost({
      imageQuery: params.imageQuery,
      contentTitle: params.contentTitle,
      channel: params.channel,
      tenantId: params.tenantId,
    });

    if (galleryMatch) {
      return {
        imageUrl: galleryMatch.publicUrl,
        globalImageId: galleryMatch.imageId,
        source: "gallery-reuse",
        matchedTags: galleryMatch.matchedTags,
        matchScore: galleryMatch.matchScore,
        storagePath: galleryMatch.storagePath,
      };
    }
  }

  const contentContext = params.imageQuery.trim() || params.contentTitle.trim();
  const { data, error } = await supabase.functions.invoke("generate-ai-image", {
    body: {
      channel: params.channel,
      contentContext: contentContext || "seasonal garden content",
      contentTitle: params.contentTitle,
      storageBucket: "global-ai-images",
      uploadToStorage: true,
      userId: params.userId,
    },
  });

  if (error || !data?.imageUrl) {
    throw new Error(error?.message || "Failed to generate image");
  }

  return {
    imageUrl: data.imageUrl,
    globalImageId: data.globalImageId || undefined,
    source: "ai_generated",
    storagePath: data.metadata?.storagePath,
    tags: normalizeGeneratedTags(data.metadata?.tags),
    generationTime: data.metadata?.generationTime,
  };
}
