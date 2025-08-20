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
import { getRelevantFallbacks, formatFallbackImages } from '@/services/gardenCenterFallbacks';

interface MediaSelectorProps {
  onImageSelect: (imageUrl: string, metadata?: any) => void;
  selectedImageUrl?: string;
  contentContext?: string;
  className?: string;
  compact?: boolean;
  onBackClick?: () => void;
  autoSelectFirst?: boolean;
}

export const MediaSelector: React.FC<MediaSelectorProps> = ({
  onImageSelect,
  selectedImageUrl,
  contentContext,
  className,
  compact = false,
  onBackClick,
  autoSelectFirst = false
}) => {
  console.log('[MediaSelector] Component rendering with props:', {
    hasOnImageSelect: !!onImageSelect,
    hasSelectedImage: !!selectedImageUrl,
    selectedImageUrl,
    contentContext,
    compact
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showingSuggestions, setShowingSuggestions] = useState(false);
  const [selectedImageMetadata, setSelectedImageMetadata] = useState<any>(null);
  // Removed preview state - thumbnails now directly select images
  
  const { searchImages, loading: unsplashLoading } = useUnsplash();
  const { uploadAsset } = useContentAssets();

  // Helper to normalize fallback images to expected shape
  const normalizeFallbacks = (formatted: any[]) => formatted.map(img => ({
    id: img.id,
    url: img.download_url,
    thumb_url: img.thumb_url,
    alt: img.alt,
    photographer: img.photographer,
    photographer_url: undefined,
    download_location: undefined,
    source: 'fallback',
  }));

  // Ensure at least 4 results for proper grid display
  const supplementWithFallbacks = (results: any[], query: string) => {
    if (results.length >= 4) return results.slice(0, 6);
    
    const deficit = 4 - results.length;
    console.log(`[MediaSelector] Need ${deficit} more images, supplementing with fallbacks`);
    
    const fallbacks = getRelevantFallbacks(query, deficit);
    const formatted = formatFallbackImages(fallbacks, query);
    const normalized = normalizeFallbacks(formatted);
    
    // Combine and deduplicate by id
    const combined = [...results];
    normalized.forEach(fallback => {
      if (!combined.find(img => img.id === fallback.id)) {
        combined.push(fallback);
      }
    });
    
    console.log(`[MediaSelector] Supplemented results: ${results.length} original + ${normalized.length} fallbacks = ${combined.length} total`);
    return combined.slice(0, 6);
  };

  // Load default suggestions on mount and auto-select first image
  useEffect(() => {
    const loadDefaultSuggestions = async () => {
      if (searchResults.length === 0 && !showingSuggestions && !selectedImageUrl) {
        console.log('[MediaSelector] Loading default suggestions...');
        setShowingSuggestions(true);
        const rawQuery = contentContext ? extractImageSummary(contentContext) : 'garden center';
        const defaultQuery = validateImageQuery(rawQuery);
        console.log('[MediaSelector] Using validated query:', defaultQuery, 'from context:', rawQuery);
        
        try {
          const results = await searchImages(defaultQuery);
          console.log('[MediaSelector] Search results received:', results?.length || 0, 'results');
          console.log('[MediaSelector] First result structure:', results?.[0]);
          
          const finalResults = supplementWithFallbacks(results, defaultQuery);
          setSearchResults(finalResults);
          
          // Auto-select first image if requested and no image already selected
          if (autoSelectFirst && !selectedImageUrl && finalResults.length > 0) {
            const firstImage = finalResults[0];
            console.log('[MediaSelector] Auto-selecting first image:', firstImage);
            const imageMetadata = {
              source: firstImage.source || 'unsplash',
              alt_text: firstImage.alt,
              photographer: firstImage.photographer,
              photographer_url: firstImage.photographer_url,
              unsplash_id: firstImage.id,
              thumb: firstImage.thumb_url || firstImage.thumb,
              download_location: firstImage.download_location
            };
            handleImageSelect(firstImage.url || firstImage.download_url, imageMetadata);
          } else {
            console.log('[MediaSelector] Images loaded, waiting for user selection:', finalResults.length, 'images available');
          }
        } catch (error) {
          console.error('[MediaSelector] Error loading suggestions:', error);
        }
      }
    };
    
    loadDefaultSuggestions();
  }, [contentContext, searchImages, searchResults.length, showingSuggestions, selectedImageUrl, onImageSelect]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    console.log('[MediaSelector] Searching for:', searchQuery);
    const cleanQuery = validateImageQuery(searchQuery);
    console.log('[MediaSelector] Using validated query:', cleanQuery);
    
    setShowingSuggestions(false);
    try {
      const results = await searchImages(cleanQuery);
      console.log('[MediaSelector] Search completed, found:', results?.length || 0, 'results');
      const finalResults = supplementWithFallbacks(results, cleanQuery);
      setSearchResults(finalResults);
    } catch (error) {
      console.error('[MediaSelector] Search error:', error);
    }
  };

  const handleImageSelect = (imageUrl: string, metadata?: any) => {
    console.log('[MediaSelector] handleImageSelect called with:', imageUrl, metadata);
    console.log('[MediaSelector] onImageSelect prop exists:', !!onImageSelect);
    setSelectedImageMetadata(metadata);
    
    if (onImageSelect) {
      onImageSelect(imageUrl, metadata);
      console.log('[MediaSelector] onImageSelect callback completed successfully');
    } else {
      console.error('[MediaSelector] onImageSelect prop is missing!');
    }
  };

  const handleThumbnailClick = (image: any, index: number) => {
    console.log('[MediaSelector] Thumbnail clicked - index:', index, 'image:', image);
    console.log('[MediaSelector] Image URL to select:', image.url);
    
    const imageMetadata = {
      source: 'unsplash',
      alt_text: image.alt,
      photographer: image.photographer,
      photographer_url: image.photographer_url,
      unsplash_id: image.id,
      thumb: image.thumb,
      download_location: image.download_location
    };
    
    console.log('[MediaSelector] Calling handleImageSelect with:', image.url, imageMetadata);
    // Directly call handleImageSelect instead of going to preview mode
    handleImageSelect(image.url, imageMetadata);
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

  // Removed handleConfirmSelection and handleBackToBrowse - no longer needed

  // Debugging render flow
  console.log('[MediaSelector] Component re-rendered with state:', {
    searchResultsCount: searchResults.length,
    showingSuggestions,
    unsplashLoading
  });

  if (compact) {
    return (
      <div className={cn("w-full space-y-6", className)}>
        {/* Featured Image */}
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

        {/* Image Thumbnails - FIXED CLICKABLE AREA */}
        {searchResults.length > 0 && (
          <div className="space-y-3 relative z-20">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-700">
                {showingSuggestions ? 'Suggested Images' : 'Search Results'}
              </h4>
              <span className="text-xs text-gray-500">
                {searchResults.length} images found
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 min-h-[200px]">
              {searchResults.slice(0, 3).map((image, index) => {
                console.log('[MediaSelector] Compact - Rendering thumbnail:', index, {
                  id: image.id,
                  thumb: image.thumb,
                  thumb_url: image.thumb_url,
                  url: image.url,
                  download_url: image.download_url
                });
                return (
                  <button
                    key={image.id || index}
                    className="relative group cursor-pointer aspect-square rounded-lg overflow-hidden border-2 border-gray-200 hover:border-green-500 transition-all duration-200 bg-white shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('[MediaSelector] Compact thumbnail clicked:', image.id);
                      handleThumbnailClick(image, index);
                    }}
                    type="button"
                    tabIndex={0}
                  >
                    <img 
                      src={image.thumb_url || image.thumb || image.download_url || image.url} 
                      alt={image.alt || 'Image thumbnail'}
                      className="w-full h-full object-cover pointer-events-none"
                      onLoad={() => console.log('[MediaSelector] Compact image loaded successfully:', image.id)}
                      onError={(e) => {
                        console.error('[MediaSelector] Compact thumbnail failed to load:', {
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
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center pointer-events-none">
                      <div className="bg-white rounded-full p-2">
                        <Camera className="h-4 w-4 text-gray-700" />
                      </div>
                    </div>
                    {image.photographer && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                        <p className="text-white text-xs truncate">Photo by {image.photographer}</p>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
              <p className="text-xs text-gray-500 text-center">
                Showing 3 of {searchResults.length} options.
              </p>
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

        {/* No Results */}
        {!unsplashLoading && searchResults.length === 0 && !showingSuggestions && (
          <div className="text-center py-8">
            <ImageIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">No images found. Try a different search term.</p>
          </div>
        )}
      </div>
    );
  }

  // Browse Mode UI - thumbnails now directly select images
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