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
    return 'garden center';
  }

  // Clean and normalize the content
  const cleanContent = content
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleanContent.split(' ');

  // Special handling for seasonal/monthly themes
  const seasonalMappings: Record<string, string> = {
    'national honey month': 'bee garden',
    'honey month': 'bee garden',
    'pollinator': 'bee garden',
    'bee friendly': 'bee garden',
    'summer heat': 'summer garden',
    'heat protection': 'summer garden',
    'plant rescue': 'plant care',
    'plant recovery': 'plant care',
    'garden planning': 'garden tools',
    'garden preparation': 'garden tools',
    'fall garden': 'autumn garden',
    'winter garden': 'winter plants'
  };

  // Check for seasonal mappings first
  for (const [phrase, mapping] of Object.entries(seasonalMappings)) {
    if (cleanContent.includes(phrase)) {
      return mapping;
    }
  }

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

  // Smart seasonal fallbacks based on current month
  const currentMonth = new Date().getMonth();
  const seasonalFallbacks: Record<number, string> = {
    0: 'winter garden', 1: 'winter garden', 2: 'spring garden',
    3: 'spring garden', 4: 'spring garden', 5: 'summer garden',
    6: 'summer garden', 7: 'bee garden', // July is National Honey Month
    8: 'late summer', 9: 'autumn garden', 10: 'autumn garden', 11: 'winter garden'
  };
  
  return seasonalFallbacks[currentMonth] || 'garden center';
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