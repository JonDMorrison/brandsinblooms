
import { validateContent, FORBIDDEN_PATTERNS, FORBIDDEN_PHRASES } from '../../utils/contentValidation';
import { ValidationResult } from '../../types/contentGeneration';

export { ValidationResult };

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
    
    cleaned = cleaned.replace(/green\s*thumb[s]?/gi, 'gardening skills');
    cleaned = cleaned.replace(/welcome\s*to[^.!?]*/gi, '');
    cleaned = cleaned.replace(/week\s*\d+/gi, 'this season');
    cleaned = cleaned.replace(/this\s*week/gi, 'right now');
    cleaned = cleaned.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu, '');
    cleaned = cleaned.replace(/^\s*[-•]\s*(.+)$/gm, '$1. ');
    cleaned = cleaned.replace(/^\s*\d+\.\s*(.+)$/gm, '$1. ');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    return cleaned;
  }
  
  static getValidationSummary(issues: string[]): string {
    if (issues.length === 0) return 'Content passed all validation checks.';
    
    return `Content validation issues: ${issues.join(', ')}`;
  }
}
