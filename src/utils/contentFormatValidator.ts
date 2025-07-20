/**
 * Content Format Validator
 * Validates content after processing to ensure proper formatting and readability
 */

export interface ContentValidationResult {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
}

export const validateFormattedContent = (content: string, contentType: string): ContentValidationResult => {
  const issues: string[] = [];
  const suggestions: string[] = [];
  
  if (!content || content.trim().length === 0) {
    issues.push('Content is empty');
    return { isValid: false, issues, suggestions };
  }
  
  // Check for common formatting issues
  
  // 1. Check for text running together (missing spaces)
  const hasRunTogetherText = /[a-z][A-Z]|[a-z]\*\*[A-Z]|[.!?][A-Z]/.test(content);
  if (hasRunTogetherText) {
    issues.push('Text appears to be running together without proper spacing');
    suggestions.push('Review content for missing spaces between sentences or words');
  }
  
  // 2. Check for malformed markdown
  const unbalancedBold = (content.match(/\*\*/g) || []).length % 2 !== 0;
  if (unbalancedBold) {
    issues.push('Unbalanced bold markdown formatting detected');
    suggestions.push('Check for missing ** bold closing tags');
  }
  
  // 3. Check for excessive whitespace
  const hasExcessiveWhitespace = /\s{4,}/.test(content) || /\n{4,}/.test(content);
  if (hasExcessiveWhitespace) {
    issues.push('Excessive whitespace detected');
    suggestions.push('Clean up extra spaces and line breaks');
  }
  
  // 4. NEW: Check for repetitive headers
  const headerMatches = content.match(/<h[2-6][^>]*>([^<]+)<\/h[2-6]>/g) || [];
  const headerTexts = headerMatches.map(h => h.replace(/<[^>]*>/g, '').toLowerCase());
  const duplicateHeaders = headerTexts.filter((header, index) => headerTexts.indexOf(header) !== index);
  
  if (duplicateHeaders.length > 0) {
    issues.push('Repetitive headers detected');
    suggestions.push('Remove duplicate section headers to improve content flow');
  }
  
  // 5. NEW: Check for over-structured content
  const headerCount = headerMatches.length;
  const paragraphCount = (content.match(/<p[^>]*>/g) || []).length;
  const headerToContentRatio = headerCount / Math.max(paragraphCount, 1);
  
  if (headerToContentRatio > 0.5) {
    issues.push('Content may be over-structured with too many headers');
    suggestions.push('Consider reducing the number of section headers for better readability');
  }
  
  // 6. Content-type specific validation
  if (contentType === 'newsletter') {
    // Newsletter should have some structure but not too much
    const hasStructure = content.includes('<h') || content.includes('##') || content.includes('<p>');
    if (!hasStructure && content.length > 200) {
      suggestions.push('Consider adding minimal structure to improve newsletter readability');
    }
  }
  
  if (contentType === 'blog') {
    // Blog should have headers for very long content only
    const wordCount = content.split(/\s+/).length;
    const hasHeaders = content.includes('<h') || content.includes('##');
    if (wordCount > 500 && !hasHeaders) {
      suggestions.push('Consider adding section headers for very long blog content');
    }
  }
  
  // 7. Check for readability
  const averageSentenceLength = calculateAverageSentenceLength(content);
  if (averageSentenceLength > 30) {
    suggestions.push('Consider shorter sentences for better readability');
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    suggestions
  };
};

const calculateAverageSentenceLength = (content: string): number => {
  // Remove HTML tags for analysis
  const plainText = content.replace(/<[^>]*>/g, '');
  const sentences = plainText.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const totalWords = plainText.split(/\s+/).length;
  
  return sentences.length > 0 ? totalWords / sentences.length : 0;
};

export const repairFormattedContent = (content: string): string => {
  if (!content) return '';
  
  let repaired = content;
  
  // Fix common spacing issues
  repaired = repaired
    // Fix missing spaces after punctuation
    .replace(/([.!?])([A-Z])/g, '$1 $2')
    // Fix missing spaces around bold text
    .replace(/([a-z])\*\*([A-Z])/g, '$1 **$2')
    .replace(/\*\*([a-z])([A-Z])/g, '**$1** $2')
    // Fix excessive whitespace
    .replace(/\s{3,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    // Fix common markdown issues
    .replace(/\*\*\s+/g, '**')
    .replace(/\s+\*\*/g, '**')
    .trim();
  
  // NEW: Remove repetitive headers
  repaired = removeRepetitiveHeaders(repaired);
  
  return repaired;
};

// NEW: Function to remove repetitive headers
const removeRepetitiveHeaders = (content: string): string => {
  const headerPattern = /<h([2-6])[^>]*>([^<]+)<\/h\1>/g;
  const seenHeaders = new Set<string>();
  
  return content.replace(headerPattern, (match, level, text) => {
    const normalizedText = text.toLowerCase().trim();
    
    if (seenHeaders.has(normalizedText)) {
      // Remove repetitive header, but keep the content that follows
      return '';
    }
    
    seenHeaders.add(normalizedText);
    return match;
  });
};
