import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { MediaSelectorImage } from '@/components/crm/MediaSelectorImage';
import { Edit, Copy, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ContextualToolbar } from '../contextual/ContextualToolbar';
import { EditMode } from '@/hooks/useBlockEditMode';

interface HeaderBlockProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  isPreview: boolean;
  editMode?: EditMode;
  onModeChange?: (mode: EditMode) => void;
}

export const HeaderBlock: React.FC<HeaderBlockProps> = ({ 
  block, 
  onUpdate, 
  onDuplicate, 
  onDelete, 
  isPreview,
  editMode,
  onModeChange 
}) => {
  // Live preview component that can be reused
  const PreviewContent = () => (
    <div className="relative overflow-hidden rounded-lg group min-h-[300px]">
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

      {/* Contextual Toolbar - only show when onModeChange is available */}
      {onModeChange && (
        <ContextualToolbar
          editMode={editMode}
          onModeChange={onModeChange}
          onImageEdit={() => {
            console.log('[HeaderBlock] Image edit triggered via ContextualToolbar');
            // Find the MediaSelectorImage button in the editor section
            setTimeout(() => {
              const mediaSelector = document.querySelector('[data-media-selector-button]') as HTMLButtonElement;
              console.log('[HeaderBlock] Found MediaSelectorImage button:', !!mediaSelector);
              if (mediaSelector) {
                console.log('[HeaderBlock] Clicking MediaSelectorImage button');
                mediaSelector.click();
              } else {
                console.error('[HeaderBlock] MediaSelectorImage button not found');
              }
            }, 50);
          }}
          showTextEdit={true}
          showImageEdit={true}
          showFormatEdit={true}
        />
      )}
      
      {/* Content - top layer */}
      <div className={cn(
        "relative z-10 p-12 text-white flex items-center justify-center min-h-[300px]",
        // Add dark background only if no background image or color
        !block.backgroundImageUrl && !block.backgroundColor && "bg-slate-800/80",
        block.textAlign === 'center' && "text-center",
        block.textAlign === 'right' && "text-right"
      )}>
        <div className="max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            {block.headline || 'Your Headline Here'}
          </h1>
          <p className="text-lg md:text-xl opacity-90 leading-relaxed">
            {block.body || 'Add your subtitle or description text here.'}
          </p>
        </div>
      </div>

      {/* Legacy Action Buttons - only show when not using contextual toolbar */}
      {!isPreview && !onModeChange && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
          <button
            className="bg-gray-600 hover:bg-gray-700 text-white p-2 rounded-md transition-colors"
            title="Edit"
          >
            <Edit size={16} />
          </button>
          <button
            onClick={onDuplicate}
            className="bg-gray-600 hover:bg-gray-700 text-white p-2 rounded-md transition-colors"
            title="Duplicate"
          >
            <Copy size={16} />
          </button>
          <button
            onClick={onDelete}
            className="bg-gray-600 hover:bg-gray-700 text-white p-2 rounded-md transition-colors"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}
    </div>
  );

  if (isPreview) {
    return <PreviewContent />;
  }

  return (
    <div className="space-y-6">
      {/* Live Preview Section */}
      <div className="space-y-2">
        <Label>Live Preview</Label>
        <div className="border rounded-lg overflow-hidden">
          <PreviewContent />
        </div>
      </div>

      {/* Editor Controls */}
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
              className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded-md transition-colors"
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
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="imageOpacity">Image Opacity</Label>
              <span className="text-sm text-muted-foreground">{block.backgroundOpacity || 100}%</span>
            </div>
            <Slider
              value={[block.backgroundOpacity || 100]}
              onValueChange={(value) => onUpdate({ backgroundOpacity: value[0] })}
              max={100}
              min={1}
              step={1}
              className="w-full"
            />
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
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="colorOpacity">Overlay Opacity</Label>
              <span className="text-sm text-muted-foreground">{block.colorOverlayOpacity || 50}%</span>
            </div>
            <Slider
              value={[block.colorOverlayOpacity || 50]}
              onValueChange={(value) => onUpdate({ colorOverlayOpacity: value[0] })}
              max={100}
              min={1}
              step={1}
              className="w-full"
            />
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