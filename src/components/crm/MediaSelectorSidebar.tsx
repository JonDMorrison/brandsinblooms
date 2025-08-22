import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { X, Search, Upload, Camera, Download, Loader2, RefreshCw, MessageSquare } from 'lucide-react';
import { useUnsplash } from '@/hooks/useUnsplash';
import { useContentAssets } from '@/hooks/useContentAssets';
import { extractImageSummary } from '@/utils/imageContentSummary';
import { validateImageQuery } from '@/utils/dynamicImageSearch';
import { downloadUnsplashImage } from '@/services/unsplashDownloadService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MediaSelectorSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onImageSelect: (imageUrl: string, metadata?: any) => void;
  contentContext?: string;
  selectedImageUrl?: string;
  editMode?: 'text' | 'image' | null;
}

interface SearchResult {
  id: string;
  url: string;
  thumb: string;
  thumb_url: string;
  download_url: string;
  alt: string;
  photographer: string;
  photographer_url?: string;
  download_location?: string;
  source: 'uploads' | 'unsplash';
}

export const MediaSelectorSidebar: React.FC<MediaSelectorSidebarProps> = ({
  isOpen,
  onClose,
  onImageSelect,
  contentContext = '',
  selectedImageUrl,
  editMode
}) => {
  console.log('[MediaSelectorSidebar] Component called with props:', { isOpen, editMode, contentContext });
  
  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [allResults, setAllResults] = useState<SearchResult[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'uploads' | 'unsplash'>('all');
  
  // UI states
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMorePages, setHasMorePages] = useState(true);
  
  // Refs
  const sidebarRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Hooks
  const { getCuratedCollectionImages, searchImages, loading: unsplashLoading } = useUnsplash();
  const { uploadAsset, searchAssets, loading: assetsLoading } = useContentAssets();

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load initial content
  useEffect(() => {
    if (isOpen && !debouncedQuery) {
      loadCuratedImages();
    }
  }, [isOpen, debouncedQuery]);

  // Perform search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.trim()) {
      performSearch(debouncedQuery);
    }
  }, [debouncedQuery]);

  const loadCuratedImages = async (page = 1, append = false) => {
    setIsLoading(true);
    try {
      const curatedImages = await getCuratedCollectionImages(page);
      const curatedResults: SearchResult[] = curatedImages.map(img => ({ 
        ...img,
        thumb_url: img.thumb_url || img.thumb || img.url,
        download_url: img.download_url || img.url,
        source: 'unsplash' as const 
      }));
      
      if (append) {
        setAllResults(prev => [...prev, ...curatedResults]);
      } else {
        setAllResults(curatedResults);
        setCurrentPage(1);
      }
      
      setHasMorePages(curatedImages.length === 12); // If we got 12 images, there might be more
      setCurrentPage(page);
    } catch (error) {
      console.error('Error loading curated images:', error);
      toast.error('Failed to load curated images');
    } finally {
      setIsLoading(false);
    }
  };

  const performSearch = async (query: string) => {
    setIsLoading(true);
    try {
      const [uploadResults, unsplashResults] = await Promise.all([
        searchAssets(query),
        searchImages(query, true) // Use raw query for full Unsplash access
      ]);

      const uploadsFormatted: SearchResult[] = uploadResults.map(asset => ({
        id: asset.id,
        url: asset.url || '/placeholder.svg',
        thumb: asset.url || '/placeholder.svg',
        thumb_url: asset.url || '/placeholder.svg',
        download_url: asset.url || '/placeholder.svg',
        alt: asset.name,
        photographer: 'Your Upload',
        source: 'uploads' as const
      }));

      const unsplashFormatted: SearchResult[] = unsplashResults.map(img => ({
        ...img,
        thumb_url: img.thumb_url || img.thumb || img.url,
        download_url: img.download_url || img.url,
        source: 'unsplash' as const
      }));

      // Combine and prioritize user uploads
      const combined = [...uploadsFormatted, ...unsplashFormatted];
      setAllResults(combined);
    } catch (error) {
      console.error('Error performing search:', error);
      toast.error('Search failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter results based on active tab
  const filteredResults = useMemo(() => {
    if (activeTab === 'all') return allResults;
    return allResults.filter(result => result.source === activeTab);
  }, [allResults, activeTab]);

  const handleSearch = () => {
    // Search is now handled automatically via debounce
    if (searchQuery.trim()) {
      setDebouncedQuery(searchQuery);
    }
  };

  const handleLoadMore = async () => {
    if (!hasMorePages || isLoading || debouncedQuery) return;
    await loadCuratedImages(currentPage + 1, true);
  };

  const handleRefresh = () => {
    if (debouncedQuery.trim()) {
      performSearch(debouncedQuery);
    } else {
      loadCuratedImages();
    }
  };

  // Handle escape key and backdrop clicks
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (isOpen && sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        // Only close if click is truly outside the sidebar
        const target = e.target as HTMLElement;
        if (!target.closest('[data-media-selector-sidebar]')) {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.addEventListener('mousedown', handleClickOutside);
      
      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen, onClose]);

  // Reset scroll position when sidebar opens
  useEffect(() => {
    if (isOpen && contentRef.current) {
      console.log('[MediaSelectorSidebar] Resetting scroll on open');
      contentRef.current.scrollTop = 0;
      
      setTimeout(() => {
        if (contentRef.current) {
          contentRef.current.scrollTop = 0;
        }
      }, 100);
    }
  }, [isOpen]);

  const handleImageClick = (image: SearchResult) => {
    console.log('[MediaSelectorSidebar] Image selected:', image.url);
    setIsLoading(true);
    
    const imageMetadata = {
      source: image.source,
      alt_text: image.alt,
      photographer: image.photographer,
      photographer_url: image.photographer_url,
      unsplash_id: image.source === 'unsplash' ? image.id : undefined,
      thumb: image.thumb,
      download_location: image.download_location
    };
    
    // Add brief loading state for visual feedback
    setTimeout(() => {
      onImageSelect(image.url, imageMetadata);
      setIsLoading(false);
      onClose();
    }, 300);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const asset = await uploadAsset(file, []);
      if (asset?.url) {
        onImageSelect(asset.url, {
          source: 'upload',
          alt_text: `Uploaded image: ${file.name}`,
          file_name: file.name
        });
        onClose();
      }
    } catch (error) {
      console.error('[MediaSelectorSidebar] Upload failed:', error);
      toast.error('Upload failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (image: SearchResult, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (image.source !== 'unsplash') return;
    
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
      } else {
        toast.error(`Download failed: ${result.error}`);
      }
    } catch (error) {
      console.error('[MediaSelectorSidebar] Download error:', error);
      toast.error('Download failed');
    }
  };

  console.log('[MediaSelectorSidebar] Rendering sidebar with portal to document.body', {
    isOpen,
    documentBodyExists: !!document.body,
    resultsLength: allResults.length,
    activeTab
  });

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(8px)',
          zIndex: 999998,
          opacity: isOpen ? 1 : 0,
          visibility: isOpen ? 'visible' : 'hidden',
          pointerEvents: 'none',
          transition: 'all 0.3s ease-in-out',
        }}
      />
      
      {/* Sidebar */}
      <div
        id="media-selector-sidebar"
        ref={sidebarRef}
        data-media-selector-sidebar
        data-media-selector
        data-app="media-selector"
        data-testid="media-selector-sidebar"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '400px',
          height: '100vh',
          backgroundColor: 'white',
          boxShadow: '0 0 20px rgba(0,0,0,0.2)',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          visibility: isOpen ? 'visible' : 'hidden',
          transition: 'all 0.3s ease-in-out',
          zIndex: 1000000,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white sticky top-0 z-10">
          <h3 className="text-lg font-semibold text-gray-900">
            {isLoading ? 'Processing...' : 'Select Image'}
          </h3>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            disabled={isLoading}
            className="hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex flex-col h-full min-h-0">
          {/* Search Section */}
          <div className="p-4 border-b border-gray-100 space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search all images..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                disabled={isLoading}
                className="flex-1"
              />
              <Button 
                onClick={handleSearch} 
                size="sm" 
                disabled={isLoading}
                className="shrink-0"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
              {/* Upload Button */}
              <label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isLoading}
                />
                <Button 
                  variant="outline" 
                  size="sm" 
                  asChild
                  disabled={isLoading}
                >
                  <span>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </span>
                </Button>
              </label>
            </div>

            {/* Source Tabs */}
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="all">All ({allResults.length})</TabsTrigger>
                <TabsTrigger value="uploads">My Uploads ({allResults.filter(r => r.source === 'uploads').length})</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Results Section */}
          <div ref={contentRef} className="flex-1 min-h-0 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-600">
                  {debouncedQuery ? 'Searching...' : 'Loading images...'}
                </span>
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                <MessageSquare className="h-8 w-8 mb-2" />
                <p className="text-sm text-center">
                  {debouncedQuery ? (
                    <>No images found for "{debouncedQuery}"<br />Try different keywords</>
                  ) : (
                    'Search for images from your uploads and Unsplash'
                  )}
                </p>
              </div>
            ) : (
              <>
                {/* Current Selection */}
                {selectedImageUrl && (
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Current Image</h4>
                    <div className="aspect-video rounded-lg border-2 border-green-200 overflow-hidden">
                      <img 
                        src={selectedImageUrl} 
                        alt="Current selection"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                )}

                {/* Image Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {filteredResults.map((image) => (
                    <div key={`${image.source}-${image.id}`} className="relative group cursor-pointer">
                      <button
                        className="relative overflow-hidden rounded-lg bg-gray-100 aspect-square w-full border-2 border-gray-200 hover:border-primary transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                        onClick={() => handleImageClick(image)}
                        type="button"
                      >
                        <img
                          src={image.thumb_url || image.thumb}
                          alt={image.alt}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          loading="lazy"
                          onError={(e) => {
                            const currentSrc = e.currentTarget.src;
                            if (currentSrc !== (image.download_url || image.url)) {
                              e.currentTarget.src = image.download_url || image.url;
                            }
                          }}
                        />
                        
                        {/* Source Badge */}
                        {image.source === 'uploads' && (
                          <Badge 
                            variant="default"
                            className="absolute top-2 left-2 text-xs px-1.5 py-0.5"
                          >
                            Mine
                          </Badge>
                        )}

                        {/* Download button for Unsplash images */}
                        {image.source === 'unsplash' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                            onClick={(e) => handleDownload(image, e)}
                            type="button"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}

                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="sm" variant="secondary" className="text-xs">
                              Select Image
                            </Button>
                          </div>
                        </div>
                      </button>
                      <div className="mt-1 text-xs text-gray-500 truncate">
                        {image.photographer && (
                          <span>by {image.photographer}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Load More Button */}
                {hasMorePages && !debouncedQuery && (
                  <div className="mt-6">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleLoadMore}
                      disabled={isLoading}
                      className="w-full"
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4 mr-2" />
                      )}
                      Load More Images
                    </Button>
                  </div>
                )}

                {/* Refresh Section */}
                <div className="mt-6 pt-4 border-t border-gray-100">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleRefresh}
                    disabled={isLoading}
                    className="w-full"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Results
                  </Button>
                </div>

                {/* Tip */}
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600">
                    <strong>Tip:</strong> Search across your uploads and the full Unsplash library. Images are saved when selected.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};