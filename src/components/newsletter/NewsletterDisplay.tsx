

import React from 'react';
import { ParsedMarkdown } from '../markdown/ParsedMarkdown';
import { MagazineNewsletterDisplay } from '../content-sidebar/MagazineNewsletterDisplay';
import { normalizeTask } from '@/utils/normalizeTask';

interface NewsletterDisplayProps {
  task: any;
}

export const NewsletterDisplay = ({ task }: NewsletterDisplayProps) => {
  // Normalize the task to ensure consistent format
  const normalizedTask = normalizeTask(task);
  const content = normalizedTask.ai_output;
  
  // Check if this is a structured newsletter using normalized data
  const isStructuredNewsletter = normalizedTask.normalized && 
    (content.includes('newsletter_md:') || content.includes('blocks:') || normalizedTask.normalized.newsletter_md);
  
  if (isStructuredNewsletter && normalizedTask.normalized) {
    // Use MagazineNewsletterDisplay for structured newsletters
    // Pass the original content for YAML parsing, but the component will handle normalization
    return (
      <div className="prose lg:prose-lg mx-auto">
        <MagazineNewsletterDisplay content={content} />
      </div>
    );
  }
  
  // Use ParsedMarkdown for plain text newsletters
  // Use the normalized newsletter_md if available, otherwise fall back to original content
  const markdownContent = normalizedTask.normalized?.newsletter_md || content;
  
  return (
    <article className="prose lg:prose-lg mx-auto">
      <ParsedMarkdown content={markdownContent} />
    </article>
  );
};

export default NewsletterDisplay;
