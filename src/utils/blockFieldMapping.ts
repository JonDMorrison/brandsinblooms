/**
 * Unified Block Field Mapping Utility
 * Ensures consistent field names between frontend state and database storage
 * Prevents content loss due to field name mismatches
 */

import { ContentBlock } from '@/types/emailBuilder';

/**
 * Field mapping definitions
 * Maps frontend field names to database column names and vice versa
 */
export const FIELD_MAPPINGS = {
  // Text content fields
  headline: ['headline', 'title', 'heading'],
  body: ['body', 'content'],
  title: ['title', 'headline', 'heading'],
  
  // CTA fields
  ctaText: ['ctaText', 'buttonText', 'cta_text'],
  ctaUrl: ['ctaUrl', 'buttonUrl', 'cta_url'],
  
  // Image fields
  imageUrl: ['imageUrl', 'image_url'],
  backgroundImageUrl: ['backgroundImageUrl', 'background_image_url'],
  altText: ['altText', 'alt_text'],
  
  // Layout fields
  layout: ['layout'],
  alignment: ['alignment', 'textAlign'],
} as const;

/**
 * Get a field value from a block, checking all possible field names
 */
export function getBlockField<T>(block: Partial<ContentBlock> | Record<string, any>, fieldKey: keyof typeof FIELD_MAPPINGS): T | undefined {
  const possibleNames = FIELD_MAPPINGS[fieldKey];
  
  for (const name of possibleNames) {
    const value = (block as any)[name];
    if (value !== undefined && value !== null && value !== '') {
      return value as T;
    }
  }
  
  return undefined;
}

/**
 * Check if a block is a header type
 */
export function isHeaderBlock(block: { type?: string; block_type?: string }): boolean {
  const blockType = block.type || block.block_type;
  return blockType === 'header' || blockType === 'newsletter-header';
}

/**
 * Normalize a block for saving to the database
 * Ensures all fields are in the correct format for database storage
 */
export function normalizeBlockForSave(block: ContentBlock, index: number): {
  block_type: string;
  content: Record<string, any>;
  image_url: string | null;
  cta_url: string | null;
  cta_text: string | null;
  order_index: number;
  source: string;
  persona_tag: string | null;
  overlay_opacity: number | null;
  overlay_color: string | null;
  dark_overlay_opacity: number | null;
} {
  const isHeader = isHeaderBlock(block);
  
  // Get headline/title with fallback chain
  const headline = getBlockField<string>(block, 'headline') || '';
  const body = getBlockField<string>(block, 'body') || '';
  const ctaText = getBlockField<string>(block, 'ctaText') || '';
  const ctaUrl = getBlockField<string>(block, 'ctaUrl') || '';
  
  // CRITICAL: For header blocks, save backgroundImageUrl to image_url
  // For other blocks, save imageUrl to image_url
  const imageUrl = isHeader 
    ? (block.backgroundImageUrl || null)
    : (block.imageUrl || null);
  
  return {
    block_type: block.type,
    content: {
      // Always save both title and headline for consistency
      title: headline,
      headline: headline,
      heading: headline,
      // Always save both body and content for consistency  
      body: body,
      content: body,
      // Layout and styling
      alignment: block.alignment,
      padding: block.padding,
      margin: block.margin,
      fontFamily: block.fontFamily,
      fontSize: block.fontSize,
      textColor: block.textColor,
      backgroundColor: block.backgroundColor,
      backgroundImageUrl: block.backgroundImageUrl,
      backgroundOpacity: block.backgroundOpacity,
      layout: block.layout,
      caption: block.caption,
      altText: block.altText,
      // CTA - save both formats
      buttonText: ctaText,
      buttonUrl: ctaUrl,
      ctaText: ctaText,
      ctaUrl: ctaUrl,
      ctaStyle: block.ctaStyle,
      ctaSize: block.ctaSize,
      // Quote block fields
      quote: block.quote,
      author: block.author,
      authorTitle: block.authorTitle,
      // Visibility
      visible: block.visible,
      collapsed: block.collapsed,
      // Header-specific fields
      subtitle: (block as any).subtitle,
      issueNumber: (block as any).issueNumber,
      publishDate: (block as any).publishDate,
    },
    image_url: imageUrl,
    cta_url: ctaUrl || null,
    cta_text: ctaText || null,
    order_index: index,
    source: block.source || 'manual',
    persona_tag: block.personaTag || null,
    overlay_opacity: block.overlayOpacity ?? null,
    overlay_color: block.overlayColor || null,
    dark_overlay_opacity: (block as any).darkOverlayOpacity ?? null,
  };
}

/**
 * Normalize a database block record back to frontend ContentBlock format
 * Ensures all fields are properly mapped from database to frontend state
 */
export function normalizeBlockFromDatabase(dbBlock: {
  id: string;
  block_type: string;
  content: Record<string, any>;
  image_url?: string | null;
  cta_url?: string | null;
  cta_text?: string | null;
  order_index: number;
  source?: string;
  persona_tag?: string | null;
  overlay_opacity?: number | null;
  overlay_color?: string | null;
  dark_overlay_opacity?: number | null;
}): ContentBlock {
  const contentObj = dbBlock.content || {};
  const isHeader = dbBlock.block_type === 'header' || dbBlock.block_type === 'newsletter-header';
  
  // Extract headline from all possible field names
  const headline = contentObj.headline || contentObj.title || contentObj.heading || '';
  
  // Extract body from all possible field names
  const body = contentObj.body || contentObj.content || '';
  
  // Extract CTA fields from all possible sources
  const ctaText = dbBlock.cta_text || contentObj.ctaText || contentObj.buttonText || '';
  const ctaUrl = dbBlock.cta_url || contentObj.ctaUrl || contentObj.buttonUrl || '';
  
  // CRITICAL: For header blocks, load image_url into backgroundImageUrl
  // For other blocks, load image_url into imageUrl
  const imageUrl = isHeader ? '' : (dbBlock.image_url || contentObj.imageUrl || '');
  const backgroundImageUrl = isHeader 
    ? (dbBlock.image_url || contentObj.backgroundImageUrl || '')
    : (contentObj.backgroundImageUrl || '');
  
  return {
    id: dbBlock.id,
    type: dbBlock.block_type as ContentBlock['type'],
    // Text content - normalized to consistent fields
    headline,
    title: headline,
    body,
    content: body,
    // Image fields - properly mapped based on block type
    imageUrl,
    backgroundImageUrl,
    altText: contentObj.altText || '',
    // CTA fields - both formats populated
    ctaText,
    ctaUrl,
    buttonText: ctaText,
    buttonUrl: ctaUrl,
    ctaStyle: contentObj.ctaStyle,
    ctaSize: contentObj.ctaSize,
    // Layout and styling
    layout: contentObj.layout,
    alignment: contentObj.alignment,
    padding: contentObj.padding,
    margin: contentObj.margin,
    fontFamily: contentObj.fontFamily,
    fontSize: contentObj.fontSize,
    textColor: contentObj.textColor,
    backgroundColor: contentObj.backgroundColor,
    backgroundOpacity: contentObj.backgroundOpacity,
    // Quote block fields
    quote: contentObj.quote,
    author: contentObj.author,
    authorTitle: contentObj.authorTitle,
    // Visibility
    visible: contentObj.visible,
    collapsed: contentObj.collapsed,
    // Metadata
    source: (dbBlock.source || 'manual') as ContentBlock['source'],
    personaTag: dbBlock.persona_tag || undefined,
    overlayOpacity: dbBlock.overlay_opacity ?? undefined,
    overlayColor: dbBlock.overlay_color || undefined,
  };
}

/**
 * Validate that a block has all required content for display
 */
export function validateBlockContent(block: ContentBlock): {
  isValid: boolean;
  missingFields: string[];
} {
  const missingFields: string[] = [];
  
  // Check headline/title
  const hasHeadline = !!(block.headline || block.title);
  if (!hasHeadline && block.type !== 'divider') {
    missingFields.push('headline');
  }
  
  // Check body/content for text blocks
  const hasBody = !!(block.body || block.content);
  if (!hasBody && (block.type === 'text' || block.type === 'image-text')) {
    missingFields.push('body');
  }
  
  // Check image for image blocks
  const isImageBlock = block.type === 'image' || block.type === 'image-text';
  const hasImage = !!(block.imageUrl || block.backgroundImageUrl);
  if (isImageBlock && !hasImage) {
    missingFields.push('image');
  }
  
  return {
    isValid: missingFields.length === 0,
    missingFields
  };
}

/**
 * Debug helper to log block content state
 */
export function logBlockState(block: ContentBlock, context: string): void {
  console.log(`📊 [${context}] Block ${block.id} (${block.type}):`, {
    headline: block.headline || block.title || '(empty)',
    body: (block.body || block.content || '').substring(0, 50) + '...',
    imageUrl: block.imageUrl?.substring(0, 50) || '(empty)',
    backgroundImageUrl: block.backgroundImageUrl?.substring(0, 50) || '(empty)',
    ctaText: block.ctaText || block.buttonText || '(empty)',
    ctaUrl: block.ctaUrl || block.buttonUrl || '(empty)',
  });
}
