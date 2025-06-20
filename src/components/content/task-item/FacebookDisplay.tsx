
import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Hash, Image as ImageIcon } from 'lucide-react';
import { useImageSuggestions } from '@/hooks/useImageSuggestions';
import { validateFacebookContent } from '@/utils/facebookContentValidator';
import { ContentComplianceBadge } from '@/components/ui/content-compliance-badge';
import { getPostTypeIcon, getPostTypeColor, formatContent, extractImageQuery } from './display-utils';

interface FacebookDisplayProps {
  content: string;
  className?: string;
}

export const FacebookDisplay = ({ content, className }: FacebookDisplayProps) => {
  const { images, loading, fetchNewImages } = useImageSuggestions();
  const [contentImage, setContentImage] = useState<string | null>(null);
  const { text, hashtags } = formatContent(content);
  const facebookValidation = validateFacebookContent(text);
  const IconComponent = getPostTypeIcon('facebook');

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
    <div className={`bg-gradient-to-br ${getPostTypeColor('facebook')} rounded-lg p-6 border ${className || ''}`}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <IconComponent className="w-5 h-5 text-blue-600" />
          <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
            Facebook Post
          </Badge>
        </div>
        <ContentComplianceBadge
          wordCount={facebookValidation.wordCount}
          maxWords={facebookValidation.maxWords}
          issues={facebookValidation.issues}
        />
      </div>

      {!facebookValidation.isValid && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-2">
            <div className="text-yellow-600 mt-0.5">⚠️</div>
            <div className="text-sm">
              <p className="font-medium text-yellow-800 mb-1">Content Guidelines Issues:</p>
              <ul className="text-yellow-700 space-y-1">
                {facebookValidation.issues.map((issue, index) => (
                  <li key={index}>• {issue}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-4 mb-4">
        <div className="flex-[3] space-y-3">
          <p className="text-gray-800 leading-relaxed">
            {text}
          </p>
        </div>
        
        <div className="flex-[2]">
          {loading ? (
            <div className="aspect-video bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center border border-blue-200">
              <ImageIcon className="w-8 h-8 text-blue-500 animate-pulse" />
            </div>
          ) : contentImage ? (
            <div className="aspect-video rounded-lg overflow-hidden border border-blue-200">
              <img
                src={contentImage}
                alt="Facebook post visual"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600&h=400&fit=crop&auto=format';
                }}
              />
            </div>
          ) : (
            <div className="aspect-video bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg flex items-center justify-center border border-blue-200 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 to-indigo-50/50"></div>
              <div className="text-center text-blue-600 z-10">
                <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                <p className="text-xs font-medium">Facebook Featured Image</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {hashtags.map((tag, index) => (
            <span key={index} className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
              <Hash className="w-3 h-3" />
              {tag.replace('#', '')}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
