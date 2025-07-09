/**
 * Dynamic Image Search Utilities
 * Extracts relevant topics from content tasks for Unsplash image searches
 */

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
  fallback = 'garden center'
): string {
  if (!task && !campaign) {
    return fallback;
  }

  // Priority 1: Use campaign theme or title first (most consistent across posts)
  const campaignSource = campaign || task?.campaigns;
  if (campaignSource?.theme && campaignSource.theme.trim()) {
    const cleanTheme = campaignSource.theme.trim();
    // Check if it's a specific flower name - if so, use it directly
    if (isSpecificFlower(cleanTheme)) {
      return sanitizeQuery(cleanTheme);
    }
    return sanitizeQuery(cleanTheme);
  }
  if (campaignSource?.title && campaignSource.title.trim()) {
    const cleanTitle = campaignSource.title.trim();
    // Check if it's a specific flower name - if so, use it directly
    if (isSpecificFlower(cleanTitle)) {
      return sanitizeQuery(cleanTitle);
    }
    return sanitizeQuery(cleanTitle);
  }

  // Priority 2: Use image_idea if available (specific override)
  if (task?.image_idea && task.image_idea.trim()) {
    return sanitizeQuery(task.image_idea.trim());
  }

  // Priority 3: Extract keywords from AI output (content-driven)
  if (task?.ai_output && task.ai_output.trim()) {
    const extracted = extractKeywordsFromContent(task.ai_output);
    if (extracted && extracted.trim()) {
      return sanitizeQuery(extracted);
    }
  }

  // Priority 4: Use post type with garden context
  if (task?.post_type) {
    return sanitizeQuery(`${task.post_type} garden center`);
  }

  // Final fallback
  return fallback;
}

/**
 * Checks if a term contains specific flower names
 */
function isSpecificFlower(term: string): boolean {
  const specificFlowers = [
    'hydrangea', 'hydrangeas', 'zinnia', 'marigold', 'petunia', 'impatiens', 
    'sunflower', 'dahlia', 'cosmos', 'salvia', 'begonia', 'geranium', 
    'pansy', 'violet', 'rose', 'roses', 'tulip', 'tulips', 'daffodil', 
    'daffodils', 'lily', 'lilies', 'chrysanthemum', 'azalea', 'rhododendron'
  ];
  
  const lowercaseTerm = term.toLowerCase();
  return specificFlowers.some(flower => lowercaseTerm.includes(flower));
}

/**
 * Extracts meaningful keywords from content text with priority for specific flowers
 */
function extractKeywordsFromContent(content: string): string {
  if (!content) return '';

  // Remove HTML tags and special characters
  const cleanContent = content
    .replace(/<[^>]*>/g, ' ')
    .replace(/[#@$%^&*(),.?":{}|<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // First, look for specific flower names in the content
  const specificFlowerRegex = /\b(hydrangea|hydrangeas|zinnia|marigold|petunia|impatiens|sunflower|dahlia|cosmos|salvia|begonia|geranium|pansy|violet|rose|roses|tulip|tulips|daffodil|daffodils|lily|lilies|chrysanthemum|azalea|rhododendron)\b/gi;
  const flowerMatches = cleanContent.match(specificFlowerRegex);
  
  if (flowerMatches && flowerMatches.length > 0) {
    // Use the specific flower names found
    const uniqueFlowers = [...new Set(flowerMatches.map(f => f.toLowerCase()))];
    return uniqueFlowers.slice(0, 2).join(' ');
  }

  // Common words to exclude
  const commonWords = [
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'can', 'may', 'might', 'must', 'shall', 'this', 'that',
    'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'
  ];

  // Extract meaningful words (length > 3, not common words)
  const words = cleanContent
    .toLowerCase()
    .split(/\s+/)
    .filter(word => 
      word.length > 3 && 
      !commonWords.includes(word) &&
      /^[a-zA-Z]+$/.test(word) // Only alphabetic words
    )
    .slice(0, 3); // Take first 3 meaningful words

  return words.join(' ');
}

/**
 * Sanitizes and optimizes query for Unsplash search
 */
function sanitizeQuery(query: string): string {
  if (!query) return 'garden center';

  // Clean up the query and remove duplicates
  let cleaned = query
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, ' ') // Remove special chars except spaces and hyphens
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();

  // Remove week numbers and generic terms
  cleaned = cleaned
    .replace(/\bweek\s+\d+\b/gi, '')
    .replace(/\b(the|and|or|of|in|on|at|to|for|with|by)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Remove duplicate words within the query
  const words = cleaned.split(' ');
  const uniqueWords = [...new Set(words)];
  cleaned = uniqueWords.join(' ');

  // If query becomes too short, add garden context for relevance
  if (cleaned.length < 3) {
    return 'garden center';
  }

  // Add garden context if it's not already garden-related (avoid duplicates)
  if (!isGardenRelated(cleaned)) {
    // Only add garden context if it's not already there
    if (!cleaned.includes('garden') && !cleaned.includes('nursery')) {
      cleaned = `${cleaned} garden nursery`;
    }
  }

  return cleaned;
}

/**
 * Checks if query is already garden/plant related
 */
function isGardenRelated(query: string): boolean {
  const gardenTerms = [
    'garden', 'plant', 'flower', 'bloom', 'seed', 'soil', 'nursery', 'greenhouse',
    'landscaping', 'botanical', 'herb', 'vegetable', 'tree', 'shrub', 'lawn',
    'fertilizer', 'compost', 'mulch', 'pruning', 'watering'
  ];

  return gardenTerms.some(term => query.toLowerCase().includes(term));
}

/**
 * Enhanced topic extraction for specific post types
 */
export function getEnhancedTopicForPostType(
  task?: ContentTask | null,
  campaign?: CampaignData | null
): string {
  const baseQuery = extractDynamicQuery(task, campaign);
  
  if (!task?.post_type) {
    return baseQuery;
  }

  // Enhance query based on post type for better image relevance
  switch (task.post_type) {
    case 'instagram':
      return `${baseQuery} vibrant colorful photography`;
    case 'facebook':
      return `${baseQuery} community garden social`;
    case 'newsletter':
      return `${baseQuery} professional garden center`;
    case 'blog':
      return `${baseQuery} educational gardening tips`;
    case 'video':
      return `${baseQuery} dynamic garden scenes`;
    default:
      return baseQuery;
  }
}

/**
 * Fallback queries for different content types when dynamic extraction fails
 */
export function getContentTypeFallback(postType?: string): string {
  const fallbacks = {
    instagram: 'beautiful flowers colorful garden',
    facebook: 'garden center community plants',
    newsletter: 'professional nursery greenhouse',
    blog: 'gardening tips educational plants',
    video: 'garden landscape outdoor plants',
    default: 'garden center plants flowers'
  };

  return fallbacks[postType as keyof typeof fallbacks] || fallbacks.default;
}