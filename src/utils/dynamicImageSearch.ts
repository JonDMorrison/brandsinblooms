
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
  
  // Priority 1: Use image_idea if available
  if (task?.image_idea) {
    const summary = extractImageSummary(task.image_idea);
    if (summary && summary !== 'garden') {
      console.log('[DYNAMIC QUERY] Using image idea summary:', summary);
      return summary;
    }
  }
  
  // Priority 2: Extract from AI output content
  if (task?.ai_output) {
    const summary = extractImageSummary(task.ai_output);
    if (summary && summary !== 'garden') {
      console.log('[DYNAMIC QUERY] Using AI output summary:', summary);
      return summary;
    }
  }
  
  // Priority 3: Use campaign theme
  const campaignSource = campaign || task?.campaigns;
  if (campaignSource?.theme) {
    const summary = extractImageSummary(campaignSource.theme);
    if (summary && summary !== 'garden') {
      console.log('[DYNAMIC QUERY] Using campaign theme summary:', summary);
      return summary;
    }
  }
  
  // Priority 4: Use campaign title
  if (campaignSource?.title) {
    const summary = extractImageSummary(campaignSource.title);
    if (summary && summary !== 'garden') {
      console.log('[DYNAMIC QUERY] Using campaign title summary:', summary);
      return summary;
    }
  }
  
  console.log('[DYNAMIC QUERY] Using fallback:', fallback);
  return fallback;
}

// Legacy functions removed - now using extractImageSummary from imageContentSummary.ts

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
