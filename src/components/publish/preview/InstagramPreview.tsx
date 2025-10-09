// src/components/publish/preview/InstagramPreview.tsx
import React from 'react';
import { Heart, MessageCircle, Send, Bookmark } from 'lucide-react';
import { truncateWithMore } from './truncate';
import { stripMarkdownForSocial } from '@/utils/markdownStripper';
import type { PreviewProps } from './types';

interface InstagramPreviewProps extends PreviewProps {
  platform: "instagram";
}

export const InstagramPreview = ({ 
  accountName, 
  avatarUrl, 
  caption, 
  mediaUrl, 
  likeCount = 1248, 
  commentCount = 89 
}: InstagramPreviewProps) => {
  // Strip markdown as Instagram doesn't render it
  const cleanCaption = stripMarkdownForSocial(caption);
  const truncatedCaption = truncateWithMore(cleanCaption, 140);
  const showMore = cleanCaption.length > 140;
  
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

      {/* Media */}
      <div className="relative bg-black flex items-center justify-center" style={{ maxHeight: '70vh' }}>
        {mediaUrl ? (
          <img 
            src={mediaUrl} 
            alt="" 
            className="w-full h-auto object-contain"
            style={{ maxHeight: '70vh' }}
          />
        ) : (
          <div className="w-full aspect-square bg-gray-100 flex items-center justify-center">
            <span className="text-gray-400 text-sm">No image</span>
          </div>
        )}
      </div>

      {/* Action Row */}
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-4">
          <button 
            className="hover:opacity-70 transition-opacity" 
            title="Preview only"
            aria-label="Preview only"
          >
            <Heart className="w-6 h-6" />
          </button>
          <button 
            className="hover:opacity-70 transition-opacity" 
            title="Preview only"
            aria-label="Preview only"
          >
            <MessageCircle className="w-6 h-6" />
          </button>
          <button 
            className="hover:opacity-70 transition-opacity" 
            title="Preview only"
            aria-label="Preview only"
          >
            <Send className="w-6 h-6" />
          </button>
        </div>
        <button 
          className="hover:opacity-70 transition-opacity" 
          title="Preview only"
          aria-label="Preview only"
        >
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
        <button className="text-gray-500 text-sm hover:opacity-70" title="Preview only">
          View all {commentCount} comments
        </button>
      </div>
    </div>
  );
};