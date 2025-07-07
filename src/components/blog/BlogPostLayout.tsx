
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

  // Remove debug logging to prevent console clutter

  return (
    <div className={cn("bg-white text-slate-800 min-h-0", className)}>
      {/* Hero Header */}
      {(title || companyName) && (
        <header className="w-full bg-white py-8 border-b border-slate-100">
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

      {/* Post Body with Enhanced Typography */}
      <article className="max-w-3xl mx-auto px-4 py-8">
        <div 
          className="prose prose-lg prose-slate max-w-none
                     prose-headings:font-display prose-headings:text-slate-900 
                     prose-a:text-primary prose-strong:text-slate-900 
                     prose-li:marker:text-primary prose-blockquote:border-primary 
                     prose-blockquote:text-slate-700
                     [&>h1]:text-4xl [&>h1]:font-bold [&>h1]:mb-6 [&>h1]:mt-8 [&>h1:first-child]:mt-0
                     [&>h2]:text-3xl [&>h2]:font-semibold [&>h2]:mb-4 [&>h2]:mt-10
                     [&>h3]:text-2xl [&>h3]:font-semibold [&>h3]:mb-3 [&>h3]:mt-8
                     [&>h4]:text-xl [&>h4]:font-semibold [&>h4]:mb-2 [&>h4]:mt-6
                     [&>p]:mb-6 [&>p]:text-slate-700 [&>p]:leading-relaxed
                     [&>ul]:my-6 [&>ul]:space-y-2 [&>ol]:my-6 [&>ol]:space-y-2
                     [&>blockquote]:border-l-4 [&>blockquote]:border-primary [&>blockquote]:bg-primary/5 
                     [&>blockquote]:pl-6 [&>blockquote]:py-4 [&>blockquote]:my-6 [&>blockquote]:italic"
          dangerouslySetInnerHTML={{ __html: content }}
        />
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
