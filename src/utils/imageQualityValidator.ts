/**
 * Image Quality Validation Utilities
 * Validates image relevance and quality for better user experience
 */

interface ImageData {
  id: string;
  alt_description?: string;
  description?: string;
  tags?: Array<{ title: string }>;
  user?: { name: string };
}

/**
 * Validates if an image is relevant to the search query
 */
export function validateImageRelevance(image: ImageData, query: string): boolean {
  const alt = (image.alt_description || '').toLowerCase();
  const desc = (image.description || '').toLowerCase();
  const tags = image.tags?.map(t => t.title.toLowerCase()).join(' ') || '';
  
  const content = `${alt} ${desc} ${tags}`;
  const queryWords = query.toLowerCase().split(' ');
  
  // Check for problematic content that should be filtered out
  const problematicTerms = /\b(ice.?cream|dessert|sweet|food|restaurant|cafe|%|percent|symbol|sign|math|number|people|person|human|face|portrait)\b/i;
  if (problematicTerms.test(content)) {
    console.warn(`[IMAGE_VALIDATOR] Filtering out irrelevant image: ${image.id} - contains problematic terms`);
    return false;
  }
  
  // Positive validation - check if image contains relevant terms
  const gardenTerms = ['garden', 'plant', 'flower', 'bloom', 'nursery', 'botanical', 'leaf', 'green', 'nature', 'outdoor'];
  const hasGardenContext = gardenTerms.some(term => content.includes(term));
  
  // Check if at least one query word appears in image content
  const hasQueryMatch = queryWords.some(word => word.length > 2 && content.includes(word));
  
  if (hasGardenContext || hasQueryMatch) {
    console.log(`[IMAGE_VALIDATOR] Image ${image.id} passed validation`);
    return true;
  }
  
  console.warn(`[IMAGE_VALIDATOR] Filtering out irrelevant image: ${image.id} - no relevant terms found`);
  return false;
}

/**
 * Scores image relevance (0-100)
 */
export function scoreImageRelevance(image: ImageData, query: string): number {
  const alt = (image.alt_description || '').toLowerCase();
  const desc = (image.description || '').toLowerCase();
  const tags = image.tags?.map(t => t.title.toLowerCase()).join(' ') || '';
  
  const content = `${alt} ${desc} ${tags}`;
  const queryWords = query.toLowerCase().split(' ').filter(w => w.length > 2);
  
  let score = 0;
  
  // Exact query word matches (high value)
  queryWords.forEach(word => {
    if (content.includes(word)) {
      score += 25;
    }
  });
  
  // Garden context bonus
  const gardenTerms = ['garden', 'plant', 'flower', 'bloom', 'nursery', 'botanical'];
  gardenTerms.forEach(term => {
    if (content.includes(term)) {
      score += 10;
    }
  });
  
  // Quality indicators
  if (image.tags && image.tags.length > 3) score += 5;
  if (alt.length > 10) score += 5;
  if (desc.length > 20) score += 5;
  
  return Math.min(score, 100);
}

/**
 * Filters and sorts images by relevance
 */
export function filterAndSortImages(images: ImageData[], query: string, maxResults = 4): ImageData[] {
  console.log(`[IMAGE_VALIDATOR] Filtering ${images.length} images for query: "${query}"`);
  
  // First filter for basic relevance
  const validImages = images.filter(img => validateImageRelevance(img, query));
  console.log(`[IMAGE_VALIDATOR] ${validImages.length}/${images.length} images passed basic validation`);
  
  // Score and sort by relevance
  const scoredImages = validImages.map(img => ({
    image: img,
    score: scoreImageRelevance(img, query)
  })).sort((a, b) => b.score - a.score);
  
  // Log scoring results
  scoredImages.slice(0, 5).forEach((item, index) => {
    console.log(`[IMAGE_VALIDATOR] Image ${index + 1}: ${item.image.id} - Score: ${item.score}`);
  });
  
  // Return top results
  const topImages = scoredImages.slice(0, maxResults).map(item => item.image);
  console.log(`[IMAGE_VALIDATOR] Returning ${topImages.length} top-scored images`);
  
  return topImages;
}