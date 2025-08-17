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

  return (
    <div 
      className={cn(
        paddingClass,
        block.textAlign === 'center' && "text-center",
        block.textAlign === 'right' && "text-right"
      )}
    >
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
