import React, { useState } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Bold, Italic, Link, List, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { InlineTextEditor } from '../inline/InlineTextEditor';
import { InlineStyleEditor } from '../inline/InlineStyleEditor';
import { cn } from '@/lib/utils';

interface TextBlockProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  isPreview: boolean;
}

type InlineEditMode = 'text' | 'style' | null;

export const TextBlock: React.FC<TextBlockProps> = ({ block, onUpdate, isPreview }) => {
  const [inlineEditMode, setInlineEditMode] = useState<InlineEditMode>(null);

  const handleInlineEdit = (mode: InlineEditMode, event: React.MouseEvent) => {
    event.stopPropagation();
    setInlineEditMode(mode);
  };

  const handleInlineSave = () => {
    setInlineEditMode(null);
  };

  const handleInlineCancel = () => {
    setInlineEditMode(null);
  };

  if (isPreview) {
    const paddingClass = {
      none: 'p-0',
      small: 'p-4',
      medium: 'p-6',
      large: 'p-8'
    }[block.padding || 'medium'];

    return (
      <div 
        className={cn(
          paddingClass,
          block.textAlign === 'center' && "text-center",
          block.textAlign === 'right' && "text-right",
          "relative"
        )}
        onClick={(e) => handleInlineEdit('style', e)}
      >
        {/* Text content with inline editing */}
        {inlineEditMode === 'text' ? (
          <div className="relative z-50">
            <InlineTextEditor
              value={block.content || ''}
              onChange={(value) => onUpdate({ content: value })}
              onSave={handleInlineSave}
              onCancel={handleInlineCancel}
              placeholder="Enter text content"
              multiline={true}
            />
          </div>
        ) : (
          <div 
            className="prose max-w-none cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors"
            style={{ 
              fontSize: block.fontSize || '16px',
              fontFamily: block.fontFamily || 'inherit'
            }}
            onClick={(e) => handleInlineEdit('text', e)}
            dangerouslySetInnerHTML={{ 
              __html: block.content || '<p>Click to add text content</p>' 
            }}
          />
        )}

        {/* Style editor overlay */}
        {inlineEditMode === 'style' && (
          <div className="absolute top-2 right-2 z-50">
            <InlineStyleEditor
              textAlign={block.textAlign}
              onTextAlignChange={(align) => onUpdate({ textAlign: align as any })}
              onSave={handleInlineSave}
              onCancel={handleInlineCancel}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Text Content</Label>
        <div className="border rounded-md">
          {/* Simple Rich Text Toolbar */}
          <div className="flex items-center gap-1 p-2 border-b">
            <Button variant="ghost" size="sm">
              <Bold className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <Italic className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <Link className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <List className="h-4 w-4" />
            </Button>
            <div className="w-px h-4 bg-border mx-1" />
            <Button variant="ghost" size="sm">
              <AlignLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <AlignCenter className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <AlignRight className="h-4 w-4" />
            </Button>
          </div>
          <Textarea
            value={block.content || ''}
            onChange={(e) => onUpdate({ content: e.target.value })}
            placeholder="Enter your text content..."
            rows={6}
            className="border-0 resize-none focus-visible:ring-0"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
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
            </SelectContent>
          </Select>
        </div>

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
            </SelectContent>
          </Select>
        </div>

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
      </div>
    </div>
  );
};