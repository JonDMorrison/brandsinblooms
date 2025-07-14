import React, { useState, useEffect } from 'react';
import { ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
// Removed sonner import - using global toast replacement
import styles from './ImageGallery.module.css';
import { extractKeywords } from '@/utils/imageKeywords';
import { ImageGalleryHeader } from './ImageGalleryHeader';
import { ImageGalleryGrid } from './ImageGalleryGrid';
import { ImageModal } from './ImageModal';
import { extractDynamicQuery, getEnhancedTopicForPostType } from '@/utils/dynamicImageSearch';
import { CanvaEditor } from '@/components/canva/CanvaEditor';

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

// Build dynamic content-focused search query using new utility
const buildContentQuery = (draft: any): string => {
  console.log('[IMAGE_GALLERY] ===== BUILDING DYNAMIC QUERY =====');
  console.log('[IMAGE_GALLERY] Draft content:', draft?.ai_output?.substring(0, 200) + '...');
  console.log('[IMAGE_GALLERY] Post type:', draft?.post_type);
  
  // Use the new dynamic query extraction
  const dynamicQuery = getEnhancedTopicForPostType(draft, draft?.campaigns);
  
  console.log('[IMAGE_GALLERY] Dynamic query result:', dynamicQuery);
  console.log('[IMAGE_GALLERY] ===== END BUILDING =====');
  
  return dynamicQuery;
};

// Curated garden center specific fallback queries
const getGardenCenterFallback = (postType: string): string => {
  const fallbacks = {
    instagram: [
      'beautiful garden center plants',
      'colorful flowers nursery display',
      'gardening tools equipment',
      'plant care gardening tips'
    ],
    facebook: [
      'garden center community plants',
      'happy customers gardening',
      'seasonal plants nursery',
      'garden center staff helping'
    ],
    newsletter: [
      'professional garden center business',
      'plant nursery greenhouse',
      'gardening expertise advice',
      'garden center landscape'
    ],
    email: [
      'garden center plants care',
      'nursery plant selection',
      'gardening tips advice',
      'seasonal plant care'
    ],
    video: [
      'garden center demonstration',
      'plant care tutorial',
      'gardening how to',
      'nursery plant care'
    ]
  };

  const typeSpecificFallbacks = fallbacks[postType] || fallbacks.instagram;
  return typeSpecificFallbacks[Math.floor(Math.random() * typeSpecificFallbacks.length)];
};

export const ImageGallery = ({ selectedDraft }: ImageGalleryProps) => {
  const [images, setImages] = useState<UnsplashImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<UnsplashImage | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [lastQuery, setLastQuery] = useState<string>('');
  const [addingToPost, setAddingToPost] = useState(false);
  const [canvaEditor, setCanvaEditor] = useState<{
    isOpen: boolean;
    imageUrl: string;
    imageId: string;
  }>({
    isOpen: false,
    imageUrl: '',
    imageId: ''
  });

  const fetchImages = async (forceRefresh = false) => {
    if (!selectedDraft && !forceRefresh) return;

    setLoading(true);
    try {
      const query = selectedDraft 
        ? buildContentQuery(selectedDraft)
        : getGardenCenterFallback('instagram');

      setLastQuery(query);
      console.log('[IMAGE_GALLERY] ===== FETCHING IMAGES =====');
      console.log('[IMAGE_GALLERY] Using final query:', query);

      const { data, error } = await supabase.functions.invoke('fetch-unsplash-images', {
        body: { 
          query: query,
          maxImages: 4,
          orientation: 'squarish',
          orderBy: 'relevant',
          contentFilter: 'high'
        }
      });

      console.log('[IMAGE_GALLERY] Unsplash API response:', { data, error });

      if (error) {
        console.log('[IMAGE_GALLERY] Unsplash API error, using garden center fallback:', error.message);
        
        // Try a more specific garden center query as fallback
        console.log('[IMAGE_GALLERY] Trying garden center specific fallback query...');
        const gardenCenterQuery = `${query} garden center`;
        console.log('[IMAGE_GALLERY] Fallback query:', gardenCenterQuery);
        
        const fallbackData = await supabase.functions.invoke('fetch-unsplash-images', {
          body: { 
            query: gardenCenterQuery,
            maxImages: 4,
            orientation: 'squarish',
            orderBy: 'relevant',
            contentFilter: 'high'
          }
        });
        
        setImages(fallbackData?.data?.images || []);
        setLastQuery(gardenCenterQuery);
        console.log('[IMAGE_GALLERY] Fallback images:', fallbackData?.data?.images?.length || 0);
        return;
      }

      const fetchedImages = data?.images || [];
      console.log('[IMAGE_GALLERY] Successfully fetched images:', fetchedImages.length);
      console.log('[IMAGE_GALLERY] First image alt text:', fetchedImages[0]?.alt);
      console.log('[IMAGE_GALLERY] ===== END FETCHING =====');
      
      setImages(fetchedImages);
    } catch (error) {
      console.error('[IMAGE_GALLERY] Exception fetching images:', error);
      setImages([]);
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

  const handleCanvaEdit = (image: UnsplashImage) => {
    setCanvaEditor({
      isOpen: true,
      imageUrl: image.download_url,
      imageId: image.id
    });
  };

  const handleCanvaComplete = (newImageUrl: string) => {
    // Update the image in our local state
    const updatedImages = images.map(img => 
      img.id === canvaEditor.imageId 
        ? { ...img, download_url: newImageUrl, thumb_url: newImageUrl }
        : img
    );
    setImages(updatedImages);
    
    // Close the editor
    setCanvaEditor({ isOpen: false, imageUrl: '', imageId: '' });

    // If we have a selected draft, trigger content update
    if (selectedDraft) {
      window.dispatchEvent(new CustomEvent('draft-updated'));
    }
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
          attachments: [
            {
              type: 'image',
              url: image.download_url,
              thumbnail: image.thumb_url,
              alt: image.alt,
              photographer: image.photographer,
              source: 'unsplash'
            }
          ]
        })
        .eq('id', selectedDraft.id);

      if (error) {
        throw error;
      }

      toast.success('Image added to post successfully!');
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
            <p className="text-xs text-gray-500">Select a draft to see relevant garden center images</p>
          </div>
        ) : (
          <ImageGalleryGrid
            loading={loading}
            images={images}
            selectedImage={selectedImage}
            lastQuery={lastQuery}
            onImageClick={handleImageClick}
            onRetryFetch={() => fetchImages(true)}
            onCanvaEdit={handleCanvaEdit}
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

      {/* Canva Editor Modal */}
      {canvaEditor.isOpen && selectedDraft && (
        <CanvaEditor
          isOpen={canvaEditor.isOpen}
          onClose={() => setCanvaEditor({ isOpen: false, imageUrl: '', imageId: '' })}
          imageUrl={canvaEditor.imageUrl}
          contentTaskId={selectedDraft.id}
          titleText={lastQuery}
          onDesignComplete={handleCanvaComplete}
        />
      )}
    </>
  );
};
