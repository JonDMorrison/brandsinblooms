
import { FORBIDDEN_PATTERNS } from './constants.ts';
import { ValidationResult } from './types.ts';

export function validateContent(content: string): ValidationResult {
  const issues: string[] = [];
  
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
      }
    }
  });
  
  return { isValid: issues.length === 0, issues };
}
