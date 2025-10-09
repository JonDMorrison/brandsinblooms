/**
 * Global Content-to-Image Summary System
 * Extracts 3-5 word garden-focused summaries from content for better Unsplash image searches
 * 
 * IMPROVED: Returns specific, multi-word queries (e.g., "thanksgiving garden harvest vegetables")
 * instead of generic single words (e.g., "garden") for more relevant image results.
 */

// Plant and garden-specific terms that should be prioritized
const PRIORITY_GARDEN_TERMS = [
  // Flowers
  'rose', 'roses', 'tulip', 'tulips', 'daffodil', 'daffodils', 'hydrangea', 'hydrangeas',
  'peony', 'peonies', 'iris', 'irises', 'lily', 'lilies', 'sunflower', 'sunflowers',
  'dahlia', 'dahlias', 'marigold', 'marigolds', 'petunia', 'petunias', 'begonia', 'begonias',
  'aster', 'asters', 'zinnia', 'zinnias', 'cosmos', 'lavender', 'jasmine', 'carnation',
  'orchid', 'orchids', 'violet', 'violets', 'poppy', 'poppies', 'daisy', 'daisies',
  
  // Trees and shrubs
  'maple', 'oak', 'pine', 'cedar', 'birch', 'willow', 'cherry', 'apple', 'pear',
  'boxwood', 'azalea', 'rhododendron', 'camellia', 'forsythia', 'lilac', 'magnolia',
  
  // Vegetables and herbs
  'tomato', 'tomatoes', 'pepper', 'peppers', 'cucumber', 'cucumbers', 'lettuce',
  'carrot', 'carrots', 'onion', 'onions', 'garlic', 'potato', 'potatoes',
  'basil', 'oregano', 'thyme', 'rosemary', 'sage', 'parsley', 'mint', 'cilantro',
  
  // Garden activities and tools
  'pruning', 'planting', 'watering', 'fertilizing', 'mulching', 'composting',
  'weeding', 'harvesting', 'transplanting', 'seed', 'seeds', 'seedling', 'seedlings',
  
  // Garden elements
  'greenhouse', 'garden', 'lawn', 'soil', 'compost', 'mulch', 'fertilizer',
  'irrigation', 'sprinkler', 'tools', 'shovel', 'rake', 'hose', 'pot', 'pots',
  
  // Seasonal and nature
  'spring', 'summer', 'fall', 'autumn', 'winter', 'seasonal', 'bloom', 'blooming',
  'pollinator', 'bee', 'bees', 'butterfly', 'butterflies', 'bird', 'birds'
];

// Common garden context words that should be secondary
const CONTEXT_WORDS = [
  'garden', 'gardening', 'plant', 'plants', 'flower', 'flowers', 'care', 'growing',
  'tips', 'guide', 'nursery', 'center'
];

/**
 * UPDATED: Trust OpenAI's image keywords - NO transformation
 * 
 * This function now acts as a passthrough. OpenAI generates perfect
 * Unsplash search queries, so we trust them completely.
 */
export function extractImageSummary(content: string): string {
  if (!content?.trim()) {
    return 'garden center plants';
  }
  
  // If it's already a short, specific query (from OpenAI), use it as-is
  const words = content.trim().split(/\s+/);
  if (words.length >= 2 && words.length <= 6) {
    console.log('[extractImageSummary] Using query as-is:', content);
    return content;
  }
  
  // Only for very long text (like full blog posts), extract key terms
  if (words.length > 50) {
    // Simple extraction: first 4 meaningful words
    const cleaned = content
      .toLowerCase()
      .replace(/<[^>]+>/g, '') // Remove HTML
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .trim();
    
    const meaningfulWords = cleaned
      .split(/\s+/)
      .filter(w => w.length > 3 && !['the', 'and', 'for', 'with', 'this', 'that'].includes(w))
      .slice(0, 4)
      .join(' ');
    
    return meaningfulWords || 'garden plants';
  }
  
  // For medium-length text, use as-is
  return content;
}

/**
 * Enhanced version that adds minimal context when needed
 */
export function extractImageSummaryWithContext(content: string, addContext = false): string {
  const summary = extractImageSummary(content);
  
  if (!addContext) {
    return summary;
  }

  // Add context only for very generic terms
  const genericTerms = ['garden', 'plant', 'flower', 'care', 'tips'];
  if (genericTerms.includes(summary)) {
    return `${summary} nursery`;
  }

  return summary;
}

/**
 * Validates that the summary will likely return good image results
 * UPDATED: Trust OpenAI keywords - removed strict validation
 */
export function validateImageSummary(summary: string): boolean {
  if (!summary || summary.length < 2) return false;
  // Allow any reasonable query length (OpenAI knows best)
  return true;
}