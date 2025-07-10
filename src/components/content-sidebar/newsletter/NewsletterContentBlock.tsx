
import React from 'react';
import { MediaSelector } from '@/components/image';

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
  onImageSelect?: (blockIndex: number, imageUrl: string, metadata?: any) => void;
  selectedImages?: Record<number, string>;
}

export const NewsletterContentBlock: React.FC<NewsletterContentBlockProps> = ({
  block,
  index,
  isStructuredNewsletter,
  images,
  imageErrors,
  loadingImages,
  onImageSelect,
  selectedImages
}) => {
  const handleImageSelect = (imageUrl: string, metadata?: any) => {
    if (onImageSelect) {
      onImageSelect(index, imageUrl, metadata);
    }
  };

  // Use selected image if available, otherwise fall back to auto-generated image
  const currentImageUrl = selectedImages?.[index] || images[index]?.url;
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
        <MediaSelector
          onImageSelect={handleImageSelect}
          selectedImageUrl={currentImageUrl}
          contentContext={`${block.title} ${block.body}`.slice(0, 200)}
          className="aspect-[4/3]"
        />
      </div>
    </div>
  );
};
