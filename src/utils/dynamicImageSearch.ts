
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
 * Extracts dynamic search query from content task with strict topic adherence
 * Priority: exact campaign title match > campaign theme > image_idea > content keywords > post type
 */
export function extractDynamicQuery(
  task?: ContentTask | null, 
  campaign?: CampaignData | null,
  fallback = 'garden'
): string {
  console.log('[DYNAMIC QUERY] Extracting query from:', { task, campaign });
  
  // Priority 1: Use exact campaign title for topic-specific searches
  const campaignSource = campaign || task?.campaigns;
  if (campaignSource?.title) {
    const title = campaignSource.title.toLowerCase();
    
    // First try exact topic match with enhanced mappings
    const exactTopicMapping = getExactTopicMapping(title);
    if (exactTopicMapping) {
      console.log('[DYNAMIC QUERY] Using exact topic mapping:', exactTopicMapping);
      return exactTopicMapping;
    }
    
    // Then try extracted summary
    const summary = extractImageSummary(campaignSource.title);
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
 * Maps exact topic titles to optimal search terms
 */
function getExactTopicMapping(title: string): string | null {
  const topicMappings: Record<string, string> = {
    'national honey month': 'honey bees',
    'honey month': 'honey bee',
    'pollinator month': 'bee pollinator',
    'bee awareness': 'bee garden',
    'hydrangea care': 'hydrangea',
    'rose pruning': 'rose bush',
    'orchid care': 'orchid',
    'succulent care': 'succulent',
    'herb garden': 'herb garden',
    'vegetable garden': 'vegetable garden',
    'tomato growing': 'tomato plant',
    'container gardening': 'container garden',
    'shade gardening': 'shade garden',
    'drought resistant': 'drought plants',
    'native plants': 'native wildflowers',
    'fall planting': 'autumn planting',
    'spring garden': 'spring flowers',
    'summer blooms': 'summer flowers',
    'winter care': 'winter garden'
  };
  
  for (const [topic, mapping] of Object.entries(topicMappings)) {
    if (title.includes(topic)) {
      return mapping;
    }
  }
  
  return null;
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
