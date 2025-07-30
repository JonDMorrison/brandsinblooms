
/**
 * Dynamic Image Search Utilities
 * Extracts relevant topics from content tasks for Unsplash image searches
 */

import { extractImageSummary } from "./imageContentSummary";

interface ContentTask {
  ai_output?: string;
  post_type?: string;
  image_idea?: string;
  campaigns?: {
    title?: string;
    theme?: string;
    description?: string;
  };
}

interface CampaignData {
  title?: string;
  theme?: string;
  description?: string;
}

/**
 * Extracts dynamic search query from content task
 * Priority: campaign theme > image_idea > content keywords > post type
 */
export function extractDynamicQuery(
  task?: ContentTask | null, 
  campaign?: CampaignData | null,
  fallback = 'garden'
): string {
  console.log('[DYNAMIC QUERY] Extracting query from:', { task, campaign });
  
  // Priority 1: Use campaign title first (most specific)
  const campaignSource = campaign || task?.campaigns;
  if (campaignSource?.title) {
    const summary = extractImageSummary(campaignSource?.title);
    if (summary && !isGenericTerm(summary)) {
      console.log('[DYNAMIC QUERY] Using campaign title summary:', summary);
      return summary;
    }
  }
  
  // Priority 2: Use campaign theme
  if (campaignSource?.theme) {
    const summary = extractImageSummary(campaignSource.theme);
    if (summary && !isGenericTerm(summary)) {
      console.log('[DYNAMIC QUERY] Using campaign theme summary:', summary);
      return summary;
    }
  }
  
  // Priority 3: Use image_idea if available
  if (task?.image_idea) {
    const summary = extractImageSummary(task.image_idea);
    if (summary && !isGenericTerm(summary)) {
      console.log('[DYNAMIC QUERY] Using image idea summary:', summary);
      return summary;
    }
  }
  
  // Priority 4: Extract from AI output content
  if (task?.ai_output) {
    const summary = extractImageSummary(task.ai_output);
    if (summary && !isGenericTerm(summary)) {
      console.log('[DYNAMIC QUERY] Using AI output summary:', summary);
      return summary;
    }
  }
  
  console.log('[DYNAMIC QUERY] Using fallback:', fallback);
  return fallback;
}

/**
 * Checks if a term is too generic for good image results
 */
function isGenericTerm(term: string): boolean {
  const genericTerms = ['garden', 'plant', 'flower', 'care', 'tips', 'guide'];
  return genericTerms.includes(term.toLowerCase());
}

/**
 * Validates and cleans image queries to ensure quality results
 */
export function validateImageQuery(query: string): string {
  if (!query?.trim()) return 'garden';
  
  // Prioritize single words for better search results
  const words = query.trim().split(/\s+/);
  
  // If it's already a single word, return it
  if (words.length === 1) {
    return query.trim();
  }
  
  // For multi-word queries, try to extract the most relevant single word
  const relevantWords = words.filter(word => 
    word.length > 3 && 
    !['the', 'and', 'for', 'with', 'your', 'that', 'this', 'from', 'care', 'tips', 'guide'].includes(word.toLowerCase())
  );
  
  if (relevantWords.length > 0) {
    // Return just the first relevant word for cleaner searches
    return relevantWords[0];
  }
  
  // If no relevant words found, return the first word
  return words[0];
}

/**
 * Enhanced topic extraction for specific post types
 */
export function getEnhancedTopicForPostType(
  task?: ContentTask | null,
  campaign?: CampaignData | null
): string {
  return extractDynamicQuery(task, campaign);
}

/**
 * Fallback queries for different content types when dynamic extraction fails
 */
export function getContentTypeFallback(postType?: string): string {
  return 'garden';
}
