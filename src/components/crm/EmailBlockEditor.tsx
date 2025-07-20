
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ContentBlock } from '@/types/emailBuilder';
import { 
  Plus, 
  Trash2, 
  MoveUp, 
  MoveDown, 
  Type, 
  Image, 
  MousePointer, 
  Heading,
  Eye
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
      source: 'manual'
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
          {blocks.map((block, index) => (
            <Card key={index} className="border-l-4 border-l-primary">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getBlockIcon(block.type)}
                    <div>
                      <span className="font-medium capitalize">{block.type} Block</span>
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
                  {block.type === 'header' && (
                    <div className="text-center">
                      <h2 className="text-xl font-bold text-primary mb-1">
                        {block.title || 'Header Title'}
                      </h2>
                      {block.content && (
                        <p className="text-muted-foreground">{block.content}</p>
                      )}
                    </div>
                  )}
                  
                  {block.type === 'text' && (
                    <div>
                      {block.title && (
                        <h3 className="font-semibold mb-2">{block.title}</h3>
                      )}
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {block.content || 'No content'}
                      </p>
                    </div>
                  )}
                  
                  {block.type === 'image' && (
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
                  )}
                  
                  {block.type === 'button' && (
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
                  )}
                </div>

                {/* Block Editor */}
                <div className="space-y-3 pt-2 border-t">
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
                </div>
              </CardContent>
            </Card>
          ))}

          {blocks.length === 0 && (
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
