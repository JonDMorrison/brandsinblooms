/**
 * Enhanced Keyword Validator for Garden-Focused Image Queries
 * Ensures all AI-generated keywords are garden-related and channel-optimized
 */

export interface KeywordValidation {
  isValid: boolean;
  score: number; // 0-100
  issues: string[];
  suggestions: string[];
  fixedKeywords?: string[];
}

// Mandatory garden terms - at least one MUST be present
const MANDATORY_GARDEN_TERMS = [
  'garden', 'nursery', 'greenhouse', 'plant', 'flower', 'leaf', 'leaves',
  'bloom', 'foliage', 'botanical', 'garden center', 'soil', 'pot', 'potted',
  'seedling', 'vegetable', 'herb', 'tree', 'shrub', 'grass', 'lawn', 'seed'
];

// Specific plant/flower names (high value)
const SPECIFIC_PLANTS = [
  'rose', 'tulip', 'hydrangea', 'petunia', 'marigold', 'dahlia', 'peony',
  'tomato', 'pepper', 'lettuce', 'basil', 'rosemary', 'lavender', 'sage',
  'echinacea', 'chrysanthemum', 'mum', 'succulent', 'orchid', 'fern',
  'hosta', 'daylily', 'iris', 'zinnia', 'geranium', 'begonia', 'impatiens',
  'kale', 'cabbage', 'broccoli', 'cucumber', 'squash', 'pumpkin'
];

// Visual descriptors (colors, textures, states)
const VISUAL_DESCRIPTORS = [
  'pink', 'purple', 'red', 'yellow', 'blue', 'white', 'orange', 'green',
  'colorful', 'vibrant', 'bright', 'blooming', 'flowering', 'lush',
  'dense', 'tall', 'dwarf', 'variegated', 'spotted', 'striped'
];

// Retail/garden center context words
const RETAIL_CONTEXT = [
  'garden center', 'nursery', 'greenhouse', 'display', 'inventory',
  'customers', 'browsing', 'shopping', 'shoppers', 'retail', 'store',
  'shelves', 'selection', 'abundance', 'variety', 'collection'
];

// Technique/action words (for blog/video)
const ACTION_WORDS = [
  'hands', 'planting', 'transplanting', 'pruning', 'deadheading',
  'watering', 'fertilizing', 'mulching', 'harvesting', 'trowel',
  'shears', 'spade', 'demonstrating', 'showing'
];

// Forbidden patterns
const FORBIDDEN_PATTERNS = [
  /week\s*\d+/i,
  /\d{4}/,
  /month\s*\d+/i,
  /tip[s]?\s*\d+/i,
  /step[s]?\s*\d+/i,
  /guide/i,
  /how\s*to/i,
  /best/i,
  /ultimate/i,
  /essential/i,
  /perfect/i
];

/**
 * Validate garden-focused keywords with channel-specific requirements
 */
export function validateGardenKeywords(
  keywords: string[],
  channel: string
): KeywordValidation {
  let score = 0;
  const issues: string[] = [];
  const suggestions: string[] = [];
  const fixedKeywords: string[] = [];
  
  const allKeywordsText = keywords.join(' ').toLowerCase();
  
  // === CHECK 1: Mandatory Garden Terms (25 points) ===
  const hasMandatoryTerm = MANDATORY_GARDEN_TERMS.some(term =>
    allKeywordsText.includes(term)
  );
  
  if (hasMandatoryTerm) {
    score += 25;
  } else {
    issues.push('Missing mandatory garden term (garden, plant, nursery, greenhouse, etc.)');
    suggestions.push('Add garden-related context words');
    // Auto-fix: prepend "garden center"
    fixedKeywords.push('garden center', ...keywords);
  }
  
  // === CHECK 2: Specific Plant Names (25 points) ===
  const hasSpecificPlant = SPECIFIC_PLANTS.some(plant =>
    allKeywordsText.includes(plant)
  );
  
  if (hasSpecificPlant) {
    score += 25;
  } else {
    issues.push('No specific plant or flower variety mentioned');
    suggestions.push('Include specific plant names like "rose", "tomato", "hydrangea"');
  }
  
  // === CHECK 3: Visual Descriptors (20 points) ===
  const visualCount = VISUAL_DESCRIPTORS.filter(desc =>
    allKeywordsText.includes(desc)
  ).length;
  
  if (visualCount > 0) {
    score += Math.min(20, visualCount * 10);
  } else {
    issues.push('Missing visual descriptors (colors, textures)');
    suggestions.push('Add colors or visual details like "purple", "vibrant", "blooming"');
  }
  
  // === CHECK 4: Channel-Specific Requirements ===
  let channelScore = 0;
  
  if (channel === 'facebook') {
    // MUST have: people/customers + retail context
    const hasPeople = /customer|people|shopper|browsing/.test(allKeywordsText);
    const hasRetail = RETAIL_CONTEXT.some(term => allKeywordsText.includes(term));
    
    if (hasPeople && hasRetail) {
      channelScore = 20;
    } else {
      if (!hasPeople) {
        issues.push('Facebook: Missing people element (customers, browsing, shoppers)');
        suggestions.push('Add "customers browsing" or "shoppers selecting"');
      }
      if (!hasRetail) {
        issues.push('Facebook: Missing retail context (garden center, greenhouse, nursery)');
        suggestions.push('Add "garden center" or "greenhouse display"');
      }
    }
  } else if (channel === 'instagram') {
    // MUST have: close-up indicator + color + retail display
    const hasCloseUp = /close|detail|macro/.test(allKeywordsText);
    const hasColor = VISUAL_DESCRIPTORS.some(d => allKeywordsText.includes(d));
    const hasDisplay = /display|pot|container|shelf/.test(allKeywordsText);
    
    if (hasCloseUp && hasColor && hasDisplay) {
      channelScore = 20;
    } else {
      if (!hasCloseUp) {
        issues.push('Instagram: Missing close-up indicator');
        suggestions.push('Add "close" or "detail" for intimate shots');
      }
      if (!hasColor) {
        issues.push('Instagram: Missing color descriptor');
        suggestions.push('Add specific color like "purple", "vibrant pink"');
      }
      if (!hasDisplay) {
        issues.push('Instagram: Missing display/pot context');
        suggestions.push('Add "potted" or "display" for retail context');
      }
    }
  } else if (channel === 'blog') {
    // MUST have: hands/tools + action verb + specific plant
    const hasHands = ACTION_WORDS.some(word => allKeywordsText.includes(word));
    const hasAction = /planting|pruning|transplanting|deadheading|watering/.test(allKeywordsText);
    
    if (hasHands && hasAction) {
      channelScore = 20;
    } else {
      if (!hasHands) {
        issues.push('Blog: Missing hands or tools');
        suggestions.push('Add "hands" or tool name like "trowel", "shears"');
      }
      if (!hasAction) {
        issues.push('Blog: Missing action verb');
        suggestions.push('Add action like "planting", "pruning", "transplanting"');
      }
    }
  } else if (channel === 'newsletter') {
    // MUST have: seasonal context + inventory/display
    const hasSeasonal = /spring|summer|fall|autumn|winter|seasonal/.test(allKeywordsText);
    const hasInventory = /inventory|selection|variety|display|abundance/.test(allKeywordsText);
    
    if (hasSeasonal && hasInventory) {
      channelScore = 20;
    } else {
      if (!hasSeasonal) {
        issues.push('Newsletter: Missing seasonal context');
        suggestions.push('Add "spring", "autumn", or "seasonal"');
      }
      if (!hasInventory) {
        issues.push('Newsletter: Missing inventory/display context');
        suggestions.push('Add "inventory", "selection", or "display"');
      }
    }
  }
  
  score += channelScore;
  
  // === CHECK 5: Forbidden Patterns (deduct points) ===
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(allKeywordsText)) {
      score -= 15;
      issues.push(`Contains forbidden pattern: ${pattern.source}`);
      suggestions.push('Remove abstract terms, numbers, dates, and instructional phrases');
    }
  }
  
  // === CHECK 6: Length Validation (10 points) ===
  if (keywords.length >= 4 && keywords.length <= 6) {
    score += 10;
  } else if (keywords.length < 4) {
    issues.push(`Too few keywords (${keywords.length}, need 4-6)`);
    suggestions.push('Add 2-3 more descriptive keywords');
  } else {
    issues.push(`Too many keywords (${keywords.length}, need 4-6)`);
    suggestions.push('Reduce to most important 5-6 keywords');
  }
  
  // Cap score at 100
  score = Math.min(100, Math.max(0, score));
  
  return {
    isValid: score >= 70,
    score,
    issues,
    suggestions,
    fixedKeywords: fixedKeywords.length > 0 ? fixedKeywords : undefined
  };
}

/**
 * Validate and fix a complete Unsplash query string
 */
export function validateImageQuery(query: string, channel: string): KeywordValidation {
  const keywords = query.split(/\s+/).filter(w => w.length > 0);
  const validation = validateGardenKeywords(keywords, channel);
  
  // Build fixed query from keywords if available
  if (validation.fixedKeywords) {
    const fixedQuery = validation.fixedKeywords.join(' ');
    validation.suggestions.push(`Suggested query: "${fixedQuery}"`);
  }
  
  return validation;
}

/**
 * Get channel-specific fallback query
 */
export function getChannelFallback(channel: string, topicTitle?: string): string {
  const fallbacks: Record<string, string> = {
    facebook: 'customers browsing seasonal plants garden center greenhouse',
    instagram: 'colorful flowering plants nursery display pots close',
    blog: 'hands planting seedlings soil garden trowel technique',
    newsletter: 'seasonal garden center plant inventory greenhouse display',
    video: 'demonstrating plant care garden center customer tutorial'
  };
  
  return fallbacks[channel] || 'garden center plants seasonal display';
}
