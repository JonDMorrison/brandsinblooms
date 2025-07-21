
import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Eye, MousePointer } from 'lucide-react';

interface ButtonBlockEditorProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  isExpanded: boolean;
}

export const ButtonBlockEditor: React.FC<ButtonBlockEditorProps> = ({
  block,
  onUpdate,
  isExpanded
}) => {
  const updateField = (field: string, value: any) => {
    onUpdate({ [field]: value });
  };

  // Compact header preview when collapsed
  const renderCompactPreview = () => (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-8 h-8 bg-primary/20 rounded flex items-center justify-center">
        <MousePointer className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-sm truncate">
          {block.buttonText || 'Button Block'}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {block.heading ? `${block.heading.substring(0, 30)}...` : 'No heading'}
        </div>
      </div>
      <div className="px-2 py-1 bg-primary text-primary-foreground text-xs rounded">
        {block.buttonText || 'Button'}
      </div>
    </div>
  );

  if (!isExpanded) {
    return renderCompactPreview();
  }

  return (
    <div className="space-y-6">
      {/* Live Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Eye className="h-4 w-4" />
            Live Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div 
            className={`text-${block.alignment || 'center'} space-y-4 p-6 bg-background rounded-lg`}
          >
            {block.heading && (
              <h3 className="text-lg font-semibold">{block.heading}</h3>
            )}
            {block.body && (
              <div className="text-muted-foreground leading-relaxed">
                {block.body}
              </div>
            )}
            <div>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                {block.buttonText || 'Click Here'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Editor Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="heading">Heading</Label>
            <Input
              id="heading"
              value={block.heading || ''}
              onChange={(e) => updateField('heading', e.target.value)}
              placeholder="Optional heading above button..."
            />
          </div>

          <div>
            <Label htmlFor="body">Body Text</Label>
            <Textarea
              id="body"
              value={block.body || ''}
              onChange={(e) => updateField('body', e.target.value)}
              placeholder="Optional description text (markdown supported)..."
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="alignment">Text Alignment</Label>
            <Select
              value={block.alignment || 'center'}
              onValueChange={(value) => updateField('alignment', value)}
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

        <div className="space-y-4">
          <div>
            <Label htmlFor="buttonText">Button Text *</Label>
            <Input
              id="buttonText"
              value={block.buttonText || ''}
              onChange={(e) => updateField('buttonText', e.target.value)}
              placeholder="Click Here"
            />
          </div>

          <div>
            <Label htmlFor="buttonUrl">Button URL *</Label>
            <Input
              id="buttonUrl"
              value={block.buttonUrl || ''}
              onChange={(e) => updateField('buttonUrl', e.target.value)}
              placeholder="https://example.com"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
