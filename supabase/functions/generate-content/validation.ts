
import { FORBIDDEN_PATTERNS, INSTAGRAM_FORBIDDEN_PATTERNS } from './constants.ts';
import { ValidationResult } from './types.ts';

export function validateContent(content: string, contentType?: string): ValidationResult {
  const issues: string[] = [];
  
  // Use more relaxed validation that allows better formatting
  const patterns = contentType === 'instagram' ? INSTAGRAM_FORBIDDEN_PATTERNS : FORBIDDEN_PATTERNS;
  
  // Focus on critical issues only - allow formatting elements
  const criticalPatterns = [
    /\[Company Name\]/gi,           // Company name placeholder
    /\[Business Name\]/gi,          // Business name placeholder  
    /\[Garden Center Name\]/gi,     // Garden center placeholder
    /\[Location\]/gi,               // Location placeholder
    /\[Region\]/gi,                 // Region placeholder
    /Your Garden Center(?!\s+name)/gi, // Generic garden center reference (but allow "Your Garden Center name")
    /```[\s\S]*?```/g,              // Code blocks
  ];
  
  // Check critical patterns only
  criticalPatterns.forEach((pattern, index) => {
    if (pattern.test(content)) {
      switch (index) {
        case 0:
        case 1:
        case 2: issues.push('Contains company name placeholder'); break;
        case 3:
        case 4: issues.push('Contains location placeholder'); break;
        case 5: issues.push('Contains generic garden center reference'); break;
        case 6: issues.push('Contains code blocks'); break;
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
