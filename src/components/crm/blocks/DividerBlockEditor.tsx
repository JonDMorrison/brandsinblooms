
import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Label } from '@/components/ui-legacy/label';
import { NativeSelect } from '@/components/ui-legacy/NativeSelect';
import { Input } from '@/components/ui-legacy/input';

interface DividerBlockEditorProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  isExpanded: boolean;
}

export const DividerBlockEditor: React.FC<DividerBlockEditorProps> = ({
  block,
  onUpdate,
  isExpanded
}) => {
  if (!isExpanded) {
    return (
      <div className="flex-1 min-w-0">
        <div className="text-sm text-muted-foreground">
          Divider Block
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="divider-style">Style</Label>
          <NativeSelect
            value={block.content || 'solid'}
            onChange={(e) => onUpdate({ content: e.target.value })}
            options={[
              { value: 'solid', label: 'Solid Line' },
              { value: 'dashed', label: 'Dashed Line' },
              { value: 'dotted', label: 'Dotted Line' },
              { value: 'space', label: 'Space Only' }
            ]}
          />
        </div>

        <div className="w-full">
          <Label htmlFor="divider-color">Color</Label>
          <Input
            id="divider-color"
            type="color"
            value={block.textColor || '#E5E7EB'}
            onChange={(e) => onUpdate({ textColor: e.target.value })}
            className="h-10 w-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="divider-thickness">Thickness</Label>
          <NativeSelect
            value={String(block.dividerThickness || 1)}
            onChange={(e) => onUpdate({ dividerThickness: Number(e.target.value) })}
            options={[
              { value: '1', label: '1px' },
              { value: '2', label: '2px' },
              { value: '3', label: '3px' },
              { value: '4', label: '4px' }
            ]}
          />
        </div>

        <div>
          <Label htmlFor="divider-margin">Spacing</Label>
          <NativeSelect
            value={block.margin || 'medium'}
            onChange={(e) => onUpdate({ margin: e.target.value as any })}
            options={[
              { value: 'none', label: 'None' },
              { value: 'small', label: 'Small (8px)' },
              { value: 'medium', label: 'Medium (16px)' },
              { value: 'large', label: 'Large (32px)' }
            ]}
          />
        </div>
      </div>
    </div>
  );
};
