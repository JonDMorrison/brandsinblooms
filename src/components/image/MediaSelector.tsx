import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Upload, Search, Image as ImageIcon, Loader2, Download, Edit3, Camera, ArrowLeft } from 'lucide-react';
import { useUnsplash } from '@/hooks/useUnsplash';
import { useContentAssets } from '@/hooks/useContentAssets';
import { downloadUnsplashImage, copyAttributionToClipboard } from '@/services/unsplashDownloadService';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { extractImageSummary } from '@/utils/imageContentSummary';
import { validateImageQuery } from '@/utils/dynamicImageSearch';

interface MediaSelectorProps {
  onImageSelect: (imageUrl: string, metadata?: any) => void;
  selectedImageUrl?: string;
  contentContext?: string;
  className?: string;
  compact?: boolean;
  onBackClick?: () => void;
}

export const MediaSelector: React.FC<MediaSelectorProps> = ({
  onImageSelect,
  selectedImageUrl,
  contentContext,
  className,
  compact = false,
  onBackClick
}) => {
  console.log('[MediaSelector] Component rendering with props:', {
    hasSelectedImage: !!selectedImageUrl,
    selectedImageUrl,
    contentContext,
    compact
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showingSuggestions, setShowingSuggestions] = useState(false);
  const [selectedImageMetadata, setSelectedImageMetadata] = useState<any>(null);
  const [previewImage, setPreviewImage] = useState<{url: string, metadata: any} | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  
  const { searchImages, loading: unsplashLoading } = useUnsplash();
  const { uploadAsset } = useContentAssets();

  // Load default suggestions on mount
  useEffect(() => {
    const loadDefaultSuggestions = async () => {
      if (searchResults.length === 0 && !showingSuggestions) {
        console.log('[MediaSelector] Loading default suggestions...');
        setShowingSuggestions(true);
        const rawQuery = contentContext ? extractImageSummary(contentContext) : 'garden center';
        const defaultQuery = validateImageQuery(rawQuery);
        console.log('[MediaSelector] Using validated query:', defaultQuery, 'from context:', rawQuery);
        
        try {
          const results = await searchImages(defaultQuery);
          console.log('[MediaSelector] Search results received:', results?.length || 0, 'results');
          console.log('[MediaSelector] First result structure:', results?.[0]);
          setSearchResults(results.slice(0, 6));
        } catch (error) {
          console.error('[MediaSelector] Error loading suggestions:', error);
        }
      }
    };
    
    loadDefaultSuggestions();
  }, [contentContext, searchImages, searchResults.length, showingSuggestions]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    console.log('[MediaSelector] Searching for:', searchQuery);
    const cleanQuery = validateImageQuery(searchQuery);
    console.log('[MediaSelector] Using validated query:', cleanQuery);
    
    setShowingSuggestions(false);
    try {
      const results = await searchImages(cleanQuery);
      console.log('[MediaSelector] Search completed, found:', results?.length || 0, 'results');
      setSearchResults(results);
    } catch (error) {
      console.error('[MediaSelector] Search error:', error);
    }
  };

  const handleImageSelect = (imageUrl: string, metadata?: any) => {
    console.log('[MediaSelector] Image selected:', imageUrl, metadata);
    setSelectedImageMetadata(metadata);
    setPreviewImage(null); // Clear preview when selecting
    onImageSelect(imageUrl, metadata);
    console.log('[MediaSelector] onImageSelect callback completed');
  };

  const handleThumbnailClick = (image: any, index: number) => {
    console.log('[MediaSelector] Entering handleThumbnailClick for image:', image);
    console.log('[MediaSelector] Current isPreviewing state BEFORE update:', isPreviewing);
    
    const imageMetadata = {
      source: 'unsplash',
      alt_text: image.alt,
      photographer: image.photographer,
      photographer_url: image.photographer_url,
      unsplash_id: image.id,
      thumb: image.thumb,
      download_location: image.download_location
    };
    
    // Set preview state
    setIsPreviewing(true);
    setPreviewImage({
      url: image.url,
      metadata: imageMetadata
    });

    console.log('[MediaSelector] Preview state set to true, previewImage set to:', image.id);
    console.log('[MediaSelector] isPreviewing state AFTER update:', isPreviewing);
  };

  const handleDownload = async (image: any, event?: React.MouseEvent) => {
    event?.stopPropagation();
    console.log('[MediaSelector] Download requested for:', image);
    
    if (!image.photographer || !image.id) {
      toast.error('Unable to download: Missing image information');
      return;
    }

    try {
      const result = await downloadUnsplashImage({
        imageUrl: image.url,
        photographer: image.photographer,
        photographerUrl: image.photographer_url,
        unsplashId: image.id,
        downloadLocation: image.download_location
      });

      if (result.success) {
        toast.success(`Downloaded: ${result.filename}`);
        
        const copied = await copyAttributionToClipboard(
          image.photographer,
          image.photographer_url,
          'copy'
        );
        
        if (copied) {
          toast.success('Attribution copied to clipboard');
        }
      } else {
        toast.error(`Download failed: ${result.error}`);
      }
    } catch (error) {
      console.error('[MediaSelector] Download error:', error);
      toast.error('Download failed');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('[MediaSelector] File upload started:', file.name);
    try {
      const asset = await uploadAsset(file, []);
      if (asset?.url) {
        console.log('[MediaSelector] File uploaded successfully:', asset.url);
        handleImageSelect(asset.url, {
          source: 'upload',
          alt_text: `Uploaded image: ${file.name}`,
          file_name: file.name
        });
      }
    } catch (error) {
      console.error('[MediaSelector] Upload failed:', error);
      toast.error('Upload failed');
    }
  };

  const handleConfirmSelection = () => {
    if (previewImage) {
      console.log('[MediaSelector] "Choose This Image" button clicked - confirming selection:', previewImage);
      onImageSelect(previewImage.url, previewImage.metadata);
      // Reset preview state after selection
      setPreviewImage(null);
      setIsPreviewing(false);
    }
  };

  const handleBackToBrowse = () => {
    console.log('[MediaSelector] Back to browse mode');
    setPreviewImage(null);
    setIsPreviewing(false);
    onBackClick?.();
  };

  // Debugging render flow
  console.log('[MediaSelector] Component re-rendered. isPreviewing:', isPreviewing);
  console.log('[MediaSelector] Current state:', {
    searchResultsCount: searchResults.length,
    hasPreviewImage: !!previewImage,
    previewImageUrl: previewImage?.url,
    showingSuggestions,
    unsplashLoading,
    isPreviewing: isPreviewing
  });

  if (compact) {
    return (
      <div className={cn("w-full space-y-6", className)}>
        {/* Compact Featured Image */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">Featured Image</h4>
          {selectedImageUrl ? (
            <div className="relative group aspect-video rounded-lg border-2 border-green-200 overflow-hidden bg-green-50">
              <img 
                src={selectedImageUrl} 
                alt={selectedImageMetadata?.alt_text || "Featured image"}
                className="w-full h-full object-cover"
                onError={(e) => {
                  console.error('[MediaSelector] Compact image failed to load:', selectedImageUrl);
                  const currentSrc = e.currentTarget.src;
                  const fallbackPath = '/images/newsletter-fallback.jpg';
                  
                  if (!currentSrc.includes('newsletter-fallback.jpg')) {
                    e.currentTarget.src = fallbackPath;
                  } else {
                    e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y1Zjd1YSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzY2NzM4NSI+SW1hZ2UgVW5hdmFpbGFibGU8L3RleHQ+PC9zdmc+';
                  }
                }}
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="bg-white/90 hover:bg-white"
                >
                  <Edit3 className="h-3 w-3 mr-1" />
                  Change Image
                </Button>
                {selectedImageMetadata?.source === 'unsplash' && selectedImageMetadata?.photographer && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={(e) => handleDownload(selectedImageMetadata, e)}
                    className="bg-white/90 hover:bg-white"
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="aspect-video rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center">
              <div className="text-center">
                <ImageIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Select a featured image</p>
              </div>
            </div>
          )}
        </div>

        {/* Search Controls */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">Search Images</h4>
          <div className="flex gap-2">
            <Input
              placeholder="Search images..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="text-sm"
            />
            <Button 
              onClick={handleSearch} 
              disabled={unsplashLoading}
              size="sm"
              variant="outline"
            >
              {unsplashLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
            </Button>
          </div>

          <label className="block">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button variant="outline" size="sm" className="w-full text-xs" asChild>
              <span>
                <Upload className="h-3 w-3 mr-1" />
                Upload New Image
              </span>
            </Button>
          </label>
        </div>

        {/* Image Thumbnails */}
        {searchResults.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-700">
                {showingSuggestions ? 'Suggested Images' : 'Search Results'}
              </h4>
              <span className="text-xs text-gray-500">
                {searchResults.length} images found
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 min-h-[120px]">
              {searchResults.slice(0, 3).map((image, index) => {
                console.log('[MediaSelector] Rendering thumbnail:', index, {
                  id: image.id,
                  thumb: image.thumb,
                  thumb_url: image.thumb_url,
                  url: image.url,
                  download_url: image.download_url
                });
                return (
                  <div
                    key={image.id || index}
                    className="relative group cursor-pointer aspect-square rounded-lg overflow-hidden border-2 border-gray-200 hover:border-green-500 transition-all duration-200 bg-white shadow-sm hover:shadow-md"
                    onClick={() => handleThumbnailClick(image, index)}
                  >
                    <img 
                      src={image.thumb_url || image.thumb || image.download_url || image.url} 
                      alt={image.alt || 'Image thumbnail'}
                      className="w-full h-full object-cover"
                      onLoad={() => console.log('[MediaSelector] Image loaded successfully:', image.id)}
                      onError={(e) => {
                        console.error('[MediaSelector] Thumbnail failed to load:', {
                          src: e.currentTarget.src,
                          image: image
                        });
                        // Fallback chain
                        const currentSrc = e.currentTarget.src;
                        if (currentSrc !== (image.download_url || image.url)) {
                          e.currentTarget.src = image.download_url || image.url;
                        } else {
                          // Show placeholder
                          e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2Y1ZjdmYSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzY2NzM4NSI+SW1hZ2U8L3RleHQ+PC9zdmc+';
                        }
                      }}
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                      <div className="bg-white rounded-full p-2">
                        <Camera className="h-4 w-4 text-gray-700" />
                      </div>
                    </div>
                    {image.photographer && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <p className="text-white text-xs truncate">Photo by {image.photographer}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {searchResults.length > 3 && (
              <p className="text-xs text-gray-500 text-center">
                Showing 3 of {searchResults.length} results. Click any image to view larger.
              </p>
            )}
          </div>
        )}

        {/* Loading State */}
        {unsplashLoading && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700">Loading Images...</h4>
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="aspect-square rounded-lg bg-gray-100 animate-pulse flex items-center justify-center"
                >
                  <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Preview Mode UI
  if (isPreviewing && previewImage) {
    console.log('[MediaSelector] Rendering preview mode.', previewImage);
    return (
      <div className={cn("w-full", className)}>
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToBrowse}
            className="p-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h3 className="text-lg font-semibold">Preview Image</h3>
            {previewImage.metadata?.photographer && (
              <p className="text-sm text-muted-foreground">
                Photo by {previewImage.metadata.photographer}
              </p>
            )}
          </div>
        </div>
        
        <div className="mb-6">
          <div className="aspect-video rounded-lg overflow-hidden bg-gray-100">
            <img 
              src={previewImage.url} 
              alt={previewImage.metadata?.alt_text || "Preview image"}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
        
        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={handleBackToBrowse}
          >
            Back to Browse
          </Button>
          <Button
            onClick={handleConfirmSelection}
            className="bg-primary hover:bg-primary/90"
          >
            Choose This Image
          </Button>
        </div>
      </div>
    );
  }

  // Browse Mode UI
  console.log('[MediaSelector] Rendering thumbnail grid (not in preview mode).');
  return (
    <div className={cn("w-full space-y-6", className)}>

      {/* Featured Image Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-slate-700">Featured Image</h3>
        
        {selectedImageUrl ? (
          <div className="relative group aspect-video rounded-lg border-2 border-green-200 overflow-hidden bg-green-50">
            <img 
              src={selectedImageUrl} 
              alt={selectedImageMetadata?.alt_text || "Featured image"}
              className="w-full h-full object-cover"
              onError={(e) => {
                console.error('[MediaSelector] Featured image failed to load:', selectedImageUrl);
                const currentSrc = e.currentTarget.src;
                const fallbackPath = '/images/newsletter-fallback.jpg';
                
                if (!currentSrc.includes('newsletter-fallback.jpg')) {
                  e.currentTarget.src = fallbackPath;
                } else {
                  e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y1Zjd1YSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzY2NzM4NSI+SW1hZ2UgVW5hdmFpbGFibGU8L3RleHQ+PC9zdmc+';
                }
              }}
            />
            
            {/* Show edit controls for selected images */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3">
              <div className="text-center">
                <Edit3 className="h-6 w-6 text-white mx-auto mb-2" />
                <p className="text-white font-medium">Change Image</p>
              </div>
              {selectedImageMetadata?.source === 'unsplash' && selectedImageMetadata?.photographer && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={(e) => handleDownload(selectedImageMetadata, e)}
                  className="bg-white/90 hover:bg-white"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="aspect-video rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center hover:border-gray-400 hover:bg-gray-100 transition-colors">
            <div className="text-center">
              <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <h4 className="text-lg font-medium text-gray-600 mb-1">Select a Featured Image</h4>
              <p className="text-sm text-gray-500">Choose from suggestions below or search for something specific</p>
            </div>
          </div>
        )}
      </div>

      {/* Search & Upload Controls */}
      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="flex-1 flex gap-2">
            <Input
              placeholder="Search for images..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={unsplashLoading}>
              {unsplashLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          
          <label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button variant="outline" asChild>
              <span>
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </span>
            </Button>
          </label>
        </div>
      </div>

      {/* 3 Thumbnail Grid */}
      {searchResults.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-slate-700">
            {showingSuggestions ? 'Suggested Images' : 'Search Results'}
          </h4>
          
          <div className="grid grid-cols-3 gap-4 min-h-[160px]">
            {searchResults.slice(0, 3).map((image, index) => {
              console.log('[MediaSelector] Browse mode - rendering thumbnail:', index, {
                id: image.id,
                thumb: image.thumb,
                thumb_url: image.thumb_url,
                url: image.url,
                download_url: image.download_url
              });
              return (
                <Card 
                  key={`${image.id}-${index}`}
                  className="cursor-pointer transition-all hover:shadow-lg hover:scale-105 group"
                  onClick={() => handleThumbnailClick(image, index)}
                >
                  <CardContent className="p-0">
                    <div className="relative aspect-square">
                      <img 
                        src={image.thumb_url || image.thumb || image.download_url || image.url} 
                        alt={image.alt}
                        className="w-full h-full object-cover rounded-lg"
                        onLoad={() => console.log('[MediaSelector] Browse mode - Image loaded:', image.id)}
                        onError={(e) => {
                          console.error('[MediaSelector] Browse mode - Thumbnail failed to load:', {
                            src: e.currentTarget.src,
                            image: image
                          });
                          // Fallback chain: thumb_url -> thumb -> download_url -> url -> placeholder
                          const currentSrc = e.currentTarget.src;
                          if (currentSrc !== (image.download_url || image.url)) {
                            e.currentTarget.src = image.download_url || image.url;
                          } else {
                            e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y1ZjdmYSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzY2NzM4NSI+SW1hZ2UgRmFpbGVkPC90ZXh0Pjwvc3ZnPg==';
                          }
                        }}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg flex items-center justify-center">
                        <Camera className="h-6 w-6 text-white" />
                      </div>
                      {image.photographer && (
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent text-white text-xs p-2 rounded-b-lg">
                          Photo by {image.photographer}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          
          {searchResults.length > 3 && (
            <div className="text-center">
              <Button 
                variant="outline" 
                onClick={() => setSearchResults(searchResults.slice(0, searchResults.length))}
                className="text-sm"
              >
                Search for more options above
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};