
import { ValidationResult } from '../types/contentGeneration';

export const FORBIDDEN_PATTERNS = [
  /green\s*thumb/gi,
  /welcome\s*to/gi,
  /week\s*\d+/gi,
  /this\s*week/gi,
  /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu,
  /^\s*[-•]\s/gm,
  /^\s*\d+\.\s/gm,
  /\[company\s*name\]/gi,
  /\[garden\s*center\s*name\]/gi,
  /your\s*garden\s*center/gi,
  /\[region\]/gi,
  /\[location\]/gi,
  /\[garden\s*center\s*location\]/gi,
];

export const FORBIDDEN_PHRASES = [
  'green thumb',
  'green thumbs',
  'welcome to',
  'this week',
  'week number',
  'happy week',
  '[company name]',
  '[garden center name]',
  'your garden center',
  '[region]',
  '[location]',
  '[garden center location]'
];

export function validateContent(content: string): ValidationResult {
  const issues: string[] = [];
  
  FORBIDDEN_PATTERNS.forEach((pattern, index) => {
    if (pattern.test(content)) {
      switch (index) {
        case 0:
          issues.push('Contains "green thumb" phrase');
          break;
        case 1:
          issues.push('Contains "Welcome to" opening');
          break;
        case 2:
        case 3:
          issues.push('Contains week number references');
          break;
        case 4:
          issues.push('Contains emojis');
          break;
        case 5:
          issues.push('Contains bullet points');
          break;
        case 6:
          issues.push('Contains numbered lists');
          break;
        case 7:
          issues.push('Contains company name placeholder');
          break;
        case 8:
          issues.push('Contains garden center name placeholder');
          break;
        case 9:
          issues.push('Contains generic garden center reference');
          break;
        case 10:
          issues.push('Contains region placeholder');
          break;
        case 11:
          issues.push('Contains location placeholder');
          break;
        case 12:
          issues.push('Contains garden center location placeholder');
          break;
      }
    }
  });
  
  const lowerContent = content.toLowerCase();
  FORBIDDEN_PHRASES.forEach(phrase => {
    if (lowerContent.includes(phrase)) {
      issues.push(`Contains forbidden phrase: "${phrase}"`);
    }
  });
  
  return {
    isValid: issues.length === 0,
    issues
  };
}
