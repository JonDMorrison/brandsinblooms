/**
 * Unified Block Field Mapping Utility
 * CANONICAL SOURCE OF TRUTH for mapping between frontend ContentBlock and database storage
 * All save/load operations MUST use these functions
 * 
 * STEP 2: This is the single source of truth for field name mapping
 * - headline/title/heading → headline (canonical)
 * - body/content → body (canonical)
 * - ctaText/buttonText/cta_text → ctaText (canonical)
 * - imageUrl/image_url → imageUrl (for non-headers) / backgroundImageUrl (for headers)
 */

import { ContentBlock, BlockStatus } from '@/types/emailBuilder';
import { newsletterDebug } from './newsletterDebug';

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
 * Database block shape returned from Supabase
 */
export interface DatabaseBlock {
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
  campaign_id?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Normalize a block for saving to the database
 * CANONICAL SAVE FUNCTION - All save operations MUST use this
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
  const endTimer = newsletterDebug.startTimer('mapping', `normalizeBlockForSave(${block.id})`);
  newsletterDebug.log('save', `Saving block ${block.id} (${block.type})`, {
    headline: block.headline?.substring(0, 30),
    hasImage: !!(block.imageUrl || block.backgroundImageUrl),
    status: block.status,
  });
  const isHeader = isHeaderBlock(block);
  
  // Get headline/title with fallback chain
  const headline = getBlockField<string>(block, 'headline') || '';
  const body = getBlockField<string>(block, 'body') || '';
  const ctaText = getBlockField<string>(block, 'ctaText') || '';
  const ctaUrl = getBlockField<string>(block, 'ctaUrl') || '';
  
  // CRITICAL: For header blocks, save backgroundImageUrl to image_url
  // For other blocks, save imageUrl to image_url
  // Respect explicit null (user deleted image) vs undefined
  const imageUrl = isHeader 
    ? (block.backgroundImageUrl ?? null)
    : (block.imageUrl ?? null);
  
  const result = {
    block_type: block.type,
    content: {
      // CANONICAL text fields - always save both for compatibility
      title: headline,
      headline: headline,
      heading: headline,
      body: body,
      content: body,
      
      // Layout and styling
      alignment: block.alignment,
      textAlign: block.textAlign || block.alignment,
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
      
      // CANONICAL CTA - save both formats for compatibility
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
      
      // Block status for hydration control
      status: block.status,
      
      // Content lifecycle flags - preserve through save/load
      hasGeneratedContent: block.hasGeneratedContent,
      userEdited: block.userEdited,
      contentGeneratedAt: block.contentGeneratedAt,
      contentVersion: block.contentVersion,
      
      // Image control flags - DETERMINISTIC IMAGE BEHAVIOR
      autoImageMode: block.autoImageMode,
      shouldFetchImage: block.shouldFetchImage,
      isGeneratingImage: block.isGeneratingImage,
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
  
  endTimer();
  return result;
}

/**
 * Unwrap nested content structure from database
 * Database sometimes stores content like: { content: { body: "text", ... } }
 */
function unwrapContentObject(content: any): Record<string, any> {
  if (!content || typeof content !== 'object') {
    return {};
  }
  
  let contentObj = content;
  
  // Parse if string
  if (typeof contentObj === 'string') {
    try {
      contentObj = JSON.parse(contentObj);
    } catch {
      return {};
    }
  }
  
  // Unwrap nested content layers (max 3 levels to prevent infinite loops)
  let depth = 0;
  while (
    depth < 3 &&
    contentObj && 
    typeof contentObj === 'object' && 
    contentObj.content && 
    typeof contentObj.content === 'object' &&
    !Array.isArray(contentObj.content)
  ) {
    contentObj = contentObj.content;
    depth++;
  }
  
  return contentObj || {};
}

/**
 * Normalize a database block record back to frontend ContentBlock format
 * CANONICAL LOAD FUNCTION - All load operations MUST use this
 */
export function normalizeBlockFromDatabase(dbBlock: DatabaseBlock): ContentBlock {
  const endTimer = newsletterDebug.startTimer('mapping', `normalizeBlockFromDatabase(${dbBlock.id})`);
  
  const contentObj = unwrapContentObject(dbBlock.content);
  const isHeader = dbBlock.block_type === 'header' || dbBlock.block_type === 'newsletter-header';
  
  newsletterDebug.log('load', `Loading block ${dbBlock.id} (${dbBlock.block_type})`, {
    hasImageUrl: !!dbBlock.image_url,
    contentKeys: Object.keys(contentObj).length,
    isHeader,
  });
  
  // Extract headline from all possible field names (priority order)
  const headline = contentObj.headline || contentObj.title || contentObj.heading || '';
  
  // Extract body from all possible field names (priority order)
  const body = contentObj.body || contentObj.content || '';
  
  // Extract CTA fields from all possible sources (DB columns take priority)
  const ctaText = dbBlock.cta_text || contentObj.ctaText || contentObj.buttonText || '';
  const ctaUrl = dbBlock.cta_url || contentObj.ctaUrl || contentObj.buttonUrl || '';
  
  // CRITICAL: For header blocks, load image_url into backgroundImageUrl
  // For other blocks, load image_url into imageUrl
  // PRESERVE EXISTING IMAGES - do not trigger fetch on load
  const imageUrl = isHeader ? undefined : (dbBlock.image_url || contentObj.imageUrl || undefined);
  const backgroundImageUrl = isHeader 
    ? (dbBlock.image_url || contentObj.backgroundImageUrl || undefined)
    : (contentObj.backgroundImageUrl || undefined);
  
  // Extract lifecycle flags with conservative defaults
  const hasGeneratedContent = contentObj.hasGeneratedContent === true || 
    (!!headline && headline.length > 0) || 
    (!!body && body.length > 0);
  const userEdited = contentObj.userEdited === true;
  
  // Determine block status from content state
  const status: BlockStatus = contentObj.status || 
    (userEdited ? 'user-edited' : hasGeneratedContent ? 'ai-generated' : 'empty');
  
  // DETERMINISTIC IMAGE BEHAVIOR: 
  // - autoImageMode defaults to false for existing campaigns (preserve user intent)
  // - shouldFetchImage defaults to false on load (never auto-fetch on reload)
  // - isGeneratingImage always false on load (generation finished or failed)
  const hasExistingImage = !!(imageUrl || backgroundImageUrl);
  const autoImageMode = contentObj.autoImageMode ?? false; // Default false = manual mode
  
  const result: ContentBlock = {
    id: dbBlock.id,
    type: dbBlock.block_type as ContentBlock['type'],
    
    // CANONICAL text fields - populate both for compatibility
    headline,
    title: headline,
    body,
    content: body,
    
    // Image fields - properly mapped based on block type
    // CRITICAL: Preserve undefined vs empty string distinction
    imageUrl,
    backgroundImageUrl,
    altText: contentObj.altText || '',
    caption: contentObj.caption || '',
    
    // CANONICAL CTA fields - both formats populated
    ctaText,
    ctaUrl,
    buttonText: ctaText,
    buttonUrl: ctaUrl,
    ctaStyle: contentObj.ctaStyle,
    ctaSize: contentObj.ctaSize,
    
    // Layout and styling
    layout: contentObj.layout,
    alignment: contentObj.alignment,
    textAlign: contentObj.textAlign || contentObj.alignment,
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
    visible: contentObj.visible !== false,
    collapsed: contentObj.collapsed || false,
    
    // Header-specific fields
    subtitle: contentObj.subtitle,
    issueNumber: contentObj.issueNumber,
    publishDate: contentObj.publishDate,
    
    // Metadata
    source: (dbBlock.source || 'manual') as ContentBlock['source'],
    personaTag: dbBlock.persona_tag || undefined,
    
    // Overlay settings (DB columns take priority)
    overlayOpacity: dbBlock.overlay_opacity ?? contentObj.overlayOpacity,
    overlayColor: dbBlock.overlay_color || contentObj.overlayColor,
    darkOverlayOpacity: dbBlock.dark_overlay_opacity ?? contentObj.darkOverlayOpacity,
    
    // Block status for hydration control
    status,
    
    // Content lifecycle flags
    hasGeneratedContent,
    userEdited,
    contentGeneratedAt: contentObj.contentGeneratedAt,
    contentVersion: contentObj.contentVersion,
    
    // DETERMINISTIC IMAGE BEHAVIOR - critical for predictable behavior
    autoImageMode, // Preserved from DB or defaults to false
    shouldFetchImage: false, // NEVER auto-fetch on reload
    isGeneratingImage: false, // Always false on load - generation is complete
  };
  
  endTimer();
  return result;
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
    hasGeneratedContent: block.hasGeneratedContent,
    userEdited: block.userEdited,
  });
}
