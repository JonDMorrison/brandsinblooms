import React, { useRef } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MediaSelectorImage, MediaSelectorImageHandle } from '@/components/crm/MediaSelectorImage';
import { cn } from '@/lib/utils';
import { ContextualToolbar } from '../contextual/ContextualToolbar';
import { EditMode } from '@/hooks/useBlockEditMode';
import { ImageIcon } from 'lucide-react';

interface GraphicHeroBlockProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  isPreview: boolean;
  editMode?: EditMode;
  onModeChange?: (mode: EditMode) => void;
  isGenerating?: boolean;
}

export const GraphicHeroBlock: React.FC<GraphicHeroBlockProps> = ({ 
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

  // Live preview component - just the image (text is baked in)
  const PreviewContent = () => (
    <div className="relative overflow-hidden rounded-lg group">
      {/* Contextual Toolbar */}
      {onModeChange && (
        <ContextualToolbar
          editMode={editMode}
          onModeChange={onModeChange}
          onImageEdit={() => mediaSelectorRef.current?.openDialog()}
          showTextEdit={false}
          showImageEdit={true}
          showFormatEdit={false}
        />
      )}

      {/* The Graphic Hero - just an image with optional link */}
      {block.imageUrl ? (
        block.ctaUrl ? (
          <a href={block.ctaUrl} target="_blank" rel="noopener noreferrer">
            <img 
              src={block.imageUrl} 
              alt={block.altText || ''}
              className="w-full h-auto object-cover"
            />
          </a>
        ) : (
          <img 
            src={block.imageUrl} 
            alt={block.altText || ''}
            className="w-full h-auto object-cover"
          />
        )
      ) : (
        <div 
          className={cn(
            "w-full flex flex-col items-center justify-center text-muted-foreground bg-muted",
            isPreview ? "h-48" : "h-64"
          )}
        >
          <ImageIcon className="h-12 w-12 mb-2 opacity-50" />
          <span className="text-sm">Upload a pre-designed graphic with text baked in</span>
          <span className="text-xs opacity-70 mt-1">Perfect for Canva designs, flyers, or custom graphics</span>
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

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <p className="font-medium mb-1">📷 Graphic Hero Block</p>
        <p className="text-blue-700">
          Upload a pre-designed image with text already included. This is perfect for 
          Canva designs, promotional flyers, or any graphic where the text is part of the image.
        </p>
      </div>

      {/* Image Upload */}
      <div className="space-y-2">
        <Label>Upload Your Graphic</Label>
        <MediaSelectorImage
          ref={mediaSelectorRef}
          src={block.imageUrl}
          onChange={(imageUrl) => onUpdate({ imageUrl })}
          contentContext="graphic hero image"
          className="h-48"
        />
      </div>

      {/* Alt Text */}
      <div className="space-y-2">
        <Label htmlFor="altText">Alt Text (for accessibility)</Label>
        <Input
          id="altText"
          value={block.altText || ''}
          onChange={(e) => onUpdate({ altText: e.target.value })}
          placeholder="Describe the image content"
        />
      </div>

      {/* Click-through URL */}
      <div className="space-y-2">
        <Label htmlFor="ctaUrl">Click-through URL (Optional)</Label>
        <Input
          id="ctaUrl"
          value={block.ctaUrl || ''}
          onChange={(e) => onUpdate({ ctaUrl: e.target.value })}
          placeholder="https://..."
        />
        <p className="text-xs text-muted-foreground">
          When set, the entire image becomes clickable
        </p>
      </div>
    </div>
  );
};
