import { ContentBlock, BlockLayout } from '@/types/emailBuilder';

interface GenerateBlocksOptions {
  topic: string;
  layout: 'classic' | 'magazine' | 'one-column';
  templateBlocks?: any[];
}

export const generateNewsletterBlocks = (options: GenerateBlocksOptions): ContentBlock[] => {
  const { topic, layout, templateBlocks = [] } = options;
  
  console.log(`[NewsletterInit] Generating blocks for "${topic}" (layout: ${layout})`);
  
  // If we have template blocks, convert them first
  if (templateBlocks.length > 0) {
    console.log(`[NewsletterInit] Converting ${templateBlocks.length} template blocks for ${layout} layout`);
    return convertTemplateBlocks(templateBlocks, layout, topic);
  }
  
  // Generate layout-specific blocks
  switch (layout) {
    case 'classic':
      return generateClassicBlocks(topic);
    case 'magazine':
      return generateMagazineBlocks(topic);
    case 'one-column':
      return generateOneColumnBlocks(topic);
    default:
      console.warn(`[NewsletterInit] Unknown layout: ${layout}, falling back to classic`);
      return generateClassicBlocks(topic);
  }
};

const convertTemplateBlocks = (templateBlocks: any[], layout: string, topic: string): ContentBlock[] => {
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
  
  console.log(`[NewsletterInit] Generated ${blocks.length} blocks for "${topic}" (layout: ${layout})`);
  return blocks;
};

const generateClassicBlocks = (topic: string): ContentBlock[] => {
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
      id: `hero_${Date.now()}`,
      type: 'image-text',
      title: 'Featured Content',
      content: 'Welcome to this week\'s newsletter featuring the latest updates and insights.',
      headline: 'Featured Content',
      body: 'Welcome to this week\'s newsletter featuring the latest updates and insights.',
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
      id: `content1_${Date.now()}`,
      type: 'text',
      title: 'Main Article',
      content: 'This is your main content area. Share your expertise, tips, or latest news here.',
      headline: 'Main Article',
      body: 'This is your main content area. Share your expertise, tips, or latest news here.',
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
      id: `content2_${Date.now()}`,
      type: 'image-text',
      title: 'Secondary Feature',
      content: 'Add a secondary story or feature that complements your main content.',
      headline: 'Secondary Feature',
      body: 'Add a secondary story or feature that complements your main content.',
      imageUrl: '',
      ctaText: 'Learn More',
      ctaUrl: '#',
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
      ctaText: 'Take Action',
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
  
  console.log(`[NewsletterInit] Generated ${blocks.length} blocks for "${topic}" (layout: classic)`);
  return blocks;
};

const generateMagazineBlocks = (topic: string): ContentBlock[] => {
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
      id: `featured_${Date.now()}`,
      type: 'image-text',
      title: 'Featured Story',
      content: 'This is your featured article that takes center stage in the magazine layout.',
      headline: 'Featured Story',
      body: 'This is your featured article that takes center stage in the magazine layout.',
      imageUrl: '',
      ctaText: 'Read More',
      ctaUrl: '#',
      source: 'template',
      personaTag: 'general',
      layout: 'full-width', // Magazine layout hint
      alignment: 'left',
      textAlign: 'left',
      padding: 'large',
      visible: true,
      collapsed: false
    },
    {
      id: `sidebar1_${Date.now()}`,
      type: 'text',
      title: 'Quick Tips',
      content: 'Essential tips and quick insights for your readers.',
      headline: 'Quick Tips',
      body: 'Essential tips and quick insights for your readers.',
      imageUrl: '',
      ctaText: '',
      ctaUrl: '',
      source: 'template',
      personaTag: 'general',
      layout: 'two-column-left', // Magazine layout hint
      alignment: 'left',
      textAlign: 'left',
      padding: 'small',
      visible: true,
      collapsed: false
    },
    {
      id: `sidebar2_${Date.now()}`,
      type: 'image-text',
      title: 'Product Spotlight',
      content: 'Highlight a featured product or service.',
      headline: 'Product Spotlight',
      body: 'Highlight a featured product or service.',
      imageUrl: '',
      ctaText: 'Shop Now',
      ctaUrl: '#',
      source: 'template',
      personaTag: 'general',
      layout: 'two-column-right', // Magazine layout hint
      alignment: 'left',
      textAlign: 'left',
      padding: 'small',
      visible: true,
      collapsed: false
    },
    {
      id: `secondary_${Date.now()}`,
      type: 'text',
      title: 'Community News',
      content: 'Share community updates, events, or customer stories.',
      headline: 'Community News',
      body: 'Share community updates, events, or customer stories.',
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
      title: 'Newsletter CTA',
      content: '',
      headline: '',
      body: '',
      imageUrl: '',
      ctaText: 'Visit Our Store',
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
  
  console.log(`[NewsletterInit] Generated ${blocks.length} blocks for "${topic}" (layout: magazine)`);
  return blocks;
};

const generateOneColumnBlocks = (topic: string): ContentBlock[] => {
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
      content: 'Welcome to this week\'s newsletter. We\'ve got some great content to share with you.',
      headline: 'Introduction',
      body: 'Welcome to this week\'s newsletter. We\'ve got some great content to share with you.',
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
      content: 'Your main article or content goes here. Keep it engaging and valuable for your readers.',
      headline: 'Main Content',
      body: 'Your main article or content goes here. Keep it engaging and valuable for your readers.',
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
      content: 'Thank you for reading! We appreciate your continued support.',
      headline: 'Closing Thoughts',
      body: 'Thank you for reading! We appreciate your continued support.',
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
  
  console.log(`[NewsletterInit] Generated ${blocks.length} blocks for "${topic}" (layout: one-column)`);
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
  if (layout === 'magazine') {
    // First image-text block becomes featured
    if (blockType === 'image-text' && index === 1) {
      return 'full-width';
    }
    // Next few blocks become sidebar
    if (index >= 2 && index <= 3) {
      return 'two-column-left';
    }
    if (index === 4) {
      return 'two-column-right';
    }
  }
  
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
      content: 'Welcome to this week\'s newsletter. We\'ll be sharing valuable insights and updates with you.',
      headline: 'Weekly Update',
      body: 'Welcome to this week\'s newsletter. We\'ll be sharing valuable insights and updates with you.',
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
    }
  ];
};