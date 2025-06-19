
import { validateContent } from '../../utils/contentValidation';
import type { ValidationResult } from '../../types/contentGeneration';

export type { ValidationResult };

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
    
    // Only attempt basic cleanup for placeholder issues - preserve all formatting
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
    
    // Only clean up actual placeholder issues - preserve all formatting
    cleaned = cleaned.replace(/\[company\s*name\]/gi, 'we');
    cleaned = cleaned.replace(/\[garden\s*center\s*name\]/gi, 'our garden center');
    cleaned = cleaned.replace(/\[business\s*name\]/gi, 'our business');
    cleaned = cleaned.replace(/your\s*garden\s*center(?!\s+name)/gi, 'our garden center');
    cleaned = cleaned.replace(/\[region\]/gi, 'your area');
    cleaned = cleaned.replace(/\[location\]/gi, 'your area');
    cleaned = cleaned.replace(/\[garden\s*center\s*location\]/gi, 'your area');
    
    return cleaned.trim();
  }
  
  static getValidationSummary(issues: string[]): string {
    if (issues.length === 0) return 'Content passed all validation checks.';
    
    return `Content validation issues: ${issues.join(', ')}`;
  }
}
