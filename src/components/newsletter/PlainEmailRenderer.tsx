import React from 'react';
import { SafeHtml } from '@/components/ui/safe-html';
import { NewsletterBlock, NewsletterMeta } from './MagazineNewsletterRenderer';

interface PlainEmailRendererProps {
  title?: string;
  blocks: NewsletterBlock[];
  meta?: NewsletterMeta;
  className?: string;
}

export const PlainEmailRenderer = ({ 
  title, 
  blocks, 
  meta, 
  className = '' 
}: PlainEmailRendererProps) => {
  return (
    <div className={`prose max-w-none ${className}`}>
      {/* Header */}
      {title && (
        <h1 className="text-3xl font-bold text-foreground mb-6">
          {title}
        </h1>
      )}
      
      {/* Meta information */}
      {meta && (
        <div className="text-sm text-muted-foreground mb-6 space-x-3">
          {meta.reading_time && (
            <span>📖 {meta.reading_time}</span>
          )}
          {meta.theme && (
            <span>🌿 {meta.theme}</span>
          )}
        </div>
      )}

      {/* Content blocks */}
      {blocks.map((block, index) => (
        <div key={index} className="mb-6">
          {/* Block title */}
          {block.title && (
            <h3 className="text-xl font-semibold text-foreground mb-3">
              {block.title}
            </h3>
          )}
          
          {/* Block body */}
          {block.body && (
            <p className="text-muted-foreground leading-relaxed mb-3">
              <SafeHtml content={block.body} type="newsletter" className="text-gray-700 leading-relaxed mb-4" />
            </p>
          )}
          
          {/* Call-to-action as inline link */}
          {block.cta && block.cta !== 'Learn more' && (
            <p>
              <a 
                href={block.link || '#'} 
                className="text-primary underline hover:text-primary/80 font-medium"
              >
                {block.cta}
              </a>
            </p>
          )}
        </div>
      ))}
    </div>
  );
};