import React from 'react';
import { EmailBlock, GlobalSettings } from '@/types/emailBuilder';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Upload } from 'lucide-react';

interface BlockEditorProps {
  block: EmailBlock;
  onUpdate: (updates: Partial<EmailBlock>) => void;
  globalSettings: GlobalSettings;
}

export const BlockEditor: React.FC<BlockEditorProps> = ({
  block,
  onUpdate,
  globalSettings
}) => {
  const updateContent = (key: string, value: any) => {
    onUpdate({
      content: {
        ...block.content,
        [key]: value
      }
    });
  };

  const renderHeaderEditor = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={block.content.title || ''}
          onChange={(e) => updateContent('title', e.target.value)}
          placeholder="Header title"
        />
      </div>
      <div>
        <Label htmlFor="subtitle">Subtitle</Label>
        <Input
          id="subtitle"
          value={block.content.subtitle || ''}
          onChange={(e) => updateContent('subtitle', e.target.value)}
          placeholder="Header subtitle"
        />
      </div>
    </div>
  );

  const renderTextEditor = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={block.content.title || ''}
          onChange={(e) => updateContent('title', e.target.value)}
          placeholder="Section title"
        />
      </div>
      <div>
        <Label htmlFor="content">Content</Label>
        <Textarea
          id="content"
          value={block.content.content || ''}
          onChange={(e) => updateContent('content', e.target.value)}
          placeholder="Add your text content..."
          rows={6}
        />
      </div>
    </div>
  );

  const renderImageEditor = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="image">Image URL</Label>
        <div className="flex gap-2">
          <Input
            id="image"
            value={block.image_url || ''}
            onChange={(e) => onUpdate({ image_url: e.target.value })}
            placeholder="https://example.com/image.jpg"
          />
          <Button variant="outline" size="sm">
            <Upload className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <div>
        <Label htmlFor="alt">Alt Text</Label>
        <Input
          id="alt"
          value={block.content.alt || ''}
          onChange={(e) => updateContent('alt', e.target.value)}
          placeholder="Image description"
        />
      </div>
      <div>
        <Label htmlFor="caption">Caption</Label>
        <Input
          id="caption"
          value={block.content.caption || ''}
          onChange={(e) => updateContent('caption', e.target.value)}
          placeholder="Image caption"
        />
      </div>
      <div>
        <Label htmlFor="alignment">Alignment</Label>
        <Select
          value={block.content.alignment || 'center'}
          onValueChange={(value) => updateContent('alignment', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select alignment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const renderButtonEditor = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="text">Button Text</Label>
        <Input
          id="text"
          value={block.content.text || block.cta_text || ''}
          onChange={(e) => {
            updateContent('text', e.target.value);
            onUpdate({ cta_text: e.target.value });
          }}
          placeholder="Click Here"
        />
      </div>
      <div>
        <Label htmlFor="url">Button URL</Label>
        <Input
          id="url"
          value={block.content.url || block.cta_url || ''}
          onChange={(e) => {
            updateContent('url', e.target.value);
            onUpdate({ cta_url: e.target.value });
          }}
          placeholder="https://example.com"
        />
      </div>
      <div>
        <Label htmlFor="alignment">Alignment</Label>
        <Select
          value={block.content.alignment || 'center'}
          onValueChange={(value) => updateContent('alignment', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select alignment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="right">Right</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const renderDividerEditor = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="style">Style</Label>
        <Select
          value={block.content.style || 'solid'}
          onValueChange={(value) => updateContent('style', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select style" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="solid">Solid</SelectItem>
            <SelectItem value="dashed">Dashed</SelectItem>
            <SelectItem value="dotted">Dotted</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="color">Color</Label>
        <Input
          id="color"
          type="color"
          value={block.content.color || '#E5E7EB'}
          onChange={(e) => updateContent('color', e.target.value)}
        />
      </div>
    </div>
  );

  const renderProductEditor = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="name">Product Name</Label>
        <Input
          id="name"
          value={block.content.name || ''}
          onChange={(e) => updateContent('name', e.target.value)}
          placeholder="Product name"
        />
      </div>
      <div>
        <Label htmlFor="price">Price</Label>
        <Input
          id="price"
          value={block.content.price || ''}
          onChange={(e) => updateContent('price', e.target.value)}
          placeholder="$99.99"
        />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={block.content.description || ''}
          onChange={(e) => updateContent('description', e.target.value)}
          placeholder="Product description"
          rows={3}
        />
      </div>
      <div>
        <Label htmlFor="image">Product Image</Label>
        <div className="flex gap-2">
          <Input
            id="image"
            value={block.image_url || ''}
            onChange={(e) => onUpdate({ image_url: e.target.value })}
            placeholder="https://example.com/product.jpg"
          />
          <Button variant="outline" size="sm">
            <Upload className="w-4 h-4" />
          </Button>
        </div>
      </div>
      <div>
        <Label htmlFor="buttonText">Button Text</Label>
        <Input
          id="buttonText"
          value={block.content.buttonText || ''}
          onChange={(e) => updateContent('buttonText', e.target.value)}
          placeholder="Shop Now"
        />
      </div>
      <div>
        <Label htmlFor="buttonUrl">Button URL</Label>
        <Input
          id="buttonUrl"
          value={block.content.buttonUrl || ''}
          onChange={(e) => updateContent('buttonUrl', e.target.value)}
          placeholder="https://shop.example.com"
        />
      </div>
    </div>
  );

  const renderEditor = () => {
    switch (block.block_type) {
      case 'header':
        return renderHeaderEditor();
      case 'text':
        return renderTextEditor();
      case 'image':
        return renderImageEditor();
      case 'button':
        return renderButtonEditor();
      case 'divider':
        return renderDividerEditor();
      case 'product':
        return renderProductEditor();
      default:
        return <div>No editor available for this block type</div>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg capitalize">
          {block.block_type} Settings
        </CardTitle>
      </CardHeader>
      <CardContent>
        {renderEditor()}
      </CardContent>
    </Card>
  );
};