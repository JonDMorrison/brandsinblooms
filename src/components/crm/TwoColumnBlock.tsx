
import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';

interface TwoColumnBlockProps {
  leftBlock: ContentBlock;
  rightBlock: ContentBlock;
  isPreview?: boolean;
}

export const TwoColumnBlock: React.FC<TwoColumnBlockProps> = ({
  leftBlock,
  rightBlock,
  isPreview
}) => {
  const renderBlockContent = (block: ContentBlock) => {
    switch (block.type) {
      case 'text':
        return (
          <div className="p-4">
            {block.title && (
              <h3 className="font-semibold text-lg mb-3">{block.title}</h3>
            )}
            <div className="text-sm text-muted-foreground leading-relaxed">
              {block.content?.split('\n').map((paragraph, idx) => (
                <p key={idx} className="mb-2">{paragraph}</p>
              ))}
            </div>
          </div>
        );
      
      case 'image':
        return (
          <div className="p-4">
            {block.imageUrl ? (
              <img
                src={block.imageUrl}
                alt={block.title || 'Block image'}
                className="w-full h-auto rounded-lg object-cover"
              />
            ) : (
              <div className="w-full h-32 bg-muted border-2 border-dashed border-muted-foreground/30 rounded-lg flex items-center justify-center">
                <span className="text-muted-foreground text-sm">Image Placeholder</span>
              </div>
            )}
            {block.title && (
              <p className="text-sm text-muted-foreground mt-2 text-center">
                {block.title}
              </p>
            )}
          </div>
        );
      
      case 'button':
        return (
          <div className="p-4 flex justify-center">
            <button className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium">
              {block.ctaText || block.content || 'Click Here'}
            </button>
          </div>
        );
      
      default:
        return (
          <div className="p-4">
            <p className="text-sm text-muted-foreground">
              {block.type} block content
            </p>
          </div>
        );
    }
  };

  return (
    <div className={`border rounded-lg bg-white overflow-hidden ${isPreview ? 'hover:bg-muted/20 transition-colors' : ''}`}>
      {/* Desktop two-column layout */}
      <div className="hidden md:grid md:grid-cols-2 md:gap-0">
        <div className="border-r">
          {renderBlockContent(leftBlock)}
        </div>
        <div>
          {renderBlockContent(rightBlock)}
        </div>
      </div>

      {/* Mobile single-column layout */}
      <div className="md:hidden space-y-4">
        <div className="border-b pb-4">
          {renderBlockContent(leftBlock)}
        </div>
        <div>
          {renderBlockContent(rightBlock)}
        </div>
      </div>
    </div>
  );
};
