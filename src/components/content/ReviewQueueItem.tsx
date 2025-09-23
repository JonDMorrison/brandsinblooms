
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Eye, Calendar, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ContentTask } from "@/types/content";
import { useAuth } from "@/contexts/AuthContext";
import { DevPreviewBadge } from "@/components/ui/dev-preview-badge";

interface ReviewQueueItemProps {
  task: ContentTask;
  onApprove: (taskId: string, event: React.MouseEvent) => void;
  onClick: (task: ContentTask) => void;
  isApproving: boolean;
  onTaskUpdate?: () => void;
}

export const ReviewQueueItem = ({ 
  task, 
  onApprove, 
  onClick, 
  isApproving,
  onTaskUpdate 
}: ReviewQueueItemProps) => {
  const { user } = useAuth();
  const isDeveloper = user?.email === 'jon@getclear.ca';
  const isPreviewTask = task.status === 'preview';

  const getPostTypeIcon = (postType: string) => {
    switch (postType) {
      case 'newsletter':
        return '📧';
      case 'instagram':
        return '📸';
      case 'facebook':
        return '👥';
      case 'video':
        return '🎥';
      case 'blog':
        return '📝';
      default:
        return '📄';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'preview':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'review':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'generated':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const truncateContent = (content: string, maxLength: number = 120) => {
    if (!content) return '';
    return content.length > maxLength ? content.substring(0, maxLength) + '...' : content;
  };

  return (
    <div 
      className={`
        group border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-all duration-200
        ${isPreviewTask && isDeveloper ? 'border-2 border-dashed border-blue-300 bg-blue-50/30' : 'border-gray-200'}
      `}
      onClick={() => onClick(task)}
      data-status={task.status}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{getPostTypeIcon(task.post_type || '')}</span>
            <span className="font-medium text-gray-900 capitalize">
              {task.post_type || 'Content'}
            </span>
            <Badge className={getStatusColor(task.status)}>
              {task.status}
            </Badge>
            <DevPreviewBadge show={isPreviewTask && isDeveloper} size="sm" />
            {task.scheduled_date && (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Calendar className="w-3 h-3" />
                <span>{new Date(task.scheduled_date).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {task.ai_output && (
            <div className="mb-2">
              <p className="text-sm text-gray-700 line-clamp-2">
                {truncateContent(task.ai_output)}
              </p>
            </div>
          )}

          <div className="flex items-center gap-4 text-xs text-gray-500">
            {task.campaigns && (
              <span className="flex items-center gap-1">
                <FileText className="w-3 h-3" />
                {task.campaigns.title}
              </span>
            )}
            <span>
              {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              console.log('👁️ Review button clicked for task:', task.id, task.post_type);
              onClick(task);
            }}
            className="border-gray-300 text-gray-600 hover:bg-gray-100"
          >
            <Eye className="w-3 h-3 mr-1" />
            Review
          </Button>
          
          {!isPreviewTask && (
            <Button
              size="sm"
              onClick={(e) => {
                console.log('✅ Approve button clicked for task:', task.id, task.post_type);
                onApprove(task.id, e);
              }}
              disabled={isApproving}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle2 className="w-3 h-3 mr-1" />
              {isApproving ? 'Approving...' : 'Approve'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
