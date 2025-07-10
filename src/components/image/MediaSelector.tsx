import React, { useState, useRef, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Upload, Check, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getUnsplashImage, extractImageKeyword, UnsplashImageResult } from '@/lib/api/unsplash';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface MediaSelectorProps {
  onImageSelect: (imageUrl: string, metadata?: any) => void;
  selectedImageUrl?: string;
  contentContext?: string;
  className?: string;
  compact?: boolean;
}

interface SelectedImageData {
  url: string;
  photographer?: string;
  source: 'unsplash' | 'upload';
  unsplash_id?: string;
}

export const MediaSelector: React.FC<MediaSelectorProps> = ({
  onImageSelect,
  selectedImageUrl,
  contentContext,
  className,
  compact = false
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
        <TabsList className={cn(
          "grid w-full grid-cols-2 bg-gradient-to-r from-background/80 to-background/60 backdrop-blur-md border border-primary/10 rounded-xl shadow-lg shadow-primary/10",
          compact ? "p-0.5 mt-2 mb-0" : "p-1 mt-4 mb-0"
        )}>
          <TabsTrigger value="find" className={cn(
            "rounded-lg font-medium flex items-center gap-1.5",
            compact ? "text-xs px-2 py-1" : "text-sm"
          )}>
            <Search className={compact ? "w-3 h-3" : "w-4 h-4"} />
            {compact ? "Find" : "Find a Free Image"}
          </TabsTrigger>
          <TabsTrigger value="upload" className={cn(
            "rounded-lg font-medium flex items-center gap-1.5",
            compact ? "text-xs px-2 py-1" : "text-sm"
          )}>
            <Upload className={compact ? "w-3 h-3" : "w-4 h-4"} />
            {compact ? "Upload" : "Upload Your Own"}
          </TabsTrigger>
        </TabsList>

        <div className={compact ? "p-2" : "p-4"}>
          <TabsContent value="find" className={cn("mt-0", compact ? "space-y-2" : "space-y-3")}>
            {/* Inline Search Bar */}
            <div className="flex gap-2">
              <div className="relative group flex-1">
                <Search className={cn(
                  "absolute left-3 top-1/2 transform -translate-y-1/2 text-text-tertiary group-focus-within:text-primary transition-colors duration-200",
                  compact ? "w-3 h-3" : "w-4 h-4"
                )} />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder={compact ? "Search images..." : "Search for beautiful images..."}
                  className={cn(
                    "rounded-lg border-2 border-primary/20 bg-surface-primary/50 backdrop-blur-sm text-text-primary placeholder:text-text-tertiary focus:border-primary focus:bg-surface-primary focus:shadow-lg focus:shadow-primary/10 transition-all duration-200",
                    compact ? "pl-8 h-8 text-sm" : "pl-10 h-10"
                  )}
                />
              </div>
              <Button 
                onClick={() => handleSearch()}
                disabled={isSearching || !searchQuery.trim()}
                size="icon"
                className={cn(
                  "bg-gradient-to-r from-brand-teal via-brand-teal-600 to-brand-teal-700 hover:from-brand-teal-600 hover:via-brand-teal-700 hover:to-brand-teal-800 text-white rounded-lg shadow-lg shadow-brand-teal/25 hover:shadow-xl hover:shadow-brand-teal/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300",
                  compact ? "h-8 w-8" : "h-10 w-10"
                )}
              >
                <Search className={compact ? "w-3 h-3" : "w-4 h-4"} />
              </Button>
            </div>

            {/* Image Grid */}
            {searchResults.length > 0 && (
              <div className={cn(
                "bg-surface-primary/30 rounded-xl border border-primary/10",
                compact ? "space-y-2 p-2" : "space-y-4 p-4"
              )}>
                {!compact && (
                  /* Featured Large Image - only show in non-compact mode */
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
                )}

                {/* Thumbnail Grid */}
                <div className={cn(
                  "grid gap-2",
                  compact ? "grid-cols-2" : "grid-cols-3"
                )}>
                  {(compact ? searchResults.slice(0, 4) : searchResults.slice(1, 4)).map((image, index) => (
                    <div 
                      key={image.unsplash_id || index}
                      className="relative cursor-pointer group rounded-lg overflow-hidden border-2 border-transparent hover:border-brand-teal/50 transition-all duration-300"
                      onClick={() => handleImageSelect(image)}
                    >
                      <img 
                        src={image.thumb} 
                        alt={image.alt}
                        className={cn(
                          "w-full object-cover transition-all duration-300 group-hover:scale-105",
                          compact ? "h-16" : "h-24"
                        )}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300">
                        <div className={cn(
                          "absolute bg-gradient-to-r from-brand-teal to-brand-teal-600 rounded-full flex items-center justify-center shadow-lg shadow-brand-teal/25",
                          compact ? "top-1 right-1 w-5 h-5" : "top-2 right-2 w-6 h-6"
                        )}>
                          <Check className={compact ? "w-3 h-3 text-white" : "w-4 h-4 text-white"} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="upload" className={cn("mt-0", compact ? "space-y-2" : "space-y-3")}>
            {/* Drag & Drop Zone */}
            <div 
              className={cn(
                "border-2 border-dashed rounded-xl text-center transition-all duration-300 backdrop-blur-sm",
                compact ? "p-3" : "p-6",
                dragActive 
                  ? "border-brand-teal bg-gradient-to-br from-brand-teal/10 to-brand-teal/5 shadow-lg shadow-brand-teal/10" 
                  : "border-primary/30 bg-surface-primary/30 hover:border-brand-teal/50 hover:bg-surface-primary/50"
              )}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <Upload className={cn(
                "mx-auto transition-colors duration-300",
                compact ? "w-6 h-6 mb-2" : "w-12 h-12 mb-4",
                dragActive ? "text-brand-teal" : "text-text-tertiary"
              )} />
              <h3 className={cn(
                "font-semibold text-text-primary",
                compact ? "text-sm mb-1" : "text-base mb-1"
              )}>
                {dragActive ? "Drop your image here" : "Upload your image"}
              </h3>
              <p className={cn(
                "text-text-secondary",
                compact ? "text-xs mb-2" : "text-sm mb-4"
              )}>
                {dragActive ? "Release to upload" : (compact ? "Drag & drop or click to browse" : "Drag & drop your image here, or click to browse")}
              </p>
              <Button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className={cn(
                  "bg-gradient-to-r from-brand-teal via-brand-teal-600 to-brand-teal-700 hover:from-brand-teal-600 hover:via-brand-teal-700 hover:to-brand-teal-800 text-white font-medium rounded-lg shadow-lg shadow-brand-teal/25 hover:shadow-xl hover:shadow-brand-teal/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300",
                  compact ? "h-8 px-4 text-sm" : "h-10 px-6"
                )}
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
              {!compact && (
                <p className="text-text-tertiary text-xs mt-4">
                  Supports PNG, JPG, GIF up to 10MB
                </p>
              )}
            </div>
          </TabsContent>
        </div>
      </Tabs>

      {/* Selected Image Panel */}
      {selectedImage && (
        <div className={cn(
          "border-t border-primary/10 bg-gradient-to-r from-brand-teal/5 via-surface-primary to-brand-teal/5 backdrop-blur-sm rounded-b-2xl",
          compact ? "p-2" : "p-4"
        )}>
          <h3 className={cn(
            "font-semibold text-text-primary flex items-center gap-2",
            compact ? "text-sm mb-2" : "text-base mb-3"
          )}>
            <Check className={compact ? "w-3 h-3 text-brand-teal" : "w-4 h-4 text-brand-teal"} />
            Selected Image
          </h3>
          <div className={cn(
            "flex gap-3",
            compact ? "flex-col" : "flex-col sm:flex-row gap-4"
          )}>
            {/* Thumbnail */}
            <div className="flex-shrink-0">
              <img 
                src={selectedImage.url} 
                alt="Selected" 
                className={cn(
                  "object-cover rounded-lg border-2 border-brand-teal/30 shadow-lg shadow-brand-teal/10",
                  compact ? "w-12 h-12" : "w-16 h-16"
                )}
              />
            </div>
            
            {/* Info & Actions */}
            <div className={cn("flex-1", compact ? "space-y-2" : "space-y-3")}>
              <p className={cn(
                "text-text-secondary font-medium",
                compact ? "text-xs" : "text-sm"
              )}>
                {selectedImage.source === 'unsplash' 
                  ? `Photo by ${selectedImage.photographer} on Unsplash`
                  : 'Your uploaded image'
                }
              </p>
              
              <div className={compact ? "space-y-1" : "flex flex-col sm:flex-row gap-2"}>
                <Button 
                  onClick={handleUseImage}
                  className={cn(
                    "bg-gradient-to-r from-brand-teal via-brand-teal-600 to-brand-teal-700 hover:from-brand-teal-600 hover:via-brand-teal-700 hover:to-brand-teal-800 text-white font-medium rounded-lg shadow-lg shadow-brand-teal/25 hover:shadow-xl hover:shadow-brand-teal/30 transition-all duration-300",
                    compact ? "h-8 w-full text-sm" : "h-10 flex-1"
                  )}
                >
                  Use This Image
                </Button>
                {!compact && (
                  <Button 
                    variant="outline"
                    onClick={handleEditInCanva}
                    className="h-10 border-2 border-brand-teal/30 bg-surface-primary/50 backdrop-blur-sm hover:bg-brand-teal/10 hover:border-brand-teal/50 text-text-primary font-medium rounded-lg transition-all duration-300 flex-1"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Edit in Canva
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};