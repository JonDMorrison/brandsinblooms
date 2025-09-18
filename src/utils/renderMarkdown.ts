
// Magazine-style markdown to HTML processor for newsletters
export const renderMarkdownToMagazineHtml = (markdown: string): string => {
  if (!markdown) return '';
  
  // Calculate reading time (average 200 words per minute)
  const wordCount = markdown.replace(/[^\w\s]/g, '').split(/\s+/).length;
  const readTime = Math.ceil(wordCount / 200);
  
  let content = markdown.trim();
  
  // Step 1: Process headers first and mark them to prevent paragraph wrapping
  content = content
    .replace(/^# (.+)$/gm, '{{HEADER1}}$1{{/HEADER1}}')
    .replace(/^## (.+)$/gm, '{{HEADER2}}$1{{/HEADER2}}')
    .replace(/^### (.+)$/gm, '{{HEADER3}}$1{{/HEADER3}}');
  
  // Step 2: Process list items and mark them
  content = content
    .replace(/^[-*] (.+)$/gm, '{{LISTITEM}}$1{{/LISTITEM}}')
    .replace(/^(\d+)\. (.+)$/gm, '{{LISTITEM}}$2{{/LISTITEM}}');
  
  // Step 3: Process bold and italic formatting
  content = content
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="italic text-slate-700">$1</em>');
  
  // Step 4: Split into blocks and process paragraphs
  const blocks = content.split(/\n\s*\n/).filter(block => block.trim());
  
  const processedBlocks = blocks.map(block => {
    block = block.trim();
    if (!block) return '';
    
    // Check if block contains headers
    if (block.includes('{{HEADER')) {
      return block
        .replace(/{{HEADER1}}(.+?){{\/HEADER1}}/g, '<h1 class="text-3xl font-bold text-gray-900 mb-6 leading-tight">$1</h1>')
        .replace(/{{HEADER2}}(.+?){{\/HEADER2}}/g, '<h2 class="text-2xl font-bold text-slate-900 mt-8 mb-4 pb-2 border-b border-slate-200">$1</h2>')
        .replace(/{{HEADER3}}(.+?){{\/HEADER3}}/g, '<h3 class="text-xl font-semibold text-slate-800 mt-6 mb-3">$1</h3>');
    }
    
    // Check if block contains list items
    if (block.includes('{{LISTITEM}}')) {
      const listItems = block
        .replace(/{{LISTITEM}}(.+?){{\/LISTITEM}}/g, '<li class="ml-6 mb-2 text-slate-700">$1</li>')
        .split('\n')
        .filter(item => item.trim())
        .join('\n');
      return `<ul class="space-y-1 mb-6">\n${listItems}\n</ul>`;
    }
    
    // Check for images
    const imgMatch = block.match(/^!\[([^\]]*)\]\(([^)]+)\)(.*)$/s);
    if (imgMatch) {
      const [, alt, src, rest] = imgMatch;
      const floatingImg = `<img src="${src}" alt="${alt}" class="w-1/3 float-right ml-6 mb-4 clear-both" />`;
      const restContent = rest.trim();
      
      if (restContent) {
        return `<p class="text-slate-700 leading-relaxed mb-4">${floatingImg}${restContent}</p>`;
      } else {
        return floatingImg;
      }
    }
    
    // Regular paragraph - split by line breaks and wrap each line
    const lines = block.split('\n').filter(line => line.trim());
    if (lines.length === 1) {
      return `<p class="text-slate-700 leading-relaxed mb-4">${lines[0]}</p>`;
    } else {
      return lines.map(line => `<p class="text-slate-700 leading-relaxed mb-4">${line}</p>`).join('\n');
    }
  });
  
  let html = processedBlocks.join('\n\n');
  
  // Step 5: Handle special content blocks
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
