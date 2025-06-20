
import React from 'react';
import { InstagramDisplay } from './InstagramDisplay';
import { FacebookDisplay } from './FacebookDisplay';
import { NewsletterDisplay } from './NewsletterDisplay';
import { BlogDisplay } from './BlogDisplay';
import { VideoDisplay } from './VideoDisplay';
import { Badge } from '@/components/ui/badge';
import { Hash } from 'lucide-react';
import { getPostTypeIcon, getPostTypeColor, formatContent } from './display-utils';

interface MagazineContentDisplayProps {
  content: string;
  postType: string;
  className?: string;
}

export const MagazineContentDisplay = ({ content, postType, className }: MagazineContentDisplayProps) => {
  // Route to specific display components based on post type
  switch (postType) {
    case 'newsletter':
      return <NewsletterDisplay content={content} className={className} />;
    case 'instagram':
      return <InstagramDisplay content={content} className={className} />;
    case 'facebook':
      return <FacebookDisplay content={content} className={className} />;
    case 'blog':
      return <BlogDisplay content={content} className={className} />;
    case 'video':
      return <VideoDisplay content={content} className={className} />;
    default:
      return <DefaultContentDisplay content={content} postType={postType} className={className} />;
  }
};

// Default fallback component for unknown post types
const DefaultContentDisplay = ({ content, postType, className }: { content: string; postType: string; className?: string }) => {
  const { text, hashtags } = formatContent(content);
  const IconComponent = getPostTypeIcon(postType);

  return (
    <div className={`bg-gradient-to-br ${getPostTypeColor(postType)} rounded-lg p-6 border ${className || ''}`}>
      <div className="flex items-center gap-3 mb-4">
        <IconComponent className="w-5 h-5" />
        <Badge variant="secondary" className="capitalize">
          {postType} Content
        </Badge>
      </div>
      
      <p className="text-gray-800 leading-relaxed">
        {text}
      </p>
      
      {hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {hashtags.map((tag, index) => (
            <span key={index} className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-full">
              <Hash className="w-3 h-3" />
              {tag.replace('#', '')}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
