import { supabase } from '@/integrations/supabase/client';

/**
 * Verify a single image exists in global_image_gallery with proper tags
 */
export const verifyImageInGallery = async (globalImageId: string) => {
  const { data: image, error: imageError } = await supabase
    .from('global_image_gallery')
    .select('id, storage_path, public_url, channel')
    .eq('id', globalImageId)
    .single();
  
  if (imageError || !image) {
    console.error('[Verify] ❌ Image not in gallery:', globalImageId);
    return { success: false, error: 'Image not found in gallery' };
  }
  
  const { data: tags, error: tagsError } = await supabase
    .from('global_image_tags')
    .select('tag_name, tag_category')
    .eq('image_id', globalImageId);
  
  if (tagsError || !tags || tags.length === 0) {
    console.warn('[Verify] ⚠️ No tags for image:', globalImageId);
  }
  
  console.log('[Verify] ✅ Image verified:', {
    id: image.id,
    path: image.storage_path,
    url: image.public_url,
    tagCount: tags?.length || 0
  });
  
  return { 
    success: true, 
    image, 
    tags: tags || [],
    tagCount: tags?.length || 0
  };
};

/**
 * Verify multiple images exist in global_image_gallery with tags
 */
export const verifyAllImagesInGallery = async (globalImageIds: string[]) => {
  const results = await Promise.all(
    globalImageIds.map(id => verifyImageInGallery(id))
  );
  
  const successCount = results.filter(r => r.success).length;
  const totalTags = results.reduce((sum, r) => sum + (r.tagCount || 0), 0);
  
  console.log('[Verify] Bulk verification:', {
    total: globalImageIds.length,
    successful: successCount,
    failed: globalImageIds.length - successCount,
    totalTags,
    avgTagsPerImage: successCount > 0 ? totalTags / successCount : 0
  });
  
  return {
    total: globalImageIds.length,
    successful: successCount,
    failed: globalImageIds.length - successCount,
    totalTags,
    avgTagsPerImage: successCount > 0 ? totalTags / successCount : 0
  };
};
