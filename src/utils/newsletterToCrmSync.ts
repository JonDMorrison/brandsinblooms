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
  
  // Process the newsletter content
  const processedNewsletter = processNewsletterContent(newsletterContent, campaignTitle);
  
  // Extract persona tags and segments
  const personaTags = extractPersonaTags(newsletterContent);
  const segments = generateSegmentSuggestions(newsletterContent, processedNewsletter.meta.theme, personaTags);
  const images = extractImageUrls(newsletterContent);
  
  // Convert newsletter blocks to CRM blocks
  const crmBlocks: CRMCampaignBlock[] = [];
  
  // Add header block
  crmBlocks.push(createHeaderBlock(campaignTitle || processedNewsletter.meta.week_focus));
  
  // Add spacer after header
  crmBlocks.push(createSpacerBlock());
  
  // Convert newsletter blocks to CRM blocks
  if (processedNewsletter.isStructured && processedNewsletter.blocks.length > 0) {
    processedNewsletter.blocks.forEach((block, index) => {
      // Add section header
      crmBlocks.push(createTextBlock(block.title, 'header'));
      
      // Add section content
      crmBlocks.push(createTextBlock(block.body, 'content'));
      
      // Add CTA button if present
      if (block.cta && block.cta !== 'Learn more') {
        crmBlocks.push(createButtonBlock(block.cta, block.link));
      }
      
      // Add spacer between sections (except last)
      if (index < processedNewsletter.blocks.length - 1) {
        crmBlocks.push(createSpacerBlock());
      }
    });
  } else {
    // Handle unstructured content
    const sections = processedNewsletter.unstructuredSections || [];
    sections.forEach((section, index) => {
      crmBlocks.push(createTextBlock(section.title, 'header'));
      crmBlocks.push(createTextBlock(section.content, 'content'));
      
      if (index < sections.length - 1) {
        crmBlocks.push(createSpacerBlock());
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