
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle } from "lucide-react";
import { getPostTypeIcon } from "@/components/homepage/ready-to-post/postTypeUtils";

interface ReviewQueueItemProps {
  task: any;
  onApprove: (taskId: string, event: React.MouseEvent) => void;
  onClick: (task: any) => void;
  isApproving: boolean;
}

export const ReviewQueueItem = ({ task, onApprove, onClick, isApproving }: ReviewQueueItemProps) => {
  const stripHtmlAndFormat = (content: string) => {
    if (!content) return '';
    return content
      .replace(/<[^>]*>/g, '')
      .replace(/\\n/g, ' ')
      .trim();
  };

  return (
    <div
      key={task.id}
      className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
      onClick={() => onClick(task)}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {getPostTypeIcon(task.post_type)}
          <Badge className="bg-orange-100 text-orange-800">
            {task.post_type}
          </Badge>
          {task.campaigns?.title && (
            <span className="text-sm text-gray-600">
              {task.campaigns.title}
            </span>
          )}
        </div>
        <Button
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white"
          onClick={(e) => onApprove(task.id, e)}
          disabled={isApproving}
        >
          <CheckCircle className="w-3 h-3 mr-1" />
          {isApproving ? 'Approving...' : 'Approve'}
        </Button>
      </div>
      
      <p className="text-sm text-gray-700 line-clamp-2">
        {stripHtmlAndFormat(task.ai_output)}
      </p>
    </div>
  );
};
