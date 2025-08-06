import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, GripVertical, Image, Type, Video, Gift, CreditCard, Star } from 'lucide-react';

export interface ContentBlock {
  id?: string;
  type: string;
  payload_json: any;
  sort_order: number;
  is_active?: boolean;
}

interface ContentBlockEditorProps {
  blocks: ContentBlock[];
  onBlocksChange: (blocks: ContentBlock[]) => void;
  campaignId?: string;
}

const BLOCK_TYPES = [
  { value: 'image', label: 'Image', icon: Image },
  { value: 'text', label: 'Text Content', icon: Type },
  { value: 'image_carousel', label: 'Image Carousel', icon: Image },
  { value: 'offer_card', label: 'Offer Card', icon: Gift },
  { value: 'video', label: 'Video', icon: Video },
  { value: 'loyalty_widget', label: 'Loyalty Points', icon: Star },
  { value: 'coupon', label: 'Coupon', icon: CreditCard },
  { value: 'rich_text', label: 'Rich Text', icon: Type },
];

export const ContentBlockEditor: React.FC<ContentBlockEditorProps> = ({
  blocks,
  onBlocksChange,
  campaignId
}) => {
  const [selectedBlockType, setSelectedBlockType] = useState<string>('');

  const addBlock = () => {
    if (!selectedBlockType) return;

    const newBlock: ContentBlock = {
      id: `temp-${Date.now()}`,
      type: selectedBlockType,
      payload_json: getDefaultPayload(selectedBlockType),
      sort_order: blocks.length,
      is_active: true
    };

    onBlocksChange([...blocks, newBlock]);
    setSelectedBlockType('');
  };

  const updateBlock = (index: number, updates: Partial<ContentBlock>) => {
    const updatedBlocks = [...blocks];
    updatedBlocks[index] = { ...updatedBlocks[index], ...updates };
    onBlocksChange(updatedBlocks);
  };

  const deleteBlock = (index: number) => {
    const updatedBlocks = blocks.filter((_, i) => i !== index);
    // Update sort orders
    updatedBlocks.forEach((block, i) => {
      block.sort_order = i;
    });
    onBlocksChange(updatedBlocks);
  };

  const moveBlock = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= blocks.length) return;
    
    const updatedBlocks = [...blocks];
    const [movedBlock] = updatedBlocks.splice(fromIndex, 1);
    updatedBlocks.splice(toIndex, 0, movedBlock);
    
    // Update sort orders
    updatedBlocks.forEach((block, i) => {
      block.sort_order = i;
    });
    
    onBlocksChange(updatedBlocks);
  };

  const getDefaultPayload = (type: string) => {
    switch (type) {
      case 'image':
        return { url: '', alt: '' };
      case 'text':
      case 'rich_text':
        return { title: '', content: '' };
      case 'image_carousel':
        return { images: [] };
      case 'offer_card':
        return { 
          title: '', 
          description: '', 
          price: '', 
          original_price: '', 
          button_text: 'Redeem Offer' 
        };
      case 'video':
        return { url: '', title: '' };
      case 'loyalty_widget':
        return { points: '0', message: 'Keep earning points with every purchase!' };
      case 'coupon':
        return { title: '', code: '', description: '' };
      default:
        return {};
    }
  };

  const renderBlockEditor = (block: ContentBlock, index: number) => {
    const blockType = BLOCK_TYPES.find(t => t.value === block.type);
    const Icon = blockType?.icon || Type;

    return (
      <Card key={block.id || index} className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GripVertical className="w-4 h-4 text-muted-foreground cursor-move" />
              <Icon className="w-4 h-4" />
              <CardTitle className="text-sm">
                {blockType?.label || block.type}
              </CardTitle>
              <Badge variant="secondary" className="text-xs">
                {index + 1}
              </Badge>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => moveBlock(index, index - 1)}
                disabled={index === 0}
              >
                ↑
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => moveBlock(index, index + 1)}
                disabled={index === blocks.length - 1}
              >
                ↓
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteBlock(index)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {renderBlockFields(block, index)}
        </CardContent>
      </Card>
    );
  };

  const renderBlockFields = (block: ContentBlock, index: number) => {
    const payload = block.payload_json;

    switch (block.type) {
      case 'image':
        return (
          <div className="space-y-3">
            <div>
              <Label htmlFor={`image-url-${index}`}>Image URL</Label>
              <Input
                id={`image-url-${index}`}
                value={payload.url || ''}
                onChange={(e) => updateBlock(index, {
                  payload_json: { ...payload, url: e.target.value }
                })}
                placeholder="https://example.com/image.jpg"
              />
            </div>
            <div>
              <Label htmlFor={`image-alt-${index}`}>Alt Text</Label>
              <Input
                id={`image-alt-${index}`}
                value={payload.alt || ''}
                onChange={(e) => updateBlock(index, {
                  payload_json: { ...payload, alt: e.target.value }
                })}
                placeholder="Descriptive text for accessibility"
              />
            </div>
          </div>
        );

      case 'text':
      case 'rich_text':
        return (
          <div className="space-y-3">
            <div>
              <Label htmlFor={`text-title-${index}`}>Title (Optional)</Label>
              <Input
                id={`text-title-${index}`}
                value={payload.title || ''}
                onChange={(e) => updateBlock(index, {
                  payload_json: { ...payload, title: e.target.value }
                })}
                placeholder="Block title"
              />
            </div>
            <div>
              <Label htmlFor={`text-content-${index}`}>Content</Label>
              <Textarea
                id={`text-content-${index}`}
                value={payload.content || ''}
                onChange={(e) => updateBlock(index, {
                  payload_json: { ...payload, content: e.target.value }
                })}
                placeholder="Your content here..."
                rows={4}
              />
            </div>
          </div>
        );

      case 'offer_card':
        return (
          <div className="space-y-3">
            <div>
              <Label htmlFor={`offer-title-${index}`}>Offer Title</Label>
              <Input
                id={`offer-title-${index}`}
                value={payload.title || ''}
                onChange={(e) => updateBlock(index, {
                  payload_json: { ...payload, title: e.target.value }
                })}
                placeholder="Special Offer"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor={`offer-price-${index}`}>Current Price</Label>
                <Input
                  id={`offer-price-${index}`}
                  value={payload.price || ''}
                  onChange={(e) => updateBlock(index, {
                    payload_json: { ...payload, price: e.target.value }
                  })}
                  placeholder="19.99"
                />
              </div>
              <div>
                <Label htmlFor={`offer-original-${index}`}>Original Price (Optional)</Label>
                <Input
                  id={`offer-original-${index}`}
                  value={payload.original_price || ''}
                  onChange={(e) => updateBlock(index, {
                    payload_json: { ...payload, original_price: e.target.value }
                  })}
                  placeholder="29.99"
                />
              </div>
            </div>
            <div>
              <Label htmlFor={`offer-desc-${index}`}>Description</Label>
              <Textarea
                id={`offer-desc-${index}`}
                value={payload.description || ''}
                onChange={(e) => updateBlock(index, {
                  payload_json: { ...payload, description: e.target.value }
                })}
                placeholder="Offer description..."
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor={`offer-button-${index}`}>Button Text</Label>
              <Input
                id={`offer-button-${index}`}
                value={payload.button_text || ''}
                onChange={(e) => updateBlock(index, {
                  payload_json: { ...payload, button_text: e.target.value }
                })}
                placeholder="Redeem Offer"
              />
            </div>
          </div>
        );

      case 'video':
        return (
          <div className="space-y-3">
            <div>
              <Label htmlFor={`video-url-${index}`}>Video URL</Label>
              <Input
                id={`video-url-${index}`}
                value={payload.url || ''}
                onChange={(e) => updateBlock(index, {
                  payload_json: { ...payload, url: e.target.value }
                })}
                placeholder="https://example.com/video.mp4"
              />
            </div>
            <div>
              <Label htmlFor={`video-title-${index}`}>Title (Optional)</Label>
              <Input
                id={`video-title-${index}`}
                value={payload.title || ''}
                onChange={(e) => updateBlock(index, {
                  payload_json: { ...payload, title: e.target.value }
                })}
                placeholder="Video title"
              />
            </div>
          </div>
        );

      case 'loyalty_widget':
        return (
          <div className="space-y-3">
            <div>
              <Label htmlFor={`loyalty-points-${index}`}>Points to Display</Label>
              <Input
                id={`loyalty-points-${index}`}
                value={payload.points || ''}
                onChange={(e) => updateBlock(index, {
                  payload_json: { ...payload, points: e.target.value }
                })}
                placeholder="250"
              />
            </div>
            <div>
              <Label htmlFor={`loyalty-message-${index}`}>Message</Label>
              <Input
                id={`loyalty-message-${index}`}
                value={payload.message || ''}
                onChange={(e) => updateBlock(index, {
                  payload_json: { ...payload, message: e.target.value }
                })}
                placeholder="Keep earning points with every purchase!"
              />
            </div>
          </div>
        );

      case 'coupon':
        return (
          <div className="space-y-3">
            <div>
              <Label htmlFor={`coupon-title-${index}`}>Coupon Title</Label>
              <Input
                id={`coupon-title-${index}`}
                value={payload.title || ''}
                onChange={(e) => updateBlock(index, {
                  payload_json: { ...payload, title: e.target.value }
                })}
                placeholder="Save 20% Today"
              />
            </div>
            <div>
              <Label htmlFor={`coupon-code-${index}`}>Coupon Code</Label>
              <Input
                id={`coupon-code-${index}`}
                value={payload.code || ''}
                onChange={(e) => updateBlock(index, {
                  payload_json: { ...payload, code: e.target.value }
                })}
                placeholder="SAVE20"
              />
            </div>
            <div>
              <Label htmlFor={`coupon-desc-${index}`}>Description</Label>
              <Textarea
                id={`coupon-desc-${index}`}
                value={payload.description || ''}
                onChange={(e) => updateBlock(index, {
                  payload_json: { ...payload, description: e.target.value }
                })}
                placeholder="Valid until end of month. Cannot be combined with other offers."
                rows={3}
              />
            </div>
          </div>
        );

      default:
        return (
          <div className="text-sm text-muted-foreground">
            Block type "{block.type}" editor not implemented yet.
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Content Blocks</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Create engaging content blocks for your campaign hub. These will appear in order on your mobile-optimized landing page.
        </p>
      </div>

      {blocks.length > 0 && (
        <div className="space-y-4">
          {blocks.map((block, index) => renderBlockEditor(block, index))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Add New Block</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <select 
              value={selectedBlockType} 
              onChange={(e) => setSelectedBlockType(e.target.value)}
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">Choose block type...</option>
              {BLOCK_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <Button 
              onClick={addBlock} 
              disabled={!selectedBlockType}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Block
            </Button>
          </div>
        </CardContent>
      </Card>

      {blocks.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Image className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No content blocks yet. Add your first block above!</p>
        </div>
      )}
    </div>
  );
};