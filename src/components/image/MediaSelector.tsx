
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Upload, Search, Image as ImageIcon, Loader2, Download, Edit3, Camera } from 'lucide-react';
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
}

export const MediaSelector: React.FC<MediaSelectorProps> = ({
  onImageSelect,
  selectedImageUrl,
  contentContext,
  className,
  compact = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showingSuggestions, setShowingSuggestions] = useState(false);
  const [selectedImageMetadata, setSelectedImageMetadata] = useState<any>(null);
  const [previewImage, setPreviewImage] = useState<{url: string, metadata: any} | null>(null);
  
  const { searchImages, loading: unsplashLoading } = useUnsplash();
  const { uploadAsset } = useContentAssets();

  // Load default suggestions on mount
  useEffect(() => {
    const loadDefaultSuggestions = async () => {
      if (searchResults.length === 0 && !showingSuggestions) {
        setShowingSuggestions(true);
        const rawQuery = contentContext ? extractImageSummary(contentContext) : 'garden center';
        const defaultQuery = validateImageQuery(rawQuery);
        console.log('[MediaSelector] Loading suggestions with validated query:', defaultQuery, 'from context:', rawQuery);
        const results = await searchImages(defaultQuery);
        console.log('[MediaSelector] Search results received:', results?.length || 0, 'results');
        console.log('[MediaSelector] First result sample:', results?.[0]);
        setSearchResults(results.slice(0, 6));
        console.log('[MediaSelector] Updated searchResults state to:', results.slice(0, 6).length, 'items');
      }
    };
    
    loadDefaultSuggestions();
  }, [contentContext, searchImages, searchResults.length, showingSuggestions]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    const cleanQuery = validateImageQuery(searchQuery);
    console.log('[MediaSelector] Searching with validated query:', cleanQuery, 'from input:', searchQuery);
    
    setShowingSuggestions(false);
    const results = await searchImages(cleanQuery);
    setSearchResults(results);
  };

  const handleImageSelect = (imageUrl: string, metadata?: any) => {
    console.log('[MediaSelector] handleImageSelect called with:', imageUrl, metadata);
    setSelectedImageMetadata(metadata);
    console.log('[MediaSelector] About to call onImageSelect prop');
    onImageSelect(imageUrl, metadata);
    console.log('[MediaSelector] onImageSelect prop called successfully');
  };

  const handleDownload = async (image: any, event?: React.MouseEvent) => {
    event?.stopPropagation();
    
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
        
        // Copy attribution to clipboard
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
      console.error('Download error:', error);
      toast.error('Download failed');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const asset = await uploadAsset(file, []);
      if (asset?.url) {
        handleImageSelect(asset.url, {
          source: 'upload',
          alt_text: `Uploaded image: ${file.name}`,
          file_name: file.name
        });
      }
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Upload failed');
    }
  };

  // Debug logging
  console.log('[MediaSelector] Props:', {
    selectedImageUrl,
    hasSelectedImage: !!selectedImageUrl,
    compact,
    contentContext
  });
  console.log('[MediaSelector] Internal state:', {
    previewImage: previewImage ? { url: previewImage.url, hasMetadata: !!previewImage.metadata } : null,
    searchResultsCount: searchResults.length
  });

  if (compact) {
    return (
      <div className={cn("space-y-4", className)}>
        {/* Compact Featured Image */}
        <div className="space-y-2">
          {selectedImageUrl ? (
            <div className="relative group aspect-video rounded-lg border-2 border-green-200 overflow-hidden bg-green-50">
              <img 
                src={selectedImageUrl} 
                alt={selectedImageMetadata?.alt_text || "Featured image"}
                className="w-full h-full object-cover"
                onError={(e) => {
                  console.error('[MediaSelector] Image failed to load:', selectedImageUrl);
                  console.error('[MediaSelector] Current src:', e.currentTarget.src);
                  const currentSrc = e.currentTarget.src;
                  const fallbackPath = '/images/newsletter-fallback.jpg';
                  
                  // Prevent infinite loop - only set fallback if not already using it
                  if (!currentSrc.includes('newsletter-fallback.jpg')) {
                    e.currentTarget.src = fallbackPath;
                  } else {
                    // If fallback also fails, use a data URI placeholder
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

        {/* Compact Controls */}
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

        {/* Compact 3 Thumbnails */}
        {searchResults.length > 0 && (
          <div>
            <div className="text-xs text-slate-600 mb-2 font-medium">
              {showingSuggestions ? 'Suggested:' : 'Results:'}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {searchResults.slice(0, 3).map((image, index) => (
                <div
                  key={index}
                  className="relative group cursor-pointer aspect-square rounded overflow-hidden border-2 border-slate-200 hover:border-primary transition-all"
                  onClick={(e) => {
                    console.log('[MediaSelector] Compact image clicked:', index, image);
                    e.preventDefault();
                    e.stopPropagation();
                    // In compact mode, still use immediate selection for better UX
                    handleImageSelect(image.url, {
                      source: 'unsplash',
                      alt_text: image.alt,
                      photographer: image.photographer,
                      photographer_url: image.photographer_url,
                      unsplash_id: image.id,
                      thumb: image.thumb,
                      download_location: image.download_location
                    });
                  }}
                >
                  <img 
                    src={image.thumb} 
                    alt={image.alt}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="h-4 w-4 text-white" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("w-full space-y-6", className)}>
      {/* Featured Image Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-slate-700">Featured Image</h3>
        
        {selectedImageUrl || previewImage ? (
          <div className="relative group aspect-video rounded-lg border-2 border-green-200 overflow-hidden bg-green-50">
            <img 
              src={previewImage?.url || selectedImageUrl} 
              alt={previewImage?.metadata?.alt_text || selectedImageMetadata?.alt_text || "Featured image"}
              className="w-full h-full object-cover"
              onError={(e) => {
                console.error('[MediaSelector] Full view image failed to load:', previewImage?.url || selectedImageUrl);
                const currentSrc = e.currentTarget.src;
                const fallbackPath = '/images/newsletter-fallback.jpg';
                
                // Prevent infinite loop - only set fallback if not already using it
                if (!currentSrc.includes('newsletter-fallback.jpg')) {
                  e.currentTarget.src = fallbackPath;
                } else {
                  // If fallback also fails, use a data URI placeholder
                  e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y1Zjd1YSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzY2NzM4NSI+SW1hZ2UgVW5hdmFpbGFibGU8L3RleHQ+PC9zdmc+';
                }
              }}
            />
            
            {/* Show "Select This Image" button when previewing */}
            {previewImage && !selectedImageUrl && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <div className="text-center space-y-3">
                  <Button 
                    onClick={() => {
                      console.log('[MediaSelector] Select button clicked, calling onImageSelect');
                      handleImageSelect(previewImage.url, previewImage.metadata);
                      setPreviewImage(null);
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2"
                  >
                    Select This Image
                  </Button>
                  <p className="text-white text-sm">
                    Photo by {previewImage.metadata?.photographer}
                  </p>
                </div>
              </div>
            )}
            
            {/* Show edit controls for selected images */}
            {selectedImageUrl && !previewImage && (
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
            )}
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
          <div className="text-xs text-gray-500">
            Debug: Found {searchResults.length} results
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            {searchResults.slice(0, 3).map((image, index) => (
              <Card 
                key={index} 
                className="cursor-pointer transition-all hover:shadow-lg hover:scale-105 group"
                onClick={(e) => {
                  console.log('[MediaSelector] Full view image clicked:', index, image);
                  e.preventDefault();
                  e.stopPropagation();
                  setPreviewImage({
                    url: image.url,
                    metadata: {
                      source: 'unsplash',
                      alt_text: image.alt,
                      photographer: image.photographer,
                      photographer_url: image.photographer_url,
                      unsplash_id: image.id,
                      thumb: image.thumb,
                      download_location: image.download_location
                    }
                  });
                }}
              >
                <CardContent className="p-0">
                  <div className="relative aspect-square">
                    <img 
                      src={image.thumb} 
                      alt={image.alt}
                      className="w-full h-full object-cover rounded-lg"
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
            ))}
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
