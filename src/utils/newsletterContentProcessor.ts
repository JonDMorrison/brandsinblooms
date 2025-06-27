
interface NewsletterBlock {
  title: string;
  body: string;
  cta?: string;
  link?: string;
  image_prompt?: string;
  alt_text?: string;
}

interface NewsletterMeta {
  reading_time: string;
  theme: string;
  week_focus: string;
}

export interface ProcessedNewsletter {
  newsletter_md: string;
  blocks: NewsletterBlock[];
  meta: NewsletterMeta;
  isStructured: boolean;
}

// Enhanced markdown to HTML conversion for newsletters
export const convertNewsletterMarkdownToHtml = (content: string): string => {
  if (!content) return '';
  
  let html = content;
  
  // Convert headers with proper styling
  html = html
    .replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold text-gray-900 mt-8 mb-6 leading-tight">$1</h1>')
    .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-semibold text-gray-900 mt-6 mb-4 leading-tight">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="text-xl font-medium text-gray-900 mt-4 mb-3">$1</h3>');
  
  // Convert bold and italic text
  html = html
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="italic text-gray-700">$1</em>');
  
  // Split into paragraphs and convert
  const paragraphs = html.split(/\n\s*\n/).filter(p => p.trim());
  
  html = paragraphs.map(paragraph => {
    const trimmed = paragraph.trim();
    
    // Skip if already wrapped in HTML tags (headers, etc.)
    if (trimmed.match(/^<(h[1-6]|div|ul|ol)/)) {
      return trimmed;
    }
    
    // Handle lines with just emphasis formatting
    if (trimmed.match(/^\*[^*]+\*$/)) {
      return `<p class="text-lg italic text-gray-700 mb-4 leading-relaxed">${trimmed}</p>`;
    }
    
    // Regular paragraphs
    return `<p class="text-gray-700 mb-4 leading-relaxed">${trimmed}</p>`;
  }).join('\n');
  
  // Handle horizontal rules
  html = html.replace(/^---$/gm, '<hr class="border-t border-gray-200 my-8">');
  
  return html;
};

// Create blocks from plain text content
export const createBlocksFromPlainText = (content: string, campaignTitle?: string): NewsletterBlock[] => {
  if (!content) return [];
  
  const sections = content.split(/\n\s*\n/).filter(section => section.trim());
  const blocks: NewsletterBlock[] = [];
  
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i].trim();
    
    // Check if section starts with a header
    const headerMatch = section.match(/^#+\s*(.+)/);
    if (headerMatch) {
      const title = headerMatch[1];
      const body = section.replace(/^#+\s*.+\n?/, '').trim();
      
      if (body) {
        blocks.push({
          title,
          body,
          cta: '',
          link: '#',
          image_prompt: `${title.toLowerCase()} ${campaignTitle || 'garden'} content`,
          alt_text: `${title} illustration`
        });
      }
    } else if (section.length > 50) {
      // Create a block from substantial content without header
      const title = `Section ${i + 1}`;
      blocks.push({
        title,
        body: section,
        cta: '',
        link: '#',
        image_prompt: `${campaignTitle || 'newsletter'} content section`,
        alt_text: 'Newsletter content illustration'
      });
    }
  }
  
  return blocks;
};

// Calculate reading time
export const calculateReadingTime = (content: string): string => {
  if (!content) return '≈1 min';
  
  const wordsPerMinute = 200;
  const wordCount = content.split(/\s+/).length;
  const minutes = Math.ceil(wordCount / wordsPerMinute);
  
  return `≈${minutes} min`;
};

// Process newsletter content - main function
export const processNewsletterContent = (content: string, campaignTitle?: string): ProcessedNewsletter => {
  if (!content) {
    return {
      newsletter_md: '',
      blocks: [],
      meta: {
        reading_time: '≈1 min',
        theme: campaignTitle || 'Newsletter',
        week_focus: 'Content Update'
      },
      isStructured: false
    };
  }
  
  // Check if this is structured YAML content
  const isStructuredYAML = content.includes('newsletter_md:') && content.includes('blocks:');
  
  if (isStructuredYAML) {
    // Try to parse structured content
    try {
      const lines = content.split('\n');
      let currentSection = '';
      let newsletterMd = '';
      let inNewsletterMd = false;
      let currentBlock: any = {};
      const blocks: NewsletterBlock[] = [];
      const meta: any = {
        reading_time: '≈3 min',
        theme: campaignTitle || 'Newsletter',
        week_focus: 'Content Update'
      };
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        
        if (trimmed === 'newsletter_md: |') {
          inNewsletterMd = true;
          currentSection = 'newsletter_md';
          continue;
        }
        
        if (trimmed === 'blocks:') {
          inNewsletterMd = false;
          currentSection = 'blocks';
          continue;
        }
        
        if (trimmed === 'meta:') {
          currentSection = 'meta';
          continue;
        }
        
        if (inNewsletterMd && currentSection === 'newsletter_md') {
          newsletterMd += line + '\n';
          continue;
        }
        
        if (currentSection === 'blocks' && trimmed.startsWith('- title:')) {
          if (Object.keys(currentBlock).length > 0) {
            blocks.push(currentBlock);
          }
          currentBlock = {
            title: trimmed.replace('- title:', '').replace(/"/g, '').trim()
          };
        } else if (currentSection === 'blocks' && trimmed.startsWith('body:')) {
          currentBlock.body = trimmed.replace('body:', '').replace(/"/g, '').trim();
        } else if (currentSection === 'blocks' && trimmed.startsWith('cta:')) {
          currentBlock.cta = trimmed.replace('cta:', '').replace(/"/g, '').trim();
        } else if (currentSection === 'blocks' && trimmed.startsWith('link:')) {
          currentBlock.link = trimmed.replace('link:', '').replace(/"/g, '').trim();
        } else if (currentSection === 'blocks' && trimmed.startsWith('image_prompt:')) {
          currentBlock.image_prompt = trimmed.replace('image_prompt:', '').replace(/"/g, '').trim();
        } else if (currentSection === 'blocks' && trimmed.startsWith('alt_text:')) {
          currentBlock.alt_text = trimmed.replace('alt_text:', '').replace(/"/g, '').trim();
        }
        
        if (currentSection === 'meta') {
          if (trimmed.startsWith('reading_time:')) {
            meta.reading_time = trimmed.replace('reading_time:', '').replace(/"/g, '').trim();
          } else if (trimmed.startsWith('theme:')) {
            meta.theme = trimmed.replace('theme:', '').replace(/"/g, '').trim();
          } else if (trimmed.startsWith('week_focus:')) {
            meta.week_focus = trimmed.replace('week_focus:', '').replace(/"/g, '').trim();
          }
        }
      }
      
      // Add last block
      if (Object.keys(currentBlock).length > 0) {
        blocks.push(currentBlock);
      }
      
      return {
        newsletter_md: newsletterMd.trim(),
        blocks,
        meta,
        isStructured: true
      };
    } catch (error) {
      console.error('Error parsing structured newsletter:', error);
      // Fall back to plain text processing
    }
  }
  
  // Process as plain text/markdown
  const blocks = createBlocksFromPlainText(content, campaignTitle);
  
  return {
    newsletter_md: content,
    blocks,
    meta: {
      reading_time: calculateReadingTime(content),
      theme: campaignTitle || 'Newsletter',
      week_focus: 'Content Update'
    },
    isStructured: false
  };
};
