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
 * Extracts a concise 3-5 word garden-focused summary from content for image search
 * IMPROVED: Now returns more specific queries for better Unsplash results
 */
export function extractImageSummary(content: string): string {
  if (!content?.trim()) {
    return 'garden center plants';
  }

  // Clean and normalize the content
  const cleanContent = content
    .toLowerCase()
    .replace(/<[^>]*>/g, ' ')  // Remove HTML
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleanContent.split(' ');

  // Priority 1: Build multi-word query with specific terms
  const foundPriorityTerms: string[] = [];
  for (const term of PRIORITY_GARDEN_TERMS) {
    if (words.includes(term) || cleanContent.includes(term)) {
      // For plural terms, prefer singular if available
      if (term.endsWith('s') && term.length > 4) {
        const singular = term.slice(0, -1);
        if (PRIORITY_GARDEN_TERMS.includes(singular)) {
          foundPriorityTerms.push(singular);
        } else {
          foundPriorityTerms.push(term);
        }
      } else {
        foundPriorityTerms.push(term);
      }
      
      // Stop after finding 2-3 specific terms
      if (foundPriorityTerms.length >= 3) break;
    }
  }

  // If we found specific terms, combine them with context
  if (foundPriorityTerms.length > 0) {
    // Add seasonal context if present
    const seasons = ['spring', 'summer', 'fall', 'autumn', 'winter', 'thanksgiving', 'holiday'];
    const seasonContext = seasons.find(s => cleanContent.includes(s));
    
    if (seasonContext && !foundPriorityTerms.includes(seasonContext)) {
      return `${seasonContext} garden ${foundPriorityTerms.slice(0, 2).join(' ')}`;
    }
    
    // Return with garden context if not already present
    const query = foundPriorityTerms.slice(0, 3).join(' ');
    return cleanContent.includes('garden') ? query : `${query} garden`;
  }

  // Priority 3: Enhanced topic-specific mappings (prioritize exact topic searches)
  const topicMappings: Record<string, string> = {
    'national honey month': 'honey bees pollinator garden',
    'honey month': 'honey bees garden flowers',
    'pollinator': 'bee pollinator garden',
    'bee friendly': 'bee friendly garden plants',
    'hydrangea care': 'hydrangea flowers garden',
    'rose pruning': 'rose bush garden pruning',
    'tomato growing': 'tomato vegetable garden',
    'orchid care': 'orchid flowers care',
    'succulent care': 'succulent plants indoor',
    'herb garden': 'herb garden basil rosemary',
    'vegetable garden': 'vegetable garden harvest',
    'summer heat': 'summer garden heat',
    'heat protection': 'shade garden summer',
    'plant rescue': 'plant care recovery',
    'plant recovery': 'plant care watering',
    'garden planning': 'garden design planning',
    'garden preparation': 'garden tools preparation',
    'fall garden': 'autumn garden harvest',
    'winter garden': 'winter garden evergreen',
    'thanksgiving': 'thanksgiving harvest pumpkin',
    'thanksgiving garden': 'thanksgiving garden harvest vegetables',
    'garden gratitude': 'harvest abundance thanksgiving garden',
    'holiday garden': 'holiday garden decorations',
    'spring planting': 'spring garden planting flowers',
    'autumn harvest': 'autumn harvest vegetables garden'
  };

  for (const [phrase, mapping] of Object.entries(topicMappings)) {
    if (cleanContent.includes(phrase)) {
      return mapping;
    }
  }

  // Priority 4: Look for specific months that indicate seasonal content
  const seasonalTerms: Record<string, string> = {
    'january': 'winter garden evergreen',
    'february': 'winter garden planning', 
    'march': 'spring garden seeds',
    'april': 'spring garden flowers',
    'may': 'spring garden blooms',
    'june': 'summer garden flowers',
    'july': 'summer garden vegetables',
    'august': 'summer garden harvest',
    'september': 'autumn garden harvest',
    'october': 'autumn garden pumpkin',
    'november': 'autumn garden thanksgiving',
    'december': 'winter garden evergreen'
  };

  for (const [month, seasonQuery] of Object.entries(seasonalTerms)) {
    if (cleanContent.includes(month)) {
      return seasonQuery;
    }
  }

  // Priority 5: Look for action words with garden context
  const actionWords = ['pruning', 'planting', 'watering', 'fertilizing', 'harvesting'];
  for (const action of actionWords) {
    if (cleanContent.includes(action) || cleanContent.includes(action.slice(0, -3))) {
      const root = action.slice(0, -3); // Remove 'ing' suffix
      return `${root} garden tools`;
    }
  }

  // Priority 6: Look for meaningful multi-word queries
  const meaningfulWords = words.filter(word => 
    word.length > 4 && 
    !CONTEXT_WORDS.includes(word) &&
    !['the', 'and', 'for', 'with', 'your', 'that', 'this', 'from', 'care', 'tips', 'guide'].includes(word)
  );

  if (meaningfulWords.length > 0) {
    // Combine 2-3 meaningful words with garden context
    const topWords = meaningfulWords.slice(0, 2);
    return `${topWords.join(' ')} garden plants`;
  }

  // Final fallback - use seasonal garden term based on current month
  const currentMonth = new Date().getMonth();
  const seasonalFallbacks: Record<number, string> = {
    0: 'winter garden plants', 1: 'winter garden plants', 2: 'spring garden flowers',
    3: 'spring garden flowers', 4: 'spring garden flowers', 5: 'summer garden flowers',
    6: 'summer garden flowers', 7: 'pollinator garden bees', // July is National Honey Month
    8: 'autumn garden harvest', 9: 'autumn garden harvest', 10: 'autumn garden harvest', 11: 'winter garden plants'
  };
  
  return seasonalFallbacks[currentMonth] || 'garden center seasonal plants';
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
  if (summary.split(' ').length > 6) return false; // Allow up to 6 words
  if (summary.split(' ').length === 1 && CONTEXT_WORDS.includes(summary.toLowerCase())) return false;
  return true;
}