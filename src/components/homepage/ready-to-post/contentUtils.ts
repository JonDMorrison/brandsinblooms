
export const stripHtmlAndFormat = (content: string, isNewsletter: boolean = false) => {
  if (!content) return content;
  
  // For newsletters, use aggressive cleaning to remove all formatting
  if (isNewsletter) {
    return stripAllNewsletterFormatting(content);
  }
  
  // Check if content is HTML (contains HTML tags)
  if (content.includes('<html>') || content.includes('<!DOCTYPE')) {
    // Extract content from HTML body
    const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      content = bodyMatch[1];
    }
    
    // Remove all HTML tags but preserve structure
    content = content
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove style tags
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove script tags
      .replace(/<h[1-6][^>]*>/gi, '\n\n**') // Convert headers to bold
      .replace(/<\/h[1-6]>/gi, '**\n') // Close headers
      .replace(/<p[^>]*>/gi, '\n\n') // Convert paragraphs
      .replace(/<\/p>/gi, '') // Close paragraphs
      .replace(/<br[^>]*>/gi, '\n') // Convert line breaks
      .replace(/<li[^>]*>/gi, '\n• ') // Convert list items
      .replace(/<\/li>/gi, '') // Close list items
      .replace(/<ul[^>]*>|<\/ul>/gi, '') // Remove ul tags
      .replace(/<ol[^>]*>|<\/ol>/gi, '') // Remove ol tags
      .replace(/<strong[^>]*>|<b[^>]*>/gi, '**') // Convert bold tags
      .replace(/<\/strong>|<\/b>/gi, '**') // Close bold tags
      .replace(/<em[^>]*>|<i[^>]*>/gi, '*') // Convert italic tags
      .replace(/<\/em>|<\/i>/gi, '*') // Close italic tags
      .replace(/<a[^>]*>([^<]*)<\/a>/gi, '$1') // Extract link text
      .replace(/<[^>]*>/g, '') // Remove any remaining HTML tags
      .replace(/\\n/g, '\n') // Convert literal \n to actual newlines
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Clean up multiple line breaks
      .trim();
  } else {
    // Handle content that might have literal \n characters
    content = content.replace(/\\n/g, '\n');
  }
  
  return content;
};

// Strip ALL formatting from newsletter content
const stripAllNewsletterFormatting = (text: string): string => {
  if (!text) return '';
  
  // First try to parse as JSON newsletter
  const parsedNewsletter = parseNewsletterJson(text);
  if (parsedNewsletter) {
    const cleanSubject = cleanText(parsedNewsletter.subject);
    const cleanContent = cleanText(parsedNewsletter.content);
    return cleanSubject ? `${cleanSubject}\n\n${cleanContent}` : cleanContent;
  }
  
  return cleanText(text);
};

// Helper to parse newsletter JSON
const parseNewsletterJson = (content: string): { subject: string; content: string } | null => {
  try {
    if (content.includes('```json')) {
      const jsonMatch = content.match(/```json\s*\n([\s\S]*?)\n```/) || content.match(/```json\s*([\s\S]*?)```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1].trim());
        return { subject: parsed.subject || '', content: parsed.content || '' };
      }
    }
    const parsed = JSON.parse(content);
    if (parsed.subject && parsed.content) {
      return { subject: parsed.subject, content: parsed.content };
    }
  } catch (error) {
    // Not JSON
  }
  return null;
};

// Clean all formatting from text
const cleanText = (text: string): string => {
  if (!text) return '';
  
  return text
    // Remove HTML tags completely
    .replace(/<[^>]*>/g, '')
    // Remove HTML entities
    .replace(/&[a-zA-Z0-9#]+;/g, '')
    // Remove markdown headers but preserve text
    .replace(/^#{1,6}\s+(.+)$/gm, '$1')
    // Remove markdown bold and italic but preserve text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove code blocks and inline code
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // Remove links but keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    // Remove list markers but preserve content with bullets
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/^\s*\d+\.\s+/gm, '')
    // Remove blockquotes but preserve content
    .replace(/^\s*>\s+/gm, '')
    // Remove technical formatting
    .replace(/\[.*?\]/g, '')
    .replace(/\{.*?\}/g, '')
    // Clean up whitespace
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
};
