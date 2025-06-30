
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

// Build content-focused search query
const buildContentQuery = (draft: any): string => {
  const content = draft?.ai_output || draft?.prompt || '';
  const keywords = extractKeywords(content, 'gardening lifestyle');
  
  console.log('[IMAGE_GALLERY] Building query for content type:', draft?.post_type);
  console.log('[IMAGE_GALLERY] Extracted keywords:', keywords);

  // Add context based on post type if keywords are generic
  if (keywords === 'gardening lifestyle') {
    const fallbacks = {
      instagram: 'lifestyle photography',
      facebook: 'community engagement',
      newsletter: 'professional content',
      email: 'business communication',
      video: 'dynamic content'
    };
    
    const fallback = fallbacks[draft?.post_type] || 'professional photography';
    console.log('[IMAGE_GALLERY] Using fallback query:', fallback);
    return fallback;
  }

  console.log('[IMAGE_GALLERY] Final content-focused query:', keywords);
  return keywords;
};

// Curated fallback queries for when content analysis fails
const getRandomFallback = (postType: string): string => {
  const fallbacks = {
    instagram: [
      'lifestyle photography',
      'modern aesthetic',
      'clean minimal design',
      'natural lighting'
    ],
    facebook: [
      'community lifestyle',
      'social gathering',
      'friendly atmosphere',
      'engaging content'
    ],
    newsletter: [
      'professional business',
      'clean modern office',
      'business communication',
      'corporate lifestyle'
    ],
    email: [
      'professional communication',
      'business meeting',
      'office environment',
      'clean workspace'
    ],
    video: [
      'dynamic content',
      'engaging visuals',
      'motion graphics',
      'video production'
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

  const fetchImages = async (forceRefresh = false) => {
    if (!selectedDraft && !forceRefresh) return;

    setLoading(true);
    try {
      const query = selectedDraft 
        ? buildContentQuery(selectedDraft)
        : getRandomFallback('instagram');

      setLastQuery(query);
      console.log('[IMAGE_GALLERY] Fetching images with improved query:', query);

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
        console.error('[IMAGE_GALLERY] Error fetching images:', error);
        
        // Try a simpler, more generic query as fallback
        console.log('[IMAGE_GALLERY] Trying simpler fallback query...');
        const simpleQuery = getRandomFallback(selectedDraft?.post_type || 'instagram');
        const fallbackData = await supabase.functions.invoke('fetch-unsplash-images', {
          body: { 
            query: simpleQuery,
            maxImages: 4,
            orientation: 'squarish',
            orderBy: 'relevant',
            contentFilter: 'high'
          }
        });
        
        setImages(fallbackData?.data?.images || []);
        setLastQuery(simpleQuery);
        return;
      }

      setImages(data?.images || []);
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

  const handleUseInPost = async (image: UnsplashImage) => {
    if (!selectedDraft) {
      toast.error('No draft selected');
      return;
    }

    setAddingToPost(true);
    try {
      // Update the draft with the selected image
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
      
      // Trigger a refresh of the parent component if needed
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
            <p className="text-xs text-gray-500">Select a draft to see relevant images</p>
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
