
import React from 'react';
import { ParsedMarkdown } from '../markdown/ParsedMarkdown';

interface NewsletterDisplayProps {
  task: any;
}

export const NewsletterDisplay = ({ task }: NewsletterDisplayProps) => {
  return (
    <article className="prose lg:prose-lg mx-auto">
      <ParsedMarkdown content={task.ai_output} />
    </article>
  );
};

export default NewsletterDisplay;
