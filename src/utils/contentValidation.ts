
import { ValidationResult } from '../types/contentGeneration';

export const FORBIDDEN_PATTERNS = [
  /green\s*thumb/gi,
  /welcome\s*to/gi,
  /week\s*\d+/gi,
  /this\s*week/gi,
  /week\s*number/gi,
  /\bweek\s*(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty)\b/gi,
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
  'welcome to our',
  'welcome to the',
  'this week',
  'week number',
  'happy week',
  'week 1', 'week 2', 'week 3', 'week 4', 'week 5', 'week 6', 'week 7', 'week 8', 'week 9', 'week 10',
  'week 11', 'week 12', 'week 13', 'week 14', 'week 15', 'week 16', 'week 17', 'week 18', 'week 19', 'week 20',
  'week 21', 'week 22', 'week 23', 'week 24', 'week 25', 'week 26', 'week 27', 'week 28', 'week 29', 'week 30',
  'week 31', 'week 32', 'week 33', 'week 34', 'week 35', 'week 36', 'week 37', 'week 38', 'week 39', 'week 40',
  'week 41', 'week 42', 'week 43', 'week 44', 'week 45', 'week 46', 'week 47', 'week 48', 'week 49', 'week 50',
  'week 51', 'week 52',
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
        case 4:
        case 5:
          issues.push('Contains week number references');
          break;
        case 6:
          issues.push('Contains emojis');
          break;
        case 7:
          issues.push('Contains bullet points');
          break;
        case 8:
          issues.push('Contains numbered lists');
          break;
        case 9:
          issues.push('Contains company name placeholder');
          break;
        case 10:
          issues.push('Contains garden center name placeholder');
          break;
        case 11:
          issues.push('Contains generic garden center reference');
          break;
        case 12:
          issues.push('Contains region placeholder');
          break;
        case 13:
          issues.push('Contains location placeholder');
          break;
        case 14:
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
