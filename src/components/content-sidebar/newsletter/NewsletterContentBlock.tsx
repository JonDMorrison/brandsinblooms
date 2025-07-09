
import React from 'react';
import { NewsletterImageManager } from './NewsletterImageManager';

interface NewsletterBlock {
  title: string;
  body: string;
  cta: string;
  link: string;
  image_prompt: string;
  alt_text: string;
}

interface ImageData {
  url: string;
  alt: string;
  photographer?: string;
}

interface NewsletterContentBlockProps {
  block: NewsletterBlock;
  index: number;
  isStructuredNewsletter: boolean;
  images: Record<number, ImageData>;
  imageErrors: Record<number, string>;
  loadingImages: boolean;
}

export const NewsletterContentBlock: React.FC<NewsletterContentBlockProps> = ({
  block,
  index,
  isStructuredNewsletter,
  images,
  imageErrors,
  loadingImages
}) => {
  return (
    <div className="grid lg:grid-cols-2 gap-8 items-start">
      {/* Content */}
      <div>
        {isStructuredNewsletter ? (
          // Structured newsletter - show title and body separately
          <>
            <h3 className="text-2xl font-bold text-slate-900 mb-4 leading-tight">
              {block.title}
            </h3>
            
            <div className="prose prose-slate max-w-none">
              <p className="text-lg text-slate-700 leading-relaxed mb-6">
                {block.body}
              </p>
            </div>
          </>
        ) : (
          // Plain text newsletter - enhanced formatting
          <>
            {block.title !== block.body && (
              <h3 className="text-2xl font-bold text-slate-900 mb-4 leading-tight">
                {block.title}
              </h3>
            )}
            
            <div className="prose prose-slate max-w-none">
              <div className="text-lg text-slate-700 leading-relaxed whitespace-pre-wrap">
                {block.body}
              </div>
            </div>
          </>
        )}
        
        {block.cta && (
          <div className="mt-6">
            {block.link && block.link.startsWith('http') ? (
              // External link - use anchor tag
              <a 
                href={block.link} 
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-primary font-semibold hover:text-primary/80 transition-colors"
              >
                {block.cta} →
              </a>
            ) : (
              // Internal link - use span for newsletter content (not navigational)
              <span className="inline-flex items-center text-primary font-semibold">
                {block.cta} →
              </span>
            )}
          </div>
        )}
      </div>

      {/* Image */}
      <div>
        <NewsletterImageManager
          images={images}
          imageErrors={imageErrors}
          loadingImages={loadingImages}
          blockIndex={index}
        />
      </div>
    </div>
  );
};
