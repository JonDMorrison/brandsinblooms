import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
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

        {/* Color Overlay Section - sits ON TOP of the image */}
        {(onOverlayColorChange || onOverlayOpacityChange) && (
          <div className="space-y-3 pt-3 border-t border-border">
            <Label className="text-sm font-medium">Color Overlay</Label>
            <p className="text-xs text-muted-foreground">Tints the image with this color</p>
            
            <div className="flex items-center gap-3">
              <Input
                type="color"
                value={overlayColor || '#000000'}
                onChange={(e) => onOverlayColorChange?.(e.target.value)}
                className="w-12 h-10 p-1 border rounded cursor-pointer"
              />
              <Input
                value={overlayColor || '#000000'}
                onChange={(e) => onOverlayColorChange?.(e.target.value)}
                placeholder="#000000"
                className="w-24"
              />
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Opacity</span>
                  <span className="text-xs font-medium">{overlayOpacity}%</span>
                </div>
                <Slider
                  value={[overlayOpacity]}
                  onValueChange={(value) => onOverlayOpacityChange?.(value[0])}
                  max={100}
                  min={0}
                  step={1}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        )}

        {/* Background Color Section - sits BEHIND the image */}
        {onBackgroundColorChange && (
          <div className="space-y-3 pt-3 border-t border-border">
            <Label className="text-sm font-medium">Background Color</Label>
            <p className="text-xs text-muted-foreground">Visible behind the image</p>
            
            <div className="flex items-center gap-3">
              <Input
                type="color"
                value={backgroundColor || '#ffffff'}
                onChange={(e) => onBackgroundColorChange(e.target.value)}
                className="w-12 h-10 p-1 border rounded cursor-pointer"
              />
              <Input
                value={backgroundColor || '#ffffff'}
                onChange={(e) => onBackgroundColorChange(e.target.value)}
                placeholder="#ffffff"
                className="flex-1"
              />
            </div>
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
