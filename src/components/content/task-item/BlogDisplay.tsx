
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Image as ImageIcon } from 'lucide-react';
import { getPostTypeIcon, getPostTypeColor, formatContent } from './display-utils';

interface BlogDisplayProps {
  content: string;
  className?: string;
}

export const BlogDisplay = ({ content, className }: BlogDisplayProps) => {
  const { text } = formatContent(content);
  const paragraphs = text.split('\n\n').filter(p => p.trim());
  const title = paragraphs[0] || 'Blog Post';
  const bodyParagraphs = paragraphs.slice(1);
  const IconComponent = getPostTypeIcon('blog');

  return (
    <div className={`bg-gradient-to-br ${getPostTypeColor('blog')} rounded-lg p-6 border ${className || ''}`}>
      <div className="flex items-center gap-3 mb-6">
        <IconComponent className="w-5 h-5 text-green-600" />
        <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
          Blog Article
        </Badge>
      </div>

      <div className="aspect-video bg-gradient-to-br from-green-100 to-emerald-100 rounded-lg mb-6 flex items-center justify-center border border-green-200 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-green-50/50 to-emerald-50/50"></div>
        <div className="text-center text-green-600 z-10">
          <ImageIcon className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm font-medium">Blog Featured Image</p>
          <p className="text-xs opacity-75">Header image for article</p>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold text-gray-900 leading-tight">
          {title}
        </h2>
        
        {bodyParagraphs.map((paragraph, index) => (
          <p key={index} className="text-gray-700 leading-relaxed">
            {paragraph}
          </p>
        ))}
      </div>
    </div>
  );
};
