import React from 'react';
import { ContentBlock, BlockLayout } from '@/types/emailBuilder';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ImageSelectButton } from '@/components/image/ImageSelectButton';
import { Plus, GripVertical, Trash2, Copy, Image as ImageIcon } from 'lucide-react';

interface EmailBlockEditorProps {
  blocks: ContentBlock[];
  onBlocksChange: (blocks: ContentBlock[]) => void;
}

export const EmailBlockEditor: React.FC<EmailBlockEditorProps> = ({
  blocks,
  onBlocksChange
}) => {
  const addBlock = (type: ContentBlock['type']) => {
    const newBlock: ContentBlock = {
      id: `block_${Date.now()}`,
      type,
      layout: 'full-width',
      title: '',
      content: '',
      imageUrl: '',
      ctaText: '',
      ctaUrl: '',
      source: 'manual'
    };
    onBlocksChange([...blocks, newBlock]);
  };

  const updateBlock = (id: string, updates: Partial<ContentBlock>) => {
    onBlocksChange(blocks.map(block => 
      block.id === id ? { ...block, ...updates } : block
    ));
  };

  const removeBlock = (id: string) => {
    onBlocksChange(blocks.filter(block => block.id !== id));
  };

  const duplicateBlock = (block: ContentBlock) => {
    const newBlock: ContentBlock = {
      ...block,
      id: `block_${Date.now()}`,
      title: `${block.title} (Copy)`
    };
    const blockIndex = blocks.findIndex(b => b.id === block.id);
    const newBlocks = [...blocks];
    newBlocks.splice(blockIndex + 1, 0, newBlock);
    onBlocksChange(newBlocks);
  };

  const moveBlock = (id: string, direction: 'up' | 'down') => {
    const currentIndex = blocks.findIndex(block => block.id === id);
    if (
      (direction === 'up' && currentIndex === 0) ||
      (direction === 'down' && currentIndex === blocks.length - 1)
    ) {
      return;
    }

    const newBlocks = [...blocks];
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    [newBlocks[currentIndex], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[currentIndex]];
    onBlocksChange(newBlocks);
  };

  const handleImageSelect = (blockId: string, imageUrl: string, metadata?: any) => {
    updateBlock(blockId, { 
      imageUrl,
      ...(metadata?.alt_text && { title: metadata.alt_text })
    });
  };

  const renderBlockPreview = (block: ContentBlock) => {
    const isImageBlock = block.type === 'image';
    const hasImage = block.imageUrl;

    return (
      <div className="p-4 bg-muted/30 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium capitalize flex items-center gap-2">
            {block.layout !== 'full-width' && (
              <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded">
                {block.layout === 'two-column-left' ? '← Left Column' : '→ Right Column'}
              </span>
            )}
            {block.type}
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"  
              onClick={() => moveBlock(block.id, 'up')}
              disabled={blocks.findIndex(b => b.id === block.id) === 0}
            >
              ↑
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => moveBlock(block.id, 'down')}
              disabled={blocks.findIndex(b => b.id === block.id) === blocks.length - 1}
            >
              ↓
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => duplicateBlock(block)}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeBlock(block.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Image Preview - Use ImageSelectButton for better integration */}
        {isImageBlock && (
          <div className="mb-3">
            <ImageSelectButton
              onImageSelect={(imageUrl, metadata) => handleImageSelect(block.id, imageUrl, metadata)}
              selectedImageUrl={block.imageUrl}
              contentContext={block.title || block.content}
              mode="modal"
              buttonText="Select Image"
              className="w-full"
            />
          </div>
        )}

        {/* Content Preview */}
        <div className="text-sm text-muted-foreground">
          {block.title && <div className="font-medium mb-1">{block.title}</div>}
          {block.content && <div className="line-clamp-2">{block.content}</div>}
          {block.ctaText && (
            <div className="mt-2">
              <span className="px-2 py-1 bg-primary text-primary-foreground rounded text-xs">
                {block.ctaText}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderBlockEditor = (block: ContentBlock) => {
    const updateField = (field: keyof ContentBlock, value: any) => {
      updateBlock(block.id, { [field]: value });
    };

    return (
      <div className="space-y-4 overflow-visible">
        {/* Layout Selection */}
        <div className="overflow-visible">
          <Label>Layout</Label>
          <Select
            value={block.layout || 'full-width'}
            onValueChange={(value: BlockLayout) => updateField('layout', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full-width">Full Width</SelectItem>
              <SelectItem value="two-column-left">Two Column - Left</SelectItem>
              <SelectItem value="two-column-right">Two Column - Right</SelectItem>
            </SelectContent>
          </Select>
          {block.layout !== 'full-width' && (
            <p className="text-xs text-muted-foreground mt-1">
              Two-column blocks will be paired with adjacent blocks. Desktop shows side-by-side, mobile stacks vertically.
            </p>
          )}
        </div>

        {/* Title */}
        <div>
          <Label>Title</Label>
          <Input
            value={block.title}
            onChange={(e) => updateField('title', e.target.value)}
            placeholder={`Enter ${block.type} title...`}
          />
        </div>

        {/* Content */}
        {block.type !== 'button' && block.type !== 'image' && (
          <div>
            <Label>Content</Label>
            <Textarea
              value={block.content}
              onChange={(e) => updateField('content', e.target.value)}
              placeholder="Enter content..."
              rows={4}
            />
          </div>
        )}

        {/* Image Selection */}
        {block.type === 'image' && (
          <div>
            <Label>Image</Label>
            <ImageSelectButton
              onImageSelect={(imageUrl, metadata) => handleImageSelect(block.id, imageUrl, metadata)}
              selectedImageUrl={block.imageUrl}
              contentContext={block.title || block.content}
              mode="modal"
              buttonText="Select Image"
              className="w-full"
            />
          </div>
        )}

        {/* Button Fields */}
        {block.type === 'button' && (
          <>
            <div>
              <Label>Button Text</Label>
              <Input
                value={block.ctaText}
                onChange={(e) => updateField('ctaText', e.target.value)}
                placeholder="Click Here"
              />
            </div>
            <div>
              <Label>Button URL</Label>
              <Input
                value={block.ctaUrl}
                onChange={(e) => updateField('ctaUrl', e.target.value)}
                placeholder="https://example.com"
              />
            </div>
          </>
        )}

        {/* CTA Fields for other blocks */}
        {block.type !== 'button' && block.type !== 'header' && (
          <>
            <div>
              <Label>Call-to-Action Text (Optional)</Label>
              <Input
                value={block.ctaText}
                onChange={(e) => updateField('ctaText', e.target.value)}
                placeholder="Learn More"
              />
            </div>
            {block.ctaText && (
              <div>
                <Label>CTA URL</Label>
                <Input
                  value={block.ctaUrl}
                  onChange={(e) => updateField('ctaUrl', e.target.value)}
                  placeholder="https://example.com"
                />
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 overflow-visible">
      {/* Add Block Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Add Content Block</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {[
              { type: 'header' as const, label: 'Header', icon: '📄' },
              { type: 'text' as const, label: 'Text', icon: '📝' },
              { type: 'image' as const, label: 'Image', icon: '🖼️' },
              { type: 'button' as const, label: 'Button', icon: '🔘' }
            ].map(({ type, label, icon }) => (
              <Button
                key={type}
                variant="outline"
                onClick={() => addBlock(type)}
                className="h-16 flex flex-col gap-1"
              >
                <span className="text-xl">{icon}</span>
                <span className="text-xs">{label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Content Blocks */}
      {blocks.map((block, index) => (
        <Card key={block.id} className="overflow-visible">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              Block {index + 1}: {block.type}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 overflow-visible">
            {/* Block Preview */}
            {renderBlockPreview(block)}
            
            {/* Block Editor */}
            {renderBlockEditor(block)}
          </CardContent>
        </Card>
      ))}

      {blocks.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Plus className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No content blocks yet</h3>
            <p className="text-muted-foreground mb-4">
              Add your first content block to start building your email campaign.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
