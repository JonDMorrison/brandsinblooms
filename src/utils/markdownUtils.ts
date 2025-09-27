
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

export const convertMarkdownToHtml = (markdown: string): string => {
  if (!markdown) return '';
  
  let html = markdown;
  
  // Detect if this is plain text (no markdown syntax)
  const hasMarkdownSyntax = /[#*\-]/.test(html);
  
  if (!hasMarkdownSyntax) {
    // Handle plain text content - preserve natural paragraph structure
    const paragraphs = html.split(/\n\s*\n+/);
    html = paragraphs
      .filter(p => p.trim())
      .map(p => {
        // Replace single line breaks with spaces, preserving intentional breaks
        const cleanText = p.trim().replace(/\n+/g, ' ').replace(/\s+/g, ' ');
        return `<p>${cleanText}</p>`;
      })
      .join('\n\n');
    
    return html;
  }
  
  // Enhanced processing for markdown content
  // First, normalize line breaks and ensure proper spacing
  html = html.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Ensure headers have proper line breaks after them
  // This fixes the case where content immediately follows a header without line breaks
  html = html.replace(/^(#{1,6}\s+.*?)(\n)(?!\n)/gim, '$1\n\n');
  
  // Convert headers with proper spacing (H1-H6)
  html = html.replace(/^###### (.*$)/gim, '<h6>$1</h6>\n\n');
  html = html.replace(/^##### (.*$)/gim, '<h5>$1</h5>\n\n');
  html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>\n\n');
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>\n\n');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>\n\n');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>\n\n');
  
  // Convert bold text (both ** and __ variants)
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
  
  // Convert italic text (both * and _ variants)
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.*?)_/g, '<em>$1</em>');
  
  // Convert bullet points and numbered lists
  html = html.replace(/^[-*+] (.*$)/gim, '<li>$1</li>');
  html = html.replace(/^\d+\. (.*$)/gim, '<li>$1</li>');
  
  // Wrap consecutive list items in ul tags for bullet points
  html = html.replace(/(<li>.*?<\/li>(?:\n<li>.*?<\/li>)*)/gs, (match) => {
    if (!match.includes('<ul>') && !match.includes('<ol>')) {
      return '<ul>\n' + match + '\n</ul>\n\n';
    }
    return match;
  });
  
  // Convert blockquotes
  html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');
  
  // Convert code blocks (triple backticks)
  html = html.replace(/```[\s\S]*?```/g, (match) => {
    const content = match.replace(/```\w*\n?/, '').replace(/```$/, '');
    return `<pre><code>${content}</code></pre>\n\n`;
  });
  
  // Convert inline code (single backticks)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Convert line breaks to paragraphs for remaining content
  const sections = html.split(/\n\s*\n/);
  html = sections
    .filter(section => section.trim())
    .map(section => {
      const trimmed = section.trim();
      // Don't wrap if already contains block elements
      if (trimmed.includes('<h') || trimmed.includes('<ul>') || trimmed.includes('<ol>') || 
          trimmed.includes('<li>') || trimmed.includes('<blockquote>') || 
          trimmed.includes('<pre>') || trimmed.includes('<code>')) {
        return trimmed;
      }
      // Handle single line breaks within paragraphs
      const cleanText = trimmed.replace(/\n+/g, ' ').replace(/\s+/g, ' ');
      return `<p>${cleanText}</p>`;
    })
    .join('\n\n');
  
  // Clean up extra whitespace
  html = html.replace(/\n{3,}/g, '\n\n').trim();
  
  return html;
};
