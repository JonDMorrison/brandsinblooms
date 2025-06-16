
import React from 'react';
import { Image } from 'lucide-react';

interface TaskImage {
  id: string;
  thumb_url: string;
  alt: string;
}

interface TaskImagePreviewProps {
  images: TaskImage[];
  imageCount: number;
  loading: boolean;
}

export const TaskImagePreview = ({ images, imageCount, loading }: TaskImagePreviewProps) => {
  if (loading) {
    return (
      <div className="flex items-center gap-1 text-xs text-gray-400">
        <div className="w-4 h-4 animate-pulse bg-gray-200 rounded"></div>
        <span>Loading...</span>
      </div>
    );
  }

  if (imageCount === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {/* Image thumbnails */}
      <div className="flex -space-x-1">
        {images.slice(0, 2).map((image, index) => (
          <div
            key={image.id}
            className="w-6 h-6 rounded border-2 border-white shadow-sm overflow-hidden"
            style={{ zIndex: 2 - index }}
          >
            <img
              src={image.thumb_url}
              alt={image.alt}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
        {imageCount > 2 && (
          <div className="w-6 h-6 rounded border-2 border-white shadow-sm bg-gray-100 flex items-center justify-center text-xs text-gray-600 font-medium">
            +{imageCount - 2}
          </div>
        )}
      </div>

      {/* Image count */}
      <div className="flex items-center gap-1 text-xs text-gray-500">
        <Image className="w-3 h-3" />
        <span>{imageCount}</span>
      </div>
    </div>
  );
};
