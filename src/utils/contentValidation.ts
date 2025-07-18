
import { ValidationResult } from '../types/contentGeneration';

// Comprehensive validation - including emojis and formatting
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
  /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, // Emojis
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

// Function to strip emojis from content
export function stripEmojis(content: string): string {
  return content.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
}

// Function to clean video script formatting
export function cleanVideoScript(content: string): string {
  return content
    // Remove scene headers
    .replace(/\*\*\[Scene \d+:.*?\]\*\*/g, '')
    .replace(/\[Scene \d+:.*?\]/g, '')
    // Remove visual cues
    .replace(/\*Visual:.*?\*/g, '')
    .replace(/\*Background Music:.*?\*/g, '')
    // Remove narrator labels
    .replace(/\*\*Narrator \(Voiceover\):\*\*/g, '')
    .replace(/Narrator \(Voiceover\):/g, '')
    .replace(/\*\*Host:\*\*/g, '')
    .replace(/Host:/g, '')
    // Remove video formatting
    .replace(/\*\*Video Title:.*?\*\*/g, '')
    .replace(/\*\*Title:.*?\*\*/g, '')
    .replace(/\*\*\[.*?\]\*\*/g, '')
    .replace(/\[.*?\]/g, '')
    // Clean up extra whitespace and dashes
    .replace(/---+/g, '')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

export function validateContent(content: string): ValidationResult {
  const issues: string[] = [];
  
  // Check for all forbidden patterns including emojis
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
        case 9:
          issues.push('Contains emojis');
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
