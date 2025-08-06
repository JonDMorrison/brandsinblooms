import { supabase } from '@/integrations/supabase/client'

interface ImageMeta {
  width: number
  height: number
  size: number
  format: string
  alt_text?: string
}

// Track image usage and optimization stats
export async function trackImageUsage(imageUrl: string, context: 'sms' | 'mms' | 'automation', userId: string) {
  try {
    const { error } = await supabase
      .from('image_assets')
      .upsert({
        user_id: userId,
        original_url: imageUrl,
        source_type: context,
        usage_count: 1,
        last_used_at: new Date().toISOString()
      }, {
        onConflict: 'original_url',
        ignoreDuplicates: false
      })

    if (error) {
      console.error('Failed to track image usage:', error)
    }
  } catch (error) {
    console.error('Error tracking image usage:', error)
  }
}

// Log optimization results for analytics
export async function logOptimization(
  originalSize: number,
  optimizedSize: number,
  format: string,
  imageUrl: string,
  userId: string
) {
  const compressionRatio = ((originalSize - optimizedSize) / originalSize) * 100

  try {
    const { error } = await supabase
      .from('image_assets')
      .update({
        optimization_applied: true,
        original_size: originalSize,
        compressed_size: optimizedSize,
        compression_ratio: compressionRatio,
        processing_status: 'completed'
      })
      .eq('original_url', imageUrl)

    if (error) {
      console.error('Failed to log optimization:', error)
    } else {
      console.log(`Image optimization logged: ${compressionRatio.toFixed(1)}% compression`)
    }
  } catch (error) {
    console.error('Error logging optimization:', error)
  }
}

// Cleanup old processed images
export async function cleanupOldImages(olderThanDays: number = 30) {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

  try {
    // Get old image paths from database
    const { data: oldImages, error: queryError } = await supabase
      .from('image_assets')
      .select('id, processed_url, original_url')
      .lt('created_at', cutoffDate.toISOString())
      .eq('processing_status', 'completed')

    if (queryError) throw queryError

    if (oldImages && oldImages.length > 0) {
      // Delete from storage
      const pathsToDelete = oldImages
        .map(img => img.processed_url)
        .filter(Boolean)
        .map(url => url.split('/').pop()) // Extract filename
        .filter(Boolean)

      if (pathsToDelete.length > 0) {
        const { error: deleteError } = await supabase.storage
          .from('media-mms')
          .remove(pathsToDelete)

        if (deleteError) {
          console.error('Failed to delete old images from storage:', deleteError)
        } else {
          console.log(`Cleaned up ${pathsToDelete.length} old processed images`)
        }
      }

      // Mark as cleaned up in database
      const { error: updateError } = await supabase
        .from('image_assets')
        .update({ processing_status: 'cleaned_up' })
        .in('id', oldImages.map(img => img.id))

      if (updateError) {
        console.error('Failed to update cleanup status:', updateError)
      }
    }
  } catch (error) {
    console.error('Error during image cleanup:', error)
  }
}