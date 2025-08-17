import { ContentBlock, BlockLayout } from '@/types/emailBuilder';

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
    const baseBlock: ContentBlock = {
      id: `block_${Date.now()}_${index}`,
      type: mapBlockType(block.type),
      title: block.title || '',
      content: block.content || '',
      headline: block.title || '',
      body: block.content || '',
      imageUrl: '',
      ctaText: block.buttonText || '',
      ctaUrl: block.buttonUrl || '#',
      source: 'newsletter',
      personaTag: 'general',
      layout: getLayoutHint(layout, block.type, index) as BlockLayout,
      alignment: 'left',
      textAlign: 'left',
      padding: 'medium',
      visible: true,
      collapsed: false
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
          collapsed: false
        };
        
        blocks.push(newBlock);
      }
    }
  }
  
  console.log(`[NewsletterInit] Final block count after template conversion: ${blocks.length} blocks for "${topic}" (layout: ${layout})`);
  return blocks;
};

const generateBlockBuilderBlocks = (topic: string): ContentBlock[] => {
  const blocks: ContentBlock[] = [
    {
      id: `header_${Date.now()}`,
      type: 'header',
      title: topic,
      content: '',
      headline: topic,
      body: '',
      imageUrl: '',
      ctaText: '',
      ctaUrl: '',
      source: 'template',
      personaTag: 'general',
      layout: 'full-width',
      alignment: 'center',
      textAlign: 'center',
      padding: 'large',
      visible: true,
      collapsed: false
    },
    {
      id: `content1_${Date.now()}`,
      type: 'image-text',
      title: 'Featured Story',
      content: '',
      headline: 'Featured Story',
      body: '',
      imageUrl: '',
      ctaText: '',
      ctaUrl: '',
      source: 'template',
      personaTag: 'general',
      layout: 'image-left',
      alignment: 'left',
      textAlign: 'left',
      padding: 'medium',
      visible: true,
      collapsed: false
    },
    {
      id: `content2_${Date.now()}`,
      type: 'image-text',
      title: 'Main Article',
      content: '',
      headline: 'Main Article',
      body: '',
      imageUrl: '',
      ctaText: '',
      ctaUrl: '',
      source: 'template',
      personaTag: 'general',
      layout: 'image-left',
      alignment: 'left',
      textAlign: 'left',
      padding: 'medium',
      visible: true,
      collapsed: false
    },
    {
      id: `content3_${Date.now()}`,
      type: 'image-text',
      title: 'Secondary Feature',
      content: '',
      headline: 'Secondary Feature',
      body: '',
      imageUrl: '',
      ctaText: 'Learn More',
      ctaUrl: '#',
      source: 'template',
      personaTag: 'general',
      layout: 'image-left',
      alignment: 'left',
      textAlign: 'left',
      padding: 'medium',
      visible: true,
      collapsed: false
    },
    {
      id: `content4_${Date.now()}`,
      type: 'image-text',
      title: 'Call to Action',
      content: '',
      headline: 'Call to Action',
      body: '',
      imageUrl: '',
      ctaText: 'Visit Our Garden Center',
      ctaUrl: '#',
      source: 'template',
      personaTag: 'general',
      layout: 'image-left',
      alignment: 'left',
      textAlign: 'left',
      padding: 'medium',
      visible: true,
      collapsed: false
    }
  ];
  
  console.log(`[NewsletterInit] Generated ${blocks.length} blocks for "${topic}" (layout: block-builder)`);
  return blocks;
};

const generateSimpleEmailBlocks = (topic: string): ContentBlock[] => {
  const blocks: ContentBlock[] = [
    {
      id: `header_${Date.now()}`,
      type: 'header',
      title: topic,
      content: '',
      headline: topic,
      body: '',
      imageUrl: '',
      ctaText: '',
      ctaUrl: '',
      source: 'template',
      personaTag: 'general',
      layout: 'full-width',
      alignment: 'center',
      textAlign: 'center',
      padding: 'medium',
      visible: true,
      collapsed: false
    },
    {
      id: `intro_${Date.now()}`,
      type: 'text',
      title: 'Introduction',
      content: '',
      headline: 'Introduction',
      body: '',
      imageUrl: '',
      ctaText: '',
      ctaUrl: '',
      source: 'template',
      personaTag: 'general',
      layout: 'full-width',
      alignment: 'left',
      textAlign: 'left',
      padding: 'medium',
      visible: true,
      collapsed: false
    },
    {
      id: `main_${Date.now()}`,
      type: 'text',
      title: 'Main Content',
      content: '',
      headline: 'Main Content',
      body: '',
      imageUrl: '',
      ctaText: '',
      ctaUrl: '',
      source: 'template',
      personaTag: 'general',
      layout: 'full-width',
      alignment: 'left',
      textAlign: 'left',
      padding: 'medium',
      visible: true,
      collapsed: false
    },
    {
      id: `closing_${Date.now()}`,
      type: 'text',
      title: 'Closing Thoughts',
      content: '',
      headline: 'Closing Thoughts',
      body: '',
      imageUrl: '',
      ctaText: '',
      ctaUrl: '',
      source: 'template',
      personaTag: 'general',
      layout: 'full-width',
      alignment: 'left',
      textAlign: 'left',
      padding: 'medium',
      visible: true,
      collapsed: false
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
      return 'text';
    case 'button':
      return 'button';
    case 'quote':
      return 'quote';
    case 'divider':
      return 'divider';
    default:
      return 'text';
  }
};

const getLayoutHint = (layout: string, blockType: string, index: number): BlockLayout => {
  // For now, all layouts use full-width since magazine layout is removed
  return 'full-width';
};

// Fallback block generation if all else fails
export const getFallbackBlocks = (topic: string): ContentBlock[] => {
  console.warn(`[NewsletterInit] Using fallback blocks for "${topic}"`);
  
  return [
    {
      id: `fallback_header_${Date.now()}`,
      type: 'header',
      title: topic || 'Weekly Newsletter',
      content: '',
      headline: topic || 'Weekly Newsletter',
      body: '',
      imageUrl: '',
      ctaText: '',
      ctaUrl: '',
      source: 'manual',
      personaTag: 'general',
      layout: 'full-width',
      alignment: 'center',
      textAlign: 'center',
      padding: 'large',
      visible: true,
      collapsed: false
    },
    {
      id: `fallback_content_${Date.now()}`,
      type: 'text',
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
      collapsed: false
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