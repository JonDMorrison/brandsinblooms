
import React, { useState } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { MediaSelector } from '@/components/image/MediaSelector';

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
  
  const isImageRightLayout = block.layout === 'two-column-right';
  
  if (!isExpanded) {
    return (
      <div className="flex-1 min-w-0">
        <div className="text-sm text-muted-foreground truncate">
          {block.title ? `"${block.title}"` : 'Text Block'}
          {isImageRightLayout && (
            <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
              Image Right
            </span>
          )}
          {block.content && (
            <span className="ml-2 text-xs">
              - {block.content.substring(0, 50)}...
            </span>
          )}
        </div>
        {isImageRightLayout && block.imageUrl && (
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

  // Two-column layout for image-right blocks
  if (isImageRightLayout) {
    return (
      <div className="space-y-4">
        {/* Layout Preview Toggle */}
        <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Image Right Layout</span>
            <span className="text-xs text-muted-foreground">Text left, image right</span>
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
            <div className="text-xs text-muted-foreground mb-2">Layout Preview:</div>
            <div className="flex gap-4 items-start">
              <div className="flex-1">
                <div className="text-sm font-medium mb-2">
                  {block.title || 'Your title here'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {block.content || 'Your content will appear here...'}
                </div>
              </div>
              <div className="w-24 h-16 bg-muted rounded flex items-center justify-center flex-shrink-0">
                {block.imageUrl ? (
                  <img 
                    src={block.imageUrl} 
                    alt={block.altText || 'Preview'} 
                    className="w-full h-full object-cover rounded"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">Image</span>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Two-Column Editor */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Text Content */}
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

            {/* Alt Text Field */}
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
          </div>

          {/* Right Column - Image Selection */}
          <div className="space-y-4">
            <div>
              <Label>Select Image</Label>
              <div className="mt-2">
                <MediaSelector
                  onImageSelect={handleImageSelect}
                  selectedImageUrl={block.imageUrl}
                  contentContext={`${block.title || ''} ${block.content || ''}`}
                  compact={true}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Single-column layout for other blocks
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
