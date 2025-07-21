
import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TextBlockEditorProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  isExpanded: boolean;
}

export const TextBlockEditor: React.FC<TextBlockEditorProps> = ({
  block,
  onUpdate,
  isExpanded
}) => {
  if (!isExpanded) {
    return (
      <div className="flex-1 min-w-0">
        <div className="text-sm text-muted-foreground truncate">
          {block.title ? `"${block.title}"` : 'Text Block'}
          {block.content && (
            <span className="ml-2 text-xs">
              - {block.content.substring(0, 50)}...
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="text-title">Title (Optional)</Label>
        <Input
          id="text-title"
          value={block.title || ''}
          onChange={(e) => onUpdate({ title: e.target.value })}
          placeholder="Enter title..."
        />
      </div>
      
      <div>
        <Label htmlFor="text-content">Content</Label>
        <Textarea
          id="text-content"
          value={block.content || ''}
          onChange={(e) => onUpdate({ content: e.target.value })}
          placeholder="Enter your text content..."
          className="min-h-[120px]"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="text-alignment">Alignment</Label>
          <Select 
            value={block.alignment || 'left'} 
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

        <div>
          <Label htmlFor="text-padding">Padding</Label>
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
      </div>
    </div>
  );
};
