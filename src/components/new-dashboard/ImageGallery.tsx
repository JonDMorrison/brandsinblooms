
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

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

export const ImageGallery = ({ selectedDraft }: ImageGalleryProps) => {
  const [images, setImages] = useState<UnsplashImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<UnsplashImage | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);

  // Extract keywords from draft content
  const extractKeywords = (content: string, fallback = 'garden plants'): string => {
    if (!content || content.trim().length === 0) {
      return fallback;
    }

    // Simple keyword extraction - take first few meaningful words
    const words = content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 3);

    return words.length > 0 ? words.join(' ') : fallback;
  };

  const fetchImages = async (forceRefresh = false) => {
    if (!selectedDraft && !forceRefresh) return;

    setLoading(true);
    try {
      const query = selectedDraft 
        ? extractKeywords(selectedDraft.ai_output || selectedDraft.prompt || '')
        : 'garden plants';

      console.log('Fetching images for query:', query);

      const { data, error } = await supabase.functions.invoke('fetch-unsplash-images', {
        body: { 
          query,
          maxImages: 4
        }
      });

      if (error) {
        console.error('Error fetching images:', error);
        return;
      }

      setImages(data?.images || []);
    } catch (error) {
      console.error('Error fetching images:', error);
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

  return (
    <>
      <div className="bg-gradient-to-b from-[#68BEB9]/10 to-[#68BEB9]/5 rounded-lg p-4 h-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-[#3E5A6B]">Images</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchImages(true)}
            disabled={loading}
            className="h-6 w-6 p-0"
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
                <p className="text-xs text-gray-500">No images found</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fetchImages(true)}
                  className="mt-2 text-xs"
                >
                  Try again
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Image Modal */}
      <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Image Preview</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="space-y-4">
              <img
                src={selectedImage.download_url}
                alt={selectedImage.alt}
                className="w-full h-auto rounded-lg"
              />
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Photo by {selectedImage.photographer}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // TODO: Implement "use in post" functionality
                    console.log('Use image in post:', selectedImage);
                  }}
                >
                  Use in Post
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
