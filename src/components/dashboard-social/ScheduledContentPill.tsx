
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Edit, Clock, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ScheduledContentPillProps {
  scheduledPost: {
    id: string;
    platform: string;
    publish_at: string;
    status: string;
    content?: {
      caption: string;
    };
  };
  onEdit: (scheduledPost: any) => void;
  onReschedule: (scheduledId: string) => void;
  onUnschedule: (scheduledId: string) => void;
  onDelete: (scheduledId: string) => void;
}

const getPlatformColor = (platform: string) => {
  switch (platform.toLowerCase()) {
    case 'facebook':
      return 'bg-[#1877F2] text-white';
    case 'instagram':
      return 'bg-gradient-to-r from-[#E4405F] to-[#F77737] text-white';
    case 'twitter':
      return 'bg-[#1DA1F2] text-white';
    default:
      return 'bg-[#68BEB9] text-white';
  }
};

const getPlatformIcon = (platform: string) => {
  // This would typically use proper platform icons
  switch (platform.toLowerCase()) {
    case 'facebook':
      return 'FB';
    case 'instagram':
      return 'IG';
    case 'twitter':
      return 'TW';
    default:
      return platform.substring(0, 2).toUpperCase();
  }
};

export const ScheduledContentPill = ({
  scheduledPost,
  onEdit,
  onReschedule,
  onUnschedule,
  onDelete
}: ScheduledContentPillProps) => {
  const publishTime = new Date(scheduledPost.publish_at);
  const isOverdue = publishTime < new Date() && scheduledPost.status === 'QUEUED';

  return (
    <div className={cn(
      "group relative bg-white rounded-lg border shadow-sm p-2 transition-all duration-200 hover:shadow-md",
      isOverdue && "border-orange-300 bg-orange-50"
    )}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Badge className={cn("text-xs font-medium", getPlatformColor(scheduledPost.platform))}>
            {getPlatformIcon(scheduledPost.platform)}
          </Badge>
          
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[#3E5A6B] truncate">
              {scheduledPost.content?.caption?.substring(0, 30) || 'Scheduled Post'}
              {scheduledPost.content?.caption && scheduledPost.content.caption.length > 30 && '...'}
            </p>
            <p className="text-xs text-gray-500">
              {format(publishTime, 'HH:mm')}
            </p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => onEdit(scheduledPost)}>
              <Edit className="w-3 h-3 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onReschedule(scheduledPost.id)}>
              <Clock className="w-3 h-3 mr-2" />
              Reschedule
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onUnschedule(scheduledPost.id)}>
              <X className="w-3 h-3 mr-2" />
              Unschedule
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onDelete(scheduledPost.id)}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="w-3 h-3 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {scheduledPost.status === 'PUBLISHING' && (
        <div className="absolute inset-0 bg-[#68BEB9]/10 rounded-lg flex items-center justify-center">
          <div className="text-xs text-[#68BEB9] font-medium">Publishing...</div>
        </div>
      )}

      {isOverdue && (
        <div className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full"></div>
      )}
    </div>
  );
};
