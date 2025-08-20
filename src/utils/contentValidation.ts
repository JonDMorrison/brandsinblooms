
import { ValidationResult } from '../types/contentGeneration';
import { validateNoWeekNumbers, sanitizeWeekNumbers } from './weekNumberSanitizer';

// Comprehensive validation - including emojis, formatting, and week numbers
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
  // COMPREHENSIVE emoji regex - all Unicode emoji ranges
  /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F1F0}-\u{1F1FF}]|[\u{1F170}-\u{1F251}]|[\u{1F004}\u{1F0CF}]|[\u{1F18E}]|[\u{3030}\u{2B50}\u{2B55}]|[\u{203C}\u{2049}\u{2122}\u{2139}]|[\u{2194}-\u{2199}]|[\u{21A9}-\u{21AA}]|[\u{231A}-\u{231B}]|[\u{2328}]|[\u{23CF}]|[\u{23E9}-\u{23F3}]|[\u{23F8}-\u{23FA}]|[\u{24C2}]|[\u{25AA}-\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{25FB}-\u{25FE}]|[\u{2600}-\u{2604}]|[\u{260E}]|[\u{2611}]|[\u{2614}-\u{2615}]|[\u{2618}]|[\u{261D}]|[\u{2620}]|[\u{2622}-\u{2623}]|[\u{2626}]|[\u{262A}]|[\u{262E}-\u{262F}]|[\u{2638}-\u{263A}]|[\u{2640}]|[\u{2642}]|[\u{2648}-\u{2653}]|[\u{265F}-\u{2660}]|[\u{2663}]|[\u{2665}-\u{2666}]|[\u{2668}]|[\u{267B}]|[\u{267E}-\u{267F}]|[\u{2692}-\u{2697}]|[\u{2699}]|[\u{269B}-\u{269C}]|[\u{26A0}-\u{26A1}]|[\u{26AA}-\u{26AB}]|[\u{26B0}-\u{26B1}]|[\u{26BD}-\u{26BE}]|[\u{26C4}-\u{26C5}]|[\u{26C8}]|[\u{26CE}]|[\u{26CF}]|[\u{26D1}]|[\u{26D3}-\u{26D4}]|[\u{26E9}-\u{26EA}]|[\u{26F0}-\u{26F5}]|[\u{26F7}-\u{26FA}]|[\u{26FD}]|[\u{2702}]|[\u{2705}]|[\u{2708}-\u{2709}]|[\u{270A}-\u{270B}]|[\u{270C}-\u{270D}]|[\u{270F}]|[\u{2712}]|[\u{2714}]|[\u{2716}]|[\u{271D}]|[\u{2721}]|[\u{2728}]|[\u{2733}-\u{2734}]|[\u{2744}]|[\u{2747}]|[\u{274C}]|[\u{274E}]|[\u{2753}-\u{2755}]|[\u{2757}]|[\u{2763}-\u{2764}]|[\u{2795}-\u{2797}]|[\u{27A1}]|[\u{27B0}]|[\u{27BF}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{2B1B}-\u{2B1C}]|[\u{2B50}]|[\u{2B55}]|[\u{3297}]|[\u{3299}]/gu
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

// Video-specific scene patterns that should be removed
export const VIDEO_SCENE_PATTERNS = [
  // Scene headers and descriptions
  /\*\*\[Scene \d+:.*?\]\*\*/gi,
  /\[Scene \d+:.*?\]/gi,
  /\*\*Scene \d+:.*?\*\*/gi,
  /Scene \d+:.*?(?=\n|\r)/gi,
  
  // Visual and production cues
  /\*Visual:.*?\*/gi,
  /\*Background Music:.*?\*/gi,
  /\*Audio:.*?\*/gi,
  /\*Setting:.*?\*/gi,
  
  // Camera directions
  /Camera pans to.*?(?=\n|\r)/gi,
  /Close-up of.*?(?=\n|\r)/gi,
  /Wide shot.*?(?=\n|\r)/gi,
  /Cut to.*?(?=\n|\r)/gi,
  
  // Narrator and host labels
  /\*\*Narrator \(Voiceover\):\*\*/gi,
  /Narrator \(Voiceover\):/gi,
  /\*\*Host:\*\*/gi,
  /Host:/gi,
  
  // Video formatting
  /\*\*Video Title:.*?\*\*/gi,
  /\*\*Title:.*?\*\*/gi,
  /Video Title:.*?(?=\n|\r)/gi,
  
  // Timestamps and timing
  /\d+:\d+\s*-\s*\d+:\d+/gi,
  /\[\d+:\d+\]/gi,
  
  // Stage directions
  /\(.*?walks to.*?\)/gi,
  /\(.*?points to.*?\)/gi,
  /\(.*?gestures.*?\)/gi,
  /\(.*?demonstrates.*?\)/gi,
  
  // Production notes
  /\*\*\[.*?\]\*\*/gi,
  /---+/gi
];

// ENHANCED emoji removal with proper spacing preservation
export function stripEmojis(content: string): string {
  if (!content) return '';
  
  // First, identify emoji positions and surrounding context
  const emojiPattern = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F1F0}-\u{1F1FF}]|[\u{1F170}-\u{1F251}]|[\u{1F004}\u{1F0CF}]|[\u{1F18E}]|[\u{3030}\u{2B50}\u{2B55}]|[\u{203C}\u{2049}\u{2122}\u{2139}]|[\u{2194}-\u{2199}]|[\u{21A9}-\u{21AA}]|[\u{231A}-\u{231B}]|[\u{2328}]|[\u{23CF}]|[\u{23E9}-\u{23F3}]|[\u{23F8}-\u{23FA}]|[\u{24C2}]|[\u{25AA}-\u{25AB}]|[\u{25B6}]|[\u{25C0}]|[\u{25FB}-\u{25FE}]|[\u{2600}-\u{2604}]|[\u{260E}]|[\u{2611}]|[\u{2614}-\u{2615}]|[\u{2618}]|[\u{261D}]|[\u{2620}]|[\u{2622}-\u{2623}]|[\u{2626}]|[\u{262A}]|[\u{262E}-\u{262F}]|[\u{2638}-\u{263A}]|[\u{2640}]|[\u{2642}]|[\u{2648}-\u{2653}]|[\u{265F}-\u{2660}]|[\u{2663}]|[\u{2665}-\u{2666}]|[\u{2668}]|[\u{267B}]|[\u{267E}-\u{267F}]|[\u{2692}-\u{2697}]|[\u{2699}]|[\u{269B}-\u{269C}]|[\u{26A0}-\u{26A1}]|[\u{26AA}-\u{26AB}]|[\u{26B0}-\u{26B1}]|[\u{26BD}-\u{26BE}]|[\u{26C4}-\u{26C5}]|[\u{26C8}]|[\u{26CE}]|[\u{26CF}]|[\u{26D1}]|[\u{26D3}-\u{26D4}]|[\u{26E9}-\u{26EA}]|[\u{26F0}-\u{26F5}]|[\u{26F7}-\u{26FA}]|[\u{26FD}]|[\u{2702}]|[\u{2705}]|[\u{2708}-\u{2709}]|[\u{270A}-\u{270B}]|[\u{270C}-\u{270D}]|[\u{270F}]|[\u{2712}]|[\u{2714}]|[\u{2716}]|[\u{271D}]|[\u{2721}]|[\u{2728}]|[\u{2733}-\u{2734}]|[\u{2744}]|[\u{2747}]|[\u{274C}]|[\u{274E}]|[\u{2753}-\u{2755}]|[\u{2757}]|[\u{2763}-\u{2764}]|[\u{2795}-\u{2797}]|[\u{27A1}]|[\u{27B0}]|[\u{27BF}]|[\u{2934}-\u{2935}]|[\u{2B05}-\u{2B07}]|[\u{2B1B}-\u{2B1C}]|[\u{2B50}]|[\u{2B55}]|[\u{3297}]|[\u{3299}]/gu;
  
  // Smart emoji removal with context-aware spacing
  return content
    .replace(/(\s*)[\u{1F600}-\u{1F64F}](\s*)/gu, (match, before, after) => {
      // If emoji is between words, preserve single space
      if (before && after) return ' ';
      // If emoji is at start/end, preserve existing spacing
      return before || after || '';
    })
    .replace(/(\s*)[\u{1F300}-\u{1F5FF}](\s*)/gu, (match, before, after) => {
      if (before && after) return ' ';
      return before || after || '';
    })
    .replace(/(\s*)[\u{1F680}-\u{1F6FF}](\s*)/gu, (match, before, after) => {
      if (before && after) return ' ';
      return before || after || '';
    })
    // Apply same logic to all other emoji ranges
    .replace(/(\s*)[\u{1F1E0}-\u{1F1FF}](\s*)/gu, (match, before, after) => {
      if (before && after) return ' ';
      return before || after || '';
    })
    .replace(/(\s*)[\u{2600}-\u{26FF}](\s*)/gu, (match, before, after) => {
      if (before && after) return ' ';
      return before || after || '';
    })
    .replace(/(\s*)[\u{2700}-\u{27BF}](\s*)/gu, (match, before, after) => {
      if (before && after) return ' ';
      return before || after || '';
    })
    .replace(/(\s*)[\u{1F900}-\u{1F9FF}](\s*)/gu, (match, before, after) => {
      if (before && after) return ' ';
      return before || after || '';
    })
    .replace(/(\s*)[\u{1F1F0}-\u{1F1FF}](\s*)/gu, (match, before, after) => {
      if (before && after) return ' ';
      return before || after || '';
    })
    // Clean up multiple spaces that might result from emoji removal
    .replace(/\s{3,}/g, ' ')
    .replace(/\n\s+\n/g, '\n\n')
    .trim();
}

// Function to clean video script formatting - ENHANCED
export function cleanVideoScript(content: string): string {
  let cleaned = content;
  
  // Remove all video scene patterns
  VIDEO_SCENE_PATTERNS.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });
  
  // Additional cleanup for common video script elements
  cleaned = cleaned
    // Remove any remaining bracketed content
    .replace(/\[.*?\]/g, '')
    // Remove asterisk-wrapped content
    .replace(/\*[^*]*\*/g, '')
    // Remove parenthetical stage directions
    .replace(/\([^)]*walks[^)]*\)/gi, '')
    .replace(/\([^)]*points[^)]*\)/gi, '')
    .replace(/\([^)]*gestures[^)]*\)/gi, '')
    .replace(/\([^)]*demonstrates[^)]*\)/gi, '')
    // Remove setting descriptions
    .replace(/SETTING:.*?(?=\n|\r|$)/gi, '')
    .replace(/Location:.*?(?=\n|\r|$)/gi, '')
    // Clean up extra whitespace and dashes
    .replace(/---+/g, '')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .replace(/^\s+|\s+$/gm, '') // Trim each line
    .trim();
    
  return cleaned;
}

export function validateContent(content: string): ValidationResult {
  const issues: string[] = [];
  
  // Check for week number violations FIRST
  const weekValidation = validateNoWeekNumbers(content);
  if (!weekValidation.isValid) {
    issues.push(...weekValidation.issues);
  }
  
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
          issues.push('Contains emojis - STRICTLY FORBIDDEN');
          break;
      }
    }
  });
  
  // Check for video scene information
  VIDEO_SCENE_PATTERNS.forEach(pattern => {
    if (pattern.test(content)) {
      issues.push('Contains video scene information - needs clean teaching script only');
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

/**
 * Enhanced validation that applies sanitization and then validates
 */
export function validateAndSanitizeContent(content: string): {
  sanitized: string;
  validation: ValidationResult;
} {
  // First sanitize week numbers
  const sanitized = sanitizeWeekNumbers(content);
  
  // Then validate the sanitized content
  const validation = validateContent(sanitized);
  
  return {
    sanitized,
    validation
  };
}
