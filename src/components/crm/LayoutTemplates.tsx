
import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { cn } from '@/lib/utils';

interface LayoutProps {
  block: ContentBlock;
  className?: string;
  editable?: boolean;
  onUpdate?: (updates: Partial<ContentBlock>) => void;
}

// Helper function to parse markdown-like text and handle HTML content
const parseSimpleMarkdown = (text: string) => {
  if (!text) return text;
  
  // Check if the text already contains HTML tags (from rich text editor)
  // Look for any HTML tags like <p>, <strong>, <em>, <div>, etc.
  const hasHtmlTags = /<[a-zA-Z][^>]*>/.test(text);
  
  if (hasHtmlTags) {
    // Content is already HTML from rich text editor, return as-is
    return text;
  }
  
  // Fallback: Simple markdown parsing for legacy content
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

// Helper to validate usable image URLs
const isValidImageUrl = (url?: string) => {
  if (!url) return false;
  return /^https?:\/\//i.test(url) || /^data:image\//i.test(url);
};

// Layout 1: Image Left
export const Layout1: React.FC<LayoutProps> = ({ block, className, editable, onUpdate }) => {
  return (
    <div className={cn('flex flex-col md:flex-row gap-4 items-center', className)}>
      <div className="md:w-1/2">
        {(() => { if (block.imageUrl && !isValidImageUrl(block.imageUrl)) { console.warn('[LayoutTemplates] Invalid imageUrl, using placeholder', { id: block.id, title: block.title, imageUrl: block.imageUrl }); } return null; })()}
        {isValidImageUrl(block.imageUrl) ? (
          <img
            src={block.imageUrl as string}
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
        {(block.title || block.headline) ? (
          <h3 className="text-lg font-semibold">{block.title || block.headline}</h3>
        ) : (
          <p className="text-sm text-muted-foreground italic">Click to add heading</p>
        )}
        {(block.content || block.body) ? (
          <div 
            className="text-muted-foreground"
            dangerouslySetInnerHTML={{ 
              __html: parseSimpleMarkdown(block.content || block.body || '') 
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground italic">Click to add content</p>
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
        {(() => { if (block.imageUrl && !isValidImageUrl(block.imageUrl)) { console.warn('[LayoutTemplates] Invalid imageUrl, using placeholder', { id: block.id, title: block.title, imageUrl: block.imageUrl }); } return null; })()}
        {isValidImageUrl(block.imageUrl) ? (
          <img
            src={block.imageUrl as string}
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
        {(block.title || block.headline) ? (
          <h3 className="text-lg font-semibold">{block.title || block.headline}</h3>
        ) : (
          <p className="text-sm text-muted-foreground italic">Click to add heading</p>
        )}
        {(block.content || block.body) ? (
          <div 
            className="text-muted-foreground"
            dangerouslySetInnerHTML={{ 
              __html: parseSimpleMarkdown(block.content || block.body || '') 
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground italic">Click to add content</p>
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
        {(() => { if (block.imageUrl && !isValidImageUrl(block.imageUrl)) { console.warn('[LayoutTemplates] Invalid imageUrl, using placeholder', { id: block.id, title: block.title, imageUrl: block.imageUrl }); } return null; })()}
        {isValidImageUrl(block.imageUrl) ? (
          <img
            src={block.imageUrl as string}
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
        {(block.title || block.headline) ? (
          <h3 className="text-xl font-semibold">{block.title || block.headline}</h3>
        ) : (
          <p className="text-sm text-muted-foreground italic">Click to add heading</p>
        )}
        {(block.content || block.body) ? (
          <div 
            className="text-muted-foreground leading-relaxed"
            dangerouslySetInnerHTML={{ 
              __html: parseSimpleMarkdown(block.content || block.body || '') 
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground italic">Click to add content</p>
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
        {(() => { if (block.imageUrl && !isValidImageUrl(block.imageUrl)) { console.warn('[LayoutTemplates] Invalid imageUrl, using placeholder', { id: block.id, title: block.title, imageUrl: block.imageUrl }); } return null; })()}
        {isValidImageUrl(block.imageUrl) ? (
          <img
            src={block.imageUrl as string}
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
        {(block.title || block.headline) ? (
          <h3 className="text-xl font-semibold">{block.title || block.headline}</h3>
        ) : (
          <p className="text-sm text-muted-foreground italic">Click to add heading</p>
        )}
        {(block.content || block.body) ? (
          <div 
            className="text-muted-foreground leading-relaxed"
            dangerouslySetInnerHTML={{ 
              __html: parseSimpleMarkdown(block.content || block.body || '') 
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground italic">Click to add content</p>
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
  if (block.type === 'header' || block.type === 'newsletter-header') {
    return (
      <div 
        className={cn('relative min-h-[120px] flex items-center justify-center', className)}
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
        {/* Custom Image Overlay - Newsletter Header Only */}
        {block.overlayOpacity && block.overlayOpacity > 0 && (
          <div
            className="absolute inset-0 rounded-lg pointer-events-none"
            style={{
              backgroundColor: block.overlayColor || '#000000',
              opacity: block.overlayOpacity / 100
            }}
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
            color: block.textColor || (block.backgroundImageUrl ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))')
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
        {(() => { if (block.imageUrl && !isValidImageUrl(block.imageUrl)) { console.warn('[LayoutTemplates] Invalid imageUrl, using placeholder', { id: block.id, title: block.title, imageUrl: block.imageUrl }); } return null; })()}
        {isValidImageUrl(block.imageUrl) ? (
          <img
            src={block.imageUrl as string}
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
        {block.heading ? (
          <h3 className="text-lg font-semibold">{block.heading}</h3>
        ) : (
          <p className="text-sm text-muted-foreground italic">Click to add heading</p>
        )}
        {block.body ? (
          <div 
            className="text-muted-foreground leading-relaxed"
            dangerouslySetInnerHTML={{ __html: parseSimpleMarkdown(block.body) }}
          />
        ) : (
          <p className="text-sm text-muted-foreground italic">Click to add description</p>
        )}
        {block.buttonText && (
          <div className="flex justify-center">
            <button className="bg-primary text-primary-foreground px-4 py-3 sm:px-6 rounded-md hover:bg-primary/90 transition-colors font-medium text-center max-w-[85%] sm:max-w-none">
              {block.buttonText}
            </button>
          </div>
        )}
      </div>
    );
  }
  
  // Text block with image - Card style layout (Image -> Headline -> Content)
  if (block.type === 'text' && isValidImageUrl(block.imageUrl)) {
    return (
      <div className={cn('space-y-4', paddingClass, className)}>
        {/* Image at top */}
        <img
          src={block.imageUrl as string}
          alt={block.altText || block.title || 'Image'}
          className="w-full h-auto rounded-lg object-cover"
        />
        {/* Headline */}
        {(block.title || block.headline) ? (
          <h3 className="text-xl font-semibold">{block.title || block.headline}</h3>
        ) : (
          <p className="text-sm text-muted-foreground italic">Click to add heading</p>
        )}
        {/* Content */}
        {(block.content || block.body) ? (
          <div 
            className="text-muted-foreground leading-relaxed"
            dangerouslySetInnerHTML={{ 
              __html: parseSimpleMarkdown(block.content || block.body || '')
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground italic">Click to add content</p>
        )}
        {/* CTA Button */}
        {(block.ctaText || block.buttonText) && (
          <div>
            <button className="bg-primary text-primary-foreground px-6 py-2 rounded-md hover:bg-primary/90 transition-colors">
              {block.ctaText || block.buttonText}
            </button>
          </div>
        )}
      </div>
    );
  }
  
  // Default layout for other block types (text without image)
  return (
    <div className={cn('space-y-4', paddingClass, className)}>
      {(block.title || block.headline) ? (
        <h3 className="text-xl font-semibold">{block.title || block.headline}</h3>
      ) : (
        <p className="text-sm text-muted-foreground italic">Click to add heading</p>
      )}
      {(block.content || block.body) ? (
        <div 
          className="text-muted-foreground leading-relaxed"
          dangerouslySetInnerHTML={{ 
            __html: parseSimpleMarkdown(block.content || block.body || '')
          }}
        />
      ) : (
        <p className="text-sm text-muted-foreground italic">Click to add content</p>
      )}
      {(block.ctaText || block.buttonText) && (
        <div>
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

// Layout: Email Safe Hero - text on solid background, image below
export const EmailSafeHeroLayout: React.FC<LayoutProps> = ({ block, className }) => {
  const alignment = block.alignment || 'center';
  const backgroundColor = block.backgroundColor || '#ffffff';
  const textColor = block.textColor || '#000000';
  
  return (
    <div className={cn('overflow-hidden rounded-lg', className)}>
      {/* Text Section - Solid Background */}
      <div 
        className="p-8"
        style={{
          backgroundColor,
          textAlign: alignment as any,
        }}
      >
        {block.eyebrow && (
          <p className="text-xs uppercase tracking-wider mb-2 opacity-60" style={{ color: textColor }}>
            {block.eyebrow}
          </p>
        )}
        {(block.headline || block.title) && (
          <h1 className="text-2xl md:text-3xl font-semibold mb-2" style={{ color: textColor }}>
            {block.headline || block.title}
          </h1>
        )}
        {block.subtitle && (
          <p className="text-sm md:text-base opacity-80 mb-2" style={{ color: textColor }}>
            {block.subtitle}
          </p>
        )}
        {block.publishDate && (
          <p className="text-xs opacity-60 mb-4" style={{ color: textColor }}>
            {new Date(block.publishDate).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        )}
        {block.ctaText && block.ctaUrl && (
          <div className="mt-4">
            <a 
              href={block.ctaUrl}
              className="inline-block px-5 py-2 rounded-full text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              {block.ctaText}
            </a>
          </div>
        )}
      </div>
      
      {/* Image Section - Below Text */}
      {block.imageUrl && (
        <div className="bg-transparent px-4 pb-4">
          <div className="max-w-[640px] mx-auto">
            <img
              src={block.imageUrl}
              alt={block.altText || block.headline || ''}
              className="w-full rounded-lg"
              style={{ display: 'block' }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Layout: Graphic Hero - single clickable image
export const GraphicHeroLayout: React.FC<LayoutProps> = ({ block, className }) => {
  const ImageElement = (
    <img
      src={block.imageUrl || ''}
      alt={block.altText || 'Graphic Hero'}
      className="w-full max-w-[640px] mx-auto block"
      style={{ display: 'block', border: 0, outline: 'none' }}
    />
  );

  return (
    <div className={cn('text-center', className)}>
      {block.ctaUrl ? (
        <a href={block.ctaUrl} className="block cursor-pointer">
          {ImageElement}
        </a>
      ) : (
        ImageElement
      )}
    </div>
  );
};
