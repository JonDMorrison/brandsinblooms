import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { MediaSelectorImage } from '@/components/crm/MediaSelectorImage';
import { cn } from '@/lib/utils';

interface ImageTextBlockProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  isPreview: boolean;
}

export const ImageTextBlock: React.FC<ImageTextBlockProps> = ({ block, onUpdate, isPreview }) => {
  const isImageLeft = block.layout === 'image-left' || !block.layout;

  if (isPreview) {
    return (
      <div 
        className="p-6 rounded-lg"
        style={{ backgroundColor: block.backgroundColor || 'transparent' }}
      >
        <div className={cn(
          "grid gap-6 items-center",
          isImageLeft ? "md:grid-cols-2" : "md:grid-cols-2"
        )}>
          {/* Content - shown first on mobile, positioned based on layout on desktop */}
          <div className={cn(
            "space-y-4",
            !isImageLeft && "md:order-1",
            block.textAlign === 'center' && "text-center",
            block.textAlign === 'right' && "text-right"
          )}>
            {block.headline && (
              <h2 className="text-2xl font-bold">
                {block.headline}
              </h2>
            )}
            {block.body && (
              <p className="text-muted-foreground">
                {block.body}
              </p>
            )}
          </div>

          {/* Image */}
          <div className={cn(!isImageLeft && "md:order-2")}>
            {block.imageUrl ? (
              <img
                src={block.imageUrl}
                alt={block.altText || ''}
                className="w-full h-auto rounded-lg"
              />
            ) : (
              <div className="bg-muted rounded-lg aspect-video flex items-center justify-center text-muted-foreground">
                No image selected
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <Switch
          checked={!isImageLeft}
          onCheckedChange={(checked) => 
            onUpdate({ layout: checked ? 'text-left' : 'image-left' })
          }
        />
        <Label>Image on right side</Label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="headline">Headline</Label>
          <Input
            id="headline"
            value={block.headline || ''}
            onChange={(e) => onUpdate({ headline: e.target.value })}
            placeholder="Enter headline"
          />
        </div>
        <div className="space-y-2">
          <Label>Text Alignment</Label>
          <Select
            value={block.textAlign || 'left'}
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

      <div className="space-y-2">
        <Label htmlFor="body">Body Text</Label>
        <Textarea
          id="body"
          value={block.body || ''}
          onChange={(e) => onUpdate({ body: e.target.value })}
          placeholder="Enter body text"
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label>Image</Label>
        <MediaSelectorImage
          src={block.imageUrl}
          onChange={(imageUrl) => onUpdate({ imageUrl })}
          className="h-32"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="altText">Alt Text</Label>
          <Input
            id="altText"
            value={block.altText || ''}
            onChange={(e) => onUpdate({ altText: e.target.value })}
            placeholder="Describe the image"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bgColor">Background Color</Label>
          <Input
            id="bgColor"
            type="color"
            value={block.backgroundColor || '#ffffff'}
            onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
};