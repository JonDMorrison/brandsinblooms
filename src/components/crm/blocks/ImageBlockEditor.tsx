
import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Upload, Eye, Image as ImageIcon } from 'lucide-react';

interface ImageBlockEditorProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  isExpanded: boolean;
}

export const ImageBlockEditor: React.FC<ImageBlockEditorProps> = ({
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
      <div className="w-8 h-8 bg-secondary rounded flex items-center justify-center">
        {block.imageUrl ? (
          <img 
            src={block.imageUrl} 
            alt={block.altText || 'Image'} 
            className="w-full h-full object-cover rounded"
          />
        ) : (
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-sm truncate">
          {block.altText || 'Image Block'}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {block.caption || 'No caption'}
        </div>
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
          <div className="text-center">
            {block.imageUrl ? (
              <div className="space-y-3">
                <img
                  src={block.imageUrl}
                  alt={block.altText || 'Image'}
                  className="max-w-full h-auto rounded-lg mx-auto"
                  style={{ maxHeight: '300px' }}
                />
                {block.caption && (
                  <p className="text-sm text-muted-foreground italic">
                    {block.caption}
                  </p>
                )}
              </div>
            ) : (
              <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-muted-foreground/25">
                <div className="text-center">
                  <ImageIcon className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                  <span className="text-muted-foreground">Add an image URL below</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Editor Fields */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="imageUrl">Image URL *</Label>
          <div className="flex gap-2">
            <Input
              id="imageUrl"
              value={block.imageUrl || ''}
              onChange={(e) => updateField('imageUrl', e.target.value)}
              placeholder="https://example.com/image.jpg"
            />
            <Button variant="outline" size="sm">
              <Upload className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div>
          <Label htmlFor="altText">Alt Text</Label>
          <Input
            id="altText"
            value={block.altText || ''}
            onChange={(e) => updateField('altText', e.target.value)}
            placeholder="Describe the image for accessibility..."
          />
        </div>

        <div>
          <Label htmlFor="caption">Caption</Label>
          <Input
            id="caption"
            value={block.caption || ''}
            onChange={(e) => updateField('caption', e.target.value)}
            placeholder="Optional image caption..."
          />
        </div>
      </div>
    </div>
  );
};
