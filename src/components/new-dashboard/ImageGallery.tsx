import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

// Enhanced keyword extraction focused on actual content
const extractMeaningfulKeywords = (content: string): string[] => {
  if (!content || content.trim().length === 0) {
    return [];
  }

  console.log('[IMAGE_GALLERY] Analyzing content:', content.substring(0, 200));

  // Clean and normalize content
  const cleanContent = content
    .replace(/<[^>]*>/g, ' ')           // Remove HTML
    .replace(/&[^;]+;/g, ' ')          // Remove HTML entities
    .replace(/[^\w\s]/g, ' ')          // Remove punctuation but keep words
    .replace(/\s+/g, ' ')              // Normalize whitespace
    .trim()
    .toLowerCase();

  // Extract meaningful nouns and descriptive words
  const meaningfulWords = cleanContent
    .split(/\s+/)
    .filter(word => {
      // Filter out common words and keep meaningful terms
      const stopWords = [
        'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
        'from', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
        'between', 'among', 'throughout', 'alongside', 'within', 'without', 'toward',
        'your', 'our', 'their', 'this', 'that', 'these', 'those', 'here', 'there',
        'when', 'where', 'why', 'how', 'what', 'who', 'which', 'will', 'would', 'could',
        'should', 'have', 'has', 'had', 'been', 'being', 'are', 'is', 'was', 'were',
        'can', 'may', 'might', 'must', 'shall', 'need', 'want', 'like', 'make', 'get',
        'take', 'come', 'go', 'see', 'know', 'think', 'say', 'tell', 'ask', 'give',
        'find', 'feel', 'seem', 'look', 'turn', 'keep', 'put', 'set', 'become', 'made'
      ];
      
      return word.length > 2 && !stopWords.includes(word) && !/^\d+$/.test(word);
    })
    .slice(0, 8); // Get top 8 meaningful words

  console.log('[IMAGE_GALLERY] Extracted meaningful keywords:', meaningfulWords);
  return meaningfulWords;
};

// Build content-focused search query
const buildContentQuery = (draft: any): string => {
  const content = draft?.ai_output || draft?.prompt || '';
  const keywords = extractMeaningfulKeywords(content);
  
  console.log('[IMAGE_GALLERY] Building query for content type:', draft?.post_type);

  if (keywords.length === 0) {
    // Fallback based on post type and context
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

  // Use top 2-3 most relevant keywords
  let query = keywords.slice(0, 3).join(' ');
  
  // Add context based on the primary keyword theme
  const primaryKeyword = keywords[0];
  
  // Only add contextual terms if they enhance the search
  if (/plant|flower|garden|grow|bloom|seed|soil/.test(keywords.join(' '))) {
    query += ' gardening';
  } else if (/food|recipe|cook|eat|ingredient/.test(keywords.join(' '))) {
    query += ' food photography';
  } else if (/business|professional|work|office/.test(keywords.join(' '))) {
    query += ' professional';
  } else if (/home|house|interior|decor/.test(keywords.join(' '))) {
    query += ' home lifestyle';
  } else if (/outdoor|nature|landscape/.test(keywords.join(' '))) {
    query += ' outdoor';
  }

  console.log('[IMAGE_GALLERY] Final content-focused query:', query);
  return query;
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
          orderBy: 'relevant', // Changed from 'popular' to 'relevant'
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
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-[#3E5A6B]">Images</h3>
            {lastQuery && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                "{lastQuery}"
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchImages(true)}
            disabled={loading}
            className="h-6 w-6 p-0"
            title="Get different images"
          >
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
          </Button>
        </div>

        {!selectedDraft ? (
          <div className="flex flex-col items-center justify-center h-[160px] text-center">
            <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
            <p className="text-xs text-gray-500">Select a draft to see relevant images</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3 h-[160px]">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="bg-gray-200 rounded-lg animate-pulse flex items-center justify-center h-full">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                </div>
              ))
            ) : images.length > 0 ? (
              images.map((image) => (
                <div
                  key={image.id}
                  className="relative cursor-pointer group rounded-lg overflow-hidden bg-gray-100 h-full"
                  onClick={() => handleImageClick(image)}
                >
                  <img
                    src={image.thumb_url}
                    alt={image.alt}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200 flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-6 h-6 bg-white/80 rounded-full flex items-center justify-center">
                        <ImageIcon className="w-3 h-3 text-gray-700" />
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-4 flex flex-col items-center justify-center text-center h-full">
                <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
                <p className="text-xs text-gray-500 mb-1">No images found for "{lastQuery}"</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchImages(true)}
                  className="mt-2 text-xs"
                >
                  Try different search
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Image Modal */}
      <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Image Preview</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              {/* Image Container */}
              <div className="relative mb-4">
                <img
                  src={selectedImage.download_url}
                  alt={selectedImage.alt}
                  className="w-full max-h-[50vh] object-contain rounded-lg"
                />
                {/* Photo credit overlay */}
                <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                  Photo by {selectedImage.photographer}
                </div>
              </div>
              
              {/* Use in Post Button */}
              <div className="flex justify-center pt-2 border-t border-gray-100">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleUseInPost(selectedImage)}
                  disabled={addingToPost || !selectedDraft}
                  className="bg-[#68BEB9] hover:bg-[#5AA8A3] shadow-md px-6"
                >
                  {addingToPost ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'Use in Post'
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
