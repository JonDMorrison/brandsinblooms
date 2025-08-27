/**
 * Centralized CTA field normalization utility
 * Ensures consistent CTA rendering across all components
 */

import { ContentBlock } from '@/types/emailBuilder';

/**
 * Normalize CTA fields to ensure both ctaText/ctaUrl and buttonText/buttonUrl are consistently set
 */
export const normalizeCTAFields = (block: Partial<ContentBlock>): Partial<ContentBlock> => {
  const ctaText = block.ctaText || block.buttonText || '';
  const ctaUrl = block.ctaUrl || block.buttonUrl || '';
  
  return {
    ...block,
    // Ensure both field sets are populated
    ctaText,
    ctaUrl,
    buttonText: ctaText,
    buttonUrl: ctaUrl
  };
};

/**
 * Check if block has valid CTA content
 */
export const hasValidCTA = (block: Partial<ContentBlock>): boolean => {
  return !!(block.ctaText || block.buttonText || block.ctaUrl || block.buttonUrl);
};

/**
 * Get CTA text with fallback
 */
export const getCTAText = (block: Partial<ContentBlock>): string => {
  return block.ctaText || block.buttonText || 'Learn More';
};

/**
 * Get CTA URL with fallback
 */
export const getCTAUrl = (block: Partial<ContentBlock>): string => {
  return block.ctaUrl || block.buttonUrl || '';
};

/**
 * Normalize headline/title fields for consistency
 */
export const normalizeHeadlineFields = (block: Partial<ContentBlock>): Partial<ContentBlock> => {
  const headline = block.headline || block.title || block.heading || '';
  const body = block.body || block.content || '';
  
  return {
    ...block,
    headline,
    title: headline,
    heading: headline,
    body,
    content: body
  };
};

/**
 * Full block normalization combining CTA and headline normalization
 */
export const normalizeBlock = (block: Partial<ContentBlock>): Partial<ContentBlock> => {
  return normalizeHeadlineFields(normalizeCTAFields(block));
};