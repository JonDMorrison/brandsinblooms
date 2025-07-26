import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MediaSelectorImage } from '@/components/crm/MediaSelectorImage';
import { cn } from '@/lib/utils';

interface ImageBlockProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  isPreview: boolean;
}

export const ImageBlock: React.FC<ImageBlockProps> = ({ block, onUpdate, isPreview }) => {
  if (isPreview) {
    return (
      <div className={cn(
        "p-6",
        block.textAlign === 'center' && "text-center",
        block.textAlign === 'right' && "text-right"
      )}>
        {block.imageUrl ? (
          <img
            src={block.imageUrl}
            alt={block.altText || ''}
            className="max-w-full h-auto rounded-lg"
          />
        ) : (
          <div className="bg-muted rounded-lg aspect-video flex items-center justify-center text-muted-foreground">
            No image selected
          </div>
        )}
        {block.caption && (
          <p className="mt-3 text-sm text-muted-foreground italic">
            {block.caption}
          </p>
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