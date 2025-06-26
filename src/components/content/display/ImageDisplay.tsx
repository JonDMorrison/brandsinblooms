
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Image, ChevronLeft, ChevronRight } from 'lucide-react';
import { useImageSuggestions } from '@/hooks/useImageSuggestions';

interface ImageDisplayProps {
  task: any;
  onViewFull?: (task: any) => void;
}

export const ImageDisplay = ({ task, onViewFull }: ImageDisplayProps) => {
  const { images, loading } = useImageSuggestions(task.id, task.post_type);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  if (loading) {
    return (
      <div className="bg-gray-100 rounded-lg p-4 text-center">
        <div className="animate-spin h-6 w-6 border-2 border-gray-400 border-t-transparent rounded-full mx-auto mb-2"></div>
        <p className="text-sm text-gray-600">Loading images...</p>
      </div>
    );
  }

  if (!images || images.length === 0) {
    return (
      <div className="bg-gray-100 rounded-lg p-4 text-center">
        <Image className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-500">No images available</p>
      </div>
    );
  }

  const currentImage = images[currentImageIndex];

  return (
    <div className="space-y-2">
      <div className="relative bg-gray-100 rounded-lg overflow-hidden aspect-video">
        <img
          src={currentImage.download_url || currentImage.thumb_url}
          alt={currentImage.alt || 'Content image'}
          className="w-full h-full object-cover"
          onError={(e) => {
            if (e.currentTarget.src === currentImage.download_url && currentImage.thumb_url) {
              e.currentTarget.src = currentImage.thumb_url;
            }
          }}
        />
        
        {images.length > 1 && (
          <>
            <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
              {currentImageIndex + 1}/{images.length}
            </div>
            
            <div className="absolute inset-y-0 left-0 flex items-center">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 bg-black bg-opacity-20 hover:bg-opacity-40 text-white"
                onClick={() => setCurrentImageIndex(prev => prev > 0 ? prev - 1 : images.length - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="absolute inset-y-0 right-0 flex items-center">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 bg-black bg-opacity-20 hover:bg-opacity-40 text-white"
                onClick={() => setCurrentImageIndex(prev => prev < images.length - 1 ? prev + 1 : 0)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}
      </div>
      
      {images.length > 1 && (
        <div className="flex justify-center gap-1">
          {images.map((_, index) => (
            <button
              key={index}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentImageIndex ? 'bg-blue-600' : 'bg-gray-300'
              }`}
              onClick={() => setCurrentImageIndex(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
