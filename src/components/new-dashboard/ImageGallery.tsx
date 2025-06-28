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

// Utility to get current season
const getSeason = (): string => {
  const month = new Date().getMonth() + 1; // 1-12
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'fall';
  return 'winter';
};

// Curated fallback queries for garden centre content
const gardenCentreFallbacks = [
  "native pollinator plants",
  "colourful summer annuals", 
  "container herb garden",
  "fall mums display",
  "winter houseplants care",
  "seasonal garden displays",
  "outdoor plant arrangements",
  "garden centre nursery plants"
];

// Sample function to pick random fallback
const sample = (array: string[]): string => {
  return array[Math.floor(Math.random() * array.length)];
};

export const ImageGallery = ({ selectedDraft }: ImageGalleryProps) => {
  const [images, setImages] = useState<UnsplashImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<UnsplashImage | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);

  // Enhanced keyword extraction with gardening context
  const extractKeywords = (content: string): string[] => {
    if (!content || content.trim().length === 0) {
      return [];
    }

    // Clean HTML and normalize content
    const cleanContent = content
      .replace(/<[^>]*>/g, ' ')
      .replace(/&[^;]+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    // Look for garden-specific themes
    const gardenThemes = {
      drought: /\b(drought|dry|water.?saving|xeriscaping)\b/gi,
      pollinator: /\b(pollinator|bee|butterfly|native|wildflower)\b/gi,
      herbs: /\b(herb|basil|rosemary|thyme|culinary|cooking)\b/gi,
      houseplants: /\b(houseplant|indoor|succulent|tropical|philodendron)\b/gi,
      seasonal: /\b(spring|summer|fall|autumn|winter|seasonal)\b/gi,
      flowers: /\b(flower|bloom|blossom|annual|perennial|bulb)\b/gi,
      vegetables: /\b(vegetable|tomato|pepper|garden|harvest)\b/gi,
      lawn: /\b(lawn|grass|turf|sod|fertilizer)\b/gi,
      trees: /\b(tree|shrub|evergreen|deciduous|maple|oak)\b/gi
    };

    // Find the most relevant theme
    let bestTheme = '';
    let maxMatches = 0;
    
    for (const [theme, regex] of Object.entries(gardenThemes)) {
      const matches = cleanContent.match(regex);
      if (matches && matches.length > maxMatches) {
        maxMatches = matches.length;
        bestTheme = theme;
      }
    }

    // Extract meaningful words based on theme or general content
    const words = cleanContent
      .split(/\s+/)
      .filter(word => 
        word.length > 3 && 
        !['your', 'this', 'that', 'they', 'them', 'their', 'here', 'there', 'when', 'what', 'where', 'how', 'why', 'who', 'will', 'have', 'been', 'with', 'from', 'about', 'into', 'through', 'during', 'before', 'after'].includes(word)
      )
      .slice(0, 5);

    return words;
  };

  // Build enhanced search query with season and garden context
  const buildSearchQuery = (draft: any): string => {
    const content = draft?.ai_output || draft?.prompt || '';
    const coreKeywords = extractKeywords(content);
    const season = getSeason();
    
    console.log('[IMAGE_GALLERY] Core keywords extracted:', coreKeywords);

    let baseQuery: string;
    
    if (coreKeywords.length >= 3) {
      baseQuery = coreKeywords.slice(0, 3).join(' ');
    } else {
      baseQuery = sample(gardenCentreFallbacks);
      console.log('[IMAGE_GALLERY] Using fallback query:', baseQuery);
    }

    const enhancedQuery = `${baseQuery} garden centre nursery ${season}`.trim();
    console.log('[IMAGE_GALLERY] Final enhanced query:', enhancedQuery);
    
    return enhancedQuery;
  };

  const fetchImages = async (forceRefresh = false) => {
    if (!selectedDraft && !forceRefresh) return;

    setLoading(true);
    try {
      const query = selectedDraft 
        ? buildSearchQuery(selectedDraft)
        : `garden centre plants ${getSeason()}`;

      console.log('[IMAGE_GALLERY] Fetching enhanced images for query:', query);

      const { data, error } = await supabase.functions.invoke('fetch-unsplash-images', {
        body: { 
          query,
          maxImages: 4,
          orientation: 'squarish',
          orderBy: 'popular',
          contentFilter: 'high'
        }
      });

      if (error) {
        console.error('[IMAGE_GALLERY] Error fetching images:', error);
        
        // Fallback to simpler query
        console.log('[IMAGE_GALLERY] Trying fallback query...');
        const fallbackData = await supabase.functions.invoke('fetch-unsplash-images', {
          body: { 
            query: 'garden flowers high quality',
            maxImages: 4,
            orientation: 'squarish',
            orderBy: 'popular',
            contentFilter: 'high'
          }
        });
        
        setImages(fallbackData?.data?.images || []);
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
