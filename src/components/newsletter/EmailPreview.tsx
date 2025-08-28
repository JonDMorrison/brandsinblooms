
import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { LayoutRenderer } from './LayoutRenderer';

interface EmailPreviewProps {
  blocks: ContentBlock[];
  subjectLine?: string;
  preheaderText?: string;
  senderName?: string;
  senderEmail?: string;
  className?: string;
}

export const EmailPreview: React.FC<EmailPreviewProps> = ({
  blocks,
  subjectLine,
  preheaderText,
  senderName,
  senderEmail,
  className = ''
}) => {
  return (
    <div className={`email-preview ${className}`}>
      {/* Email Header Info */}
      <div className="bg-gray-100 p-4 mb-4 rounded-t-lg border-b">
        <div className="text-sm text-gray-600 space-y-1">
          <div><strong>From:</strong> {senderName || 'Your Garden Center'} &lt;{senderEmail || 'newsletter@yourgardencenter.com'}&gt;</div>
          <div><strong>Subject:</strong> {subjectLine || 'Newsletter Subject'}</div>
          {preheaderText && <div><strong>Preview:</strong> {preheaderText}</div>}
        </div>
      </div>

      {/* Email Content */}
      <div className="bg-white border rounded-b-lg overflow-hidden">
        <LayoutRenderer blocks={blocks} />
      </div>
    </div>
  );
};
