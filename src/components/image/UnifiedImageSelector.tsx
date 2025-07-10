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
      // Fetch multiple different images by making several API calls with variations
      const searchVariations = [
        searchTerm,
        `${searchTerm} nature`,
        `${searchTerm} outdoor`,
        `${searchTerm} beautiful`
      ];

      const results = await Promise.all(
        searchVariations.map(async (variation, index) => {
          try {
            const result = await getUnsplashImage(variation);
            if (result) {
              return {
                ...result,
                unsplash_id: `${result.unsplash_id}-${index}`
              };
            }
            return null;
          } catch {
            return null;
          }
        })
      );

      const validResults = results.filter(Boolean) as UnsplashImageResult[];
      if (validResults.length > 0) {
        setSearchResults(validResults);
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
    <div className={cn('bg-gradient-to-br from-surface-primary via-surface-secondary to-surface-tertiary rounded-2xl border border-primary/10 shadow-lg shadow-primary/5 backdrop-blur-sm', className)}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 p-1 mx-4 mt-4 mb-0 bg-gradient-to-r from-background/80 to-background/60 backdrop-blur-md border border-primary/10 rounded-xl shadow-lg shadow-primary/10">
          <TabsTrigger value="find" className="rounded-lg font-medium text-sm flex items-center gap-1.5">
            <Search className="w-4 h-4" />
            Find Images
          </TabsTrigger>
          <TabsTrigger value="upload" className="rounded-lg font-medium text-sm flex items-center gap-1.5">
            <Upload className="w-4 h-4" />
            Upload
          </TabsTrigger>
        </TabsList>

        <div className="p-4">
          <TabsContent value="find" className="space-y-3 mt-0">
            {/* Inline Search Bar */}
            <div className="flex gap-2">
              <div className="relative group flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-tertiary group-focus-within:text-primary w-4 h-4 transition-colors duration-200" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search for beautiful images..."
                  className="pl-10 h-10 rounded-lg border-2 border-primary/20 bg-surface-primary/50 backdrop-blur-sm text-text-primary placeholder:text-text-tertiary focus:border-primary focus:bg-surface-primary focus:shadow-lg focus:shadow-primary/10 transition-all duration-200"
                />
              </div>
              <Button 
                onClick={() => handleSearch()}
                disabled={isSearching || !searchQuery.trim()}
                size="icon"
                className="h-10 w-10 bg-gradient-to-r from-brand-teal via-brand-teal-600 to-brand-teal-700 hover:from-brand-teal-600 hover:via-brand-teal-700 hover:to-brand-teal-800 text-white rounded-lg shadow-lg shadow-brand-teal/25 hover:shadow-xl hover:shadow-brand-teal/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
              >
                <Search className="w-4 h-4" />
              </Button>
            </div>

            {/* Image Grid */}
            {searchResults.length > 0 && (
              <div className="space-y-4 p-4 bg-surface-primary/30 rounded-xl border border-primary/10">
                {/* Featured Large Image */}
                <div 
                  className="relative cursor-pointer group rounded-xl overflow-hidden border-2 border-transparent hover:border-brand-teal/50 transition-all duration-300"
                  onClick={() => handleImageSelect(searchResults[0])}
                >
                  <img 
                    src={searchResults[0].thumb} 
                    alt={searchResults[0].alt}
                    className="w-full h-64 object-cover transition-all duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <div className="absolute top-3 right-3 w-8 h-8 bg-gradient-to-r from-brand-teal to-brand-teal-600 rounded-full flex items-center justify-center shadow-lg shadow-brand-teal/25">
                      <Check className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </div>

                {/* Thumbnail Grid */}
                {searchResults.length > 1 && (
                  <div className="grid grid-cols-3 gap-3">
                    {searchResults.slice(1, 4).map((image, index) => (
                      <div 
                        key={image.unsplash_id || index}
                        className="relative cursor-pointer group rounded-lg overflow-hidden border-2 border-transparent hover:border-brand-teal/50 transition-all duration-300"
                        onClick={() => handleImageSelect(image)}
                      >
                        <img 
                          src={image.thumb} 
                          alt={image.alt}
                          className="w-full h-24 object-cover transition-all duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300">
                          <div className="absolute top-2 right-2 w-6 h-6 bg-gradient-to-r from-brand-teal to-brand-teal-600 rounded-full flex items-center justify-center shadow-lg shadow-brand-teal/25">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="upload" className="mt-0 space-y-3">
            {/* Drag & Drop Zone */}
            <div 
              className={cn(
                "border-2 border-dashed rounded-xl p-6 text-center transition-all duration-300 backdrop-blur-sm",
                dragActive 
                  ? "border-brand-teal bg-gradient-to-br from-brand-teal/10 to-brand-teal/5 shadow-lg shadow-brand-teal/10" 
                  : "border-primary/30 bg-surface-primary/30 hover:border-brand-teal/50 hover:bg-surface-primary/50"
              )}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <Upload className={cn(
                "w-12 h-12 mx-auto mb-4 transition-colors duration-300",
                dragActive ? "text-brand-teal" : "text-text-tertiary"
              )} />
              <h3 className="text-base font-semibold text-text-primary mb-1">
                {dragActive ? "Drop your image here" : "Upload your image"}
              </h3>
              <p className="text-text-secondary text-sm mb-4">
                {dragActive ? "Release to upload" : "Drag & drop your image here, or click to browse"}
              </p>
              <Button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="h-10 px-6 bg-gradient-to-r from-brand-teal via-brand-teal-600 to-brand-teal-700 hover:from-brand-teal-600 hover:via-brand-teal-700 hover:to-brand-teal-800 text-white font-medium rounded-lg shadow-lg shadow-brand-teal/25 hover:shadow-xl hover:shadow-brand-teal/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
              >
                {isUploading ? 'Uploading...' : 'Choose File'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                className="hidden"
              />
              <p className="text-text-tertiary text-xs mt-4">
                Supports PNG, JPG, GIF up to 10MB
              </p>
            </div>
          </TabsContent>
        </div>
      </Tabs>

      {/* Selected Image Panel */}
      {selectedImage && (
        <div className="border-t border-primary/10 p-4 bg-gradient-to-r from-brand-teal/5 via-surface-primary to-brand-teal/5 backdrop-blur-sm rounded-b-2xl">
          <h3 className="text-base font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Check className="w-4 h-4 text-brand-teal" />
            Selected Image
          </h3>
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Thumbnail */}
            <div className="flex-shrink-0">
              <img 
                src={selectedImage.url} 
                alt="Selected" 
                className="w-16 h-16 object-cover rounded-lg border-2 border-brand-teal/30 shadow-lg shadow-brand-teal/10"
              />
            </div>
            
            {/* Info & Actions */}
            <div className="flex-1 space-y-3">
              <p className="text-text-secondary text-sm font-medium">
                {selectedImage.source === 'unsplash' 
                  ? `Photo by ${selectedImage.photographer} on Unsplash`
                  : 'Your uploaded image'
                }
              </p>
              
              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  onClick={handleUseImage}
                  className="h-10 bg-gradient-to-r from-brand-teal via-brand-teal-600 to-brand-teal-700 hover:from-brand-teal-600 hover:via-brand-teal-700 hover:to-brand-teal-800 text-white font-medium rounded-lg shadow-lg shadow-brand-teal/25 hover:shadow-xl hover:shadow-brand-teal/30 transition-all duration-300 flex-1"
                >
                  Use This Image
                </Button>
                <Button 
                  variant="outline"
                  onClick={handleEditInCanva}
                  className="h-10 border-2 border-brand-teal/30 bg-surface-primary/50 backdrop-blur-sm hover:bg-brand-teal/10 hover:border-brand-teal/50 text-text-primary font-medium rounded-lg transition-all duration-300 flex-1"
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