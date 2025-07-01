
import React, { useState, useEffect } from 'react';
import { ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import styles from './ImageGallery.module.css';
import { extractKeywords } from '@/utils/imageKeywords';
import { ImageGalleryHeader } from './ImageGalleryHeader';
import { ImageGalleryGrid } from './ImageGalleryGrid';
import { ImageModal } from './ImageModal';

interface ImageGalleryProps {
  selectedDraft: any;
}

interface UnsplashImage {
  id: string;
  thumb_url: string;
  download_url: string;
  alt: string;
  photographer: string;
}

// Build smart, contextual search query
const buildContextualQuery = (draft: any): string[] => {
  const content = draft?.ai_output || draft?.prompt || '';
  
  console.log('[IMAGE_GALLERY] ===== BUILDING CONTEXTUAL QUERY =====');
  console.log('[IMAGE_GALLERY] Draft content:', content?.substring(0, 200) + '...');
  console.log('[IMAGE_GALLERY] Post type:', draft?.post_type);
  
  const mainKeywords = extractKeywords(content, 'garden center plants nursery');
  console.log('[IMAGE_GALLERY] Main keywords extracted:', mainKeywords);

  const queries = [mainKeywords];
  
  // Build targeted fallback queries based on content analysis
  const contentLower = content.toLowerCase();
  
  // Specific vegetable queries
  if (/tomato/i.test(contentLower)) {
    queries.push('tomato plants garden summer growing');
    queries.push('healthy tomato plants vegetable garden');
  }
  
  if (/pepper/i.test(contentLower)) {
    queries.push('pepper plants vegetable garden growing');
    queries.push('bell pepper garden plants');
  }
  
  if (/cucumber|zucchini/i.test(contentLower)) {
    queries.push('cucumber zucchini summer vegetables');
    queries.push('summer squash vegetable garden');
  }
  
  // Seasonal and problem-specific queries
  if (/summer|heat|hot|wilting|stressed/i.test(contentLower)) {
    queries.push('summer vegetable garden heat management');
    queries.push('garden plants summer care watering');
  }
  
  // Care and maintenance queries
  if (/watering|water|irrigation|care/i.test(contentLower)) {
    queries.push('watering vegetables garden care');
    queries.push('garden irrigation vegetable plants');
  }
  
  // General category fallbacks
  if (/vegetable|vegetables/i.test(contentLower)) {
    queries.push('vegetable garden growing plants');
    queries.push('home vegetable garden summer');
  }
  
  // Post type specific queries
  if (draft?.post_type) {
    const typeSpecificQueries = {
      instagram: 'beautiful vegetable garden plants social',
      facebook: 'home garden vegetables community',
      newsletter: 'professional vegetable garden business',
      email: 'garden vegetables growing tips'
    };
    
    if (typeSpecificQueries[draft.post_type]) {
      queries.push(typeSpecificQueries[draft.post_type]);
    }
  }
  
  // Final fallbacks
  queries.push('garden center vegetable plants display');
  queries.push('nursery plants vegetable garden');
  queries.push('garden center plants flowers');
  
  console.log('[IMAGE_GALLERY] Built query hierarchy:', queries);
  console.log('[IMAGE_GALLERY] ===== END CONTEXTUAL QUERY BUILDING =====');
  
  return queries;
};

export const ImageGallery = ({ selectedDraft }: ImageGalleryProps) => {
  const [images, setImages] = useState<UnsplashImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<UnsplashImage | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [lastQuery, setLastQuery] = useState<string>('');
  const [addingToPost, setAddingToPost] = useState(false);

  const fetchImages = async (forceRefresh = false) => {
    if (!selectedDraft && !forceRefresh) return;

    setLoading(true);
    try {
      const queries = selectedDraft 
        ? buildContextualQuery(selectedDraft)
        : ['garden center plants nursery display'];

      console.log('[IMAGE_GALLERY] ===== SMART FETCHING IMAGES =====');
      
      let fetchedImages: UnsplashImage[] = [];
      let usedQuery = '';
      
      // Try each query until we get good results
      for (const query of queries) {
        console.log(`[IMAGE_GALLERY] Attempting query: "${query}"`);
        setLastQuery(query);

        try {
          const { data, error } = await supabase.functions.invoke('fetch-unsplash-images', {
            body: { 
              query,
              maxImages: 4,
              orientation: 'squarish',
              orderBy: 'relevant',
              contentFilter: 'high'
            }
          });

          if (error) {
            console.warn(`[IMAGE_GALLERY] Query "${query}" failed:`, error.message);
            continue;
          }

          const images = data?.images || [];
          console.log(`[IMAGE_GALLERY] Query "${query}" returned ${images.length} images`);

          if (images.length > 0) {
            fetchedImages = images;
            usedQuery = query;
            console.log(`[IMAGE_GALLERY] Success! Using query: "${usedQuery}"`);
            console.log(`[IMAGE_GALLERY] First image: ${images[0]?.alt}`);
            break;
          }
        } catch (error) {
          console.warn(`[IMAGE_GALLERY] Query "${query}" exception:`, error);
          continue;
        }
      }

      if (fetchedImages.length > 0) {
        setImages(fetchedImages);
        setLastQuery(usedQuery);
        console.log(`[IMAGE_GALLERY] Final result: ${fetchedImages.length} contextually relevant images`);
      } else {
        console.warn('[IMAGE_GALLERY] No images found from any query');
        setImages([]);
        setLastQuery('No results found');
      }
      
      console.log('[IMAGE_GALLERY] ===== END SMART FETCHING =====');
    } catch (error) {
      console.error('[IMAGE_GALLERY] Exception during smart fetch:', error);
      setImages([]);
      setLastQuery('Error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, [selectedDraft]);

  const handleImageClick = (image: UnsplashImage) => {
    setSelectedImage(image);
    setShowImageModal(true);
  };

  const handleUseInPost = async (image: UnsplashImage) => {
    if (!selectedDraft) {
      toast.error('No draft selected');
      return;
    }

    setAddingToPost(true);
    try {
      const { error } = await supabase
        .from('content_tasks')
        .update({ 
          attachments: {
            type: 'image',
            url: image.download_url,
            thumbnail: image.thumb_url,
            alt: image.alt,
            photographer: image.photographer,
            source: 'unsplash'
          }
        })
        .eq('id', selectedDraft.id);

      if (error) {
        throw error;
      }

      toast.success('Contextually relevant image added to post!');
      setShowImageModal(false);
      
      window.dispatchEvent(new CustomEvent('draft-updated'));
      
    } catch (error) {
      console.error('Error adding image to post:', error);
      toast.error('Failed to add image to post');
    } finally {
      setAddingToPost(false);
    }
  };

  return (
    <>
      <div className="bg-gradient-to-b from-[#68BEB9]/10 to-[#68BEB9]/5 rounded-lg p-4 h-full">
        <ImageGalleryHeader
          lastQuery={lastQuery}
          loading={loading}
          onRefresh={() => fetchImages(true)}
        />

        {!selectedDraft ? (
          <div className={styles.emptyState}>
            <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
            <p className="text-xs text-gray-500">Select a draft to see contextually relevant images</p>
          </div>
        ) : (
          <ImageGalleryGrid
            loading={loading}
            images={images}
            selectedImage={selectedImage}
            lastQuery={lastQuery}
            onImageClick={handleImageClick}
            onRetryFetch={() => fetchImages(true)}
          />
        )}
      </div>

      <ImageModal
        isOpen={showImageModal}
        onClose={() => setShowImageModal(false)}
        selectedImage={selectedImage}
        onUseInPost={handleUseInPost}
        addingToPost={addingToPost}
        selectedDraft={selectedDraft}
      />
    </>
  );
};
