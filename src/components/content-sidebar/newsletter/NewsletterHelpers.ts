
// Helper functions for newsletter content processing and display

export const createBlocksFromPlainText = (content: string, campaignTitle?: string) => {
  if (!content) return [];
  
  console.log('Creating blocks from plain text, content length:', content.length);
  
  // Handle raw YAML content extraction
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
  
  // Enhanced section detection for regular content
  const sections = content.split(/\n\s*\n/).filter(section => section.trim());
  
  return sections.map((section, index) => {
    const lines = section.split('\n').filter(line => line.trim());
    
    // Enhanced title extraction
    let title = extractSectionTitle(lines[0]) || `Section ${index + 1}`;
    let body = lines.slice(1).join(' ').trim();
    
    // If no body content, use the first line as body and create a generic title
    if (!body && lines[0]) {
      body = lines[0].trim();
      title = generateTitleFromContent(body, index);
    }
    
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
  
  // Look for section headers
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (isHeaderLine(trimmed)) {
      return trimmed.replace(/\*\*(.*?)\*\*/, '$1').trim();
    }
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
  const startIndex = lines[0]?.match(/^#+|^\*\*.*\*\*$|^[A-Z][A-Z\s]{5,50}:?$/) ? 1 : 0;
  
  // Find the first substantial paragraph
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length > 50 && !line.includes(':') && !line.startsWith('-') && !isHeaderLine(line)) {
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

// Helper functions for enhanced content processing
const extractSectionTitle = (line: string): string | null => {
  if (!line) return null;
  
  const trimmed = line.trim();
  
  // Remove markdown syntax and extract clean title
  let title = trimmed
    .replace(/^#+\s*/, '')
    .replace(/\*\*(.*?)\*\*/, '$1')
    .replace(/__(.*?)__/, '$1')
    .trim();
  
  // Check if it looks like a title
  if (isHeaderLine(title)) {
    return title;
  }
  
  return null;
};

const generateTitleFromContent = (content: string, index: number): string => {
  // Try to extract a meaningful title from content
  const words = content.replace(/[^\w\s]/g, '').split(/\s+/).slice(0, 6);
  const title = words.join(' ');
  
  // Common newsletter topics
  const topics = [
    'Garden Focus', 'Plant Care', 'Seasonal Tips', 'Growing Guide',
    'Expert Advice', 'Garden Update', 'Plant Spotlight', 'Care Instructions'
  ];
  
  // Use topic-based title if content is too generic
  if (title.length < 10) {
    return topics[index % topics.length] || `Content ${index + 1}`;
  }
  
  return title.length > 50 ? title.substring(0, 47) + '...' : title;
};

const isHeaderLine = (line: string): boolean => {
  if (!line) return false;
  
  const trimmed = line.trim();
  
  // Known section headers
  const headerPatterns = [
    /^(this week's focus|garden focus|what's happening|expert tips|seasonal highlights|plant care tips|garden maintenance|special offers|featured plants|growing tips)$/i,
    /^[A-Z][A-Z\s&'-]{5,50}:?\s*$/,
    /^\d+\.\s*[A-Z]/,
    /^Week\s+\d+/i
  ];
  
  return headerPatterns.some(pattern => pattern.test(trimmed)) ||
    (trimmed.length < 60 && trimmed === trimmed.toUpperCase() && trimmed.split(' ').length <= 6) ||
    (trimmed.endsWith(':') && trimmed.length < 80) ||
    (trimmed.length < 100 && !trimmed.includes('.') && trimmed.split(' ').length <= 8);
};
