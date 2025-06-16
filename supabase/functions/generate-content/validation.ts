
import { FORBIDDEN_PATTERNS, INSTAGRAM_FORBIDDEN_PATTERNS } from './constants.ts';
import { ValidationResult } from './types.ts';

export function validateContent(content: string, contentType?: string): ValidationResult {
  const issues: string[] = [];
  
  // Use relaxed validation for Instagram
  const patterns = contentType === 'instagram' ? INSTAGRAM_FORBIDDEN_PATTERNS : FORBIDDEN_PATTERNS;
  
  // Check each forbidden pattern
  patterns.forEach((pattern, index) => {
    if (pattern.test(content)) {
      switch (index) {
        case 0: issues.push('Contains "green thumb" phrase'); break;
        case 1: issues.push('Contains "Welcome to" opening'); break;
        case 2:
        case 3:
        case 4:
        case 5: issues.push('Contains week number references'); break;
        case 6: 
          if (contentType !== 'instagram') {
            issues.push('Contains emojis'); 
          }
          break;
        case 7: issues.push('Contains company name placeholder'); break;
        case 8: issues.push('Contains garden center name placeholder'); break;
        case 9: issues.push('Contains generic garden center reference'); break;
        case 10: issues.push('Contains region placeholder'); break;
        case 11: issues.push('Contains location placeholder'); break;
        case 12: issues.push('Contains garden center location placeholder'); break;
        case 13: issues.push('Contains square bracket placeholders'); break;
        case 14: issues.push('Contains code blocks'); break;
      }
    }
  });
  
  // Additional specific checks for problematic content
  const lowerContent = content.toLowerCase();
  
  // Check for any remaining placeholder patterns
  if (lowerContent.includes('garden center name') || 
      lowerContent.includes('company name') || 
      lowerContent.includes('business name')) {
    issues.push('Contains placeholder name references');
  }
  
  return { isValid: issues.length === 0, issues };
}
