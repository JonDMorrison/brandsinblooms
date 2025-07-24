import { parseNewsletterYAML, StructuredNewsletter, extractNewsletterSections } from './newsletterUtils';
import { processNewsletterContent } from './newsletterContentProcessor';
import { ContentBlock } from '@/types/emailBuilder';
import yaml from 'js-yaml';

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

// New standalone function for direct YAML to ContentBlock conversion
export function convertNewsletterToCRM_Direct(newsletterRaw: string): ContentBlock[] {
  const decoded = decodeURIComponent(newsletterRaw);
  let parsedBlocks: ContentBlock[] = [];

  // First try YAML parsing
  try {
    const parsed = yaml.load(decoded) as any;
    if (parsed && Array.isArray(parsed.blocks)) {
      console.log('[YAML PARSER] Success:', parsed.blocks.length, 'blocks parsed');
      
      // Create header block from newsletter_md first line
      if (parsed.newsletter_md) {
        const lines = parsed.newsletter_md.split('\n');
        const headlineLine = lines.find((line: string) => line.startsWith('#'));
        if (headlineLine) {
          parsedBlocks.push({
            id: 'block-header',
            type: 'header',
            headline: headlineLine.replace(/^#+\s*/, '').trim(),
            body: 'Your weekly garden newsletter',
            alignment: 'center',
            padding: 'large',
            source: 'newsletter',
            collapsed: false,
            visible: true,
            animation: 'fade-in'
          });
        }
      }
      
      // Convert YAML blocks to ContentBlocks
      parsed.blocks.forEach((b: any, i: number) => {
        parsedBlocks.push({
          id: `block-${i}`,
          type: 'text',
          title: b.title || '',
          content: b.body || b.content || '',
          ctaText: b.cta || '',
          ctaUrl: b.link || '',
          imageUrl: b.image_prompt || '',
          altText: b.alt_text || '',
          alignment: 'left',
          padding: 'medium',
          source: 'newsletter',
          collapsed: false,
          visible: true,
          animation: 'fade-in'
        });
      });
      
      console.log('[YAML PARSER] Converted to', parsedBlocks.length, 'ContentBlocks');
      return parsedBlocks;
    }
  } catch (e) {
    console.warn('[YAML PARSER] Failed:', e);
  }

  // Fallback: parse markdown into blocks
  console.log('[FALLBACK PARSER] Starting markdown parsing');
  const lines = decoded.split('\n');
  let current: ContentBlock | null = null;

  for (const line of lines) {
    if (line.startsWith('# ')) {
      // Header block
      if (current) parsedBlocks.push(current);
      current = {
        id: 'block-header',
        type: 'header',
        headline: line.replace('# ', '').trim(),
        body: 'Your weekly garden newsletter',
        alignment: 'center',
        padding: 'large',
        source: 'newsletter',
        collapsed: false,
        visible: true,
        animation: 'fade-in'
      };
    } else if (line.startsWith('## ')) {
      // Text block title
      if (current) parsedBlocks.push(current);
      current = {
        id: `block-${parsedBlocks.length + 1}`,
        type: 'text',
        title: line.replace('## ', '').trim(),
        content: '',
        alignment: 'left',
        padding: 'medium',
        source: 'newsletter',
        collapsed: false,
        visible: true,
        animation: 'fade-in'
      };
    } else if (current && line.trim()) {
      // Add content to current block
      current.content = (current.content || '') + (current.content ? '\n' : '') + line.trim();
    }
  }

  if (current) parsedBlocks.push(current);

  console.log('[FALLBACK PARSER] Parsed', parsedBlocks.length, 'blocks');
  parsedBlocks.forEach((b, i) => {
    const title = b.type === 'header' ? b.headline : b.title;
    console.log(`Block ${i + 1}: ${title}`);
  });

  return parsedBlocks;
}

export const convertNewsletterToCRM = (
  newsletterContent: string,
  campaignTitle?: string,
  contentTaskId?: string
): NewsletterToCRMConversion => {
  console.log('[NEWSLETTER TO CRM] Converting newsletter to CRM format');
  
  // Try direct conversion first for better results
  const directBlocks = convertNewsletterToCRM_Direct(newsletterContent);
  if (directBlocks.length > 1) {
    console.log('[NEWSLETTER TO CRM] ✅ Direct conversion successful:', directBlocks.length, 'blocks');
    return {
      campaignTitle: campaignTitle || 'Newsletter Campaign',
      theme: 'Garden Newsletter',
      readingTime: '3 min read',
      blocks: directBlocks,
      segments: ['newsletter-subscribers'],
      personaTags: ['general-gardener'],
      images: [],
      originalContent: newsletterContent
    };
  }
  
  // Enhanced URL decode and YAML structure preprocessing
  let decodedContent = newsletterContent;
  try {
    if (newsletterContent.includes('%')) {
      decodedContent = decodeURIComponent(newsletterContent);
      console.log('[NEWSLETTER TO CRM] URL decoded, length:', decodedContent.length);
      
      // Comprehensive YAML structure fixes
      decodedContent = decodedContent
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\+/g, ' ')
        // Critical fix: Handle newsletter_md pipe syntax with inline content
        .replace(/newsletter_md:\s*\|\s*(.+?)(\s+##|\s+blocks:|\s+meta:|\s+extra_content_ideas:|$)/gs, (match, content, ending) => {
          // Split content and ensure proper indentation
          const lines = content.split(/(?=\s*##\s+)/g);
          const indentedContent = lines
            .map(line => line.trim())
            .filter(line => line)
            .map(line => `  ${line}`)
            .join('\n');
          
          return `newsletter_md: |\n${indentedContent}${ending ? '\n' + ending.trim() : ''}`;
        })
        // Fix blocks section structure
        .replace(/(\w)\s+(blocks:|meta:|extra_content_ideas:)/g, '$1\n\n$2')
        // Handle inline blocks that may be malformed
        .replace(/blocks:\s*-\s*title:/g, 'blocks:\n  - title:')
        // Fix block field spacing
        .replace(/(\w+):\s*"([^"]*?)"\s*(\w+):/g, '$1: "$2"\n    $3:')
        // Ensure proper line breaks between major sections
        .replace(/(\w)\s*(newsletter_md:|blocks:|meta:)/g, '$1\n\n$2');
        
      console.log('[NEWSLETTER TO CRM] YAML preprocessing complete, preview:', decodedContent.substring(0, 300));
    }
  } catch (error) {
    console.log('[NEWSLETTER TO CRM] Failed to decode URL content, using original');
  }
  
  // First try to parse as YAML with pipe syntax
  console.log('[NEWSLETTER TO CRM] Attempting to parse YAML content');
  console.log('[NEWSLETTER TO CRM] Content preview for YAML parsing:', decodedContent.substring(0, 300));
  const parsedNewsletter = parseNewsletterYAML(decodedContent);
  
  console.log('[NEWSLETTER TO CRM] YAML parse result:', parsedNewsletter ? '✅ SUCCESS' : '❌ FAILED');
  if (parsedNewsletter) {
    console.log('[NEWSLETTER TO CRM] ✅ YAML parsed blocks:', parsedNewsletter.blocks?.length || 0);
    console.log('[NEWSLETTER TO CRM] ✅ YAML block titles:', parsedNewsletter.blocks?.map(b => b.title) || []);
    console.log('[NEWSLETTER TO CRM] ✅ Newsletter MD length:', parsedNewsletter.newsletter_md?.length || 0);
  } else {
    console.log('[NEWSLETTER TO CRM] ❌ YAML parsing failed, will use fallback processing');
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
  
  // Extract persona tags and segments with safe null handling
  const personaTags = extractPersonaTags(newsletterContent);
  const safeTheme = processedNewsletter.meta?.theme || 'Garden Newsletter';
  const segments = generateSegmentSuggestions(newsletterContent, safeTheme, personaTags);
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
    console.log('[NEWSLETTER TO CRM] Converting', processedNewsletter.blocks.length, 'newsletter blocks to ContentBlocks');
    processedNewsletter.blocks.forEach((block, index) => {
      const contentBlock = {
        id: `content-${Date.now()}-${index}`,
        type: 'text' as const,
        title: block.title,
        content: block.body,
        imageUrl: block.image_prompt,
        altText: block.alt_text,
        alignment: 'left' as const,
        padding: 'medium' as const,
        source: 'newsletter' as const,
        collapsed: false,
        visible: true,
        animation: 'fade-in' as const
      };
      console.log(`[NEWSLETTER TO CRM] Created ContentBlock ${index + 1}:`, {
        id: contentBlock.id,
        type: contentBlock.type,
        title: contentBlock.title,
        hasContent: !!contentBlock.content,
        source: contentBlock.source
      });
      contentBlocks.push(contentBlock);
    });
  } else {
    console.log('[NEWSLETTER TO CRM] ❌ No valid blocks found in processedNewsletter, using intelligent fallback');
    
    // Enhanced fallback: Try to extract from newsletter_md content
    if (processedNewsletter.newsletter_md) {
      const { sections } = extractNewsletterSections(processedNewsletter.newsletter_md);
      console.log('[NEWSLETTER TO CRM] ✅ Extracted', sections.length, 'sections from markdown fallback');
      
      sections.forEach((section, index) => {
        contentBlocks.push({
          id: `section-${Date.now()}-${index}`,
          type: 'text' as const,
          title: section.title,
          content: section.content,
          alignment: 'left' as const,
          padding: 'medium' as const,
          source: 'newsletter' as const,
          collapsed: false,
          visible: true,
          animation: 'fade-in' as const
        });
        console.log(`[NEWSLETTER TO CRM] ✅ Created section block: ${section.title}`);
      });
    }
    
    // Aggressive fallback: Split the entire content by ## headers if markdown extraction failed
    if (contentBlocks.length === 1) { // Only header exists
      console.log('[NEWSLETTER TO CRM] ⚠️ Markdown fallback failed, trying aggressive text splitting');
      
      // Split by ## pattern
      const headerSections = decodedContent.split(/##\s+/);
      if (headerSections.length > 1) {
        headerSections.slice(1).forEach((section, index) => {
          const lines = section.split('\n');
          const title = lines[0]?.trim() || `Section ${index + 1}`;
          const content = lines.slice(1).join('\n').trim();
          
          if (content) {
            contentBlocks.push({
              id: `split-${Date.now()}-${index}`,
              type: 'text' as const,
              title: title,
              content: content.substring(0, 1000), // Limit content length
              alignment: 'left' as const,
              padding: 'medium' as const,
              source: 'newsletter' as const,
              collapsed: false,
              visible: true,
              animation: 'fade-in' as const
            });
            console.log(`[NEWSLETTER TO CRM] ✅ Created split block: ${title}`);
          }
        });
      }
    }
    
    // Last resort fallback
    if (contentBlocks.length === 1) { // Only header exists
      console.log('[NEWSLETTER TO CRM] ⚠️ All fallbacks failed, creating single content block');
      contentBlocks.push({
        id: `fallback-${Date.now()}`,
        type: 'text' as const,
        title: 'Newsletter Content',
        content: decodedContent.substring(0, 1000) + (decodedContent.length > 1000 ? '...' : ''),
        alignment: 'left' as const,
        padding: 'medium' as const,
        source: 'newsletter' as const,
        collapsed: false,
        visible: true,
        animation: 'fade-in' as const
      });
    }
  }
  
  console.log('[NEWSLETTER TO CRM] ✅ Conversion complete:', {
    totalBlocks: contentBlocks.length,
    blockTypes: contentBlocks.map(b => b.type),
    blockTitles: contentBlocks.map(b => b.type === 'header' ? b.headline : b.title),
    personaTags: personaTags.length,
    segments: segments.length,
    images: images.length
  });
  
  // Final validation
  if (contentBlocks.length < 2) {
    console.warn('[NEWSLETTER TO CRM] ⚠️ WARNING: Only', contentBlocks.length, 'blocks created - expected 4+');
  } else {
    console.log('[NEWSLETTER TO CRM] ✅ SUCCESS: Created', contentBlocks.length, 'blocks from newsletter');
  }
  
  return {
    campaignTitle: campaignTitle || processedNewsletter.meta?.week_focus || 'Newsletter Campaign',
    theme: processedNewsletter.meta?.theme || 'Garden Newsletter',
    readingTime: processedNewsletter.meta?.reading_time || '3 min read',
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
  
  // Theme-based segments with safe null handling
  const safeTheme = (theme || '').toLowerCase();
  if (safeTheme.includes('summer')) {
    segments.push('summer-gardening-interested');
  }
  if (safeTheme.includes('seasonal')) {
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