
import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';

interface LayoutRendererProps {
  blocks: ContentBlock[];
  className?: string;
}

export const LayoutRenderer: React.FC<LayoutRendererProps> = ({ blocks, className = '' }) => {
  const renderBlock = (block: ContentBlock) => {
    const baseClasses = `
      ${block.padding === 'none' ? '' : 
        block.padding === 'small' ? 'p-2' :
        block.padding === 'medium' ? 'p-4' :
        block.padding === 'large' ? 'p-6' : 'p-8'}
      ${block.margin === 'none' ? '' : 
        block.margin === 'small' ? 'm-2' :
        block.margin === 'medium' ? 'm-4' :
        block.margin === 'large' ? 'm-6' : 'm-8'}
      ${block.alignment === 'center' ? 'text-center' :
        block.alignment === 'right' ? 'text-right' :
        block.alignment === 'justify' ? 'text-justify' : 'text-left'}
    `;

    switch (block.type) {
      case 'newsletter-header':
        return (
          <div key={block.id} className={`${baseClasses} bg-green-50 border-b`}>
            <h1 className="text-2xl font-bold text-green-800 mb-2">{block.title}</h1>
            {block.content && <p className="text-green-600">{block.content}</p>}
          </div>
        );

      case 'text':
        return (
          <div key={block.id} className={baseClasses}>
            {block.title && <h2 className="text-xl font-semibold mb-3">{block.title}</h2>}
            <div className="prose max-w-none">
              {block.content?.split('\n').map((paragraph, idx) => (
                <p key={idx} className="mb-3">{paragraph}</p>
              ))}
            </div>
          </div>
        );

      case 'image':
        return (
          <div key={block.id} className={baseClasses}>
            {block.title && <h3 className="text-lg font-medium mb-3">{block.title}</h3>}
            {block.imageUrl && (
              <img 
                src={block.imageUrl} 
                alt={block.title || 'Newsletter image'} 
                className="max-w-full h-auto rounded-lg"
              />
            )}
            {block.content && <p className="mt-3 text-sm text-gray-600">{block.content}</p>}
          </div>
        );

      case 'cta':
      case 'button':
        return (
          <div key={block.id} className={baseClasses}>
            {block.title && <h3 className="text-lg font-medium mb-3">{block.title}</h3>}
            {block.content && <p className="mb-4">{block.content}</p>}
            {block.ctaText && (
              <a
                href={block.ctaUrl || '#'}
                className="inline-block bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                {block.ctaText}
              </a>
            )}
          </div>
        );

      case 'divider':
        return (
          <div key={block.id} className={baseClasses}>
            <hr className="border-gray-300" />
          </div>
        );

      default:
        return (
          <div key={block.id} className={baseClasses}>
            <div className="p-4 bg-gray-100 rounded border-2 border-dashed border-gray-300">
              <p className="text-gray-500 text-center">
                {block.type} block - {block.title || 'Untitled'}
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className={`newsletter-layout ${className}`}>
      {blocks.map(renderBlock)}
    </div>
  );
};
