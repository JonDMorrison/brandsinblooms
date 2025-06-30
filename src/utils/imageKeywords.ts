
/**
 * Extracts meaningful keywords from raw text for image searching with garden center context
 * @param raw - The raw text content to extract keywords from
 * @param fallback - Default keyword to use if no valid keywords found
 * @returns Space-separated keywords enhanced with garden center context
 */
export const extractKeywords = (raw: string, fallback = 'garden center plants'): string => {
  if (!raw || typeof raw !== 'string' || raw.trim().length === 0) {
    return fallback;
  }

  // Define garden center related terms for better context
  const gardenCenterTerms = {
    plants: /\b(plant|flower|bloom|seed|seedling|herb|vegetable|tree|shrub|fern|succulent|orchid|rose|lily|tulip|daisy|sunflower|marigold|petunia|impatiens|begonia|geranium|pansy|violet|iris|daffodil|crocus|hyacinth|azalea|rhododendron|hydrangea|camellia|jasmine|lavender|rosemary|basil|mint|thyme|oregano|sage|parsley|cilantro|chives|tomato|pepper|cucumber|lettuce|spinach|kale|cabbage|broccoli|carrot|radish|onion|garlic|potato|bean|pea|corn|squash|pumpkin|melon|strawberry|grape|apple|orange|lemon|lime|peach|cherry|plum|fig|avocado|banana|mango|pineapple|palm|pine|oak|maple|birch|willow|elm|poplar|cedar|fir|spruce|juniper|cypress|yew|boxwood|holly|ivy|moss|lichen|algae|fungus|mushroom)\b/gi,
    tools: /\b(tool|shovel|spade|rake|hoe|trowel|pruner|shear|scissor|clipper|saw|knife|blade|handle|grip|wheelbarrow|cart|bucket|pot|container|planter|basket|tray|saucer|stake|cage|trellis|fence|gate|path|walkway|stone|rock|gravel|mulch|compost|fertilizer|nutrient|soil|dirt|earth|clay|sand|loam|humus|manure|lime|sulfur|nitrogen|phosphorus|potassium|calcium|magnesium|iron|zinc|copper|boron)\b/gi,
    care: /\b(care|water|watering|irrigation|fertilize|fertilizer|prune|pruning|trim|trimming|cut|cutting|transplant|transplanting|repot|repotting|mulch|mulching|weed|weeding|pest|disease|treatment|spray|dust|granule|organic|natural|chemical|synthetic|prevention|control|management|maintenance|schedule|timing|season|spring|summer|fall|autumn|winter|dormant|active|growth|blooming|flowering|fruiting|harvest|harvesting|picking|gathering|storing|preserving)\b/gi
  };

  // Lowercase and clean the text
  const cleaned = raw
    .toLowerCase()
    .replace(/[#*_`~\[\]()]/g, ' ')  // Remove markdown characters
    .replace(/[^\w\s]/g, ' ')        // Remove punctuation, keep words and spaces
    .replace(/\s+/g, ' ')            // Normalize whitespace
    .trim();

  console.log('[KEYWORDS] Cleaned content:', cleaned.substring(0, 100));

  // Find garden center related terms
  const foundTerms = new Set<string>();
  
  // Check for plant-related terms
  const plantMatches = cleaned.match(gardenCenterTerms.plants);
  if (plantMatches) {
    plantMatches.slice(0, 3).forEach(term => foundTerms.add(term));
  }
  
  // Check for tool-related terms
  const toolMatches = cleaned.match(gardenCenterTerms.tools);
  if (toolMatches) {
    toolMatches.slice(0, 2).forEach(term => foundTerms.add(term));
  }
  
  // Check for care-related terms
  const careMatches = cleaned.match(gardenCenterTerms.care);
  if (careMatches) {
    careMatches.slice(0, 2).forEach(term => foundTerms.add(term));
  }

  console.log('[KEYWORDS] Found garden center terms:', Array.from(foundTerms));

  // Always ensure garden center context is included
  let result = '';
  if (foundTerms.size > 0) {
    result = Array.from(foundTerms).join(' ') + ' garden center nursery';
    console.log('[KEYWORDS] Using found terms with garden center context:', result);
    return result;
  }

  // Enhanced fallback with garden center context
  const tokens = cleaned
    .split(/\s+/)
    .filter(token => {
      // Only keep alphabetic tokens with 3+ characters, excluding common words
      return /^[a-z]+$/.test(token) && 
             token.length >= 3 && 
             !['your', 'this', 'that', 'they', 'them', 'their', 'here', 'there', 'when', 'what', 'where', 'how', 'why', 'who', 'will', 'have', 'been', 'with', 'from', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'could', 'would', 'should', 'might', 'must', 'can', 'may', 'shall', 'does', 'did', 'has', 'had', 'was', 'were', 'are', 'the', 'and', 'but', 'for', 'you', 'all', 'now'].includes(token);
    })
    .slice(0, 2); // Take first 2 valid tokens

  // Return enhanced tokens with mandatory garden center context
  if (tokens.length > 0) {
    result = tokens.join(' ') + ' garden center plants nursery';
    console.log('[KEYWORDS] Using fallback tokens with garden center context:', result);
    return result;
  }

  console.log('[KEYWORDS] Using default garden center fallback:', fallback);
  return fallback;
};
