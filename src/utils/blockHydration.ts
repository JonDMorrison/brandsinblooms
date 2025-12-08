/**
 * Block Hydration Utilities
 * STEP 6: Enhanced consistency guards for block state management
 * 
 * Provides utility functions for managing the hydration and state of content blocks,
 * ensuring that user-edited content is preserved and that blocks are updated consistently.
 */

import { ContentBlock, BlockStatus } from '@/types/emailBuilder';
import { newsletterDebug } from './newsletterDebug';

/**
 * Check if a block has been marked as user-edited
 */
export function isUserEdited(block: Partial<ContentBlock>): boolean {
  return block.userEdited === true || block.status === 'user-edited';
}

/**
 * Check if a block has AI-generated content
 */
export function isAIGenerated(block: Partial<ContentBlock>): boolean {
  return block.hasGeneratedContent === true || block.status === 'ai-generated';
}

/**
 * Check if content string is empty or contains placeholder text
 */
export function isEmptyContent(content: string | undefined | null): boolean {
  if (!content) return true;
  
  const trimmed = content.trim().toLowerCase();
  if (trimmed.length === 0) return true;
  
  // Common placeholder patterns
  const placeholderPatterns = [
    'add your',
    'enter your',
    'type your',
    'your text here',
    'placeholder',
    'lorem ipsum',
    'click to edit',
    'edit this',
  ];
  
  return placeholderPatterns.some(pattern => trimmed.includes(pattern));
}

/**
 * Check if a block has no meaningful content (headline, body, image, or CTA)
 */
export function isEmptyBlock(block: Partial<ContentBlock>): boolean {
  const hasHeadline = !isEmptyContent(block.headline) || !isEmptyContent(block.title);
  const hasBody = !isEmptyContent(block.body) || !isEmptyContent(block.content);
  const hasImage = !!(block.imageUrl || block.backgroundImageUrl);
  const hasCta = !isEmptyContent(block.ctaText) || !isEmptyContent(block.buttonText);
  
  // Special handling for divider blocks - they're never "empty"
  if (block.type === 'divider') {
    return false;
  }
  
  return !hasHeadline && !hasBody && !hasImage && !hasCta;
}

/**
 * Determine if a block should be hydrated with default content
 * Only hydrate empty blocks that haven't been edited or AI-generated
 * 
 * STEP 6: Enhanced with proper status checking
 */
export function shouldHydrate(block: Partial<ContentBlock>): boolean {
  // Never hydrate user-edited blocks
  if (isUserEdited(block)) {
    newsletterDebug.log('hydration', `Block ${block.id}: shouldHydrate=false (user-edited)`);
    return false;
  }
  
  // Never hydrate AI-generated blocks
  if (isAIGenerated(block)) {
    newsletterDebug.log('hydration', `Block ${block.id}: shouldHydrate=false (ai-generated)`);
    return false;
  }
  
  // Only hydrate if the block is actually empty
  const empty = isEmptyBlock(block);
  newsletterDebug.log('hydration', `Block ${block.id}: shouldHydrate=${empty} (isEmpty=${empty})`);
  
  return empty;
}

/**
 * Check if content can be safely overwritten
 * Returns true only if the block is empty AND not user-edited AND not AI-generated
 */
export function canOverwriteContent(block: Partial<ContentBlock>): boolean {
  if (isUserEdited(block)) {
    return false;
  }
  
  if (isAIGenerated(block)) {
    return false;
  }
  
  return isEmptyBlock(block);
}

/**
 * Mark a block as user-edited
 */
export function markAsUserEdited(block: ContentBlock): ContentBlock {
  newsletterDebug.log('hydration', `Marking block ${block.id} as user-edited`);
  return {
    ...block,
    userEdited: true,
    status: 'user-edited' as BlockStatus,
    contentVersion: (block.contentVersion || 0) + 1,
  };
}

/**
 * Mark a block as AI-generated
 */
export function markAsAIGenerated(block: ContentBlock): ContentBlock {
  newsletterDebug.log('hydration', `Marking block ${block.id} as AI-generated`);
  return {
    ...block,
    hasGeneratedContent: true,
    status: 'ai-generated' as BlockStatus,
    contentGeneratedAt: Date.now(),
  };
}

/**
 * Safely update block content
 * Prevents overwrites on user-edited blocks and only fills empty fields
 */
export function safeSetContent(
  block: ContentBlock, 
  updates: Partial<Pick<ContentBlock, 'headline' | 'title' | 'body' | 'content' | 'imageUrl' | 'backgroundImageUrl'>>
): ContentBlock {
  // If user-edited, don't update any content fields
  if (isUserEdited(block)) {
    newsletterDebug.log('hydration', `safeSetContent: Block ${block.id} is user-edited, skipping update`);
    return block;
  }
  
  const result = { ...block };
  
  // Only update empty fields
  if (updates.headline && isEmptyContent(block.headline)) {
    result.headline = updates.headline;
    result.title = updates.headline;
  }
  
  if (updates.body && isEmptyContent(block.body)) {
    result.body = updates.body;
    result.content = updates.body;
  }
  
  // Image updates are allowed if no image exists
  if (updates.imageUrl && !block.imageUrl) {
    result.imageUrl = updates.imageUrl;
  }
  
  if (updates.backgroundImageUrl && !block.backgroundImageUrl) {
    result.backgroundImageUrl = updates.backgroundImageUrl;
  }
  
  newsletterDebug.log('hydration', `safeSetContent: Updated block ${block.id}`, {
    updatedHeadline: result.headline !== block.headline,
    updatedBody: result.body !== block.body,
    updatedImage: result.imageUrl !== block.imageUrl || result.backgroundImageUrl !== block.backgroundImageUrl,
  });
  
  return result;
}

/**
 * Create a new block with initial 'empty' status and default properties
 */
export function createEmptyBlock(type: ContentBlock['type'], id: string): ContentBlock {
  const baseBlock: ContentBlock = {
    id,
    type,
    headline: '',
    title: '',
    body: '',
    content: '',
    status: 'empty' as BlockStatus,
    hasGeneratedContent: false,
    userEdited: false,
    visible: true,
    collapsed: false,
    source: 'manual',
    autoImageMode: true, // New blocks default to auto mode
    shouldFetchImage: false,
    isGeneratingImage: false,
  };
  
  // Add type-specific defaults
  switch (type) {
    case 'header':
    case 'newsletter-header':
      return {
        ...baseBlock,
        alignment: 'center',
        padding: 'large',
      };
    case 'image-text':
      return {
        ...baseBlock,
        layout: 'image-left',
        alignment: 'left',
        padding: 'medium',
      };
    case 'button':
    case 'cta':
      return {
        ...baseBlock,
        alignment: 'center',
        ctaText: '',
        ctaUrl: '',
        buttonText: '',
        buttonUrl: '',
      };
    case 'divider':
      return {
        ...baseBlock,
        visible: true,
      };
    case 'image-gallery':
      return {
        ...baseBlock,
        headline: '',
        body: '',
        galleryImages: [],
        galleryItems: [], // Product gallery items (2x2 grid)
        galleryLayout: '3-across',
        galleryGap: 'medium',
        galleryImageRadius: 'medium',
        alignment: 'center',
        padding: 'medium',
        ctaText: 'Shop Holiday',
        ctaUrl: '',
      };
    default:
      return {
        ...baseBlock,
        alignment: 'left',
        padding: 'medium',
      };
  }
}

/**
 * Validate block state for inconsistencies
 * Returns array of warning messages
 */
export function validateBlockState(block: ContentBlock): string[] {
  const warnings: string[] = [];
  
  // Check for status/flag inconsistencies
  if (block.userEdited && block.status !== 'user-edited') {
    warnings.push(`Block ${block.id}: userEdited=true but status="${block.status}"`);
  }
  
  if (block.hasGeneratedContent && block.status === 'empty') {
    warnings.push(`Block ${block.id}: hasGeneratedContent=true but status="empty"`);
  }
  
  // Check for content without proper flags
  const hasContent = !isEmptyBlock(block);
  if (hasContent && block.status === 'empty') {
    warnings.push(`Block ${block.id}: has content but status="empty"`);
  }
  
  // Check for image generation state issues
  if (block.isGeneratingImage && (block.imageUrl || block.backgroundImageUrl)) {
    warnings.push(`Block ${block.id}: isGeneratingImage=true but already has image`);
  }
  
  // Log warnings
  if (warnings.length > 0) {
    newsletterDebug.warn('hydration', `Block state validation warnings for ${block.id}:`, warnings);
  }
  
  return warnings;
}

/**
 * Normalize block status based on content state
 * Use this when loading blocks to ensure status is consistent with content
 */
export function normalizeBlockStatus(block: ContentBlock): ContentBlock {
  const hasContent = !isEmptyBlock(block);
  
  // If block has userEdited flag, preserve it
  if (block.userEdited) {
    return {
      ...block,
      status: 'user-edited' as BlockStatus,
    };
  }
  
  // If block has AI-generated content flag, preserve it
  if (block.hasGeneratedContent) {
    return {
      ...block,
      status: 'ai-generated' as BlockStatus,
    };
  }
  
  // Infer status from content
  if (hasContent) {
    // Content exists but no flags - assume AI-generated
    return {
      ...block,
      hasGeneratedContent: true,
      status: 'ai-generated' as BlockStatus,
    };
  }
  
  // No content - mark as empty
  return {
    ...block,
    status: 'empty' as BlockStatus,
  };
}

/**
 * Check if a block needs image generation
 * STEP 4: Deterministic image behavior
 */
export function needsImageGeneration(block: ContentBlock): boolean {
  // Don't generate if already generating
  if (block.isGeneratingImage) {
    return false;
  }
  
  // Don't generate if autoImageMode is disabled
  if (block.autoImageMode === false) {
    return false;
  }
  
  // Don't generate if shouldFetchImage is explicitly false
  if (block.shouldFetchImage === false) {
    return false;
  }
  
  // Check if block type supports images
  const imageBlockTypes = ['image', 'image-text', 'header', 'newsletter-header', 'background-image', 'background-image-section'];
  
  // Gallery blocks handle their own images differently
  if (block.type === 'image-gallery') {
    return false; // Gallery manages its own images via galleryImages array
  }
  
  if (!imageBlockTypes.includes(block.type)) {
    return false;
  }
  
  // Header blocks use backgroundImageUrl
  const isHeader = block.type === 'header' || block.type === 'newsletter-header';
  const hasImage = isHeader 
    ? !!block.backgroundImageUrl 
    : !!block.imageUrl;
  
  // Only generate if no image exists
  return !hasImage;
}

/**
 * Log block state for debugging
 */
export function logBlockDebugState(block: ContentBlock, context: string): void {
  newsletterDebug.logBlockState({
    id: block.id,
    type: block.type,
    status: block.status,
    hasGeneratedContent: block.hasGeneratedContent,
    userEdited: block.userEdited,
  }, context);
}
