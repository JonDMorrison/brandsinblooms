
import { validateContent, FORBIDDEN_PATTERNS, FORBIDDEN_PHRASES } from './ContentGenerationConfig';

export interface ValidationResult {
  isValid: boolean;
  issues: string[];
  correctedContent?: string;
}

export class ContentValidator {
  static validate(content: string): ValidationResult {
    return validateContent(content);
  }
  
  static async validateAndRegenerate(
    content: string,
    regenerateFunction: () => Promise<string>,
    maxAttempts: number = 3
  ): Promise<{ content: string; attempts: number; issues: string[] }> {
    let attempts = 0;
    let currentContent = content;
    let lastIssues: string[] = [];
    
    while (attempts < maxAttempts) {
      const validation = this.validate(currentContent);
      
      if (validation.isValid) {
        return {
          content: currentContent,
          attempts: attempts + 1,
          issues: []
        };
      }
      
      lastIssues = validation.issues;
      attempts++;
      
      if (attempts < maxAttempts) {
        console.log(`Content validation failed (attempt ${attempts}), regenerating...`, validation.issues);
        try {
          currentContent = await regenerateFunction();
        } catch (error) {
          console.error('Error regenerating content:', error);
          break;
        }
      }
    }
    
    // If we've exhausted attempts, try basic cleanup
    const cleanedContent = this.attemptBasicCleanup(currentContent);
    const finalValidation = this.validate(cleanedContent);
    
    return {
      content: cleanedContent,
      attempts,
      issues: finalValidation.issues
    };
  }
  
  private static attemptBasicCleanup(content: string): string {
    let cleaned = content;
    
    // Remove green thumb references
    cleaned = cleaned.replace(/green\s*thumb[s]?/gi, 'gardening skills');
    
    // Remove welcome to phrases
    cleaned = cleaned.replace(/welcome\s*to[^.!?]*/gi, '');
    
    // Remove week references
    cleaned = cleaned.replace(/week\s*\d+/gi, 'this season');
    cleaned = cleaned.replace(/this\s*week/gi, 'right now');
    
    // Remove emojis
    cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu, '');
    
    // Convert bullet points to flowing text
    cleaned = cleaned.replace(/^\s*[-•]\s*(.+)$/gm, '$1. ');
    
    // Convert numbered lists to flowing text
    cleaned = cleaned.replace(/^\s*\d+\.\s*(.+)$/gm, '$1. ');
    
    // Clean up extra whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  }
  
  static getValidationSummary(issues: string[]): string {
    if (issues.length === 0) return 'Content passed all validation checks.';
    
    return `Content validation issues: ${issues.join(', ')}`;
  }
}
