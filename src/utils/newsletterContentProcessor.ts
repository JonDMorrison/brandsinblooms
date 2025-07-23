import { parseNewsletterYAML, StructuredNewsletter } from './newsletterUtils';
import { fixMalformedNewsletter, validateNewsletterStructure, calculateReadingTime } from './newsletterContentFixer';

interface ProcessedNewsletter {
  newsletter_md: string;
  blocks: any[];
  meta: {
    reading_time: string;
    theme: string;
    week_focus: string;
  };
  isStructured: boolean;
  needsRegeneration: boolean;
  unstructuredSections?: UnstructuredSection[];
}

interface UnstructuredSection {
  title: string;
  content: string;
  image_prompt: string;
  alt_text: string;
  id: string;
  cta?: string;
  link?: string;
}

export const processNewsletterContent = (content: string, campaignTitle?: string): ProcessedNewsletter => {
  console.log('[NEWSLETTER PROCESSOR] Processing content:', {
    contentLength: content?.length || 0,
    campaignTitle,
    hasYAML: content?.includes('newsletter_md:') || false
  });

  if (!content || content.trim().length === 0) {
    return createEmptyNewsletter(campaignTitle);
  }

  // Check if content is malformed and needs fixing
  const needsFixing = !validateNewsletterStructure(content) || content.includes('blocks: title:');
  
  let processedContent = content;
  
  if (needsFixing) {
    console.log('[NEWSLETTER PROCESSOR] Fixing malformed content');
    processedContent = fixMalformedNewsletter(content);
  }

  // Try to parse the YAML structure
  const parsedNewsletter = parseNewsletterYAML(processedContent);
  
  if (parsedNewsletter && parsedNewsletter.blocks && parsedNewsletter.blocks.length > 0) {
    console.log('[NEWSLETTER PROCESSOR] Successfully parsed structured newsletter');
    
    return {
      newsletter_md: parsedNewsletter.newsletter_md || '',
      blocks: parsedNewsletter.blocks,
      meta: {
        reading_time: parsedNewsletter.meta?.reading_time || calculateReadingTime(processedContent),
        theme: parsedNewsletter.meta?.theme || extractThemeFromContent(processedContent, campaignTitle),
        week_focus: parsedNewsletter.meta?.week_focus || (campaignTitle || 'Garden Newsletter')
      },
      isStructured: true,
      needsRegeneration: false
    };
  }

  // If YAML parsing failed, treat as unstructured content and create sections
  console.log('[NEWSLETTER PROCESSOR] Content not structured, creating sections with image support');
  
  const unstructuredSections = createSectionsFromUnstructuredContent(processedContent, campaignTitle);
  
  return {
    newsletter_md: processedContent,
    blocks: [],
    unstructuredSections,
    meta: {
      reading_time: calculateReadingTime(processedContent),
      theme: extractThemeFromContent(processedContent, campaignTitle),
      week_focus: campaignTitle || 'Garden Newsletter'
    },
    isStructured: false,
    needsRegeneration: isPlaceholderContent(processedContent)
  };
};

const createSectionsFromUnstructuredContent = (content: string, campaignTitle?: string): UnstructuredSection[] => {
  const sections: UnstructuredSection[] = [];
  
  // Split content by headers (## or ###) or double line breaks
  const parts = content.split(/(?=^#{2,3}\s+)/m).filter(part => part.trim());
  
  if (parts.length === 0) {
    // No clear sections, create sections from paragraphs
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim());
    
    paragraphs.forEach((paragraph, index) => {
      const lines = paragraph.split('\n').filter(line => line.trim());
      const title = extractSectionTitle(lines[0]) || `Section ${index + 1}`;
      const sectionContent = lines.slice(1).join('\n').trim() || lines[0];
      
      sections.push({
        id: `section-${index}`,
        title,
        content: sectionContent,
        image_prompt: generateImagePrompt(title, sectionContent, campaignTitle),
        alt_text: `Image for ${title}`,
        cta: 'Learn More',
        link: '#'
      });
    });
  } else {
    // Create sections from header-based parts
    parts.forEach((part, index) => {
      const lines = part.split('\n').filter(line => line.trim());
      const headerLine = lines.find(line => line.match(/^#{2,3}\s+/));
      const title = headerLine ? headerLine.replace(/^#{2,3}\s+/, '').trim() : `Section ${index + 1}`;
      const contentLines = lines.filter(line => !line.match(/^#{2,3}\s+/));
      const sectionContent = contentLines.join('\n').trim();
      
      if (sectionContent) {
        sections.push({
          id: `section-${index}`,
          title,
          content: sectionContent,
          image_prompt: generateImagePrompt(title, sectionContent, campaignTitle),
          alt_text: `Image for ${title}`,
          cta: 'Learn More',
          link: '#'
        });
      }
    });
  }
  
  console.log(`[NEWSLETTER PROCESSOR] Created ${sections.length} sections with image prompts`);
  return sections;
};

const generateImagePrompt = (title: string, content: string, campaignTitle?: string): string => {
  const keywords = extractKeywordsFromText(`${title} ${content}`);
  const basePrompt = campaignTitle ? `${campaignTitle} garden` : 'garden center';
  return `${basePrompt} ${keywords.slice(0, 3).join(' ')}`.toLowerCase();
};

const extractKeywordsFromText = (text: string): string[] => {
  // Remove common words and extract meaningful keywords
  const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an', 'is', 'are', 'was', 'were'];
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !commonWords.includes(word))
    .slice(0, 5);
  
  return words.length > 0 ? words : ['plants', 'garden'];
};

const extractSectionTitle = (line: string): string | null => {
  if (!line) return null;
  
  const trimmed = line.trim();
  
  // Remove markdown syntax and extract clean title
  let title = trimmed
    .replace(/^#+\s*/, '')
    .replace(/\*\*(.*?)\*\*/, '$1')
    .replace(/__(.*?)__/, '$1')
    .trim();
  
  // Check if it looks like a title (short, capitalized, etc.)
  if (title.length < 100 && (title.includes(':') || title.match(/^[A-Z]/) || title.length < 60)) {
    return title;
  }
  
  return null;
};

const createEmptyNewsletter = (campaignTitle?: string): ProcessedNewsletter => {
  return {
    newsletter_md: '',
    blocks: [],
    unstructuredSections: [],
    meta: {
      reading_time: '0 min',
      theme: 'Garden Newsletter',
      week_focus: campaignTitle || 'Newsletter Content'
    },
    isStructured: false,
    needsRegeneration: true
  };
};

const extractThemeFromContent = (content: string, campaignTitle?: string): string => {
  const textToAnalyze = (campaignTitle + ' ' + content).toLowerCase();
  
  if (textToAnalyze.includes('summer')) return 'Summer Care';
  if (textToAnalyze.includes('spring')) return 'Spring Growth';
  if (textToAnalyze.includes('fall') || textToAnalyze.includes('autumn')) return 'Fall Care';
  if (textToAnalyze.includes('winter')) return 'Winter Protection';
  if (textToAnalyze.includes('growing')) return 'Growing Success';
  if (textToAnalyze.includes('planting')) return 'Planting Guide';
  
  return 'Seasonal Gardening';
};

const isPlaceholderContent = (content: string): boolean => {
  const placeholderIndicators = [
    'placeholder',
    'lorem ipsum',
    'sample content',
    'example text',
    'ai is currently generating',
    'content will be generated'
  ];
  
  const lowerContent = content.toLowerCase();
  return placeholderIndicators.some(indicator => lowerContent.includes(indicator)) || content.trim().length < 100;
};

// Convert newsletter markdown to HTML with proper formatting
export const convertNewsletterMarkdownToHtml = (markdown: string): string => {
  if (!markdown) return '';
  
  return markdown
    // Convert headers
    .replace(/^# (.+)$/gm, '<h1 class="text-4xl font-bold text-slate-900 mb-6">$1</h1>')
    .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-semibold text-slate-900 mb-4 mt-8">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="text-xl font-semibold text-slate-900 mb-3 mt-6">$1</h3>')
    // Convert italic text (subtitles)
    .replace(/^\*(.+)\*$/gm, '<p class="text-lg italic text-slate-600 mb-6">$1</p>')
    // Convert bold text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>')
    // Convert separators
    .replace(/^---$/gm, '<hr class="border-t border-slate-200 my-8">')
    // Convert paragraphs - split by double newlines and wrap
    .split(/\n\s*\n/)
    .map(paragraph => {
      paragraph = paragraph.trim();
      if (!paragraph) return '';
      
      // Skip if already wrapped in HTML
      if (paragraph.match(/^<(h[1-6]|hr|p)/)) {
        return paragraph;
      }
      
      return `<p class="mb-4 text-slate-700 leading-relaxed">${paragraph}</p>`;
    })
    .join('\n')
    // Clean up extra spacing
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};
