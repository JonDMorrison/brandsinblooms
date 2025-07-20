
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ContentBlock, BlockLayout } from '@/types/emailBuilder';
import { TwoColumnBlock } from './TwoColumnBlock';
import { 
  Plus, 
  Trash2, 
  MoveUp, 
  MoveDown, 
  Type, 
  Image, 
  MousePointer, 
  Heading,
  Eye,
  Columns2,
  Layout
} from 'lucide-react';

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
      type,
      title: type === 'header' ? 'New Header' : 'New Content',
      content: type === 'button' ? 'Click Here' : 'Add your content here...',
      source: 'manual',
      layout: 'full-width'
    };
    onBlocksChange([...blocks, newBlock]);
  };

  const updateBlock = (index: number, updates: Partial<ContentBlock>) => {
    const newBlocks = [...blocks];
    newBlocks[index] = { ...newBlocks[index], ...updates };
    onBlocksChange(newBlocks);
  };

  const deleteBlock = (index: number) => {
    onBlocksChange(blocks.filter((_, i) => i !== index));
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const newBlocks = [...blocks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex >= 0 && targetIndex < blocks.length) {
      [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
      onBlocksChange(newBlocks);
    }
  };

  const getBlockIcon = (type: ContentBlock['type']) => {
    switch (type) {
      case 'header': return <Heading className="h-4 w-4" />;
      case 'text': return <Type className="h-4 w-4" />;
      case 'image': return <Image className="h-4 w-4" />;
      case 'button': return <MousePointer className="h-4 w-4" />;
      default: return <Type className="h-4 w-4" />;
    }
  };

  const getSourceBadge = (source: string, personaTag?: string) => {
    if (source === 'newsletter') {
      return (
        <div className="flex gap-1">
          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-md">
            Newsletter
          </span>
          {personaTag && (
            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md">
              {personaTag}
            </span>
          )}
        </div>
      );
    }
    return (
      <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-md capitalize">
        {source}
      </span>
    );
  };

  const getLayoutIcon = (layout?: BlockLayout) => {
    switch (layout) {
      case 'two-column-left':
      case 'two-column-right':
        return <Columns2 className="h-3 w-3" />;
      default:
        return <Layout className="h-3 w-3" />;
    }
  };

  // Group blocks for two-column rendering
  const renderBlocks = () => {
    const renderedBlocks = [];
    let i = 0;

    while (i < blocks.length) {
      const currentBlock = blocks[i];
      const nextBlock = blocks[i + 1];

      // Check if we have a two-column pair
      if (
        currentBlock.layout === 'two-column-left' &&
        nextBlock?.layout === 'two-column-right'
      ) {
        // Render two-column block
        renderedBlocks.push(
          <div key={`two-col-${i}`} className="space-y-4">
            <div className="flex items-center justify-between p-2 bg-muted/20 rounded-lg">
              <div className="flex items-center gap-2">
                <Columns2 className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Two-Column Layout</span>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => moveBlock(i, 'up')}
                  disabled={i === 0}
                >
                  <MoveUp className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => moveBlock(i, 'down')}
                  disabled={i >= blocks.length - 2}
                >
                  <MoveDown className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    deleteBlock(i + 1);
                    deleteBlock(i);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <TwoColumnBlock
              leftBlock={currentBlock}
              rightBlock={nextBlock}
              isPreview={true}
            />
            
            {/* Editors for both blocks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[currentBlock, nextBlock].map((block, blockIndex) => (
                <Card key={i + blockIndex} className="border-l-4 border-l-primary">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getBlockIcon(block.type)}
                        <span className="text-sm font-medium">
                          {blockIndex === 0 ? 'Left' : 'Right'} - {block.type}
                        </span>
                      </div>
                      {getSourceBadge(block.source, block.personaTag)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {renderBlockEditor(block, i + blockIndex)}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
        i += 2; // Skip next block since we processed it
      } else {
        // Render single block
        renderedBlocks.push(renderSingleBlock(currentBlock, i));
        i += 1;
      }
    }

    return renderedBlocks;
  };

  const renderSingleBlock = (block: ContentBlock, index: number) => (
    <Card key={index} className="border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getBlockIcon(block.type)}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium capitalize">{block.type} Block</span>
                {getLayoutIcon(block.layout)}
              </div>
              <div className="mt-1">
                {getSourceBadge(block.source, block.personaTag)}
              </div>
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => moveBlock(index, 'up')}
              disabled={index === 0}
            >
              <MoveUp className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => moveBlock(index, 'down')}
              disabled={index === blocks.length - 1}
            >
              <MoveDown className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => deleteBlock(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Block Preview */}
        <div className="p-3 bg-muted/50 rounded-lg border-l-2 border-l-muted-foreground/20">
          {renderBlockPreview(block)}
        </div>

        {/* Block Editor */}
        <div className="space-y-3 pt-2 border-t">
          {renderBlockEditor(block, index)}
        </div>
      </CardContent>
    </Card>
  );

  const renderBlockPreview = (block: ContentBlock) => {
    switch (block.type) {
      case 'header':
        return (
          <div className="text-center">
            <h2 className="text-xl font-bold text-primary mb-1">
              {block.title || 'Header Title'}
            </h2>
            {block.content && (
              <p className="text-muted-foreground">{block.content}</p>
            )}
          </div>
        );
      
      case 'text':
        return (
          <div>
            {block.title && (
              <h3 className="font-semibold mb-2">{block.title}</h3>
            )}
            <p className="text-sm text-muted-foreground line-clamp-3">
              {block.content || 'No content'}
            </p>
          </div>
        );
      
      case 'image':
        return (
          <div className="text-center">
            {block.imageUrl ? (
              <img
                src={block.imageUrl}
                alt={block.title || 'Email image'}
                className="max-w-full h-24 object-cover rounded mx-auto mb-2"
              />
            ) : (
              <div className="w-full h-24 bg-muted border-2 border-dashed border-muted-foreground/30 rounded flex items-center justify-center mb-2">
                <Image className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {block.title || 'Image Block'}
            </p>
          </div>
        );
      
      case 'button':
        return (
          <div className="text-center">
            <button className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm">
              {block.ctaText || block.content || 'Click Here'}
            </button>
            {block.ctaUrl && (
              <p className="text-xs text-muted-foreground mt-1">
                → {block.ctaUrl}
              </p>
            )}
          </div>
        );
      
      default:
        return null;
    }
  };

  const renderBlockEditor = (block: ContentBlock, index: number) => (
    <>
      <div>
        <Label className="text-sm">Layout</Label>
        <Select
          value={block.layout || 'full-width'}
          onValueChange={(value: BlockLayout) => updateBlock(index, { layout: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select layout" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="full-width">Full Width</SelectItem>
            <SelectItem value="two-column-left">Two Column - Left</SelectItem>
            <SelectItem value="two-column-right">Two Column - Right</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-sm">Title</Label>
        <Input
          value={block.title || ''}
          onChange={(e) => updateBlock(index, { title: e.target.value })}
          placeholder={`${block.type} title...`}
        />
      </div>

      {block.type !== 'button' && (
        <div>
          <Label className="text-sm">Content</Label>
          <Textarea
            value={block.content || ''}
            onChange={(e) => updateBlock(index, { content: e.target.value })}
            placeholder={`Enter ${block.type} content...`}
            rows={3}
          />
        </div>
      )}

      {block.type === 'image' && (
        <div>
          <Label className="text-sm">Image URL</Label>
          <Input
            value={block.imageUrl || ''}
            onChange={(e) => updateBlock(index, { imageUrl: e.target.value })}
            placeholder="https://example.com/image.jpg"
          />
        </div>
      )}

      {block.type === 'button' && (
        <>
          <div>
            <Label className="text-sm">Button Text</Label>
            <Input
              value={block.ctaText || block.content || ''}
              onChange={(e) => updateBlock(index, { 
                ctaText: e.target.value,
                content: e.target.value 
              })}
              placeholder="Click Here"
            />
          </div>
          <div>
            <Label className="text-sm">Button URL</Label>
            <Input
              value={block.ctaUrl || ''}
              onChange={(e) => updateBlock(index, { ctaUrl: e.target.value })}
              placeholder="https://example.com"
            />
          </div>
        </>
      )}
    </>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Email Content Blocks
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Block Buttons */}
        <div className="flex flex-wrap gap-2 p-4 bg-muted/30 rounded-lg">
          <Button
            size="sm"
            variant="outline"
            onClick={() => addBlock('header')}
          >
            <Heading className="h-4 w-4 mr-2" />
            Header
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => addBlock('text')}
          >
            <Type className="h-4 w-4 mr-2" />
            Text
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => addBlock('image')}
          >
            <Image className="h-4 w-4 mr-2" />
            Image
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => addBlock('button')}
          >
            <MousePointer className="h-4 w-4 mr-2" />
            Button
          </Button>
        </div>

        {/* Content Blocks */}
        <div className="space-y-4">
          {blocks.length > 0 ? renderBlocks() : (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-muted-foreground/30 rounded-lg">
              <Image className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No content blocks yet</p>
              <p className="text-sm">Add your first content block using the buttons above</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
