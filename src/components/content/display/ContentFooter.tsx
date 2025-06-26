
import React from 'react';
import { Calendar, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ContentFooterProps {
  task: any;
}

export const ContentFooter = ({ task }: ContentFooterProps) => {
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (error) {
      return '';
    }
  };

  const campaignTitle = task.campaigns?.title || task.holidays?.holiday_name || 'Content';
  const createdDate = formatDate(task.created_at);
  const scheduledDate = task.scheduled_date ? formatDate(task.scheduled_date) : null;

  return (
    <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-4">
          <span className="font-medium text-gray-700 truncate max-w-32">
            {campaignTitle}
          </span>
          
          {createdDate && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {createdDate}
            </span>
          )}
        </div>
        
        {scheduledDate && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Scheduled {scheduledDate}
          </span>
        )}
      </div>
    </div>
  );
};
