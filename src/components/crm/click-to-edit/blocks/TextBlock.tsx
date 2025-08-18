import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { cn } from '@/lib/utils';

interface TextBlockProps {
  block: ContentBlock;
  onUpdate?: (updates: Partial<ContentBlock>) => void;
  isPreview?: boolean;
}

export const TextBlock: React.FC<TextBlockProps> = ({ block, onUpdate, isPreview = true }) => {
  // Always render as preview - editing is handled by the new mode system
  const paddingClass = {
    none: 'p-0',
    small: 'p-4',
    medium: 'p-6',
    large: 'p-8'
  }[block.padding || 'medium'];

  // Check if this text block has content that could benefit from an image
  const hasRichContent = (block.title || block.content || block.body) && 
    (block.title || block.content || block.body)!.length > 50;
  
  const showAddImageSuggestion = hasRichContent && !block.imageUrl && isPreview && onUpdate;

  return (
    <div 
      className={cn(
        paddingClass,
        block.textAlign === 'center' && "text-center",
        block.textAlign === 'right' && "text-right"
      )}
    >
      {/* Add Image Suggestion */}
      {showAddImageSuggestion && (
        <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">💡 This content would look great with an image</span>
            </div>
            <button
              onClick={() => {
                // Convert to image-text layout and trigger auto-image fetch
                onUpdate({ 
                  layout: 'image-right',
                  type: 'image-text'
                });
              }}
              className="text-xs px-3 py-1 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Add Image
            </button>
          </div>
        </div>
      )}
      
      {/* Text content */}
      <div 
        className="prose max-w-none"
        style={{ 
          fontSize: block.fontSize || '16px',
          fontFamily: block.fontFamily || 'inherit'
        }}
        dangerouslySetInnerHTML={{ 
          __html: (() => {
            // Prioritize non-empty content from either field
            const content = block.content || block.body || '';
            return content || '<p>Add text content</p>';
          })()
        }}
      />
    </div>
  );
};
