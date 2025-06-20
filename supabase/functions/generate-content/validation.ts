
import { ValidationResult } from './types.ts';

export function validateContent(content: string, contentType?: string): ValidationResult {
  const issues: string[] = [];
  
  // Focus on critical issues only - allow formatting elements
  const criticalPatterns = [
    /\[Company Name\]/gi,           // Company name placeholder
    /\[Business Name\]/gi,          // Business name placeholder  
    /\[Garden Center Name\]/gi,     // Garden center placeholder
    /\[Location\]/gi,               // Location placeholder
    /\[Region\]/gi,                 // Region placeholder
    /Your Garden Center(?!\s+name)/gi, // Generic garden center reference (but allow "Your Garden Center name")
    /\[.*?\]/gi,                    // Any remaining bracket placeholders
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
        case 6: issues.push('Contains placeholder text in brackets'); break;
        case 7: issues.push('Contains code blocks'); break;
      }
    }
  });
  
  // Additional paragraph length validation for Facebook content
  if (contentType === 'facebook') {
    // Check for overly long paragraphs (more than 3 sentences without line breaks)
    const paragraphs = content.split('\n').filter(p => p.trim().length > 0);
    const longParagraphs = paragraphs.filter(p => {
      const sentences = p.split(/[.!?]+/).filter(s => s.trim().length > 0);
      return sentences.length > 2;
    });
    
    if (longParagraphs.length > 0) {
      issues.push('Contains paragraphs that are too long - use shorter paragraphs with line breaks');
    }
    
    // Check total word count for Facebook (should be ~125 words)
    const wordCount = content.split(/\s+/).length;
    if (wordCount > 150) {
      issues.push('Facebook content exceeds recommended word count - keep it shorter and more scannable');
    }
  }
  
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
