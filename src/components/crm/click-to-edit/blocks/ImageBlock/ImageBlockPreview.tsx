import React, { useState, useCallback } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import { InlineImageEditor } from '../../inline/InlineImageEditor';
import { InlineStyleEditor } from '../../inline/InlineStyleEditor';
import { CTAButton } from '@/components/ui/CTAButton';
import { cn } from '@/lib/utils';

interface ImageBlockPreviewProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
}

type InlineEditMode = 'image' | 'style' | null;

export const ImageBlockPreview: React.FC<ImageBlockPreviewProps> = ({ 
  block, 
  onUpdate 
}) => {
  const [inlineEditMode, setInlineEditMode] = useState<InlineEditMode>(null);

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
    onUpdate({ imageUrl });
  }, [onUpdate]);

  const handleBackgroundColorChange = useCallback((color: string) => {
    onUpdate({ backgroundColor: color });
  }, [onUpdate]);

  const handleLayoutChange = useCallback((layout: string) => {
    // When switching to two-column layout, change block type to image-text
    const updates: Partial<ContentBlock> = { layout: layout as any };
    if (layout === 'two-column-left' || layout === 'two-column-right') {
      updates.type = 'image-text';
    }
    onUpdate(updates);
  }, [onUpdate]);

  const handleTextAlignChange = useCallback((align: string) => {
    onUpdate({ textAlign: align as any });
  }, [onUpdate]);

  return (
    <div className={cn(
      "relative p-6 group",
      block.textAlign === 'center' && "text-center",
      block.textAlign === 'right' && "text-right"
    )}>
      {/* Settings button - appears on hover in top right */}
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-40"
        onClick={(e) => handleInlineEdit('style', e)}
        aria-label="Edit image block style"
      >
        <Settings className="h-4 w-4" />
      </Button>

      {/* Image with inline editing */}
      {inlineEditMode === 'image' ? (
        <div className="relative z-50">
          <InlineImageEditor
            imageUrl={block.imageUrl}
            onChange={handleImageChange}
            onSave={handleInlineSave}
            onCancel={handleInlineCancel}
            contentContext="Email newsletter image"
            backgroundColor={block.backgroundColor}
            onBackgroundColorChange={handleBackgroundColorChange}
            layout={block.layout as 'image-left' | 'two-column-left' | 'two-column-right'}
            onLayoutChange={handleLayoutChange}
            showLayoutControls={block.layout === 'two-column-left' || block.layout === 'two-column-right'}
          />
        </div>
      ) : (
        <div 
          className="cursor-pointer hover:opacity-80 transition-opacity"
          onClick={(e) => handleInlineEdit('image', e)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleInlineEdit('image', e as any);
            }
          }}
          aria-label="Click to edit image"
        >
          {block.imageUrl ? (
            <img
              src={block.imageUrl}
              alt={block.altText || 'Newsletter image'}
              className="max-w-full h-auto rounded-lg"
              loading="lazy"
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

      {/* CTA Button */}
      <CTAButton block={block} className="justify-center" />

      {/* Style editor overlay */}
      {inlineEditMode === 'style' && (
        <div className="absolute top-2 right-2 z-50">
          <InlineStyleEditor
            textAlign={block.textAlign}
            onTextAlignChange={handleTextAlignChange}
            onSave={handleInlineSave}
            onCancel={handleInlineCancel}
          />
        </div>
      )}
    </div>
  );
};