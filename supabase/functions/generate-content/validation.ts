
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
  
  // Enhanced validation for Instagram content quality
  if (contentType?.toLowerCase() === 'instagram') {
    const lowerContent = content.toLowerCase();
    
    // Check for engaging opening patterns
    const hasEngagingOpening = [
      /stop\s+/i,
      /don't\s+/i,
      /why\s+your\s+/i,
      /this\s+\$?\d+\s+/i,
      /pov:/i,
      /that\s+moment\s+when/i,
      /you've\s+been\s+/i,
      /the\s+secret\s+/i,
      /here's\s+why\s+/i
    ].some(pattern => pattern.test(content));
    
    if (!hasEngagingOpening) {
      issues.push('Instagram content lacks scroll-stopping opening hook');
    }
    
    // Check for forbidden generic patterns
    const forbiddenPatterns = [
      /week\s+\d+/i,
      /seasonal\s+tips/i,
      /plant\s+spotlight/i,
      /problem\s+solving/i,
      /garden\s+update/i
    ];
    
    if (forbiddenPatterns.some(pattern => pattern.test(content))) {
      issues.push('Contains forbidden generic phrases');
    }
    
    // Check for engagement elements
    if (!content.includes('?')) {
      issues.push('Missing engaging question for comments');
    }
    
    if (!/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{27BF}]/u.test(content)) {
      issues.push('Consider adding emojis for visual engagement');
    }
  }
  
  // Additional specific checks for problematic placeholder content
  const lowerContent = content.toLowerCase();
  
  if (lowerContent.includes('garden center name') || 
      lowerContent.includes('company name') || 
      lowerContent.includes('business name')) {
    issues.push('Contains placeholder name references');
  }
  
  return { isValid: issues.length === 0, issues };
}
