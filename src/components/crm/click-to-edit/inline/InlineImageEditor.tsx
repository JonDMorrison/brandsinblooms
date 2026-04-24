import React from 'react';
import { Card } from '@/components/ui-legacy/card';
import { Button } from '@/components/ui-legacy/button';
import { Input } from '@/components/ui-legacy/input';
import { Label } from '@/components/ui-legacy/label';
import { Slider } from '@/components/ui-legacy/slider';
import { MediaSelectorImage } from '@/components/crm/MediaSelectorImage';

interface InlineImageEditorProps {
  imageUrl?: string;
  onChange: (imageUrl: string) => void;
  onSave: () => void;
  onCancel: () => void;
  contentContext?: string;
  className?: string;
  // Overlay controls (sits ON TOP of the image)
  overlayColor?: string;
  overlayOpacity?: number;
  onOverlayColorChange?: (color: string) => void;
  onOverlayOpacityChange?: (opacity: number) => void;
  // Background color (sits BEHIND the image/container)
  backgroundColor?: string;
  onBackgroundColorChange?: (color: string) => void;
}

export const InlineImageEditor: React.FC<InlineImageEditorProps> = ({
  imageUrl,
  onChange,
  onSave,
  onCancel,
  contentContext = "Email content image",
  className = "",
  overlayColor,
  overlayOpacity = 0,
  onOverlayColorChange,
  onOverlayOpacityChange,
  backgroundColor,
  onBackgroundColorChange
}) => {
  const handleImageChange = (newImageUrl: string) => {
    onChange(newImageUrl);
    // Auto-save on image selection for better UX
    onSave();
  };

  return (
    <Card className={`p-4 shadow-lg border-2 border-primary/20 ${className}`}>
      <div className="space-y-4">
        <div className="text-sm font-medium text-center mb-3">
          Edit Image & Styling
        </div>
        
        <MediaSelectorImage
          src={imageUrl}
          onChange={handleImageChange}
          contentContext={contentContext}
          className="w-full h-64"
        />

        {/* Color Overlay Section */}
        {(onOverlayColorChange || onOverlayOpacityChange) && (
          <div className="space-y-3 pt-3 border-t border-border/50">
            <Label className="text-xs font-medium text-foreground/80">Color Overlay</Label>
            
            <div className="flex items-center gap-3">
              <Input
                type="color"
                value={overlayColor || '#000000'}
                onChange={(e) => onOverlayColorChange?.(e.target.value)}
                className="w-9 h-9 p-0.5 border border-border rounded-md cursor-pointer shrink-0"
              />
              <Input
                value={overlayColor || '#000000'}
                onChange={(e) => onOverlayColorChange?.(e.target.value)}
                className="w-24 h-9 text-xs font-mono shrink-0"
              />
            </div>
            
            <div className="flex items-center gap-3">
              <Slider
                value={[overlayOpacity]}
                onValueChange={(value) => onOverlayOpacityChange?.(value[0])}
                max={100}
                min={0}
                step={1}
                className="flex-1"
              />
              <span className="text-xs font-medium text-muted-foreground w-10 text-right tabular-nums shrink-0">
                {overlayOpacity}%
              </span>
            </div>
            
            <p className="text-[11px] text-muted-foreground">
              Tints the image with this color
            </p>
          </div>
        )}

        {/* Background Color Section */}
        {onBackgroundColorChange && (
          <div className="space-y-2 pt-3 border-t border-dashed border-border/40">
            <Label className="text-xs font-medium text-foreground/80">Background Color</Label>
            
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={backgroundColor || '#ffffff'}
                onChange={(e) => onBackgroundColorChange(e.target.value)}
                className="w-9 h-9 p-0.5 border border-border rounded-md cursor-pointer shrink-0"
              />
              <Input
                value={backgroundColor || '#ffffff'}
                onChange={(e) => onBackgroundColorChange(e.target.value)}
                className="w-[90px] h-9 text-xs font-mono"
              />
            </div>
            
            <p className="text-[11px] text-muted-foreground">
              Shows behind the image
            </p>
          </div>
        )}
        
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSave}>
            Save & Close
          </Button>
        </div>
      </div>
    </Card>
  );
};
