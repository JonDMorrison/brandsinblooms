
import React, { useState, useEffect } from 'react';
import { ContentBlock, BlockLayout, AlignmentType, SpacingType, ImageSizeType, ImagePositionType } from '@/types/emailBuilder';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/NativeSelect';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, EyeOff, Layout, Image as ImageIcon, Palette, Settings } from 'lucide-react';
import { MediaSelectorImage } from '@/components/crm/MediaSelectorImage';
import { mediaSelector } from '@/utils/mediaSelector';

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
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState('content');
  
  const hasImageLayout = ['two-column-right', 'two-column-left', 'image-left', 'image-right', 'image-60-40', 'image-70-30', 'image-overlay', 'image-background'].includes(block.layout || '');

  const getLayoutDisplayName = (layout: BlockLayout) => {
    const layoutNames = {
      'full-width': 'Full Width',
      'two-column-left': 'Image Left',
      'two-column-right': 'Image Right',
      'image-60-40': '60/40 Split',
      'image-70-30': '70/30 Split',
      'image-overlay': 'Text Overlay',
      'image-background': 'Background Image',
      'three-column': 'Three Column'
    };
    return layoutNames[layout as keyof typeof layoutNames] || layout;
  };
  
  if (!isExpanded) {
    return (
      <div className="flex-1 min-w-0">
        <div className="text-sm text-muted-foreground truncate">
          {block.title ? `"${block.title}"` : 'Text Block'}
          {block.layout && (
            <Badge variant="outline" className="ml-2 text-xs">
              {getLayoutDisplayName(block.layout)}
            </Badge>
          )}
          {block.content && (
            <span className="ml-2 text-xs">
              - {block.content.substring(0, 50)}...
            </span>
          )}
        </div>
        {hasImageLayout && block.imageUrl && (
          <div className="mt-2 flex items-center gap-2">
            <img 
              src={block.imageUrl} 
              alt={block.altText || 'Block image'} 
              className="w-8 h-8 rounded object-cover"
            />
            <span className="text-xs text-muted-foreground">Image attached</span>
          </div>
        )}
      </div>
    );
  }

  const handleImageSelect = (imageUrl: string, metadata?: any) => {
    onUpdate({ 
      imageUrl,
      altText: metadata?.alt || block.altText || 'Selected image'
    });
  };

  // Debug: Log block data to see if imageUrl exists
  console.log('[TextBlockEditor] Block data:', {
    title: block.title,
    hasImageUrl: !!block.imageUrl,
    imageUrl: block.imageUrl,
    layout: block.layout
  });

  // Auto-fetch image for image layouts that don't have an image
  useEffect(() => {
    if (hasImageLayout && !block.imageUrl && (block.title || block.content)) {
      const contentForImage = `${block.title || ''} ${block.content || ''}`.trim();
      if (contentForImage) {
        console.log('[TextBlockEditor] Auto-fetching image for content:', contentForImage);
        mediaSelector({ 
          prompt: contentForImage,
          fallback: '/images/newsletter-fallback.jpg' 
        }).then((result) => {
          console.log('[TextBlockEditor] Auto-fetched image:', result.url);
          onUpdate({ 
            imageUrl: result.url,
            altText: result.alt || 'Auto-selected image'
          });
        }).catch((error) => {
          console.error('[TextBlockEditor] Failed to auto-fetch image:', error);
        });
      }
    }
  }, [hasImageLayout, block.imageUrl, block.title, block.content, onUpdate]);

  // Enhanced layout editor with tabs
  return (
    <div className="space-y-4">
      {/* Layout Preview Toggle */}
      <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border">
        <div className="flex items-center gap-2">
          <Layout className="h-4 w-4" />
          <span className="text-sm font-medium">
            {block.layout ? getLayoutDisplayName(block.layout) : 'Single Column'}
          </span>
          {hasImageLayout && (
            <Badge variant="secondary" className="text-xs">
              Image Layout
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowPreview(!showPreview)}
          className="h-8"
        >
          {showPreview ? (
            <>
              <EyeOff className="h-3 w-3 mr-1" />
              Hide Preview
            </>
          ) : (
            <>
              <Eye className="h-3 w-3 mr-1" />
              Show Preview
            </>
          )}
        </Button>
      </div>

      {/* Layout Preview */}
      {showPreview && (
        <Card className="p-4 bg-muted/30">
          <div className="text-xs text-muted-foreground mb-3">Live Preview:</div>
          <div className={`${getPreviewLayoutClass(block.layout)} gap-4 items-start`}>
            <div className="space-y-2">
              {block.title && (
                <div className="text-sm font-medium">
                  {block.title}
                </div>
              )}
              <div className="text-sm text-muted-foreground">
                {block.content || 'Your content will appear here...'}
              </div>
            </div>
            {hasImageLayout && (
              <div className={`${getImagePreviewClass(block.layout)} bg-muted rounded flex items-center justify-center flex-shrink-0`}>
                {block.imageUrl ? (
                  <img 
                    src={block.imageUrl} 
                    alt={block.altText || 'Preview'} 
                    className="w-full h-full object-cover rounded"
                  />
                ) : (
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Tabbed Editor Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="content" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Content
          </TabsTrigger>
          <TabsTrigger value="layout" className="flex items-center gap-2">
            <Layout className="h-4 w-4" />
            Layout
          </TabsTrigger>
          <TabsTrigger value="image" className="flex items-center gap-2" disabled={!hasImageLayout}>
            <ImageIcon className="h-4 w-4" />
            Image
          </TabsTrigger>
          <TabsTrigger value="style" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Style
          </TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="space-y-4 mt-4">
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
        </TabsContent>

        <TabsContent value="layout" className="space-y-4 mt-4">
          <div>
            <Label htmlFor="block-layout">Block Layout</Label>
            <NativeSelect
              value={block.layout || 'full-width'}
              onChange={(e) => onUpdate({ layout: e.target.value as BlockLayout })}
              options={[
                { value: 'full-width', label: 'Full Width' },
                { value: 'two-column-left', label: 'Image Left' },
                { value: 'two-column-right', label: 'Image Right' },
                { value: 'image-left', label: 'Image Left (Alt)' },
                { value: 'image-right', label: 'Image Right (Alt)' },
                { value: 'image-60-40', label: '60/40 Split' },
                { value: 'image-70-30', label: '70/30 Split' },
                { value: 'image-overlay', label: 'Text Overlay' },
                { value: 'image-background', label: 'Background Image' }
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="text-alignment">Text Alignment</Label>
              <NativeSelect
                value={block.alignment || 'left'}
                onChange={(e) => onUpdate({ alignment: e.target.value as AlignmentType })}
                options={[
                  { value: 'left', label: 'Left' },
                  { value: 'center', label: 'Center' },
                  { value: 'right', label: 'Right' },
                  { value: 'justify', label: 'Justify' }
                ]}
              />
            </div>

            <div>
              <Label htmlFor="text-padding">Padding</Label>
              <NativeSelect
                value={block.padding || 'medium'}
                onChange={(e) => onUpdate({ padding: e.target.value as SpacingType })}
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
        </TabsContent>

        <TabsContent value="image" className="space-y-4 mt-4">
          {hasImageLayout && (
            <>
              <div>
                <Label>Select Image</Label>
                <div className="mt-2">
                  <MediaSelectorImage
                    src={block.imageUrl}
                    onChange={handleImageSelect}
                    contentContext={`${block.title || ''} ${block.content || ''}`}
                    className="h-48"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="image-size">Image Size</Label>
                  <NativeSelect
                    value={block.imageSize || 'medium'}
                    onChange={(e) => onUpdate({ imageSize: e.target.value as ImageSizeType })}
                    options={[
                      { value: 'small', label: 'Small' },
                      { value: 'medium', label: 'Medium' },
                      { value: 'large', label: 'Large' },
                      { value: 'full-width', label: 'Full Width' },
                      { value: 'cover', label: 'Cover' }
                    ]}
                  />
                </div>

                <div>
                  <Label htmlFor="image-position">Image Position</Label>
                  <NativeSelect
                    value={block.imagePosition || 'center'}
                    onChange={(e) => onUpdate({ imagePosition: e.target.value as ImagePositionType })}
                    options={[
                      { value: 'left', label: 'Left' },
                      { value: 'center', label: 'Center' },
                      { value: 'right', label: 'Right' },
                      { value: 'background', label: 'Background' },
                      { value: 'overlay', label: 'Overlay' }
                    ]}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="image-rounded"
                    checked={block.imageRounded || false}
                    onCheckedChange={(checked) => onUpdate({ imageRounded: checked })}
                  />
                  <Label htmlFor="image-rounded" className="text-sm">Rounded</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="image-shadow"
                    checked={block.imageShadow || false}
                    onCheckedChange={(checked) => onUpdate({ imageShadow: checked })}
                  />
                  <Label htmlFor="image-shadow" className="text-sm">Shadow</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="image-border"
                    checked={block.imageBorder || false}
                    onCheckedChange={(checked) => onUpdate({ imageBorder: checked })}
                  />
                  <Label htmlFor="image-border" className="text-sm">Border</Label>
                </div>
              </div>

              {block.imageUrl && (
                <div>
                  <Label htmlFor="alt-text">Alt Text</Label>
                  <Input
                    id="alt-text"
                    value={block.altText || ''}
                    onChange={(e) => onUpdate({ altText: e.target.value })}
                    placeholder="Describe the image for accessibility..."
                  />
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="style" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="background-color">Background Color</Label>
              <Input
                id="background-color"
                type="color"
                value={block.backgroundColor || '#ffffff'}
                onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
                className="h-10"
              />
            </div>
            <div>
              <Label htmlFor="text-color">Text Color</Label>
              <Input
                id="text-color"
                type="color"
                value={block.textColor || '#000000'}
                onChange={(e) => onUpdate({ textColor: e.target.value })}
                className="h-10"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="animation">Animation</Label>
            <NativeSelect
              value={block.animation || 'none'}
              onChange={(e) => onUpdate({ animation: e.target.value as any })}
              options={[
                { value: 'none', label: 'None' },
                { value: 'fade-in', label: 'Fade In' },
                { value: 'slide-up', label: 'Slide Up' },
                { value: 'scale-in', label: 'Scale In' }
              ]}
            />
          </div>

          <div>
            <Label htmlFor="responsive-behavior">Mobile Behavior</Label>
            <NativeSelect
              value={block.responsiveBehavior || 'stack'}
              onChange={(e) => onUpdate({ responsiveBehavior: e.target.value as any })}
              options={[
                { value: 'stack', label: 'Stack Vertically' },
                { value: 'reverse', label: 'Reverse Order' },
                { value: 'hide-image', label: 'Hide Image' },
                { value: 'mobile-first', label: 'Mobile First' }
              ]}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );

  // Helper functions for preview layout classes
  function getPreviewLayoutClass(layout?: BlockLayout): string {
    switch (layout) {
      case 'two-column-left':
      case 'two-column-right':
        return 'flex';
      case 'image-60-40':
        return 'flex';
      case 'image-70-30':
        return 'flex';
      case 'image-overlay':
        return 'relative';
      case 'image-background':
        return 'relative';
      default:
        return 'block';
    }
  }

  function getImagePreviewClass(layout?: BlockLayout): string {
    switch (layout) {
      case 'image-60-40':
        return 'w-2/5 h-16';
      case 'image-70-30':
        return 'w-1/3 h-16';
      case 'image-overlay':
        return 'absolute inset-0 opacity-20';
      case 'image-background':
        return 'absolute inset-0 opacity-30';
      default:
        return 'w-1/2 h-16';
    }
  }
};

