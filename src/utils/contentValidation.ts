
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

// Function to strip emojis from content - COMPREHENSIVE removal
export function stripEmojis(content: string): string {
  return content
    // Primary emoji ranges
    .replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F1F0}-\u{1F1FF}]/gu, '')
    // Additional emoji ranges
    .replace(/[\u{1F170}-\u{1F251}]/gu, '')
    .replace(/[\u{1F004}\u{1F0CF}]/gu, '')
    .replace(/[\u{1F18E}]/gu, '')
    .replace(/[\u{3030}\u{2B50}\u{2B55}]/gu, '')
    .replace(/[\u{203C}\u{2049}\u{2122}\u{2139}]/gu, '')
    .replace(/[\u{2194}-\u{2199}]/gu, '')
    .replace(/[\u{21A9}-\u{21AA}]/gu, '')
    .replace(/[\u{231A}-\u{231B}]/gu, '')
    .replace(/[\u{2328}]/gu, '')
    .replace(/[\u{23CF}]/gu, '')
    .replace(/[\u{23E9}-\u{23F3}]/gu, '')
    .replace(/[\u{23F8}-\u{23FA}]/gu, '')
    .replace(/[\u{24C2}]/gu, '')
    .replace(/[\u{25AA}-\u{25AB}]/gu, '')
    .replace(/[\u{25B6}]/gu, '')
    .replace(/[\u{25C0}]/gu, '')
    .replace(/[\u{25FB}-\u{25FE}]/gu, '')
    .replace(/[\u{2600}-\u{2604}]/gu, '')
    .replace(/[\u{260E}]/gu, '')
    .replace(/[\u{2611}]/gu, '')
    .replace(/[\u{2614}-\u{2615}]/gu, '')
    .replace(/[\u{2618}]/gu, '')
    .replace(/[\u{261D}]/gu, '')
    .replace(/[\u{2620}]/gu, '')
    .replace(/[\u{2622}-\u{2623}]/gu, '')
    .replace(/[\u{2626}]/gu, '')
    .replace(/[\u{262A}]/gu, '')
    .replace(/[\u{262E}-\u{262F}]/gu, '')
    .replace(/[\u{2638}-\u{263A}]/gu, '')
    .replace(/[\u{2640}]/gu, '')
    .replace(/[\u{2642}]/gu, '')
    .replace(/[\u{2648}-\u{2653}]/gu, '')
    .replace(/[\u{265F}-\u{2660}]/gu, '')
    .replace(/[\u{2663}]/gu, '')
    .replace(/[\u{2665}-\u{2666}]/gu, '')
    .replace(/[\u{2668}]/gu, '')
    .replace(/[\u{267B}]/gu, '')
    .replace(/[\u{267E}-\u{267F}]/gu, '')
    .replace(/[\u{2692}-\u{2697}]/gu, '')
    .replace(/[\u{2699}]/gu, '')
    .replace(/[\u{269B}-\u{269C}]/gu, '')
    .replace(/[\u{26A0}-\u{26A1}]/gu, '')
    .replace(/[\u{26AA}-\u{26AB}]/gu, '')
    .replace(/[\u{26B0}-\u{26B1}]/gu, '')
    .replace(/[\u{26BD}-\u{26BE}]/gu, '')
    .replace(/[\u{26C4}-\u{26C5}]/gu, '')
    .replace(/[\u{26C8}]/gu, '')
    .replace(/[\u{26CE}]/gu, '')
    .replace(/[\u{26CF}]/gu, '')
    .replace(/[\u{26D1}]/gu, '')
    .replace(/[\u{26D3}-\u{26D4}]/gu, '')
    .replace(/[\u{26E9}-\u{26EA}]/gu, '')
    .replace(/[\u{26F0}-\u{26F5}]/gu, '')
    .replace(/[\u{26F7}-\u{26FA}]/gu, '')
    .replace(/[\u{26FD}]/gu, '')
    .replace(/[\u{2702}]/gu, '')
    .replace(/[\u{2705}]/gu, '')
    .replace(/[\u{2708}-\u{2709}]/gu, '')
    .replace(/[\u{270A}-\u{270B}]/gu, '')
    .replace(/[\u{270C}-\u{270D}]/gu, '')
    .replace(/[\u{270F}]/gu, '')
    .replace(/[\u{2712}]/gu, '')
    .replace(/[\u{2714}]/gu, '')
    .replace(/[\u{2716}]/gu, '')
    .replace(/[\u{271D}]/gu, '')
    .replace(/[\u{2721}]/gu, '')
    .replace(/[\u{2728}]/gu, '')
    .replace(/[\u{2733}-\u{2734}]/gu, '')
    .replace(/[\u{2744}]/gu, '')
    .replace(/[\u{2747}]/gu, '')
    .replace(/[\u{274C}]/gu, '')
    .replace(/[\u{274E}]/gu, '')
    .replace(/[\u{2753}-\u{2755}]/gu, '')
    .replace(/[\u{2757}]/gu, '')
    .replace(/[\u{2763}-\u{2764}]/gu, '')
    .replace(/[\u{2795}-\u{2797}]/gu, '')
    .replace(/[\u{27A1}]/gu, '')
    .replace(/[\u{27B0}]/gu, '')
    .replace(/[\u{27BF}]/gu, '')
    .replace(/[\u{2934}-\u{2935}]/gu, '')
    .replace(/[\u{2B05}-\u{2B07}]/gu, '')
    .replace(/[\u{2B1B}-\u{2B1C}]/gu, '')
    .replace(/[\u{2B50}]/gu, '')
    .replace(/[\u{2B55}]/gu, '')
    .replace(/[\u{3297}]/gu, '')
    .replace(/[\u{3299}]/gu, '');
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
          issues.push('Contains emojis - STRICTLY FORBIDDEN');
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
