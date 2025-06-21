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
  
  // Extract hashtags from content
  const hashtagRegex = /#[\w]+/g;
  const hashtags = content.match(hashtagRegex) || [];
  const textWithoutHashtags = content.replace(hashtagRegex, '').trim();

  // Improved keyword extraction that focuses on content relevance
  const extractKeywords = (text: string): string => {
    // First, try to extract from hashtags (remove # symbol)
    const hashtagKeywords = hashtags.map(tag => tag.replace('#', '').toLowerCase());
    
    // Extract meaningful nouns and phrases from the main text
    const cleanText = text
      .toLowerCase()
      .replace(hashtagRegex, '') // Remove hashtags
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .replace(/\b(the|and|or|of|in|on|at|to|for|with|by|a|an|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|could|should|may|might|can|get|make|take|go|come|see|know|think|say|want|use|work|try|ask|need|feel|become|leave|put|mean|keep|let|begin|seem|help|talk|turn|start|show|hear|play|run|move|live|believe|hold|bring|happen|write|provide|sit|stand|lose|pay|meet|include|continue|set|learn|change|lead|understand|watch|follow|stop|create|speak|read|allow|add|spend|grow|open|walk|win|offer|remember|love|consider|appear|buy|wait|serve|die|send|expect|build|stay|fall|cut|reach|kill|remain)\b/g, '') // Remove common words
      .trim();
    
    // Extract key phrases and meaningful words
    const words = cleanText.split(/\s+/).filter(word => word.length > 2);
    const meaningfulWords = words.filter(word => 
      // Keep words that are likely to be nouns or descriptive terms
      !/^\d+$/.test(word) && // Not just numbers
      word.length > 2 && // Longer than 2 characters
      !['your', 'this', 'that', 'they', 'them', 'their', 'here', 'there', 'when', 'what', 'where', 'how', 'why', 'who'].includes(word)
    );

    // Combine hashtag keywords with meaningful words from text
    const allKeywords = [...hashtagKeywords, ...meaningfulWords.slice(0, 3)];
    
    // Build the search query
    let searchQuery = '';
    
    if (allKeywords.length > 0) {
      // Use the most relevant keywords
      searchQuery = allKeywords.slice(0, 4).join(' ');
    } else if (meaningfulWords.length > 0) {
      // Fallback to meaningful words from text
      searchQuery = meaningfulWords.slice(0, 3).join(' ');
    } else {
      // Final fallback to post type
      searchQuery = postType === 'instagram' ? 'lifestyle aesthetic' : 'community social';
    }

    return searchQuery.trim();
  };

  const searchQuery = extractKeywords(content);
  const { images, loading, fetchNewImages } = useImageSuggestions(contentTaskId, postType);

  // Auto-fetch images when component mounts
  useEffect(() => {
    if (images.length === 0 && !loading && searchQuery) {
      console.log('SocialMediaPostPreview: Auto-fetching images with query:', searchQuery);
      fetchNewImages(searchQuery, contentTaskId, postType);
    }
  }, [searchQuery, contentTaskId, postType]);

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
            <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
              {textWithoutHashtags}
            </p>
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
              </div>
            ) : currentImage ? (
              <img
                src={currentImage.thumb_url}
                alt={currentImage.alt}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to placeholder on image error
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement?.querySelector('.fallback-placeholder')?.classList.remove('hidden');
                }}
              />
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
                <p className="text-xs">{searchQuery ? `Searching: ${searchQuery}` : 'Will be generated'}</p>
              </div>
            </div>
          </div>

          {/* Thumbnail Gallery */}
          <div className="p-3 bg-gray-50 border-t">
            <p className="text-xs text-gray-600 mb-2 font-medium">Additional Images</p>
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
                  onClick={() => setSelectedImageIndex(index)}
                >
                  <img
                    src={image.thumb_url}
                    alt={image.alt}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback to placeholder on thumbnail error
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement?.querySelector('.thumb-fallback')?.classList.remove('hidden');
                    }}
                  />
                  <div className="hidden thumb-fallback text-xs text-gray-500 bg-gray-200 w-full h-full flex items-center justify-center">
                    <span>+</span>
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
