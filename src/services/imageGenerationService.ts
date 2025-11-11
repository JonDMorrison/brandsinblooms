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
  imageId?: string;
  globalImageId?: string;  // Reference to global_image_gallery
  tags?: Array<{
    name: string;
    category: string;
    confidence: number;
  }>;
  metadata?: {
    facets?: FacetedKeywords;
    usedQuery?: string;
    usedFallback?: boolean;
    photographer?: string;
    photographerUrl?: string;
    tags?: any[];
  };
  validationWarnings?: string[];
}

export class ImageGenerationService {
  
  /**
   * Fetch optimized image for specific channel using Lovable AI
   */
  async fetchImageForChannel(request: ChannelImageRequest): Promise<ImageGenerationResult> {
    console.log(`🎨 Generating AI image for ${request.channel}:`, request.contentTitle || request.contentContext.substring(0, 50));
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-ai-image', {
        body: {
          contentContext: request.contentContext,
          contentTitle: request.contentTitle,
          channel: request.channel,
          uploadToStorage: true,
          userId: await this.getCurrentUserId()
        }
      });
      
      if (error) {
        console.error('❌ AI image generation error:', error);
        throw error;
      }
      
      console.log('✅ AI image generated successfully:', data.imageUrl);
      
      return {
        imageUrl: data.imageUrl,
        imageId: data.imageId,
        globalImageId: data.globalImageId,
        tags: data.metadata?.tags || [],
        metadata: {
          usedQuery: data.metadata?.prompt,
          photographer: 'AI Generated',
          photographerUrl: undefined,
          tags: data.metadata?.tags || []
        }
      };
    } catch (error) {
      console.error('❌ Error in fetchImageForChannel:', error);
      throw error;
    }
  }
  
  /**
   * Get current user ID from Supabase auth
   */
  private async getCurrentUserId(): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('No authenticated user found');
    }
    return user.id;
  }
  
}

// Export singleton instance
export const imageGenerationService = new ImageGenerationService();
