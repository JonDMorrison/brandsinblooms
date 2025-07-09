
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImageCarousel } from '@/components/ui/image-carousel';
import { useImageSuggestions } from '@/hooks/useImageSuggestions';
import { Search, Image, RefreshCw } from 'lucide-react';
import { extractDynamicQuery } from '@/utils/dynamicImageSearch';

interface ImageSuggestionPanelProps {
  task: any;
  campaignTheme?: string;
}

export const ImageSuggestionPanel = ({ task, campaignTheme }: ImageSuggestionPanelProps) => {
  const { images, loading, query, hasStoredImages, fetchNewImages, shuffleImages, usingPlaceholders } = useImageSuggestions(task?.id);
  const [searchInput, setSearchInput] = useState('');

  // Extract dynamic query prioritizing campaign theme for consistency
  const getInitialQuery = () => {
    const campaign = campaignTheme ? { theme: campaignTheme } : task?.campaigns;
    const query = extractDynamicQuery(task, campaign);
    console.log('[IMAGE_PANEL] Dynamic query for task:', task?.id, 'query:', query);
    return query;
  };

  const handleSearch = () => {
    if (searchInput.trim()) {
      fetchNewImages(searchInput.trim(), task?.id, task?.post_type);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleGetInitialImages = () => {
    const initialQuery = getInitialQuery();
    setSearchInput(initialQuery);
    fetchNewImages(initialQuery, task?.id, task?.post_type);
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

        {/* No images state - show get images button */}
        {!loading && images.length === 0 && (
          <div className="text-center py-8">
            <Image className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No images loaded yet</p>
            <Button onClick={handleGetInitialImages} variant="outline">
              <Search className="w-4 h-4 mr-2" />
              Get Images for "{getInitialQuery()}"
            </Button>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Finding perfect images...</span>
          </div>
        )}

        {/* Image carousel with refresh option */}
        {!loading && images.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {hasStoredImages ? '📁 Saved images' : '🔄 Fresh images'} for "{query}"
              </p>
              <Button 
                onClick={shuffleImages} 
                variant="outline" 
                size="sm"
                disabled={loading}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Get New
              </Button>
            </div>
            
            <ImageCarousel
              images={images}
              query={query}
              contentTaskId={task?.id}
              onShuffle={shuffleImages}
              usingPlaceholders={usingPlaceholders}
            />
          </div>
        )}

        {/* Help text */}
        <p className="text-xs text-gray-500">
          💡 Tip: Images are automatically saved. Click "Get New" to refresh with different images.
        </p>
      </CardContent>
    </Card>
  );
};
