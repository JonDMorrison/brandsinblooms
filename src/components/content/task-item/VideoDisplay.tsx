
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Video, Clock } from 'lucide-react';
import { getPostTypeIcon, getPostTypeColor, formatContent } from './display-utils';

interface VideoDisplayProps {
  content: string;
  className?: string;
}

export const VideoDisplay = ({ content, className }: VideoDisplayProps) => {
  const { text } = formatContent(content);
  const lines = text.split('\n').filter(line => line.trim());
  const IconComponent = getPostTypeIcon('video');

  return (
    <div className={`bg-gradient-to-br ${getPostTypeColor('video')} rounded-lg p-6 border ${className || ''}`}>
      <div className="flex items-center gap-3 mb-6">
        <IconComponent className="w-5 h-5 text-red-500" />
        <Badge variant="secondary" className="bg-red-100 text-red-700 border-red-200">
          Video Script
        </Badge>
      </div>

      <div className="aspect-video bg-gradient-to-br from-red-100 to-orange-100 rounded-lg mb-6 flex items-center justify-center border border-red-200">
        <div className="text-center text-red-600">
          <Video className="w-12 h-12 mx-auto mb-2" />
          <p className="text-sm">Video preview</p>
        </div>
      </div>

      <div className="space-y-3">
        {lines.map((line, index) => (
          <div key={index} className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <Clock className="w-4 h-4 text-red-600" />
            </div>
            <p className="text-gray-700 leading-relaxed flex-1">
              {line}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};
