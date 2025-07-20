import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmailBlock, GlobalSettings } from '@/types/emailBuilder';
import { Plus, Trash2, MoveUp, MoveDown } from 'lucide-react';

interface EmailBlockEditorProps {
  blocks: EmailBlock[];
  onBlocksChange: (blocks: EmailBlock[]) => void;
  globalSettings: GlobalSettings;
  onGlobalSettingsChange: (settings: GlobalSettings) => void;
}

export const EmailBlockEditor: React.FC<EmailBlockEditorProps> = ({
  blocks,
  onBlocksChange,
  globalSettings,
  onGlobalSettingsChange
}) => {
  const addBlock = (type: EmailBlock['block_type']) => {
    const newBlock: EmailBlock = {
      id: `block-${Date.now()}`,
      block_type: type,
      content: type === 'header' ? { title: 'New Header', subtitle: '' } : { title: '', content: '' },
      order_index: blocks.length,
      campaign_id: ''
    };
    onBlocksChange([...blocks, newBlock]);
  };

  const updateBlock = (blockId: string, updates: Partial<EmailBlock>) => {
    onBlocksChange(blocks.map(block => 
      block.id === blockId ? { ...block, ...updates } : block
    ));
  };

  const deleteBlock = (blockId: string) => {
    onBlocksChange(blocks.filter(block => block.id !== blockId));
  };

  const moveBlock = (blockId: string, direction: 'up' | 'down') => {
    const blockIndex = blocks.findIndex(block => block.id === blockId);
    if (blockIndex === -1) return;

    const newBlocks = [...blocks];
    const targetIndex = direction === 'up' ? blockIndex - 1 : blockIndex + 1;

    if (targetIndex >= 0 && targetIndex < blocks.length) {
      [newBlocks[blockIndex], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[blockIndex]];
      // Update order indices
      newBlocks.forEach((block, index) => {
        block.order_index = index;
      });
      onBlocksChange(newBlocks);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Email Content Blocks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() => addBlock('header')}
            >
              <Plus className="h-4 w-4 mr-2" />
              Header
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => addBlock('text')}
            >
              <Plus className="h-4 w-4 mr-2" />
              Text
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => addBlock('image')}
            >
              <Plus className="h-4 w-4 mr-2" />
              Image
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => addBlock('button')}
            >
              <Plus className="h-4 w-4 mr-2" />
              Button
            </Button>
          </div>

          <div className="space-y-4">
            {blocks.map((block, index) => (
              <Card key={block.id} className="border border-dashed">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium capitalize">
                        {block.block_type} Block
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => moveBlock(block.id, 'up')}
                        disabled={index === 0}
                      >
                        <MoveUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => moveBlock(block.id, 'down')}
                        disabled={index === blocks.length - 1}
                      >
                        <MoveDown className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteBlock(block.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {block.block_type === 'header' && (
                    <div className="space-y-3">
                      <div>
                        <Label>Title</Label>
                        <Input
                          value={block.content?.title || ''}
                          onChange={(e) => updateBlock(block.id, {
                            content: { ...block.content, title: e.target.value }
                          })}
                          placeholder="Header title..."
                        />
                      </div>
                      <div>
                        <Label>Subtitle</Label>
                        <Input
                          value={block.content?.subtitle || ''}
                          onChange={(e) => updateBlock(block.id, {
                            content: { ...block.content, subtitle: e.target.value }
                          })}
                          placeholder="Header subtitle..."
                        />
                      </div>
                    </div>
                  )}

                  {block.block_type === 'text' && (
                    <div className="space-y-3">
                      <div>
                        <Label>Title</Label>
                        <Input
                          value={block.content?.title || ''}
                          onChange={(e) => updateBlock(block.id, {
                            content: { ...block.content, title: e.target.value }
                          })}
                          placeholder="Section title..."
                        />
                      </div>
                      <div>
                        <Label>Content</Label>
                        <Textarea
                          value={block.content?.content || ''}
                          onChange={(e) => updateBlock(block.id, {
                            content: { ...block.content, content: e.target.value }
                          })}
                          placeholder="Your content here..."
                          rows={4}
                        />
                      </div>
                    </div>
                  )}

                  {block.block_type === 'image' && (
                    <div className="space-y-3">
                      <div>
                        <Label>Image URL</Label>
                        <Input
                          value={block.image_url || ''}
                          onChange={(e) => updateBlock(block.id, { image_url: e.target.value })}
                          placeholder="https://example.com/image.jpg"
                        />
                      </div>
                      <div>
                        <Label>Alt Text</Label>
                        <Input
                          value={block.content?.alt || ''}
                          onChange={(e) => updateBlock(block.id, {
                            content: { ...block.content, alt: e.target.value }
                          })}
                          placeholder="Image description..."
                        />
                      </div>
                    </div>
                  )}

                  {block.block_type === 'button' && (
                    <div className="space-y-3">
                      <div>
                        <Label>Button Text</Label>
                        <Input
                          value={block.cta_text || ''}
                          onChange={(e) => updateBlock(block.id, { cta_text: e.target.value })}
                          placeholder="Click Here"
                        />
                      </div>
                      <div>
                        <Label>Button URL</Label>
                        <Input
                          value={block.cta_url || ''}
                          onChange={(e) => updateBlock(block.id, { cta_url: e.target.value })}
                          placeholder="https://example.com"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {blocks.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No content blocks yet. Add your first block above.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};