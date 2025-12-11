import React, { useRef } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { NativeSelect } from '@/components/ui/NativeSelect';
import { MediaSelectorImage, MediaSelectorImageHandle } from '@/components/crm/MediaSelectorImage';
import { Edit, Copy, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ContextualToolbar } from '../contextual/ContextualToolbar';
import { EditMode } from '@/hooks/useBlockEditMode';
import { sanitizeWeekNumbers } from '@/utils/weekNumberSanitizer';
import { SafeHtml } from '@/components/ui/safe-html';

interface EmailSafeHeroBlockProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  isPreview: boolean;
  editMode?: EditMode;
  onModeChange?: (mode: EditMode) => void;
  isGenerating?: boolean;
}

export const EmailSafeHeroBlock: React.FC<EmailSafeHeroBlockProps> = ({ 
  block, 
  onUpdate, 
  onDuplicate, 
  onDelete, 
  isPreview,
  editMode,
  onModeChange,
  isGenerating = false
}) => {
  const mediaSelectorRef = useRef<MediaSelectorImageHandle>(null);

  // Get background color with fallback
  const backgroundColor = block.backgroundColor || '#2d5a27';
  const textColor = block.textColor || '#ffffff';

  // Live preview component
  const PreviewContent = () => (
    <div className="relative overflow-hidden rounded-lg group">
      {/* Contextual Toolbar */}
      {onModeChange && (
        <ContextualToolbar
          editMode={editMode}
          onModeChange={onModeChange}
          onImageEdit={() => mediaSelectorRef.current?.openDialog()}
          showTextEdit={true}
          showImageEdit={true}
          showFormatEdit={false}
        />
      )}

      {/* Top Section - Solid Background with Text */}
      <div 
        className={cn(
          "p-8 md:p-12",
          block.textAlign === 'center' && "text-center",
          block.textAlign === 'right' && "text-right"
        )}
        style={{ backgroundColor, color: textColor }}
      >
        {/* Eyebrow/Category */}
        {block.eyebrow && (
          <p className="text-sm uppercase tracking-wider opacity-80 mb-2">
            {block.eyebrow}
          </p>
        )}

        {/* Headline */}
        <SafeHtml 
          content={sanitizeWeekNumbers(block.headline || block.title || "Your Headline Here")}
          className="text-3xl md:text-4xl font-bold mb-4 leading-tight [&>*]:m-0"
          type="general"
        />

        {/* Subtitle/Body */}
        {(block.body || block.subtitle) && (
          <SafeHtml 
            content={sanitizeWeekNumbers(block.body || block.subtitle || "")}
            className="text-lg opacity-90 mb-4 [&>*]:m-0"
            type="general"
          />
        )}

        {/* Issue Number - using content field */}
        {block.content && typeof block.content === 'string' && (
          <p className="text-sm opacity-70">
            {block.content}
          </p>
        )}

        {/* CTA Button */}
        {block.ctaText && (
          <div className="mt-6">
            <a 
              href={block.ctaUrl || '#'}
              className="inline-block px-6 py-3 rounded-md font-medium transition-colors"
              style={{ 
                backgroundColor: textColor, 
                color: backgroundColor 
              }}
            >
              {block.ctaText}
            </a>
          </div>
        )}
      </div>

      {/* Bottom Section - Full Width Image */}
      {block.imageUrl && (
        <div className="w-full">
          <img 
            src={block.imageUrl} 
            alt={block.altText || 'Hero image'}
            className="w-full h-auto object-cover"
            style={{ maxHeight: '400px' }}
          />
        </div>
      )}

      {/* Image placeholder when no image */}
      {!block.imageUrl && !isPreview && (
        <div className="w-full h-48 bg-muted flex items-center justify-center text-muted-foreground">
          <span>Click to add an image below the header</span>
        </div>
      )}

      {/* Loading indicator */}
      {isGenerating && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
          <div className="text-sm text-muted-foreground">Generating...</div>
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
          <Label htmlFor="eyebrow">Eyebrow Text (Optional)</Label>
          <Input
            id="eyebrow"
            value={block.eyebrow || ''}
            onChange={(e) => onUpdate({ eyebrow: e.target.value })}
            placeholder="e.g., THIS WEEK, SPECIAL OFFER"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="issueInfo">Issue/Date Info (Optional)</Label>
          <Input
            id="issueInfo"
            value={typeof block.content === 'string' ? block.content : ''}
            onChange={(e) => onUpdate({ content: e.target.value })}
            placeholder="e.g., Issue #12 • December 2024"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="headline">Headline</Label>
        <Input
          id="headline"
          value={block.headline || ''}
          onChange={(e) => onUpdate({ headline: e.target.value })}
          placeholder="Enter your main headline"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="body">Subtitle / Body Text</Label>
        <Textarea
          id="body"
          value={block.body || ''}
          onChange={(e) => onUpdate({ body: e.target.value })}
          placeholder="Enter subtitle or description"
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="ctaText">Button Text (Optional)</Label>
          <Input
            id="ctaText"
            value={block.ctaText || ''}
            onChange={(e) => onUpdate({ ctaText: e.target.value })}
            placeholder="e.g., Shop Now"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ctaUrl">Button Link</Label>
          <Input
            id="ctaUrl"
            value={block.ctaUrl || ''}
            onChange={(e) => onUpdate({ ctaUrl: e.target.value })}
            placeholder="https://..."
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="bgColor">Background Color</Label>
          <div className="flex items-center gap-2">
            <Input
              id="bgColor"
              type="color"
              value={backgroundColor}
              onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
              className="w-16 h-10 p-1 cursor-pointer"
            />
            <Input
              value={backgroundColor}
              onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
              placeholder="#2d5a27"
              className="flex-1"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="textColor">Text Color</Label>
          <div className="flex items-center gap-2">
            <Input
              id="textColor"
              type="color"
              value={textColor}
              onChange={(e) => onUpdate({ textColor: e.target.value })}
              className="w-16 h-10 p-1 cursor-pointer"
            />
            <Input
              value={textColor}
              onChange={(e) => onUpdate({ textColor: e.target.value })}
              placeholder="#ffffff"
              className="flex-1"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="alignment">Text Alignment</Label>
        <NativeSelect
          value={block.textAlign || 'left'}
          onChange={(e) => onUpdate({ textAlign: e.target.value as any })}
          options={[
            { value: 'left', label: 'Left' },
            { value: 'center', label: 'Center' },
            { value: 'right', label: 'Right' }
          ]}
        />
      </div>

      <div className="space-y-2">
        <Label>Hero Image (Below Text)</Label>
        <MediaSelectorImage
          ref={mediaSelectorRef}
          src={block.imageUrl}
          onChange={(imageUrl) => onUpdate({ imageUrl })}
          contentContext={block.headline || block.body || 'hero image'}
          className="h-32"
        />
      </div>
    </div>
  );
};
