import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Loader2, Image as ImageIcon, Palette, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CanvaEditor } from '@/components/canva/CanvaEditor';
import { extractKeywords } from '@/utils/imageKeywords';
import { getEnhancedTopicForPostType } from '@/utils/dynamicImageSearch';

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

interface EnhancedImageSelectorProps {
  task: any;
  onImageSelected: (image: UnsplashImage) => void;
  selectedImage?: UnsplashImage | null;
}

export const EnhancedImageSelector = ({ task, onImageSelected, selectedImage }: EnhancedImageSelectorProps) => {
  const [images, setImages] = useState<UnsplashImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [showCanvaEditor, setShowCanvaEditor] = useState(false);
  const [canvaImageUrl, setCanvaImageUrl] = useState('');
  const [addingToPost, setAddingToPost] = useState(false);

  // Auto-generate search query from task content
  const generateSmartQuery = (task: any): string => {
    if (!task?.ai_output) return 'garden center plants';
    
    const enhancedQuery = getEnhancedTopicForPostType(task, task?.campaigns);
    return enhancedQuery || 'garden center plants';
  };

  // Fetch images from Unsplash
  const fetchImages = async (query?: string) => {
    setLoading(true);
    const searchTerm = query || generateSmartQuery(task);
    
    try {
      const { data, error } = await supabase.functions.invoke('fetch-unsplash-images', {
        body: { 
          query: searchTerm,
          maxImages: 4,
          orientation: 'squarish',
          orderBy: 'relevant',
          contentFilter: 'high'
        }
      });

      if (error) {
        console.error('Unsplash API error:', error);
        toast.error("Couldn't fetch images—try again.");
        return;
      }

      if (data?.images && data.images.length > 0) {
        setImages(data.images);
        // Auto-select first image if none selected
        if (!selectedImage && data.images.length > 0) {
          setSelectedImageIndex(0);
          onImageSelected(data.images[0]);
        }
      } else {
        setImages([]);
        toast.info('No images found for this search.');
      }
    } catch (error) {
      console.error('Error fetching images:', error);
      toast.error("Couldn't fetch images—try again.");
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch images when task changes
  useEffect(() => {
    if (task?.ai_output) {
      fetchImages();
    }
  }, [task?.ai_output]);

  // Handle custom search
  const handleSearch = () => {
    if (searchQuery.trim()) {
      fetchImages(searchQuery);
    }
  };

  // Handle image selection
  const handleImageSelect = (image: UnsplashImage, index: number) => {
    setSelectedImageIndex(index);
    onImageSelected(image);
  };

  // Handle Canva editing
  const handleCanvaEdit = (image: UnsplashImage) => {
    setCanvaImageUrl(image.full_url || image.download_url);
    setShowCanvaEditor(true);
  };

  // Handle "Use This Image" action
  const handleUseImage = async (image: UnsplashImage) => {
    if (!task) {
      toast.error('No task selected');
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
              source: 'unsplash',
              unsplash_id: image.id
            }
          ]
        })
        .eq('id', task.id);

      if (error) {
        throw error;
      }

      toast.success('Image added to post successfully!');
      
      // Trigger refresh
      window.dispatchEvent(new CustomEvent('draft-updated'));
      
    } catch (error) {
      console.error('Error adding image to post:', error);
      toast.error('Failed to add image to post');
    } finally {
      setAddingToPost(false);
    }
  };

  const handleCanvaComplete = (newImageUrl: string) => {
    // Update the selected image with the new Canva-edited version
    if (selectedImageIndex !== null && images[selectedImageIndex]) {
      const updatedImage = {
        ...images[selectedImageIndex],
        download_url: newImageUrl,
        thumb_url: newImageUrl,
        full_url: newImageUrl
      };
      
      onImageSelected(updatedImage);
      toast.success('Design saved successfully!');
    }
    setShowCanvaEditor(false);
  };

  return (
    <>
      <Card className="w-full">
        <CardContent className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Select Image</h3>
            </div>
          </div>

          {/* Search Bar */}
          <div className="flex gap-2">
            <Input
              placeholder="Search for specific images..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="aspect-square bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          )}

          {/* Image Grid */}
          {!loading && images.length > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {images.map((image, index) => (
                  <div
                    key={image.id}
                    className={`relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer group transition-all duration-200 hover:scale-105 ${
                      selectedImageIndex === index ? 'ring-2 ring-primary ring-offset-2' : ''
                    }`}
                    onClick={() => handleImageSelect(image, index)}
                  >
                    <img
                      src={image.thumb_url}
                      alt={image.alt}
                      className="w-full h-full object-cover"
                    />
                    {selectedImageIndex === index && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <div className="bg-primary text-primary-foreground rounded-full p-2">
                          <Check className="w-4 h-4" />
                        </div>
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                      <p className="text-white text-xs truncate">
                        by {image.photographer}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Selected Image Preview & Actions */}
              {selectedImageIndex !== null && images[selectedImageIndex] && (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <img
                        src={images[selectedImageIndex].thumb_url}
                        alt={images[selectedImageIndex].alt}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <h4 className="font-medium">Selected Image</h4>
                      <p className="text-sm text-gray-600">
                        Photo by {images[selectedImageIndex].photographer} on Unsplash
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          onClick={() => handleUseImage(images[selectedImageIndex])}
                          disabled={addingToPost}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                          {addingToPost ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              Adding...
                            </>
                          ) : (
                            'Use This Image'
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleCanvaEdit(images[selectedImageIndex])}
                        >
                          <Palette className="w-4 h-4 mr-2" />
                          Edit in Canva
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Search for More */}
              <div className="text-center">
                <Button
                  variant="outline"
                  onClick={() => fetchImages(searchQuery || generateSmartQuery(task))}
                  disabled={loading}
                >
                  <Search className="w-4 h-4 mr-2" />
                  Search for More Images
                </Button>
              </div>
            </div>
          )}

          {/* No Results */}
          {!loading && images.length === 0 && task?.ai_output && (
            <div className="text-center py-8">
              <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">No images found. Try a different search term.</p>
              <Button onClick={() => fetchImages()} variant="outline">
                <Search className="w-4 h-4 mr-2" />
                Try Again
              </Button>
            </div>
          )}

          {/* No Task */}
          {!task?.ai_output && (
            <div className="text-center py-8">
              <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Select content to see image suggestions</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Canva Editor Modal */}
      {showCanvaEditor && (
        <CanvaEditor
          isOpen={showCanvaEditor}
          onClose={() => setShowCanvaEditor(false)}
          imageUrl={canvaImageUrl}
          contentTaskId={task?.id || ''}
          onDesignComplete={handleCanvaComplete}
        />
      )}
    </>
  );
};