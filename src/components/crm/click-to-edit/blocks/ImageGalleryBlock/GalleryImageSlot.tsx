import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Plus, X, Sparkles, Image as ImageIcon, Loader2 } from 'lucide-react';

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
  borderRadius = 'medium',
}) => {
  const [isHovered, setIsHovered] = useState(false);

  if (isGenerating) {
    return (
      <div
        className={cn(
          "aspect-square bg-muted flex items-center justify-center",
          "border-2 border-dashed border-primary/30",
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
          "aspect-square relative group overflow-hidden",
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
            "absolute inset-0 bg-black/50 flex items-center justify-center gap-2",
            "transition-opacity duration-200",
            isHovered ? "opacity-100" : "opacity-0"
          )}
        >
          <Button
            size="sm"
            variant="secondary"
            onClick={onOpenMediaSelector}
            className="h-8 px-2"
            aria-label="Replace image"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={onOpenAIDialog}
            className="h-8 px-2"
            aria-label="Generate with AI"
          >
            <Sparkles className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={onImageRemove}
            className="h-8 px-2"
            aria-label="Remove image"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Empty slot
  return (
    <div
      className={cn(
        "aspect-square bg-muted/50 border-2 border-dashed border-muted-foreground/30",
        "flex flex-col items-center justify-center gap-2 cursor-pointer",
        "hover:border-primary/50 hover:bg-muted transition-colors",
        radiusMap[borderRadius]
      )}
      onClick={onOpenMediaSelector}
    >
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onOpenMediaSelector();
          }}
          className="h-8 w-8 p-0"
          aria-label="Add image"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onOpenAIDialog();
          }}
          className="h-8 w-8 p-0"
          aria-label="Generate with AI"
        >
          <Sparkles className="h-4 w-4" />
        </Button>
      </div>
      <span className="text-xs text-muted-foreground">Add Image</span>
    </div>
  );
};
