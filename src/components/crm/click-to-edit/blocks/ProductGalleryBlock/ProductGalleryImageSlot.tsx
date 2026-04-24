import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui-legacy/button';
import { Plus, X, Sparkles, Image as ImageIcon, Loader2 } from 'lucide-react';

interface ProductGalleryImageSlotProps {
  imageUrl?: string;
  title?: string;
  index: number;
  isGenerating?: boolean;
  onOpenMediaSelector: () => void;
  onOpenAIDialog: () => void;
  onImageRemove: () => void;
}

export const ProductGalleryImageSlot: React.FC<ProductGalleryImageSlotProps> = ({
  imageUrl,
  title,
  index,
  isGenerating = false,
  onOpenMediaSelector,
  onOpenAIDialog,
  onImageRemove,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  if (isGenerating) {
    return (
      <div
        className={cn(
          "aspect-square bg-muted flex items-center justify-center",
          "border-2 border-dashed border-primary/30 rounded-lg"
        )}
      >
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-xs">Generating...</span>
        </div>
      </div>
    );
  }

  if (imageUrl) {
    return (
      <div
        className="aspect-square relative group overflow-hidden rounded-lg"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <img
          src={imageUrl}
          alt={title || `Product ${index + 1}`}
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
        "flex flex-col items-center justify-center gap-2 cursor-pointer rounded-lg",
        "hover:border-primary/50 hover:bg-muted transition-colors"
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
