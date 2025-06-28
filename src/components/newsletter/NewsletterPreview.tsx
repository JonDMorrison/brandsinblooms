
import React, { useMemo } from 'react';
import { renderMarkdownToMagazineHtml } from '@/utils/renderMarkdown';

interface NewsletterPreviewProps {
  content: string;
  className?: string;
}

export const NewsletterPreview = ({ content, className = '' }: NewsletterPreviewProps) => {
  const magazineHtml = useMemo(() => {
    return renderMarkdownToMagazineHtml(content);
  }, [content]);

  return (
    <div 
      className={`prose prose-sm max-w-none [&>*]:text-justify text-gray-700 ${className}`}
      dangerouslySetInnerHTML={{ __html: magazineHtml }}
    />
  );
};
