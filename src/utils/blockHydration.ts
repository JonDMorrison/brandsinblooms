/**
 * Block Hydration Utilities
 * STEP 6: Consistency guards for all block-hydration paths
 * 
 * These helpers ensure:
 * - Never overwrite user-edited fields
 * - Never replace non-empty content with defaults
 * - Never re-normalize blocks multiple times in a single render
 * - Always run hydration exactly once per load
 */

import { ContentBlock, BlockStatus } from '@/types/emailBuilder';
import { newsletterDebug } from './newsletterDebug';

/**
 * Check if a block has been edited by the user
 * User-edited blocks should never have their content overwritten
 */
export function isUserEdited(block: Partial<ContentBlock>): boolean {
  return block.status === 'user-edited' || block.userEdited === true;
}

/**
 * Check if a block has AI-generated content
 */
export function isAIGenerated(block: Partial<ContentBlock>): boolean {
  return block.status === 'ai-generated' || block.hasGeneratedContent === true;
}

/**
 * Check if a block is empty (no meaningful content)
 */
export function isEmptyBlock(block: Partial<ContentBlock>): boolean {
  const hasHeadline = !!(block.headline || block.title);
  const hasBody = !!(block.body || block.content);
  const hasImage = !!(block.imageUrl || block.backgroundImageUrl);
  const hasCTA = !!(block.ctaText || block.buttonText);
  
  return !hasHeadline && !hasBody && !hasImage && !hasCTA;
}

/**
 * Check if content is empty or only contains placeholder text
 */
export function isEmptyContent(content: string | undefined | null): boolean {
  if (!content) return true;
  
  const trimmed = content.trim();
  if (!trimmed) return true;
  
  // Check for common placeholder patterns
  const placeholderPatterns = [
    /^add your (content|headline|text|body)/i,
    /^your (content|headline|text|body)/i,
    /^content headline$/i,
    /^newsletter content$/i,
    /^placeholder/i,
    /^lorem ipsum/i,
  ];
  
  return placeholderPatterns.some(pattern => pattern.test(trimmed));
}

/**
 * Determine if a block should be hydrated with defaults
 * Only hydrate empty blocks that have never been generated or edited
 */
export function shouldHydrate(block: Partial<ContentBlock>): boolean {
  // Never hydrate user-edited blocks
  if (isUserEdited(block)) {
    newsletterDebug.log('hydration', `Block ${block.id} - skipping hydration (user-edited)`);
    return false;
  }
  
  // Never hydrate blocks with generated content
  if (isAIGenerated(block)) {
    newsletterDebug.log('hydration', `Block ${block.id} - skipping hydration (ai-generated)`);
    return false;
  }
  
  // Only hydrate if block has empty or placeholder content
  const isEmpty = isEmptyBlock(block);
  const needsHydration = block.status === 'empty' || (!block.status && isEmpty);
  
  newsletterDebug.log('hydration', `Block ${block.id} - shouldHydrate: ${needsHydration}`, {
    status: block.status,
    isEmpty,
    hasGeneratedContent: block.hasGeneratedContent
  });
  
  return needsHydration;
}

/**
 * Mark a block as user-edited
 * Call this whenever the user manually modifies content
 */
export function markAsUserEdited(block: ContentBlock): ContentBlock {
  newsletterDebug.log('hydration', `Block ${block.id} - marking as user-edited`);
  return {
    ...block,
    status: 'user-edited' as BlockStatus,
    userEdited: true,
  };
}

/**
 * Mark a block as AI-generated
 * Call this after AI Writer generates content
 */
export function markAsAIGenerated(block: ContentBlock): ContentBlock {
  newsletterDebug.log('hydration', `Block ${block.id} - marking as ai-generated`);
  return {
    ...block,
    status: 'ai-generated' as BlockStatus,
    hasGeneratedContent: true,
    contentGeneratedAt: Date.now(),
    contentVersion: (block.contentVersion || 0) + 1,
  };
}

/**
 * Safely set content on a block, respecting user edits
 * Will not overwrite if the block is user-edited
 */
export function safeSetContent(
  block: ContentBlock, 
  updates: Partial<Pick<ContentBlock, 'headline' | 'title' | 'body' | 'content' | 'imageUrl' | 'backgroundImageUrl'>>
): ContentBlock {
  // Never overwrite user-edited blocks
  if (isUserEdited(block)) {
    newsletterDebug.log('hydration', `Block ${block.id} - safeSetContent skipped (user-edited)`);
    return block;
  }
  
  // Only set fields that are currently empty
  const safeUpdates: Partial<ContentBlock> = {};
  
  if (updates.headline && isEmptyContent(block.headline)) {
    safeUpdates.headline = updates.headline;
    safeUpdates.title = updates.headline;
  }
  
  if (updates.body && isEmptyContent(block.body)) {
    safeUpdates.body = updates.body;
    safeUpdates.content = updates.body;
  }
  
  if (updates.imageUrl && !block.imageUrl) {
    safeUpdates.imageUrl = updates.imageUrl;
  }
  
  if (updates.backgroundImageUrl && !block.backgroundImageUrl) {
    safeUpdates.backgroundImageUrl = updates.backgroundImageUrl;
  }
  
  newsletterDebug.log('hydration', `Block ${block.id} - safeSetContent applied`, safeUpdates);
  
  return {
    ...block,
    ...safeUpdates,
  };
}

/**
 * Create a fresh block with proper initial status
 */
export function createEmptyBlock(type: ContentBlock['type'], id: string): ContentBlock {
  const block: ContentBlock = {
    id,
    type,
    source: 'manual',
    status: 'empty',
    visible: true,
    
    // Image control flags - defaults for new blocks
    autoImageMode: false,
    shouldFetchImage: false,
    isGeneratingImage: false,
    
    // Content lifecycle
    hasGeneratedContent: false,
    userEdited: false,
  };
  
  newsletterDebug.log('hydration', `Created empty block ${id} of type ${type}`);
  
  return block;
}

/**
 * Validate that a block has consistent state
 * Returns warnings if state is inconsistent
 */
export function validateBlockState(block: ContentBlock): string[] {
  const warnings: string[] = [];
  
  // Check for status vs flags mismatch
  if (block.status === 'user-edited' && !block.userEdited) {
    warnings.push(`Block ${block.id}: status is 'user-edited' but userEdited flag is false`);
  }
  
  if (block.status === 'ai-generated' && !block.hasGeneratedContent) {
    warnings.push(`Block ${block.id}: status is 'ai-generated' but hasGeneratedContent is false`);
  }
  
  // Check for image state inconsistencies
  if (block.isGeneratingImage && (block.imageUrl || block.backgroundImageUrl)) {
    warnings.push(`Block ${block.id}: isGeneratingImage is true but image URL exists`);
  }
  
  return warnings;
}
