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

  // Priority 1: Look for specific priority garden terms (single words first)
  for (const term of PRIORITY_GARDEN_TERMS) {
    if (words.includes(term)) {
      // For plural terms, prefer singular if available
      if (term.endsWith('s') && term.length > 4) {
        const singular = term.slice(0, -1);
        if (PRIORITY_GARDEN_TERMS.includes(singular)) {
          return singular;
        }
      }
      return term;
    }
  }

  // Priority 2: Look for partial matches in content
  for (const term of PRIORITY_GARDEN_TERMS) {
    if (cleanContent.includes(term)) {
      // For plural terms, prefer singular if available
      if (term.endsWith('s') && term.length > 4) {
        const singular = term.slice(0, -1);
        if (PRIORITY_GARDEN_TERMS.includes(singular)) {
          return singular;
        }
      }
      return term;
    }
  }

  // Priority 3: Special seasonal mappings (return single words where possible)
  const seasonalMappings: Record<string, string> = {
    'national honey month': 'bee',
    'honey month': 'bee',
    'pollinator': 'bee',
    'bee friendly': 'bee',
    'summer heat': 'summer',
    'heat protection': 'summer',
    'plant rescue': 'plant',
    'plant recovery': 'plant',
    'garden planning': 'garden',
    'garden preparation': 'garden',
    'fall garden': 'autumn',
    'winter garden': 'winter'
  };

  for (const [phrase, mapping] of Object.entries(seasonalMappings)) {
    if (cleanContent.includes(phrase)) {
      return mapping;
    }
  }

  // Priority 4: Look for specific months that indicate seasonal content
  const seasonalTerms = {
    'january': 'winter',
    'february': 'winter', 
    'march': 'spring',
    'april': 'spring',
    'may': 'spring',
    'june': 'summer',
    'july': 'summer',
    'august': 'summer',
    'september': 'autumn',
    'october': 'autumn',
    'november': 'autumn',
    'december': 'winter'
  };

  for (const [month, season] of Object.entries(seasonalTerms)) {
    if (cleanContent.includes(month)) {
      return season;
    }
  }

  // Priority 5: Look for action words (return root word)
  const actionWords = ['pruning', 'planting', 'watering', 'fertilizing', 'harvesting'];
  for (const action of actionWords) {
    if (cleanContent.includes(action) || cleanContent.includes(action.slice(0, -3))) {
      return action.slice(0, -3); // Remove 'ing' suffix
    }
  }

  // Priority 6: Look for meaningful single words
  const meaningfulWords = words.filter(word => 
    word.length > 4 && 
    !CONTEXT_WORDS.includes(word) &&
    !['the', 'and', 'for', 'with', 'your', 'that', 'this', 'from', 'care', 'tips', 'guide'].includes(word)
  );

  if (meaningfulWords.length > 0) {
    return meaningfulWords[0];
  }

  // Final fallback - use simple seasonal term based on current month
  const currentMonth = new Date().getMonth();
  const seasonalFallbacks: Record<number, string> = {
    0: 'winter', 1: 'winter', 2: 'spring',
    3: 'spring', 4: 'spring', 5: 'summer',
    6: 'summer', 7: 'bee', // July is National Honey Month
    8: 'autumn', 9: 'autumn', 10: 'autumn', 11: 'winter'
  };
  
  return seasonalFallbacks[currentMonth] || 'garden';
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