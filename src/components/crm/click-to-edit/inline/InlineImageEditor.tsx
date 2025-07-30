import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { MediaSelectorImage } from '@/components/crm/MediaSelectorImage';

interface InlineImageEditorProps {
  imageUrl?: string;
  onChange: (imageUrl: string) => void;
  onSave: () => void;
  onCancel: () => void;
  contentContext?: string;
  className?: string;
  // Background and layout controls
  backgroundColor?: string;
  onBackgroundColorChange?: (color: string) => void;
  layout?: 'image-left' | 'two-column-left' | 'two-column-right';
  onLayoutChange?: (layout: 'image-left' | 'two-column-left' | 'two-column-right') => void;
  showLayoutControls?: boolean;
}

export const InlineImageEditor: React.FC<InlineImageEditorProps> = ({
  imageUrl,
  onChange,
  onSave,
  onCancel,
  contentContext = "Email content image",
  className = "",
  backgroundColor,
  onBackgroundColorChange,
  layout,
  onLayoutChange,
  showLayoutControls = false
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
          Edit Image & Background
        </div>
        
        <MediaSelectorImage
          src={imageUrl}
          onChange={handleImageChange}
          contentContext={contentContext}
          className="w-full h-64"
        />

        {/* Image Layout Controls */}
        {showLayoutControls && imageUrl && onLayoutChange && (
          <div className="space-y-3">
            <Label>Image Layout</Label>
            <div className="flex items-center space-x-2">
              <Switch
                checked={layout === 'two-column-right'}
                onCheckedChange={(checked) => {
                  const newLayout = checked ? 'two-column-right' : 'two-column-left';
                  onLayoutChange(newLayout);
                }}
              />
              <Label>Image on right side</Label>
            </div>
          </div>
        )}

        {/* Background Color */}
        {onBackgroundColorChange && (
          <div className="space-y-2">
            <Label htmlFor="bgColor">Background Color</Label>
            <div className="flex items-center gap-2">
              <Input
                id="bgColor"
                type="color"
                value={backgroundColor || '#ffffff'}
                onChange={(e) => onBackgroundColorChange(e.target.value)}
                className="w-16 h-10 p-1 border rounded"
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