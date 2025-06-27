
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PublishStatusPillProps {
  status: 'QUEUED' | 'PUBLISHED' | 'ERROR';
  platform: string;
  publishTime: string;
  error?: string;
}

export const PublishStatusPill = ({ status, platform, publishTime, error }: PublishStatusPillProps) => {
  const getPlatformColor = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'facebook':
      case 'fb':
        return 'bg-blue-500';
      case 'instagram':
      case 'instagram_feed':
      case 'ig_feed':
        return 'bg-purple-500';
      case 'instagram_reel':
      case 'ig_reel':
        return 'bg-pink-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'QUEUED':
        return <Clock className="w-3 h-3" />;
      case 'PUBLISHED':
        return <CheckCircle className="w-3 h-3" />;
      case 'ERROR':
        return <AlertCircle className="w-3 h-3" />;
      default:
        return <Loader2 className="w-3 h-3 animate-spin" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'QUEUED':
        return 'border-yellow-400 bg-yellow-50';
      case 'PUBLISHED':
        return 'border-green-400 bg-green-50';
      case 'ERROR':
        return 'border-red-400 bg-red-50';
      default:
        return 'border-gray-400 bg-gray-50';
    }
  };

  return (
    <div className={cn(
      "flex items-center gap-2 p-2 rounded-lg border-2 transition-all duration-200",
      getStatusColor()
    )}>
      <div className={cn(
        "w-3 h-3 rounded-full flex-shrink-0",
        getPlatformColor(platform)
      )} />
      
      <div className="flex items-center gap-1 min-w-0">
        {getStatusIcon()}
        <span className="text-xs font-medium capitalize truncate">
          {platform.replace('_', ' ')}
        </span>
      </div>
      
      <div className="text-xs text-gray-600">
        {new Date(publishTime).toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        })}
      </div>
      
      {status === 'PUBLISHED' && (
        <Badge variant="outline" className="text-green-700 bg-green-100 text-xs">
          Posted ✓
        </Badge>
      )}
      
      {status === 'ERROR' && error && (
        <Badge variant="outline" className="text-red-700 bg-red-100 text-xs">
          Failed
        </Badge>
      )}
    </div>
  );
};
