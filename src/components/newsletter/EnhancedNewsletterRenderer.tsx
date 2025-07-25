import React from 'react';
import { ContentBlock, NewsletterTheme } from '@/types/emailBuilder';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Palette, Target, Quote as QuoteIcon, ExternalLink } from 'lucide-react';

interface EnhancedNewsletterRendererProps {
  title?: string;
  blocks: ContentBlock[];
  theme?: NewsletterTheme;
  featuredImage?: {
    url: string;
    alt: string;
    photographer?: string;
  };
  meta?: {
    reading_time: string;
    theme: string;
    week_focus: string;
  };
  className?: string;
}

export const EnhancedNewsletterRenderer: React.FC<EnhancedNewsletterRendererProps> = ({
  title,
  blocks,
  theme,
  featuredImage,
  meta,
  className = ''
}) => {
  const renderBlock = (block: ContentBlock, index: number) => {
    const blockClasses = `
      ${getPaddingClass(block.padding)}
      ${getAlignmentClass(block.alignment)}
      ${getAnimationClass(block.animation)}
    `.trim();

    switch (block.type) {
      case 'newsletter-header':
        return (
          <div key={block.id} className={`relative mb-12 ${blockClasses}`}>
            {block.backgroundImageUrl && (
              <div 
                className="absolute inset-0 bg-cover bg-center opacity-20 rounded-xl"
                style={{ backgroundImage: `url(${block.backgroundImageUrl})` }}
              />
            )}
            <div className="relative text-center space-y-4">
              <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent leading-tight">
                {block.title || title}
              </h1>
              {block.subtitle && (
                <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                  {block.subtitle}
                </p>
              )}
              <div className="flex justify-center gap-4 text-sm text-muted-foreground">
                {block.issueNumber && (
                  <span>Issue #{block.issueNumber}</span>
                )}
                {block.publishDate && (
                  <span>{new Date(block.publishDate).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          </div>
        );

      case 'text':
        return (
          <div key={block.id} className={`mb-8 ${blockClasses}`}>
            {renderTextBlock(block)}
          </div>
        );

      case 'quote':
        return (
          <div key={block.id} className={`mb-8 ${blockClasses}`}>
            <div className="border-l-4 border-primary bg-primary/5 p-6 rounded-r-lg">
              <div className="flex items-start gap-4">
                <QuoteIcon className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                <div className="space-y-3">
                  <blockquote className="text-lg italic text-foreground leading-relaxed">
                    "{block.quote}"
                  </blockquote>
                  {(block.author || block.authorTitle) && (
                    <div className="text-sm text-muted-foreground">
                      — {block.author}
                      {block.authorTitle && `, ${block.authorTitle}`}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case 'cta':
        return (
          <div key={block.id} className={`mb-8 ${blockClasses}`}>
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-8 rounded-xl text-center space-y-4">
              {block.heading && (
                <h3 className="text-2xl font-bold text-foreground">
                  {block.heading}
                </h3>
              )}
              {block.body && (
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  {block.body}
                </p>
              )}
              {block.ctaText && (
                <div>
                  <Button 
                    variant={getButtonVariant(block.ctaStyle)}
                    size={getButtonSize(block.ctaSize)}
                    className="group"
                    onClick={() => window.open(block.ctaUrl, '_blank')}
                  >
                    {block.ctaText}
                    <ExternalLink className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        );

      case 'image':
        return (
          <div key={block.id} className={`mb-8 ${blockClasses}`}>
            <div className={`${getImageSizeClass(block.imageSize)} mx-auto`}>
              <img 
                src={block.imageUrl} 
                alt={block.altText || 'Newsletter image'}
                className={`w-full h-auto object-cover ${getImageStyleClasses(block)}`}
              />
              {block.caption && (
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  {block.caption}
                </p>
              )}
            </div>
          </div>
        );

      default:
        return renderTextBlock(block, index);
    }
  };

  const renderTextBlock = (block: ContentBlock, index?: number) => {
    const hasImage = block.imageUrl && ['two-column-left', 'two-column-right', 'image-60-40', 'image-70-30'].includes(block.layout || '');
    
    if (hasImage) {
      const isImageLeft = block.layout === 'two-column-left';
      const contentWidth = getContentWidth(block.layout);
      const imageWidth = getImageWidth(block.layout);
      
      return (
        <div className={`grid gap-8 items-start ${block.responsiveBehavior === 'reverse' ? 'lg:flex-row-reverse' : ''}`} 
             style={{ gridTemplateColumns: isImageLeft ? `${imageWidth} ${contentWidth}` : `${contentWidth} ${imageWidth}` }}>
          {/* Content */}
          <div className="space-y-4">
            {block.title && (
              <h2 className="text-3xl font-bold text-foreground leading-tight">
                {block.title}
              </h2>
            )}
            {block.content && (
              <div className="prose prose-lg max-w-none">
                <p className="text-muted-foreground leading-relaxed">
                  {block.content}
                </p>
              </div>
            )}
            {block.ctaText && (
              <div className="pt-2">
                <Button 
                  size="lg"
                  className="group"
                  onClick={() => window.open(block.ctaUrl, '_blank')}
                >
                  {block.ctaText}
                  <ExternalLink className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            )}
          </div>
          
          {/* Image */}
          <div className="aspect-[4/3] rounded-lg overflow-hidden">
            <img 
              src={block.imageUrl} 
              alt={block.altText || 'Section image'}
              className={`w-full h-full object-cover ${getImageStyleClasses(block)}`}
            />
          </div>
        </div>
      );
    }

    // Single column text
    return (
      <div className="space-y-4">
        {block.title && (
          <h2 className="text-3xl font-bold text-foreground leading-tight">
            {block.title}
          </h2>
        )}
        {block.content && (
          <div className="prose prose-lg max-w-none">
            <p className="text-muted-foreground leading-relaxed text-lg">
              {block.content}
            </p>
          </div>
        )}
        {block.ctaText && (
          <div className="pt-4">
            <Button 
              size="lg"
              className="group"
              onClick={() => window.open(block.ctaUrl, '_blank')}
            >
              {block.ctaText}
              <ExternalLink className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        )}
      </div>
    );
  };

  // Helper functions
  const getPaddingClass = (padding?: string) => {
    switch (padding) {
      case 'none': return 'p-0';
      case 'small': return 'p-2';
      case 'large': return 'p-8';
      case 'extra-large': return 'p-12';
      default: return 'p-4';
    }
  };

  const getAlignmentClass = (alignment?: string) => {
    switch (alignment) {
      case 'center': return 'text-center';
      case 'right': return 'text-right';
      case 'justify': return 'text-justify';
      default: return 'text-left';
    }
  };

  const getAnimationClass = (animation?: string) => {
    switch (animation) {
      case 'fade-in': return 'animate-in fade-in duration-500';
      case 'slide-up': return 'animate-in slide-in-from-bottom-4 duration-500';
      case 'scale-in': return 'animate-in zoom-in-50 duration-500';
      default: return '';
    }
  };

  const getButtonVariant = (style?: string) => {
    switch (style) {
      case 'secondary': return 'secondary';
      case 'outline': return 'outline';
      case 'ghost': return 'ghost';
      default: return 'default';
    }
  };

  const getButtonSize = (size?: string) => {
    switch (size) {
      case 'small': return 'sm';
      case 'large': return 'lg';
      default: return 'default';
    }
  };

  const getImageSizeClass = (size?: string) => {
    switch (size) {
      case 'small': return 'max-w-md';
      case 'large': return 'max-w-4xl';
      case 'full-width': return 'max-w-full';
      default: return 'max-w-2xl';
    }
  };

  const getImageStyleClasses = (block: ContentBlock) => {
    let classes = '';
    if (block.imageRounded) classes += ' rounded-lg';
    if (block.imageShadow) classes += ' shadow-lg';
    if (block.imageBorder) classes += ' border border-border';
    return classes;
  };

  const getContentWidth = (layout?: string) => {
    switch (layout) {
      case 'image-60-40': return '3fr';
      case 'image-70-30': return '7fr';
      default: return '1fr';
    }
  };

  const getImageWidth = (layout?: string) => {
    switch (layout) {
      case 'image-60-40': return '2fr';
      case 'image-70-30': return '3fr';
      default: return '1fr';
    }
  };

  return (
    <div className={`enhanced-newsletter-renderer max-w-4xl mx-auto ${className}`}>
      {/* Featured Image */}
      {featuredImage && (
        <div className="mb-8">
          <div className="aspect-[21/9] rounded-xl overflow-hidden bg-gradient-to-r from-primary/5 to-primary/10">
            <img 
              src={featuredImage.url} 
              alt={featuredImage.alt}
              className="w-full h-full object-cover"
            />
          </div>
          {featuredImage.photographer && (
            <p className="text-xs text-muted-foreground mt-2">
              Photo by {featuredImage.photographer}
            </p>
          )}
        </div>
      )}

      {/* Meta badges */}
      {meta && (
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          <Badge variant="secondary" className="flex items-center gap-2 px-4 py-2">
            <Clock className="w-4 h-4" />
            {meta.reading_time}
          </Badge>
          <Badge variant="outline" className="flex items-center gap-2 px-4 py-2">
            <Palette className="w-4 h-4" />
            {meta.theme}
          </Badge>
          <Badge variant="outline" className="flex items-center gap-2 px-4 py-2">
            <Target className="w-4 h-4" />
            Enhanced Format
          </Badge>
        </div>
      )}

      {/* Newsletter Content */}
      <div className="space-y-0">
        {blocks.map((block, index) => renderBlock(block, index))}
      </div>

      {/* Newsletter Footer */}
      <div className="mt-16 pt-8 border-t border-border/50">
        <div className="text-center space-y-4">
          <div className="flex justify-center gap-4 text-sm text-muted-foreground">
            <span>{blocks.length} sections</span>
            {meta && (
              <>
                <span>•</span>
                <span>{meta.reading_time} read</span>
                <span>•</span>
                <span>{meta.theme}</span>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground/70">
            Transform your garden with expert insights and proven techniques
          </p>
        </div>
      </div>
    </div>
  );
};