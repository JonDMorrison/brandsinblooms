import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/NativeSelect';
import { Slider } from '@/components/ui/slider';
import { MediaSelectorImage } from '@/components/crm/MediaSelectorImage';
import { CTAButton } from '@/components/ui/CTAButton';
import { cn } from '@/lib/utils';
import { ContextualToolbar } from '../contextual/ContextualToolbar';
import { EditMode } from '@/hooks/useBlockEditMode';
import { sanitizeWeekNumbers } from '@/utils/weekNumberSanitizer';

interface NewsletterHeaderBlockProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  isPreview: boolean;
  editMode?: EditMode;
  onModeChange?: (mode: EditMode) => void;
}

export const NewsletterHeaderBlock: React.FC<NewsletterHeaderBlockProps> = ({ 
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
    <div className="relative overflow-hidden rounded-lg group min-h-[400px]">
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
      
      {/* Dark Overlay - for text contrast */}
      {block.backgroundImageUrl && block.darkOverlayOpacity && block.darkOverlayOpacity > 0 && (
        <div 
          className="absolute inset-0 bg-black"
          style={{ 
            opacity: (block.darkOverlayOpacity || 0) / 100
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
            setTimeout(() => {
              const mediaSelector = document.querySelector('[data-media-selector-button]') as HTMLButtonElement;
              if (mediaSelector) {
                mediaSelector.click();
              }
            }, 50);
          }}
          showTextEdit={true}
          showImageEdit={true}
          showFormatEdit={false}
        />
      )}
      
      {/* Newsletter Header Content - top layer */}
      <div className={cn(
        "relative z-10 p-12 text-white flex flex-col items-center justify-center min-h-[400px]",
        // Add dark background only if no background image or color
        !block.backgroundImageUrl && !block.backgroundColor && "bg-gradient-to-br from-primary to-primary-dark",
        block.textAlign === 'center' && "text-center",
        block.textAlign === 'right' && "text-right"
      )}>
        <div className="max-w-3xl w-full text-center space-y-6">
          {/* Newsletter Title */}
          <h1 className="text-5xl md:text-6xl font-bold mb-4 leading-tight">
            {sanitizeWeekNumbers(block.headline || block.title || "Newsletter Title")}
          </h1>
          
          {/* Subtitle */}
          {(block.subtitle || block.body || block.content) && (
            <p className="text-xl md:text-2xl opacity-90 leading-relaxed">
              {sanitizeWeekNumbers(
                block.subtitle || 
                (block.body ? block.body.replace(/<[^>]*>/g, '') : '') || 
                (block.content ? block.content.replace(/<[^>]*>/g, '') : '') || 
                "Your newsletter subtitle"
              )}
            </p>
          )}

          {/* Issue Info Row */}
          <div className="flex items-center justify-center gap-8 text-lg opacity-80 mt-8">
            {block.issueNumber && (
              <div className="flex items-center gap-2">
                <span className="font-semibold">Issue #{block.issueNumber}</span>
              </div>
            )}
            
            {block.publishDate && (
              <div className="flex items-center gap-2">
                <span>{new Date(block.publishDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long', 
                  day: 'numeric'
                })}</span>
              </div>
            )}
          </div>

          {/* CTA Button */}
          {(block.ctaText || block.buttonText || block.ctaUrl || block.buttonUrl) && (
            <div className="mt-8 flex justify-center">
              <CTAButton 
                block={block} 
                variant="secondary" 
                size="lg"
                className="text-white border-white hover:bg-white hover:text-primary"
              />
            </div>
          )}
        </div>
      </div>
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
          <Label htmlFor="title">Newsletter Title</Label>
          <Input
            id="title"
            value={block.title || ''}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="Enter newsletter title"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="alignment">Text Alignment</Label>
          <NativeSelect
            value={block.textAlign || 'center'}
            onChange={(e) => onUpdate({ textAlign: e.target.value as any })}
            options={[
              { value: 'left', label: 'Left' },
              { value: 'center', label: 'Center' },
              { value: 'right', label: 'Right' }
            ]}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subtitle">Subtitle</Label>
        <Textarea
          id="subtitle"
          value={block.subtitle || block.body || ''}
          onChange={(e) => onUpdate({ subtitle: e.target.value, body: e.target.value })}
          placeholder="Enter newsletter subtitle"
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="issueNumber">Issue Number</Label>
          <Input
            id="issueNumber"
            type="number"
            value={block.issueNumber || ''}
            onChange={(e) => onUpdate({ issueNumber: e.target.value })}
            placeholder="e.g. 42"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="publishDate">Publish Date</Label>
          <Input
            id="publishDate"
            type="date"
            value={block.publishDate || ''}
            onChange={(e) => onUpdate({ publishDate: e.target.value })}
          />
        </div>
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
            onUpdate({ backgroundImageUrl: imageUrl });
          }}
          contentContext={block.title || 'newsletter header background'}
          className="h-32"
        />
        {block.backgroundImageUrl && (
          <>
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
            
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="darkOverlay">Dark Overlay (for text contrast)</Label>
                <span className="text-sm text-muted-foreground">{block.darkOverlayOpacity || 0}%</span>
              </div>
              <Slider
                id="darkOverlay"
                value={[block.darkOverlayOpacity || 0]}
                onValueChange={(value) => onUpdate({ darkOverlayOpacity: value[0] })}
                max={100}
                min={0}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">Adds a dark overlay to improve text readability</p>
            </div>
          </>
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
        <NativeSelect
          value={block.padding || 'large'}
          onChange={(e) => onUpdate({ padding: e.target.value as any })}
          options={[
            { value: 'none', label: 'None' },
            { value: 'small', label: 'Small' },
            { value: 'medium', label: 'Medium' },
            { value: 'large', label: 'Large' }
          ]}
        />
      </div>
    </div>
  );
};