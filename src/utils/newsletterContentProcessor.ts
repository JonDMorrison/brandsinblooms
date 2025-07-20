
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

  // If YAML parsing failed, treat as unstructured content
  console.log('[NEWSLETTER PROCESSOR] Content not structured, treating as markdown');
  
  return {
    newsletter_md: processedContent,
    blocks: [],
    meta: {
      reading_time: calculateReadingTime(processedContent),
      theme: extractThemeFromContent(processedContent, campaignTitle),
      week_focus: campaignTitle || 'Garden Newsletter'
    },
    isStructured: false,
    needsRegeneration: isPlaceholderContent(processedContent)
  };
};

const createEmptyNewsletter = (campaignTitle?: string): ProcessedNewsletter => {
  return {
    newsletter_md: '',
    blocks: [],
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
