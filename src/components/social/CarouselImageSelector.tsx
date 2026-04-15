import React, { useState } from 'react';
import { X, Plus, GripVertical, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui-legacy/button';
import { Alert, AlertDescription } from '@/components/ui-legacy/alert';
import { ImageSelectButton } from '@/components/image';

interface CarouselImageSelectorProps {
  images: string[];
  onChange: (images: string[]) => void;
  platform: 'facebook' | 'instagram';
  maxImages?: number;
  onImageClick?: (index: number) => void;
}

export const CarouselImageSelector: React.FC<CarouselImageSelectorProps> = ({
  images,
  onChange,
  platform,
  maxImages = 10,
  onImageClick
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const platformLimits = {
    facebook: { min: 2, max: 10, name: 'Facebook' },
    instagram: { min: 2, max: 10, name: 'Instagram' }
  };

  const limits = platformLimits[platform];
  const canAddMore = images.length < Math.min(maxImages, limits.max);
  const needsMore = images.length < limits.min;

  const handleImageSelect = (url: string) => {
    if (canAddMore) {
      onChange([...images, url]);
    }
  };

  const handleRemove = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newImages = [...images];
    const draggedImage = newImages[draggedIndex];
    newImages.splice(draggedIndex, 1);
    newImages.splice(index, 0, draggedImage);
    
    onChange(newImages);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className="space-y-4">
      {/* Info Banner */}
      {needsMore && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {limits.name} carousels require {limits.min}-{limits.max} images. 
            {images.length > 0 && ` Add ${limits.min - images.length} more image${limits.min - images.length > 1 ? 's' : ''}.`}
          </AlertDescription>
        </Alert>
      )}

      {/* Image Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {images.map((url, index) => (
          <div
            key={index}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            onClick={() => onImageClick?.(index)}
            className="relative group aspect-square rounded-lg overflow-hidden border-2 border-border bg-muted hover:border-primary transition-colors cursor-pointer"
          >
            <img
              src={url}
              alt={`Carousel image ${index + 1}`}
              className="w-full h-full object-cover"
            />
            
            {/* Drag Handle */}
            <div className="absolute top-2 left-2 bg-background/80 rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <GripVertical className="w-4 h-4" />
            </div>

            {/* Order Badge */}
            <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-medium">
              {index + 1}
            </div>

            {/* Remove Button */}
            <button
              onClick={() => handleRemove(index)}
              className="absolute bottom-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/90"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}

        {/* Add Image Button */}
        {canAddMore && (
          <div className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors flex flex-col items-center justify-center gap-2">
            <ImageSelectButton
              onImageSelect={handleImageSelect}
              selectedImageUrl={undefined}
              buttonText="Add Image"
              compact={true}
            />
          </div>
        )}
      </div>

      {/* Image Count */}
      <div className="text-sm text-muted-foreground text-center">
        {images.length} / {limits.max} images
        {platform === 'instagram' && images.length >= limits.min && (
          <span className="ml-2 text-xs text-amber-600">
            • All images must have the same aspect ratio
          </span>
        )}
      </div>
    </div>
  );
};
