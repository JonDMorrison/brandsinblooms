
import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Hash, Image as ImageIcon } from 'lucide-react';
import { useImageSuggestions } from '@/hooks/useImageSuggestions';
import { getPostTypeIcon, getPostTypeColor, formatContent, extractImageQuery } from './display-utils';

interface InstagramDisplayProps {
  content: string;
  className?: string;
}

export const InstagramDisplay = ({ content, className }: InstagramDisplayProps) => {
  const { images, loading, fetchNewImages } = useImageSuggestions();
  const [contentImage, setContentImage] = useState<string | null>(null);
  const { text, hashtags } = formatContent(content);
  const IconComponent = getPostTypeIcon('instagram');

  useEffect(() => {
    if (!contentImage && !loading) {
      const query = extractImageQuery(content);
      fetchNewImages(query);
    }
  }, [content]);

  useEffect(() => {
    if (images.length > 0 && !contentImage) {
      setContentImage(images[0].thumb_url);
    }
  }, [images]);

  return (
    <div className={`bg-gradient-to-br ${getPostTypeColor('instagram')} rounded-lg p-6 border ${className || ''}`}>
      <div className="flex items-center gap-3 mb-4">
        <IconComponent className="w-5 h-5 text-pink-500" />
        <Badge variant="secondary" className="bg-pink-100 text-pink-700 border-pink-200">
          Instagram Post
        </Badge>
      </div>

      <div className="flex gap-4 mb-4">
        <div className="flex-[3] space-y-3">
          <p className="text-gray-800 leading-relaxed text-sm">
            {text}
          </p>
        </div>
        
        <div className="flex-[2]">
          {loading ? (
            <div className="aspect-square bg-gradient-to-br from-pink-100 to-purple-100 rounded-lg flex items-center justify-center border border-pink-200">
              <ImageIcon className="w-8 h-8 text-pink-500 animate-pulse" />
            </div>
          ) : contentImage ? (
            <div className="aspect-square rounded-lg overflow-hidden border border-pink-200">
              <img
                src={contentImage}
                alt="Instagram post visual"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=400&fit=crop&auto=format';
                }}
              />
            </div>
          ) : (
            <div className="aspect-square bg-gradient-to-br from-pink-100 to-purple-100 rounded-lg flex items-center justify-center border border-pink-200 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-pink-50/50 to-purple-50/50"></div>
              <div className="text-center text-pink-600 z-10">
                <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                <p className="text-xs font-medium">Instagram Visual</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {hashtags.map((tag, index) => (
            <span key={index} className="inline-flex items-center gap-1 text-xs text-pink-600 bg-pink-100 px-2 py-1 rounded-full">
              <Hash className="w-3 h-3" />
              {tag.replace('#', '')}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
