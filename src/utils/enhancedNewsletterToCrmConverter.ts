import { processNewsletterContent } from './newsletterContentProcessor';
import { supabase } from '@/integrations/supabase/client';
import { ContentBlock, BlockType } from '@/types/emailBuilder';

interface EnhancedNewsletterToCRMResult {
  campaignName: string;
  subjectLine: string;
  contentBlocks: ContentBlock[];
  originalContent: string;
  themeSource: 'weekly' | 'holiday' | 'event' | 'custom';
  personaTags: string[];
  segmentSuggestions: string[];
  sourceMetadata: {
    contentTaskId: string;
    campaignId?: string;
    weekNumber?: number;
    holidayId?: string;
    theme?: string;
  };
}

export const enhancedNewsletterToCRM = async (
  contentTaskId: string,
  urlParams?: URLSearchParams
): Promise<EnhancedNewsletterToCRMResult> => {
  console.log('🔄 Enhanced newsletter to CRM conversion', { contentTaskId });

  // Fetch content task with full context
  const { data: contentTask, error: taskError } = await supabase
    .from('content_tasks')
    .select(`
      *,
      campaigns (
        id,
        title,
        theme,
        week_number,
        source,
        description
      ),
      holidays (
        id,
        holiday_name,
        category,
        garden_relevance
      )
    `)
    .eq('id', contentTaskId)
    .single();

  if (taskError || !contentTask) {
    console.error('❌ Failed to fetch content task:', taskError);
    throw new Error('Content task not found');
  }

  const campaign = contentTask.campaigns;
  const holiday = contentTask.holidays;
  const content = contentTask.ai_output || '';

  console.log('📄 [enhancedNewsletterToCRM] Processing content:', {
    contentLength: content.length,
    hasCampaign: !!campaign,
    hasHoliday: !!holiday,
    contentPreview: content.substring(0, 200) + '...'
  });

  // Determine theme source
  let themeSource: 'weekly' | 'holiday' | 'event' | 'custom' = 'custom';
  if (holiday) {
    themeSource = 'holiday';
  } else if (campaign?.source === 'system' && campaign?.week_number) {
    themeSource = 'weekly';
  } else if (campaign?.source === 'event') {
    themeSource = 'event';
  }

  // Process newsletter content into structured format
  const processed = processNewsletterContent(content, campaign?.title);
  console.log('📋 [enhancedNewsletterToCRM] Processed newsletter:', {
    isStructured: processed.isStructured,
    hasBlocks: processed.blocks.length > 0,
    theme: processed.meta.theme,
    blocksCount: processed.blocks.length
  });

  // Generate campaign name
  const campaignName = generateEnhancedCampaignName(
    campaign?.title || contentTask.notes || '',
    themeSource,
    holiday?.holiday_name,
    campaign?.week_number
  );

  // Generate contextual subject line
  const subjectLine = generateContextualSubjectLine(
    processed,
    themeSource,
    holiday?.holiday_name,
    campaign?.theme
  );

const isSystemInstructionalText = (text: string): boolean => {
  if (!text || typeof text !== 'string') return false;
  
  const instructionalPatterns = [
    /restructure.*existing.*newsletter.*content/i,
    /generate.*content.*based.*on/i,
    /create.*newsletter.*from/i,
    /transform.*into.*proper.*format/i,
    /convert.*to.*yaml.*format/i,
    /process.*newsletter.*content/i
  ];
  
  return instructionalPatterns.some(pattern => pattern.test(text));
};

const getCleanHeaderContent = (processed: any, campaign: any, holiday: any): string => {
  // Try meta.theme first
  if (processed.meta?.theme && !isSystemInstructionalText(processed.meta.theme)) {
    return processed.meta.theme;
  }
  
  // Try campaign theme or description
  if (campaign?.theme && !isSystemInstructionalText(campaign.theme)) {
    return campaign.theme;
  }
  
  if (campaign?.description && !isSystemInstructionalText(campaign.description)) {
    return campaign.description;
  }
  
  // Try holiday context
  if (holiday?.garden_relevance) {
    return `${holiday.holiday_name} Garden Care`;
  }
  
  // Extract from newsletter content (first paragraph after header)
  const firstParagraph = processed.newsletter_md
    ?.split('\n')
    .find((line: string) => line.trim() && !line.startsWith('#') && line.length > 20);
    
  if (firstParagraph && !isSystemInstructionalText(firstParagraph)) {
    return firstParagraph.replace(/\*\*(.*?)\*\*/g, '$1').substring(0, 100) + '...';
  }
  
  // Seasonal fallback
  const currentSeason = getCurrentSeason();
  return `Your ${currentSeason.charAt(0).toUpperCase() + currentSeason.slice(1)} Garden Newsletter`;
};

const convertToContentBlocks = (processed: any, contentTask: any): ContentBlock[] => {
  const blocks: ContentBlock[] = [];
  
  console.log('🔄 [convertToContentBlocks] Converting processed content:', {
    hasNewsletterMd: !!processed.newsletter_md,
    blocksCount: processed.blocks?.length || 0,
    processedKeys: Object.keys(processed)
  });
  
  // Add header block first
  const headerTitle = processed.newsletter_md?.match(/^#\s+(.+)$/m)?.[1];
  if (headerTitle) {
    const cleanContent = getCleanHeaderContent(processed, contentTask.campaigns, contentTask.holidays);
    
    blocks.push({
      id: `block_${Date.now()}_header`,
      type: 'header',
      title: headerTitle,
      content: cleanContent,
      source: 'newsletter',
      personaTag: contentTask.persona_tag
    });
  }

  // Extract main image for use across blocks
  const mainImage = extractImageFromTask(contentTask);
  
  // Convert structured blocks if available
  if (processed.blocks && processed.blocks.length > 0) {
    console.log('📋 [convertToContentBlocks] Processing structured blocks:', processed.blocks);
    
    processed.blocks.forEach((block: any, index: number) => {
      console.log(`🔧 [convertToContentBlocks] Processing block ${index}:`, {
        title: block.title,
        hasBody: !!block.body,
        hasImagePrompt: !!block.image_prompt,
        hasCta: !!block.cta
      });
      
      // Add text block with content
      if (block.title && block.body) {
        blocks.push({
          id: `block_${Date.now()}_text_${index}`,
          type: 'text',
          title: block.title,
          content: block.body,
          source: 'newsletter',
          personaTag: contentTask.persona_tag
        });
      }

      // Add image block if image prompt exists or use main image
      if (block.image_prompt || mainImage) {
        blocks.push({
          id: `block_${Date.now()}_image_${index}`,
          type: 'image',
          title: block.alt_text || `Image for ${block.title}` || 'Newsletter Image',
          content: block.image_prompt || 'Garden newsletter image',
          imageUrl: mainImage, // Use the actual image from content task
          source: 'newsletter',
          personaTag: contentTask.persona_tag
        });
      }

      // Add button block if CTA exists
      if (block.cta && block.link) {
        blocks.push({
          id: `block_${Date.now()}_button_${index}`,
          type: 'button',
          title: block.cta,
          content: block.cta,
          ctaText: block.cta,
          ctaUrl: block.link,
          source: 'newsletter',
          personaTag: contentTask.persona_tag
        });
      }
    });
  } else {
    // Convert markdown content to text blocks
    console.log('📝 [convertToContentBlocks] Converting markdown to text blocks');
    
    const sections = processed.newsletter_md?.split(/\n\s*\n/).filter((s: string) => s.trim()) || [];
    
    sections.forEach((section: string, index: number) => {
      const lines = section.split('\n').filter((l: string) => l.trim());
      if (lines.length === 0) return;
      
      const firstLine = lines[0].trim();
      
      // Skip the main header as we already added it
      if (firstLine.startsWith('# ') && index === 0) return;
      
      // Handle section headers
      if (firstLine.startsWith('## ') || firstLine.startsWith('### ')) {
        const title = firstLine.replace(/^#+\s*/, '').replace(/\*\*(.*?)\*\*/, '$1').trim();
        const content = lines.slice(1).join('\n').trim();
        
        if (title && content) {
          blocks.push({
            id: `block_${Date.now()}_text_header_${index}`,
            type: 'text',
            title: title,
            content: content,
            source: 'newsletter',
            personaTag: contentTask.persona_tag
          });
        }
      } else if (!firstLine.startsWith('#')) {
        // Regular content block - extract meaningful title from content
        let title = `Section ${index + 1}`;
        
        // Try to extract a meaningful title from the content
        if (firstLine.includes('**') && firstLine.includes('**')) {
          // Bold text as title
          const boldMatch = firstLine.match(/\*\*(.*?)\*\*/);
          if (boldMatch) title = boldMatch[1];
        } else if (firstLine.includes(':') && firstLine.length < 100) {
          // Line ending with colon (likely a title)
          title = firstLine.replace(':', '').trim();
        } else if (firstLine.length < 60 && !firstLine.includes('.')) {
          // Short line without period (likely a title)
          title = firstLine;
        }
        
        const content = lines.join('\n').trim();
        
        if (content && content.length > 10) { // Only add substantial content
          blocks.push({
            id: `block_${Date.now()}_text_section_${index}`,
            type: 'text',
            title: title,
            content: content,
            source: 'newsletter',
            personaTag: contentTask.persona_tag
          });
        }
      }
    });
  }

  // Add main image block if we have an image and haven't added one yet
  if (mainImage && !blocks.some(b => b.type === 'image')) {
    blocks.push({
      id: `block_${Date.now()}_main_image`,
      type: 'image',
      title: 'Newsletter Featured Image',
      content: 'Featured image from your garden newsletter',
      imageUrl: mainImage,
      source: 'newsletter',
      personaTag: contentTask.persona_tag
    });
  }

  // Add a default CTA button if none exists
  if (!blocks.some(b => b.type === 'button')) {
    blocks.push({
      id: `block_${Date.now()}_default_cta`,
      type: 'button',
      title: 'Learn More',
      content: 'Visit Our Garden Center',
      ctaText: 'Visit Our Garden Center',
      ctaUrl: 'https://yourgardencenter.com',
      source: 'newsletter',
      personaTag: contentTask.persona_tag
    });
  }

  console.log('✅ [convertToContentBlocks] Generated blocks:', {
    totalBlocks: blocks.length,
    blockTypes: blocks.map(b => b.type),
    hasImages: blocks.some(b => b.type === 'image' && b.imageUrl)
  });

  return blocks;
};

  // Convert to content blocks
  const contentBlocks = convertToContentBlocks(processed, contentTask);
  console.log('📦 [enhancedNewsletterToCRM] Generated content blocks:', {
    count: contentBlocks.length,
    types: contentBlocks.map(b => b.type)
  });

  // Extract persona tags and segments (from URL params or content analysis)
  const personaTags = urlParams?.get('personaTags') 
    ? JSON.parse(decodeURIComponent(urlParams.get('personaTags')!))
    : extractPersonaTagsFromContent(content);

  const segmentSuggestions = urlParams?.get('segmentSuggestions')
    ? JSON.parse(decodeURIComponent(urlParams.get('segmentSuggestions')!))
    : generateSegmentSuggestionsFromContent(content, campaign?.theme || '');

  return {
    campaignName,
    subjectLine,
    contentBlocks,
    originalContent: content,
    themeSource,
    personaTags,
    segmentSuggestions,
    sourceMetadata: {
      contentTaskId,
      campaignId: campaign?.id,
      weekNumber: campaign?.week_number,
      holidayId: holiday?.id,
      theme: campaign?.theme || holiday?.category
    }
  };
};

const generateEnhancedCampaignName = (
  title: string,
  themeSource: string,
  holidayName?: string,
  weekNumber?: number
): string => {
  const cleanTitle = title
    .replace(/Newsletter\s+Campaign\s*-?\s*/i, '')
    .replace(/\+/g, ' ')
    .replace(/%2F/g, '/')
    .replace(/%20/g, ' ')
    .trim();

  let prefix = '📧';
  
  switch (themeSource) {
    case 'weekly':
      prefix = `🗓️ Week ${weekNumber}`;
      break;
    case 'holiday':
      prefix = `🎉 ${holidayName}`;
      break;
    case 'event':
      prefix = '🎪 Event';
      break;
    default:
      prefix = '📧 Newsletter';
  }

  if (cleanTitle && cleanTitle !== 'Newsletter Campaign') {
    return `${prefix}: ${cleanTitle}`;
  }

  return `${prefix} Garden Newsletter - ${new Date().toLocaleDateString()}`;
};

const generateContextualSubjectLine = (
  processed: any,
  themeSource: string,
  holidayName?: string,
  theme?: string
): string => {
  const mainHeader = processed.newsletter_md?.match(/^#\s+(.+)$/m)?.[1];
  
  if (themeSource === 'holiday' && holidayName) {
    return `🌱 ${holidayName} Garden Care Tips`;
  }
  
  if (themeSource === 'weekly' && theme) {
    return `🌿 This Week: ${theme}`;
  }
  
  if (mainHeader && !mainHeader.includes('Newsletter')) {
    return `🌱 ${mainHeader}`;
  }
  
  // Contextual fallbacks based on content
  const content = processed.newsletter_md?.toLowerCase() || '';
  const currentSeason = getCurrentSeason();
  
  if (content.includes('fall') || content.includes('autumn')) {
    return '🍂 Fall Garden Transition Guide';
  }
  
  if (content.includes(currentSeason)) {
    return `🌱 ${currentSeason.charAt(0).toUpperCase() + currentSeason.slice(1)} Garden Care Guide`;
  }
  
  return '🌱 Garden Care Tips - This Week\'s Focus';
};



const extractImageFromTask = (contentTask: any): string | undefined => {
  if (contentTask.image_url) {
    return contentTask.image_url;
  }
  
  if (contentTask.attachments) {
    const attachments = typeof contentTask.attachments === 'string' 
      ? JSON.parse(contentTask.attachments) 
      : contentTask.attachments;
    
    if (attachments.image?.url) {
      return attachments.image.url;
    }
    
    if (attachments.selectedImages) {
      const firstImage = Object.values(attachments.selectedImages)[0];
      if (typeof firstImage === 'string' && firstImage.startsWith('http')) {
        return firstImage;
      }
    }
  }
  
  return undefined;
};

const extractPersonaTagsFromContent = (content: string): string[] => {
  // Reuse logic from sendToCRM utility
  const tags: string[] = [];
  const lowerContent = content.toLowerCase();
  
  if (lowerContent.includes('beginner') || lowerContent.includes('new to')) {
    tags.push('New Gardeners');
  }
  if (lowerContent.includes('expert') || lowerContent.includes('advanced')) {
    tags.push('Expert Gardeners');
  }
  if (lowerContent.includes('vegetable') || lowerContent.includes('herb')) {
    tags.push('Vegetable Gardeners');
  }
  if (lowerContent.includes('flower') || lowerContent.includes('bloom')) {
    tags.push('Flower Enthusiasts');
  }
  if (lowerContent.includes('indoor') || lowerContent.includes('houseplant')) {
    tags.push('Indoor Plant Lovers');
  }

  return [...new Set(tags)];
};

const generateSegmentSuggestionsFromContent = (content: string, theme: string): string[] => {
  // Reuse logic from sendToCRM utility
  const suggestions: string[] = [];
  const lowerContent = content.toLowerCase();
  
  // Add seasonal suggestions
  const currentSeason = getCurrentSeason();
  suggestions.push(`${currentSeason.charAt(0).toUpperCase() + currentSeason.slice(1)} Care`);
  
  // Add theme-based suggestions
  if (theme?.includes('care')) {
    suggestions.push('Regular Maintenance');
  }
  
  // Add fall-specific suggestions
  if (lowerContent.includes('fall') || lowerContent.includes('autumn')) {
    suggestions.push('Fall Transition', 'Seasonal Planning');
  }
  
  return [...new Set(suggestions)];
};

const getCurrentSeason = (): string => {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'fall';
  return 'winter';
};
