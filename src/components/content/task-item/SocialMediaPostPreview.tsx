
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Heart, MessageCircle, Share, Bookmark, Instagram, Facebook } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SocialMediaPostPreviewProps {
  content: string;
  postType: 'instagram' | 'facebook';
  className?: string;
}

export const SocialMediaPostPreview = ({ content, postType, className }: SocialMediaPostPreviewProps) => {
  // Extract hashtags from content
  const hashtagRegex = /#[\w]+/g;
  const hashtags = content.match(hashtagRegex) || [];
  const textWithoutHashtags = content.replace(hashtagRegex, '').trim();

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
            "relative bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center",
            postType === 'instagram' ? 'aspect-square' : 'aspect-[4/3]'
          )}>
            <div className="text-center text-gray-500">
              <div className="w-12 h-12 mx-auto mb-2 bg-gray-300 rounded-lg flex items-center justify-center">
                <span className="text-xl">🖼️</span>
              </div>
              <p className="text-sm font-medium">Featured Image</p>
              <p className="text-xs">Will be generated</p>
            </div>
          </div>

          {/* Thumbnail Gallery */}
          <div className="p-3 bg-gray-50 border-t">
            <p className="text-xs text-gray-600 mb-2 font-medium">Additional Images</p>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((i) => (
                <div 
                  key={i}
                  className="aspect-square bg-gray-200 rounded border flex items-center justify-center hover:bg-gray-300 transition-colors cursor-pointer"
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
