
import React from 'react';
import { NewsletterPreview } from '@/components/newsletter/NewsletterPreview';

interface ContentDisplayProps {
  selectedDraft: any;
}

export const ContentDisplay = ({ selectedDraft }: ContentDisplayProps) => {
  if (!selectedDraft) {
    return (
      <div className="flex-1 p-4 bg-gray-50 rounded-lg overflow-y-auto flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-gray-500 mb-2">No draft selected</div>
          <p className="text-sm text-gray-400">Select a draft from the tray to compose or manage</p>
        </div>
      </div>
    );
  }

  const content = selectedDraft.ai_output || 'No content generated yet';
  
  if (selectedDraft.post_type === 'newsletter') {
    return (
      <div className="flex-1 overflow-y-auto min-h-[500px]">
        <NewsletterPreview 
          content={content}
          className="min-h-[200px]"
        />
      </div>
    );
  }
  
  return (
    <div className="flex-1 p-4 bg-gray-50 rounded-lg overflow-y-auto min-h-[500px]">
      <p className="whitespace-pre-wrap text-gray-700 break-words leading-relaxed">
        {content}
      </p>
    </div>
  );
};
