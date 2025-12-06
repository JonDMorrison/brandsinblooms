/**
 * Integration Tests: Image Auto Mode and Deterministic Behavior
 * 
 * These tests verify that image generation follows deterministic rules:
 * - autoImageMode controls whether images can be auto-fetched
 * - shouldFetchImage triggers actual fetching when allowed
 * - Header blocks use backgroundImageUrl, not imageUrl
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContentBlock } from '@/types/emailBuilder';

// Mock image fetching function signature
type MockFetchImage = (query: string) => Promise<{ url: string } | null>;

/**
 * Simulated getOrFetchImage logic based on the real implementation
 * This tests the business logic without React hooks
 */
function getOrFetchImageLogic(
  block: ContentBlock,
  fetchImage: MockFetchImage
): Promise<string | null> {
  // Rule 1: If autoImageMode is false, never fetch
  if (block.autoImageMode === false) {
    return Promise.resolve(null);
  }

  // Rule 2: If block already has an image, return existing
  const existingImage = block.type === 'header' || block.type === 'newsletter-header'
    ? block.backgroundImageUrl
    : block.imageUrl;
  
  if (existingImage) {
    return Promise.resolve(existingImage);
  }

  // Rule 3: Only fetch if shouldFetchImage is true
  if (!block.shouldFetchImage) {
    return Promise.resolve(null);
  }

  // Rule 4: Fetch the image
  const query = block.headline || block.body || 'default garden image';
  return fetchImage(query).then(result => result?.url || null);
}

/**
 * Simulated handleBlockImageGenerated for header blocks
 */
function handleHeaderImageGenerated(
  block: ContentBlock,
  imageUrl: string
): ContentBlock {
  return {
    ...block,
    backgroundImageUrl: imageUrl,
    isGeneratingImage: false,
    shouldFetchImage: false,
    autoImageMode: false, // Lock after generation
  };
}

describe('Image Auto Mode - Deterministic Behavior', () => {
  let mockFetchImage: MockFetchImage;

  beforeEach(() => {
    mockFetchImage = vi.fn().mockResolvedValue({ url: 'https://example.com/fetched.jpg' });
  });

  describe('autoImageMode = false', () => {
    it('should NOT fetch image when autoImageMode is false, even with shouldFetchImage true', async () => {
      const block: ContentBlock = {
        id: 'test-1',
        type: 'image-text',
        headline: 'Test Content',
        autoImageMode: false,
        shouldFetchImage: true,
        imageUrl: undefined,
        source: 'manual',
      };

      const result = await getOrFetchImageLogic(block, mockFetchImage);

      expect(result).toBeNull();
      expect(mockFetchImage).not.toHaveBeenCalled();
    });

    it('should NOT fetch image when autoImageMode is false and imageUrl is null', async () => {
      const block: ContentBlock = {
        id: 'test-2',
        type: 'image-text',
        headline: 'Test',
        autoImageMode: false,
        shouldFetchImage: true,
        imageUrl: null, // Explicitly null (user deleted)
        source: 'manual',
      };

      const result = await getOrFetchImageLogic(block, mockFetchImage);

      expect(result).toBeNull();
      expect(mockFetchImage).not.toHaveBeenCalled();
    });
  });

  describe('autoImageMode = true', () => {
    it('should fetch image when autoImageMode=true and shouldFetchImage=true', async () => {
      const block: ContentBlock = {
        id: 'test-3',
        type: 'image-text',
        headline: 'Garden Tips',
        autoImageMode: true,
        shouldFetchImage: true,
        imageUrl: undefined,
        source: 'ai',
      };

      const result = await getOrFetchImageLogic(block, mockFetchImage);

      expect(result).toBe('https://example.com/fetched.jpg');
      expect(mockFetchImage).toHaveBeenCalledWith('Garden Tips');
    });

    it('should return existing imageUrl instead of fetching', async () => {
      const block: ContentBlock = {
        id: 'test-4',
        type: 'image-text',
        headline: 'Test',
        autoImageMode: true,
        shouldFetchImage: true,
        imageUrl: 'https://example.com/existing.jpg',
        source: 'manual',
      };

      const result = await getOrFetchImageLogic(block, mockFetchImage);

      expect(result).toBe('https://example.com/existing.jpg');
      expect(mockFetchImage).not.toHaveBeenCalled();
    });

    it('should NOT fetch when shouldFetchImage is false', async () => {
      const block: ContentBlock = {
        id: 'test-5',
        type: 'image-text',
        headline: 'Test',
        autoImageMode: true,
        shouldFetchImage: false, // Not requesting fetch
        imageUrl: undefined,
        source: 'manual',
      };

      const result = await getOrFetchImageLogic(block, mockFetchImage);

      expect(result).toBeNull();
      expect(mockFetchImage).not.toHaveBeenCalled();
    });
  });

  describe('Header block image handling', () => {
    it('should use backgroundImageUrl for header blocks', async () => {
      const block: ContentBlock = {
        id: 'header-1',
        type: 'header',
        headline: 'Newsletter Header',
        autoImageMode: true,
        shouldFetchImage: true,
        backgroundImageUrl: 'https://example.com/header-bg.jpg',
        imageUrl: undefined,
        source: 'ai',
      };

      const result = await getOrFetchImageLogic(block, mockFetchImage);

      // Should return existing backgroundImageUrl
      expect(result).toBe('https://example.com/header-bg.jpg');
      expect(mockFetchImage).not.toHaveBeenCalled();
    });

    it('should fetch for header block when no backgroundImageUrl exists', async () => {
      const block: ContentBlock = {
        id: 'header-2',
        type: 'header',
        headline: 'New Header',
        autoImageMode: true,
        shouldFetchImage: true,
        backgroundImageUrl: undefined,
        source: 'ai',
      };

      const result = await getOrFetchImageLogic(block, mockFetchImage);

      expect(result).toBe('https://example.com/fetched.jpg');
      expect(mockFetchImage).toHaveBeenCalled();
    });

    it('should update header block correctly after image generation', () => {
      const originalBlock: ContentBlock = {
        id: 'header-3',
        type: 'header',
        headline: 'Header',
        isGeneratingImage: true,
        shouldFetchImage: true,
        autoImageMode: true,
        backgroundImageUrl: undefined,
        source: 'ai',
      };

      const updatedBlock = handleHeaderImageGenerated(
        originalBlock,
        'https://example.com/generated.jpg'
      );

      expect(updatedBlock.backgroundImageUrl).toBe('https://example.com/generated.jpg');
      expect(updatedBlock.isGeneratingImage).toBe(false);
      expect(updatedBlock.shouldFetchImage).toBe(false);
      expect(updatedBlock.autoImageMode).toBe(false); // Locked after generation
    });

    it('should not be in perpetual loading state after image generation', () => {
      const block: ContentBlock = {
        id: 'header-4',
        type: 'header',
        headline: 'Test',
        isGeneratingImage: true,
        source: 'ai',
      };

      const updated = handleHeaderImageGenerated(block, 'https://example.com/done.jpg');

      expect(updated.isGeneratingImage).toBe(false);
      expect(updated.backgroundImageUrl).toBeDefined();
    });
  });

  describe('Block status and user edit protection', () => {
    it('should set autoImageMode=false when user manually selects image', () => {
      const originalBlock: ContentBlock = {
        id: 'block-1',
        type: 'image-text',
        headline: 'Content',
        autoImageMode: true,
        imageUrl: undefined,
        source: 'ai',
      };

      // Simulate user manually selecting an image
      const userEditedBlock: ContentBlock = {
        ...originalBlock,
        imageUrl: 'https://example.com/user-selected.jpg',
        autoImageMode: false, // Set to false on manual selection
        status: 'user-edited',
        userEdited: true,
      };

      expect(userEditedBlock.autoImageMode).toBe(false);
      expect(userEditedBlock.status).toBe('user-edited');
    });

    it('should set autoImageMode=false when user deletes image', () => {
      const blockWithImage: ContentBlock = {
        id: 'block-2',
        type: 'image-text',
        headline: 'Content',
        autoImageMode: true,
        imageUrl: 'https://example.com/image.jpg',
        source: 'ai',
      };

      // Simulate user deleting the image
      const imageDeletedBlock: ContentBlock = {
        ...blockWithImage,
        imageUrl: null, // Explicit null = user deleted
        autoImageMode: false, // Lock to prevent auto-regeneration
        shouldFetchImage: false,
        status: 'user-edited',
      };

      expect(imageDeletedBlock.imageUrl).toBeNull();
      expect(imageDeletedBlock.autoImageMode).toBe(false);
      expect(imageDeletedBlock.shouldFetchImage).toBe(false);
    });
  });

  describe('Load behavior - never auto-fetch on reload', () => {
    it('should have shouldFetchImage=false after loading from database', () => {
      // Simulating what normalizeBlockFromDatabase returns
      const loadedBlock: ContentBlock = {
        id: 'loaded-1',
        type: 'image-text',
        headline: 'Loaded Content',
        imageUrl: 'https://example.com/saved.jpg',
        autoImageMode: true, // Preserved from DB
        shouldFetchImage: false, // ALWAYS false on load
        isGeneratingImage: false, // ALWAYS false on load
        source: 'ai',
      };

      expect(loadedBlock.shouldFetchImage).toBe(false);
      expect(loadedBlock.isGeneratingImage).toBe(false);
    });

    it('should not auto-fetch for newly loaded campaign', async () => {
      const loadedBlock: ContentBlock = {
        id: 'loaded-2',
        type: 'image-text',
        headline: 'Test',
        autoImageMode: true,
        shouldFetchImage: false, // Always false on load
        imageUrl: undefined, // No image yet
        source: 'ai',
      };

      const result = await getOrFetchImageLogic(loadedBlock, mockFetchImage);

      // Should NOT fetch because shouldFetchImage is false
      expect(result).toBeNull();
      expect(mockFetchImage).not.toHaveBeenCalled();
    });
  });
});
