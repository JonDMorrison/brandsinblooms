import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, ExternalLink, Download, Check, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { extractDynamicQuery } from '@/utils/dynamicImageSearch';

interface UnsplashImage {
  id: string;
  urls: {
    thumb: string;
    small: string;
    regular: string;
    full: string;
  };
  alt_description: string | null;
  description: string | null;
  user: {
    name: string;
    username: string;
    links: {
      html: string;
    };
  };
  width: number;
  height: number;
  color: string;
}

interface UnsplashPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (photo: {
    type: 'image';
    source: 'unsplash';
    url: string;
    thumb: string;
    alt: string;
    author_name: string;
    author_link: string;
    unsplash_id: string;
  }) => void;
  initialQuery?: string;
  task?: any; // Content task for dynamic search
  campaign?: any; // Campaign data for context
}

export const UnsplashPicker: React.FC<UnsplashPickerProps> = ({
  isOpen,
  onClose,
  onSelect,
  initialQuery = '',
  task,
  campaign
}) => {
  // Extract dynamic query when component opens
  const getDynamicQuery = () => {
    if (task || campaign) {
      return extractDynamicQuery(task, campaign) || initialQuery || 'garden center';
    }
    return initialQuery || 'garden center';
  };
  
  const [query, setQuery] = useState('');
  const [images, setImages] = useState<UnsplashImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedImage, setSelectedImage] = useState<UnsplashImage | null>(null);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const searchImages = useCallback(async (searchQuery: string, pageNum: number = 1, append: boolean = false) => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery)}&page=${pageNum}&per_page=30&orientation=squarish&order_by=relevant`, {
        headers: {
          'Authorization': `Client-ID ${import.meta.env.VITE_UNSPLASH_ACCESS_KEY || 'demo-key'}`,
          'Accept-Version': 'v1'
        }
      });

      if (!response.ok) {
        // Fallback to edge function if direct API fails
        const { data, error: edgeError } = await supabase.functions.invoke('fetch-unsplash-images', {
          body: { 
            query: searchQuery,
            maxImages: 30,
            orientation: 'squarish',
            orderBy: 'relevant',
            contentFilter: 'high'
          }
        });

        if (edgeError) throw edgeError;
        
        const fallbackImages = (data?.images || []).map((img: any) => ({
          id: img.unsplash_id || img.id,
          urls: {
            thumb: img.thumb_url,
            small: img.thumb_url,
            regular: img.download_url,
            full: img.download_url
          },
          alt_description: img.alt,
          description: null,
          user: {
            name: img.photographer,
            username: img.photographer.toLowerCase().replace(/\s+/g, ''),
            links: { html: `https://unsplash.com/@${img.photographer.toLowerCase().replace(/\s+/g, '')}` }
          },
          width: 400,
          height: 400,
          color: '#f0f0f0'
        }));

        if (append) {
          setImages(prev => [...prev, ...fallbackImages]);
        } else {
          setImages(fallbackImages);
        }
        setHasMore(fallbackImages.length === 30);
        return;
      }

      const data = await response.json();
      const newImages = data.results || [];

      if (append) {
        setImages(prev => [...prev, ...newImages]);
      } else {
        setImages(newImages);
      }

      setHasMore(newImages.length === 30 && data.total_pages > pageNum);
      
    } catch (err: any) {
      console.error('Error searching images:', err);
      setError('Failed to search images. Please try again.');
      toast.error('Failed to search images');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    setPage(1);
    setImages([]);
    setHasMore(true);
    searchImages(query, 1, false);
  }, [query, searchImages]);

  const loadMore = useCallback(() => {
    if (!hasMore || loading || !query.trim()) return;
    
    const nextPage = page + 1;
    setPage(nextPage);
    searchImages(query, nextPage, true);
  }, [hasMore, loading, query, page, searchImages]);

  const handleImageSelect = useCallback(async (image: UnsplashImage) => {
    try {
      // Track download as required by Unsplash API terms
      const trackResponse = await fetch(`https://api.unsplash.com/photos/${image.id}/download`, {
        headers: {
          'Authorization': `Client-ID ${import.meta.env.VITE_UNSPLASH_ACCESS_KEY || 'demo-key'}`,
          'Accept-Version': 'v1'
        }
      });

      if (!trackResponse.ok) {
        console.warn('Failed to track download, but continuing...');
      }

      onSelect({
        type: 'image',
        source: 'unsplash',
        url: image.urls.regular,
        thumb: image.urls.thumb,
        alt: image.alt_description || image.description || 'Unsplash image',
        author_name: image.user.name,
        author_link: image.user.links.html,
        unsplash_id: image.id
      });

      onClose();
      toast.success('Image selected successfully!');
    } catch (err) {
      console.error('Error selecting image:', err);
      toast.error('Failed to select image');
    }
  }, [onSelect, onClose]);

  // Handle scroll for infinite loading
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollHeight - scrollTop <= clientHeight + 200) {
        loadMore();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [loadMore]);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Initialize with dynamic query when opened
  useEffect(() => {
    if (isOpen) {
      const dynamicQuery = getDynamicQuery();
      setQuery(dynamicQuery);
      if (dynamicQuery && dynamicQuery.trim()) {
        searchImages(dynamicQuery, 1, false);
      }
    }
  }, [isOpen, searchImages]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Choose an Image from Unsplash
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Form */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              ref={searchInputRef}
              placeholder="Search for images... (e.g., flowers, garden, plants)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={loading || !query.trim()}>
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Search
            </Button>
          </form>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Image Grid */}
          <div 
            ref={scrollRef}
            className="max-h-[50vh] overflow-y-auto"
          >
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {images.map((image) => (
                <div
                  key={image.id}
                  className={cn(
                    "relative group cursor-pointer rounded-lg overflow-hidden transition-all duration-200 hover:shadow-lg",
                    selectedImage?.id === image.id && "ring-2 ring-primary ring-offset-2"
                  )}
                  style={{ aspectRatio: '1' }}
                  onClick={() => {
                    setSelectedImage(image);
                    handleImageSelect(image);
                  }}
                >
                  <img
                    src={image.urls.thumb}
                    alt={image.alt_description || 'Unsplash image'}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-end p-2">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-white text-xs">
                      <div className="flex items-center gap-1">
                        <span>by {image.user.name}</span>
                        <ExternalLink className="w-3 h-3" />
                      </div>
                    </div>
                  </div>

                  {/* Selection Indicator */}
                  {selectedImage?.id === image.id && (
                    <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}

              {/* Loading Skeletons */}
              {loading && images.length === 0 && (
                Array.from({ length: 12 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-lg" />
                ))
              )}
            </div>

            {/* Load More Indicator */}
            {loading && images.length > 0 && (
              <div className="text-center py-4">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-gray-400" />
              </div>
            )}

            {/* No Results */}
            {!loading && images.length === 0 && query && (
              <div className="text-center py-12 text-gray-500">
                <Search className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">No images found</p>
                <p className="text-sm">Try searching with different keywords</p>
              </div>
            )}

            {/* Initial State */}
            {!loading && images.length === 0 && !query && (
              <div className="text-center py-12 text-gray-500">
                <Search className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">Search for images</p>
                <p className="text-sm">Enter keywords to find the perfect image for your post</p>
              </div>
            )}
          </div>

          {/* Attribution Notice */}
          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center gap-2">
              <ExternalLink className="w-3 h-3" />
              <span>Images provided by <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">Unsplash</a></span>
            </div>
            <p className="mt-1">Photographer attribution will be automatically added to your post.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};