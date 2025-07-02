import { supabase } from '@/integrations/supabase/client';

export interface ImageAsset {
  id: string;
  user_id: string;
  content_task_id?: string;
  original_url: string;
  processed_url?: string;
  thumbnail_url?: string;
  source_type: 'unsplash' | 'upload' | 'url' | 'generated';
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  dimensions?: { width: number; height: number };
  unsplash_id?: string;
  photographer_name?: string;
  photographer_url?: string;
  alt_text?: string;
  description?: string;
  tags?: string[];
  usage_count: number;
  last_used_at?: string;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  processing_error?: string;
  optimization_applied: boolean;
  original_size?: number;
  compressed_size?: number;
  compression_ratio?: number;
  created_at: string;
  updated_at: string;
}

export interface ImageMetadata {
  alt_text?: string;
  photographer?: string;
  photographer_url?: string;
  unsplash_id?: string;
  dimensions?: { width: number; height: number };
  source: 'unsplash' | 'upload' | 'url';
  file_size?: number;
  mime_type?: string;
}

export class ImageAssetManager {
  /**
   * Create a new image asset record
   */
  static async createImageAsset(data: {
    content_task_id?: string;
    original_url: string;
    processed_url?: string;
    source_type: 'unsplash' | 'upload' | 'url' | 'generated';
    file_name?: string;
    file_size?: number;
    mime_type?: string;
    dimensions?: { width: number; height: number };
    unsplash_id?: string;
    photographer_name?: string;
    photographer_url?: string;
    alt_text?: string;
    description?: string;
    tags?: string[];
  }): Promise<any | null> {
    try {
      const { data: asset, error } = await supabase
        .from('image_assets')
        .insert([{
          content_task_id: data.content_task_id || null,
          original_url: data.original_url,
          processed_url: data.processed_url || null,
          source_type: data.source_type,
          file_name: data.file_name || null,
          file_size: data.file_size || null,
          mime_type: data.mime_type || null,
          dimensions: data.dimensions || null,
          unsplash_id: data.unsplash_id || null,
          photographer_name: data.photographer_name || null,
          photographer_url: data.photographer_url || null,
          alt_text: data.alt_text || null,
          description: data.description || null,
          tags: data.tags || null
        }] as any)
        .select()
        .single();

      if (error) {
        console.error('Error creating image asset:', error);
        return null;
      }

      return asset;
    } catch (error) {
      console.error('Exception creating image asset:', error);
      return null;
    }
  }

  /**
   * Update content task with image information
   */
  static async updateContentTaskImage(
    content_task_id: string,
    image_url: string,
    source: 'unsplash' | 'upload' | 'url',
    metadata?: ImageMetadata
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('content_tasks')
        .update({
          image_url,
          image_source: source,
          image_metadata: metadata || {},
          // Keep legacy field for backward compatibility
          image_idea: image_url
        })
        .eq('id', content_task_id);

      if (error) {
        console.error('Error updating content task image:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Exception updating content task image:', error);
      return false;
    }
  }

  /**
   * Track image usage
   */
  static async incrementImageUsage(asset_id: string): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('increment_image_usage', {
        asset_id
      });

      if (error) {
        console.error('Error incrementing image usage:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Exception incrementing image usage:', error);
      return false;
    }
  }

  /**
   * Track image optimization
   */
  static async trackImageOptimization(
    asset_id: string,
    original_size: number,
    compressed_size: number
  ): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('track_image_optimization', {
        asset_id,
        original_size_bytes: original_size,
        compressed_size_bytes: compressed_size
      });

      if (error) {
        console.error('Error tracking image optimization:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Exception tracking image optimization:', error);
      return false;
    }
  }

  /**
   * Get user's image assets
   */
  static async getUserImageAssets(options?: {
    source_type?: 'unsplash' | 'upload' | 'url' | 'generated';
    content_task_id?: string;
    limit?: number;
  }): Promise<any[]> {
    try {
      let query = supabase
        .from('image_assets')
        .select('*')
        .order('created_at', { ascending: false });

      if (options?.source_type) {
        query = query.eq('source_type', options.source_type);
      }

      if (options?.content_task_id) {
        query = query.eq('content_task_id', options.content_task_id);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching image assets:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Exception fetching image assets:', error);
      return [];
    }
  }

  /**
   * Get image analytics
   */
  static async getImageAnalytics(): Promise<{
    source_type: string;
    total_images: number;
    total_usage: number;
    avg_usage_per_image: number;
    optimized_images: number;
    avg_compression_ratio: number;
    total_original_size: number;
    total_compressed_size: number;
  }[]> {
    try {
      const { data, error } = await supabase.rpc('get_user_image_analytics');

      if (error) {
        console.error('Error fetching image analytics:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Exception fetching image analytics:', error);
      return [];
    }
  }

  /**
   * Create image asset from Unsplash
   */
  static async createUnsplashAsset(
    content_task_id: string,
    unsplashImage: {
      url: string;
      thumb: string;
      alt: string;
      photographer?: string;
      unsplash_id?: string;
    }
  ): Promise<any | null> {
    const asset = await this.createImageAsset({
      content_task_id,
      original_url: unsplashImage.url,
      processed_url: unsplashImage.thumb,
      source_type: 'unsplash',
      unsplash_id: unsplashImage.unsplash_id,
      photographer_name: unsplashImage.photographer,
      alt_text: unsplashImage.alt,
      description: `Unsplash image: ${unsplashImage.alt}`
    });

    if (asset) {
      // Update the content task
      await this.updateContentTaskImage(
        content_task_id,
        unsplashImage.url,
        'unsplash',
        {
          alt_text: unsplashImage.alt,
          photographer: unsplashImage.photographer,
          unsplash_id: unsplashImage.unsplash_id,
          source: 'unsplash'
        }
      );
    }

    return asset;
  }

  /**
   * Create image asset from upload
   */
  static async createUploadAsset(
    content_task_id: string,
    file: File,
    uploadedUrl: string
  ): Promise<any | null> {
    // Get image dimensions
    const dimensions = await this.getImageDimensions(file);

    const asset = await this.createImageAsset({
      content_task_id,
      original_url: uploadedUrl,
      source_type: 'upload',
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      dimensions,
      alt_text: `Uploaded image: ${file.name}`,
      description: `User uploaded image: ${file.name}`
    });

    if (asset) {
      // Update the content task
      await this.updateContentTaskImage(
        content_task_id,
        uploadedUrl,
        'upload',
        {
          alt_text: `Uploaded image: ${file.name}`,
          source: 'upload',
          file_size: file.size,
          mime_type: file.type,
          dimensions
        }
      );
    }

    return asset;
  }

  /**
   * Get image dimensions from file
   */
  private static getImageDimensions(file: File): Promise<{ width: number; height: number } | undefined> {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) {
        resolve(undefined);
        return;
      }

      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => resolve(undefined);
      img.src = URL.createObjectURL(file);
    });
  }
}
