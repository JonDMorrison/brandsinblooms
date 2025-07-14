/**
 * Global Content-to-Image Summary System
 * Extracts 1-2 word summaries from content for better Unsplash image searches
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
 * Extracts a concise 1-2 word summary from content for image search
 */
export function extractImageSummary(content: string): string {
  if (!content?.trim()) {
    return 'garden';
  }

  // Clean and normalize the content
  const cleanContent = content
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleanContent.split(' ');

  // First, look for priority garden terms
  for (const term of PRIORITY_GARDEN_TERMS) {
    if (cleanContent.includes(term)) {
      // For plural terms, return singular if it's more common
      if (term.endsWith('s') && term.length > 4) {
        const singular = term.slice(0, -1);
        if (PRIORITY_GARDEN_TERMS.includes(singular)) {
          return singular;
        }
      }
      return term;
    }
  }

  // Look for compound plant names (e.g., "cherry blossom", "oak tree")
  for (let i = 0; i < words.length - 1; i++) {
    const compound = `${words[i]} ${words[i + 1]}`;
    if (PRIORITY_GARDEN_TERMS.some(term => compound.includes(term))) {
      return words[i];
    }
  }

  // Look for specific months that indicate seasonal content
  const seasonalTerms = {
    'january': 'winter',
    'february': 'winter', 
    'march': 'spring',
    'april': 'spring',
    'may': 'spring',
    'june': 'summer',
    'july': 'summer',
    'august': 'summer',
    'september': 'fall',
    'october': 'fall',
    'november': 'fall',
    'december': 'winter'
  };

  for (const [month, season] of Object.entries(seasonalTerms)) {
    if (cleanContent.includes(month)) {
      return season;
    }
  }

  // Look for action words that might indicate garden activities
  const actionWords = ['pruning', 'planting', 'watering', 'fertilizing', 'harvesting'];
  for (const action of actionWords) {
    if (cleanContent.includes(action) || cleanContent.includes(action.slice(0, -3))) {
      return action.slice(0, -3); // Remove 'ing' suffix
    }
  }

  // Look for any recognizable gardening terms
  const gardenWords = words.filter(word => 
    word.length > 3 && 
    !CONTEXT_WORDS.includes(word) &&
    (word.includes('garden') || word.includes('plant') || word.includes('flower'))
  );

  if (gardenWords.length > 0) {
    return gardenWords[0];
  }

  // Fallback to generic garden terms
  return 'garden';
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
 */
export function validateImageSummary(summary: string): boolean {
  if (!summary || summary.length < 2) return false;
  if (summary.split(' ').length > 2) return false;
  if (CONTEXT_WORDS.includes(summary.toLowerCase())) return false;
  return true;
}