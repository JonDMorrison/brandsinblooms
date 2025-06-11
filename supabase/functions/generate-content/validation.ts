
import { FORBIDDEN_PATTERNS } from './constants.ts';
import { ValidationResult } from './types.ts';

export function validateContent(content: string): ValidationResult {
  const issues: string[] = [];
  
  // Check each forbidden pattern
  FORBIDDEN_PATTERNS.forEach((pattern, index) => {
    if (pattern.test(content)) {
      switch (index) {
        case 0: issues.push('Contains "green thumb" phrase'); break;
        case 1: issues.push('Contains "Welcome to" opening'); break;
        case 2:
        case 3: issues.push('Contains week number references'); break;
        case 4: issues.push('Contains emojis'); break;
        case 5: issues.push('Contains bullet points'); break;
        case 6: issues.push('Contains numbered lists'); break;
        case 7: issues.push('Contains company name placeholder'); break;
        case 8: issues.push('Contains garden center name placeholder'); break;
        case 9: issues.push('Contains generic garden center reference'); break;
        case 10: issues.push('Contains region placeholder'); break;
        case 11: issues.push('Contains location placeholder'); break;
        case 12: issues.push('Contains garden center location placeholder'); break;
        case 13: issues.push('Contains square bracket placeholders'); break;
        case 14: issues.push('Contains code blocks'); break;
        case 15: issues.push('Contains inline code formatting'); break;
        case 16: issues.push('Contains bold markdown formatting'); break;
        case 17: issues.push('Contains italic markdown formatting'); break;
        case 18: issues.push('Contains underscore formatting'); break;
        case 19: issues.push('Contains markdown headers'); break;
        case 20: issues.push('Contains blockquote formatting'); break;
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
  
  // Check for technical language patterns
  if (content.includes('```') || content.includes('`')) {
    issues.push('Contains code formatting');
  }
  
  // Check for markdown patterns
  if (content.includes('**') || content.includes('_') || content.includes('#')) {
    issues.push('Contains markdown formatting');
  }
  
  return { isValid: issues.length === 0, issues };
}
