
/**
 * Extracts meaningful keywords from raw text for image searching with garden center context
 * @param raw - The raw text content to extract keywords from
 * @param fallback - Default keyword to use if no valid keywords found
 * @returns Space-separated keywords enhanced with garden center context
 */
export const extractKeywords = (raw: string, fallback = 'garden center plants'): string => {
  console.log('[KEYWORDS] Raw input:', raw?.substring(0, 200) + '...');
  
  if (!raw || typeof raw !== 'string' || raw.trim().length === 0) {
    console.log('[KEYWORDS] Empty or invalid input, using fallback:', fallback);
    return fallback;
  }

  // Define specific plant categories with higher priority
  const plantCategories = {
    vegetables: /\b(tomato|tomatoes|pepper|peppers|cucumber|cucumbers|zucchini|lettuce|spinach|kale|cabbage|broccoli|carrot|carrots|radish|onion|garlic|potato|potatoes|bean|beans|pea|peas|corn|squash|pumpkin|melon|eggplant|beet|beets)\b/gi,
    herbs: /\b(basil|mint|thyme|oregano|sage|parsley|cilantro|chives|rosemary|lavender|dill)\b/gi,
    flowers: /\b(rose|roses|lily|lilies|tulip|tulips|daisy|daisies|sunflower|sunflowers|marigold|marigolds|petunia|petunias|impatiens|begonia|begonias|geranium|geraniums|pansy|pansies|violet|violets|iris|daffodil|daffodils)\b/gi,
    trees: /\b(oak|maple|birch|willow|pine|cedar|fruit\s+tree|apple\s+tree|orange\s+tree|lemon\s+tree)\b/gi
  };

  // Define seasonal and care context terms
  const seasonalContext = /\b(summer|spring|fall|autumn|winter|mid\-summer|early\s+summer|late\s+summer|heat|hot|drought|wilting|stressed|blooming|flowering|fruiting|harvest|harvesting)\b/gi;
  const careContext = /\b(watering|irrigation|fertilize|fertilizing|pruning|mulching|planting|transplanting|pest|disease|care|maintenance|growing|garden|gardening)\b/gi;
  const problemContext = /\b(wilting|stressed|yellowing|brown|dropping|dying|problem|issue|challenge|struggle|difficult)\b/gi;

  // Lowercase and clean the text
  const cleaned = raw
    .toLowerCase()
    .replace(/[#*_`~\[\]()]/g, ' ')  // Remove markdown characters
    .replace(/[^\w\s-]/g, ' ')       // Remove punctuation, keep words, spaces, and hyphens
    .replace(/\s+/g, ' ')            // Normalize whitespace
    .trim();

  console.log('[KEYWORDS] Cleaned content:', cleaned.substring(0, 200));

  // Extract specific plants with frequency counting
  const foundPlants = new Map<string, number>();
  const foundContext = new Set<string>();
  
  // Count plant mentions for priority
  Object.entries(plantCategories).forEach(([category, regex]) => {
    const matches = cleaned.match(regex);
    if (matches) {
      console.log(`[KEYWORDS] Found ${category}:`, matches);
      matches.forEach(plant => {
        const count = foundPlants.get(plant) || 0;
        foundPlants.set(plant, count + 1);
      });
    }
  });

  // Extract seasonal and care context
  const seasonalMatches = cleaned.match(seasonalContext);
  if (seasonalMatches) {
    console.log('[KEYWORDS] Found seasonal context:', seasonalMatches);
    seasonalMatches.slice(0, 2).forEach(term => foundContext.add(term));
  }

  const careMatches = cleaned.match(careContext);
  if (careMatches) {
    console.log('[KEYWORDS] Found care context:', careMatches);
    careMatches.slice(0, 2).forEach(term => foundContext.add(term));
  }

  const problemMatches = cleaned.match(problemContext);
  if (problemMatches) {
    console.log('[KEYWORDS] Found problem context:', problemMatches);
    problemMatches.slice(0, 1).forEach(term => foundContext.add(term));
  }

  // Build query based on findings
  if (foundPlants.size > 0) {
    // Sort plants by frequency (most mentioned first)
    const sortedPlants = Array.from(foundPlants.entries())
      .sort(([,a], [,b]) => b - a)
      .map(([plant]) => plant);
    
    const primaryPlants = sortedPlants.slice(0, 2); // Take top 2 most mentioned plants
    const contextTerms = Array.from(foundContext).slice(0, 2);
    
    // Determine the most appropriate category for context
    let categoryContext = '';
    if (sortedPlants.some(plant => /tomato|pepper|cucumber|zucchini|lettuce|vegetable/.test(plant))) {
      categoryContext = 'vegetable gardening';
    } else if (sortedPlants.some(plant => /rose|flower|bloom/.test(plant))) {
      categoryContext = 'flower gardening';
    } else if (sortedPlants.some(plant => /basil|herb|mint/.test(plant))) {
      categoryContext = 'herb gardening';
    } else {
      categoryContext = 'gardening';
    }
    
    const result = `${primaryPlants.join(' ')} ${contextTerms.join(' ')} ${categoryContext}`.trim();
    console.log('[KEYWORDS] Built specific plant query:', result);
    
    return result;
  }

  // If no specific plants found, try to extract general gardening terms
  const gardenTerms = /\b(garden|plant|flower|bloom|seed|seedling|grow|growing|soil|compost|fertilizer|mulch|water|watering|sun|shade|nursery)\b/gi;
  const gardenMatches = cleaned.match(gardenTerms);
  
  if (gardenMatches && foundContext.size > 0) {
    const limitedGardenTerms = [...new Set(gardenMatches)].slice(0, 2);
    const contextTerms = Array.from(foundContext).slice(0, 2);
    const result = `${limitedGardenTerms.join(' ')} ${contextTerms.join(' ')} garden center`;
    console.log('[KEYWORDS] Built general garden query with context:', result);
    return result;
  }

  // Enhanced fallback with better context detection
  const tokens = cleaned
    .split(/\s+/)
    .filter(token => {
      return /^[a-z-]+$/.test(token) && 
             token.length >= 3 && 
             !['your', 'this', 'that', 'they', 'them', 'their', 'here', 'there', 'when', 'what', 'where', 'how', 'why', 'who', 'will', 'have', 'been', 'with', 'from', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'could', 'would', 'should', 'might', 'must', 'can', 'may', 'shall', 'does', 'did', 'has', 'had', 'was', 'were', 'are', 'the', 'and', 'but', 'for', 'you', 'all', 'now'].includes(token);
    })
    .slice(0, 2);

  if (tokens.length > 0) {
    const result = `${tokens.join(' ')} garden center plants`;
    console.log('[KEYWORDS] Using enhanced fallback tokens:', result);
    return result;
  }

  console.log('[KEYWORDS] Using default fallback:', fallback);
  return fallback;
};
