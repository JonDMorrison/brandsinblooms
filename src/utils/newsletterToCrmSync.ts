import { parseNewsletterYAML, StructuredNewsletter } from './newsletterUtils';
import { processNewsletterContent } from './newsletterContentProcessor';

export interface CRMCampaignBlock {
  id: string;
  type: 'header' | 'text' | 'image' | 'button' | 'spacer';
  content: {
    text?: string;
    imageUrl?: string;
    imageAlt?: string;
    buttonText?: string;
    buttonUrl?: string;
    alignment?: 'left' | 'center' | 'right';
    size?: 'small' | 'medium' | 'large';
  };
  styles: {
    backgroundColor?: string;
    textColor?: string;
    fontSize?: string;
    fontWeight?: string;
    padding?: string;
    margin?: string;
  };
}

export interface NewsletterToCRMConversion {
  campaignTitle: string;
  theme: string;
  readingTime: string;
  blocks: CRMCampaignBlock[];
  segments: string[];
  personaTags: string[];
  images: string[];
  originalContent: string;
}

export const convertNewsletterToCRM = (
  newsletterContent: string,
  campaignTitle?: string,
  contentTaskId?: string
): NewsletterToCRMConversion => {
  console.log('[NEWSLETTER TO CRM] Converting newsletter to CRM format');
  
  // URL decode the content if it comes from URL parameters
  let decodedContent = newsletterContent;
  try {
    if (newsletterContent.includes('%')) {
      decodedContent = decodeURIComponent(newsletterContent);
    }
  } catch (error) {
    console.log('[NEWSLETTER TO CRM] Failed to decode URL content, using original');
  }
  
  // First try to parse as YAML with pipe syntax
  const parsedNewsletter = parseNewsletterYAML(decodedContent);
  
  let processedNewsletter;
  if (parsedNewsletter) {
    processedNewsletter = {
      newsletter_md: parsedNewsletter.newsletter_md,
      blocks: parsedNewsletter.blocks,
      meta: parsedNewsletter.meta,
      isStructured: true,
      needsRegeneration: false
    };
  } else {
    // Fallback to regular processing
    processedNewsletter = processNewsletterContent(decodedContent, campaignTitle);
    
    // If unstructured, convert unstructuredSections to blocks format
    if (!processedNewsletter.isStructured && processedNewsletter.unstructuredSections) {
      processedNewsletter.blocks = processedNewsletter.unstructuredSections.map((section, index) => ({
        title: section.title || `Section ${index + 1}`,
        body: section.content || '',
        cta: section.cta || 'Learn More',
        link: section.link || '#',
        image_prompt: section.image_prompt || `${section.title || campaignTitle} garden newsletter`,
        alt_text: section.alt_text || `Image for ${section.title || campaignTitle}`
      }));
    }
  }
  
  // Extract persona tags and segments
  const personaTags = extractPersonaTags(newsletterContent);
  const segments = generateSegmentSuggestions(newsletterContent, processedNewsletter.meta.theme, personaTags);
  const images = extractImageUrls(newsletterContent);
  
  // Convert newsletter blocks to CRM blocks
  const crmBlocks: CRMCampaignBlock[] = [];
  
  // Parse the markdown content to extract headline and subheadline
  const markdownLines = processedNewsletter.newsletter_md?.split('\n') || [];
  const headlineLine = markdownLines.find(line => line.startsWith('#'));
  const subheadlineLine = markdownLines.find(line => line.startsWith('*') && line.endsWith('*'));
  
  // Create header block with headline and subheadline
  if (headlineLine) {
    const headline = headlineLine.replace(/^#+\s*/, '').trim();
    const subheadline = subheadlineLine ? subheadlineLine.replace(/^\*|\*$/g, '').trim() : '';
    
    crmBlocks.push(createCombinedHeaderBlock(headline, subheadline));
    crmBlocks.push(createSpacerBlock());
  }
  
  // Convert newsletter blocks to CRM content blocks (image-right, text-left layout)
  if (processedNewsletter.blocks && processedNewsletter.blocks.length > 0) {
    processedNewsletter.blocks.forEach((block, index) => {
      // Create content block with image-right, text-left layout
      crmBlocks.push(createContentBlock(block.title, block.body, block.image_prompt, block.alt_text));
      
      // Add spacer between sections (except last)
      if (index < processedNewsletter.blocks.length - 1) {
        crmBlocks.push(createSpacerBlock('small'));
      }
    });
  }
  
  // Add footer spacer
  crmBlocks.push(createSpacerBlock());
  
  console.log('[NEWSLETTER TO CRM] Conversion complete:', {
    blocksCount: crmBlocks.length,
    personaTags: personaTags.length,
    segments: segments.length,
    images: images.length
  });
  
  return {
    campaignTitle: campaignTitle || processedNewsletter.meta.week_focus,
    theme: processedNewsletter.meta.theme,
    readingTime: processedNewsletter.meta.reading_time,
    blocks: crmBlocks,
    segments,
    personaTags,
    images,
    originalContent: newsletterContent
  };
};

// Helper functions to create CRM blocks
const createHeaderBlock = (text: string): CRMCampaignBlock => ({
  id: `header-${Date.now()}`,
  type: 'header',
  content: {
    text,
    alignment: 'center'
  },
  styles: {
    fontSize: '28px',
    fontWeight: 'bold',
    textColor: '#1a202c',
    padding: '20px',
    backgroundColor: '#ffffff'
  }
});

const createCombinedHeaderBlock = (headline: string, subheadline: string): CRMCampaignBlock => ({
  id: `header-combined-${Date.now()}`,
  type: 'header',
  content: {
    text: subheadline ? `${headline}\n${subheadline}` : headline,
    alignment: 'center'
  },
  styles: {
    fontSize: '28px',
    fontWeight: 'bold',
    textColor: '#1a202c',
    padding: '30px 20px',
    backgroundColor: '#ffffff'
  }
});

const createContentBlock = (title: string, content: string, imagePrompt: string, altText: string): CRMCampaignBlock => ({
  id: `content-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  type: 'text',
  content: {
    text: `<h3 style="font-size: 20px; font-weight: bold; color: #2d3748; margin-bottom: 15px;">${title}</h3><p style="font-size: 16px; color: #4a5568; line-height: 1.6;">${content}</p>`,
    alignment: 'left',
    imageUrl: imagePrompt,
    imageAlt: altText
  },
  styles: {
    padding: '25px 20px',
    backgroundColor: '#ffffff'
  }
});

const createTextBlock = (text: string, variant: 'header' | 'content'): CRMCampaignBlock => ({
  id: `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  type: 'text',
  content: {
    text,
    alignment: 'left'
  },
  styles: {
    fontSize: variant === 'header' ? '20px' : '16px',
    fontWeight: variant === 'header' ? 'bold' : 'normal',
    textColor: variant === 'header' ? '#2d3748' : '#4a5568',
    padding: variant === 'header' ? '20px 20px 10px 20px' : '10px 20px',
    backgroundColor: '#ffffff'
  }
});

const createButtonBlock = (text: string, url: string): CRMCampaignBlock => ({
  id: `button-${Date.now()}`,
  type: 'button',
  content: {
    buttonText: text,
    buttonUrl: url,
    alignment: 'center'
  },
  styles: {
    padding: '20px',
    backgroundColor: '#ffffff'
  }
});

const createSpacerBlock = (size: 'small' | 'medium' | 'large' = 'medium'): CRMCampaignBlock => ({
  id: `spacer-${Date.now()}`,
  type: 'spacer',
  content: {
    size
  },
  styles: {
    padding: size === 'small' ? '10px' : size === 'medium' ? '20px' : '40px',
    backgroundColor: '#ffffff'
  }
});

// Extract persona tags from content
const extractPersonaTags = (content: string): string[] => {
  const tags: string[] = [];
  const lowerContent = content.toLowerCase();
  
  // Analyze content for persona indicators
  if (lowerContent.includes('beginner') || lowerContent.includes('new to gardening')) {
    tags.push('gardening-beginner');
  }
  if (lowerContent.includes('expert') || lowerContent.includes('experienced')) {
    tags.push('gardening-expert');
  }
  if (lowerContent.includes('organic') || lowerContent.includes('natural')) {
    tags.push('organic-enthusiast');
  }
  if (lowerContent.includes('indoor') || lowerContent.includes('houseplant')) {
    tags.push('indoor-gardener');
  }
  if (lowerContent.includes('vegetable') || lowerContent.includes('herbs')) {
    tags.push('food-gardener');
  }
  if (lowerContent.includes('flower') || lowerContent.includes('ornamental')) {
    tags.push('ornamental-gardener');
  }
  if (lowerContent.includes('seasonal') || lowerContent.includes('planning')) {
    tags.push('seasonal-planner');
  }
  
  return tags.length > 0 ? tags : ['general-gardener'];
};

// Generate segment suggestions based on content
const generateSegmentSuggestions = (content: string, theme: string, personaTags: string[]): string[] => {
  const segments: string[] = [];
  
  // Base segments
  segments.push('newsletter-subscribers');
  
  // Theme-based segments
  if (theme.toLowerCase().includes('summer')) {
    segments.push('summer-gardening-interested');
  }
  if (theme.toLowerCase().includes('seasonal')) {
    segments.push('seasonal-gardening-tips');
  }
  
  // Persona-based segments
  if (personaTags.includes('gardening-beginner')) {
    segments.push('beginner-gardeners');
  }
  if (personaTags.includes('organic-enthusiast')) {
    segments.push('organic-gardening-customers');
  }
  if (personaTags.includes('food-gardener')) {
    segments.push('vegetable-herb-growers');
  }
  
  // Engagement-based segments
  segments.push('highly-engaged-customers');
  segments.push('newsletter-active-readers');
  
  return segments;
};

// Extract image URLs from content
const extractImageUrls = (content: string): string[] => {
  const imageUrls: string[] = [];
  const imageRegex = /https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp)/gi;
  const matches = content.match(imageRegex);
  
  if (matches) {
    imageUrls.push(...matches);
  }
  
  return imageUrls;
};

// Create CRM campaign data structure
export const createCRMCampaignFromNewsletter = (
  conversion: NewsletterToCRMConversion,
  scheduleData?: {
    sendDate?: Date;
    sendTime?: string;
  }
) => {
  return {
    name: conversion.campaignTitle,
    subject: conversion.campaignTitle,
    preheader: `${conversion.readingTime} read - ${conversion.theme}`,
    content: conversion.blocks,
    segments: conversion.segments,
    metadata: {
      source: 'newsletter-conversion',
      theme: conversion.theme,
      readingTime: conversion.readingTime,
      personaTags: conversion.personaTags,
      originalContentLength: conversion.originalContent.length
    },
    schedule: scheduleData || {
      type: 'draft'
    }
  };
};