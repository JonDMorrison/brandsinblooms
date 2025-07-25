import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DividerBlockProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  isPreview: boolean;
}

export const DividerBlock: React.FC<DividerBlockProps> = ({ block, onUpdate, isPreview }) => {
  const thickness = block.dividerThickness || 1;
  const color = block.dividerColor || '#e5e7eb';
  const paddingTop = block.paddingTop || 20;
  const paddingBottom = block.paddingBottom || 20;

  if (isPreview) {
    return (
      <div 
        style={{ 
          paddingTop: `${paddingTop}px`, 
          paddingBottom: `${paddingBottom}px` 
        }}
      >
        <hr 
          style={{ 
            height: `${thickness}px`,
            backgroundColor: color,
            border: 'none',
            margin: 0
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Line Thickness</Label>
          <Select
            value={String(thickness)}
            onValueChange={(value) => onUpdate({ dividerThickness: Number(value) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1px</SelectItem>
              <SelectItem value="2">2px</SelectItem>
              <SelectItem value="3">3px</SelectItem>
              <SelectItem value="4">4px</SelectItem>
              <SelectItem value="5">5px</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="color">Line Color</Label>
          <Input
            id="color"
            type="color"
            value={color}
            onChange={(e) => onUpdate({ dividerColor: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="paddingTop">Padding Above (px)</Label>
          <Input
            id="paddingTop"
            type="number"
            value={paddingTop}
            onChange={(e) => onUpdate({ paddingTop: Number(e.target.value) })}
            min="0"
            max="100"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="paddingBottom">Padding Below (px)</Label>
          <Input
            id="paddingBottom"
            type="number"
            value={paddingBottom}
            onChange={(e) => onUpdate({ paddingBottom: Number(e.target.value) })}
            min="0"
            max="100"
          />
        </div>
      </div>
    </div>
  );
};