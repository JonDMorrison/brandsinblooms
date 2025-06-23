
import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Heart, MessageCircle, Share, Bookmark, Instagram, Facebook } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useImageSuggestions } from '@/hooks/useImageSuggestions';

interface SocialMediaPostPreviewProps {
  content: string;
  postType: 'instagram' | 'facebook';
  className?: string;
  contentTaskId?: string;
}

export const SocialMediaPostPreview = ({ content, postType, className, contentTaskId }: SocialMediaPostPreviewProps) => {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  
  // Improved content processing to handle various content formats
  const formatContent = (rawContent: string) => {
    if (!rawContent || rawContent.trim() === '') {
      return { text: '', hashtags: [] };
    }

    // Clean any HTML tags first
    const cleanContent = rawContent.replace(/<[^>]*>/g, '').trim();
    
    // Extract hashtags
    const hashtagRegex = /#[\w]+/g;
    const hashtags = cleanContent.match(hashtagRegex) || [];
    
    // Remove hashtags from main text but preserve line breaks and formatting
    let textWithoutHashtags = cleanContent.replace(hashtagRegex, '').trim();
    
    // Clean up extra whitespace and line breaks
    textWithoutHashtags = textWithoutHashtags
      .replace(/\n\s*\n/g, '\n\n') // Normalize double line breaks
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();

    return { text: textWithoutHashtags, hashtags };
  };

  const { text, hashtags } = formatContent(content);

  // Enhanced keyword extraction that prioritizes content relevance
  const extractKeywords = (text: string): string => {
    console.log('[PREVIEW] Processing content for images:', text.substring(0, 100));
    
    // First, check for specific food/dessert terms and preserve exact phrases
    const foodPhrases = [
      'ice cream', 'ice-cream', 'frozen yogurt', 'gelato', 'sorbet',
      'chocolate', 'vanilla', 'strawberry', 'mint chip',
      'dessert', 'sweet treat', 'frozen treat', 'dairy',
      'milkshake', 'sundae', 'cone', 'scoop'
    ];
    
    const holidayPhrases = [
      'ice cream month', 'national ice cream month', 'ice cream day',
      'summer treats', 'july celebration', 'frozen desserts'
    ];
    
    const lowerText = text.toLowerCase();
    
    // Look for exact food/holiday phrases first
    const foundFoodPhrases = foodPhrases.filter(phrase => lowerText.includes(phrase));
    const foundHolidayPhrases = holidayPhrases.filter(phrase => lowerText.includes(phrase));
    
    console.log('[PREVIEW] Found food phrases:', foundFoodPhrases);
    console.log('[PREVIEW] Found holiday phrases:', foundHolidayPhrases);
    
    // If we found specific food/holiday content, prioritize it
    if (foundFoodPhrases.length > 0 || foundHolidayPhrases.length > 0) {
      const priorityTerms = [...foundHolidayPhrases, ...foundFoodPhrases];
      const searchQuery = priorityTerms.slice(0, 3).join(' ');
      console.log('[PREVIEW] Using food/holiday priority query:', searchQuery);
      return searchQuery;
    }
    
    // Extract hashtags without # symbol for secondary keywords
    const hashtagKeywords = hashtags.map(tag => tag.replace('#', '').toLowerCase());
    
    // Extract meaningful words from the main text
    const cleanText = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') 
      .replace(/\b(the|and|or|of|in|on|at|to|for|with|by|a|an|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|could|should|may|might|can|get|make|take|go|come|see|know|think|say|want|use|work|try|ask|need|feel|become|leave|put|mean|keep|let|begin|seem|help|talk|turn|start|show|hear|play|run|move|live|believe|hold|bring|happen|write|provide|sit|stand|lose|pay|meet|include|continue|set|learn|change|lead|understand|watch|follow|stop|create|speak|read|allow|add|spend|grow|open|walk|win|offer|remember|love|consider|appear|buy|wait|serve|die|send|expect|build|stay|fall|cut|reach|kill|remain)\b/g, '')
      .trim();
    
    const words = cleanText.split(/\s+/).filter(word => word.length > 2);
    const meaningfulWords = words.filter(word => 
      !/^\d+$/.test(word) && 
      word.length > 2 && 
      !['your', 'this', 'that', 'they', 'them', 'their', 'here', 'there', 'when', 'what', 'where', 'how', 'why', 'who'].includes(word)
    );

    // Combine hashtag keywords with meaningful words from text
    const allKeywords = [...hashtagKeywords, ...meaningfulWords.slice(0, 3)];
    
    // Build the search query
    let searchQuery = '';
    
    if (allKeywords.length > 0) {
      searchQuery = allKeywords.slice(0, 3).join(' ');
    } else {
      // Final fallback to post type only
      searchQuery = postType === 'instagram' ? 'lifestyle aesthetic' : 'community social';
    }

    console.log('[PREVIEW] Final extracted query:', searchQuery);
    return searchQuery.trim();
  };

  const searchQuery = extractKeywords(text);
  const { images, loading, fetchNewImages } = useImageSuggestions(contentTaskId, postType);

  // Auto-fetch images when component mounts or content changes
  useEffect(() => {
    if (searchQuery && contentTaskId) {
      console.log('[PREVIEW] Auto-fetching images with query:', searchQuery);
      console.log('[PREVIEW] Current image state - count:', images.length, 'loading:', loading);
      
      // Always fetch new images if we have a search query
      fetchNewImages(searchQuery, contentTaskId, postType);
    }
  }, [searchQuery, contentTaskId, postType]);

  // Debug image state changes
  useEffect(() => {
    console.log('[PREVIEW] Image state changed:', {
      imageCount: images.length,
      loading,
      searchQuery,
      selectedIndex: selectedImageIndex,
      currentImage: images[selectedImageIndex]?.id || 'none'
    });
  }, [images, loading, selectedImageIndex, searchQuery]);

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

  const currentImage = images[selectedImageIndex];
  const thumbnailImages = images.slice(0, 4);

  // Debug content state
  console.log('[PREVIEW_DEBUG] Content state:', {
    rawContent: content,
    processedText: text,
    hashtags: hashtags,
    isEmpty: !text || text.trim() === ''
  });

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
                <p className="text-xs mt-1">Raw content: {content ? content.substring(0, 50) + '...' : 'No content'}</p>
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
                <p className="text-sm">Loading image...</p>
                <p className="text-xs mt-1">Query: {searchQuery}</p>
              </div>
            ) : currentImage ? (
              <>
                <img
                  src={currentImage.download_url || currentImage.thumb_url}
                  alt={currentImage.alt}
                  className="w-full h-full object-cover"
                  onLoad={() => console.log('[PREVIEW] Image loaded successfully:', currentImage.id)}
                  onError={(e) => {
                    console.error('[PREVIEW] Image failed to load:', currentImage.id, e);
                    // Fallback to thumb_url if download_url fails
                    if (e.currentTarget.src === currentImage.download_url && currentImage.thumb_url) {
                      console.log('[PREVIEW] Attempting fallback to thumb_url');
                      e.currentTarget.src = currentImage.thumb_url;
                    } else {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement?.querySelector('.fallback-placeholder')?.classList.remove('hidden');
                    }
                  }}
                />
                {/* Debug overlay */}
                <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                  {selectedImageIndex + 1}/{images.length}
                </div>
              </>
            ) : null}
            
            {/* Fallback placeholder */}
            <div className={cn(
              "absolute inset-0 flex items-center justify-center text-center text-gray-500 bg-gradient-to-br from-gray-100 to-gray-200",
              currentImage && !loading ? "hidden fallback-placeholder" : ""
            )}>
              <div>
                <div className="w-12 h-12 mx-auto mb-2 bg-gray-300 rounded-lg flex items-center justify-center">
                  <span className="text-xl">🖼️</span>
                </div>
                <p className="text-sm font-medium">Featured Image</p>
                <p className="text-xs">{searchQuery ? `Query: ${searchQuery}` : 'Generating...'}</p>
                <p className="text-xs mt-1">Images: {images.length} | Loading: {loading ? 'Yes' : 'No'}</p>
              </div>
            </div>
          </div>

          {/* Thumbnail Gallery */}
          <div className="p-3 bg-gray-50 border-t">
            <p className="text-xs text-gray-600 mb-2 font-medium">
              Additional Images ({images.length} available)
            </p>
            <div className="grid grid-cols-4 gap-2">
              {thumbnailImages.map((image, index) => (
                <div 
                  key={image.id}
                  className={cn(
                    "aspect-square rounded border flex items-center justify-center cursor-pointer transition-all overflow-hidden",
                    selectedImageIndex === index 
                      ? "ring-2 ring-blue-500 border-blue-300" 
                      : "hover:border-gray-400"
                  )}
                  onClick={() => {
                    console.log('[PREVIEW] Selected thumbnail index:', index);
                    setSelectedImageIndex(index);
                  }}
                >
                  <img
                    src={image.thumb_url}
                    alt={image.alt}
                    className="w-full h-full object-cover"
                    onLoad={() => console.log('[PREVIEW] Thumbnail loaded:', image.id)}
                    onError={(e) => {
                      console.error('[PREVIEW] Thumbnail failed to load:', image.id);
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement?.querySelector('.thumb-fallback')?.classList.remove('hidden');
                    }}
                  />
                  <div className="hidden thumb-fallback text-xs text-gray-500 bg-gray-200 w-full h-full flex items-center justify-center">
                    <span>?</span>
                  </div>
                </div>
              ))}
              
              {/* Fill remaining slots with placeholders if needed */}
              {Array.from({ length: Math.max(0, 4 - thumbnailImages.length) }).map((_, index) => (
                <div 
                  key={`placeholder-${index}`}
                  className="aspect-square bg-gray-200 rounded border flex items-center justify-center hover:bg-gray-300 transition-colors"
                >
                  <span className="text-xs text-gray-500">+</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
