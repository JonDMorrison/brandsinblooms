
import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';

interface LayoutTemplateProps {
  block: ContentBlock;
  className?: string;
}

export const Layout1: React.FC<LayoutTemplateProps> = ({ block, className = '' }) => (
  <div className={`layout-1 flex items-start gap-6 ${className}`}>
    <div className="w-1/2">
      {block.imageUrl ? (
        <img 
          src={block.imageUrl} 
          alt={block.title || 'Image'} 
          className="w-full h-48 object-cover rounded-lg"
        />
      ) : (
        <div className="w-full bg-gray-100 h-48 flex justify-center items-center text-gray-500 rounded-lg border-2 border-dashed border-gray-300">
          Image
        </div>
      )}
    </div>
    <div className="w-1/2">
      {block.title && (
        <h3 className="text-lg font-semibold mb-2 text-gray-800">{block.title}</h3>
      )}
      {block.content && (
        <p className="text-gray-600 mb-4 leading-relaxed">{block.content}</p>
      )}
      {block.ctaText && block.ctaUrl && (
        <a 
          href={block.ctaUrl}
          className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
        >
          {block.ctaText}
        </a>
      )}
    </div>
  </div>
);

export const Layout2: React.FC<LayoutTemplateProps> = ({ block, className = '' }) => (
  <div className={`layout-2 flex items-start gap-6 ${className}`}>
    <div className="w-1/2">
      {block.title && (
        <h3 className="text-lg font-semibold mb-2 text-gray-800">{block.title}</h3>
      )}
      {block.content && (
        <p className="text-gray-600 mb-4 leading-relaxed">{block.content}</p>
      )}
      {block.ctaText && block.ctaUrl && (
        <a 
          href={block.ctaUrl}
          className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
        >
          {block.ctaText}
        </a>
      )}
    </div>
    <div className="w-1/2">
      {block.imageUrl ? (
        <img 
          src={block.imageUrl} 
          alt={block.title || 'Image'} 
          className="w-full h-48 object-cover rounded-lg"
        />
      ) : (
        <div className="w-full bg-gray-100 h-48 flex justify-center items-center text-gray-500 rounded-lg border-2 border-dashed border-gray-300">
          Image
        </div>
      )}
    </div>
  </div>
);

export const Layout3: React.FC<LayoutTemplateProps> = ({ block, className = '' }) => (
  <div className={`layout-3 flex gap-6 items-start ${className}`}>
    <div className="w-1/4">
      {block.imageUrl ? (
        <img 
          src={block.imageUrl} 
          alt={block.title || 'Image'} 
          className="w-full h-48 object-cover rounded-lg"
        />
      ) : (
        <div className="w-full bg-gray-100 h-48 flex justify-center items-center text-gray-500 rounded-lg border-2 border-dashed border-gray-300">
          Image
        </div>
      )}
    </div>
    <div className="w-3/4">
      {block.title && (
        <h3 className="text-lg font-semibold mb-2 text-gray-800">{block.title}</h3>
      )}
      {block.content && (
        <p className="text-gray-600 mb-4 leading-relaxed">{block.content}</p>
      )}
      {block.ctaText && block.ctaUrl && (
        <a 
          href={block.ctaUrl}
          className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
        >
          {block.ctaText}
        </a>
      )}
    </div>
  </div>
);

export const Layout4: React.FC<LayoutTemplateProps> = ({ block, className = '' }) => (
  <div className={`layout-4 flex gap-6 items-start ${className}`}>
    <div className="w-3/4">
      {block.title && (
        <h3 className="text-lg font-semibold mb-2 text-gray-800">{block.title}</h3>
      )}
      {block.content && (
        <p className="text-gray-600 mb-4 leading-relaxed">{block.content}</p>
      )}
      {block.ctaText && block.ctaUrl && (
        <a 
          href={block.ctaUrl}
          className="inline-block bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
        >
          {block.ctaText}
        </a>
      )}
    </div>
    <div className="w-1/4">
      {block.imageUrl ? (
        <img 
          src={block.imageUrl} 
          alt={block.title || 'Image'} 
          className="w-full h-48 object-cover rounded-lg"
        />
      ) : (
        <div className="w-full bg-gray-100 h-48 flex justify-center items-center text-gray-500 rounded-lg border-2 border-dashed border-gray-300">
          Image
        </div>
      )}
    </div>
  </div>
);

export const Layout6: React.FC<LayoutTemplateProps> = ({ block, className = '' }) => (
  <div className={`layout-6 text-center ${className}`}>
    {block.title && (
      <h3 className="text-xl font-semibold mb-2 text-gray-800">{block.title}</h3>
    )}
    {block.content && (
      <p className="text-gray-600 mb-4 leading-relaxed max-w-2xl mx-auto">{block.content}</p>
    )}
    {block.ctaText && block.ctaUrl && (
      <a 
        href={block.ctaUrl}
        className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-md hover:bg-primary/90 transition-colors"
      >
        {block.ctaText}
      </a>
    )}
  </div>
);

export const Layout7: React.FC<LayoutTemplateProps> = ({ block, className = '' }) => (
  <div className={`layout-7 text-center ${className}`}>
    {block.title && (
      <h3 className="text-xl font-semibold mb-3 text-gray-800">{block.title}</h3>
    )}
    {block.content && (
      <div className="space-y-2 mb-4">
        {block.content.split('\n').filter(line => line.trim()).map((line, index) => (
          <p key={index} className="text-gray-600 leading-relaxed max-w-2xl mx-auto">
            {line.trim()}
          </p>
        ))}
      </div>
    )}
    {block.ctaText && block.ctaUrl && (
      <a 
        href={block.ctaUrl}
        className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-md hover:bg-primary/90 transition-colors"
      >
        {block.ctaText}
      </a>
    )}
  </div>
);
