
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
  
  console.log('🔍 [MagazineContentDisplay] Input:', {
    contentLength: content?.length || 0,
    postType,
    contentPreview: content?.substring(0, 100) + '...',
    hasContent: !!content
  });

  if (!content) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
        <div className="text-gray-400 italic text-sm">
          No content available
        </div>
      </div>
    );
  }

  // Minimal content processing - avoid over-cleaning
  let processedContent = content;
  
  try {
    // Special handling for video content only
    if (postType === 'video') {
      console.log('🎬 Processing video content for display');
      processedContent = cleanVideoContent(content);
    } else {
      // For other content types, use minimal processing to preserve content
      console.log('📝 Preserving content with minimal processing:', {
        postType,
        originalLength: content.length
      });
      processedContent = content; // Use original content to prevent over-processing
    }

    // Final safety check - always ensure we have content
    if (!processedContent.trim()) {
      console.warn('⚠️ Content became empty, reverting to original');
      processedContent = content;
    }

  } catch (error) {
    console.error('❌ Content processing failed, using original:', error);
    processedContent = content;
  }

  console.log('✅ Final processed content:', {
    finalLength: processedContent.length,
    isEmpty: !processedContent.trim(),
    preview: processedContent.substring(0, 100) + '...'
  });

  // Final safety check - if processed content is empty, show raw content with warning
  if (!processedContent.trim()) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 overflow-hidden ${className}`}>
        <div className="p-6">
          <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
            ⚠️ Content processing encountered issues. Showing raw content.
          </div>
          <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
            {content}
          </div>
        </div>
      </div>
    );
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
        ) : postType === 'blog' ? (
          // Blog content uses SafeHtml for rich formatting
          <div className="prose prose-lg max-w-none">
            <SafeHtml 
              content={processedContent} 
              className="text-sm"
              type="newsletter"
            />
          </div>
        ) : postType === 'newsletter' ? (
          // Newsletter content uses clean display without HTML/markdown
          <div className="prose prose-lg max-w-none">
            <SafeHtml 
              content={processedContent} 
              className="text-sm text-gray-700 leading-relaxed"
              type="newsletter-clean"
            />
          </div>
        ) : (
          // Other content types use simple text display with fallback
          <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
            {processedContent.replace(/<[^>]*>/g, '') || content}
          </div>
        )}
      </div>
    </div>
  );
};
