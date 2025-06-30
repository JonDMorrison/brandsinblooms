
import React from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ScheduledContentPillProps {
  task: any;
  scheduledMeta?: {
    platform: string;
    publish_at: string;
    status: string;
    mode?: 'AUTO' | 'MANUAL';
  };
  onClick: () => void;
}

export const ScheduledContentPill = ({ task, scheduledMeta, onClick }: ScheduledContentPillProps) => {
  const getPlatformIcon = (platform: string) => {
    switch (platform?.toLowerCase()) {
      case 'facebook':
      case 'fb':
        return '📘';
      case 'instagram':
      case 'ig_feed':
      case 'ig_story':
      case 'ig_reel':
        return '📷';
      case 'linkedin':
        return '💼';
      case 'twitter':
        return '🐦';
      default:
        return '📱';
    }
  };

  const getPlatformName = (postType: string) => {
    if (postType?.toLowerCase().includes('instagram')) return 'Instagram Post';
    if (postType?.toLowerCase().includes('facebook')) return 'Facebook Post';
    return 'Social Post';
  };

  const getPlatformColors = (postType: string, mode?: 'AUTO' | 'MANUAL') => {
    // Manual mode posts get gray styling
    if (mode === 'MANUAL') {
      return 'bg-gray-200 text-gray-600 border-gray-300';
    }
    
    // Auto mode gets platform colors
    if (postType?.toLowerCase().includes('facebook')) {
      return 'bg-[#1877F2] text-white border-[#1877F2]';
    }
    if (postType?.toLowerCase().includes('instagram')) {
      return 'bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 text-white border-pink-500';
    }
    return 'bg-[#68BEB9] text-white border-[#68BEB9]';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'QUEUED':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'PUBLISHED':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'ERROR':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const publishTime = scheduledMeta?.publish_at || task.scheduled_date;
  const platform = scheduledMeta?.platform || task.post_type;
  const mode = scheduledMeta?.mode || 'AUTO';

  const pillContent = (
    <div
      onClick={onClick}
      className={cn(
        "text-xs p-2 rounded border cursor-pointer hover:shadow-sm transition-all",
        getPlatformColors(task.post_type, mode)
      )}
    >
      <div className="flex items-center gap-1 justify-center">
        <span>{getPlatformIcon(platform)}</span>
        <span className="font-medium">
          {getPlatformName(task.post_type)}
        </span>
        {mode === 'MANUAL' && (
          <span className="text-xs opacity-75">(Manual)</span>
        )}
      </div>
      <div className="text-center text-xs opacity-90 mt-1">
        {publishTime ? format(new Date(publishTime), 'h:mm a') : 'Scheduled'}
      </div>
      {scheduledMeta?.status && (
        <div className={cn(
          "text-center text-xs px-1 py-0.5 rounded mt-1",
          getStatusColor(scheduledMeta.status)
        )}>
          {scheduledMeta.status}
        </div>
      )}
    </div>
  );

  // Show tooltip only for manual mode
  if (mode === 'MANUAL') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {pillContent}
          </TooltipTrigger>
          <TooltipContent>
            <p>Auto-posting disabled</p>
            <p className="text-xs opacity-75">Connect social accounts or upgrade to Bloom</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return pillContent;
};
