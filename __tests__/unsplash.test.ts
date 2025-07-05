import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUnsplashImage, extractImageKeyword } from '../src/lib/api/unsplash';

// Mock the supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn()
    }
  }
}));

import { supabase } from '@/integrations/supabase/client';

describe('Unsplash API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUnsplashImage', () => {
    it('should return image data when API call succeeds', async () => {
      const mockImageData = {
        urls: {
          regular: 'https://images.unsplash.com/photo-123/regular.jpg',
          thumb: 'https://images.unsplash.com/photo-123/thumb.jpg',
          small: 'https://images.unsplash.com/photo-123/small.jpg'
        },
        alt_description: 'Beautiful garden flowers',
        user: {
          name: 'John Photographer'
        },
        id: 'unsplash-123'
      };

      (supabase.functions.invoke as any).mockResolvedValue({
        data: mockImageData,
        error: null
      });

      const result = await getUnsplashImage('garden flowers');

      expect(result).toEqual({
        url: 'https://images.unsplash.com/photo-123/regular.jpg',
        thumb: 'https://images.unsplash.com/photo-123/thumb.jpg',
        alt: 'Beautiful garden flowers',
        photographer: 'John Photographer',
        unsplash_id: 'unsplash-123',
        author_name: 'John Photographer',
        source: 'unsplash'
      });

      expect(supabase.functions.invoke).toHaveBeenCalledWith('get-unsplash-image', {
        body: { query: 'garden flowers' }
      });
    });

    it('should return null when API returns error', async () => {
      (supabase.functions.invoke as any).mockResolvedValue({
        data: null,
        error: { message: 'API Error' }
      });

      const result = await getUnsplashImage('invalid query');

      expect(result).toBeNull();
    });

    it('should return null when no image URLs are found', async () => {
      (supabase.functions.invoke as any).mockResolvedValue({
        data: { noUrls: true },
        error: null
      });

      const result = await getUnsplashImage('no results');

      expect(result).toBeNull();
    });

    it('should handle exceptions gracefully', async () => {
      (supabase.functions.invoke as any).mockRejectedValue(new Error('Network error'));

      const result = await getUnsplashImage('network fail');

      expect(result).toBeNull();
    });

    it('should use fallback thumb URL when thumb is not available', async () => {
      const mockImageData = {
        urls: {
          regular: 'https://images.unsplash.com/photo-123/regular.jpg',
          small: 'https://images.unsplash.com/photo-123/small.jpg'
          // No thumb URL
        },
        alt_description: 'Garden plants',
        user: { name: 'Jane Photographer' },
        id: 'unsplash-456'
      };

      (supabase.functions.invoke as any).mockResolvedValue({
        data: mockImageData,
        error: null
      });

      const result = await getUnsplashImage('plants');

      expect(result?.thumb).toBe('https://images.unsplash.com/photo-123/small.jpg');
    });
  });

  describe('extractImageKeyword', () => {
    it('should extract meaningful keywords from content', () => {
      const content = 'Looking to plant beautiful roses in your garden this spring';
      const result = extractImageKeyword(content);
      
      expect(result).toBe('looking plant beautiful');
    });

    it('should remove hashtags from content', () => {
      const content = 'Beautiful #garden #flowers #spring blooming everywhere';
      const result = extractImageKeyword(content);
      
      expect(result).toBe('beautiful blooming everywhere');
    });

    it('should filter out common words', () => {
      const content = 'The best plants are those that grow well in the garden';
      const result = extractImageKeyword(content);
      
      expect(result).toBe('best plants those');
    });

    it('should handle content with special characters', () => {
      const content = 'Amazing! Garden-flowers & beautiful plants (2024)';
      const result = extractImageKeyword(content);
      
      expect(result).toBe('amazing garden flowers');
    });

    it('should return fallback keywords for empty or meaningless content', () => {
      const content = 'the and or but';
      const result = extractImageKeyword(content);
      
      expect(result).toBe('garden plants flowers');
    });

    it('should handle empty content', () => {
      const content = '';
      const result = extractImageKeyword(content);
      
      expect(result).toBe('garden plants flowers');
    });

    it('should limit to 3 keywords maximum', () => {
      const content = 'gorgeous beautiful stunning amazing wonderful fantastic garden flowers plants roses tulips daffodils';
      const result = extractImageKeyword(content);
      
      const words = result.split(' ');
      expect(words.length).toBeLessThanOrEqual(3);
      expect(words).toEqual(['gorgeous', 'beautiful', 'stunning']);
    });

    it('should handle content with only short words', () => {
      const content = 'a an the is are it so do we go';
      const result = extractImageKeyword(content);
      
      expect(result).toBe('garden plants flowers');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete posting workflow', async () => {
      const mockImageData = {
        urls: {
          regular: 'https://images.unsplash.com/photo-garden/regular.jpg',
          thumb: 'https://images.unsplash.com/photo-garden/thumb.jpg'
        },
        alt_description: 'Spring garden blooms',
        user: { name: 'Garden Photographer' },
        id: 'spring-garden-123'
      };

      (supabase.functions.invoke as any).mockResolvedValue({
        data: mockImageData,
        error: null
      });

      const postContent = 'Check out these amazing spring flowers blooming in our garden! #spring #garden #flowers';
      const keyword = extractImageKeyword(postContent);
      const imageResult = await getUnsplashImage(keyword);

      expect(keyword).toBe('check amazing spring');
      expect(imageResult).toBeTruthy();
      expect(imageResult?.url).toBe('https://images.unsplash.com/photo-garden/regular.jpg');
      expect(imageResult?.source).toBe('unsplash');
    });
  });
});