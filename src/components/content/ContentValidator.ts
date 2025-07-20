
import { validateContent, cleanVideoScript } from '../../utils/contentValidation';
import { cleanVideoContent } from '../../utils/videoContentCleaner';
import type { ValidationResult } from '../../types/contentGeneration';

export type { ValidationResult };

export class ContentValidator {
  static validate(content: string): ValidationResult {
    return validateContent(content);
  }
  
  static async validateAndRegenerate(
    content: string,
    regenerateFunction: () => Promise<string>,
    maxAttempts: number = 3,
    contentType?: string
  ): Promise<{ content: string; attempts: number; issues: string[] }> {
    let attempts = 0;
    let currentContent = content;
    let lastIssues: string[] = [];
    
    while (attempts < maxAttempts) {
      const validation = this.validate(currentContent);
      
      if (validation.isValid) {
        // Apply content-type specific cleaning before returning
        const finalContent = this.applyContentTypeCleaning(currentContent, contentType);
        return {
          content: finalContent,
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
    
    // Attempt comprehensive cleanup for all content types
    const cleanedContent = this.attemptComprehensiveCleanup(currentContent, contentType);
    const finalValidation = this.validate(cleanedContent);
    
    return {
      content: cleanedContent,
      attempts,
      issues: finalValidation.issues
    };
  }
  
  private static applyContentTypeCleaning(content: string, contentType?: string): string {
    if (!contentType) return content;
    
    switch (contentType.toLowerCase()) {
      case 'video':
        return cleanVideoContent(content);
      default:
        return content;
    }
  }
  
  private static attemptComprehensiveCleanup(content: string, contentType?: string): string {
    let cleaned = content;
    
    // Apply content-type specific cleaning first
    if (contentType?.toLowerCase() === 'video') {
      cleaned = cleanVideoContent(cleaned);
    }
    
    // Then apply basic placeholder cleanup
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
