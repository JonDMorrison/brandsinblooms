import React, { useState } from 'react';
import { Heart, MessageCircle, Send, Bookmark, ChevronLeft, ChevronRight } from 'lucide-react';
import { truncateWithMore } from './truncate';
import { stripMarkdownForSocial } from '@/utils/markdownStripper';
import type { PreviewProps } from './types';

interface InstagramCarouselPreviewProps extends PreviewProps {
  platform: "instagram";
  isCarousel: true;
  mediaUrls: string[];
}

export const InstagramCarouselPreview = ({ 
  accountName, 
  avatarUrl, 
  caption, 
  mediaUrls,
  likeCount = 1248, 
  commentCount = 89 
}: InstagramCarouselPreviewProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const cleanCaption = stripMarkdownForSocial(caption);
  const truncatedCaption = truncateWithMore(cleanCaption, 140);
  const showMore = cleanCaption.length > 140;

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? mediaUrls.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === mediaUrls.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="bg-white rounded-lg overflow-hidden max-w-sm mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 p-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            <span className="text-white text-sm font-medium">{accountName[0]?.toUpperCase()}</span>
          )}
        </div>
        <span className="font-medium text-sm">{accountName}</span>
      </div>

      {/* Carousel Media */}
      <div className="relative bg-black flex items-center justify-center group" style={{ maxHeight: '70vh' }}>
        <img 
          src={mediaUrls[currentIndex]} 
          alt="" 
          className="w-full h-auto object-contain"
          style={{ maxHeight: '70vh' }}
        />
        
        {/* Navigation Arrows */}
        {mediaUrls.length > 1 && (
          <>
            <button
              onClick={handlePrevious}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Dots Indicator */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {mediaUrls.map((_, index) => (
            <div
              key={index}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                index === currentIndex ? 'bg-white w-2' : 'bg-white/50'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Action Row */}
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-4">
          <button className="hover:opacity-70 transition-opacity">
            <Heart className="w-6 h-6" />
          </button>
          <button className="hover:opacity-70 transition-opacity">
            <MessageCircle className="w-6 h-6" />
          </button>
          <button className="hover:opacity-70 transition-opacity">
            <Send className="w-6 h-6" />
          </button>
        </div>
        <button className="hover:opacity-70 transition-opacity">
          <Bookmark className="w-6 h-6" />
        </button>
      </div>

      {/* Likes */}
      <div className="px-3 pb-1">
        <span className="font-medium text-sm">{likeCount.toLocaleString()} likes</span>
      </div>

      {/* Caption */}
      {caption && (
        <div className="px-3 pb-2">
          <span className="text-sm">
            <span className="font-medium">{accountName}</span>{' '}
            {truncatedCaption}
            {showMore && <span className="text-gray-500 ml-1">more</span>}
          </span>
        </div>
      )}

      {/* Comments */}
      <div className="px-3 pb-3">
        <button className="text-gray-500 text-sm hover:opacity-70">
          View all {commentCount} comments
        </button>
      </div>
    </div>
  );
};
