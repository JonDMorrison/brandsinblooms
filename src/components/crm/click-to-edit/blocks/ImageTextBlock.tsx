import React, { useState } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import { MediaSelectorImage } from '@/components/crm/MediaSelectorImage';
import { InlineTextEditor } from '../inline/InlineTextEditor';
import { InlineStyleEditor } from '../inline/InlineStyleEditor';
import { cn } from '@/lib/utils';

interface ImageTextBlockProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  isPreview: boolean;
}

type InlineEditMode = 'headline' | 'body' | 'style' | null;

export const ImageTextBlock: React.FC<ImageTextBlockProps> = ({ block, onUpdate, isPreview }) => {
  const [inlineEditMode, setInlineEditMode] = useState<InlineEditMode>(null);

  // Debug logging for image rendering
  console.log('🖼️ ImageTextBlock render:', {
    blockId: block.id,
    imageUrl: block.imageUrl,
    altText: block.altText,
    isPreview,
    hasImageUrl: !!block.imageUrl
  });
  const isImageLeft = block.layout === 'image-left' || !block.layout;

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
      <div 
        className="relative p-6 rounded-lg group"
        style={{ backgroundColor: block.backgroundColor || 'transparent' }}
      >
        {/* Settings button - appears on hover in top right */}
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-40"
          onClick={(e) => handleInlineEdit('style', e)}
        >
          <Settings className="h-4 w-4" />
        </Button>
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
            {/* Headline with inline editing */}
            {inlineEditMode === 'headline' ? (
              <div className="relative z-50">
                <InlineTextEditor
                  value={block.headline || ''}
                  onChange={(value) => onUpdate({ headline: value })}
                  onSave={handleInlineSave}
                  onCancel={handleInlineCancel}
                  placeholder="Enter headline"
                />
              </div>
            ) : (
              <h2 
                className="text-2xl font-bold cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors"
                onClick={(e) => handleInlineEdit('headline', e)}
              >
                {block.headline || 'Click to add headline'}
              </h2>
            )}
            
            {/* Body text with inline editing */}
            {inlineEditMode === 'body' ? (
              <div className="relative z-50">
                <InlineTextEditor
                  value={block.body || ''}
                  onChange={(value) => onUpdate({ body: value })}
                  onSave={handleInlineSave}
                  onCancel={handleInlineCancel}
                  placeholder="Enter body text"
                  multiline={true}
                />
              </div>
            ) : (
              <div 
                className="text-muted-foreground whitespace-pre-wrap cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors"
                onClick={(e) => handleInlineEdit('body', e)}
              >
                {block.body || 'Click to add body text'}
              </div>
            )}
          </div>

          {/* Image with direct MediaSelectorImage */}
          <div className={cn(!isImageLeft && "md:order-2", "relative")}>
            <MediaSelectorImage
              src={block.imageUrl}
              onChange={(imageUrl) => onUpdate({ imageUrl })}
              contentContext="Email newsletter image"
              className="w-full h-auto rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
            />
          </div>
        </div>

        {/* Style editor overlay */}
        {inlineEditMode === 'style' && (
          <div className="absolute top-2 right-2 z-50">
            <InlineStyleEditor
              backgroundColor={block.backgroundColor}
              textAlign={block.textAlign}
              layout={block.layout}
              onBackgroundColorChange={(color) => onUpdate({ backgroundColor: color })}
              onTextAlignChange={(align) => onUpdate({ textAlign: align as any })}
              onLayoutChange={(layout) => onUpdate({ layout: layout as any })}
              onSave={handleInlineSave}
              onCancel={handleInlineCancel}
              showLayoutOptions={true}
            />
          </div>
        )}
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