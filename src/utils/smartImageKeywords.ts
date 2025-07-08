/**
 * Smart keyword extraction for Unsplash image searches
 * Extracts 2-3 relevant keywords from content for better image results
 */

interface KeywordExtractionResult {
  primary: string;
  fallbacks: string[];
  debug: {
    originalLength: number;
    extractedTerms: string[];
    finalQuery: string;
  };
}

/**
 * Extract smart keywords from content for image searches
 */
export function extractSmartImageKeywords(content: string, postType?: string): KeywordExtractionResult {
  console.log('[SMART_KEYWORDS] Processing content:', content.substring(0, 100) + '...');
  
  if (!content || content.trim().length === 0) {
    return createFallbackResult('garden center');
  }

  // Clean content and extract meaningful terms
  const cleanContent = content
    .toLowerCase()
    .replace(/[#@*_\[\]()]/g, ' ') // Remove markdown and social media symbols
    .replace(/[^\w\s]/g, ' ') // Keep only words and spaces
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();

  // Garden-specific keyword patterns
  const gardenPatterns = {
    plants: /\b(plant|flower|bloom|rose|lily|tulip|daisy|sunflower|marigold|petunia|impatiens|begonia|geranium|pansy|violet|iris|daffodil|crocus|hyacinth|azalea|rhododendron|hydrangea|camellia|jasmine|lavender|succulent|orchid|fern|herb|basil|mint|thyme|oregano|sage|parsley|cilantro|chives)\b/g,
    vegetables: /\b(tomato|pepper|cucumber|lettuce|spinach|kale|cabbage|broccoli|carrot|radish|onion|garlic|potato|bean|pea|corn|squash|pumpkin)\b/g,
    trees: /\b(tree|oak|maple|birch|willow|elm|poplar|cedar|fir|spruce|juniper|cypress|pine)\b/g,
    activities: /\b(watering|planting|pruning|mulching|fertilizing|transplanting|repotting|weeding|harvesting|trimming)\b/g,
    tools: /\b(shovel|spade|rake|hoe|trowel|pruner|shear|wheelbarrow|pot|planter|container)\b/g,
    seasons: /\b(spring|summer|fall|autumn|winter|seasonal)\b/g,
    colors: /\b(red|blue|yellow|purple|pink|white|orange|green|colorful|vibrant)\b/g
  };

  // Extract matches from each category
  const extractedTerms: string[] = [];
  
  Object.entries(gardenPatterns).forEach(([category, pattern]) => {
    const matches = cleanContent.match(pattern) || [];
    if (matches.length > 0) {
      console.log(`[SMART_KEYWORDS] Found ${category}:`, matches.slice(0, 3));
      extractedTerms.push(...matches.slice(0, 2)); // Limit per category
    }
  });

  // Remove duplicates and limit to most relevant terms
  const uniqueTerms = [...new Set(extractedTerms)].slice(0, 3);
  
  // Build primary query
  let primaryQuery = '';
  if (uniqueTerms.length >= 2) {
    primaryQuery = uniqueTerms.slice(0, 2).join(' ');
  } else if (uniqueTerms.length === 1) {
    primaryQuery = `${uniqueTerms[0]} garden`;
  } else {
    // Extract first meaningful words as backup
    const words = cleanContent
      .split(' ')
      .filter(word => 
        word.length > 3 && 
        !isCommonWord(word) &&
        /^[a-z]+$/.test(word)
      )
      .slice(0, 2);
    
    primaryQuery = words.length > 0 ? `${words.join(' ')} garden` : 'garden center';
  }

  // Create fallback queries
  const fallbacks = [
    postType ? `${postType} garden center` : 'garden center plants',
    'greenhouse nursery',
    'garden tools plants',
    'flowers garden center'
  ];

  const result = {
    primary: primaryQuery,
    fallbacks,
    debug: {
      originalLength: content.length,
      extractedTerms: uniqueTerms,
      finalQuery: primaryQuery
    }
  };

  console.log('[SMART_KEYWORDS] Result:', result);
  return result;
}

/**
 * Create fallback result when extraction fails
 */
function createFallbackResult(fallback: string): KeywordExtractionResult {
  return {
    primary: fallback,
    fallbacks: ['garden center plants', 'greenhouse nursery', 'garden tools'],
    debug: {
      originalLength: 0,
      extractedTerms: [],
      finalQuery: fallback
    }
  };
}

/**
 * Check if word is too common to be useful for image search
 */
function isCommonWord(word: string): boolean {
  const commonWords = [
    'your', 'this', 'that', 'they', 'them', 'their', 'here', 'there', 
    'when', 'what', 'where', 'how', 'why', 'who', 'will', 'have', 
    'been', 'with', 'from', 'about', 'into', 'through', 'during', 
    'before', 'after', 'above', 'below', 'between', 'among', 'could', 
    'would', 'should', 'might', 'must', 'does', 'said', 'make', 'made',
    'many', 'much', 'most', 'more', 'some', 'any', 'all', 'each',
    'garden', 'center', 'nursery' // Already added as context
  ];
  
  return commonWords.includes(word);
}

/**
 * Enhanced image search with multiple fallback attempts
 */
export async function searchWithFallbacks(
  keywords: KeywordExtractionResult,
  searchFunction: (query: string) => Promise<any>
): Promise<any> {
  console.log('[SMART_KEYWORDS] Starting search with fallbacks');
  
  // Try primary query first
  let result = await searchFunction(keywords.primary);
  if (result) {
    console.log('[SMART_KEYWORDS] Success with primary query:', keywords.primary);
    return result;
  }

  // Try fallback queries
  for (const fallback of keywords.fallbacks) {
    console.log('[SMART_KEYWORDS] Trying fallback:', fallback);
    result = await searchFunction(fallback);
    if (result) {
      console.log('[SMART_KEYWORDS] Success with fallback:', fallback);
      return result;
    }
  }

  console.warn('[SMART_KEYWORDS] All search attempts failed');
  return null;
}