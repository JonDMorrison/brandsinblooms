
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

  // Process content based on type with enhanced pipeline and debugging
  let processedContent = content;
  const originalLength = content.length;
  
  try {
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
      // For non-video content, use enhanced cleaning with fallback
      try {
        processedContent = cleanContentForDisplay(content, postType);
        console.log('📝 Content cleaned:', {
          originalLength,
          cleanedLength: processedContent.length,
          postType
        });
      } catch (error) {
        console.warn('⚠️ Content cleaning failed, using original:', error);
        processedContent = content; // Fallback to original content
      }
    }
    
    // Only strip emojis if we still have substantial content
    if (processedContent.trim().length > 10) {
      const beforeEmojis = processedContent.length;
      processedContent = stripEmojis(processedContent);
      console.log('🚫 Emojis stripped:', {
        before: beforeEmojis,
        after: processedContent.length
      });
    }
    
    // Validate and repair formatted content only if needed
    const validation = validateFormattedContent(processedContent, postType);
    if (!validation.isValid && processedContent.trim().length > 0) {
      console.log('🔧 Content validation issues detected:', validation.issues);
      const repairedContent = repairFormattedContent(processedContent);
      // Only use repaired content if it's not empty
      if (repairedContent.trim().length > 0) {
        processedContent = repairedContent;
      }
    }

    // Final safety check - if content is empty after processing, use original
    if (!processedContent.trim()) {
      console.warn('⚠️ Content became empty after processing, reverting to original');
      processedContent = content;
    }

  } catch (error) {
    console.error('❌ Content processing failed completely:', error);
    processedContent = content; // Always fallback to original content
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
