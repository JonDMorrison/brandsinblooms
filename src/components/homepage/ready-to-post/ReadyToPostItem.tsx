
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, Edit } from "lucide-react";
import { toast } from "sonner";
import { getPostTypeIcon, getPostTypeColor } from "./postTypeUtils";
import { stripHtmlAndFormat } from "./contentUtils";

interface ReadyToPostItemProps {
  task: any;
  onClick: (task: any) => void;
  onEdit?: (task: any, editMode: boolean) => void;
}

export const ReadyToPostItem = ({ task, onClick, onEdit }: ReadyToPostItemProps) => {
  const handleCopyContent = (content: string, postType: string) => {
    const cleanContent = stripHtmlAndFormat(content);
    navigator.clipboard.writeText(cleanContent);
    toast.success(`${postType} content copied to clipboard`);
  };
  
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) onEdit(task, true);
    else onClick(task); // Fallback to regular click if onEdit not provided
  };

  const PostIcon = getPostTypeIcon(task.post_type);

  return (
    <div
      key={task.id}
      className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
      onClick={() => onClick(task)}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <PostIcon className="w-5 h-5" />
          <Badge className={getPostTypeColor(task.post_type)}>
            {task.post_type}
          </Badge>
          <Badge className="bg-green-100 text-green-800">
            ✅ Ready
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleEdit}
            className="h-7 px-2"
          >
            <Edit className="w-3 h-3 mr-1" />
            Edit
          </Button>
          
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              handleCopyContent(task.ai_output, task.post_type);
            }}
            className="h-7 w-7 p-0"
          >
            <Copy className="w-3 h-3" />
          </Button>
          
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              toast.info('Post publishing integration coming soon');
            }}
            className="h-7 w-7 p-0"
          >
            <ExternalLink className="w-3 h-3" />
          </Button>
        </div>
      </div>
      
      {task.ai_output && (
        <p className="text-sm text-gray-700 line-clamp-2 mb-2">
          {stripHtmlAndFormat(task.ai_output)}
        </p>
      )}
      
      {task.scheduled_date && (
        <p className="text-xs text-gray-500">
          Scheduled: {new Date(task.scheduled_date).toLocaleDateString()}
        </p>
      )}
    </div>
  );
};
