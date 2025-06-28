
// Magazine-style markdown to HTML processor for newsletters
export const renderMarkdownToMagazineHtml = (markdown: string): string => {
  if (!markdown) return '';
  
  // Calculate reading time (average 200 words per minute)
  const wordCount = markdown.replace(/[^\w\s]/g, '').split(/\s+/).length;
  const readTime = Math.ceil(wordCount / 200);
  
  let html = markdown;
  
  // Convert headers with magazine styling
  html = html
    .replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold text-gray-900 mb-6 leading-tight">$1</h1>')
    .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold text-slate-900 mt-8 mb-4 pb-2 border-b border-slate-200">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="text-xl font-semibold text-slate-800 mt-6 mb-3">$1</h3>');
  
  // Convert bold and italic with custom styling
  html = html
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="italic text-slate-700">$1</em>');
  
  // Convert paragraphs and handle floating images
  const paragraphs = html.split(/\n\s*\n/);
  const processedParagraphs = paragraphs.map(paragraph => {
    paragraph = paragraph.trim();
    if (!paragraph) return '';
    
    // Skip if already a header
    if (paragraph.match(/^<h[1-6]/)) return paragraph;
    
    // Check if paragraph starts with an image
    const imgMatch = paragraph.match(/^!\[([^\]]*)\]\(([^)]+)\)(.*)$/s);
    if (imgMatch) {
      const [, alt, src, rest] = imgMatch;
      const floatingImg = `<img src="${src}" alt="${alt}" class="w-1/3 float-right ml-6 mb-4 clear-both" />`;
      const restContent = rest.trim();
      
      if (restContent) {
        return `<p class="text-slate-700 leading-relaxed">${floatingImg}${restContent}</p>`;
      } else {
        return floatingImg;
      }
    }
    
    // Regular paragraph
    if (!paragraph.startsWith('<')) {
      return `<p class="text-slate-700 leading-relaxed">${paragraph}</p>`;
    }
    
    return paragraph;
  });
  
  // Convert lists
  html = processedParagraphs.join('\n')
    .replace(/^\* (.+)$/gm, '<li class="ml-6 mb-2 text-slate-700">$1</li>')
    .replace(/^- (.+)$/gm, '<li class="ml-6 mb-2 text-slate-700">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-6 mb-2 text-slate-700">$2</li>');
  
  // Wrap consecutive list items in ul tags
  html = html.replace(/(<li[^>]*>.*?<\/li>\s*)+/gs, (match) => {
    return `<ul class="space-y-1 mb-6">${match}</ul>`;
  });
  
  // Add highlight blocks for special content (using [!NOTE] syntax)
  html = html.replace(/\[!NOTE\]\s*\n(.*?)(?=\n\n|\n$|$)/gs, 
    '<div class="bg-slate-50 py-2 px-4 rounded-lg border-l-4 border-primary mb-4"><p class="text-slate-700 leading-relaxed m-0">$1</p></div>');
  
  // Add reading time at the top
  const readTimeHtml = `<p class="text-sm italic text-slate-600 mb-4">Estimated read time: ${readTime} min</p>`;
  
  return readTimeHtml + html;
};

// Extract plain text for thumbnails (first 100 chars)
export const extractNewsletterThumbnail = (markdown: string, maxLength: number = 100): string => {
  if (!markdown) return '';
  
  // Remove markdown syntax and get plain text
  const plainText = markdown
    .replace(/^#{1,6}\s+/gm, '') // Remove headers
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.*?)\*/g, '$1') // Remove italic
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '') // Remove images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
    .replace(/\n+/g, ' ') // Replace line breaks with spaces
    .trim();
  
  if (plainText.length <= maxLength) return plainText;
  
  // Find the last complete word within the limit
  const truncated = plainText.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > 0) {
    return truncated.substring(0, lastSpace) + '...';
  }
  
  return truncated + '...';
};
