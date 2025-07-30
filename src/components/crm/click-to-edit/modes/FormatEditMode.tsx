import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';

interface FormatEditModeProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  onSave?: () => void;
  onCancel?: () => void;
}

export const FormatEditMode: React.FC<FormatEditModeProps> = ({
  block,
  onUpdate
}) => {
  const isImageLeft = block.layout === 'image-left' || block.layout === 'two-column-left';

  return (
    <Card className="p-4 space-y-4 shadow-lg border-2 border-primary/20">
      <div className="text-sm font-medium text-center mb-3">
        Format Block
      </div>

      {/* Layout Options (for blocks with images) */}
      {block.imageUrl && (
        <div className="space-y-3">
          <Label>Image Layout</Label>
          <div className="flex items-center space-x-2">
            <Switch
              checked={!isImageLeft}
              onCheckedChange={(checked) => {
                const newLayout = checked ? 'image-right' : 'image-left';
                onUpdate({ layout: newLayout as any });
              }}
            />
            <Label>Image on right side</Label>
          </div>
        </div>
      )}

      {/* Background Color */}
      <div className="space-y-2">
        <Label htmlFor="bgColor">Background Color</Label>
        <div className="flex items-center gap-2">
          <Input
            id="bgColor"
            type="color"
            value={block.backgroundColor || '#ffffff'}
            onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
            className="w-16 h-10 p-1 border rounded"
          />
          <Input
            value={block.backgroundColor || '#ffffff'}
            onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
            placeholder="#ffffff"
            className="flex-1"
          />
        </div>
      </div>

      {/* Padding */}
      <div className="space-y-2">
        <Label>Padding</Label>
        <Select
          value={block.padding || 'medium'}
          onValueChange={(value) => onUpdate({ padding: value as any })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="small">Small</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="large">Large</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Margin */}
      <div className="space-y-2">
        <Label>Margin</Label>
        <Select
          value={block.margin || 'medium'}
          onValueChange={(value) => onUpdate({ margin: value as any })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="small">Small</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="large">Large</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Font Size (for text blocks) */}
      {(block.type === 'text' || block.fontSize !== undefined) && (
        <div className="space-y-2">
          <Label>Font Size</Label>
          <Select
            value={block.fontSize || '16px'}
            onValueChange={(value) => onUpdate({ fontSize: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="12px">12px</SelectItem>
              <SelectItem value="14px">14px</SelectItem>
              <SelectItem value="16px">16px</SelectItem>
              <SelectItem value="18px">18px</SelectItem>
              <SelectItem value="20px">20px</SelectItem>
              <SelectItem value="24px">24px</SelectItem>
              <SelectItem value="32px">32px</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Font Family (for text blocks) */}
      {(block.type === 'text' || block.fontFamily !== undefined) && (
        <div className="space-y-2">
          <Label>Font Family</Label>
          <Select
            value={block.fontFamily || 'inherit'}
            onValueChange={(value) => onUpdate({ fontFamily: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">Default</SelectItem>
              <SelectItem value="Arial, sans-serif">Arial</SelectItem>
              <SelectItem value="Helvetica, sans-serif">Helvetica</SelectItem>
              <SelectItem value="Georgia, serif">Georgia</SelectItem>
              <SelectItem value="Times New Roman, serif">Times New Roman</SelectItem>
              <SelectItem value="Inter, sans-serif">Inter</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </Card>
  );
};