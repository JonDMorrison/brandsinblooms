// src/components/publish/PostCard.tsx
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ActionGroup } from '@/components/ui/action-group';
import { Badge } from '@/components/ui/badge';
import { Facebook, Instagram, Clock, Send, Edit3, Trash2, Heart, MessageCircle, Bookmark, MoreHorizontal } from 'lucide-react';
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
  
  const canPublish = !disabled && ['approved', 'ready', 'draft', 'review', 'planned'].includes(item.status);
  const canSchedule = !disabled && ['approved', 'ready', 'draft', 'review', 'planned'].includes(item.status);

  const handleDelete = () => {
    setIsDeleting(true);
    // Delay the actual deletion to allow animation to complete
    setTimeout(() => {
      onDelete(item);
    }, 300);
  };

  // Instagram native layout
  if (item.platform === 'instagram') {
    return (
      <Card className={cn(
        "relative hover:shadow-md transition-all duration-300 transform-gpu w-full max-w-[80%] mx-auto overflow-hidden",
        "min-h-[600px]",
        isDeleting && "animate-fade-out opacity-0 scale-95 pointer-events-none"
      )}>
        {/* Instagram Header */}
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[2px]">
              <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                <Instagram className="w-4 h-4 text-pink-500" />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">{item.accountName || 'Your Account'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={disabled || isDeleting}
              className="w-8 h-8 p-0 text-gray-400 hover:text-red-500"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <MoreHorizontal className="w-5 h-5 text-gray-700" />
          </div>
        </div>

        {/* Instagram Image - Square aspect ratio */}
        {item.mediaUrl && (
          <div className="w-full aspect-square bg-gray-100">
            <img 
              src={item.mediaUrl} 
              alt="Instagram post"
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Instagram Actions */}
        <div className="px-3 pt-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <Heart className="w-6 h-6" />
              <MessageCircle className="w-6 h-6" />
              <Send className="w-6 h-6" />
            </div>
            <Bookmark className="w-6 h-6" />
          </div>

          {/* Status Badge */}
          <Badge className={cn("mb-2", getStatusColor(item.status))}>
            {formatStatus(item.status, item.scheduledFor)}
          </Badge>

          {/* Caption */}
          <div className="mb-2">
            <span className="font-semibold text-sm mr-2">{item.accountName || 'Your Account'}</span>
            <span className="text-sm">{item.caption || "No caption"}</span>
          </div>

          {/* First Comment */}
          {item.firstComment && (
            <div className="text-sm text-gray-500 mb-2">
              <span className="font-semibold text-gray-700 mr-2">{item.accountName || 'Your Account'}</span>
              {item.firstComment}
            </div>
          )}

          {/* Published Date */}
          {item.status === 'published' && publishedAt && (
            <div className="text-xs text-gray-500 mb-3">
              {format(new Date(publishedAt), 'MMMM d, yyyy')}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="px-3 pb-3 pt-2 border-t">
          <div className="flex items-center justify-between w-full gap-2">
            <button
              onClick={() => onEdit(item)}
              disabled={disabled}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
              title="Edit"
            >
              <Edit3 className="w-6 h-6" />
              <span className="text-xs font-medium">Edit</span>
            </button>
            
            {canPublish && (
              <button
                onClick={() => onPublishNow(item)}
                disabled={!canPublish}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                title="Publish Now"
              >
                <Send className="w-6 h-6" />
                <span className="text-xs font-medium">Publish</span>
              </button>
            )}
            
            {canSchedule && (
              <button
                onClick={() => onSchedule(item)}
                disabled={!canSchedule}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                title="Schedule"
              >
                <Clock className="w-6 h-6" />
                <span className="text-xs font-medium">Schedule</span>
              </button>
            )}
          </div>
        </div>
      </Card>
    );
  }

  // Facebook native layout
  if (item.platform === 'facebook') {
    return (
      <Card className={cn(
        "relative hover:shadow-md transition-all duration-300 transform-gpu w-full max-w-[80%] mx-auto overflow-hidden",
        "min-h-[600px] bg-white",
        isDeleting && "animate-fade-out opacity-0 scale-95 pointer-events-none"
      )}>
        {/* Facebook Header */}
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
              <Facebook className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-gray-900">{item.accountName || 'Your Page'}</span>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                {item.status === 'scheduled' && item.scheduledFor ? (
                  <>
                    <span>{format(new Date(item.scheduledFor), 'MMMM d')} at {format(new Date(item.scheduledFor), 'h:mm a')}</span>
                    <span>• 🌍</span>
                  </>
                ) : item.status === 'published' && publishedAt ? (
                  <>
                    <span>{format(new Date(publishedAt), 'MMMM d')} at {format(new Date(publishedAt), 'h:mm a')}</span>
                    <span>• 🌍</span>
                  </>
                ) : (
                  <span>Just now • 🌍</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={disabled || isDeleting}
              className="w-8 h-8 p-0 text-gray-400 hover:text-red-500"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <MoreHorizontal className="w-5 h-5 text-gray-600" />
          </div>
        </div>

        {/* Status Badge */}
        <div className="px-4 pb-2">
          <Badge className={cn("text-xs", getStatusColor(item.status))}>
            {formatStatus(item.status, item.scheduledFor)}
          </Badge>
        </div>

        {/* Caption */}
        {item.caption && (
          <div className="px-4 pb-3">
            <p className="text-sm text-gray-900 whitespace-pre-wrap">{item.caption}</p>
          </div>
        )}

        {/* Facebook Image - Full width, no padding */}
        {item.mediaUrl && (
          <div className="w-full bg-gray-100">
            <img 
              src={item.mediaUrl} 
              alt="Facebook post"
              className="w-full h-auto object-cover"
            />
          </div>
        )}

        {/* Engagement Bar */}
        <div className="px-4 py-2 flex items-center justify-between text-xs text-gray-500 border-b">
          <div className="flex items-center gap-1">
            <div className="flex -space-x-1">
              <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                <Heart className="w-2.5 h-2.5 text-white fill-white" />
              </div>
            </div>
            <span>0</span>
          </div>
          <div className="flex items-center gap-3">
            <span>0 comments</span>
            <span>0 shares</span>
          </div>
        </div>

        {/* Published Date */}
        {item.status === 'published' && publishedAt && (
          <div className="px-4 py-2 text-xs text-gray-500 bg-gray-50">
            Published {format(new Date(publishedAt), 'MMMM d, yyyy')}
          </div>
        )}

        {/* Action Buttons - Facebook style */}
        <div className="px-4 py-2 border-t">
          <div className="flex items-center justify-between w-full gap-2">
            <button
              onClick={() => onEdit(item)}
              disabled={disabled}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              title="Edit"
            >
              <Edit3 className="w-6 h-6" />
              <span className="text-xs font-medium">Edit</span>
            </button>
            
            {canPublish && (
              <button
                onClick={() => onPublishNow(item)}
                disabled={!canPublish}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                title="Publish Now"
              >
                <Send className="w-6 h-6" />
                <span className="text-xs font-medium">Publish</span>
              </button>
            )}
            
            {canSchedule && (
              <button
                onClick={() => onSchedule(item)}
                disabled={!canSchedule}
                className="flex-1 flex flex-col items-center justify-center gap-1 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                title="Schedule"
              >
                <Clock className="w-6 h-6" />
                <span className="text-xs font-medium">Schedule</span>
              </button>
            )}
          </div>
        </div>
      </Card>
    );
  }

  // Default fallback layout
  return (
    <Card className={cn(
      "relative p-4 hover:shadow-md transition-all duration-300 transform-gpu w-full max-w-[80%] mx-auto",
      "min-h-[500px]",
      isDeleting && "animate-fade-out opacity-0 scale-95 pointer-events-none"
    )}>
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PlatformIcon className={cn("w-5 h-5", platformColor)} />
            <span className="font-medium capitalize">{item.platform}</span>
            {item.accountName && (
              <span className="text-sm text-gray-500">• {item.accountName}</span>
            )}
          </div>
          <Badge className={getStatusColor(item.status)}>
            {formatStatus(item.status, item.scheduledFor)}
          </Badge>
        </div>

        <div className="space-y-3">
          {item.mediaUrl && (
            <div className="w-full h-64 rounded-lg overflow-hidden bg-gray-100">
              <img 
                src={item.mediaUrl} 
                alt="Content preview"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div>
            <p className="text-sm text-gray-600 line-clamp-4">
              {item.caption || "No caption"}
            </p>
          </div>

          {item.status === 'published' && publishedAt && (
            <div className="flex items-center gap-2 text-sm text-gray-500 bg-green-50 px-2 py-1 rounded">
              <Clock className="w-4 h-4" />
              <span>Published {format(new Date(publishedAt), 'MMM d, h:mm a')}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between w-full gap-2 pt-2 border-t">
          <button
            onClick={() => onEdit(item)}
            disabled={disabled}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
            title="Edit"
          >
            <Edit3 className="w-6 h-6" />
            <span className="text-xs font-medium">Edit</span>
          </button>
          
          {canPublish && (
            <button
              onClick={() => onPublishNow(item)}
              disabled={!canPublish}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
              title="Publish Now"
            >
              <Send className="w-6 h-6" />
              <span className="text-xs font-medium">Publish</span>
            </button>
          )}
          
          {canSchedule && (
            <button
              onClick={() => onSchedule(item)}
              disabled={!canSchedule}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
              title="Schedule"
            >
              <Clock className="w-6 h-6" />
              <span className="text-xs font-medium">Schedule</span>
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}