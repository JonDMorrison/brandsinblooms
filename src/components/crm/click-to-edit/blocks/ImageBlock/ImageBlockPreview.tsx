import React, { useState, useCallback } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import { InlineImageEditor } from '../../inline/InlineImageEditor';
import { InlineStyleEditor } from '../../inline/InlineStyleEditor';
import { CTAButton } from '@/components/ui/CTAButton';
import { cn } from '@/lib/utils';
import { useBlockImageGeneration } from '@/hooks/useBlockImageGeneration';
import { AIImageLoadingOverlay } from '@/components/ui/AIImageLoadingOverlay';
import { OPACITY_DEFAULTS, normalizeOpacityToDecimal } from '@/utils/opacityUtils';

interface ImageBlockPreviewProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  isGenerating?: boolean;
}

type InlineEditMode = 'image' | 'style' | null;

export const ImageBlockPreview: React.FC<ImageBlockPreviewProps> = ({ 
  block, 
  onUpdate,
  isGenerating = false
}) => {
  const [inlineEditMode, setInlineEditMode] = useState<InlineEditMode>(null);

  // Calculate opacity values using shared utility for WYSIWYG consistency
  const backgroundOpacityDecimal = normalizeOpacityToDecimal(block.backgroundOpacity, OPACITY_DEFAULTS.backgroundImage);
  const colorOverlayDecimal = normalizeOpacityToDecimal(block.colorOverlayOpacity, OPACITY_DEFAULTS.colorOverlay);
  const darkOverlayDecimal = normalizeOpacityToDecimal(block.darkOverlayOpacity, OPACITY_DEFAULTS.darkOverlay);
  const imageOverlayDecimal = normalizeOpacityToDecimal(block.overlayOpacity, OPACITY_DEFAULTS.imageOverlay);

  // Use AI image generation
  const contentForImage = block.caption || block.altText || 'Newsletter image';
  
  const { isGeneratingImage } = useBlockImageGeneration({
    blockId: block.id,
    blockType: block.type,
    content: contentForImage,
    currentImageUrl: block.imageUrl,
    isContentGenerating: isGenerating,
    onImageReady: (imageUrl, metadata) => {
      onUpdate({
        imageUrl,
        altText: metadata?.alt || 'AI generated image'
      });
    },
    enabled: false // Disabled - users add images manually based on their content
  });

  const handleInlineEdit = useCallback((mode: InlineEditMode, event: React.MouseEvent) => {
    event.stopPropagation();
    setInlineEditMode(mode);
  }, []);

  const handleInlineSave = useCallback(() => {
    setInlineEditMode(null);
  }, []);

  const handleInlineCancel = useCallback(() => {
    setInlineEditMode(null);
  }, []);

  const handleImageChange = useCallback((imageUrl: string) => {
    // DETERMINISTIC IMAGE BEHAVIOR: When user manually selects an image,
    // set autoImageMode = false to prevent system from ever auto-replacing it
    onUpdate({ 
      imageUrl, 
      autoImageMode: false,
      shouldFetchImage: false,
      isGeneratingImage: false
    });
  }, [onUpdate]);

  const handleBackgroundColorChange = useCallback((color: string) => {
    onUpdate({ backgroundColor: color });
  }, [onUpdate]);

  const handleLayoutChange = useCallback((layout: string) => {
    // When switching to two-column layout, change block type to image-text
    const updates: Partial<ContentBlock> = { layout: layout as any };
    if (layout === 'two-column-left' || layout === 'two-column-right') {
      updates.type = 'image-text';
    }
    onUpdate(updates);
  }, [onUpdate]);

  const handleTextAlignChange = useCallback((align: string) => {
    onUpdate({ textAlign: align as any });
  }, [onUpdate]);

  // Get aspect ratio class for Tailwind
  const getAspectRatioClass = () => {
    switch (block.aspectRatio) {
      case '16:9': return 'aspect-video';
      case '4:3': return 'aspect-[4/3]';
      case '1:1': return 'aspect-square';
      case '4:5': return 'aspect-[4/5]';
      default: return null; // 'auto' or undefined = natural size
    }
  };

  const aspectClass = getAspectRatioClass();
  const hasFixedAspect = aspectClass !== null;

  return (
    <div className={cn(
      "relative group overflow-hidden",
      // Remove padding when using fixed aspect ratio for edge-to-edge images
      hasFixedAspect ? "p-0" : "p-6",
      block.textAlign === 'center' && "text-center",
      block.textAlign === 'right' && "text-right"
    )}>
      {/* Settings button - appears on hover in top right */}
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-40"
        onClick={(e) => handleInlineEdit('style', e)}
        aria-label="Edit image block style"
      >
        <Settings className="h-4 w-4" />
      </Button>

      {/* AI Image Loading Overlay */}
      {isGeneratingImage && (
        <div className="relative w-full h-64 rounded-lg bg-muted">
          <AIImageLoadingOverlay message="Generating Images" />
        </div>
      )}

      {/* Image with inline editing */}
      {!isGeneratingImage && inlineEditMode === 'image' ? (
        <div className="relative z-50">
          <InlineImageEditor
            imageUrl={block.imageUrl}
            onChange={handleImageChange}
            onSave={handleInlineSave}
            onCancel={handleInlineCancel}
            contentContext="Email newsletter image"
            backgroundColor={block.backgroundColor}
            onBackgroundColorChange={handleBackgroundColorChange}
            layout={block.layout as 'image-left' | 'two-column-left' | 'two-column-right'}
            onLayoutChange={handleLayoutChange}
            showLayoutControls={block.layout === 'two-column-left' || block.layout === 'two-column-right'}
          />
        </div>
      ) : !isGeneratingImage ? (
        <div 
          className="cursor-pointer hover:opacity-80 transition-opacity relative"
          onClick={(e) => handleInlineEdit('image', e)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            // Don't intercept keyboard events from input fields
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
              return;
            }
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleInlineEdit('image', e as any);
            }
          }}
          aria-label="Click to edit image"
        >
          {block.imageUrl ? (
            <div className={cn(
              "relative overflow-hidden",
              hasFixedAspect ? aspectClass : "rounded-lg"
            )}>
              {/* Image Layer with opacity - uses object-cover for fixed aspect ratios */}
              <img
                src={block.imageUrl}
                alt={block.altText || 'Newsletter image'}
                className={cn(
                  hasFixedAspect 
                    ? "absolute inset-0 w-full h-full object-cover" 
                    : "w-full h-auto block"
                )}
                style={{ opacity: backgroundOpacityDecimal }}
                loading="lazy"
              />
              
              {/* Dark Overlay - for text contrast */}
              {darkOverlayDecimal > 0 && (
                <div 
                  className="absolute inset-0 bg-black pointer-events-none"
                  style={{ opacity: darkOverlayDecimal }}
                />
              )}
              
              {/* Color Overlay */}
              {block.backgroundColor && colorOverlayDecimal > 0 && (
                <div 
                  className="absolute inset-0 pointer-events-none"
                  style={{ 
                    backgroundColor: block.backgroundColor,
                    opacity: colorOverlayDecimal
                  }}
                />
              )}

              {/* Custom Image Overlay */}
              {imageOverlayDecimal > 0 && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundColor: block.overlayColor || '#000000',
                    opacity: imageOverlayDecimal
                  }}
                />
              )}
            </div>
          ) : (
            <div className={cn(
              "bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80",
              hasFixedAspect ? aspectClass : "rounded-lg aspect-video"
            )}>
              Click to add image
            </div>
          )}
        </div>
      ) : null}
      
      {!isGeneratingImage && block.caption && (
        <p className="mt-3 text-sm text-muted-foreground italic">
          {block.caption}
        </p>
      )}

      {/* CTA Button */}
      <CTAButton block={block} className="justify-center" />

      {/* Style editor overlay */}
      {inlineEditMode === 'style' && (
        <div className="absolute top-2 right-2 z-50">
          <InlineStyleEditor
            textAlign={block.textAlign}
            onTextAlignChange={handleTextAlignChange}
            onSave={handleInlineSave}
            onCancel={handleInlineCancel}
          />
        </div>
      )}
    </div>
  );
};