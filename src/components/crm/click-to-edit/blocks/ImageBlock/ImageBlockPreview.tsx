import React, { useState, useCallback, useRef } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { InlineImageEditor } from '../../inline/InlineImageEditor';
import { CTAButton } from '@/components/ui-legacy/CTAButton';
import { cn } from '@/lib/utils';
import { useBlockImageGeneration } from '@/hooks/useBlockImageGeneration';
import { AIImageLoadingOverlay } from '@/components/ui-legacy/AIImageLoadingOverlay';
import { ImageSourcePicker } from './ImageSourcePicker';
import { AIPersonalizationDialog } from '@/components/crm/AIPersonalizationDialog';
import { OPACITY_DEFAULTS, normalizeOpacityToDecimal } from '@/utils/opacityUtils';

interface ImageBlockPreviewProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  isGenerating?: boolean;
}

type InlineEditMode = 'image' | null;

export const ImageBlockPreview: React.FC<ImageBlockPreviewProps> = ({ 
  block, 
  onUpdate,
  isGenerating = false
}) => {
  const [inlineEditMode, setInlineEditMode] = useState<InlineEditMode>(null);
  const [showAIDialog, setShowAIDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate opacity values using shared utility for WYSIWYG consistency
  const backgroundOpacityDecimal = normalizeOpacityToDecimal(block.backgroundOpacity, OPACITY_DEFAULTS.backgroundImage);
  const colorOverlayDecimal = normalizeOpacityToDecimal(block.overlayOpacity, OPACITY_DEFAULTS.colorOverlay);
  const darkOverlayDecimal = normalizeOpacityToDecimal(block.darkOverlayOpacity, OPACITY_DEFAULTS.darkOverlay);

  // Use AI image generation
  const contentForImage = 'Newsletter image';
  
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

  // Overlay color change (sits ON TOP of image)
  const handleOverlayColorChange = useCallback((color: string) => {
    onUpdate({ overlayColor: color });
  }, [onUpdate]);

  // Overlay opacity change
  const handleOverlayOpacityChange = useCallback((opacity: number) => {
    onUpdate({ overlayOpacity: opacity });
  }, [onUpdate]);

  // Background color change (sits BEHIND the image)
  const handleBackgroundColorChange = useCallback((color: string) => {
    onUpdate({ backgroundColor: color });
  }, [onUpdate]);

  // Image Source Picker handlers
  const handleSelectCollection = useCallback(() => {
    setInlineEditMode('image');
  }, []);

  const handleUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleGenerateAI = useCallback(() => {
    setShowAIDialog(true);
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        onUpdate({ 
          imageUrl: dataUrl, 
          autoImageMode: false,
          shouldFetchImage: false,
          isGeneratingImage: false
        });
      };
      reader.readAsDataURL(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onUpdate]);

  const handleAIImageSelected = useCallback((imageUrl: string) => {
    onUpdate({ 
      imageUrl, 
      autoImageMode: false,
      shouldFetchImage: false,
      isGeneratingImage: false
    });
    setShowAIDialog(false);
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
    <div 
      className={cn(
        "relative group overflow-hidden",
        // Remove padding when using fixed aspect ratio for edge-to-edge images
        hasFixedAspect ? "p-0" : "p-6"
      )}
      style={{ backgroundColor: block.backgroundColor || undefined }}
    >
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
            overlayColor={block.overlayColor}
            overlayOpacity={block.overlayOpacity || 0}
            onOverlayColorChange={handleOverlayColorChange}
            onOverlayOpacityChange={handleOverlayOpacityChange}
            backgroundColor={block.backgroundColor}
            onBackgroundColorChange={handleBackgroundColorChange}
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
              
              {/* Dark Overlay */}
              {darkOverlayDecimal > 0 && (
                <div 
                  className="absolute inset-0 bg-black pointer-events-none"
                  style={{ opacity: darkOverlayDecimal }}
                />
              )}
              
              {/* Color Overlay - uses overlayColor with colorOverlayOpacity */}
              {block.overlayColor && colorOverlayDecimal > 0 && (
                <div 
                  className="absolute inset-0 pointer-events-none"
                  style={{ 
                    backgroundColor: block.overlayColor,
                    opacity: colorOverlayDecimal
                  }}
                />
              )}
            </div>
          ) : (
            <ImageSourcePicker
              onSelectCollection={handleSelectCollection}
              onUpload={handleUpload}
              onGenerateAI={handleGenerateAI}
            />
          )}
        </div>
      ) : null}

      {/* CTA Button */}
      <CTAButton block={block} className="justify-center" />

      {/* Hidden file input for uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* AI Image Generation Dialog */}
      <AIPersonalizationDialog
        open={showAIDialog}
        onOpenChange={setShowAIDialog}
        onImageSelect={handleAIImageSelected}
        contentContext={'Newsletter image'}
        blockId={block.id}
      />
    </div>
  );
};
