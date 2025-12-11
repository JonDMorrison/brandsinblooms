import React, { useCallback } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/NativeSelect';
import { Slider } from '@/components/ui/slider';
import { MediaSelectorImage } from '@/components/crm/MediaSelectorImage';
import { useBlockImageGeneration } from '@/hooks/useBlockImageGeneration';
import { AIImageLoadingOverlay } from '@/components/ui/AIImageLoadingOverlay';

interface ImageBlockEditorProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  isGenerating?: boolean;
}

export const ImageBlockEditor: React.FC<ImageBlockEditorProps> = ({ 
  block, 
  onUpdate,
  isGenerating = false
}) => {
  // Use AI image generation for standalone image blocks
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

  return (
    <div className="space-y-6 pb-4 relative">
      <div className="space-y-2 relative z-10">
        <Label>Image</Label>
        <div className="w-full relative">
          {isGeneratingImage && (
            <div className="relative w-full h-64 rounded-lg bg-muted mb-4">
              <AIImageLoadingOverlay message="Generating Images" />
            </div>
          )}
          {!isGeneratingImage && (
            <MediaSelectorImage
              src={block.imageUrl}
              onChange={handleImageChange}
              contentContext="Email newsletter image"
              className="w-full"
            />
          )}
        </div>
      </div>

      {/* Image Opacity - only show when image exists */}
      {block.imageUrl && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="imageOpacity">Image Opacity</Label>
            <span className="text-sm text-muted-foreground">{block.backgroundOpacity || 100}%</span>
          </div>
          <Slider
            value={[block.backgroundOpacity || 100]}
            onValueChange={(value) => onUpdate({ backgroundOpacity: value[0] })}
            max={100}
            min={1}
            step={1}
            className="w-full"
          />
        </div>
      )}

      {/* Dark Overlay - only show when image exists */}
      {block.imageUrl && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="darkOverlay">Dark Overlay</Label>
            <span className="text-sm text-muted-foreground">{block.darkOverlayOpacity || 0}%</span>
          </div>
          <Slider
            id="darkOverlay"
            value={[block.darkOverlayOpacity || 0]}
            onValueChange={(value) => onUpdate({ darkOverlayOpacity: value[0] })}
            max={100}
            min={0}
            step={1}
            className="w-full"
          />
        </div>
      )}

      {/* Color Overlay Section */}
      <div className="space-y-4 pt-2 border-t">
        <Label className="text-sm font-semibold">Color Overlay</Label>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="bgColor">Overlay Color</Label>
            <div className="flex items-center gap-2">
              <Input
                id="bgColor"
                type="color"
                value={block.backgroundColor || '#000000'}
                onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
                className="w-16 h-10 p-1 border rounded"
              />
              <Input
                value={block.backgroundColor || '#000000'}
                onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
                placeholder="#000000"
                className="flex-1"
              />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="colorOpacity">Overlay Opacity</Label>
              <span className="text-sm text-muted-foreground">{block.colorOverlayOpacity || 0}%</span>
            </div>
            <Slider
              value={[block.colorOverlayOpacity || 0]}
              onValueChange={(value) => onUpdate({ colorOverlayOpacity: value[0] })}
              max={100}
              min={0}
              step={1}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Image Overlay Section */}
      <div className="space-y-4 pt-2 border-t">
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Image Overlay (Optional)</Label>
          <p className="text-xs text-muted-foreground">
            Add a custom color overlay on top of your image
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="overlayColor">Overlay Color</Label>
            <div className="flex items-center gap-2">
              <Input
                id="overlayColor"
                type="color"
                value={block.overlayColor || '#000000'}
                onChange={(e) => onUpdate({ overlayColor: e.target.value })}
                className="w-16 h-10 p-1 border rounded"
              />
              <Input
                value={block.overlayColor || '#000000'}
                onChange={(e) => onUpdate({ overlayColor: e.target.value })}
                placeholder="#000000"
                className="flex-1"
              />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="overlayOpacity">Overlay Opacity</Label>
              <span className="text-sm text-muted-foreground">{block.overlayOpacity || 0}%</span>
            </div>
            <Slider
              id="overlayOpacity"
              value={[block.overlayOpacity || 0]}
              onValueChange={(value) => onUpdate({ overlayOpacity: value[0] })}
              max={100}
              min={0}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Set to 0 to disable overlay
            </p>
          </div>
        </div>
      </div>

      {/* Aspect Ratio */}
      <div className="space-y-2">
        <Label>Aspect Ratio</Label>
        <NativeSelect
          value={block.aspectRatio || 'auto'}
          onChange={(e) => onUpdate({ aspectRatio: e.target.value as any })}
          options={[
            { value: 'auto', label: 'Auto (Natural)' },
            { value: '16:9', label: '16:9 (Widescreen)' },
            { value: '4:3', label: '4:3 (Standard)' },
            { value: '1:1', label: '1:1 (Square)' },
            { value: '4:5', label: '4:5 (Portrait)' }
          ]}
        />
        <p className="text-xs text-muted-foreground">Fixed ratios ensure images fill the frame completely</p>
      </div>
    </div>
  );
};
