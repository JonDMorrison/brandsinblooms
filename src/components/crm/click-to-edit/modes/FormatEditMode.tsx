import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/NativeSelect';
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
        <NativeSelect
          value={block.padding || 'medium'}
          onChange={(e) => onUpdate({ padding: e.target.value as any })}
          options={[
            { value: 'none', label: 'None' },
            { value: 'small', label: 'Small' },
            { value: 'medium', label: 'Medium' },
            { value: 'large', label: 'Large' }
          ]}
        />
      </div>

      {/* Margin */}
      <div className="space-y-2">
        <Label>Margin</Label>
        <NativeSelect
          value={block.margin || 'medium'}
          onChange={(e) => onUpdate({ margin: e.target.value as any })}
          options={[
            { value: 'none', label: 'None' },
            { value: 'small', label: 'Small' },
            { value: 'medium', label: 'Medium' },
            { value: 'large', label: 'Large' }
          ]}
        />
      </div>

      {/* Font Size (for text blocks) */}
      {(block.type === 'text' || block.fontSize !== undefined) && (
        <div className="space-y-2">
          <Label>Font Size</Label>
          <NativeSelect
            value={block.fontSize || '16px'}
            onChange={(e) => onUpdate({ fontSize: e.target.value })}
            options={[
              { value: '12px', label: '12px' },
              { value: '14px', label: '14px' },
              { value: '16px', label: '16px' },
              { value: '18px', label: '18px' },
              { value: '20px', label: '20px' },
              { value: '24px', label: '24px' },
              { value: '32px', label: '32px' }
            ]}
          />
        </div>
      )}

      {/* Font Family (for text blocks) */}
      {(block.type === 'text' || block.fontFamily !== undefined) && (
        <div className="space-y-2">
          <Label>Font Family</Label>
          <NativeSelect
            value={block.fontFamily || 'inherit'}
            onChange={(e) => onUpdate({ fontFamily: e.target.value })}
            options={[
              { value: 'inherit', label: 'Default' },
              { value: 'Arial, sans-serif', label: 'Arial' },
              { value: 'Helvetica, sans-serif', label: 'Helvetica' },
              { value: 'Georgia, serif', label: 'Georgia' },
              { value: 'Times New Roman, serif', label: 'Times New Roman' },
              { value: 'Inter, sans-serif', label: 'Inter' }
            ]}
          />
        </div>
      )}
    </Card>
  );
};