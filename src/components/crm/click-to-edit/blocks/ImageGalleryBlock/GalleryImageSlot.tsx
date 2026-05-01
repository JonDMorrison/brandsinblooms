import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui-legacy/button";
import { X, Loader2, ImageIcon } from "lucide-react";
import { GallerySlotActionMenu } from "./GallerySlotActionMenu";

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
  borderRadius?: "none" | "small" | "medium" | "large";
}

const radiusMap = {
  none: "rounded-none",
  small: "rounded",
  medium: "rounded-lg",
  large: "rounded-xl",
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
  borderRadius = "medium",
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
          "w-full h-[200px] bg-gray-100 flex items-center justify-center overflow-hidden",
          "border-2 border-dashed border-gray-300",
          radiusMap[borderRadius],
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
          "w-full h-[200px] relative group overflow-hidden",
          radiusMap[borderRadius],
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <img
          src={image.url}
          alt={image.alt || `Gallery image ${index + 1}`}
          className="w-full h-full object-cover object-center block"
        />

        {/* Hover overlay */}
        <div
          className={cn(
            "absolute inset-0 bg-black/30",
            "transition-opacity duration-200",
            isHovered ? "opacity-100" : "opacity-0",
          )}
        />

        {/* Top-right toolbar group */}
        <div
          className={cn(
            "absolute top-2 right-2 flex items-center gap-1",
            "transition-opacity duration-200",
            isHovered ? "opacity-100" : "opacity-0",
          )}
        >
          <GallerySlotActionMenu
            onAutoPickImage={handleAutoPickImage}
            onOpenMediaSelector={onOpenMediaSelector}
            onOpenAIDialog={onOpenAIDialog}
          />
          <Button
            size="sm"
            variant="destructive"
            onClick={(e) => {
              e.stopPropagation();
              onImageRemove();
            }}
            className="h-6 w-6 p-0"
            aria-label="Remove image"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  // Empty slot
  return (
    <div
      className={cn(
        "w-full h-[200px] bg-gray-100 border-2 border-dashed border-gray-300 relative group overflow-hidden",
        "flex flex-col items-center justify-center gap-2",
        "hover:bg-gray-200/80 transition-colors",
        radiusMap[borderRadius],
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
      <span className="text-xs font-medium text-muted-foreground">
        Add Image
      </span>
      <span className="text-[11px] text-muted-foreground/80">
        Upload or generate artwork
      </span>

      {/* Top-right toolbar - visible on hover */}
      <div
        className={cn(
          "absolute top-2 right-2",
          "transition-opacity duration-200",
          isHovered ? "opacity-100" : "opacity-0",
        )}
      >
        <GallerySlotActionMenu
          onAutoPickImage={handleAutoPickImage}
          onOpenMediaSelector={onOpenMediaSelector}
          onOpenAIDialog={onOpenAIDialog}
        />
      </div>
    </div>
  );
};
