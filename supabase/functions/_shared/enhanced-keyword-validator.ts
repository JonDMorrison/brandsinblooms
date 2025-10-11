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
  
  // === CHECK 4: Channel-Specific Requirements (RELAXED) ===
  let channelScore = 0;
  
  // Removed strict channel requirements - focus on garden relevance instead
  // Just give bonus points for channel-appropriate elements, don't fail without them
  
  if (channel === 'facebook') {
    // BONUS for people/customers + retail context (not mandatory)
    const hasPeople = /customer|people|shopper|browsing/.test(allKeywordsText);
    const hasRetail = RETAIL_CONTEXT.some(term => allKeywordsText.includes(term));
    
    if (hasPeople && hasRetail) {
      channelScore = 20;
    } else if (hasPeople || hasRetail) {
      channelScore = 10;
    }
  } else if (channel === 'instagram') {
    // BONUS for close-up + color + display (not mandatory)
    const hasCloseUp = /close|detail|macro/.test(allKeywordsText);
    const hasColor = VISUAL_DESCRIPTORS.some(d => allKeywordsText.includes(d));
    const hasDisplay = /display|pot|container|shelf/.test(allKeywordsText);
    
    const bonusCount = [hasCloseUp, hasColor, hasDisplay].filter(Boolean).length;
    channelScore = bonusCount * 7; // Max 21 points
  } else if (channel === 'blog') {
    // BONUS for hands/tools + action (not mandatory)
    const hasHands = ACTION_WORDS.some(word => allKeywordsText.includes(word));
    const hasAction = /planting|pruning|transplanting|deadheading|watering/.test(allKeywordsText);
    
    if (hasHands && hasAction) {
      channelScore = 20;
    } else if (hasHands || hasAction) {
      channelScore = 10;
    }
  } else if (channel === 'newsletter') {
    // BONUS for seasonal + inventory (not mandatory)
    const hasSeasonal = /spring|summer|fall|autumn|winter|seasonal/.test(allKeywordsText);
    const hasInventory = /inventory|selection|variety|display|abundance/.test(allKeywordsText);
    
    if (hasSeasonal && hasInventory) {
      channelScore = 20;
    } else if (hasSeasonal || hasInventory) {
      channelScore = 10;
    }
  }
  
  score += channelScore;
  
  // === CHECK 5: Forbidden Patterns (reduced penalty) ===
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(allKeywordsText)) {
      score -= 5; // Reduced from 15 to 5
      issues.push(`Contains forbidden pattern: ${pattern.source}`);
      suggestions.push('Consider removing abstract terms for better results');
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
    isValid: score >= 50, // Lowered from 70 to 50
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

// REMOVED: getChannelFallback function - no more fallbacks!
