
import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { cn } from '@/lib/utils';

interface LayoutProps {
  block: ContentBlock;
  className?: string;
  editable?: boolean;
  onUpdate?: (updates: Partial<ContentBlock>) => void;
}

// Helper function to parse markdown-like text
const parseSimpleMarkdown = (text: string) => {
  if (!text) return text;
  
  // Simple markdown parsing for bold and italic
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br />');
};

// Helper function to get padding class
const getPaddingClass = (padding?: string) => {
  switch (padding) {
    case 'none': return 'p-0';
    case 'small': return 'p-4';
    case 'medium': return 'p-6';
    case 'large': return 'p-8';
    default: return 'p-6';
  }
};

// Layout 1: Image Left
export const Layout1: React.FC<LayoutProps> = ({ block, className, editable, onUpdate }) => {
  return (
    <div className={cn('flex flex-col md:flex-row gap-4 items-center', className)}>
      <div className="md:w-1/2">
        {block.imageUrl ? (
          <img
            src={block.imageUrl}
            alt={block.altText || block.title || 'Image'}
            className="w-full h-48 object-cover rounded-lg"
          />
        ) : (
          <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-muted-foreground/25">
            <span className="text-muted-foreground">Select an image</span>
          </div>
        )}
      </div>
      <div className="md:w-1/2 space-y-2">
        {(block.title || block.headline) && (
          <h3 className="text-lg font-semibold">{block.title || block.headline}</h3>
        )}
        {(block.content || block.body) && (
          <div 
            className="text-muted-foreground"
            dangerouslySetInnerHTML={{ 
              __html: parseSimpleMarkdown(block.content || block.body || '') 
            }}
          />
        )}
        {(block.ctaText || block.buttonText) && (
          <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors">
            {block.ctaText || block.buttonText}
          </button>
        )}
      </div>
    </div>
  );
};

// Layout 2: Image Right
export const Layout2: React.FC<LayoutProps> = ({ block, className, editable, onUpdate }) => {
  return (
    <div className={cn('flex flex-col md:flex-row-reverse gap-4 items-center', className)}>
      <div className="md:w-1/2">
        {block.imageUrl ? (
          <img
            src={block.imageUrl}
            alt={block.altText || block.title || 'Image'}
            className="w-full h-48 object-cover rounded-lg"
          />
        ) : (
          <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-muted-foreground/25">
            <span className="text-muted-foreground">Select an image</span>
          </div>
        )}
      </div>
      <div className="md:w-1/2 space-y-2">
        {(block.title || block.headline) && (
          <h3 className="text-lg font-semibold">{block.title || block.headline}</h3>
        )}
        {(block.content || block.body) && (
          <div 
            className="text-muted-foreground"
            dangerouslySetInnerHTML={{ 
              __html: parseSimpleMarkdown(block.content || block.body || '') 
            }}
          />
        )}
        {(block.ctaText || block.buttonText) && (
          <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors">
            {block.ctaText || block.buttonText}
          </button>
        )}
      </div>
    </div>
  );
};

// Layout 3: Image Vertical Left
export const Layout3: React.FC<LayoutProps> = ({ block, className, editable, onUpdate }) => {
  return (
    <div className={cn('flex flex-col md:flex-row gap-4', className)}>
      <div className="md:w-1/3">
        {block.imageUrl ? (
          <img
            src={block.imageUrl}
            alt={block.altText || block.title || 'Image'}
            className="w-full h-64 object-cover rounded-lg"
          />
        ) : (
          <div className="w-full h-64 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-muted-foreground/25">
            <span className="text-muted-foreground">Select an image</span>
          </div>
        )}
      </div>
      <div className="md:w-2/3 space-y-2">
        {(block.title || block.headline) && (
          <h3 className="text-xl font-semibold">{block.title || block.headline}</h3>
        )}
        {(block.content || block.body) && (
          <div 
            className="text-muted-foreground leading-relaxed"
            dangerouslySetInnerHTML={{ 
              __html: parseSimpleMarkdown(block.content || block.body || '') 
            }}
          />
        )}
        {(block.ctaText || block.buttonText) && (
          <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors">
            {block.ctaText || block.buttonText}
          </button>
        )}
      </div>
    </div>
  );
};

// Layout 4: Image Vertical Right
export const Layout4: React.FC<LayoutProps> = ({ block, className, editable, onUpdate }) => {
  return (
    <div className={cn('flex flex-col md:flex-row-reverse gap-4', className)}>
      <div className="md:w-1/3">
        {block.imageUrl ? (
          <img
            src={block.imageUrl}
            alt={block.altText || block.title || 'Image'}
            className="w-full h-64 object-cover rounded-lg"
          />
        ) : (
          <div className="w-full h-64 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-muted-foreground/25">
            <span className="text-muted-foreground">Select an image</span>
          </div>
        )}
      </div>
      <div className="md:w-2/3 space-y-2">
        {(block.title || block.headline) && (
          <h3 className="text-xl font-semibold">{block.title || block.headline}</h3>
        )}
        {(block.content || block.body) && (
          <div 
            className="text-muted-foreground leading-relaxed"
            dangerouslySetInnerHTML={{ 
              __html: parseSimpleMarkdown(block.content || block.body || '') 
            }}
          />
        )}
        {(block.ctaText || block.buttonText) && (
          <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors">
            {block.ctaText || block.buttonText}
          </button>
        )}
      </div>
    </div>
  );
};

// Layout 6: Single Column (Enhanced for Headers, Images, and Buttons)
export const Layout6: React.FC<LayoutProps> = ({ block, className, editable, onUpdate }) => {
  const paddingClass = getPaddingClass(block.padding);
  
  // Header Block Layout
  if (block.type === 'header') {
    return (
      <div 
        className={cn('relative min-h-[120px] flex items-center justify-center text-white', className)}
        style={{
          backgroundImage: block.backgroundImageUrl ? `url(${block.backgroundImageUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {block.backgroundImageUrl && (
          <div 
            className="absolute inset-0 bg-black rounded-lg"
            style={{ opacity: block.backgroundOpacity || 0.4 }}
          />
        )}
        <div 
          className={cn(
            'relative z-10 w-full max-w-4xl mx-auto',
            paddingClass,
            `text-${block.alignment || 'center'}`
          )}
          style={{ 
            backgroundColor: block.backgroundImageUrl ? 'transparent' : (block.backgroundColor || 'transparent'),
            color: block.textColor || (block.backgroundImageUrl ? 'white' : 'inherit')
          }}
        >
          {block.headline && (
            <h1 className="text-2xl md:text-3xl font-bold mb-3">
              {block.headline}
            </h1>
          )}
          {block.body && (
            <div 
              className="text-sm md:text-base opacity-90 leading-relaxed max-w-2xl mx-auto"
              dangerouslySetInnerHTML={{ __html: parseSimpleMarkdown(block.body) }}
            />
          )}
        </div>
      </div>
    );
  }
  
  // Image Block Layout
  if (block.type === 'image') {
    return (
      <div className={cn('space-y-3', paddingClass, `text-${block.alignment || 'center'}`, className)}>
        {block.imageUrl ? (
          <img
            src={block.imageUrl}
            alt={block.altText || 'Image'}
            className="max-w-full h-auto rounded-lg mx-auto"
          />
        ) : (
          <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-muted-foreground/25">
            <span className="text-muted-foreground">Select an image</span>
          </div>
        )}
        {block.caption && (
          <p className="text-sm text-muted-foreground italic">
            {block.caption}
          </p>
        )}
      </div>
    );
  }
  
  // Button Block Layout
  if (block.type === 'button') {
    return (
      <div className={cn('space-y-4', paddingClass, `text-${block.alignment || 'center'}`, className)}>
        {block.heading && (
          <h3 className="text-lg font-semibold">{block.heading}</h3>
        )}
        {block.body && (
          <div 
            className="text-muted-foreground leading-relaxed"
            dangerouslySetInnerHTML={{ __html: parseSimpleMarkdown(block.body) }}
          />
        )}
        {block.buttonText && (
          <div>
            <button className="bg-primary text-primary-foreground px-6 py-3 rounded-md hover:bg-primary/90 transition-colors font-medium">
              {block.buttonText}
            </button>
          </div>
        )}
      </div>
    );
  }
  
  // Default layout for other block types
  return (
    <div className={cn('space-y-4', paddingClass, className)}>
      {(block.title || block.headline) && (
        <h3 className="text-xl font-semibold text-center">{block.title || block.headline}</h3>
      )}
      {(block.content || block.body) && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <div 
              className="text-muted-foreground leading-relaxed"
              dangerouslySetInnerHTML={{ 
                __html: parseSimpleMarkdown((block.content || block.body || '').split('\n')[0] || (block.content || block.body || ''))
              }}
            />
          </div>
          <div className="space-y-2">
            <div 
              className="text-muted-foreground leading-relaxed"
              dangerouslySetInnerHTML={{ 
                __html: parseSimpleMarkdown((block.content || block.body || '').split('\n')[1] || (block.content || block.body || ''))
              }}
            />
          </div>
        </div>
      )}
      {(block.ctaText || block.buttonText) && (
        <div className="text-center">
          <button className="bg-primary text-primary-foreground px-6 py-2 rounded-md hover:bg-primary/90 transition-colors">
            {block.ctaText || block.buttonText}
          </button>
        </div>
      )}
    </div>
  );
};

// Layout 7: Text Triple Column
export const Layout7: React.FC<LayoutProps> = ({ block, className, editable, onUpdate }) => {
  return (
    <div className={cn('space-y-4', className)}>
      {(block.title || block.headline) && (
        <h3 className="text-xl font-semibold text-center">{block.title || block.headline}</h3>
      )}
      {(block.content || block.body) && (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div 
              className="text-muted-foreground leading-relaxed"
              dangerouslySetInnerHTML={{ 
                __html: parseSimpleMarkdown((block.content || block.body || '').split('\n')[0] || (block.content || block.body || ''))
              }}
            />
          </div>
          <div className="space-y-2">
            <div 
              className="text-muted-foreground leading-relaxed"
              dangerouslySetInnerHTML={{ 
                __html: parseSimpleMarkdown((block.content || block.body || '').split('\n')[1] || (block.content || block.body || ''))
              }}
            />
          </div>
          <div className="space-y-2">
            <div 
              className="text-muted-foreground leading-relaxed"
              dangerouslySetInnerHTML={{ 
                __html: parseSimpleMarkdown((block.content || block.body || '').split('\n')[2] || (block.content || block.body || ''))
              }}
            />
          </div>
        </div>
      )}
      {(block.ctaText || block.buttonText) && (
        <div className="text-center">
          <button className="bg-primary text-primary-foreground px-6 py-2 rounded-md hover:bg-primary/90 transition-colors">
            {block.ctaText || block.buttonText}
          </button>
        </div>
      )}
    </div>
  );
};
