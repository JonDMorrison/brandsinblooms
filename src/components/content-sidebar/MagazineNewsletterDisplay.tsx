
import React from 'react';
import { OptimizedNewsletterDisplay } from './newsletter/OptimizedNewsletterDisplay';

interface MagazineNewsletterDisplayProps {
  content: string;
  className?: string;
  contentTaskId?: string;
  campaignTitle?: string;
  taskStatus?: string;
}

export const MagazineNewsletterDisplay = ({ 
  content, 
  className,
  contentTaskId,
  campaignTitle,
  taskStatus 
}: MagazineNewsletterDisplayProps) => {
  console.log('[NEWSLETTER] MagazineNewsletterDisplay delegating to OptimizedNewsletterDisplay');
  
  return (
    <OptimizedNewsletterDisplay
      content={content}
      className={className}
      contentTaskId={contentTaskId}
      campaignTitle={campaignTitle}
      taskStatus={taskStatus}
    />
  );
};
