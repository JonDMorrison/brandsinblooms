import React from 'react';
import { ContentBlock, QuoteBlock } from '@/types/emailBuilder';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/NativeSelect';
import { Card } from '@/components/ui/card';
import { Quote } from 'lucide-react';

interface QuoteBlockEditorProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  isExpanded: boolean;
}

export const QuoteBlockEditor: React.FC<QuoteBlockEditorProps> = ({
  block,
  onUpdate,
  isExpanded
}) => {
  if (!isExpanded) {
    return (
      <div className="flex-1 min-w-0">
        <div className="text-sm text-muted-foreground truncate">
          {block.quote ? `"${block.quote.substring(0, 40)}..."` : 'Quote Block'}
          {block.author && (
            <span className="ml-2 text-xs">
              - {block.author}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Quote Preview */}
      <Card className="p-4 bg-muted/30 border-l-4 border-primary">
        <div className="flex items-start gap-3">
          <Quote className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
          <div className="space-y-2">
            <blockquote className="text-sm italic text-foreground">
              "{block.quote || 'Your inspiring quote will appear here...'}"
            </blockquote>
            {(block.author || block.authorTitle) && (
              <div className="text-xs text-muted-foreground">
                — {block.author || 'Author Name'}
                {block.authorTitle && `, ${block.authorTitle}`}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Quote Content */}
      <div>
        <Label htmlFor="quote-text">Quote Text</Label>
        <Textarea
          id="quote-text"
          value={block.quote || ''}
          onChange={(e) => onUpdate({ quote: e.target.value })}
          placeholder="Enter the quote text..."
          className="min-h-[100px]"
        />
      </div>

      {/* Author Information */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="quote-author">Author</Label>
          <Input
            id="quote-author"
            value={block.author || ''}
            onChange={(e) => onUpdate({ author: e.target.value })}
            placeholder="Author name..."
          />
        </div>
        <div>
          <Label htmlFor="author-title">Author Title</Label>
          <Input
            id="author-title"
            value={block.authorTitle || ''}
            onChange={(e) => onUpdate({ authorTitle: e.target.value })}
            placeholder="Title or position..."
          />
        </div>
      </div>

      {/* Styling Options */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="quote-alignment">Alignment</Label>
          <NativeSelect
            value={block.alignment || 'left'}
            onChange={(e) => onUpdate({ alignment: e.target.value as any })}
            options={[
              { value: 'left', label: 'Left' },
              { value: 'center', label: 'Center' },
              { value: 'right', label: 'Right' }
            ]}
          />
        </div>

        <div>
          <Label htmlFor="quote-padding">Padding</Label>
          <NativeSelect
            value={block.padding || 'medium'}
            onChange={(e) => onUpdate({ padding: e.target.value as any })}
            options={[
              { value: 'none', label: 'None' },
              { value: 'small', label: 'Small' },
              { value: 'medium', label: 'Medium' },
              { value: 'large', label: 'Large' },
              { value: 'extra-large', label: 'Extra Large' }
            ]}
          />
        </div>
      </div>
    </div>
  );
};