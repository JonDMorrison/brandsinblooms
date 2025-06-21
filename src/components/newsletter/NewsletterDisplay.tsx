
import React from 'react';
import { ParsedMarkdown } from '../markdown/ParsedMarkdown';
import { MagazineNewsletterDisplay } from '../content-sidebar/MagazineNewsletterDisplay';

interface NewsletterDisplayProps {
  task: any;
}

export const NewsletterDisplay = ({ task }: NewsletterDisplayProps) => {
  const content = task.ai_output;
  
  // Check if this is a structured newsletter (contains YAML structure)
  const isStructuredNewsletter = content.includes('newsletter_md:') || content.includes('blocks:');
  
  if (isStructuredNewsletter) {
    // Use MagazineNewsletterDisplay for structured newsletters
    return (
      <div className="prose lg:prose-lg mx-auto">
        <MagazineNewsletterDisplay content={content} />
      </div>
    );
  }
  
  // Use ParsedMarkdown for plain text newsletters
  return (
    <article className="prose lg:prose-lg mx-auto">
      <ParsedMarkdown content={content} />
    </article>
  );
};

export default NewsletterDisplay;
