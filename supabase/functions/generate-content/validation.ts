
import { ValidationResult } from './types.ts';

export function validateContent(content: string, contentType?: string): ValidationResult {
  const issues: string[] = [];
  
  // Critical placeholder patterns - focus only on actual problems
  const criticalPatterns = [
    /\[Company Name\]/gi,           // Company name placeholder
    /\[Business Name\]/gi,          // Business name placeholder  
    /\[Garden Center Name\]/gi,     // Garden center placeholder
    /\[Location\]/gi,               // Location placeholder
    /\[Region\]/gi,                 // Region placeholder
    /Your Garden Center(?!\s+name)/gi, // Generic garden center reference
    /\[.*?\]/gi,                    // Any remaining bracket placeholders
    /```[\s\S]*?```/g,              // Code blocks
  ];
  
  // Check critical patterns
  criticalPatterns.forEach((pattern, index) => {
    if (pattern.test(content)) {
      switch (index) {
        case 0:
        case 1:
        case 2: issues.push('Contains company name placeholder'); break;
        case 3:
        case 4: issues.push('Contains location placeholder'); break;
        case 5: issues.push('Contains generic garden center reference'); break;
        case 6: issues.push('Contains placeholder text in brackets'); break;
        case 7: issues.push('Contains code blocks'); break;
      }
    }
  });
  
  // HUMAN-FIRST VALIDATION: Check for emojis (STRICTLY FORBIDDEN)
  const emojiPattern = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{27BF}]|[\u{1F100}-\u{1F1FF}]|[\u{1F200}-\u{1F2FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F700}-\u{1F77F}]|[\u{1F780}-\u{1F7FF}]|[\u{1F800}-\u{1F8FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]/u;
  if (emojiPattern.test(content)) {
    issues.push('CRITICAL: Contains emojis - must be removed for human-first approach');
  }
  
  // Check for AI-like language patterns
  const aiPatterns = [
    /I'm an AI/gi,
    /as an AI/gi,
    /unlock the full potential/gi,
    /in today's modern world/gi,
    /leverage/gi,
    /utilize/gi,
    /optimal/gi,
    /maximize/gi,
    /seamless/gi,
    /cutting-edge/gi,
    /revolutionary/gi,
    /game-changing/gi,
    /next-level/gi
  ];
  
  if (aiPatterns.some(pattern => pattern.test(content))) {
    issues.push('Contains AI-like corporate language - needs more human, conversational tone');
  }
  
  // Check for forbidden generic patterns
  const forbiddenPatterns = [
    /week\s+\d+/i,
    /seasonal\s+tips/i,
    /plant\s+spotlight/i,
    /problem\s+solving/i,
    /garden\s+update/i,
    /weekly\s+newsletter/i,
    /this\s+week/i
  ];
  
  if (forbiddenPatterns.some(pattern => pattern.test(content))) {
    issues.push('Contains forbidden generic phrases - needs specific, engaging language');
  }
  
  // Check for conversational elements
  const lowerContent = content.toLowerCase();
  const hasContractions = /\b(you'll|we're|don't|can't|won't|it's|that's|here's|what's)\b/i.test(content);
  if (!hasContractions) {
    issues.push('Missing conversational contractions - add "you\'ll", "we\'re", etc. for natural tone');
  }
  
  // Enhanced validation for Instagram content quality
  if (contentType?.toLowerCase() === 'instagram') {
    // Check word count (should be 60-120 words)
    const wordCount = content.split(/\s+/).length;
    if (wordCount < 60) {
      issues.push('Instagram content too short - needs 60-120 words');
    } else if (wordCount > 120) {
      issues.push('Instagram content too long - keep to 60-120 words');
    }
    
    // Check for engaging opening patterns
    const hasEngagingOpening = [
      /your\s+\w+\s+(are|is)\s+telling/i,
      /this\s+simple\s+trick/i,
      /most\s+gardeners\s+miss/i,
      /here's\s+what\s+we\s+tell/i,
      /you've\s+probably\s+noticed/i,
      /ever\s+wonder\s+why/i
    ].some(pattern => pattern.test(content));
    
    if (!hasEngagingOpening) {
      issues.push('Instagram needs more engaging, human-first opening hook');
    }
    
    // Check for engagement elements
    if (!content.includes('?')) {
      issues.push('Missing natural question for engagement');
    }
  }
  
  // Additional specific checks for problematic placeholder content
  if (lowerContent.includes('garden center name') || 
      lowerContent.includes('company name') || 
      lowerContent.includes('business name')) {
    issues.push('Contains placeholder name references');
  }
  
  // Check for natural, specific plant advice
  const hasSpecificAdvice = [
    /pinch/i,
    /water.*deeply/i,
    /fertilize.*weekly/i,
    /prune.*back/i,
    /deadhead/i,
    /mulch.*around/i,
    /plant.*spacing/i
  ].some(pattern => pattern.test(content));
  
  if (!hasSpecificAdvice && contentType !== 'newsletter') {
    issues.push('Needs more specific, actionable plant care advice');
  }
  
  return { isValid: issues.length === 0, issues };
}
