
import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/NativeSelect';
import { Input } from '@/components/ui/input';

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

        <div>
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
          <Label htmlFor="divider-margin">Margin</Label>
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

        <div>
          <Label htmlFor="divider-alignment">Alignment</Label>
          <NativeSelect
            value={block.alignment || 'center'}
            onChange={(e) => onUpdate({ alignment: e.target.value as any })}
            options={[
              { value: 'left', label: 'Left' },
              { value: 'center', label: 'Center' },
              { value: 'right', label: 'Right' }
            ]}
          />
        </div>
      </div>
    </div>
  );
};
