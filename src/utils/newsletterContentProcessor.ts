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
  
  if (parsedNewsletter && parsedNewsletter.newsletter_md) {
    console.log('[NEWSLETTER PROCESSOR] Successfully parsed structured newsletter');
    
    // Check if we have proper blocks or need to create them from markdown content
    let finalBlocks = parsedNewsletter.blocks || [];
    
    // If no blocks found or blocks are empty/invalid, create them from markdown content
    console.log('[NEWSLETTER PROCESSOR] Found blocks:', finalBlocks);
    
    const hasValidBlocks = finalBlocks.length > 0 && finalBlocks.some(block => 
      (block.title && block.title.trim()) || (block.body && block.body.trim())
    );
    
    // Detect and fix content duplication
    const isDuplicated = detectContentDuplication(parsedNewsletter.newsletter_md, finalBlocks);
    
    if (isDuplicated) {
      console.log('[NEWSLETTER PROCESSOR] Detected content duplication, prioritizing structured blocks');
      // When duplication is detected, clear the markdown to avoid showing the same content twice
      parsedNewsletter.newsletter_md = '';
    }
    
    if (!hasValidBlocks) {
      console.log('[NEWSLETTER PROCESSOR] No valid blocks found, creating from markdown content');
      finalBlocks = createBlocksFromMarkdownContent(parsedNewsletter.newsletter_md);
    } else {
      console.log('[NEWSLETTER PROCESSOR] Using existing structured blocks');
      
      // Only add introduction block if we don't have duplication and no blocks have intro-like content
      const hasIntroduction = finalBlocks.some(block => 
        block.title?.toLowerCase().includes('welcome') || 
        block.title?.toLowerCase().includes('introduction') ||
        block.title?.toLowerCase().includes('beat the heat') ||
        block.title?.toLowerCase().includes('summer survival')
      );
      
      if (!hasIntroduction && parsedNewsletter.newsletter_md && !isDuplicated) {
        const lines = parsedNewsletter.newsletter_md.split('\n');
        const headerLine = lines.find(line => line.trim().startsWith('#'));
        const introText = lines.slice(1).join('\n').trim();
        
        if (headerLine && introText) {
          const introBlock = {
            title: headerLine.replace(/^#+\s*/, '').trim(),
            body: introText,
            image_prompt: generateThemeSpecificImagePrompt(headerLine.replace(/^#+\s*/, '').trim(), parsedNewsletter.meta?.theme),
            alt_text: `Header image for ${headerLine.replace(/^#+\s*/, '').trim()}`,
            cta: 'Learn More',
            link: '#'
          };
          finalBlocks.unshift(introBlock);
        }
      }
      
      // Improve image prompts for existing blocks
      finalBlocks = finalBlocks.map(block => ({
        ...block,
        image_prompt: improveImagePrompt(block.image_prompt, block.title, parsedNewsletter.meta?.theme)
      }));
    }
    
    return {
      newsletter_md: parsedNewsletter.newsletter_md || '',
      blocks: finalBlocks,
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

const createBlocksFromMarkdownContent = (markdownContent: string): any[] => {
  console.log('[NEWSLETTER PROCESSOR] Creating blocks from markdown content');
  const blocks: any[] = [];
  
  // Split content by headers - first # is main header, ## are sections
  const lines = markdownContent.split('\n');
  let currentSection: { title: string; content: string[]; isMainHeader: boolean } | null = null;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (trimmedLine.match(/^# /)) {
      // Main header - save previous section and start new one
      if (currentSection) {
        blocks.push(createBlockFromSection(currentSection));
      }
      currentSection = {
        title: trimmedLine.replace(/^# /, '').trim(),
        content: [],
        isMainHeader: true
      };
    } else if (trimmedLine.match(/^## /)) {
      // Section header - save previous section and start new one
      if (currentSection) {
        blocks.push(createBlockFromSection(currentSection));
      }
      currentSection = {
        title: trimmedLine.replace(/^## /, '').trim(),
        content: [],
        isMainHeader: false
      };
    } else if (currentSection && trimmedLine) {
      // Add content to current section
      currentSection.content.push(line);
    }
  }
  
  // Add the last section
  if (currentSection) {
    blocks.push(createBlockFromSection(currentSection));
  }
  
  console.log(`[NEWSLETTER PROCESSOR] Created ${blocks.length} blocks from markdown`);
  return blocks;
};

const createBlockFromSection = (section: { title: string; content: string[]; isMainHeader: boolean }): any => {
  const contentText = section.content.join('\n').trim();
  
  if (section.isMainHeader) {
    // Main header becomes a header block
    return {
      type: 'header',
      title: section.title,
      body: contentText,
      image_prompt: `garden newsletter header ${section.title.toLowerCase()}`,
      alt_text: `Header image for ${section.title}`
    };
  } else {
    // Section headers become text blocks
    return {
      type: 'text',
      title: section.title,
      body: contentText,
      image_prompt: `garden ${section.title.toLowerCase()}`,
      alt_text: `Image for ${section.title}`,
      cta: 'Learn More',
      link: '#'
    };
  }
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
  return generateThemeSpecificImagePrompt(title, campaignTitle, content);
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

// Detect if content is duplicated between newsletter_md and blocks
const detectContentDuplication = (newsletter_md: string, blocks: any[]): boolean => {
  if (!newsletter_md || !blocks || blocks.length === 0) return false;
  
  // Check if any block titles appear in the newsletter_md
  const duplicatedSections = blocks.filter(block => {
    if (!block.title) return false;
    const normalizedTitle = block.title.replace(/[^\w\s]/g, '').toLowerCase();
    const normalizedMd = newsletter_md.replace(/[^\w\s]/g, '').toLowerCase();
    return normalizedMd.includes(normalizedTitle);
  });
  
  console.log('[NEWSLETTER PROCESSOR] Duplication check:', {
    blocksCount: blocks.length,
    duplicatedSections: duplicatedSections.length,
    duplicatedTitles: duplicatedSections.map(b => b.title)
  });
  
  // If more than half the blocks are duplicated, consider it a duplication issue
  return duplicatedSections.length > blocks.length / 2;
};

// Generate theme-specific, natural image prompts
const generateThemeSpecificImagePrompt = (title: string, theme?: string, content?: string): string => {
  const cleanTitle = title.toLowerCase().replace(/[^\w\s]/g, '');
  
  // Tree-specific prompts for tree themes
  if (theme?.toLowerCase().includes('tree')) {
    if (cleanTitle.includes('check') || cleanTitle.includes('health')) {
      return 'professional arborist examining tree trunk for health assessment';
    }
    if (cleanTitle.includes('care') || cleanTitle.includes('maintenance')) {
      return 'healthy mature trees in residential garden landscape';
    }
    if (cleanTitle.includes('problem') || cleanTitle.includes('disease')) {
      return 'tree care tools and equipment for maintenance';
    }
    return 'beautiful mature trees in well-maintained garden setting';
  }
  
  // Season-specific prompts
  if (cleanTitle.includes('summer') || cleanTitle.includes('heat')) {
    return 'lush garden thriving in summer sunlight with proper watering';
  }
  if (cleanTitle.includes('spring')) {
    return 'fresh spring garden with new growth and blooming plants';
  }
  if (cleanTitle.includes('fall') || cleanTitle.includes('autumn')) {
    return 'beautiful fall garden with colorful foliage and seasonal plants';
  }
  
  // Activity-specific prompts
  if (cleanTitle.includes('plant') || cleanTitle.includes('grow')) {
    return 'hands planting new seedlings in rich garden soil';
  }
  if (cleanTitle.includes('water') || cleanTitle.includes('irrigation')) {
    return 'efficient garden watering system in action';
  }
  if (cleanTitle.includes('pest') || cleanTitle.includes('problem')) {
    return 'healthy plants protected from pests naturally';
  }
  
  // Default garden center prompt
  return `${theme || 'garden'} ${cleanTitle.split(' ').slice(0, 2).join(' ')} professional garden center`.replace(/\s+/g, ' ');
};

// Improve existing image prompts
const improveImagePrompt = (originalPrompt: string, title: string, theme?: string): string => {
  // If the original prompt looks poor (has keyword stuffing), regenerate it
  const hasKeywordStuffing = originalPrompt.includes('garden center') && 
                            originalPrompt.includes('newsletter') && 
                            originalPrompt.includes('professional');
  
  if (hasKeywordStuffing || originalPrompt.split(' ').length > 8) {
    return generateThemeSpecificImagePrompt(title, theme);
  }
  
  return originalPrompt;
};

const extractThemeFromContent = (content: string, campaignTitle?: string): string => {
  const textToAnalyze = (campaignTitle + ' ' + content).toLowerCase();
  
  // Check for tree-related content first
  if (textToAnalyze.includes('tree')) return 'Tree Care and Maintenance';
  
  // Check for specific plant types
  if (textToAnalyze.includes('hydrangea')) return 'Hydrangea Care and Planting';
  if (textToAnalyze.includes('rose')) return 'Rose Care and Planting';
  if (textToAnalyze.includes('tomato')) return 'Tomato Growing Guide';
  if (textToAnalyze.includes('herb')) return 'Herb Garden Care';
  
  // Check for seasonal content
  if (textToAnalyze.includes('summer')) return 'Summer Care';
  if (textToAnalyze.includes('spring')) return 'Spring Growth';
  if (textToAnalyze.includes('fall') || textToAnalyze.includes('autumn')) return 'Fall Care';
  if (textToAnalyze.includes('winter')) return 'Winter Protection';
  
  // Check for general gardening activities
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

// Clean newsletter content for display - preserve most content with light cleaning
export const cleanNewsletterContent = (content: string): string => {
  if (!content) return '';
  
  // First try to parse as YAML newsletter structure
  const parsedYamlContent = parseNewsletterYaml(content);
  if (parsedYamlContent) {
    return parsedYamlContent;
  }
  
  // Then try to parse as JSON newsletter
  const parsedNewsletter = parseNewsletterJson(content);
  if (parsedNewsletter) {
    const cleanSubject = lightCleanFormatting(parsedNewsletter.subject);
    const cleanContent = lightCleanFormatting(parsedNewsletter.content);
    return cleanSubject ? `${cleanSubject}\n\n${cleanContent}` : cleanContent;
  }
  
  // Light cleaning for newsletter content to preserve formatting
  return lightCleanFormatting(content);
};

// Light cleaning to preserve most content while removing dangerous elements
const lightCleanFormatting = (text: string): string => {
  if (!text) return '';
  
  return text
    // Only remove dangerous HTML tags but preserve content structure
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Preserve most content, just clean up excessive whitespace
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/[ \t]{3,}/g, '  ')
    .trim();
};

// Parse newsletter YAML content and extract clean text
const parseNewsletterYaml = (content: string): string | null => {
  try {
    // Check for YAML code blocks first
    if (content.includes('```yaml') || content.includes('```yml')) {
      const yamlMatch = content.match(/```ya?ml\s*\n([\s\S]*?)\n```/) || content.match(/```ya?ml\s*([\s\S]*?)```/);
      if (yamlMatch) {
        return extractContentFromYamlString(yamlMatch[1]);
      }
    }
    
    // Check for direct YAML structure
    if (content.includes('newsletter_md:') || content.includes('blocks:')) {
      return extractContentFromYamlString(content);
    }
    
  } catch (error) {
    console.log('YAML parsing failed:', error);
  }
  
  return null;
};

// Extract readable content from YAML string
const extractContentFromYamlString = (yamlString: string): string | null => {
  try {
    // Look for newsletter_md content with pipe syntax
    const newsletterMdMatch = yamlString.match(/newsletter_md:\s*\|\s*\n([\s\S]*?)(?=\n(?:blocks|meta|extra_content_ideas|reading_time):\s*(?:\n|$)|$)/);
    if (newsletterMdMatch) {
      // Extract content after the pipe, maintaining indentation structure
      const rawContent = newsletterMdMatch[1];
      const lines = rawContent.split('\n');
      
      // Remove consistent indentation (usually 2 spaces)
      const indentMatch = lines.find(line => line.trim())?.match(/^(\s*)/);
      const baseIndent = indentMatch ? indentMatch[1].length : 0;
      
      const cleanedContent = lines
        .map(line => line.slice(baseIndent))
        .join('\n')
        .trim();
      
      return cleanedContent;
    }
    
    // Look for content field in YAML
    const contentMatch = yamlString.match(/content:\s*\|\s*\n([\s\S]*?)(?=\n\w+:|$)/);
    if (contentMatch) {
      return contentMatch[1].trim();
    }
    
    // Look for content field without pipe
    const simpleContentMatch = yamlString.match(/content:\s*["']?(.*?)["']?(?=\n|$)/);
    if (simpleContentMatch) {
      return simpleContentMatch[1].trim();
    }
    
  } catch (error) {
    console.log('YAML content extraction failed:', error);
  }
  
  return null;
};

// Parse newsletter JSON content helper
const parseNewsletterJson = (content: string): { subject: string; content: string } | null => {
  try {
    // Check if content starts with ```json
    if (content.includes('```json')) {
      const jsonMatch = content.match(/```json\s*\n([\s\S]*?)\n```/) || content.match(/```json\s*([\s\S]*?)```/);
      if (jsonMatch) {
        const jsonContent = jsonMatch[1].trim();
        const parsed = JSON.parse(jsonContent);
        return {
          subject: parsed.subject || '',
          content: parsed.content || ''
        };
      }
    }
    
    // Try parsing as direct JSON
    const parsed = JSON.parse(content);
    if (parsed.subject && parsed.content) {
      return {
        subject: parsed.subject,
        content: parsed.content
      };
    }
  } catch (error) {
    // Not JSON, return null
  }
  
  return null;
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
