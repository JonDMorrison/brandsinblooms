
export interface FacebookValidationResult {
  isValid: boolean;
  wordCount: number;
  maxWords: number;
  issues: string[];
  paragraphCount: number;
  longParagraphs: string[];
}

export function validateFacebookContent(content: string): FacebookValidationResult {
  const cleanContent = content.replace(/<[^>]*>/g, '').trim();
  const words = cleanContent.split(/\s+/).filter(word => word.length > 0);
  const wordCount = words.length;
  const maxWords = 125;
  
  // Split by double line breaks first, then single line breaks
  const paragraphs = cleanContent.split(/\n\n|\n/).filter(p => p.trim().length > 0);
  const longParagraphs: string[] = [];
  const issues: string[] = [];
  
  // Check each paragraph for sentence count
  paragraphs.forEach((paragraph, index) => {
    const sentences = paragraph.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length > 2) {
      longParagraphs.push(`Paragraph ${index + 1}: ${sentences.length} sentences`);
    }
  });
  
  // Word count validation
  if (wordCount > maxWords) {
    issues.push(`Exceeds ${maxWords} word limit (${wordCount} words)`);
  }
  
  // Paragraph structure validation
  if (longParagraphs.length > 0) {
    issues.push(`${longParagraphs.length} paragraphs have more than 2 sentences`);
  }
  
  // Check for lack of line breaks
  if (paragraphs.length < Math.ceil(wordCount / 25) && wordCount > 50) {
    issues.push('Needs more paragraph breaks for mobile readability');
  }
  
  return {
    isValid: issues.length === 0,
    wordCount,
    maxWords,
    issues,
    paragraphCount: paragraphs.length,
    longParagraphs
  };
}
