
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, Search, Check } from 'lucide-react';
import { ImageAttachment } from '@/lib/contentTypes';
import { cn } from '@/lib/utils';

interface ImagePickerProps {
  images: ImageAttachment[];
  selected: string | null;
  onSelect: (id: string) => void;
  onRefresh: () => void;
  onSearch: (query: string) => void;
  loading?: boolean;
}

export const ImagePicker = ({ 
  images, 
  selected, 
  onSelect, 
  onRefresh, 
  onSearch,
  loading = false 
}: ImagePickerProps) => {
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch(searchQuery.trim());
      setShowSearch(false);
      setSearchQuery('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, imageId: string, index: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(imageId);
    } else if (e.key === 'ArrowRight' && index < images.length - 1) {
      e.preventDefault();
      const nextButton = e.currentTarget.parentElement?.children[index + 1] as HTMLElement;
      nextButton?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      const prevButton = e.currentTarget.parentElement?.children[index - 1] as HTMLElement;
      prevButton?.focus();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-[#3E5A6B]">Select Image</h4>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSearch(!showSearch)}
            className="h-6 w-6 p-0"
            title="Search images"
          >
            <Search className="w-3 h-3 text-gray-600" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="h-6 w-6 p-0"
            title="Refresh images"
          >
            <RefreshCw className={cn("w-3 h-3 text-gray-600", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {showSearch && (
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            ref={searchInputRef}
            placeholder="Search for images..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" size="sm" disabled={!searchQuery.trim()}>
            Search
          </Button>
        </form>
      )}

      <div className="grid grid-cols-3 gap-3">
        {images.map((image, index) => (
          <button
            key={image.id}
            onClick={() => onSelect(image.id)}
            onKeyDown={(e) => handleKeyDown(e, image.id, index)}
            className={cn(
              "relative w-32 h-20 rounded-lg border-2 transition-all duration-200 overflow-hidden group focus:outline-none focus:ring-2 focus:ring-[#68BEB9] focus:ring-offset-2",
              selected === image.id 
                ? "border-[#68BEB9] shadow-md" 
                : "border-gray-200 hover:border-[#68BEB9]"
            )}
            tabIndex={0}
            role="radio"
            aria-checked={selected === image.id}
            aria-label={`Select image by ${image.photographer}`}
          >
            <img
              src={image.thumb}
              alt={image.alt}
              className="w-full h-full object-cover"
            />
            {selected === image.id && (
              <div className="absolute inset-0 bg-[#68BEB9]/20 flex items-center justify-center">
                <div className="w-6 h-6 bg-[#68BEB9] rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              </div>
            )}
            {loading && (
              <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
                <RefreshCw className="w-4 h-4 animate-spin text-gray-500" />
              </div>
            )}
          </button>
        ))}
      </div>

      {images.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">No images available</p>
          <p className="text-xs mt-1">Try searching for different keywords</p>
        </div>
      )}
    </div>
  );
};
