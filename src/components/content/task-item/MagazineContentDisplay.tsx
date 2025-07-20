
import React from 'react';
import { cleanContentForDisplay } from '@/utils/contentUtils';
import { cleanVideoContent, isVideoScriptContent } from '@/utils/videoContentCleaner';
import { SafeHtml } from '@/components/ui/safe-html';
import { stripEmojis } from '@/utils/contentValidation';
import { validateFormattedContent, repairFormattedContent } from '@/utils/contentFormatValidator';

interface MagazineContentDisplayProps {
  content: string;
  postType: string;
  contentTaskId?: string;
  campaignTitle?: string;
  task?: any;
  className?: string;
}

export const MagazineContentDisplay = ({ 
  content, 
  postType, 
  contentTaskId, 
  campaignTitle, 
  task,
  className = ""
}: MagazineContentDisplayProps) => {
  
  if (!content) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
        <div className="text-gray-400 italic text-sm">
          No content available
        </div>
      </div>
    );
  }

  // Process content based on type with enhanced pipeline
  let processedContent = content;
  
  // Special handling for video content
  if (postType === 'video') {
    console.log('🎬 Processing video content for display:', {
      hasSceneInfo: isVideoScriptContent(content),
      originalLength: content.length
    });
    
    // Clean video content to remove all scene information
    processedContent = cleanVideoContent(content);
    
    console.log('🎬 Video content processed:', {
      cleanedLength: processedContent.length,
      removedChars: content.length - processedContent.length
    });
  } else {
    // For non-video content, use enhanced cleaning
    processedContent = cleanContentForDisplay(content, postType);
  }
  
  // Strip emojis with improved spacing preservation
  processedContent = stripEmojis(processedContent);
  
  // Validate and repair formatted content
  const validation = validateFormattedContent(processedContent, postType);
  if (!validation.isValid) {
    console.log('Content validation issues detected:', validation.issues);
    processedContent = repairFormattedContent(processedContent);
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 overflow-hidden ${className}`}>
      <div className="p-6">
        {postType === 'video' ? (
          // Video content gets special formatting as conversational script
          <div className="prose prose-lg max-w-none">
            <div className="text-sm text-gray-600 mb-3 font-medium">
              🎬 Teaching Script
            </div>
            <div className="text-gray-800 whitespace-pre-wrap leading-relaxed">
              {processedContent}
            </div>
          </div>
        ) : postType === 'blog' || postType === 'newsletter' ? (
          // Blog and newsletter content use SafeHtml for rich formatting
          <div className="prose prose-lg max-w-none">
            <SafeHtml 
              content={processedContent} 
              className="text-sm"
              type="newsletter"
            />
          </div>
        ) : (
          // Other content types use simple text display
          <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
            {processedContent.replace(/<[^>]*>/g, '')}
          </div>
        )}
      </div>
    </div>
  );
};
