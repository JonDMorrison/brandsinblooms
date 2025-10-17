import React, { useState } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';

interface ImageOverlayDialogProps {
  isOpen: boolean;
  onClose: () => void;
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
}

export const ImageOverlayDialog: React.FC<ImageOverlayDialogProps> = ({
  isOpen,
  onClose,
  block,
  onUpdate
}) => {
  const [overlayOpacity, setOverlayOpacity] = useState(block.overlayOpacity || 0);
  const [overlayColor, setOverlayColor] = useState(block.overlayColor || '#000000');

  const handleSave = () => {
    onUpdate({
      overlayOpacity,
      overlayColor
    });
    onClose();
  };

  const imageUrl = block.imageUrl || block.backgroundImageUrl;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Image Overlay</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Image Preview */}
          {imageUrl && (
            <div className="relative w-full aspect-video rounded-lg overflow-hidden border">
              <img
                src={imageUrl}
                alt="Preview"
                className="w-full h-full object-cover"
              />
              {/* Overlay Preview */}
              {overlayOpacity > 0 && (
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundColor: overlayColor,
                    opacity: overlayOpacity / 100
                  }}
                />
              )}
            </div>
          )}

          {/* Overlay Color Picker */}
          <div className="space-y-2">
            <Label htmlFor="overlayColor">Overlay Color</Label>
            <div className="flex gap-2 items-center">
              <Input
                id="overlayColor"
                type="color"
                value={overlayColor}
                onChange={(e) => setOverlayColor(e.target.value)}
                className="w-20 h-10 cursor-pointer"
              />
              <Input
                type="text"
                value={overlayColor}
                onChange={(e) => setOverlayColor(e.target.value)}
                placeholder="#000000"
                className="flex-1"
              />
            </div>
          </div>

          {/* Overlay Opacity Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="overlayOpacity">Overlay Opacity</Label>
              <span className="text-sm text-muted-foreground">{overlayOpacity}%</span>
            </div>
            <Slider
              id="overlayOpacity"
              value={[overlayOpacity]}
              onValueChange={(value) => setOverlayOpacity(value[0])}
              max={100}
              min={0}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Adjust the opacity to control how much the overlay affects the image
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Apply Overlay
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
