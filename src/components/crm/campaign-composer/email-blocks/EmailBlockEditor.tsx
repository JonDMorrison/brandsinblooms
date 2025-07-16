import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Type, 
  AlignLeft, 
  AlignCenter, 
  AlignRight,
  Image,
  ExternalLink,
  Sparkles,
  Upload
} from 'lucide-react';

interface EmailBlock {
  id: string;
  type: 'heading' | 'text' | 'image' | 'button' | 'divider' | 'product';
  content: any;
  order: number;
}

interface EmailBlockEditorProps {
  block: EmailBlock;
  onUpdate: (content: any) => void;
}

export const EmailBlockEditor: React.FC<EmailBlockEditorProps> = ({ block, onUpdate }) => {
  const updateContent = (updates: any) => {
    onUpdate({ ...block.content, ...updates });
  };

  const renderEditor = () => {
    switch (block.type) {
      case 'heading':
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Type className="h-4 w-4 text-green-600" />
              <Badge variant="secondary">Heading</Badge>
            </div>
            
            <div>
              <Label>Heading Text</Label>
              <Input
                value={block.content.text || ''}
                onChange={(e) => updateContent({ text: e.target.value })}
                placeholder="Enter your heading..."
                className="font-semibold"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Size</Label>
                <Select 
                  value={block.content.level?.toString() || '2'} 
                  onValueChange={(value) => updateContent({ level: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Large (H1)</SelectItem>
                    <SelectItem value="2">Medium (H2)</SelectItem>
                    <SelectItem value="3">Small (H3)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Alignment</Label>
                <div className="flex gap-1">
                  {['left', 'center', 'right'].map((align) => (
                    <Button
                      key={align}
                      variant={block.content.align === align ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => updateContent({ align })}
                    >
                      {align === 'left' && <AlignLeft className="h-4 w-4" />}
                      {align === 'center' && <AlignCenter className="h-4 w-4" />}
                      {align === 'right' && <AlignRight className="h-4 w-4" />}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 'text':
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Type className="h-4 w-4 text-blue-600" />
                <Badge variant="secondary">Text</Badge>
              </div>
              <Button variant="outline" size="sm">
                <Sparkles className="h-4 w-4 mr-1" />
                AI Generate
              </Button>
            </div>
            
            <div>
              <Label>Content</Label>
              <Textarea
                value={block.content.text || ''}
                onChange={(e) => updateContent({ text: e.target.value })}
                placeholder="Write your content here..."
                rows={4}
              />
            </div>
          </div>
        );

      case 'image':
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Image className="h-4 w-4 text-purple-600" />
              <Badge variant="secondary">Image</Badge>
            </div>
            
            <div>
              <Label>Image URL</Label>
              <div className="flex gap-2">
                <Input
                  value={block.content.src || ''}
                  onChange={(e) => updateContent({ src: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                />
                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Alt Text</Label>
                <Input
                  value={block.content.alt || ''}
                  onChange={(e) => updateContent({ alt: e.target.value })}
                  placeholder="Image description"
                />
              </div>
              
              <div>
                <Label>Alignment</Label>
                <Select 
                  value={block.content.align || 'center'} 
                  onValueChange={(value) => updateContent({ align: value })}
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
            </div>
            
            <div>
              <Label>Caption (Optional)</Label>
              <Input
                value={block.content.caption || ''}
                onChange={(e) => updateContent({ caption: e.target.value })}
                placeholder="Image caption"
              />
            </div>
            
            {block.content.src && (
              <div className="border rounded-lg p-2">
                <img 
                  src={block.content.src} 
                  alt={block.content.alt}
                  className="max-w-full h-auto rounded"
                  style={{ maxHeight: '200px' }}
                />
              </div>
            )}
          </div>
        );

      case 'button':
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <ExternalLink className="h-4 w-4 text-green-600" />
              <Badge variant="secondary">Button</Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Button Text</Label>
                <Input
                  value={block.content.text || ''}
                  onChange={(e) => updateContent({ text: e.target.value })}
                  placeholder="Click Here"
                />
              </div>
              
              <div>
                <Label>Link URL</Label>
                <Input
                  value={block.content.url || ''}
                  onChange={(e) => updateContent({ url: e.target.value })}
                  placeholder="https://example.com"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Style</Label>
                <Select 
                  value={block.content.style || 'primary'} 
                  onValueChange={(value) => updateContent({ style: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">Primary (Green)</SelectItem>
                    <SelectItem value="secondary">Secondary (Gray)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Alignment</Label>
                <Select 
                  value={block.content.align || 'center'} 
                  onValueChange={(value) => updateContent({ align: value })}
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
            </div>
            
            {/* Preview */}
            <div className={`text-${block.content.align || 'center'}`}>
              <div
                className={`inline-block px-6 py-3 rounded-md font-semibold ${
                  block.content.style === 'primary' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-200 text-gray-800'
                }`}
              >
                {block.content.text || 'Button Preview'}
              </div>
            </div>
          </div>
        );

      case 'divider':
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-4 w-4 border-b-2 border-orange-600" />
              <Badge variant="secondary">Divider</Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Style</Label>
                <Select 
                  value={block.content.style || 'solid'} 
                  onValueChange={(value) => updateContent({ style: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solid">Solid Line</SelectItem>
                    <SelectItem value="dashed">Dashed Line</SelectItem>
                    <SelectItem value="dotted">Dotted Line</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Color</Label>
                <Input
                  type="color"
                  value={block.content.color || '#e5e7eb'}
                  onChange={(e) => updateContent({ color: e.target.value })}
                />
              </div>
            </div>
            
            {/* Preview */}
            <div 
              className="w-full h-px"
              style={{ 
                backgroundColor: block.content.color || '#e5e7eb',
                borderStyle: block.content.style || 'solid',
                borderWidth: block.content.style !== 'solid' ? '1px 0 0 0' : '0'
              }}
            />
          </div>
        );

      case 'product':
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-4 w-4 bg-green-600 rounded" />
              <Badge variant="secondary">Product Card</Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Product Name</Label>
                <Input
                  value={block.content.name || ''}
                  onChange={(e) => updateContent({ name: e.target.value })}
                  placeholder="Featured Plant Name"
                />
              </div>
              
              <div>
                <Label>Price</Label>
                <Input
                  value={block.content.price || ''}
                  onChange={(e) => updateContent({ price: e.target.value })}
                  placeholder="$19.99"
                />
              </div>
            </div>
            
            <div>
              <Label>Description</Label>
              <Textarea
                value={block.content.description || ''}
                onChange={(e) => updateContent({ description: e.target.value })}
                placeholder="Brief product description..."
                rows={2}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Image URL</Label>
                <Input
                  value={block.content.image || ''}
                  onChange={(e) => updateContent({ image: e.target.value })}
                  placeholder="Product image URL"
                />
              </div>
              
              <div>
                <Label>Product URL</Label>
                <Input
                  value={block.content.url || ''}
                  onChange={(e) => updateContent({ url: e.target.value })}
                  placeholder="Link to product page"
                />
              </div>
            </div>
            
            {/* Preview */}
            <div className="border rounded-lg p-4 bg-gray-50">
              {block.content.image && (
                <img 
                  src={block.content.image} 
                  alt={block.content.name}
                  className="w-full max-w-[200px] h-auto rounded mb-3"
                />
              )}
              <h3 className="font-semibold text-lg mb-1">{block.content.name || 'Product Name'}</h3>
              <p className="text-gray-600 text-sm mb-2">{block.content.description || 'Product description'}</p>
              <div className="text-green-600 font-bold text-lg mb-3">{block.content.price || '$0.00'}</div>
              {block.content.url && (
                <div className="inline-block px-4 py-2 bg-green-600 text-white rounded font-semibold text-sm">
                  View Product
                </div>
              )}
            </div>
          </div>
        );

      default:
        return <div>Unknown block type: {block.type}</div>;
    }
  };

  return <div className="w-full">{renderEditor()}</div>;
};