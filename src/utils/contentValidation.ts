
import { ValidationResult } from '../types/contentGeneration';

// Relaxed validation - focus only on actual problems
export const FORBIDDEN_PATTERNS = [
  /\[company\s*name\]/gi,
  /\[garden\s*center\s*name\]/gi,
  /\[business\s*name\]/gi,
  /your\s*garden\s*center(?!\s+name)/gi,
  /\[region\]/gi,
  /\[location\]/gi,
  /\[garden\s*center\s*location\]/gi,
  /\[.*?\]/gi, // Any text in square brackets
  /```/gi, // Code blocks
];

export const FORBIDDEN_PHRASES = [
  '[company name]',
  '[garden center name]', 
  '[business name]',
  'your garden center',
  '[region]',
  '[location]',
  '[garden center location]'
];

export function validateContent(content: string): ValidationResult {
  const issues: string[] = [];
  
  // Only check for critical placeholder issues
  FORBIDDEN_PATTERNS.forEach((pattern, index) => {
    if (pattern.test(content)) {
      switch (index) {
        case 0:
        case 1:
        case 2:
          issues.push('Contains company name placeholder');
          break;
        case 3:
          issues.push('Contains generic garden center reference');
          break;
        case 4:
        case 5:
        case 6:
          issues.push('Contains location placeholder');
          break;
        case 7:
          issues.push('Contains placeholder text in brackets');
          break;
        case 8:
          issues.push('Contains code blocks');
          break;
      }
    }
  });
  
  // Check for any remaining placeholder patterns
  const lowerContent = content.toLowerCase();
  FORBIDDEN_PHRASES.forEach(phrase => {
    if (lowerContent.includes(phrase.toLowerCase())) {
      issues.push(`Contains placeholder: "${phrase}"`);
    }
  });
  
  return {
    isValid: issues.length === 0,
    issues
  };
}
