
export const createBlocksFromPlainText = (rawContent: string, campaignTitle?: string) => {
  if (!rawContent || rawContent.trim().length === 0) {
    console.log('🚫 Creating placeholder block due to empty content');
    return [{
      title: 'Newsletter Content Loading',
      body: 'Your newsletter content is being generated with expert gardening advice...',
      cta: 'Visit us for expert advice',
      link: '',
      image_prompt: 'newsletter professional garden center informative',
      alt_text: 'Newsletter content image'
    }];
  }

  // For legitimate content, create proper blocks
  const lines = rawContent.split('\n').filter(line => line.trim().length > 0);
  
  if (lines.length === 0) {
    return [{
      title: 'Newsletter Update',
      body: rawContent.trim(),
      cta: '',
      link: '',
      image_prompt: `newsletter professional ${campaignTitle || 'garden center'} informative`,
      alt_text: 'Newsletter content image'
    }];
  }

  // If we have multiple lines, create sections
  if (lines.length > 2) {
    const sections = [];
    let currentSection = '';
    
    for (const line of lines) {
      // Check if this looks like a header (short line that might be a title)
      const isHeader = line.length < 60 && (
        line === line.toUpperCase() ||
        line.includes('WEEK') ||
        line.includes('FOCUS') ||
        line.includes(':') ||
        /^[A-Z][A-Za-z\s]+$/.test(line.trim())
      );
      
      if (isHeader && currentSection.length > 50) {
        sections.push(currentSection.trim());
        currentSection = line + '\n';
      } else {
        currentSection += line + '\n';
      }
    }
    
    if (currentSection.trim().length > 0) {
      sections.push(currentSection.trim());
    }
    
    if (sections.length > 1) {
      return sections.map((section, index) => {
        const sectionLines = section.split('\n');
        const title = sectionLines[0]?.trim() || `Section ${index + 1}`;
        const body = sectionLines.slice(1).join('\n').trim() || section;
        
        return {
          title: title.length > 100 ? `Section ${index + 1}` : title,
          body: body || section,
          cta: index === sections.length - 1 ? 'Visit us for more information' : '',
          link: '',
          image_prompt: `newsletter professional ${campaignTitle || 'garden center'} ${title.toLowerCase().replace(/[^a-z0-9\s]/g, '')} informative`,
          alt_text: `${title} - newsletter section image`
        };
      });
    }
  }
  
  // For shorter content or single sections, create one main block
  const title = lines[0]?.trim() || 'Newsletter Update';
  const body = lines.length > 1 ? lines.slice(1).join('\n').trim() : rawContent.trim();
  
  return [{
    title: title.length > 100 ? 'Newsletter Update' : title,
    body: body || rawContent.trim(),
    cta: 'Visit us for more information',
    link: '',
    image_prompt: `newsletter professional ${campaignTitle || 'garden center'} ${title.toLowerCase().replace(/[^a-z0-9\s]/g, '')} informative`,
    alt_text: `${title} - newsletter image`
  }];
};

export const calculateReadingTime = (text: string): string => {
  if (!text) return '≈1 min';
  const wordCount = text.replace(/<[^>]*>/g, '').split(/\s+/).length;
  const minutes = Math.ceil(wordCount / 200);
  return `≈${minutes} min`;
};

export const extractTitleFromContent = (content: string, campaignTitle?: string): string => {
  const lines = content.split('\n').filter(line => line.trim().length > 0);
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    if (firstLine.length < 100 && !firstLine.endsWith('.') && !firstLine.includes('\n')) {
      return firstLine;
    }
  }
  return campaignTitle || 'Newsletter Update';
};

export const generateIntroFromContent = (content: string, campaignTitle?: string): string => {
  const lines = content.split('\n').filter(line => line.trim().length > 20);
  const firstMeaningfulLine = lines.find(line => 
    !line.includes('#') && 
    !line.includes('WEEK') && 
    line.length > 30 &&
    line.length < 200
  );
  return firstMeaningfulLine || `Discover expert gardening insights for ${campaignTitle || 'seasonal care'}`;
};

export const checkIsPlaceholderContent = (content: string): boolean => {
  return !content || 
    content.trim().length === 0 ||
    content.trim() === 'Newsletter Update' ||
    content.trim() === 'Newsletter Update.' ||
    content === 'Newsletter Update. Welcome to our latest newsletter update.' ||
    // Only flag as placeholder if content is extremely minimal (less than 50 characters and generic)
    (content.trim().length < 50 && 
     (content.includes('Welcome to our latest newsletter update') || 
      content === 'Newsletter Update. Welcome to our latest newsletter update'));
};
