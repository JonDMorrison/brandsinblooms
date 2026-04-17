import React, { useCallback } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/NativeSelect';
import { MediaSelectorImage } from '@/components/crm/MediaSelectorImage';
import { useBlockImageGeneration } from '@/hooks/useBlockImageGeneration';
import { AIImageLoadingOverlay } from '@/components/ui/AIImageLoadingOverlay';
import { TipBox } from '@/components/ui/TipBox';
import { cn } from '@/lib/utils';

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
  const { isGeneratingImage } = useBlockImageGeneration({
    blockId: block.id,
    blockType: block.type,
    content: 'Newsletter image',
    currentImageUrl: block.imageUrl,
    isContentGenerating: isGenerating,
    onImageReady: (imageUrl, metadata) => {
      onUpdate({
        imageUrl,
        altText: metadata?.alt || 'AI generated image'
      });
    },
    enabled: false
  });

  const handleImageChange = useCallback((imageUrl: string) => {
    onUpdate({
      imageUrl,
      autoImageMode: false,
      shouldFetchImage: false,
      isGeneratingImage: false
    });
  }, [onUpdate]);

  const borderRadiusValue = (block as any).imageBorderRadius || 'none';
  const maxWidthValue = (block as any).imageMaxWidth || 'full';

  return (
    <div className="space-y-6 pb-4 relative">
      <div className="space-y-1 relative z-10">
        <Label>Image</Label>
        <TipBox>Use images at least 600px wide for sharp rendering in all email clients</TipBox>
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

      {/* Border Radius */}
      <div className="space-y-2">
        <Label>Corner Rounding</Label>
        <div className="grid grid-cols-4 gap-2">
          {([
            { value: 'none', label: 'None', css: '0px' },
            { value: 'soft', label: 'Soft', css: '8px' },
            { value: 'round', label: 'Round', css: '16px' },
            { value: 'circle', label: 'Circle', css: '50%' },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onUpdate({ imageBorderRadius: opt.value } as any)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border-2 px-2 py-2 text-xs font-medium transition-all",
                borderRadiusValue === opt.value
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-background text-muted-foreground hover:border-primary/40",
              )}
            >
              <div
                className="h-6 w-full bg-muted-foreground/20"
                style={{ borderRadius: opt.css === '50%' ? '50%' : opt.css }}
              />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Max Width */}
      <div className="space-y-2">
        <Label>Image Size</Label>
        <div className="grid grid-cols-4 gap-2">
          {([
            { value: 'full', label: 'Full', pct: '100%' },
            { value: 'large', label: 'Large', pct: '80%' },
            { value: 'medium', label: 'Medium', pct: '60%' },
            { value: 'small', label: 'Small', pct: '40%' },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onUpdate({ imageMaxWidth: opt.value } as any)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border-2 px-2 py-2 text-xs font-medium transition-all",
                maxWidthValue === opt.value
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-background text-muted-foreground hover:border-primary/40",
              )}
            >
              <div className="h-4 flex items-end justify-center w-full">
                <div
                  className="h-3 bg-muted-foreground/20 rounded-sm"
                  style={{ width: opt.pct }}
                />
              </div>
              {opt.label}
            </button>
          ))}
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
      </div>
    </div>
  );
};
