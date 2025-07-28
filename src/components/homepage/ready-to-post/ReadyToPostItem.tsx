
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, ExternalLink, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getPostTypeIcon, getPostTypeColor } from "./postTypeUtils";
import { stripHtmlAndFormat } from "./contentUtils";

interface ReadyToPostItemProps {
  task: any;
  onClick: (task: any) => void;
  onEdit?: (task: any, editMode: boolean) => void;
}

export const ReadyToPostItem = ({ task, onClick, onEdit }: ReadyToPostItemProps) => {
  const { toast } = useToast();
  
  const handleCopyContent = (content: string, postType: string) => {
    const isNewsletter = postType === 'newsletter';
    const cleanContent = stripHtmlAndFormat(content, isNewsletter);
    navigator.clipboard.writeText(cleanContent);
    toast({
      title: "Success",
      description: `${postType} content copied to clipboard`,
    });
  };
  
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) onEdit(task, true);
    else onClick(task); // Fallback to regular click if onEdit not provided
  };

  const getTaskImageUrl = (task: any) => {
    return task.attachments?.[0]?.url || task.image_url || null;
  };

  const PostIcon = getPostTypeIcon(task.post_type);
  const imageUrl = getTaskImageUrl(task);

  return (
    <div
      key={task.id}
      className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
      onClick={() => onClick(task)}
    >
      <div className="flex items-center justify-between mb-3">
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
              toast({
                title: "Coming Soon",
                description: 'Post publishing integration coming soon',
              });
            }}
            className="h-7 w-7 p-0"
          >
            <ExternalLink className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* 2-column grid layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left column - Text content (2/3 width) */}
        <div className="md:col-span-2 space-y-2">
          {task.ai_output && (
            <p className="text-sm text-gray-700 line-clamp-2">
              {stripHtmlAndFormat(task.ai_output, task.post_type === 'newsletter')}
            </p>
          )}
          
          {task.scheduled_date && (
            <p className="text-xs text-gray-500">
              Scheduled: {new Date(task.scheduled_date).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Right column - Image (1/3 width) */}
        <div className="md:col-span-1">
          {imageUrl ? (
            <img 
              src={imageUrl} 
              alt="Content image"
              className="w-full h-20 object-cover rounded-lg"
            />
          ) : (
            <div className="w-full h-20 bg-gray-100 rounded-lg flex items-center justify-center">
              <span className="text-xs text-gray-400">No image</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
