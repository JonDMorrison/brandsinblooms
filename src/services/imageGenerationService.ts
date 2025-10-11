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

export interface FacetedKeywords {
  theme: string;
  action?: string;
  setting?: string;
  season_time?: string;
  mood_style?: string;
  exclusions?: string[];
  variants: string[];
  channel: string;
}

export interface ImageGenerationResult {
  imageUrl: string;
  metadata?: {
    facets?: FacetedKeywords;
    usedQuery?: string;
    photographer?: string;
    photographerUrl?: string;
  };
  validationWarnings?: string[];
}

export class ImageGenerationService {
  
  /**
   * Fetch optimized image for specific channel using faceted keywords
   */
  async fetchImageForChannel(request: ChannelImageRequest): Promise<ImageGenerationResult> {
    console.log(`🎨 Fetching image for ${request.channel}:`, request.contentTitle || request.contentContext.substring(0, 50));
    
    try {
      // Step 1: Generate faceted keywords using AI
      const facetsData = await this.generateKeywords(request);
      
      // Check if keyword generation failed
      if (facetsData?.error) {
        throw new Error(facetsData.details || facetsData.message || 'Failed to generate keywords');
      }
      
      console.log('📝 Generated facets:', {
        theme: facetsData.theme,
        variants: facetsData.variants,
        channel: facetsData.channel
      });
      
      // Step 2: Fetch from Unsplash using variants
      const { data: imageData, error: imageError } = await supabase.functions.invoke('fetch-unsplash-images', {
        body: {
          query: facetsData.variants[0], // Primary query
          variants: facetsData.variants, // All variants to try
          maxImages: 8,
          orientation: 'squarish',
          orderBy: 'relevant',
          contentFilter: 'high'
        }
      });
      
      if (imageError) {
        console.error('❌ Unsplash error:', imageError);
        throw new Error(`Unsplash API error: ${imageError.message}`);
      }
      
      if (!imageData?.images || imageData.images.length === 0) {
        console.error('❌ No images returned from Unsplash');
        throw new Error('No images found for the given keywords');
      }
      
      // Images are already filtered and sorted by the edge function
      const bestMatch = imageData.images[0];
      
      console.log(`✅ Image fetched using query: "${imageData.query || facetsData.variants[0]}"`);
      console.log(`   Alt: ${bestMatch.alt?.substring(0, 60)}`);
      
      return {
        imageUrl: bestMatch.urls?.regular || bestMatch.download_url,
        metadata: {
          facets: facetsData,
          usedQuery: imageData.query,
          photographer: bestMatch.photographer,
          photographerUrl: bestMatch.photographer_url
        }
      };
      
    } catch (error) {
      console.error('❌ Error in fetchImageForChannel:', error);
      throw error;
    }
  }
  
  /**
   * Generate faceted keywords using OpenAI via edge function
   */
  private async generateKeywords(request: ChannelImageRequest): Promise<FacetedKeywords | any> {
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
        return {
          error: true,
          message: error.message || 'Failed to generate keywords',
          retryable: true
        };
      }

      // Check if data contains error from edge function (422 validation failure)
      if (data?.error) {
        console.error('Keyword generation failed:', data);
        return {
          error: true,
          message: data.error,
          details: data.details,
          retryable: data.retryable
        };
      }

      return data as FacetedKeywords;
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
   * DEPRECATED: These methods are no longer needed with faceted approach
   * Images are fetched and filtered by the edge function
   */
}

// Export singleton instance
export const imageGenerationService = new ImageGenerationService();
