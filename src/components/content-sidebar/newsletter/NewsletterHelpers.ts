
// Helper functions for newsletter content processing and display

export const createBlocksFromPlainText = (content: string, campaignTitle?: string) => {
  if (!content) return [];
  
  console.log('Creating blocks from plain text, content length:', content.length);
  
  // If content looks like raw YAML, try to extract meaningful content
  if (content.includes('blocks:') && content.includes('- title:')) {
    console.log('Detected raw YAML content, extracting meaningful parts');
    
    const blocks = [];
    const lines = content.split('\n');
    let currentBlock = { title: '', body: '', cta: '', link: '', image_prompt: '', alt_text: '' };
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- title:')) {
        if (currentBlock.title) {
          blocks.push({ ...currentBlock });
        }
        currentBlock = {
          title: trimmed.replace('- title:', '').replace(/"/g, '').trim(),
          body: '',
          cta: '',
          link: '',
          image_prompt: '',
          alt_text: ''
        };
      } else if (trimmed.startsWith('body:')) {
        currentBlock.body = trimmed.replace('body:', '').replace(/"/g, '').trim();
      } else if (trimmed.startsWith('cta:')) {
        currentBlock.cta = trimmed.replace('cta:', '').replace(/"/g, '').trim();
      } else if (trimmed.startsWith('link:')) {
        currentBlock.link = trimmed.replace('link:', '').replace(/"/g, '').trim();
      } else if (trimmed.startsWith('image_prompt:')) {
        currentBlock.image_prompt = trimmed.replace('image_prompt:', '').replace(/"/g, '').trim();
      } else if (trimmed.startsWith('alt_text:')) {
        currentBlock.alt_text = trimmed.replace('alt_text:', '').replace(/"/g, '').trim();
      }
    }
    
    if (currentBlock.title) {
      blocks.push(currentBlock);
    }
    
    console.log('Extracted', blocks.length, 'blocks from YAML content');
    return blocks;
  }
  
  // For regular content, split into logical sections
  const sections = content.split(/\n\s*\n/).filter(section => section.trim());
  
  return sections.map((section, index) => {
    const lines = section.split('\n').filter(line => line.trim());
    const title = lines[0]?.replace(/^#+\s*/, '').replace(/\*\*(.*?)\*\*/, '$1').trim() || `Section ${index + 1}`;
    const body = lines.slice(1).join(' ').trim() || lines[0]?.trim() || '';
    
    return {
      title,
      body,
      cta: '',
      link: '',
      image_prompt: `${campaignTitle || 'garden'} ${title}`.toLowerCase(),
      alt_text: `Image for ${title}`
    };
  });
};

export const calculateReadingTime = (content: string): string => {
  if (!content) return '1 min read';
  
  const wordCount = content.replace(/<[^>]*>/g, '').split(/\s+/).length;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200)); // 200 words per minute
  return `${readingTime} min read`;
};

export const extractTitleFromContent = (content: string, fallback?: string): string => {
  if (!content) return fallback || 'Newsletter';
  
  // Try to find a markdown header
  const headerMatch = content.match(/^#+\s*(.+)$/m);
  if (headerMatch) {
    return headerMatch[1].replace(/\*\*(.*?)\*\*/, '$1').trim();
  }
  
  // Try to find bold text that looks like a title
  const boldMatch = content.match(/\*\*([^*]+)\*\*/);
  if (boldMatch && boldMatch[1].length < 100) {
    return boldMatch[1].trim();
  }
  
  // Use first line if it's short enough
  const firstLine = content.split('\n')[0]?.trim();
  if (firstLine && firstLine.length < 100 && !firstLine.includes(':')) {
    return firstLine.replace(/\*\*(.*?)\*\*/, '$1').trim();
  }
  
  return fallback || 'Newsletter';
};

export const generateIntroFromContent = (content: string, campaignTitle?: string): string => {
  if (!content) return '';
  
  // Look for content after the first title/header
  const lines = content.split('\n').filter(line => line.trim());
  
  // Skip the first line if it looks like a title
  const startIndex = lines[0]?.match(/^#+|^\*\*.*\*\*$/) ? 1 : 0;
  
  // Find the first substantial paragraph
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length > 50 && !line.includes(':') && !line.startsWith('-')) {
      return line.replace(/\*\*(.*?)\*\*/g, '$1').substring(0, 200) + (line.length > 200 ? '...' : '');
    }
  }
  
  return campaignTitle ? `Discover this week's ${campaignTitle.toLowerCase()} insights and tips.` : '';
};

export const checkIsPlaceholderContent = (content: string): boolean => {
  if (!content || content.trim().length === 0) {
    return true;
  }
  
  // Check for common placeholder patterns
  const placeholderPatterns = [
    /Seasonal Gardening Focus - Week/i,
    /This week's theme:/i,
    /content will be generated/i,
    /placeholder/i
  ];
  
  const hasPlaceholderPattern = placeholderPatterns.some(pattern => pattern.test(content));
  const isTooShort = content.replace(/\s/g, '').length < 50;
  
  console.log('Placeholder check:', {
    hasPlaceholderPattern,
    isTooShort,
    contentLength: content.length,
    isPlaceholder: hasPlaceholderPattern || isTooShort
  });
  
  return hasPlaceholderPattern || isTooShort;
};
