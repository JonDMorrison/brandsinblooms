/**
 * Centralized Unsplash Keyword Validator
 * Ensures all AI-generated image queries are garden-focused and visually optimized
 */

export interface ValidationResult {
  isValid: boolean;
  fixedQuery?: string;
  issues: string[];
}

// Required garden context words - at least one must be present
const REQUIRED_GARDEN_WORDS = [
  'garden',
  'nursery',
  'botanical',
  'greenhouse',
  'plant',
  'flower',
  'garden center'
];

// Visual plant indicators that should be present
const VISUAL_INDICATORS = [
  'rose', 'tulip', 'hydrangea', 'mum', 'chrysanthemum', 'peony', 'dahlia',
  'vegetable', 'herb', 'succulent', 'orchid', 'fern', 'cactus', 'bonsai',
  'tomato', 'pepper', 'lettuce', 'basil', 'lavender', 'rosemary',
  'spring', 'summer', 'fall', 'autumn', 'winter', 'seasonal',
  'bloom', 'flowering', 'foliage', 'display', 'arrangement', 'basket',
  'bed', 'border', 'container', 'pot', 'planter', 'outdoor', 'indoor'
];

// Forbidden patterns that indicate poor image queries
const FORBIDDEN_PATTERNS = [
  /week\s*\d+/i,           // Week numbers
  /\d{4}/,                  // Years
  /month\s*\d+/i,          // Month numbers
  /tip[s]?\s*\d+/i,        // "5 tips"
  /step[s]?\s*\d+/i,       // "3 steps"
  /guide/i,                 // Too abstract
  /how\s*to/i,             // Instructional (not visual)
  /best/i,                  // Too abstract
  /ultimate/i,              // Too abstract
  /essential/i,             // Too abstract
];

/**
 * Validates and optionally fixes Unsplash search queries
 */
export function validateUnsplashQuery(query: string, autoFix: boolean = true): ValidationResult {
  const issues: string[] = [];
  let fixedQuery = query.trim().toLowerCase();
  
  // Check 1: Must have garden context
  const hasGardenContext = REQUIRED_GARDEN_WORDS.some(word => 
    fixedQuery.includes(word)
  );
  
  if (!hasGardenContext) {
    issues.push('Missing required garden context word');
    if (autoFix) {
      // Prepend "garden" to ensure relevance
      fixedQuery = `garden ${fixedQuery}`;
    }
  }
  
  // Check 2: Should have visual indicators
  const hasVisualElement = VISUAL_INDICATORS.some(indicator =>
    fixedQuery.includes(indicator)
  );
  
  if (!hasVisualElement) {
    issues.push('Query lacks specific visual plant/garden elements');
  }
  
  // Check 3: Forbidden patterns
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(fixedQuery)) {
      issues.push(`Contains forbidden pattern: ${pattern.source}`);
      if (autoFix) {
        // Remove numbers and abstract words
        fixedQuery = fixedQuery.replace(/\d+/g, '').replace(/\s+/g, ' ').trim();
      }
    }
  }
  
  // Check 4: Length check (3-7 words optimal)
  const wordCount = fixedQuery.split(' ').filter(w => w.length > 0).length;
  if (wordCount > 7) {
    issues.push('Query too long (>7 words) - may be too specific');
    if (autoFix) {
      // Take first 5 meaningful words
      fixedQuery = fixedQuery.split(' ').slice(0, 5).join(' ');
    }
  }
  
  if (wordCount < 2) {
    issues.push('Query too short (<2 words) - too generic');
  }
  
  // Check 5: Remove abstract/instructional words
  const abstractWords = ['guide', 'tips', 'how to', 'best', 'ultimate', 'essential', 'perfect'];
  if (autoFix) {
    abstractWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      fixedQuery = fixedQuery.replace(regex, '').replace(/\s+/g, ' ').trim();
    });
  }
  
  // Final validation
  const isValid = issues.length === 0 || (autoFix && issues.length <= 2);
  
  return {
    isValid,
    fixedQuery: autoFix ? fixedQuery : undefined,
    issues
  };
}

/**
 * Enhanced validation with logging for debugging
 */
export function validateAndLogQuery(query: string, context: string = ''): string {
  const validation = validateUnsplashQuery(query, true);
  
  console.log(`🎨 Unsplash Query Validation ${context}:`, {
    original: query,
    fixed: validation.fixedQuery,
    isValid: validation.isValid,
    issues: validation.issues
  });
  
  return validation.fixedQuery || query;
}

/**
 * Example queries for AI training
 */
export const EXAMPLE_QUERIES = {
  good: [
    'spring tulip garden center display',
    'fall mums chrysanthemum nursery',
    'vegetable garden harvest baskets',
    'rose garden bloom display',
    'indoor succulent plant arrangement',
    'herb garden basil rosemary',
    'greenhouse flowering orchids',
    'autumn garden foliage colors',
    'botanical garden tropical plants',
    'garden center spring flowers'
  ],
  bad: [
    'week 23 gardening tips',           // Has week numbers
    '5 essential garden tools',         // Has numbers, abstract
    'how to garden guide',              // Instructional, abstract
    'best gardening practices 2024',    // Year, abstract
    'ultimate plant care tips',         // Abstract
    'gardening',                        // Too generic
    'National Honey Month',             // No visual plant element
    'seasonal advice',                  // Too abstract
    'garden maintenance schedule',      // Not visual
    'plant care guide'                  // Instructional
  ]
};

/**
 * Generate prompt instructions for OpenAI
 */
export function getImageQueryPromptInstructions(): string {
  return `
🎨 IMAGE QUERY GENERATION REQUIREMENTS (MANDATORY):

Your response MUST include an "imageQuery" field with a garden-focused Unsplash search query.

CRITICAL REQUIREMENTS:
1. MUST contain at least one of these words: "garden", "garden center", "nursery", "botanical", "greenhouse"
2. Focus on VISUAL garden elements: specific plants, flowers, outdoor displays, garden scenes
3. Use 3-5 descriptive words maximum
4. Think about what would make a stunning, relevant photo for Unsplash

EXCELLENT EXAMPLES:
✅ "spring tulip garden center display"
✅ "fall mums chrysanthemum nursery"
✅ "vegetable garden harvest baskets"
✅ "rose garden bloom display"
✅ "herb garden basil rosemary"
✅ "greenhouse flowering orchids"

FORBIDDEN PATTERNS:
❌ Week numbers ("week 23", "week 1")
❌ Years or dates ("2024", "January 2024")
❌ Abstract concepts ("tips", "guide", "how to", "best")
❌ Instructional phrases ("care guide", "maintenance")
❌ Generic terms without plant specifics
❌ Numbers in general ("5 tips", "3 steps")

VALIDATION:
- Your query will be validated for garden context
- Queries lacking "garden", "nursery", "botanical", or plant names will be auto-fixed by prepending "garden"
- Focus on TANGIBLE, VISUAL garden elements that a photographer would capture

The imageQuery should help find photos that visually represent the content's essence for a garden center audience.
`;
}
