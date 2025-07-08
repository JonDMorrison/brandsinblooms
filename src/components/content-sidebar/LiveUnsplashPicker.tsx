import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CanvaButton } from '@/components/canva/CanvaButton';
import { CanvaEditor } from '@/components/canva/CanvaEditor';

interface UnsplashImage {
  id: string;
  thumb_url: string;
  download_url: string;
  full_url?: string;
  alt: string;
  photographer: string;
  photographer_url?: string;
  unsplash_id: string;
}

interface LiveUnsplashPickerProps {
  task: any;
  campaignTheme?: string;
}

const useDebouncedValue = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

export const LiveUnsplashPicker = ({ task, campaignTheme }: LiveUnsplashPickerProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [featuredImage, setFeaturedImage] = useState<UnsplashImage | null>(null);
  const [alternativeImages, setAlternativeImages] = useState<UnsplashImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showCanvaEditor, setShowCanvaEditor] = useState(false);
  const [selectedImageForCanva, setSelectedImageForCanva] = useState<UnsplashImage | null>(null);

  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);

  // Auto-search when debounced query changes (after user stops typing)
  useEffect(() => {
    if (debouncedSearchQuery.trim().length > 0) {
      handleSearch();
    }
  }, [debouncedSearchQuery]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    setHasSearched(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('fetch-unsplash-images', {
        body: { 
          query: searchQuery.trim(),
          maxImages: 4,
          orientation: 'landscape'
        }
      });

      if (error) {
        console.error('Unsplash API error:', error);
        toast.error("Couldn't fetch images—try again.");
        setFeaturedImage(null);
        setAlternativeImages([]);
        return;
      }

      if (data?.images && data.images.length > 0) {
        const images = data.images.slice(0, 4);
        setFeaturedImage(images[0]);
        setAlternativeImages(images.slice(1, 4));
      } else {
        setFeaturedImage(null);
        setAlternativeImages([]);
      }
    } catch (error) {
      console.error('Error fetching images:', error);
      toast.error("Couldn't fetch images—try again.");
      setFeaturedImage(null);
      setAlternativeImages([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      handleSearch();
    }
  };

  const handleImageSelect = (image: UnsplashImage) => {
    // Swap selected image to featured position
    if (featuredImage) {
      setAlternativeImages(prev => {
        const newAlternatives = [...prev];
        const featuredIndex = newAlternatives.findIndex(img => img.id === image.id);
        if (featuredIndex !== -1) {
          newAlternatives[featuredIndex] = featuredImage;
        }
        return newAlternatives;
      });
    }
    setFeaturedImage(image);
  };

  const handleCanvaDesign = () => {
    const imageToEdit = featuredImage;
    if (!imageToEdit) {
      toast.error('Please select an image first');
      return;
    }
    
    setSelectedImageForCanva(imageToEdit);
    setShowCanvaEditor(true);
  };

  const renderImageAttribution = (image: UnsplashImage) => (
    <p className="text-xs text-gray-500 mt-1">
      Photo by{' '}
      <a 
        href={image.photographer_url || `https://unsplash.com/@${image.photographer}`}
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-gray-700"
      >
        {image.photographer}
      </a>
      {' '}on{' '}
      <a 
        href="https://unsplash.com"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:text-gray-700"
      >
        Unsplash
      </a>
    </p>
  );

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg">Need an Image? We'll find you one.</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          {/* Search Form */}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              placeholder="Search Unsplash…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={loading || !searchQuery.trim()}>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </form>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-primary" />
                <p className="text-sm text-gray-600">Searching Unsplash...</p>
              </div>
            </div>
          )}

          {/* No Results State */}
          {hasSearched && !loading && !featuredImage && (
            <div className="text-center py-12">
              <p className="text-gray-600">
                No images found for '<span className="font-medium">{searchQuery}</span>'.
              </p>
            </div>
          )}

          {/* Images Display */}
          {!loading && featuredImage && (
            <div className="space-y-4">
              {/* Featured Image */}
              <div className="space-y-2">
                <h3 className="font-medium text-sm text-gray-700">Featured Image</h3>
                <div 
                  className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden cursor-pointer group"
                >
                  <img
                    src={featuredImage.thumb_url}
                    alt={featuredImage.alt}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                </div>
                {renderImageAttribution(featuredImage)}
              </div>

              {/* Alternative Images */}
              {alternativeImages.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-medium text-sm text-gray-700">Alternative Images</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {alternativeImages.map((image) => (
                      <div key={image.id} className="space-y-1">
                        <div 
                          className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer group"
                          onClick={() => handleImageSelect(image)}
                        >
                          <img
                            src={image.thumb_url}
                            alt={image.alt}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                        </div>
                        {renderImageAttribution(image)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Design in Canva Button */}
              <div className="pt-4">
                <CanvaButton
                  onClick={handleCanvaDesign}
                  size="lg"
                  variant="default"
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Canva Editor Modal */}
      {showCanvaEditor && selectedImageForCanva && (
        <CanvaEditor
          isOpen={showCanvaEditor}
          onClose={() => {
            setShowCanvaEditor(false);
            setSelectedImageForCanva(null);
          }}
          imageUrl={selectedImageForCanva.full_url || selectedImageForCanva.download_url}
          contentTaskId={task?.id || ''}
          onDesignComplete={(designUrl) => {
            console.log('Design completed:', designUrl);
            setShowCanvaEditor(false);
            setSelectedImageForCanva(null);
            toast.success('Design saved successfully!');
          }}
        />
      )}
    </>
  );
};