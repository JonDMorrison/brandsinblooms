
import React, { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface GeneratedContent {
  id: string;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';
  caption: string;
  mediaUrl?: string;
  platform?: string;
  campaignId?: string;
  createdAt: string;
}

interface ComposerTrayProps {
  content: GeneratedContent[];
  selectedContent: GeneratedContent | null;
  onContentSelect: (content: GeneratedContent) => void;
}

export const ComposerTray = ({ content, selectedContent, onContentSelect }: ComposerTrayProps) => {
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800';
      case 'SCHEDULED':
        return 'bg-blue-100 text-blue-800';
      case 'PUBLISHED':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPlatformIcon = (platform?: string) => {
    switch (platform) {
      case 'facebook':
        return '📘';
      case 'instagram':
        return '📷';
      default:
        return '📱';
    }
  };

  const truncateCaption = (caption: string, maxLength: number = 40) => {
    if (caption.length <= maxLength) return caption;
    return caption.substring(0, maxLength) + '...';
  };

  return (
    <div className="h-full bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-[#3E5A6B]">Social Content Queue</h2>
        <p className="text-sm text-gray-600 mt-1">{content.length} approved posts ready</p>
      </div>
      
      <ScrollArea className="h-[calc(100%-5rem)]">
        <div className="p-4 space-y-3">
          {content.map((item) => (
            <div
              key={item.id}
              onClick={() => onContentSelect(item)}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all duration-200",
                "hover:shadow-md hover:border-[#68BEB9]/30",
                selectedContent?.id === item.id
                  ? "border-[#68BEB9] bg-[#68BEB9]/5 shadow-sm"
                  : "border-gray-200 bg-white"
              )}
            >
              {/* Thumbnail */}
              <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
                {item.mediaUrl ? (
                  <img
                    src={item.mediaUrl}
                    alt="Content preview"
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  getPlatformIcon(item.platform)
                )}
              </div>

              {/* Content Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-[#3E5A6B] text-sm leading-tight">
                    {truncateCaption(item.caption)}
                  </h3>
                </div>
                
                <div className="flex items-center justify-between">
                  <Badge className={cn("text-xs", getStatusColor(item.status))}>
                    {item.status}
                  </Badge>
                  
                  <span className="text-xs text-gray-500">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {content.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📱</span>
              </div>
              <h3 className="text-lg font-medium text-[#3E5A6B] mb-2">No approved social content</h3>
              <p className="text-gray-600 text-sm">
                Generate and approve Facebook or Instagram content to start publishing
              </p>
            </div>
          )}

          {loading && (
            <div className="text-center py-4">
              <div className="animate-spin w-6 h-6 border-2 border-[#68BEB9] border-t-transparent rounded-full mx-auto"></div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
