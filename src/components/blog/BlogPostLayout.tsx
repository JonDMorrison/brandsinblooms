
import React from 'react';
import { cn } from '@/lib/utils';

interface BlogPostLayoutProps {
  title?: string;
  author?: string;
  date?: string;
  readingTime?: number;
  companyName?: string;
  content: string;
  className?: string;
}

export const BlogPostLayout = ({ 
  title, 
  author, 
  date, 
  readingTime, 
  companyName,
  content, 
  className 
}: BlogPostLayoutProps) => {
  const formattedDate = date ? new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : null;

  const estimatedReadingTime = readingTime || Math.ceil(content.replace(/<[^>]*>/g, '').split(' ').length / 200);

  return (
    <div className={cn("bg-slate-50 text-slate-800 min-h-screen", className)}>
      {/* Hero Header */}
      {(title || companyName) && (
        <header className="w-full bg-white py-12 border-b border-slate-100 fade-in">
          <div className="max-w-3xl mx-auto px-4 space-y-4 text-center">
            {companyName && (
              <p className="text-sm font-medium text-primary">{companyName}</p>
            )}
            {title && (
              <h1 className="text-3xl md:text-4xl font-bold font-display leading-tight text-slate-900">
                {title}
              </h1>
            )}
            <div className="flex items-center justify-center gap-2 text-slate-500 text-sm">
              {author && <span>By {author}</span>}
              {author && formattedDate && <span>•</span>}
              {formattedDate && <span>{formattedDate}</span>}
              {(author || formattedDate) && <span>•</span>}
              <span>{estimatedReadingTime} min read</span>
            </div>
          </div>
        </header>
      )}

      {/* Post Body */}
      <article className="prose prose-lg prose-headings:font-display prose-headings:text-slate-900 prose-a:text-primary prose-strong:text-slate-900 prose-li:marker:text-primary prose-blockquote:border-primary prose-blockquote:text-slate-700 max-w-prose lg:max-w-3xl mx-auto px-4 py-10 fade-in">
        <div dangerouslySetInnerHTML={{ __html: content }} />
      </article>
    </div>
  );
};

// Reusable call-out component
export const BlogCallout = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <aside className={cn("bg-primary/10 border-l-4 border-primary rounded-lg p-4 my-8", className)}>
    <div className="m-0 text-slate-700">{children}</div>
  </aside>
);

// Responsive image component
export const BlogImage = ({ 
  src, 
  alt, 
  caption, 
  className 
}: { 
  src: string; 
  alt: string; 
  caption?: string; 
  className?: string;
}) => (
  <figure className={cn("my-8", className)}>
    <img src={src} alt={alt} className="w-full rounded-lg shadow-md" />
    {caption && (
      <figcaption className="text-sm text-slate-500 mt-2 text-center">
        {caption}
      </figcaption>
    )}
  </figure>
);
