import React, { useState, useRef, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Upload, Check, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getUnsplashImage, extractImageKeyword, UnsplashImageResult } from '@/lib/api/unsplash';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface UnifiedImageSelectorProps {
  onImageSelect: (imageUrl: string, metadata?: any) => void;
  selectedImageUrl?: string;
  contentContext?: string;
  className?: string;
}

interface SelectedImageData {
  url: string;
  photographer?: string;
  source: 'unsplash' | 'upload';
  unsplash_id?: string;
}

export const UnifiedImageSelector: React.FC<UnifiedImageSelectorProps> = ({
  onImageSelect,
  selectedImageUrl,
  contentContext,
  className
}) => {
  const [activeTab, setActiveTab] = useState('find');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UnsplashImageResult[]>([]);
  const [selectedImage, setSelectedImage] = useState<SelectedImageData | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-suggest search from content
  React.useEffect(() => {
    if (contentContext && !searchQuery) {
      const keyword = extractImageKeyword(contentContext);
      if (keyword) {
        setSearchQuery(keyword);
        handleSearch(keyword);
      }
    }
  }, [contentContext]);

  const handleSearch = async (query?: string) => {
    const searchTerm = query || searchQuery;
    if (!searchTerm.trim()) return;

    setIsSearching(true);
    try {
      // For the demo, we'll create mock results since we need multiple images
      const mainResult = await getUnsplashImage(searchTerm);
      if (mainResult) {
        // Create additional mock results for the grid
        const mockResults: UnsplashImageResult[] = [
          mainResult,
          { ...mainResult, unsplash_id: '2', url: mainResult.url + '?variant=2' },
          { ...mainResult, unsplash_id: '3', url: mainResult.url + '?variant=3' },
          { ...mainResult, unsplash_id: '4', url: mainResult.url + '?variant=4' }
        ];
        setSearchResults(mockResults);
      }
    } catch (error) {
      toast.error('Failed to search images');
    } finally {
      setIsSearching(false);
    }
  };

  const handleImageSelect = (image: UnsplashImageResult) => {
    const imageData: SelectedImageData = {
      url: image.url,
      photographer: image.photographer,
      source: 'unsplash',
      unsplash_id: image.unsplash_id
    };
    setSelectedImage(imageData);
  };

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data, error } = await supabase.functions.invoke('image-upload', {
        body: formData
      });

      if (error) {
        throw new Error(error.message || 'Upload failed');
      }

      if (!data?.success || !data?.imageUrl) {
        throw new Error('Invalid response from upload service');
      }

      const imageData: SelectedImageData = {
        url: data.imageUrl,
        source: 'upload'
      };
      setSelectedImage(imageData);
      toast.success('Image uploaded successfully');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files[0]) {
      handleFileUpload(files[0]);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const handleUseImage = () => {
    if (selectedImage) {
      onImageSelect(selectedImage.url, {
        photographer: selectedImage.photographer,
        source: selectedImage.source,
        unsplash_id: selectedImage.unsplash_id
      });
      toast.success('Image selected successfully');
    }
  };

  const handleEditInCanva = () => {
    if (selectedImage) {
      // Open Canva with the selected image
      const canvaUrl = `https://www.canva.com/design/new?photo=${encodeURIComponent(selectedImage.url)}`;
      window.open(canvaUrl, '_blank');
    }
  };

  return (
    <div className={cn('bg-white rounded-lg border border-gray-200', className)}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 p-1 bg-gray-100 rounded-lg">
          <TabsTrigger value="find" className="rounded-md">Find a Free Image</TabsTrigger>
          <TabsTrigger value="upload" className="rounded-md">Upload Your Own</TabsTrigger>
        </TabsList>

        <div className="p-6">
          <TabsContent value="find" className="space-y-4 mt-0">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search Unsplash for..."
                className="pl-10 h-12 rounded-lg"
              />
            </div>

            {/* Search Button */}
            <Button 
              onClick={() => handleSearch()}
              disabled={isSearching || !searchQuery.trim()}
              className="w-full h-12"
            >
              {isSearching ? 'Searching...' : 'Search Images'}
            </Button>

            {/* Image Grid */}
            {searchResults.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {/* Featured Large Image */}
                <div 
                  className="col-span-2 row-span-2 relative cursor-pointer group rounded-lg overflow-hidden"
                  onClick={() => handleImageSelect(searchResults[0])}
                >
                  <img 
                    src={searchResults[0].thumb} 
                    alt={searchResults[0].alt}
                    className="w-full h-48 object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200">
                    <div className="absolute top-2 right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <Check className="w-4 h-4 text-green-600" />
                    </div>
                  </div>
                  <div className="absolute bottom-2 left-2 text-white text-xs bg-black bg-opacity-50 px-2 py-1 rounded">
                    by {searchResults[0].photographer}
                  </div>
                </div>

                {/* Smaller Images */}
                {searchResults.slice(1, 4).map((image, index) => (
                  <div 
                    key={image.unsplash_id || index}
                    className="relative cursor-pointer group rounded-lg overflow-hidden"
                    onClick={() => handleImageSelect(image)}
                  >
                    <img 
                      src={image.thumb} 
                      alt={image.alt}
                      className="w-full h-[70px] object-cover transition-transform duration-200 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200">
                      <div className="absolute top-1 right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <Check className="w-3 h-3 text-green-600" />
                      </div>
                    </div>
                    <div className="absolute bottom-1 left-1 text-white text-xs bg-black bg-opacity-50 px-1 py-0.5 rounded text-[10px]">
                      by {image.photographer}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="upload" className="mt-0">
            {/* Drag & Drop Zone */}
            <div 
              className={cn(
                "border-2 border-dashed border-gray-300 rounded-lg p-8 text-center transition-colors duration-200",
                dragActive && "border-green-500 bg-green-50"
              )}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">Drag & drop here, or</p>
              <Button 
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="h-12"
              >
                {isUploading ? 'Uploading...' : 'Choose a file...'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                className="hidden"
              />
            </div>
          </TabsContent>
        </div>
      </Tabs>

      {/* Selected Image Panel */}
      {selectedImage && (
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Selected Image</h3>
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Thumbnail */}
            <div className="flex-shrink-0">
              <img 
                src={selectedImage.url} 
                alt="Selected" 
                className="w-16 h-16 object-cover rounded-lg"
              />
            </div>
            
            {/* Info & Actions */}
            <div className="flex-1">
              <p className="text-sm text-gray-600 mb-3">
                {selectedImage.source === 'unsplash' 
                  ? `Photo by ${selectedImage.photographer} on Unsplash`
                  : 'Your uploaded image'
                }
              </p>
              
              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  onClick={handleUseImage}
                  className="h-12 bg-green-600 hover:bg-green-700 text-white flex-1"
                >
                  Use This Image
                </Button>
                <Button 
                  variant="outline"
                  onClick={handleEditInCanva}
                  className="h-12 flex-1"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Edit in Canva
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};