
import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';

interface ImageGalleryHeaderProps {
  lastQuery: string;
  loading: boolean;
  onRefresh: () => void;
}

export const ImageGalleryHeader = ({ lastQuery, loading, onRefresh }: ImageGalleryHeaderProps) => {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium text-[#3E5A6B]">Images</h3>
        {lastQuery && (
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
            "{lastQuery}"
          </span>
        )}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onRefresh}
        disabled={loading}
        className="h-6 w-6 p-0"
        title="Get different images"
      >
        {loading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <RefreshCw className="w-3 h-3" />
        )}
      </Button>
    </div>
  );
};
