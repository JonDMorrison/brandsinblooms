import React, { useState } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MediaSelectorImage } from '@/components/crm/MediaSelectorImage';
import { InlineImageEditor } from '../inline/InlineImageEditor';
import { InlineStyleEditor } from '../inline/InlineStyleEditor';
import { cn } from '@/lib/utils';

interface ImageBlockProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  isPreview: boolean;
}

type InlineEditMode = 'image' | 'style' | null;

export const ImageBlock: React.FC<ImageBlockProps> = ({ block, onUpdate, isPreview }) => {
  const [inlineEditMode, setInlineEditMode] = useState<InlineEditMode>(null);

  const handleInlineEdit = (mode: InlineEditMode, event: React.MouseEvent) => {
    event.stopPropagation();
    setInlineEditMode(mode);
  };

  const handleInlineSave = () => {
    setInlineEditMode(null);
  };

  const handleInlineCancel = () => {
    setInlineEditMode(null);
  };

  if (isPreview) {
    return (
      <div className={cn(
        "relative p-6",
        block.textAlign === 'center' && "text-center",
        block.textAlign === 'right' && "text-right"
      )}
      onClick={(e) => handleInlineEdit('style', e)}
      >
        {/* Image with inline editing */}
        {inlineEditMode === 'image' ? (
          <div className="relative z-50">
            <InlineImageEditor
              imageUrl={block.imageUrl}
              onChange={(imageUrl) => onUpdate({ imageUrl })}
              onSave={handleInlineSave}
              onCancel={handleInlineCancel}
              contentContext="Email newsletter image"
            />
          </div>
        ) : (
          <div 
            className="cursor-pointer hover:opacity-80 transition-opacity"
            onClick={(e) => handleInlineEdit('image', e)}
          >
            {block.imageUrl ? (
              <img
                src={block.imageUrl}
                alt={block.altText || ''}
                className="max-w-full h-auto rounded-lg"
              />
            ) : (
              <div className="bg-muted rounded-lg aspect-video flex items-center justify-center text-muted-foreground hover:bg-muted/80">
                Click to add image
              </div>
            )}
          </div>
        )}
        
        {block.caption && (
          <p className="mt-3 text-sm text-muted-foreground italic">
            {block.caption}
          </p>
        )}

        {/* Style editor overlay */}
        {inlineEditMode === 'style' && (
          <div className="absolute top-2 right-2 z-50">
            <InlineStyleEditor
              textAlign={block.textAlign}
              onTextAlignChange={(align) => onUpdate({ textAlign: align as any })}
              onSave={handleInlineSave}
              onCancel={handleInlineCancel}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-4 relative">
      <div className="space-y-2 relative z-10">
        <Label>Image</Label>
        <div className="w-full relative">
          <MediaSelectorImage
            src={block.imageUrl}
            onChange={(imageUrl) => onUpdate({ imageUrl })}
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
            onChange={(e) => onUpdate({ caption: e.target.value })}
            placeholder="Enter image caption"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="altText">Alt Text</Label>
          <Input
            id="altText"
            value={block.altText || ''}
            onChange={(e) => onUpdate({ altText: e.target.value })}
            placeholder="Describe the image"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Image Alignment</Label>
        <Select
          value={block.textAlign || 'center'}
          onValueChange={(value) => onUpdate({ textAlign: value as any })}
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