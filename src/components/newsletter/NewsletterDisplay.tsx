
import React from 'react';
import { ParsedMarkdown } from '../markdown/ParsedMarkdown';
import { MagazineNewsletterDisplay } from '../content-sidebar/MagazineNewsletterDisplay';
import { normalizeTask } from '@/utils/normalizeTask';
import { validateContentCompliance } from '@/utils/campaignTitleUtils';

interface NewsletterDisplayProps {
  task: any;
}

export const NewsletterDisplay = ({ task }: NewsletterDisplayProps) => {
  // Normalize the task to ensure consistent format
  const normalizedTask = normalizeTask(task);
  const content = normalizedTask.ai_output;
  
  // Validate content compliance for debugging
  if (import.meta.env.DEV) {
    const validation = validateContentCompliance(content);
    if (!validation.isValid) {
      console.warn('Newsletter content validation issues:', validation.issues);
    }
  }
  
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
  
  // Clean any remaining formatting issues for plain text newsletters
  const cleanedContent = markdownContent
    .replace(/^\s*Welcome\s+to\s+[^.!?]*[.!?]\s*/gi, '') // Remove welcome openings
    .replace(/Week\s+\d+/gi, '') // Remove any remaining week references
    .replace(/^\s*•\s*/gm, '') // Convert bullet points to plain text
    .replace(/^\s*\d+\.\s*/gm, '') // Convert numbered lists to plain text
    .replace(/\s{2,}/g, ' ') // Clean up multiple spaces
    .trim();
  
  return (
    <article className="prose lg:prose-lg mx-auto">
      <ParsedMarkdown content={cleanedContent} />
    </article>
  );
};

export default NewsletterDisplay;
