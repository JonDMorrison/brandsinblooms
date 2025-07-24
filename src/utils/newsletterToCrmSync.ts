import { parseNewsletterYAML, StructuredNewsletter } from './newsletterUtils';
import { processNewsletterContent } from './newsletterContentProcessor';
import { ContentBlock } from '@/types/emailBuilder';

export interface NewsletterToCRMConversion {
  campaignTitle: string;
  theme: string;
  readingTime: string;
  blocks: ContentBlock[];
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
  console.log('[NEWSLETTER TO CRM] Attempting to parse YAML content');
  const parsedNewsletter = parseNewsletterYAML(decodedContent);
  
  console.log('[NEWSLETTER TO CRM] YAML parse result:', parsedNewsletter ? 'SUCCESS' : 'FAILED');
  if (parsedNewsletter) {
    console.log('[NEWSLETTER TO CRM] YAML parsed blocks:', parsedNewsletter.blocks.length);
  }
  
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
    console.log('[NEWSLETTER TO CRM] Falling back to regular processing');
    processedNewsletter = processNewsletterContent(decodedContent, campaignTitle);
    
    // If unstructured, convert unstructuredSections to blocks format
    if (!processedNewsletter.isStructured && processedNewsletter.unstructuredSections) {
      console.log('[NEWSLETTER TO CRM] Converting unstructured sections to blocks:', processedNewsletter.unstructuredSections.length);
      processedNewsletter.blocks = processedNewsletter.unstructuredSections.map((section, index) => ({
        title: section.title || `Section ${index + 1}`,
        body: section.content || '',
        cta: section.cta || 'Learn More',
        link: section.link || '#',
        image_prompt: section.image_prompt || `${section.title || campaignTitle} garden newsletter`,
        alt_text: section.alt_text || `Image for ${section.title || campaignTitle}`
      }));
      console.log('[NEWSLETTER TO CRM] Converted to blocks:', processedNewsletter.blocks.length);
    }
  }
  
  // Extract persona tags and segments
  const personaTags = extractPersonaTags(newsletterContent);
  const segments = generateSegmentSuggestions(newsletterContent, processedNewsletter.meta.theme, personaTags);
  const images = extractImageUrls(newsletterContent);
  
  // Convert newsletter blocks directly to ContentBlocks
  const contentBlocks: ContentBlock[] = [];
  
  // Parse the markdown content to extract headline and subheadline
  const markdownLines = processedNewsletter.newsletter_md?.split('\n') || [];
  const headlineLine = markdownLines.find(line => line.startsWith('#'));
  const subheadlineLine = markdownLines.find(line => line.startsWith('*') && line.endsWith('*'));
  
  // Create header block with headline and subheadline
  if (headlineLine) {
    const headline = headlineLine.replace(/^#+\s*/, '').trim();
    const subheadline = subheadlineLine ? subheadlineLine.replace(/^\*|\*$/g, '').trim() : '';
    
    contentBlocks.push({
      id: `header-${Date.now()}`,
      type: 'header',
      headline,
      body: subheadline || 'Your weekly garden newsletter',
      alignment: 'center',
      padding: 'large',
      source: 'newsletter',
      collapsed: false,
      visible: true,
      animation: 'fade-in'
    });
  }
  
  // Convert newsletter blocks to ContentBlocks
  if (processedNewsletter.blocks && processedNewsletter.blocks.length > 0) {
    processedNewsletter.blocks.forEach((block, index) => {
      contentBlocks.push({
        id: `content-${Date.now()}-${index}`,
        type: 'text',
        title: block.title,
        content: block.body,
        imageUrl: block.image_prompt,
        altText: block.alt_text,
        alignment: 'left',
        padding: 'medium',
        source: 'newsletter',
        collapsed: false,
        visible: true,
        animation: 'fade-in'
      });
    });
  }
  
  console.log('[NEWSLETTER TO CRM] Conversion complete:', {
    blocksCount: contentBlocks.length,
    personaTags: personaTags.length,
    segments: segments.length,
    images: images.length
  });
  
  return {
    campaignTitle: campaignTitle || processedNewsletter.meta.week_focus,
    theme: processedNewsletter.meta.theme,
    readingTime: processedNewsletter.meta.reading_time,
    blocks: contentBlocks,
    segments,
    personaTags,
    images,
    originalContent: newsletterContent
  };
};


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