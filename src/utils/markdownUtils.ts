
// Utility functions for processing markdown content
export const markdownToHtmlBlocks = (markdown: string) => {
  if (!markdown) return [];
  
  const blocks = [];
  const sections = markdown.split(/\n\s*\n/);
  
  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;
    
    // Check if it's a header
    if (trimmed.startsWith('#')) {
      const level = trimmed.match(/^#+/)?.[0].length || 1;
      const text = trimmed.replace(/^#+\s*/, '');
      blocks.push({
        type: 'header',
        level,
        text,
        body: `<h${level}>${text}</h${level}>`
      });
    } else {
      // Regular paragraph
      blocks.push({
        type: 'paragraph',
        text: trimmed,
        body: trimmed
      });
    }
  }
  
  return blocks;
};

export const trimTo140 = (text: string, maxLength: number = 140): string => {
  if (!text || text.length <= maxLength) return text;
  
  // Find last complete word within limit
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > 0) {
    return truncated.substring(0, lastSpace) + '...';
  }
  
  return truncated + '...';
};

export const extractKeywordsFromContent = (content: string, fallback: string = 'garden'): string[] => {
  if (!content) return [fallback];
  
  // Extract first few meaningful words, removing common words
  const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
  const words = content
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !commonWords.includes(word))
    .slice(0, 3);
  
  return words.length > 0 ? words : [fallback];
};
