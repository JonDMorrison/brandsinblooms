
import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { cn } from '@/lib/utils';

interface LayoutProps {
  block: ContentBlock;
  className?: string;
  editable?: boolean;
  onUpdate?: (updates: Partial<ContentBlock>) => void;
}

// Layout 1: Image Left
export const Layout1: React.FC<LayoutProps> = ({ block, className, editable, onUpdate }) => {
  return (
    <div className={cn('flex flex-col md:flex-row gap-4 items-center', className)}>
      <div className="md:w-1/2">
        {block.imageUrl ? (
          <img
            src={block.imageUrl}
            alt={block.title || 'Image'}
            className="w-full h-48 object-cover rounded-lg"
          />
        ) : (
          <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-muted-foreground/25">
            <span className="text-muted-foreground">Image placeholder</span>
          </div>
        )}
      </div>
      <div className="md:w-1/2 space-y-2">
        {block.title && (
          <h3 className="text-lg font-semibold">{block.title}</h3>
        )}
        {block.content && (
          <p className="text-muted-foreground">{block.content}</p>
        )}
        {block.ctaText && (
          <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors">
            {block.ctaText}
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
            alt={block.title || 'Image'}
            className="w-full h-48 object-cover rounded-lg"
          />
        ) : (
          <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-muted-foreground/25">
            <span className="text-muted-foreground">Image placeholder</span>
          </div>
        )}
      </div>
      <div className="md:w-1/2 space-y-2">
        {block.title && (
          <h3 className="text-lg font-semibold">{block.title}</h3>
        )}
        {block.content && (
          <p className="text-muted-foreground">{block.content}</p>
        )}
        {block.ctaText && (
          <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors">
            {block.ctaText}
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
            alt={block.title || 'Image'}
            className="w-full h-64 object-cover rounded-lg"
          />
        ) : (
          <div className="w-full h-64 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-muted-foreground/25">
            <span className="text-muted-foreground">Image placeholder</span>
          </div>
        )}
      </div>
      <div className="md:w-2/3 space-y-2">
        {block.title && (
          <h3 className="text-xl font-semibold">{block.title}</h3>
        )}
        {block.content && (
          <p className="text-muted-foreground leading-relaxed">{block.content}</p>
        )}
        {block.ctaText && (
          <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors">
            {block.ctaText}
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
            alt={block.title || 'Image'}
            className="w-full h-64 object-cover rounded-lg"
          />
        ) : (
          <div className="w-full h-64 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed border-muted-foreground/25">
            <span className="text-muted-foreground">Image placeholder</span>
          </div>
        )}
      </div>
      <div className="md:w-2/3 space-y-2">
        {block.title && (
          <h3 className="text-xl font-semibold">{block.title}</h3>
        )}
        {block.content && (
          <p className="text-muted-foreground leading-relaxed">{block.content}</p>
        )}
        {block.ctaText && (
          <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors">
            {block.ctaText}
          </button>
        )}
      </div>
    </div>
  );
};

// Layout 6: Text Double Column
export const Layout6: React.FC<LayoutProps> = ({ block, className, editable, onUpdate }) => {
  return (
    <div className={cn('space-y-4', className)}>
      {block.title && (
        <h3 className="text-xl font-semibold text-center">{block.title}</h3>
      )}
      {block.content && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <p className="text-muted-foreground leading-relaxed">
              {block.content.split('\n')[0] || block.content}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-muted-foreground leading-relaxed">
              {block.content.split('\n')[1] || block.content}
            </p>
          </div>
        </div>
      )}
      {block.ctaText && (
        <div className="text-center">
          <button className="bg-primary text-primary-foreground px-6 py-2 rounded-md hover:bg-primary/90 transition-colors">
            {block.ctaText}
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
      {block.title && (
        <h3 className="text-xl font-semibold text-center">{block.title}</h3>
      )}
      {block.content && (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <p className="text-muted-foreground leading-relaxed">
              {block.content.split('\n')[0] || block.content}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-muted-foreground leading-relaxed">
              {block.content.split('\n')[1] || block.content}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-muted-foreground leading-relaxed">
              {block.content.split('\n')[2] || block.content}
            </p>
          </div>
        </div>
      )}
      {block.ctaText && (
        <div className="text-center">
          <button className="bg-primary text-primary-foreground px-6 py-2 rounded-md hover:bg-primary/90 transition-colors">
            {block.ctaText}
          </button>
        </div>
      )}
    </div>
  );
};
