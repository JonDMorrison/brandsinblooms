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
  fallbackKeywords?: string[];
  excludeImageIds?: string[]; // Images to exclude from selection
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
  imageId?: string; // Unsplash image ID for tracking
  metadata?: {
    facets?: FacetedKeywords;
    usedQuery?: string;
    usedFallback?: boolean;
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
    
    // Log excluded images if any
    if (request.excludeImageIds && request.excludeImageIds.length > 0) {
      console.log(`🚫 Excluding ${request.excludeImageIds.length} already-used images:`, request.excludeImageIds);
    }
    
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
          maxImages: 12, // Increased from 8 for better selection pool
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
        console.warn('⚠️ No images found with AI keywords, trying fallback keywords...');
        
        // Step 3: Try fallback keywords if available
        if (request.fallbackKeywords && request.fallbackKeywords.length > 0) {
          console.log('🔄 Attempting fallback keywords:', request.fallbackKeywords);
          
          for (const fallbackKeyword of request.fallbackKeywords) {
            console.log(`   Trying: "${fallbackKeyword}"`);
            const { data: fallbackData, error: fallbackError } = await supabase.functions.invoke('fetch-unsplash-images', {
              body: {
                query: fallbackKeyword,
                variants: [fallbackKeyword],
                maxImages: 12,
                orientation: 'squarish',
                orderBy: 'relevant',
                contentFilter: 'high'
              }
            });
            
            if (!fallbackError && fallbackData?.images && fallbackData.images.length > 0) {
              console.log(`✅ Found ${fallbackData.images.length} images using fallback: "${fallbackKeyword}"`);
              const bestMatch = fallbackData.images[0];
              
              return {
                imageUrl: bestMatch.urls?.regular || bestMatch.download_url,
                imageId: bestMatch.id,
                metadata: {
                  facets: facetsData,
                  usedQuery: fallbackKeyword,
                  usedFallback: true,
                  photographer: bestMatch.photographer,
                  photographerUrl: bestMatch.photographer_url
                }
              };
            }
          }
        }
        
        console.error('❌ No images returned from Unsplash (tried all fallbacks)');
        throw new Error('No images found for the given keywords or fallback keywords');
      }
      
      // Filter and select unique image
      const candidateImages = imageData.images || [];
      const excludedSet = new Set(request.excludeImageIds || []);
      
      console.log(`📸 Found ${candidateImages.length} candidate images`);
      console.log(`🔍 Searching for unique image (${excludedSet.size} already used)...`);
      
      // Try to find an unused image (up to 10 attempts)
      let selectedImage = null;
      let attemptCount = 0;
      const maxAttempts = Math.min(10, candidateImages.length);
      
      for (let i = 0; i < maxAttempts && i < candidateImages.length; i++) {
        const candidate = candidateImages[i];
        attemptCount++;
        
        if (!excludedSet.has(candidate.id)) {
          selectedImage = candidate;
          console.log(`✅ Found unique image on attempt ${attemptCount}: ${candidate.id}`);
          break;
        } else {
          console.log(`⏭️  Attempt ${attemptCount}: Image ${candidate.id} already used, trying next...`);
        }
      }
      
      // Fallback: If all images are duplicates, use the last candidate
      if (!selectedImage && candidateImages.length > 0) {
        selectedImage = candidateImages[candidateImages.length - 1];
        console.warn(`⚠️  All ${attemptCount} candidates were duplicates, using fallback image: ${selectedImage.id}`);
      }
      
      if (!selectedImage) {
        console.error('❌ No images available after filtering');
        throw new Error('No unique images found');
      }
      
      const bestMatch = selectedImage;
      
      console.log(`✅ Selected image: ${bestMatch.id}`);
      console.log(`   Alt: ${bestMatch.alt?.substring(0, 60)}`);
      
      return {
        imageUrl: bestMatch.urls?.regular || bestMatch.download_url,
        imageId: bestMatch.id,
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
