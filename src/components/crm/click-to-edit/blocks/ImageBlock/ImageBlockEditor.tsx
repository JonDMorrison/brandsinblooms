import React, { useCallback } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/NativeSelect';
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

  const handleImageChange = useCallback((imageUrl: string) => {
    onUpdate({ imageUrl });
  }, [onUpdate]);

  const handleCaptionChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ caption: e.target.value });
  }, [onUpdate]);

  const handleAltTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onUpdate({ altText: e.target.value });
  }, [onUpdate]);

  const handleAlignmentChange = useCallback((value: string) => {
    onUpdate({ textAlign: value as any });
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

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="caption">Caption (Optional)</Label>
          <Input
            id="caption"
            value={block.caption || ''}
            onChange={handleCaptionChange}
            placeholder="Enter image caption"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="altText">Alt Text</Label>
          <Input
            id="altText"
            value={block.altText || ''}
            onChange={handleAltTextChange}
            placeholder="Describe the image"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Image Alignment</Label>
        <NativeSelect
          value={block.textAlign || 'center'}
          onChange={(e) => handleAlignmentChange(e.target.value)}
          options={[
            { value: 'left', label: 'Left' },
            { value: 'center', label: 'Center' },
            { value: 'right', label: 'Right' }
          ]}
        />
      </div>
    </div>
  );
};