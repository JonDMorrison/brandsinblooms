
import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Upload, Eye, Image as ImageIcon } from 'lucide-react';
import { MediaSelectorImage } from '@/components/crm/MediaSelectorImage';
import { Layout2 } from '@/components/crm/LayoutTemplates';

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

  // Special handling for two-column-right layout (text-left, image-right)
  if (block.layout === 'two-column-right') {
    return (
      <div className="space-y-6">
        {/* Live Preview using actual Layout2 component */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Eye className="h-4 w-4" />
              Live Preview - Text Left, Image Right
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Layout2 
              block={block} 
              className="border rounded-lg p-4 bg-background"
              editable={false}
            />
          </CardContent>
        </Card>

        {/* Two-Column Editor Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Text Content Editing */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Text Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={block.title || ''}
                  onChange={(e) => updateField('title', e.target.value)}
                  placeholder="Enter article title..."
                />
              </div>

              <div>
                <Label htmlFor="content">Article Content</Label>
                <Textarea
                  id="content"
                  value={block.content || ''}
                  onChange={(e) => updateField('content', e.target.value)}
                  placeholder="Enter your article content here..."
                  rows={6}
                  className="min-h-[120px]"
                />
              </div>

              <div>
                <Label htmlFor="ctaText">Call to Action Button</Label>
                <Input
                  id="ctaText"
                  value={block.ctaText || ''}
                  onChange={(e) => updateField('ctaText', e.target.value)}
                  placeholder="Learn More"
                />
              </div>

              <div>
                <Label htmlFor="ctaUrl">Button URL</Label>
                <Input
                  id="ctaUrl"
                  value={block.ctaUrl || ''}
                  onChange={(e) => updateField('ctaUrl', e.target.value)}
                  placeholder="https://example.com"
                />
              </div>
            </CardContent>
          </Card>

          {/* Right Column: Image Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Featured Image</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <MediaSelectorImage
                src={block.imageUrl}
                onChange={(imageUrl, metadata) => {
                  updateField('imageUrl', imageUrl);
                  if (metadata?.alt) {
                    updateField('altText', metadata.alt);
                  }
                }}
                contentContext={`${block.title || ''} ${block.content || ''}`.trim()}
                className="h-48"
              />
              
              <div>
                <Label htmlFor="altText">Alt Text (for accessibility)</Label>
                <Input
                  id="altText"
                  value={block.altText || ''}
                  onChange={(e) => updateField('altText', e.target.value)}
                  placeholder="Describe the image for screen readers..."
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Fallback to original layout for other block types
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
                  <span className="text-muted-foreground">Select an image</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Editor Fields */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={block.title || ''}
            onChange={(e) => updateField('title', e.target.value)}
            placeholder="Enter block title..."
          />
        </div>

        <div>
          <Label htmlFor="content">Content</Label>
          <Textarea
            id="content"
            value={block.content || ''}
            onChange={(e) => updateField('content', e.target.value)}
            placeholder="Enter block content..."
            rows={4}
          />
        </div>

        <div>
          <Label>Image</Label>
          <MediaSelectorImage
            src={block.imageUrl}
            onChange={(imageUrl, metadata) => {
              updateField('imageUrl', imageUrl);
              if (metadata?.alt) {
                updateField('altText', metadata.alt);
              }
            }}
            contentContext={`${block.title || ''} ${block.content || ''}`.trim()}
          />
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
          <Label htmlFor="ctaText">Call to Action Button</Label>
          <Input
            id="ctaText"
            value={block.ctaText || ''}
            onChange={(e) => updateField('ctaText', e.target.value)}
            placeholder="Learn More"
          />
        </div>

        <div>
          <Label htmlFor="ctaUrl">Button URL</Label>
          <Input
            id="ctaUrl"
            value={block.ctaUrl || ''}
            onChange={(e) => updateField('ctaUrl', e.target.value)}
            placeholder="https://example.com"
          />
        </div>
      </div>
    </div>
  );
};
