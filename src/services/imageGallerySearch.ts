import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { getCurrentSeason } from "@/utils/seasonalUtils";

export type GallerySearchChannel =
  | "newsletter"
  | "instagram"
  | "facebook"
  | "blog";

interface SearchGalleryForPostParams {
  imageQuery?: string;
  contentTitle?: string;
  channel: GallerySearchChannel;
  tenantId: string;
  minMatchCount?: number;
  minMatchScore?: number;
}

type GallerySearchRow =
  Database["public"]["Functions"]["find_images_by_tags"]["Returns"][number];

export interface GalleryImageMatch {
  imageId: string;
  publicUrl: string;
  storagePath?: string;
  matchedTags: string[];
  matchCount: number;
  matchScore: number;
  matchedConfidenceTotal: number;
  totalUsageCount: number;
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "by",
  "for",
  "from",
  "in",
  "into",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
  "your",
  "our",
  "this",
  "that",
  "these",
  "those",
  "image",
  "images",
  "photo",
  "photos",
  "post",
  "posts",
  "content",
  "social",
  "media",
]);

const TOKEN_REPLACEMENTS: Record<string, string> = {
  autumn: "fall",
};

function tokenizeText(text?: string): string[] {
  if (!text) {
    return [];
  }

  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => TOKEN_REPLACEMENTS[token] ?? token)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));

  return Array.from(new Set(tokens));
}

function pushUnique(target: string[], values: string[], maxSize: number) {
  for (const value of values) {
    if (!value || target.includes(value)) {
      continue;
    }

    target.push(value);

    if (target.length >= maxSize) {
      return;
    }
  }
}

function buildSearchTags(imageQuery?: string, contentTitle?: string): string[] {
  const imageQueryTags = tokenizeText(imageQuery);
  const titleTags = tokenizeText(contentTitle);

  if (imageQueryTags.length === 0 && titleTags.length === 0) {
    return [];
  }

  const searchTags: string[] = [];
  pushUnique(searchTags, imageQueryTags, 10);
  pushUnique(searchTags, [getCurrentSeason().season], 10);
  pushUnique(searchTags, titleTags, 10);

  return searchTags;
}

function rankGalleryResults(
  rows: GallerySearchRow[],
  totalSearchTags: number,
): GalleryImageMatch[] {
  const safeTagCount = Math.max(totalSearchTags, 1);

  return rows
    .map((row, index) => ({
      imageId: row.image_id,
      publicUrl: row.public_url,
      storagePath: row.storage_path || undefined,
      matchedTags: row.matched_tags ?? [],
      matchCount: row.match_count ?? 0,
      matchScore: Number(row.matched_confidence_total ?? 0) / safeTagCount,
      matchedConfidenceTotal: Number(row.matched_confidence_total ?? 0),
      totalUsageCount: row.total_usage_count ?? 0,
      originalIndex: index,
    }))
    .sort(
      (left, right) =>
        right.matchScore - left.matchScore ||
        right.matchCount - left.matchCount ||
        left.originalIndex - right.originalIndex,
    )
    .map(({ originalIndex: _originalIndex, ...result }) => result);
}

export async function searchGalleryForPost(
  params: SearchGalleryForPostParams,
): Promise<GalleryImageMatch | null> {
  const searchTags = buildSearchTags(params.imageQuery, params.contentTitle);

  if (searchTags.length === 0) {
    return null;
  }

  try {
    const { data, error } = await supabase.rpc("find_images_by_tags", {
      p_channel: params.channel,
      p_limit: 5,
      p_min_confidence: 0.7,
      p_tags: searchTags,
      p_tenant_id: params.tenantId,
    });

    if (error) {
      console.error("[imageGallerySearch] Gallery search failed:", error);
      return null;
    }

    const minMatchCount = params.minMatchCount ?? 2;
    const minMatchScore = params.minMatchScore ?? 0.5;

    return (
      rankGalleryResults(data ?? [], searchTags.length).find(
        (result) =>
          result.matchCount >= minMatchCount &&
          result.matchScore >= minMatchScore,
      ) ?? null
    );
  } catch (error) {
    console.error(
      "[imageGallerySearch] Unexpected gallery search error:",
      error,
    );
    return null;
  }
}
