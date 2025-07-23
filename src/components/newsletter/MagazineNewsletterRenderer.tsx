import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, Palette, Target, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NewsletterBlock {
  title: string;
  body: string;
  cta: string;
  link: string;
  image_prompt: string;
  alt_text: string;
}

interface NewsletterMeta {
  reading_time: string;
  theme: string;
  week_focus: string;
}

interface MagazineNewsletterRendererProps {
  title?: string;
  blocks: NewsletterBlock[];
  meta: NewsletterMeta;
  featuredImage?: {
    url: string;
    alt: string;
    photographer?: string;
  };
  blockImages?: { [index: number]: { url: string; alt: string; photographer?: string } };
  className?: string;
  onImageSelect?: (blockIndex: number, prompt: string) => void;
}

export const MagazineNewsletterRenderer = ({
  title,
  blocks,
  meta,
  featuredImage,
  blockImages = {},
  className = '',
  onImageSelect
}: MagazineNewsletterRendererProps) => {
  const renderNewsletterHeader = () => (
    <div className="mb-12">
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
      
      <div className="text-center space-y-6">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent leading-tight">
          {title || meta.week_focus}
        </h1>
        
        <div className="flex flex-wrap justify-center gap-3">
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
            Magazine Format
          </Badge>
        </div>
      </div>
    </div>
  );

  const renderNewsletterBlock = (block: NewsletterBlock, index: number) => {
    const blockImage = blockImages[index];
    
    return (
      <div key={index} className="mb-16 last:mb-0">
        <div className="grid lg:grid-cols-12 gap-8 items-start">
          {/* Content Column */}
          <div className="lg:col-span-7 space-y-6">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-4 leading-tight">
                {block.title}
              </h2>
              <div className="prose prose-lg max-w-none">
                <p className="text-muted-foreground leading-relaxed text-lg">
                  {block.body}
                </p>
              </div>
            </div>
            
            {block.cta && block.cta !== 'Learn more' && (
              <div className="pt-4">
                <Button 
                  size="lg"
                  className="group"
                  onClick={() => window.open(block.link, '_blank')}
                >
                  {block.cta}
                  <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            )}
          </div>
          
          {/* Image Column */}
          <div className="lg:col-span-5">
            <div className="aspect-[4/3] rounded-lg overflow-hidden bg-muted/50 border border-border">
              {blockImage ? (
                <>
                  <img 
                    src={blockImage.url} 
                    alt={blockImage.alt}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                  {blockImage.photographer && (
                    <p className="text-xs text-muted-foreground mt-2 px-2">
                      Photo by {blockImage.photographer}
                    </p>
                  )}
                </>
              ) : (
                <div 
                  className="w-full h-full flex items-center justify-center cursor-pointer hover:bg-muted/70 transition-colors"
                  onClick={() => onImageSelect?.(index, block.image_prompt)}
                >
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                      <Palette className="w-6 h-6 text-primary" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Add Section Image
                    </p>
                    <p className="text-xs text-muted-foreground/70 px-4">
                      Click to select an image for this section
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Section Separator */}
        {index < blocks.length - 1 && (
          <div className="mt-16 border-t border-border/50"></div>
        )}
      </div>
    );
  };

  return (
    <div className={`newsletter-magazine-renderer max-w-6xl mx-auto ${className}`}>
      {/* Newsletter Header */}
      {renderNewsletterHeader()}
      
      {/* Newsletter Content Blocks */}
      <div className="space-y-0">
        {blocks.map((block, index) => renderNewsletterBlock(block, index))}
      </div>
      
      {/* Newsletter Footer */}
      <div className="mt-16 pt-8 border-t border-border/50">
        <div className="text-center space-y-4">
          <div className="flex justify-center gap-4 text-sm text-muted-foreground">
            <span>{blocks.length} sections</span>
            <span>•</span>
            <span>{meta.reading_time} read</span>
            <span>•</span>
            <span>{meta.theme}</span>
          </div>
          <p className="text-xs text-muted-foreground/70">
            Transform your garden with expert insights and proven techniques
          </p>
        </div>
      </div>
    </div>
  );
};