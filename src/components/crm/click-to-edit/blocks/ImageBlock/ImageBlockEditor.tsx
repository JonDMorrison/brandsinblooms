import React, { useCallback } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MediaSelectorImage } from '@/components/crm/MediaSelectorImage';

interface ImageBlockEditorProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
}

export const ImageBlockEditor: React.FC<ImageBlockEditorProps> = ({ 
  block, 
  onUpdate 
}) => {
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
          <MediaSelectorImage
            src={block.imageUrl}
            onChange={handleImageChange}
            contentContext="Email newsletter image"
            className="w-full"
          />
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
        <Select
          value={block.textAlign || 'center'}
          onValueChange={handleAlignmentChange}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};