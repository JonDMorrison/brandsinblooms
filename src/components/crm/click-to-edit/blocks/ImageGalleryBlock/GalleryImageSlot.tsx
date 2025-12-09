import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { X, Loader2, ImageIcon } from 'lucide-react';
import { GallerySlotActionMenu } from './GallerySlotActionMenu';

interface GalleryImage {
  id: string;
  url: string;
  alt?: string;
}

interface GalleryImageSlotProps {
  image?: GalleryImage;
  index: number;
  isGenerating?: boolean;
  onImageSelect: (imageUrl: string, metadata?: { alt?: string }) => void;
  onImageRemove: () => void;
  onOpenAIDialog: () => void;
  onOpenMediaSelector: () => void;
  onAutoPickImage?: () => void;
  borderRadius?: 'none' | 'small' | 'medium' | 'large';
}

const radiusMap = {
  none: 'rounded-none',
  small: 'rounded',
  medium: 'rounded-lg',
  large: 'rounded-xl',
};

export const GalleryImageSlot: React.FC<GalleryImageSlotProps> = ({
  image,
  index,
  isGenerating = false,
  onImageSelect,
  onImageRemove,
  onOpenAIDialog,
  onOpenMediaSelector,
  onAutoPickImage,
  borderRadius = 'medium',
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleAutoPickImage = () => {
    if (onAutoPickImage) {
      onAutoPickImage();
    } else {
      onOpenAIDialog();
    }
  };

  if (isGenerating) {
    return (
      <div
        className={cn(
          "aspect-[4/3] bg-gray-200 flex items-center justify-center",
          "border border-gray-300",
          radiusMap[borderRadius]
        )}
      >
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-xs">Generating...</span>
        </div>
      </div>
    );
  }

  if (image?.url) {
    return (
      <div
        className={cn(
          "aspect-[4/3] relative group overflow-hidden",
          radiusMap[borderRadius]
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <img
          src={image.url}
          alt={image.alt || `Gallery image ${index + 1}`}
          className="w-full h-full object-cover"
        />
        
        {/* Hover overlay with actions */}
        <div
          className={cn(
            "absolute inset-0 bg-black/40 flex items-center justify-center",
            "transition-opacity duration-200",
            isHovered ? "opacity-100" : "opacity-0"
          )}
        >
          {/* Remove button - top right */}
          <Button
            size="sm"
            variant="destructive"
            onClick={(e) => {
              e.stopPropagation();
              onImageRemove();
            }}
            className="absolute top-2 right-2 h-6 w-6 p-0"
            aria-label="Remove image"
          >
            <X className="h-3 w-3" />
          </Button>
          
          {/* Centered action menu */}
          <GallerySlotActionMenu
            onAutoPickImage={handleAutoPickImage}
            onOpenMediaSelector={onOpenMediaSelector}
            onOpenAIDialog={onOpenAIDialog}
          />
        </div>
      </div>
    );
  }

  // Empty slot
  return (
    <div
      className={cn(
        "aspect-[4/3] bg-gray-200 border border-gray-300",
        "flex flex-col items-center justify-center gap-3",
        "hover:bg-gray-300/70 transition-colors",
        radiusMap[borderRadius]
      )}
    >
      <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
      <GallerySlotActionMenu
        onAutoPickImage={handleAutoPickImage}
        onOpenMediaSelector={onOpenMediaSelector}
        onOpenAIDialog={onOpenAIDialog}
      />
      <span className="text-xs text-muted-foreground">Add Image</span>
    </div>
  );
};
