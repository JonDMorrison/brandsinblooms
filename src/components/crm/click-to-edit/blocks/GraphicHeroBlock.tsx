import React, { useEffect, useRef, useState } from "react";
import { ContentBlock } from "@/types/emailBuilder";
import { Button } from "@/components/ui-legacy/button";
import { Input } from "@/components/ui-legacy/input";
import { Label } from "@/components/ui-legacy/label";
import {
  MediaSelectorImage,
  MediaSelectorImageHandle,
} from "@/components/crm/MediaSelectorImage";
import { cn } from "@/lib/utils";
import { ContextualToolbar } from "../contextual/ContextualToolbar";
import { EditMode } from "@/hooks/useBlockEditMode";
import { ImageIcon } from "lucide-react";

interface GraphicHeroBlockProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  isPreview: boolean;
  editMode?: EditMode;
  onModeChange?: (mode: EditMode) => void;
  validationErrors?: Partial<Record<"buttonUrl" | "imageUrl", string>>;
  onClose?: () => void;
  onCancel?: () => void;
  isGenerating?: boolean;
}

function areGraphicHeroBlockPropsEqual(
  previousProps: GraphicHeroBlockProps,
  nextProps: GraphicHeroBlockProps,
) {
  return (
    previousProps.block.id === nextProps.block.id &&
    previousProps.block.imageUrl === nextProps.block.imageUrl &&
    previousProps.block.altText === nextProps.block.altText &&
    previousProps.block.ctaUrl === nextProps.block.ctaUrl &&
    previousProps.isPreview === nextProps.isPreview &&
    previousProps.editMode === nextProps.editMode &&
    previousProps.isGenerating === nextProps.isGenerating &&
    previousProps.validationErrors?.buttonUrl ===
      nextProps.validationErrors?.buttonUrl &&
    previousProps.validationErrors?.imageUrl ===
      nextProps.validationErrors?.imageUrl &&
    Boolean(previousProps.onModeChange) === Boolean(nextProps.onModeChange) &&
    Boolean(previousProps.onClose) === Boolean(nextProps.onClose) &&
    Boolean(previousProps.onCancel) === Boolean(nextProps.onCancel)
  );
}

const GraphicHeroBlockComponent: React.FC<GraphicHeroBlockProps> = ({
  block,
  onUpdate,
  onDuplicate,
  onDelete,
  isPreview,
  editMode,
  onModeChange,
  validationErrors,
  onClose,
  onCancel,
  isGenerating = false,
}) => {
  const mediaSelectorRef = useRef<MediaSelectorImageHandle>(null);
  const requestedImageUrlRef = useRef(block.imageUrl || "");
  const [displayedImageUrl, setDisplayedImageUrl] = useState(
    block.imageUrl || "",
  );
  const [isImageLoading, setIsImageLoading] = useState(false);

  // Keep the current asset mounted until a new image URL has loaded.
  useEffect(() => {
    const nextImageUrl = block.imageUrl || "";
    requestedImageUrlRef.current = nextImageUrl;

    if (!nextImageUrl) {
      setDisplayedImageUrl("");
      setIsImageLoading(false);
      return;
    }

    if (nextImageUrl === displayedImageUrl) {
      setIsImageLoading(false);
      return;
    }

    let cancelled = false;
    const preloadedImage = new Image();

    setIsImageLoading(true);

    preloadedImage.onload = () => {
      if (cancelled || requestedImageUrlRef.current !== nextImageUrl) {
        return;
      }

      setDisplayedImageUrl(nextImageUrl);
      setIsImageLoading(false);
    };

    preloadedImage.onerror = () => {
      if (cancelled || requestedImageUrlRef.current !== nextImageUrl) {
        return;
      }

      setIsImageLoading(false);
    };

    preloadedImage.src = nextImageUrl;

    return () => {
      cancelled = true;
    };
  }, [block.imageUrl, displayedImageUrl]);

  const renderPreviewContent = () => (
    <div className="relative overflow-hidden rounded-lg group">
      {/* Contextual Toolbar */}
      {onModeChange && (
        <ContextualToolbar
          editMode={editMode}
          onModeChange={onModeChange}
          onImageEdit={() => mediaSelectorRef.current?.openDialog()}
          showTextEdit={false}
          showImageEdit={true}
          showFormatEdit={false}
        />
      )}

      {/* The Graphic Hero - just an image with optional link */}
      {displayedImageUrl ? (
        block.ctaUrl ? (
          <a href={block.ctaUrl} target="_blank" rel="noopener noreferrer">
            <img
              src={displayedImageUrl}
              alt={block.altText || ""}
              className="w-full h-auto object-cover"
              decoding="async"
            />
          </a>
        ) : (
          <img
            src={displayedImageUrl}
            alt={block.altText || ""}
            className="w-full h-auto object-cover"
            decoding="async"
          />
        )
      ) : block.imageUrl ? (
        <div
          className={cn(
            "w-full flex items-center justify-center text-muted-foreground bg-muted",
            isPreview ? "h-48" : "h-64",
          )}
        >
          <span className="text-sm">Loading image...</span>
        </div>
      ) : (
        <div
          className={cn(
            "w-full flex flex-col items-center justify-center text-muted-foreground bg-muted",
            isPreview ? "h-48" : "h-64",
          )}
        >
          <ImageIcon className="h-12 w-12 mb-2 opacity-50" />
          <span className="text-sm">
            Upload a pre-designed graphic with text baked in
          </span>
          <span className="text-xs opacity-70 mt-1">
            Perfect for Canva designs, flyers, or custom graphics
          </span>
        </div>
      )}

      {isImageLoading && displayedImageUrl ? (
        <div className="absolute inset-0 bg-background/10 pointer-events-none" />
      ) : null}

      {/* Loading indicator */}
      {isGenerating && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
          <div className="text-sm text-muted-foreground">Generating...</div>
        </div>
      )}
    </div>
  );

  if (isPreview) {
    return renderPreviewContent();
  }

  return (
    <div className="space-y-6">
      {/* Live Preview Section */}
      <div className="space-y-2">
        <Label>Live Preview</Label>
        <div className="border rounded-lg overflow-hidden">
          {renderPreviewContent()}
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <p className="font-medium mb-1">📷 Graphic Hero Block</p>
        <p className="text-blue-700">
          Upload a pre-designed image with text already included. This is
          perfect for Canva designs, promotional flyers, or any graphic where
          the text is part of the image.
        </p>
      </div>

      {/* Image Upload */}
      <div className="space-y-2">
        <Label>Upload Your Graphic</Label>
        <MediaSelectorImage
          ref={mediaSelectorRef}
          src={block.imageUrl}
          onChange={(imageUrl) => onUpdate({ imageUrl })}
          contentContext="graphic hero image"
          className="h-48"
        />
        {validationErrors?.imageUrl ? (
          <p className="text-xs text-destructive">
            {validationErrors.imageUrl}
          </p>
        ) : null}
      </div>

      {/* Alt Text */}
      <div className="space-y-2">
        <Label htmlFor="altText">Alt Text (for accessibility)</Label>
        <Input
          id="altText"
          value={block.altText || ""}
          onChange={(e) => onUpdate({ altText: e.target.value })}
          placeholder="Describe the image content"
        />
      </div>

      {/* Click-through URL */}
      <div className="space-y-2">
        <Label htmlFor="ctaUrl">Click-through URL (Optional)</Label>
        <Input
          id="ctaUrl"
          value={block.ctaUrl || ""}
          onChange={(e) => onUpdate({ ctaUrl: e.target.value })}
          aria-invalid={Boolean(validationErrors?.buttonUrl)}
          className={cn(
            validationErrors?.buttonUrl &&
              "border-destructive focus-visible:ring-destructive/30",
          )}
          placeholder="https://..."
        />
        {validationErrors?.buttonUrl ? (
          <p className="text-xs text-destructive">
            {validationErrors.buttonUrl}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          When set, the entire image becomes clickable
        </p>
      </div>

      {(onClose || onCancel) && (
        <div className="pt-4 border-t flex flex-col sm:flex-row gap-3">
          {onCancel ? (
            <Button variant="outline" onClick={onCancel} className="w-full">
              Cancel
            </Button>
          ) : null}
          {onClose ? (
            <Button onClick={onClose} className="w-full">
              Save & Close
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
};

export const GraphicHeroBlock = React.memo(
  GraphicHeroBlockComponent,
  areGraphicHeroBlockPropsEqual,
);
