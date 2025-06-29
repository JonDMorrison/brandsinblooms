
import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Clock, CheckCircle, Image, Video, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface DraftCardProps {
  task: any;
  onSelect: () => void;
  isSelected?: boolean;
  isDraggable?: boolean;
}

export const DraftCard = ({ task, onSelect, isSelected, isDraggable }: DraftCardProps) => {
  const getPostTypeIcon = (postType: string) => {
    switch (postType?.toLowerCase()) {
      case 'video':
      case 'reel':
        return <Video className="w-4 h-4" />;
      case 'image':
        return <Image className="w-4 h-4" />;
      case 'newsletter':
        return <Mail className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getPlatformBadgeColor = (postType: string) => {
    switch (postType?.toLowerCase()) {
      case 'facebook':
        return 'bg-blue-100 text-blue-800';
      case 'instagram':
        return 'bg-purple-100 text-purple-800';
      case 'newsletter':
        return 'bg-green-100 text-green-800';
      case 'video':
      case 'reel':
        return 'bg-pink-100 text-pink-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const wordCount = task.ai_output ? task.ai_output.split(/\s+/).length : 0;
  const snippet = task.ai_output 
    ? task.ai_output.split(/\s+/).slice(0, 20).join(' ') + (wordCount > 20 ? '...' : '')
    : 'No content generated yet';

  const isApproved = task.status === 'approved';

  return (
    <div
      className={cn(
        "flex p-3 gap-3 hover:bg-slate-50 cursor-pointer rounded-lg border-l-4 transition-all duration-200",
        isSelected 
          ? "border-l-[#68BEB9] bg-[#68BEB9]/5 shadow-md" 
          : "border-l-gray-200 hover:border-l-[#68BEB9]/50",
        isApproved && "border-l-[#68BEB9]",
        isDraggable ? "cursor-grab active:cursor-grabbing" : "cursor-not-allowed opacity-75"
      )}
      onClick={onSelect}
      draggable={isDraggable}
      aria-roledescription="Draggable draft"
      tabIndex={0}
      style={{ height: '96px' }}
    >
      <div className="flex flex-col items-center mt-1 flex-shrink-0">
        <div className="text-slate-500 mb-1">
          {getPostTypeIcon(task.post_type)}
        </div>
        {task.post_type && (
          <Badge 
            variant="outline" 
            className={cn("text-xs px-1 py-0", getPlatformBadgeColor(task.post_type))}
          >
            {task.post_type}
          </Badge>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium line-clamp-3 leading-tight mb-2">
          {snippet}
        </p>

        <div className="flex text-xs text-slate-500 gap-3 items-center">
          {task.scheduled_date && (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{format(new Date(task.scheduled_date), 'MMM d')}</span>
            </div>
          )}
          <span>{wordCount}w</span>
          {isApproved && (
            <div className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-[#68BEB9]" />
              <Badge className="bg-[#68BEB9] text-white text-xs px-1 py-0">
                Approved
              </Badge>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
