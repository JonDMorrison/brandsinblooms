import { ContentBlock, BlockLayout } from '@/types/emailBuilder';
import { sanitizeWeekNumbers } from '@/utils/weekNumberSanitizer';

interface GenerateBlocksOptions {
  topic: string;
  layout: 'block-builder' | 'simple-email';
  templateBlocks?: any[];
}

export const generateNewsletterBlocks = (options: GenerateBlocksOptions): ContentBlock[] => {
  const { topic, layout, templateBlocks = [] } = options;
  
  console.log(`[NewsletterInit] Generating blocks for "${topic}" (layout: ${layout})`);
  
  // If we have template blocks, convert them first
  if (templateBlocks.length > 0) {
    console.log(`[NewsletterInit] Converting ${templateBlocks.length} template blocks for ${layout} layout`);
    const convertedBlocks = convertTemplateBlocks(templateBlocks, layout, topic);
    
    // Ensure we have at least some blocks, if conversion fails use layout-specific generation
    if (convertedBlocks.length === 0) {
      console.warn(`[NewsletterInit] Template conversion failed, falling back to ${layout} generation`);
      return generateLayoutSpecificBlocks(layout, topic);
    }
    
    return convertedBlocks;
  }
  
  // Generate layout-specific blocks
  return generateLayoutSpecificBlocks(layout, topic);
};

const generateLayoutSpecificBlocks = (layout: 'block-builder' | 'simple-email', topic: string): ContentBlock[] => {
  switch (layout) {
    case 'block-builder':
      return generateBlockBuilderBlocks(topic);
    case 'simple-email':
      return generateSimpleEmailBlocks(topic);
    default:
      console.warn(`[NewsletterInit] Unknown layout: ${layout}, falling back to block-builder`);
      return generateBlockBuilderBlocks(topic);
  }
};

const convertTemplateBlocks = (templateBlocks: any[], layout: string, topic: string): ContentBlock[] => {
  if (!templateBlocks || templateBlocks.length === 0) {
    console.warn(`[NewsletterInit] No template blocks provided for conversion`);
    return [];
  }

  const blocks: ContentBlock[] = templateBlocks.map((block: any, index: number) => {
    let mappedType = mapBlockType(block.type);
    
    // CRITICAL CHANGE: Force ALL content blocks to be image-text for weekly themes
    // No more plain text blocks allowed
    if (mappedType === 'text') {
      console.log(`[NewsletterInit] Converting text block to image-text (weekly theme requirement): "${block.title}"`);
      mappedType = 'image-text';
    }
    
    // CRITICAL: ALL blocks must have images for weekly themes
    // Mark all blocks for image generation except button/divider
    const shouldFetchImage = mappedType !== 'button' && mappedType !== 'divider';
    
    const baseBlock: ContentBlock = {
      id: `block_${Date.now()}_${index}`,
      type: mappedType,
      title: block.title || '',
      content: block.content || block.body || '',
      headline: block.headline || block.title || '',
      body: block.body || block.content || '',
      imageUrl: block.imageUrl || '', // Will be generated if empty
      imageQuery: block.image_prompt || block.imageQuery || '', // AI image search query
      ctaText: block.buttonText || '',
      ctaUrl: block.buttonUrl || '#',
      source: 'newsletter',
      personaTag: 'general',
      layout: getLayoutHint(layout, block.type, index) as BlockLayout,
      alignment: 'left',
      textAlign: 'left',
      padding: 'medium',
      visible: true,
      collapsed: false,
      shouldFetchImage, // Mark for automatic image generation
      isGeneratingImage: shouldFetchImage, // Mark as needing image
      isWeeklyTheme: true // Flag for weekly theme enforcement
    };
    
    return baseBlock;
  });
  
  // For block-builder layout, ensure minimum of 5 blocks (1 header + 4 content)
  if (layout === 'block-builder') {
    const MIN_CONTENT_BLOCKS = 4;
    const headerBlocks = blocks.filter(b => b.type === 'header');
    const contentBlocks = blocks.filter(b => b.type !== 'header');
    
    if (contentBlocks.length < MIN_CONTENT_BLOCKS) {
      const missingCount = MIN_CONTENT_BLOCKS - contentBlocks.length;
      const defaultTitles = ['Featured Story', 'Main Article', 'Seasonal Spotlight', 'Tips & How-To'];
      
      console.log(`[NewsletterInit] Adding ${missingCount} blocks to reach minimum ${MIN_CONTENT_BLOCKS} content blocks`);
      
      for (let i = 0; i < missingCount; i++) {
        const titleIndex = contentBlocks.length + i;
        const title = defaultTitles[titleIndex] || `Content Section ${titleIndex + 1}`;
        
        const newBlock: ContentBlock = {
          id: `block_${Date.now()}_${blocks.length + i}`,
          type: 'image-text',
          title: title,
          content: '',
          headline: title,
          body: '',
          imageUrl: '',
          ctaText: '',
          ctaUrl: '',
          source: 'newsletter',
          personaTag: 'general',
          layout: 'image-left',
          alignment: 'left',
          textAlign: 'left',
          padding: 'medium',
          visible: true,
          collapsed: false,
          shouldFetchImage: false // Don't auto-fetch images for filler blocks
        };
        
        blocks.push(newBlock);
      }
    }
  }
  
  console.log(`[NewsletterInit] Final block count after template conversion: ${blocks.length} blocks for "${topic}" (layout: ${layout})`);
  return blocks;
};

const generateBlockBuilderBlocks = (topic: string): ContentBlock[] => {
  // Sanitize week numbers from topic for header blocks
  const sanitizedTopic = sanitizeWeekNumbers(topic);
  
  const blocks: ContentBlock[] = [
    {
      id: `header_${Date.now()}`,
      type: 'header',
      title: sanitizedTopic,
      content: '',
      headline: sanitizedTopic,
      body: '',
      imageUrl: '',
      imageQuery: '',
      ctaText: '',
      ctaUrl: '',
      source: 'template',
      personaTag: 'general',
      layout: 'full-width',
      alignment: 'center',
      textAlign: 'center',
      padding: 'large',
      visible: true,
      collapsed: false,
      shouldFetchImage: true, // Header must have image
      isGeneratingImage: true,
      isWeeklyTheme: true
    },
    {
      id: `content1_${Date.now()}`,
      type: 'image-text',
      title: 'Featured Story',
      content: '',
      headline: 'Featured Story',
      body: '',
      imageUrl: '',
      imageQuery: '',
      ctaText: '',
      ctaUrl: '',
      source: 'template',
      personaTag: 'general',
      layout: 'image-left',
      alignment: 'left',
      textAlign: 'left',
      padding: 'medium',
      visible: true,
      collapsed: false,
      shouldFetchImage: true, // CHANGED: Must have image
      isGeneratingImage: true,
      isWeeklyTheme: true
    },
    {
      id: `content2_${Date.now()}`,
      type: 'image-text',
      title: 'Main Article',
      content: '',
      headline: 'Main Article',
      body: '',
      imageUrl: '',
      imageQuery: '',
      ctaText: '',
      ctaUrl: '',
      source: 'template',
      personaTag: 'general',
      layout: 'image-left',
      alignment: 'left',
      textAlign: 'left',
      padding: 'medium',
      visible: true,
      collapsed: false,
      shouldFetchImage: true, // CHANGED: Must have image
      isGeneratingImage: true,
      isWeeklyTheme: true
    },
    {
      id: `content3_${Date.now()}`,
      type: 'image-text',
      title: 'Secondary Feature',
      content: '',
      headline: 'Secondary Feature',
      body: '',
      imageUrl: '',
      imageQuery: '',
      ctaText: 'Learn More',
      ctaUrl: '#',
      source: 'template',
      personaTag: 'general',
      layout: 'image-left',
      alignment: 'left',
      textAlign: 'left',
      padding: 'medium',
      visible: true,
      collapsed: false,
      shouldFetchImage: true, // CHANGED: Must have image
      isGeneratingImage: true,
      isWeeklyTheme: true
    },
    {
      id: `content4_${Date.now()}`,
      type: 'image-text',
      title: 'Call to Action',
      content: '',
      headline: 'Call to Action',
      body: '',
      imageUrl: '',
      imageQuery: '',
      ctaText: 'Visit Our Garden Center',
      ctaUrl: '#',
      source: 'template',
      personaTag: 'general',
      layout: 'image-left',
      alignment: 'left',
      textAlign: 'left',
      padding: 'medium',
      visible: true,
      collapsed: false,
      shouldFetchImage: true, // CRITICAL: Weekly theme blocks MUST have images
      isGeneratingImage: true,
      isWeeklyTheme: true
    }
  ];
  
  console.log(`[NewsletterInit] Generated ${blocks.length} blocks for "${topic}" (layout: block-builder)`);
  return blocks;
};

const generateSimpleEmailBlocks = (topic: string): ContentBlock[] => {
  // Sanitize week numbers from topic for header blocks
  const sanitizedTopic = sanitizeWeekNumbers(topic);
  
  const blocks: ContentBlock[] = [
    {
      id: `header_${Date.now()}`,
      type: 'header',
      title: sanitizedTopic,
      content: '',
      headline: sanitizedTopic,
      body: '',
      imageUrl: '',
      imageQuery: '',
      ctaText: '',
      ctaUrl: '',
      source: 'template',
      personaTag: 'general',
      layout: 'full-width',
      alignment: 'center',
      textAlign: 'center',
      padding: 'medium',
      visible: true,
      collapsed: false,
      shouldFetchImage: true,
      isGeneratingImage: true,
      isWeeklyTheme: true
    },
    {
      id: `intro_${Date.now()}`,
      type: 'image-text',
      title: 'Introduction',
      content: '',
      headline: 'Introduction',
      body: '',
      imageUrl: '',
      imageQuery: '',
      ctaText: '',
      ctaUrl: '',
      source: 'template',
      personaTag: 'general',
      layout: 'full-width',
      alignment: 'left',
      textAlign: 'left',
      padding: 'medium',
      visible: true,
      collapsed: false,
      shouldFetchImage: true,
      isGeneratingImage: true,
      isWeeklyTheme: true
    },
    {
      id: `main_${Date.now()}`,
      type: 'image-text',
      title: 'Main Content',
      content: '',
      headline: 'Main Content',
      body: '',
      imageUrl: '',
      imageQuery: '',
      ctaText: '',
      ctaUrl: '',
      source: 'template',
      personaTag: 'general',
      layout: 'full-width',
      alignment: 'left',
      textAlign: 'left',
      padding: 'medium',
      visible: true,
      collapsed: false,
      shouldFetchImage: true,
      isGeneratingImage: true,
      isWeeklyTheme: true
    },
    {
      id: `closing_${Date.now()}`,
      type: 'image-text',
      title: 'Closing Thoughts',
      content: '',
      headline: 'Closing Thoughts',
      body: '',
      imageUrl: '',
      imageQuery: '',
      ctaText: '',
      ctaUrl: '',
      source: 'template',
      personaTag: 'general',
      layout: 'full-width',
      alignment: 'left',
      textAlign: 'left',
      padding: 'medium',
      visible: true,
      collapsed: false,
      shouldFetchImage: true,
      isGeneratingImage: true,
      isWeeklyTheme: true
    },
    {
      id: `cta_${Date.now()}`,
      type: 'button',
      title: 'Call to Action',
      content: '',
      headline: '',
      body: '',
      imageUrl: '',
      ctaText: 'Contact Us',
      ctaUrl: '#',
      source: 'template',
      personaTag: 'general',
      layout: 'full-width',
      alignment: 'center',
      textAlign: 'center',
      padding: 'medium',
      visible: true,
      collapsed: false
    }
  ];
  
  console.log(`[NewsletterInit] Generated ${blocks.length} blocks for "${topic}" (layout: simple-email)`);
  return blocks;
};

// Helper functions
const mapBlockType = (templateType: string): ContentBlock['type'] => {
  switch (templateType) {
    case 'header':
      return 'header';
    case 'image-text':
      return 'image-text';
    case 'text':
      // CRITICAL CHANGE: No more text blocks - convert to image-text
      console.log('[NewsletterInit] Converting text block to image-text (weekly theme requirement)');
      return 'image-text';
    case 'button':
      return 'button';
    case 'quote':
      return 'quote';
    case 'divider':
      return 'divider';
    default:
      // Default to image-text instead of text
      return 'image-text';
  }
};

const getLayoutHint = (layout: string, blockType: string, index: number): BlockLayout => {
  // For weekly themes, enforce image-left layout for all content blocks
  // Headers use full-width layout
  if (blockType === 'header' || blockType === 'newsletter-header') {
    return 'full-width';
  }
  
  // All other blocks use image-left layout for consistent visual structure
  return 'image-left';
};

// Fallback block generation if all else fails
export const getFallbackBlocks = (topic: string): ContentBlock[] => {
  console.warn(`[NewsletterInit] Using fallback blocks for "${topic}"`);
  
  // Sanitize week numbers from topic
  const sanitizedTopic = sanitizeWeekNumbers(topic) || 'Weekly Newsletter';
  
  return [
    {
      id: `fallback_header_${Date.now()}`,
      type: 'header',
      title: sanitizedTopic,
      content: '',
      headline: sanitizedTopic,
      body: '',
      imageUrl: '',
      imageQuery: '',
      ctaText: '',
      ctaUrl: '',
      source: 'manual',
      personaTag: 'general',
      layout: 'full-width',
      alignment: 'center',
      textAlign: 'center',
      padding: 'large',
      visible: true,
      collapsed: false,
      shouldFetchImage: true,
      isGeneratingImage: true,
      isWeeklyTheme: true
    },
    {
      id: `fallback_content_${Date.now()}`,
      type: 'image-text',
      title: 'Weekly Update',
      content: '',
      headline: 'Weekly Update',
      body: '',
      imageUrl: '',
      ctaText: '',
      ctaUrl: '',
      source: 'manual',
      personaTag: 'general',
      layout: 'full-width',
      alignment: 'left',
      textAlign: 'left',
      padding: 'medium',
      visible: true,
      collapsed: false,
      shouldFetchImage: false // Text blocks should never fetch images
    },
    {
      id: `fallback_cta_${Date.now()}`,
      type: 'button',
      title: 'Call to Action',
      content: '',
      headline: '',
      body: '',
      imageUrl: '',
      ctaText: 'Learn More',
      ctaUrl: '#',
      source: 'manual',
      personaTag: 'general',
      layout: 'full-width',
      alignment: 'center',
      textAlign: 'center',
      padding: 'medium',
      visible: true,
      collapsed: false
    }
  ];
};