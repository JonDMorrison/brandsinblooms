
import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
          <Select 
            value={block.content || 'solid'} 
            onValueChange={(value) => onUpdate({ content: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="solid">Solid Line</SelectItem>
              <SelectItem value="dashed">Dashed Line</SelectItem>
              <SelectItem value="dotted">Dotted Line</SelectItem>
              <SelectItem value="space">Space Only</SelectItem>
            </SelectContent>
          </Select>
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

        <div>
          <Label htmlFor="divider-alignment">Alignment</Label>
          <Select 
            value={block.alignment || 'center'} 
            onValueChange={(value) => onUpdate({ alignment: value as any })}
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
      </div>
    </div>
  );
};
