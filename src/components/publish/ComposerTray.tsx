
import React, { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Small thumbnail image component with proper error handling
const ThumbnailImage = ({ src, alt, fallback }: { src: string; alt: string; fallback: string }) => {
  const [imageError, setImageError] = useState(false);
  
  if (imageError) {
    return <span>{fallback}</span>;
  }
  
  return (
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover rounded-lg"
      onError={() => setImageError(true)}
    />
  );
};

interface GeneratedContent {
  id: string;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED' | 'APPROVED';
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
  imageLoadingStates?: Record<string, boolean>;
}

export const ComposerTray = ({ content, selectedContent, onContentSelect, imageLoadingStates = {} }: ComposerTrayProps) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800';
      case 'SCHEDULED':
        return 'bg-blue-100 text-blue-800';
      case 'PUBLISHED':
        return 'bg-green-100 text-green-800';
      case 'APPROVED':
        return 'bg-emerald-100 text-emerald-800';
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

  const truncateCaption = (caption: string, maxLength: number = 35) => {
    if (caption.length <= maxLength) return caption;
    return caption.substring(0, maxLength) + '…';
  };

  const formatShortDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short' 
    });
  };

  const draftCount = content.filter(c => c.status === 'DRAFT').length;

  return (
    <div className="h-full bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col overflow-hidden">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-gray-50/50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#3E5A6B]">Social Content Queue</h2>
        </div>
        
        {/* Section Label */}
        {draftCount > 0 && (
          <div className="mt-3 mb-1">
            <p className="text-sm text-gray-500 font-medium">Drafts ({draftCount})</p>
          </div>
        )}
        
        <div className="flex items-center justify-between mt-1">
          <p className="text-sm text-gray-600">{content.length} approved posts ready</p>
          {content.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {draftCount} drafts
            </Badge>
          )}
        </div>
      </div>
      
      {/* Content List - Scrollable */}
      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="p-3 space-y-3">
            {content.map((item) => (
              <div
                key={item.id}
                onClick={() => onContentSelect(item)}
                className={cn(
                  "group flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-all duration-200",
                  "hover:shadow-md hover:border-[#68BEB9]/30",
                  selectedContent?.id === item.id
                    ? "border-[#68BEB9] bg-[#68BEB9]/10 shadow-sm"
                    : "border-gray-200 bg-white hover:bg-[#68BEB9]/5"
                )}
                style={{
                  backgroundColor: selectedContent?.id === item.id 
                    ? 'rgba(104, 190, 185, 0.1)' 
                    : undefined
                }}
                onMouseEnter={(e) => {
                  if (selectedContent?.id !== item.id) {
                    e.currentTarget.style.backgroundColor = 'rgba(104, 190, 185, 0.05)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedContent?.id !== item.id) {
                    e.currentTarget.style.backgroundColor = '';
                  }
                }}
              >
                {/* Thumbnail - Fixed size */}
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-lg flex-shrink-0 overflow-hidden relative">
                  {imageLoadingStates[item.id] ? (
                    <div className="animate-spin w-4 h-4 border-2 border-[#68BEB9] border-t-transparent rounded-full"></div>
                  ) : item.mediaUrl ? (
                    <ThumbnailImage 
                      src={item.mediaUrl} 
                      alt="Content preview" 
                      fallback={getPlatformIcon(item.platform)}
                    />
                  ) : (
                    getPlatformIcon(item.platform)
                  )}
                </div>

                {/* Content Details - Flexible */}
                <div className="flex-1 min-w-0">
                  <div className="mb-3">
                    <h3 className="font-medium text-[#3E5A6B] text-sm leading-tight">
                      {truncateCaption(item.caption)}
                    </h3>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Badge 
                      variant="outline" 
                      className={cn("text-xs", getStatusColor(item.status))}
                    >
                      {item.status}
                    </Badge>
                    
                    <span className="text-xs text-gray-500">
                      {formatShortDate(item.createdAt)}
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
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};
