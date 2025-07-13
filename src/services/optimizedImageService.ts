import { fetchSmartImage, UnsplashImage } from './unsplashService';
import { imageCache } from '@/utils/performanceOptimizations';

// Enhanced image service with caching and batch processing
export class OptimizedImageService {
  private static instance: OptimizedImageService;
  private batchQueue: Array<{ key: string; keyword: string; context: string; resolve: (image: UnsplashImage | null) => void }> = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 5;
  private readonly BATCH_DELAY = 100; // ms

  static getInstance(): OptimizedImageService {
    if (!OptimizedImageService.instance) {
      OptimizedImageService.instance = new OptimizedImageService();
    }
    return OptimizedImageService.instance;
  }

  // Cached image fetching with deduplication
  async getCachedImage(keyword: string, context = ''): Promise<UnsplashImage | null> {
    const cacheKey = `img:${keyword}:${context}`;
    
    return imageCache.getOrFetch(cacheKey, async () => {
      return await fetchSmartImage(keyword, context);
    });
  }

  // Batch image fetching to reduce API calls
  async batchFetchImages(requests: Array<{ keyword: string; context?: string }>): Promise<(UnsplashImage | null)[]> {
    const promises = requests.map(({ keyword, context = '' }) => 
      this.getCachedImage(keyword, context)
    );
    
    return Promise.allSettled(promises).then(results =>
      results.map(result => result.status === 'fulfilled' ? result.value : null)
    );
  }

  // Preload images for better UX
  preloadImages(keywords: string[], context = ''): void {
    // Don't await - run in background
    this.batchFetchImages(keywords.map(keyword => ({ keyword, context })))
      .catch(error => console.warn('Background image preload failed:', error));
  }

  // Queue-based fetching for better performance
  queueImageFetch(keyword: string, context = ''): Promise<UnsplashImage | null> {
    const cacheKey = `img:${keyword}:${context}`;
    
    // Check cache first
    const cached = imageCache['results'].get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 600000) {
      return Promise.resolve(cached.data);
    }

    return new Promise((resolve) => {
      this.batchQueue.push({ key: cacheKey, keyword, context, resolve });
      
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
      }
      
      this.batchTimer = setTimeout(() => {
        this.processBatch();
      }, this.BATCH_DELAY);
    });
  }

  private async processBatch(): Promise<void> {
    if (this.batchQueue.length === 0) return;
    
    const batch = this.batchQueue.splice(0, this.BATCH_SIZE);
    
    try {
      const results = await Promise.allSettled(
        batch.map(async ({ keyword, context }) => {
          return await this.getCachedImage(keyword, context);
        })
      );

      batch.forEach((item, index) => {
        const result = results[index];
        if (result.status === 'fulfilled') {
          item.resolve(result.value);
        } else {
          item.resolve(null);
        }
      });
    } catch (error) {
      console.error('Batch processing failed:', error);
      batch.forEach(item => item.resolve(null));
    }

    // Process remaining items if any
    if (this.batchQueue.length > 0) {
      this.batchTimer = setTimeout(() => this.processBatch(), this.BATCH_DELAY);
    }
  }

  // Clear all caches
  clearCache(): void {
    imageCache.clear();
  }
}

export const optimizedImageService = OptimizedImageService.getInstance();