
import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ImageIcon } from 'lucide-react';

interface ProductBlockEditorProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  isExpanded: boolean;
}

export const ProductBlockEditor: React.FC<ProductBlockEditorProps> = ({
  block,
  onUpdate,
  isExpanded
}) => {
  if (!isExpanded) {
    return (
      <div className="flex-1 min-w-0">
        <div className="text-sm text-muted-foreground truncate">
          {block.title ? `"${block.title}"` : 'Product Block'}
          {block.content && (
            <span className="ml-2 text-xs">
              - {block.content.substring(0, 30)}...
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="product-name">Product Name</Label>
          <Input
            id="product-name"
            value={block.title || ''}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Enter product name..."
          />
        </div>

        <div>
          <Label htmlFor="product-price">Price</Label>
          <Input
            id="product-price"
            value={block.ctaText || ''}
            onChange={(e) => onUpdate({ ctaText: e.target.value })}
            placeholder="$99.99"
          />
        </div>
      </div>
      
      <div>
        <Label htmlFor="product-description">Description</Label>
        <Textarea
          id="product-description"
          value={block.content || ''}
          onChange={(e) => onUpdate({ content: e.target.value })}
          placeholder="Enter product description..."
          className="min-h-[80px]"
        />
      </div>

      <div>
        <Label htmlFor="product-image">Product Image URL</Label>
        <div className="flex gap-2">
          <Input
            id="product-image"
            value={block.imageUrl || ''}
            onChange={(e) => onUpdate({ imageUrl: e.target.value })}
            placeholder="Enter image URL..."
          />
          <Button variant="outline" size="icon">
            <ImageIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="product-button-text">Button Text</Label>
          <Input
            id="product-button-text"
            value={block.buttonText || 'Shop Now'}
            onChange={(e) => onUpdate({ buttonText: e.target.value })}
            placeholder="Shop Now"
          />
        </div>

        <div>
          <Label htmlFor="product-button-url">Button URL</Label>
          <Input
            id="product-button-url"
            value={block.buttonUrl || ''}
            onChange={(e) => onUpdate({ buttonUrl: e.target.value })}
            placeholder="https://..."
          />
        </div>
      </div>

      <div>
        <Label htmlFor="product-alignment">Layout</Label>
        <Select 
          value={block.alignment || 'left'} 
          onValueChange={(value) => onUpdate({ alignment: value as any })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Image Left, Text Right</SelectItem>
            <SelectItem value="right">Image Right, Text Left</SelectItem>
            <SelectItem value="center">Centered Stack</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
