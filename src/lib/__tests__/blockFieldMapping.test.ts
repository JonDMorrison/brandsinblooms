/**
 * Integration Tests: Block Field Mapping Round-Trip
 * 
 * These tests verify that blocks survive save/load cycles correctly,
 * with proper field mapping between frontend ContentBlock and database storage.
 */

import { describe, it, expect } from 'vitest';
import { 
  normalizeBlockForSave, 
  normalizeBlockFromDatabase, 
  isHeaderBlock,
  DatabaseBlock 
} from '@/utils/blockFieldMapping';
import { ContentBlock } from '@/types/emailBuilder';

describe('Block Field Mapping - Round Trip', () => {
  
  describe('normalizeBlockForSave', () => {
    it('should save header block with backgroundImageUrl to image_url', () => {
      const headerBlock: ContentBlock = {
        id: 'header-1',
        type: 'header',
        headline: 'Welcome to Our Newsletter',
        body: 'Monthly updates and insights',
        backgroundImageUrl: 'https://example.com/header-bg.jpg',
        autoImageMode: false,
        source: 'ai',
        status: 'ai-generated',
      };

      const saved = normalizeBlockForSave(headerBlock, 0);

      expect(saved.block_type).toBe('header');
      expect(saved.image_url).toBe('https://example.com/header-bg.jpg');
      expect(saved.content.headline).toBe('Welcome to Our Newsletter');
      expect(saved.content.body).toBe('Monthly updates and insights');
      expect(saved.content.status).toBe('ai-generated');
      expect(saved.content.autoImageMode).toBe(false);
    });

    it('should save image-text block with imageUrl to image_url', () => {
      const imageTextBlock: ContentBlock = {
        id: 'block-2',
        type: 'image-text',
        headline: 'Featured Article',
        body: 'Lorem ipsum dolor sit amet',
        imageUrl: 'https://example.com/article.jpg',
        ctaText: 'Read More',
        ctaUrl: 'https://example.com/article',
        layout: 'image-left',
        source: 'manual',
        status: 'user-edited',
      };

      const saved = normalizeBlockForSave(imageTextBlock, 1);

      expect(saved.block_type).toBe('image-text');
      expect(saved.image_url).toBe('https://example.com/article.jpg');
      expect(saved.cta_text).toBe('Read More');
      expect(saved.cta_url).toBe('https://example.com/article');
      expect(saved.content.layout).toBe('image-left');
      expect(saved.content.status).toBe('user-edited');
      expect(saved.order_index).toBe(1);
    });

    it('should preserve null image when user deleted it', () => {
      const blockWithDeletedImage: ContentBlock = {
        id: 'block-3',
        type: 'image-text',
        headline: 'No Image Block',
        imageUrl: null, // Explicit null = user deleted
        source: 'manual',
      };

      const saved = normalizeBlockForSave(blockWithDeletedImage, 0);

      expect(saved.image_url).toBeNull();
    });

    it('should save CTA fields in both formats for compatibility', () => {
      const block: ContentBlock = {
        id: 'block-4',
        type: 'button',
        ctaText: 'Click Me',
        ctaUrl: 'https://example.com',
        source: 'manual',
      };

      const saved = normalizeBlockForSave(block, 0);

      // DB columns
      expect(saved.cta_text).toBe('Click Me');
      expect(saved.cta_url).toBe('https://example.com');
      
      // Content object (both formats)
      expect(saved.content.ctaText).toBe('Click Me');
      expect(saved.content.ctaUrl).toBe('https://example.com');
      expect(saved.content.buttonText).toBe('Click Me');
      expect(saved.content.buttonUrl).toBe('https://example.com');
    });
  });

  describe('normalizeBlockFromDatabase', () => {
    it('should load header block image_url into backgroundImageUrl', () => {
      const dbBlock: DatabaseBlock = {
        id: 'header-1',
        block_type: 'header',
        content: {
          headline: 'Welcome Back',
          body: 'Newsletter content',
          status: 'ai-generated',
        },
        image_url: 'https://example.com/header.jpg',
        order_index: 0,
        source: 'ai',
      };

      const loaded = normalizeBlockFromDatabase(dbBlock);

      expect(loaded.type).toBe('header');
      expect(loaded.backgroundImageUrl).toBe('https://example.com/header.jpg');
      expect(loaded.imageUrl).toBeUndefined(); // Header blocks don't use imageUrl
      expect(loaded.headline).toBe('Welcome Back');
      expect(loaded.status).toBe('ai-generated');
    });

    it('should load non-header block image_url into imageUrl', () => {
      const dbBlock: DatabaseBlock = {
        id: 'block-2',
        block_type: 'image-text',
        content: {
          headline: 'Article Title',
          body: 'Article body text',
          layout: 'image-left',
        },
        image_url: 'https://example.com/image.jpg',
        cta_text: 'Learn More',
        cta_url: 'https://example.com/learn',
        order_index: 1,
        source: 'manual',
      };

      const loaded = normalizeBlockFromDatabase(dbBlock);

      expect(loaded.type).toBe('image-text');
      expect(loaded.imageUrl).toBe('https://example.com/image.jpg');
      expect(loaded.backgroundImageUrl).toBeUndefined();
      expect(loaded.ctaText).toBe('Learn More');
      expect(loaded.ctaUrl).toBe('https://example.com/learn');
      expect(loaded.layout).toBe('image-left');
    });

    it('should set deterministic image behavior flags on load', () => {
      const dbBlock: DatabaseBlock = {
        id: 'block-3',
        block_type: 'image-text',
        content: {
          headline: 'Test',
          autoImageMode: true, // Was true before save
        },
        image_url: 'https://example.com/existing.jpg',
        order_index: 0,
      };

      const loaded = normalizeBlockFromDatabase(dbBlock);

      // Critical: Never auto-fetch on reload
      expect(loaded.shouldFetchImage).toBe(false);
      expect(loaded.isGeneratingImage).toBe(false);
      // autoImageMode is preserved from DB
      expect(loaded.autoImageMode).toBe(true);
    });

    it('should default autoImageMode to false for blocks without explicit setting', () => {
      const dbBlock: DatabaseBlock = {
        id: 'block-4',
        block_type: 'image-text',
        content: {
          headline: 'Legacy Block',
          // No autoImageMode set
        },
        order_index: 0,
      };

      const loaded = normalizeBlockFromDatabase(dbBlock);

      expect(loaded.autoImageMode).toBe(false);
    });
  });

  describe('Round-trip: save then load', () => {
    it('should preserve header block fields through save/load cycle', () => {
      const original: ContentBlock = {
        id: 'header-rt',
        type: 'header',
        headline: 'My Newsletter Header',
        body: 'Subtitle text here',
        backgroundImageUrl: 'https://example.com/bg.jpg',
        autoImageMode: false,
        status: 'ai-generated',
        hasGeneratedContent: true,
        source: 'ai',
      };

      // Save
      const saved = normalizeBlockForSave(original, 0);
      
      // Simulate DB record (add id back)
      const dbRecord: DatabaseBlock = {
        ...saved,
        id: original.id,
      };

      // Load
      const loaded = normalizeBlockFromDatabase(dbRecord);

      // Verify preservation
      expect(loaded.type).toBe(original.type);
      expect(loaded.headline).toBe(original.headline);
      expect(loaded.body).toBe(original.body);
      expect(loaded.backgroundImageUrl).toBe(original.backgroundImageUrl);
      expect(loaded.status).toBe(original.status);
      expect(loaded.hasGeneratedContent).toBe(original.hasGeneratedContent);
      expect(loaded.source).toBe(original.source);
    });

    it('should preserve image-text block fields through save/load cycle', () => {
      const original: ContentBlock = {
        id: 'content-rt',
        type: 'image-text',
        headline: 'Featured Content',
        body: 'This is the body text with detailed information.',
        imageUrl: 'https://example.com/feature.jpg',
        ctaText: 'Shop Now',
        ctaUrl: 'https://example.com/shop',
        layout: 'image-left',
        status: 'user-edited',
        userEdited: true,
        autoImageMode: false,
        source: 'manual',
      };

      // Save
      const saved = normalizeBlockForSave(original, 1);
      
      // Simulate DB record
      const dbRecord: DatabaseBlock = {
        ...saved,
        id: original.id,
      };

      // Load
      const loaded = normalizeBlockFromDatabase(dbRecord);

      // Verify preservation
      expect(loaded.type).toBe(original.type);
      expect(loaded.headline).toBe(original.headline);
      expect(loaded.body).toBe(original.body);
      expect(loaded.imageUrl).toBe(original.imageUrl);
      expect(loaded.ctaText).toBe(original.ctaText);
      expect(loaded.ctaUrl).toBe(original.ctaUrl);
      expect(loaded.layout).toBe(original.layout);
      expect(loaded.status).toBe(original.status);
      expect(loaded.userEdited).toBe(original.userEdited);
    });

    it('should preserve divider block through save/load cycle', () => {
      const original: ContentBlock = {
        id: 'divider-rt',
        type: 'divider',
        source: 'manual',
      };

      const saved = normalizeBlockForSave(original, 2);
      const dbRecord: DatabaseBlock = { ...saved, id: original.id };
      const loaded = normalizeBlockFromDatabase(dbRecord);

      expect(loaded.type).toBe('divider');
      expect(loaded.source).toBe('manual');
    });

    it('should handle multiple blocks in sequence', () => {
      const blocks: ContentBlock[] = [
        {
          id: 'block-1',
          type: 'header',
          headline: 'Header',
          backgroundImageUrl: 'https://example.com/h.jpg',
          source: 'ai',
        },
        {
          id: 'block-2',
          type: 'image-text',
          headline: 'Content 1',
          body: 'Body 1',
          imageUrl: 'https://example.com/1.jpg',
          ctaText: 'CTA 1',
          ctaUrl: 'https://example.com/1',
          layout: 'image-left',
          source: 'ai',
        },
        {
          id: 'block-3',
          type: 'image-text',
          headline: 'Content 2',
          body: 'Body 2',
          imageUrl: 'https://example.com/2.jpg',
          layout: 'image-right',
          source: 'manual',
        },
      ];

      // Save all
      const savedBlocks = blocks.map((b, i) => ({
        ...normalizeBlockForSave(b, i),
        id: b.id,
      }));

      // Load all
      const loadedBlocks = savedBlocks.map(normalizeBlockFromDatabase);

      // Verify each block preserved correctly
      expect(loadedBlocks).toHaveLength(3);
      expect(loadedBlocks[0].type).toBe('header');
      expect(loadedBlocks[0].backgroundImageUrl).toBe('https://example.com/h.jpg');
      
      expect(loadedBlocks[1].type).toBe('image-text');
      expect(loadedBlocks[1].imageUrl).toBe('https://example.com/1.jpg');
      expect(loadedBlocks[1].ctaText).toBe('CTA 1');
      
      expect(loadedBlocks[2].type).toBe('image-text');
      expect(loadedBlocks[2].imageUrl).toBe('https://example.com/2.jpg');
      expect(loadedBlocks[2].layout).toBe('image-right');
    });
  });

  describe('isHeaderBlock helper', () => {
    it('should identify header blocks', () => {
      expect(isHeaderBlock({ type: 'header' })).toBe(true);
      expect(isHeaderBlock({ type: 'newsletter-header' })).toBe(true);
      expect(isHeaderBlock({ block_type: 'header' })).toBe(true);
    });

    it('should not identify non-header blocks', () => {
      expect(isHeaderBlock({ type: 'image-text' })).toBe(false);
      expect(isHeaderBlock({ type: 'text' })).toBe(false);
      expect(isHeaderBlock({ type: 'button' })).toBe(false);
      expect(isHeaderBlock({ block_type: 'divider' })).toBe(false);
    });
  });
});
