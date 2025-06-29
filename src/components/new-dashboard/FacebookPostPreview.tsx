
import React from 'react';
import { format } from 'date-fns';

interface FacebookPostPreviewProps {
  content: string;
  image?: {
    url: string;
    alt: string;
  };
  scheduledTime?: string;
}

export const FacebookPostPreview = ({ content, image, scheduledTime }: FacebookPostPreviewProps) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm max-w-md mx-auto">
      {/* Facebook Post Header */}
      <div className="p-3 flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
          <span className="text-white font-semibold text-sm">YB</span>
        </div>
        <div className="flex-1">
          <div className="font-semibold text-gray-900 text-sm">Your Business</div>
          <div className="text-xs text-gray-500 flex items-center gap-1">
            {scheduledTime ? format(new Date(scheduledTime), 'MMM d \'at\' h:mm a') : 'Just now'} · 🌐
          </div>
        </div>
        <div className="text-gray-400">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </div>
      </div>

      {/* Post Content */}
      <div className="px-3 pb-3">
        <p className="text-gray-900 text-sm whitespace-pre-wrap leading-relaxed">
          {content || 'Your post content will appear here...'}
        </p>
      </div>

      {/* Post Image */}
      {image && (
        <div className="border-t border-gray-100">
          <img 
            src={image.url} 
            alt={image.alt}
            className="w-full h-64 object-cover"
          />
        </div>
      )}

      {/* Facebook Actions */}
      <div className="border-t border-gray-100 p-2">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <span>👍❤️😊 You and others</span>
          <span>2 comments · 1 share</span>
        </div>
        <div className="flex items-center justify-around pt-1 border-t border-gray-100">
          <button className="flex items-center gap-1 py-2 px-4 text-gray-600 hover:bg-gray-50 rounded text-sm">
            👍 Like
          </button>
          <button className="flex items-center gap-1 py-2 px-4 text-gray-600 hover:bg-gray-50 rounded text-sm">
            💬 Comment
          </button>
          <button className="flex items-center gap-1 py-2 px-4 text-gray-600 hover:bg-gray-50 rounded text-sm">
            📤 Share
          </button>
        </div>
      </div>
    </div>
  );
};
