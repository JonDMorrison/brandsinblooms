import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

interface InlineStyleEditorProps {
  backgroundColor?: string;
  textAlign?: string;
  layout?: string;
  onBackgroundColorChange?: (color: string) => void;
  onTextAlignChange?: (align: string) => void;
  onLayoutChange?: (layout: string) => void;
  onSave: () => void;
  onCancel: () => void;
  showLayoutOptions?: boolean;
  className?: string;
}

export const InlineStyleEditor: React.FC<InlineStyleEditorProps> = ({
  backgroundColor,
  textAlign,
  layout,
  onBackgroundColorChange,
  onTextAlignChange,
  onLayoutChange,
  onSave,
  onCancel,
  showLayoutOptions = false,
  className = ""
}) => {
  return (
    <Card className={`p-3 shadow-lg border-2 border-primary/20 ${className}`}>
      <div className="space-y-4">
        {showLayoutOptions && onLayoutChange && (
          <div className="flex items-center space-x-2">
            <Switch
              checked={layout === 'text-left'}
              onCheckedChange={(checked) => 
                onLayoutChange(checked ? 'text-left' : 'image-left')
              }
            />
            <Label>Image on right side</Label>
          </div>
        )}

        {onTextAlignChange && (
          <div className="space-y-2">
            <Label>Text Alignment</Label>
            <Select
              value={textAlign || 'left'}
              onValueChange={onTextAlignChange}
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
        )}

        {onBackgroundColorChange && (
          <div className="space-y-2">
            <Label>Background Color</Label>
            <Input
              type="color"
              value={backgroundColor || '#ffffff'}
              onChange={(e) => onBackgroundColorChange(e.target.value)}
            />
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSave}>
            Save
          </Button>
        </div>
      </div>
    </Card>
  );
};