
import React, { useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Heart, MessageCircle, Share, Bookmark, Instagram, Facebook } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useImageSuggestions } from '@/hooks/useImageSuggestions';

interface SocialMediaPostPreviewProps {
  content: string;
  postType: 'instagram' | 'facebook';
  className?: string;
  contentTaskId?: string;
  campaignTitle?: string;
}

export const SocialMediaPostPreview = ({ content, postType, className, contentTaskId, campaignTitle }: SocialMediaPostPreviewProps) => {
  // Improved content processing to handle various content formats
  const formatContent = (rawContent: string) => {
    console.log('[PREVIEW] Raw content received:', rawContent?.substring(0, 200));
    
    if (!rawContent || rawContent.trim() === '') {
      return { text: '', hashtags: [] };
    }

    // Clean any HTML tags first but preserve structure
    let cleanContent = rawContent
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove style tags
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove script tags
      .replace(/<h[1-6][^>]*>/gi, '\n\n**') // Convert headers to bold with spacing
      .replace(/<\/h[1-6]>/gi, '**\n\n') // Close headers with spacing
      .replace(/<p[^>]*>/gi, '\n\n') // Convert paragraphs with proper spacing
      .replace(/<\/p>/gi, '') // Close paragraphs
      .replace(/<br[^>]*>/gi, '\n') // Convert line breaks
      .replace(/<li[^>]*>/gi, '\n• ') // Convert list items
      .replace(/<\/li>/gi, '') // Close list items
      .replace(/<ul[^>]*>|<\/ul>/gi, '') // Remove ul tags
      .replace(/<ol[^>]*>|<\/ol>/gi, '') // Remove ol tags
      .replace(/<strong[^>]*>|<b[^>]*>/gi, '**') // Convert bold tags
      .replace(/<\/strong>|<\/b>/gi, '**') // Close bold tags
      .replace(/<em[^>]*>|<i[^>]*>/gi, '*') // Convert italic tags
      .replace(/<\/em>|<\/i>/gi, '*') // Close italic tags
      .replace(/<a[^>]*>([^<]*)<\/a>/gi, '$1') // Extract link text
      .replace(/<[^>]*>/g, '') // Remove any remaining HTML tags
      .replace(/\\n/g, '\n') // Convert literal \n to actual newlines
      .trim();

    console.log('[PREVIEW] After HTML cleaning:', cleanContent?.substring(0, 200));
    
    // Extract hashtags before final cleanup
    const hashtagRegex = /#[\w]+/g;
    const hashtags = cleanContent.match(hashtagRegex) || [];
    
    // Remove hashtags from main text but preserve formatting
    let textWithoutHashtags = cleanContent.replace(hashtagRegex, '').trim();
    
    // Clean up excessive whitespace while preserving intentional formatting
    textWithoutHashtags = textWithoutHashtags
      .replace(/\n\s*\n\s*\n+/g, '\n\n') // Convert 3+ line breaks to double
      .replace(/[ \t]+/g, ' ') // Normalize spaces and tabs (but not line breaks)
      .replace(/^\s+|\s+$/gm, '') // Trim whitespace from start/end of each line
      .trim();

    console.log('[PREVIEW] Final formatted text:', textWithoutHashtags?.substring(0, 200));
    console.log('[PREVIEW] Extracted hashtags:', hashtags);

    return { text: textWithoutHashtags, hashtags };
  };

  const { text, hashtags } = formatContent(content);
  const { images, loading, fetchNewImages } = useImageSuggestions(contentTaskId, postType);

  // Auto-fetch images when component mounts or content changes
  useEffect(() => {
    if (contentTaskId && content && content.trim().length > 10) {
      console.log('[PREVIEW] Auto-fetching images with smart analysis');
      console.log('[PREVIEW] Content preview:', content.substring(0, 100));
      console.log('[PREVIEW] Campaign title:', campaignTitle);
      
      // Use smart content analysis for image search
      fetchNewImages('', contentTaskId, postType, content, campaignTitle);
    }
  }, [content, contentTaskId, postType, campaignTitle]);

  const getPlatformIcon = () => {
    return postType === 'instagram' ? (
      <Instagram className="w-5 h-5 text-pink-600" />
    ) : (
      <Facebook className="w-5 h-5 text-blue-600" />
    );
  };

  const getPlatformStyle = () => {
    return postType === 'instagram' 
      ? 'bg-gradient-to-br from-purple-50 to-pink-50 border-pink-200'
      : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200';
  };

  const currentImage = images[0]; // Just use the first image

  return (
    <div className={cn('rounded-lg border-2 overflow-hidden shadow-sm', getPlatformStyle(), className)}>
      {/* Platform Header */}
      <div className="flex items-center gap-3 p-4 bg-white border-b">
        {getPlatformIcon()}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-semibold">YB</span>
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-900">Your Business</p>
              <p className="text-xs text-gray-500">2 hours ago</p>
            </div>
          </div>
        </div>
        <Badge variant="outline" className="text-xs capitalize">
          {postType}
        </Badge>
      </div>

      {/* Main Content Area - 50/50 Split */}
      <div className="flex">
        {/* Text Content - Left 50% */}
        <div className="flex-1 p-4 space-y-3">
          <div className="prose prose-sm max-w-none">
            {text && text.trim() !== '' ? (
              <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                {text}
              </p>
            ) : (
              <div className="text-gray-400 italic text-sm">
                <p>Content is being generated...</p>
              </div>
            )}
          </div>

          {/* Hashtags */}
          {hashtags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {hashtags.map((tag, index) => (
                <span 
                  key={index}
                  className="text-blue-600 text-sm font-medium hover:underline cursor-pointer"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Mock Engagement */}
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between text-gray-500">
              <div className="flex items-center gap-4">
                <button className="flex items-center gap-1 hover:text-red-500 transition-colors">
                  <Heart className="w-4 h-4" />
                  <span className="text-xs">24</span>
                </button>
                <button className="flex items-center gap-1 hover:text-blue-500 transition-colors">
                  <MessageCircle className="w-4 h-4" />
                  <span className="text-xs">3</span>
                </button>
                <button className="flex items-center gap-1 hover:text-gray-700 transition-colors">
                  <Share className="w-4 h-4" />
                </button>
              </div>
              <button className="hover:text-gray-700 transition-colors">
                <Bookmark className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Image Area - Right 50% */}
        <div className="flex-1 border-l border-gray-200">
          {/* Main Featured Image */}
          <div className={cn(
            "relative bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden",
            postType === 'instagram' ? 'aspect-square' : 'aspect-[4/3]'
          )}>
            {loading ? (
              <div className="text-center text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto mb-2"></div>
                <p className="text-sm">Finding relevant images...</p>
              </div>
            ) : currentImage ? (
              <>
                <img
                  src={currentImage.download_url || currentImage.thumb_url}
                  alt={currentImage.alt}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    console.error('[PREVIEW] Image failed to load:', currentImage.id, e);
                    if (e.currentTarget.src === currentImage.download_url && currentImage.thumb_url) {
                      e.currentTarget.src = currentImage.thumb_url;
                    }
                  }}
                />
                {images.length > 1 && (
                  <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                    1/{images.length}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center text-gray-500">
                <div className="w-12 h-12 mx-auto mb-2 bg-gray-300 rounded-lg flex items-center justify-center">
                  <span className="text-xl">🖼️</span>
                </div>
                <p className="text-sm font-medium">Relevant Image</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
