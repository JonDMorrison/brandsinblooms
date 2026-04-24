import React from 'react';
import { Card } from '@/components/ui-legacy/card';
import { Calendar, MessageSquare, Image } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface SessionDividerProps {
  sessionTitle: string | null;
  contextType: string | null;
  channel: string | null;
  createdAt: string;
  messageCount?: number;
  imageCount?: number;
}

export const AISessionDivider: React.FC<SessionDividerProps> = ({
  sessionTitle,
  contextType,
  channel,
  createdAt,
  messageCount,
  imageCount
}) => {
  const displayTitle = sessionTitle || 'Untitled Conversation';
  const contextLabel = contextType === 'email_block' ? 'Email Block' : 
                       contextType === 'campaign_header' ? 'Campaign Header' : 
                       'General';
  
  return (
    <Card className="my-4 p-3 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 dark:from-purple-950/30 dark:to-blue-950/30 dark:border-purple-800">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h4 className="font-semibold text-sm text-gray-800 dark:text-gray-200 mb-1">
            {displayTitle}
          </h4>
          <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
            </span>
            <span className="px-2 py-0.5 bg-white dark:bg-gray-800 rounded-full">
              {contextLabel}
            </span>
            {channel && (
              <span className="px-2 py-0.5 bg-white dark:bg-gray-800 rounded-full capitalize">
                {channel}
              </span>
            )}
          </div>
        </div>
        
        {(messageCount || imageCount) && (
          <div className="flex items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
            {messageCount && (
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {messageCount}
              </span>
            )}
            {imageCount && (
              <span className="flex items-center gap-1">
                <Image className="w-3 h-3" />
                {imageCount}
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};
