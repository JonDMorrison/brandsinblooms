import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MediaSelectorImage } from '@/components/crm/MediaSelectorImage';
import { cn } from '@/lib/utils';

interface HeaderBlockProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  isPreview: boolean;
}

export const HeaderBlock: React.FC<HeaderBlockProps> = ({ block, onUpdate, isPreview }) => {
  if (isPreview) {
    return (
      <div className="relative overflow-hidden rounded-lg">
        {/* Background Image - bottom layer */}
        {block.backgroundImageUrl && (
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ 
              backgroundImage: `url(${block.backgroundImageUrl})`,
              opacity: (block.backgroundOpacity || 100) / 100
            }}
          />
        )}
        
        {/* Color Overlay - middle layer */}
        {block.backgroundColor && (
          <div 
            className="absolute inset-0"
            style={{ 
              backgroundColor: block.backgroundColor,
              opacity: (block.colorOverlayOpacity || 50) / 100
            }}
          />
        )}
        
        {/* Content - top layer */}
        <div className={cn(
          "relative z-10 p-12 text-white",
          // Add dark background only if no background image or color
          !block.backgroundImageUrl && !block.backgroundColor && "bg-slate-800/80",
          block.textAlign === 'center' && "text-center",
          block.textAlign === 'right' && "text-right"
        )}>
          <h1 className="text-4xl font-bold mb-4">
            {block.headline || 'Your Headline Here'}
          </h1>
          <p className="text-lg opacity-90">
            {block.body || 'Add your subtitle or description text here.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="headline">Headline</Label>
          <Input
            id="headline"
            value={block.headline || ''}
            onChange={(e) => onUpdate({ headline: e.target.value })}
            placeholder="Enter headline"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="alignment">Text Alignment</Label>
          <Select
            value={block.textAlign || 'left'}
            onValueChange={(value) => onUpdate({ textAlign: value as any })}
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

      <div className="space-y-2">
        <Label htmlFor="body">Body Text</Label>
        <Textarea
          id="body"
          value={block.body || ''}
          onChange={(e) => onUpdate({ body: e.target.value })}
          placeholder="Enter subtitle or description"
          rows={3}
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Background Image</Label>
          {block.backgroundImageUrl && (
            <button
              onClick={() => onUpdate({ backgroundImageUrl: undefined })}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Remove Image
            </button>
          )}
        </div>
        <MediaSelectorImage
          src={block.backgroundImageUrl}
          onChange={(imageUrl, metadata) => {
            console.log('[HeaderBlock] Image selected:', imageUrl, metadata);
            onUpdate({ backgroundImageUrl: imageUrl });
          }}
          contentContext={block.headline || block.body || 'header background'}
          className="h-32"
        />
        {block.backgroundImageUrl && (
          <div className="space-y-2">
            <Label htmlFor="imageOpacity">Image Opacity</Label>
            <Select
              value={String(block.backgroundOpacity || 100)}
              onValueChange={(value) => onUpdate({ backgroundOpacity: Number(value) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="100">100%</SelectItem>
                <SelectItem value="80">80%</SelectItem>
                <SelectItem value="60">60%</SelectItem>
                <SelectItem value="40">40%</SelectItem>
                <SelectItem value="20">20%</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <Label>Color Overlay</Label>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="bgColor">Overlay Color</Label>
            <Input
              id="bgColor"
              type="color"
              value={block.backgroundColor || '#000000'}
              onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="colorOpacity">Overlay Opacity</Label>
            <Select
              value={String(block.colorOverlayOpacity || 50)}
              onValueChange={(value) => onUpdate({ colorOverlayOpacity: Number(value) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0% (Transparent)</SelectItem>
                <SelectItem value="20">20%</SelectItem>
                <SelectItem value="40">40%</SelectItem>
                <SelectItem value="50">50%</SelectItem>
                <SelectItem value="60">60%</SelectItem>
                <SelectItem value="80">80%</SelectItem>
                <SelectItem value="100">100% (Solid)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Padding</Label>
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
  );
};