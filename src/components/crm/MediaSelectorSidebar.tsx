import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Search, Upload, Camera, Download, Loader2 } from 'lucide-react';
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

export const MediaSelectorSidebar: React.FC<MediaSelectorSidebarProps> = ({
  isOpen,
  onClose,
  onImageSelect,
  contentContext = '',
  selectedImageUrl,
  editMode
}) => {
  console.log('[MediaSelectorSidebar] Component called with props:', { isOpen, editMode, contentContext });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showingSuggestions, setShowingSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  const { searchImages, loading: unsplashLoading } = useUnsplash();
  const { uploadAsset } = useContentAssets();

  // Debug editMode state
  useEffect(() => {
    console.log('[MediaSelectorSidebar] editMode check', { isOpen, editMode });
  }, [isOpen, editMode]);

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

  // Reset scroll position when sidebar opens with multiple attempts
  useEffect(() => {
    if (isOpen && contentRef.current) {
      console.log('[MediaSelectorSidebar] Resetting scroll on open');
      
      // Immediate reset
      contentRef.current.scrollTop = 0;
      
      // Delayed reset to ensure DOM is ready
      setTimeout(() => {
        if (contentRef.current) {
          contentRef.current.scrollTop = 0;
          console.log('[MediaSelectorSidebar] Delayed scroll reset applied');
        }
      }, 100);
      
      // Additional reset using requestAnimationFrame
      requestAnimationFrame(() => {
        if (contentRef.current) {
          contentRef.current.scrollTop = 0;
          console.log('[MediaSelectorSidebar] RAF scroll reset applied');
        }
      });
    }
  }, [isOpen]);

  // Load default suggestions when sidebar opens
  useEffect(() => {
    const loadDefaultSuggestions = async () => {
      if (isOpen && searchResults.length === 0 && !showingSuggestions) {
        console.log('[MediaSelectorSidebar] Loading default suggestions...');
        setShowingSuggestions(true);
        const rawQuery = contentContext ? extractImageSummary(contentContext) : 'garden center';
        const defaultQuery = validateImageQuery(rawQuery);
        
        try {
          const results = await searchImages(defaultQuery);
          console.log('[MediaSelectorSidebar] Loaded suggestions:', results);
          setSearchResults(results.slice(0, 12));
          
          // Reset scroll after search results are loaded
          setTimeout(() => {
            if (contentRef.current) {
              contentRef.current.scrollTop = 0;
              console.log('[MediaSelectorSidebar] Scroll reset after suggestions loaded');
            }
          }, 150);
        } catch (error) {
          console.error('[MediaSelectorSidebar] Error loading suggestions:', error);
        }
      }
    };
    
    if (isOpen) {
      loadDefaultSuggestions();
    }
  }, [isOpen, contentContext, searchImages, searchResults.length, showingSuggestions]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    const cleanQuery = validateImageQuery(searchQuery);
    setShowingSuggestions(false);
    
    try {
      const results = await searchImages(cleanQuery);
      setSearchResults(results);
      
      // Reset scroll after search results are loaded
      setTimeout(() => {
        if (contentRef.current) {
          contentRef.current.scrollTop = 0;
          console.log('[MediaSelectorSidebar] Scroll reset after search results loaded');
        }
      }, 150);
    } catch (error) {
      console.error('[MediaSelectorSidebar] Search error:', error);
      toast.error('Search failed. Please try again.');
    }
  };

  const handleImageClick = (image: any) => {
    console.log('[MediaSelectorSidebar] Image selected:', image.url);
    setIsLoading(true);
    
    const imageMetadata = {
      source: 'unsplash',
      alt_text: image.alt,
      photographer: image.photographer,
      photographer_url: image.photographer_url,
      unsplash_id: image.id,
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

  const handleDownload = async (image: any, event: React.MouseEvent) => {
    event.stopPropagation();
    
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

  // Remove conditional rendering - let the portal always render and use CSS for visibility

  console.log('[MediaSelectorSidebar] Rendering sidebar with portal to document.body', {
    isOpen,
    documentBodyExists: !!document.body,
    searchResultsLength: searchResults.length,
    bodyChildrenCount: document.body?.children.length,
    portalTarget: document.body
  });

  // Debug: Force check if element exists in DOM after render
  React.useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        const sidebarElement = document.querySelector('[data-testid="media-selector-sidebar"]');
        const backdropElement = document.querySelector('[data-media-selector-backdrop]');
        console.log('[MediaSelectorSidebar] DOM Debug Check:', {
          sidebarExists: !!sidebarElement,
          sidebarVisible: sidebarElement ? window.getComputedStyle(sidebarElement).visibility : 'not found',
          sidebarDisplay: sidebarElement ? window.getComputedStyle(sidebarElement).display : 'not found',
          sidebarOpacity: sidebarElement ? window.getComputedStyle(sidebarElement).opacity : 'not found',
          sidebarZIndex: sidebarElement ? window.getComputedStyle(sidebarElement).zIndex : 'not found',
          backdropExists: !!backdropElement,
          bodyChildren: document.body.children.length
        });
      }, 100);
    }
  }, [isOpen]);

  console.log('[MediaSelectorSidebar] About to create portal');

  return createPortal(
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
        <div className="flex flex-col h-full">
          {/* Search Section */}
          <div className="p-4 space-y-4 border-b border-gray-100">
            <div className="flex gap-2">
              <Input
                placeholder="Search images..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                disabled={isLoading}
              />
              <Button 
                onClick={handleSearch} 
                disabled={unsplashLoading || isLoading}
                variant="outline"
                size="sm"
              >
                {unsplashLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            {/* Upload Button */}
            <label className="block">
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
                className="w-full" 
                asChild
                disabled={isLoading}
              >
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Image
                </span>
              </Button>
            </label>
          </div>

          {/* Results Section */}
          <div ref={contentRef} className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                  <p className="text-gray-600">Processing...</p>
                </div>
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
                {searchResults.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-700">
                        {showingSuggestions ? 'Suggested Images' : 'Search Results'}
                      </h4>
                      <span className="text-xs text-gray-500">
                        {searchResults.length} images
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      {searchResults.map((image, index) => (
                        <button
                          key={image.id || index}
                          className="relative group cursor-pointer aspect-square rounded-lg overflow-hidden border-2 border-gray-200 hover:border-primary transition-all duration-200 bg-white shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                          onClick={() => handleImageClick(image)}
                          type="button"
                        >
                          <img 
                            src={image.thumb_url || image.thumb || image.download_url || image.url} 
                            alt={image.alt || 'Image thumbnail'}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const currentSrc = e.currentTarget.src;
                              if (currentSrc !== (image.download_url || image.url)) {
                                e.currentTarget.src = image.download_url || image.url;
                              }
                            }}
                          />
                          
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                            <div className="bg-white rounded-full p-2">
                              <Camera className="h-4 w-4 text-gray-700" />
                            </div>
                          </div>

                          {/* Download button */}
                          {image.photographer && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 hover:bg-white"
                              onClick={(e) => handleDownload(image, e)}
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                          )}

                          {/* Photographer credit */}
                          {image.photographer && (
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              <p className="text-white text-xs truncate">
                                Photo by {image.photographer}
                              </p>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Loading State */}
                {unsplashLoading && (
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-700">Loading Images...</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {Array.from({ length: 6 }).map((_, index) => (
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
                  <div className="text-center py-12">
                    <Camera className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-2">No images found</p>
                    <p className="text-sm text-gray-500">Try a different search term</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>, 
    document.body
  );
};