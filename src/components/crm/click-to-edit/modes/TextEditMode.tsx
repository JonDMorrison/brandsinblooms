import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface TextEditModeProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  onSave?: () => void;
  onCancel?: () => void;
}

export const TextEditMode: React.FC<TextEditModeProps> = ({
  block,
  onUpdate,
  onSave,
  onCancel
}) => {
  const handleSave = () => {
    console.log('📝 TextEditMode: Save button clicked, current block data:', {
      id: block.id,
      type: block.type,
      title: block.title,
      headline: block.headline,
      content: block.content,
      body: block.body,
      ctaText: block.ctaText,
      ctaUrl: block.ctaUrl,
      buttonText: block.buttonText,
      buttonUrl: block.buttonUrl
    });
    onSave?.();
  };

  return (
    <Card className="p-4 space-y-4 shadow-lg border-2 border-primary/20">
      <div className="text-sm font-medium text-center mb-3">
        Edit Text Content
      </div>

      {/* Headline (for blocks that support it) */}
      {(block.type === 'header' || block.headline !== undefined || block.title !== undefined) && (
        <div className="space-y-2">
          <Label htmlFor="headline">Headline</Label>
          <Input
            id="headline"
            value={block.headline || block.title || ''}
            onChange={(e) => onUpdate({ 
              headline: e.target.value,
              title: e.target.value 
            })}
            placeholder="Enter headline"
            className="w-full"
          />
        </div>
      )}

      {/* Body Text (for blocks that support it) */}
      {(block.body !== undefined || block.content !== undefined) && (
        <div className="space-y-2">
          <Label htmlFor="bodyText">
            {block.body !== undefined ? 'Body Text' : 'Content'}
          </Label>
          <RichTextEditor
            content={block.body || block.content || ''}
            onChange={(html) => {
              if (block.body !== undefined) {
                onUpdate({ body: html });
              } else {
                onUpdate({ content: html });
              }
            }}
            placeholder={block.body !== undefined ? "Enter body text..." : "Enter content..."}
            className="w-full"
            autoFocus
          />
        </div>
      )}

      {/* Alt Text (for blocks with images) */}
      {block.imageUrl && (
        <div className="space-y-2">
          <Label htmlFor="altText">Image Alt Text</Label>
          <Input
            id="altText"
            value={block.altText || ''}
            onChange={(e) => onUpdate({ altText: e.target.value })}
            placeholder="Describe the image for accessibility"
          />
        </div>
      )}

      {/* CTA Text and URL (for blocks that support it) */}
      {(block.ctaText !== undefined || block.ctaUrl !== undefined || block.buttonText !== undefined || block.buttonUrl !== undefined || block.type === 'image' || block.type === 'image-text' || block.type === 'text') && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="ctaText">Button Text</Label>
            <Input
              id="ctaText"
              value={block.ctaText || block.buttonText || ''}
              onChange={(e) => onUpdate({ 
                ctaText: e.target.value,
                buttonText: e.target.value 
              })}
              placeholder="Enter button text"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ctaUrl">Button URL</Label>
            <Input
              id="ctaUrl"
              value={block.ctaUrl || block.buttonUrl || ''}
              onChange={(e) => onUpdate({ 
                ctaUrl: e.target.value,
                buttonUrl: e.target.value 
              })}
              placeholder="https://example.com"
            />
          </div>
        </div>
      )}

      {/* Save/Cancel Buttons */}
      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <Button 
          variant="outline" 
          size="sm"
          onClick={onCancel}
          className="px-4"
        >
          Cancel
        </Button>
        <Button 
          variant="default" 
          size="sm"
          onClick={handleSave}
          className="px-4"
        >
          Save & Close
        </Button>
      </div>
    </Card>
  );
};