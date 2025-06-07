
export const stripHtmlAndFormat = (content: string) => {
  if (!content) return content;
  
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
