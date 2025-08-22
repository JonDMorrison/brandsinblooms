// src/components/publish/PostCard.tsx
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ActionGroup } from '@/components/ui/action-group';
import { Badge } from '@/components/ui/badge';
import { Facebook, Instagram, Clock, Send, Edit3, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { PublishItem } from '@/types/publish';

export type PostCardProps = {
  item: PublishItem;
  publishedAt?: string;
  onEdit: (item: PublishItem) => void;
  onPublishNow: (item: PublishItem) => void;
  onSchedule: (item: PublishItem) => void;
  onDelete: (item: PublishItem) => void;
  disabled?: boolean;
};

const getStatusColor = (status: PublishItem['status']) => {
  switch (status) {
    case 'draft':
    case 'review':
      return 'bg-gray-100 text-gray-700';
    case 'approved':
    case 'ready':
      return 'bg-teal-100 text-teal-700';
    case 'scheduled':
      return 'bg-blue-100 text-blue-700';
    case 'published':
      return 'bg-green-100 text-green-700';
    case 'failed':
      return 'bg-red-100 text-red-700';
    case 'publishing':
      return 'bg-yellow-100 text-yellow-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const formatStatus = (status: PublishItem['status'], scheduledFor?: string | null) => {
  if (status === 'scheduled' && scheduledFor) {
    try {
      const date = new Date(scheduledFor);
      return `Scheduled (${format(date, 'MMM d, h:mm a')})`;
    } catch {
      return 'Scheduled';
    }
  }
  return status.charAt(0).toUpperCase() + status.slice(1);
};

export default function PostCard({ item, publishedAt, onEdit, onPublishNow, onSchedule, onDelete, disabled }: PostCardProps) {
  const [isDeleting, setIsDeleting] = React.useState(false);
  const PlatformIcon = item.platform === 'facebook' ? Facebook : Instagram;
  const platformColor = item.platform === 'facebook' ? 'text-blue-600' : 'text-pink-500';
  
  const canPublish = !disabled && ['approved', 'ready', 'draft', 'review'].includes(item.status);
  const canSchedule = !disabled && ['approved', 'ready', 'draft', 'review'].includes(item.status);

  const handleDelete = () => {
    setIsDeleting(true);
    // Delay the actual deletion to allow animation to complete
    setTimeout(() => {
      onDelete(item);
    }, 300);
  };

  return (
    <Card className={cn(
      "relative p-4 hover:shadow-md transition-all duration-300 transform-gpu",
      isDeleting && "animate-fade-out opacity-0 scale-95 pointer-events-none"
    )}>
      {/* Delete Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDelete}
        disabled={disabled || isDeleting}
        className="absolute top-2 right-2 w-8 h-8 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
      
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PlatformIcon className={cn("w-5 h-5", platformColor)} />
            <span className="font-medium capitalize">{item.platform}</span>
            {item.accountName && (
              <span className="text-sm text-gray-500">• {item.accountName}</span>
            )}
          </div>
        </div>

        {/* Content Preview */}
        <div className="space-y-3">
          {/* Image Thumbnail */}
          {item.mediaUrl && (
            <div className="w-full h-32 rounded-lg overflow-hidden bg-gray-100">
              <img 
                src={item.mediaUrl} 
                alt="Content preview"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Caption Preview */}
          <div>
            <p className="text-sm text-gray-600 line-clamp-3">
              {item.caption || "No caption"}
            </p>
          </div>

          {/* First Comment Preview (IG only) */}
          {item.firstComment && item.platform === 'instagram' && (
            <div className="border-l-2 border-gray-200 pl-3">
              <p className="text-xs text-gray-500 mb-1">First comment:</p>
              <p className="text-sm text-gray-600 line-clamp-2">{item.firstComment}</p>
            </div>
          )}

          {/* Published Date (Published posts only) */}
          {item.status === 'published' && publishedAt && (
            <div className="flex items-center gap-2 text-sm text-gray-500 bg-green-50 px-2 py-1 rounded">
              <Clock className="w-4 h-4" />
              <span>Published {format(new Date(publishedAt), 'MMM d, h:mm a')}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <ActionGroup className="w-full justify-center">
          <Button
            variant="ghost"
            onClick={() => onEdit(item)}
            disabled={disabled}
            className="flex-1 text-gray-600 hover:bg-white hover:text-gray-900 hover:shadow-sm"
          >
            <Edit3 className="w-4 h-4 mr-1" />
            Edit
          </Button>
          
          {canPublish && (
            <Button
              variant="success"
              onClick={() => onPublishNow(item)}
              disabled={!canPublish}
              className="flex-1"
            >
              <Send className="w-4 h-4 mr-1" />
              Publish
            </Button>
          )}
          
          {canSchedule && (
            <Button
              variant="soft-blue"
              onClick={() => onSchedule(item)}
              disabled={!canSchedule}
              className="flex-1"
            >
              <Clock className="w-4 h-4 mr-1" />
              Schedule
            </Button>
          )}
        </ActionGroup>
      </div>
    </Card>
  );
}