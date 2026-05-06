import { useState, useEffect } from "react";
import {
  getRelevantFallbacks,
  formatFallbackImages,
} from "@/services/gardenCenterFallbacks";
import { extractImageSummary } from "@/utils/imageContentSummary";

interface ImageSuggestion {
  id: string;
  thumb_url: string;
  download_url: string;
  alt: string;
  photographer: string;
  query: string;
  source?: string;
}

// Generate exactly 4 curated garden center placeholder images
const getGardenCenterPlaceholderImages = (
  query: string,
  postType: string,
): ImageSuggestion[] => {
  // Get curated garden center fallback images
  const fallbackImages = getRelevantFallbacks(query, 4);
  const formattedImages = formatFallbackImages(fallbackImages, query);
  return formattedImages;
};

// Smart content analysis to extract meaningful keywords
const extractKeywordsFromContent = (
  content: string,
  campaignTitle?: string,
): string[] => {
  if (!content || content.trim().length < 10) {
    return campaignTitle ? [campaignTitle] : ["garden center"];
  }

  // Clean HTML tags and decode entities
  let cleanContent = content
    .replace(/<[^>]*>/g, " ") // Remove HTML tags
    .replace(/&[^;]+;/g, " ") // Remove HTML entities
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
  // Look for specific themes first - prioritize specific plant/flower terms
  const themes = {
    specificFlowers:
      /\b(hydrangea|hydrangeas|zinnia|marigold|petunia|impatiens|sunflower|dahlia|cosmos|salvia|begonia|geranium|pansy|violet|rose|roses|tulip|tulips|daffodil|daffodils|lily|lilies|chrysanthemum|azalea|rhododendron)\b/gi,
    summerPlants:
      /\b(summer|bloom|flowering|heat.?tolerant|drought.?resistant|full.?sun|vibrant|colorful)\b/gi,
    plants:
      /\b(plant|flower|garden|bloom|seed|soil|grow|botanical|herb|vegetable|tree|shrub)\b/gi,
    outdoor:
      /\b(outdoor|patio|deck|yard|landscape|backyard|sunshine|fresh air)\b/gi,
    tools:
      /\b(tool|shovel|rake|hose|fertilizer|mulch|compost|pruning|watering)\b/gi,
    seasonal:
      /\b(spring|summer|fall|autumn|winter|seasonal|planting|harvest)\b/gi,
    holiday: /\b(holiday|celebration|month|day|national|festival|special)\b/gi,
  };

  const foundThemes = [];
  for (const [theme, regex] of Object.entries(themes)) {
    const matches = cleanContent.match(regex);
    if (matches && matches.length > 0) {
      foundThemes.push({
        theme,
        count: matches.length,
        terms: matches.slice(0, 3),
      });
    }
  }
  // If we found specific themes, use those
  if (foundThemes.length > 0) {
    const topTheme = foundThemes.sort((a, b) => b.count - a.count)[0];
    const keywords = topTheme.terms.map((term) => term.toLowerCase());
    return keywords;
  }

  // Extract meaningful words as fallback
  const words = cleanContent
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(
      (word) =>
        word.length > 3 &&
        ![
          "your",
          "this",
          "that",
          "they",
          "them",
          "their",
          "here",
          "there",
          "when",
          "what",
          "where",
          "how",
          "why",
          "who",
          "will",
          "have",
          "been",
          "with",
          "from",
          "about",
          "into",
          "through",
          "during",
          "before",
          "after",
          "above",
          "below",
          "between",
          "among",
          "throughout",
          "alongside",
          "within",
        ].includes(word),
    )
    .slice(0, 5);
  return words.length > 0 ? words : ["garden center"];
};

// Check if keywords contain specific flower names
const isSpecificFlower = (keywords: string[]): boolean => {
  const specificFlowers = [
    "hydrangea",
    "hydrangeas",
    "zinnia",
    "marigold",
    "petunia",
    "impatiens",
    "sunflower",
    "dahlia",
    "cosmos",
    "salvia",
    "begonia",
    "geranium",
    "pansy",
    "violet",
    "rose",
    "roses",
    "tulip",
    "tulips",
    "daffodil",
    "daffodils",
    "lily",
    "lilies",
    "chrysanthemum",
    "azalea",
    "rhododendron",
  ];

  return keywords.some((keyword) =>
    specificFlowers.some((flower) => keyword.toLowerCase().includes(flower)),
  );
};

// Build smart search query using the new image summary system
const buildSmartQuery = (
  keywords: string[],
  postType: string,
  campaignTitle?: string,
): string => {
  // Use the new image summary system instead of complex keyword logic
  const content =
    keywords.join(" ") + (campaignTitle ? ` ${campaignTitle}` : "");
  return extractImageSummary(content);
};

export const useImageSuggestions = (
  contentTaskId?: string,
  postType?: string,
) => {
  const [images, setImages] = useState<ImageSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [usingPlaceholders, setUsingPlaceholders] = useState(false);
  const [hasStoredImages, setHasStoredImages] = useState(false);

  const fetchStoredImages = async (taskId: string) => {
    void taskId;
    setHasStoredImages(false);
    return false;
  };

  const fetchNewImages = async (
    searchQuery: string,
    taskId?: string,
    contentType?: string,
    content?: string,
    campaignTitle?: string,
  ) => {
    // Prevent redundant fetches if we already have stored images
    if (hasStoredImages && images.length > 0 && !searchQuery) {
      return;
    }

    setLoading(true);
    try {
      let finalQuery = searchQuery;

      // If we have content, do smart analysis
      if (content && content.trim().length > 10) {
        const smartKeywords = extractKeywordsFromContent(
          content,
          campaignTitle,
        );
        finalQuery = buildSmartQuery(
          smartKeywords,
          contentType || "instagram",
          campaignTitle,
        );
      } else if (campaignTitle) {
        // Use campaign title as fallback
        const titleKeywords = extractKeywordsFromContent(campaignTitle);
        finalQuery = buildSmartQuery(titleKeywords, contentType || "instagram");
      }
      const placeholders = getGardenCenterPlaceholderImages(
        finalQuery,
        contentType || "instagram",
      );
      setImages(placeholders);
      setQuery(finalQuery);
      setUsingPlaceholders(true);
      setHasStoredImages(false);
    } catch (error) {
      console.error("[IMAGE_HOOK] Error fetching images:", error);

      const placeholders = getGardenCenterPlaceholderImages(
        searchQuery,
        postType || "instagram",
      );
      setImages(placeholders);
      setQuery(searchQuery);
      setUsingPlaceholders(true);
      setHasStoredImages(false);
    } finally {
      setLoading(false);
    }
  };

  const shuffleImages = async () => {
    if (query) {
      await fetchNewImages(query, contentTaskId, postType);
    }
  };

  // Only load stored images on mount - don't auto-generate
  useEffect(() => {
    if (contentTaskId) {
      fetchStoredImages(contentTaskId);
    }
  }, [contentTaskId]);

  return {
    images,
    loading,
    query,
    hasStoredImages,
    fetchNewImages,
    shuffleImages,
    fetchStoredImages,
    usingPlaceholders,
  };
};
