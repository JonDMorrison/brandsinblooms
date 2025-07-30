/**
 * Topic Content Validation Utilities
 * Validates that generated content aligns with the specified topic/campaign theme
 */

interface TopicValidationResult {
  isValid: boolean;
  confidence: number;
  requiredKeywords: string[];
  foundKeywords: string[];
  missingKeywords: string[];
  suggestions: string[];
}

interface TopicKeywordMap {
  [topic: string]: {
    required: string[];
    related: string[];
    forbidden: string[];
  };
}

// Define topic-specific keyword requirements
const TOPIC_KEYWORDS: TopicKeywordMap = {
  'national honey month': {
    required: ['honey', 'bee', 'pollinator'],
    related: ['beekeeping', 'hive', 'nectar', 'pollen', 'apiary', 'beeswax', 'honeybee', 'colony'],
    forbidden: ['generic summer', 'general gardening', 'basic plant care']
  },
  'hydrangea care': {
    required: ['hydrangea'],
    related: ['bloom', 'pruning', 'soil acidity', 'pH', 'deadheading', 'macrophylla', 'paniculata'],
    forbidden: ['general flowering plants', 'all flowers']
  },
  'rose pruning': {
    required: ['rose', 'pruning'],
    related: ['deadheading', 'hybrid tea', 'climbing roses', 'bush roses', 'thorns', 'canes'],
    forbidden: ['general plant pruning', 'all shrubs']
  },
  'orchid care': {
    required: ['orchid'],
    related: ['epiphyte', 'bark media', 'humidity', 'phalaenopsis', 'cattleya', 'dendrobium'],
    forbidden: ['general houseplants', 'all flowers']
  }
};

/**
 * Validates content against a specific topic
 */
export function validateCampaignContent(
  content: string,
  topic: string
): TopicValidationResult {
  const normalizedTopic = topic.toLowerCase().trim();
  const normalizedContent = content.toLowerCase();
  
  console.log('[TOPIC VALIDATOR] Validating content for topic:', topic);
  
  // Get topic keywords or create generic ones
  const topicKeywords = TOPIC_KEYWORDS[normalizedTopic] || generateGenericKeywords(normalizedTopic);
  
  // Find required keywords in content
  const foundRequired = topicKeywords.required.filter(keyword => 
    normalizedContent.includes(keyword.toLowerCase())
  );
  
  // Find related keywords in content
  const foundRelated = topicKeywords.related.filter(keyword => 
    normalizedContent.includes(keyword.toLowerCase())
  );
  
  // Check for forbidden content
  const foundForbidden = topicKeywords.forbidden.filter(phrase => 
    normalizedContent.includes(phrase.toLowerCase())
  );
  
  // Calculate confidence score
  const requiredScore = (foundRequired.length / topicKeywords.required.length) * 0.7;
  const relatedScore = Math.min(foundRelated.length / topicKeywords.related.length, 1) * 0.2;
  const forbiddenPenalty = foundForbidden.length * 0.15;
  
  const confidence = Math.max(0, Math.min(1, requiredScore + relatedScore - forbiddenPenalty));
  
  // Determine if valid (need at least 80% of required keywords and >60% confidence)
  const isValid = foundRequired.length >= Math.ceil(topicKeywords.required.length * 0.8) && 
                  confidence > 0.6 && 
                  foundForbidden.length === 0;
  
  // Generate suggestions
  const suggestions = generateValidationSuggestions(
    topicKeywords,
    foundRequired,
    foundRelated,
    foundForbidden
  );
  
  const result: TopicValidationResult = {
    isValid,
    confidence,
    requiredKeywords: topicKeywords.required,
    foundKeywords: [...foundRequired, ...foundRelated],
    missingKeywords: topicKeywords.required.filter(keyword => 
      !foundRequired.includes(keyword)
    ),
    suggestions
  };
  
  console.log('[TOPIC VALIDATOR] Validation result:', result);
  return result;
}

/**
 * Generates generic keyword requirements for topics not in the predefined map
 */
function generateGenericKeywords(topic: string): {
  required: string[];
  related: string[];
  forbidden: string[];
} {
  const words = topic.split(' ').filter(word => word.length > 2);
  
  return {
    required: words.slice(0, 2), // Use first 2 significant words
    related: words.slice(2), // Use remaining words as related
    forbidden: ['generic advice', 'general tips']
  };
}

/**
 * Generates actionable suggestions for improving content
 */
function generateValidationSuggestions(
  keywords: { required: string[]; related: string[]; forbidden: string[] },
  foundRequired: string[],
  foundRelated: string[],
  foundForbidden: string[]
): string[] {
  const suggestions: string[] = [];
  
  // Missing required keywords
  const missingRequired = keywords.required.filter(k => !foundRequired.includes(k));
  if (missingRequired.length > 0) {
    suggestions.push(`Include these essential keywords: ${missingRequired.join(', ')}`);
  }
  
  // Low related keyword count
  if (foundRelated.length < 2) {
    const availableRelated = keywords.related.filter(k => !foundRelated.includes(k));
    if (availableRelated.length > 0) {
      suggestions.push(`Add topic-specific details using: ${availableRelated.slice(0, 3).join(', ')}`);
    }
  }
  
  // Forbidden content found
  if (foundForbidden.length > 0) {
    suggestions.push(`Remove generic content: ${foundForbidden.join(', ')}`);
    suggestions.push('Focus specifically on the topic instead of general advice');
  }
  
  // General improvement suggestions
  if (suggestions.length === 0) {
    suggestions.push('Content meets topic requirements');
  }
  
  return suggestions;
}

/**
 * Quick validation check - returns boolean only
 */
export function isContentTopicAligned(content: string, topic: string): boolean {
  const result = validateCampaignContent(content, topic);
  return result.isValid;
}

/**
 * Extracts topic keywords from campaign title for image search validation
 */
export function extractTopicKeywords(topic: string): string[] {
  const normalizedTopic = topic.toLowerCase().trim();
  const topicKeywords = TOPIC_KEYWORDS[normalizedTopic];
  
  if (topicKeywords) {
    return [...topicKeywords.required, ...topicKeywords.related.slice(0, 3)];
  }
  
  // For generic topics, extract meaningful words
  return topic
    .toLowerCase()
    .split(' ')
    .filter(word => word.length > 3 && !['the', 'and', 'for', 'with'].includes(word))
    .slice(0, 3);
}