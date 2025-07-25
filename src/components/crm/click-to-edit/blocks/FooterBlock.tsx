import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FooterBlockProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  isPreview: boolean;
}

export const FooterBlock: React.FC<FooterBlockProps> = ({ block, onUpdate, isPreview }) => {
  const content = block.content || '';
  const alignment = block.textAlign || 'center';
  const padding = block.padding || 'medium';

  const insertUnsubscribeToken = () => {
    const unsubscribeText = '\n\nTo unsubscribe from these emails, click here: {{unsubscribe_url}}';
    onUpdate({ content: content + unsubscribeText });
  };

  if (isPreview) {
    const paddingClass = {
      none: 'p-0',
      small: 'p-4',
      medium: 'p-6',
      large: 'p-8'
    }[padding];

    return (
      <div className={cn(
        paddingClass,
        "bg-muted/30 text-xs text-muted-foreground",
        alignment === 'center' && "text-center",
        alignment === 'right' && "text-right"
      )}>
        {content ? (
          <div 
            className="whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ 
              __html: content.replace(/\n/g, '<br />') 
            }}
          />
        ) : (
          <p>Add your footer content here. Include contact information and unsubscribe link.</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Footer Content</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={insertUnsubscribeToken}
            type="button"
          >
            Insert Unsubscribe Link
          </Button>
        </div>
        <Textarea
          value={content}
          onChange={(e) => onUpdate({ content: e.target.value })}
          placeholder="Enter footer content, contact information, legal text..."
          rows={6}
        />
        <p className="text-xs text-muted-foreground">
          Use {`{{unsubscribe_url}}`} token for unsubscribe links. This will be automatically replaced when emails are sent.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Text Alignment</Label>
          <Select
            value={alignment}
            onValueChange={(value) => onUpdate({ textAlign: value as any })}
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

        <div className="space-y-2">
          <Label>Padding</Label>
          <Select
            value={padding}
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