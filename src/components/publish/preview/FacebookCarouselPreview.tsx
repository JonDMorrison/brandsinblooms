import React, { useState } from 'react';
import { ThumbsUp, MessageCircle, Share } from 'lucide-react';
import { truncateWithMore } from './truncate';
import { stripMarkdownForSocial } from '@/utils/markdownStripper';
import type { PreviewProps } from './types';

interface FacebookCarouselPreviewProps extends PreviewProps {
  platform: "facebook";
  isCarousel: true;
  mediaUrls: string[];
}

export const FacebookCarouselPreview = ({ 
  accountName, 
  avatarUrl, 
  caption, 
  mediaUrls,
  likeCount = 1248, 
  commentCount = 89 
}: FacebookCarouselPreviewProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const cleanCaption = stripMarkdownForSocial(caption);
  const truncatedCaption = truncateWithMore(cleanCaption, 240);
  const showSeeMore = cleanCaption.length > 240;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            <span className="text-white font-medium">{accountName[0]?.toUpperCase()}</span>
          )}
        </div>
        <div>
          <div className="font-medium text-sm">{accountName}</div>
          <div className="text-xs text-gray-500">Just now • 🌍</div>
        </div>
      </div>

      {/* Caption */}
      {caption && (
        <div className="px-4 pb-3">
          <span className="text-sm leading-relaxed">
            {truncatedCaption}
            {showSeeMore && <span className="text-blue-600 ml-1 cursor-pointer hover:underline">See more</span>}
          </span>
        </div>
      )}

      {/* Carousel Media with Thumbnails */}
      <div className="space-y-2">
        {/* Main Image */}
        <div className="relative bg-black flex items-center justify-center" style={{ maxHeight: '70vh' }}>
          <img 
            src={mediaUrls[currentIndex]} 
            alt="" 
            className="w-full h-auto object-contain"
            style={{ maxHeight: '70vh' }}
          />
        </div>

        {/* Thumbnail Strip */}
        {mediaUrls.length > 1 && (
          <div className="px-4 pb-2">
            <div className="flex gap-2 overflow-x-auto">
              {mediaUrls.map((url, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`flex-shrink-0 w-16 h-16 rounded border-2 overflow-hidden transition-all ${
                    index === currentIndex ? 'border-blue-500 opacity-100' : 'border-gray-200 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action Row */}
      <div className="border-t border-gray-100 p-3">
        <div className="flex items-center justify-between text-gray-500 text-xs mb-2">
          <span>{likeCount.toLocaleString()} likes</span>
          <span>{commentCount} comments</span>
        </div>
        
        <div className="flex items-center border-t border-gray-100 pt-2">
          <button className="flex-1 flex items-center justify-center gap-2 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded transition-colors">
            <ThumbsUp className="w-4 h-4" />
            Like
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded transition-colors">
            <MessageCircle className="w-4 h-4" />
            Comment
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded transition-colors">
            <Share className="w-4 h-4" />
            Share
          </button>
        </div>
      </div>
    </div>
  );
};
