
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImageCarousel } from '@/components/ui/image-carousel';
import { useImageSuggestions } from '@/hooks/useImageSuggestions';
import { Search, Image } from 'lucide-react';

interface ImageSuggestionPanelProps {
  task: any;
  campaignTheme?: string;
}

export const ImageSuggestionPanel = ({ task, campaignTheme }: ImageSuggestionPanelProps) => {
  const { images, loading, query, fetchNewImages, shuffleImages } = useImageSuggestions(task?.id);
  const [searchInput, setSearchInput] = useState('');

  // Extract keywords from campaign theme or post type
  const getInitialQuery = () => {
    if (campaignTheme) {
      // Remove common words and extract meaningful keywords
      const cleanTheme = campaignTheme
        .toLowerCase()
        .replace(/week \d+/g, '')
        .replace(/\b(the|and|or|of|in|on|at|to|for|with|by)\b/g, '')
        .trim();
      return cleanTheme || task?.post_type || 'garden';
    }
    return task?.post_type || 'garden';
  };

  useEffect(() => {
    // Auto-generate images when component mounts if no images exist
    if (task?.id && images.length === 0 && !loading) {
      const initialQuery = getInitialQuery();
      setSearchInput(initialQuery);
      fetchNewImages(initialQuery, task.id);
    }
  }, [task?.id]);

  const handleSearch = () => {
    if (searchInput.trim()) {
      fetchNewImages(searchInput.trim(), task?.id);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="w-5 h-5" />
          Images for Your Post
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search input */}
        <div className="flex gap-2">
          <Input
            placeholder="Search for images (e.g., roses, garden tools, composting)"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <Button onClick={handleSearch} disabled={loading}>
            <Search className="w-4 h-4" />
          </Button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Finding perfect images...</span>
          </div>
        )}

        {/* Image carousel */}
        {!loading && (
          <ImageCarousel
            images={images}
            query={query}
            contentTaskId={task?.id}
            onShuffle={shuffleImages}
          />
        )}

        {/* Help text */}
        <p className="text-xs text-gray-500">
          💡 Tip: Try searching for specific plants, tools, or gardening activities related to your content
        </p>
      </CardContent>
    </Card>
  );
};
