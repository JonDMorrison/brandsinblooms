/**
 * Image Generation Service
 * Centralized service for fetching channel-specific, validated garden images
 */

import { supabase } from "@/integrations/supabase/client";

export interface ChannelImageRequest {
  channel: 'facebook' | 'instagram' | 'blog' | 'newsletter' | 'video';
  contentContext: string;
  contentTitle?: string;
  useAIKeywords?: boolean;
}

export interface ImageGenerationResult {
  imageUrl: string;
  metadata?: any;
  validationScore?: number;
  keywordsUsed?: string[];
  fallbackUsed?: boolean;
}

export class ImageGenerationService {
  
  /**
   * Fetch optimized image for specific channel
   */
  async fetchImageForChannel(request: ChannelImageRequest): Promise<ImageGenerationResult> {
    console.log(`🎨 Fetching image for ${request.channel}:`, request.contentTitle || request.contentContext.substring(0, 50));
    
    try {
      // Step 1: Generate channel-specific keywords
      const keywordData = await this.generateKeywords(request);
      
      console.log('📝 Generated keywords:', {
        keywords: keywordData.keywords,
        primaryQuery: keywordData.primaryQuery,
        validationScore: keywordData.validationScore
      });
      
      // Step 2: Use primary query for Unsplash search
      const query = keywordData.primaryQuery || keywordData.keywords.join(' ');
      
      // Step 3: Fetch from Unsplash
      const image = await this.fetchFromUnsplash(query);
      
      if (!image) {
        // Retry with fallback if primary fails
        console.warn('⚠️ Primary query failed, trying fallback...');
        const fallbackQuery = this.getChannelFallback(request.channel, request.contentTitle);
        const fallbackImage = await this.fetchFromUnsplash(fallbackQuery);
        
        if (fallbackImage) {
          return {
            imageUrl: fallbackImage.download_url || fallbackImage.urls?.regular,
            metadata: fallbackImage,
            fallbackUsed: true,
            keywordsUsed: fallbackQuery.split(' ')
          };
        }
        
        throw new Error('Failed to fetch image from Unsplash');
      }
      
      // Step 4: Validate image relevance
      const relevanceScore = this.validateImageRelevance(image, keywordData.keywords);
      
      console.log(`✅ Image fetched (relevance: ${relevanceScore}%):`, image.alt_description?.substring(0, 60));
      
      return {
        imageUrl: image.download_url || image.urls?.regular,
        metadata: image,
        validationScore: keywordData.validationScore,
        keywordsUsed: keywordData.keywords,
        fallbackUsed: false
      };
      
    } catch (error) {
      console.error('❌ Error in fetchImageForChannel:', error);
      
      // Final fallback: use generic garden query
      const fallbackQuery = this.getChannelFallback(request.channel);
      const fallbackImage = await this.fetchFromUnsplash(fallbackQuery);
      
      if (fallbackImage) {
        return {
          imageUrl: fallbackImage.download_url || fallbackImage.urls?.regular,
          metadata: fallbackImage,
          fallbackUsed: true,
          keywordsUsed: fallbackQuery.split(' ')
        };
      }
      
      throw error;
    }
  }
  
  /**
   * Generate channel-specific keywords using AI
   */
  private async generateKeywords(request: ChannelImageRequest): Promise<any> {
    try {
      const { data, error } = await supabase.functions.invoke('generate-image-keywords', {
        body: {
          prompt: request.contentContext,
          channel: request.channel,
          useAI: request.useAIKeywords ?? true
        }
      });
      
      if (error) {
        console.error('Keyword generation error:', error);
        // Return error details for upstream handling
        return {
          error: true,
          message: error.message || 'Failed to generate keywords',
          retryable: true
        };
      }

      // Check if data contains error from edge function (422 validation failure)
      if (data?.error) {
        console.error('Keyword validation failed:', data);
        return {
          error: true,
          message: data.error,
          details: data.details,
          suggestions: data.suggestions,
          score: data.score,
          retryable: data.retryable
        };
      }

      return data;
    } catch (error) {
      console.error('Exception in generateKeywords:', error);
      return {
        error: true,
        message: 'Unexpected error generating keywords',
        retryable: true
      };
    }
  }
  
  /**
   * Fetch image from Unsplash using query
   */
  private async fetchFromUnsplash(query: string): Promise<any> {
    try {
      const { data, error } = await supabase.functions.invoke('fetch-unsplash-images', {
        body: {
          query,
          maxImages: 1,
          orientation: 'squarish',
          orderBy: 'relevant',
          contentFilter: 'high'
        }
      });
      
      if (error || !data?.images || data.images.length === 0) {
        console.error('Unsplash fetch error:', error);
        return null;
      }
      
      return data.images[0];
    } catch (error) {
      console.error('Failed to fetch from Unsplash:', error);
      return null;
    }
  }
  
  /**
   * Validate image relevance to keywords
   */
  private validateImageRelevance(image: any, keywords: string[]): number {
    const altText = image.alt_description?.toLowerCase() || '';
    const description = image.description?.toLowerCase() || '';
    const searchText = `${altText} ${description}`;
    
    // Check for garden terms
    const gardenTerms = ['garden', 'plant', 'flower', 'nursery', 'greenhouse', 'leaf', 'bloom', 'botanical'];
    const hasGardenTerm = gardenTerms.some(term => searchText.includes(term));
    
    if (!hasGardenTerm) {
      console.warn('⚠️ Image may not be garden-related:', altText.substring(0, 60));
    }
    
    // Check for keyword matches
    const matchCount = keywords.filter(kw => 
      searchText.includes(kw.toLowerCase())
    ).length;
    
    const relevanceScore = Math.round((matchCount / keywords.length) * 100);
    
    return relevanceScore;
  }
  
  /**
   * Get channel-specific fallback query
   */
  private getChannelFallback(channel: string, title?: string): string {
    const fallbacks: Record<string, string> = {
      facebook: 'customers browsing seasonal plants garden center greenhouse',
      instagram: 'colorful flowering plants nursery display pots close',
      blog: 'hands planting seedlings soil garden trowel technique',
      newsletter: 'seasonal garden center plant inventory greenhouse display',
      video: 'demonstrating plant care garden center customer tutorial'
    };
    
    return fallbacks[channel] || 'garden center plants seasonal display';
  }
}

// Export singleton instance
export const imageGenerationService = new ImageGenerationService();
