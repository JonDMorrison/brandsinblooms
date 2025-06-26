
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, MoreHorizontal } from 'lucide-react';
import { getPostTypeIcon } from '../ContentViewerUtils';
import { getStatusBadgeVariant, getStatusLabel } from '@/utils/badgeUtils';

interface ContentHeaderProps {
  task: any;
  onTaskUpdate?: () => void;
  compact?: boolean;
}

export const ContentHeader = ({ task, onTaskUpdate, compact }: ContentHeaderProps) => {
  const PostIcon = getPostTypeIcon(task.post_type);
  
  const handleEdit = () => {
    // This will be handled by parent component
    console.log('Edit task:', task.id);
  };

  return (
    <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-gray-700">
          <PostIcon className="w-4 h-4" />
          <span className="font-medium capitalize text-sm">{task.post_type}</span>
        </div>
        
        <Badge variant={getStatusBadgeVariant(task.status)} className="text-xs">
          {getStatusLabel(task.status)}
        </Badge>

        {task.platform_post_url && (
          <Badge variant="outline" className="text-green-600 border-green-200 text-xs">
            Published
          </Badge>
        )}
      </div>

      {!compact && (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleEdit}
            className="h-8 w-8 p-0"
          >
            <Edit className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
          >
            <MoreHorizontal className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
};
