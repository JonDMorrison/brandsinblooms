
import React from "react";
import { ChevronDown, ChevronRight, Clock } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { getPostTypeIcon, getPostTypeColor } from "./postTypeUtils";
import { getStatusColor } from "../homepageUtils";
import { formatDistanceToNow } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";

interface AccordionItemHeaderProps {
  task: any;
  isOpen: boolean;
  batchMode?: boolean;
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
  postLabel: string;
  campaignTitle: string;
  preview: string;
}

export const AccordionItemHeader: React.FC<AccordionItemHeaderProps> = ({
  task,
  isOpen,
  batchMode = false,
  isSelected = false,
  onSelect,
  postLabel,
  campaignTitle,
  preview
}) => {
  const isMobile = useIsMobile();
  const PostIcon = getPostTypeIcon(task.post_type);
  const colorClass = getPostTypeColor(task.post_type);

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (error) {
      return '';
    }
  };

  const formattedDate = formatDate(task.created_at);

  return (
    <div className={`
      p-4 cursor-pointer transition-colors duration-200
      ${isMobile ? 'p-3' : 'p-4'}
    `}>
      <div className="flex items-center gap-3">
        {batchMode && (
          <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => onSelect?.(checked as boolean)}
              className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
            />
          </div>
        )}
        
        <div className={`
          flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center
          ${colorClass}
        `}>
          <PostIcon className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className={`font-semibold text-gray-900 truncate ${isMobile ? 'text-sm' : 'text-base'}`}>
              {postLabel}
            </h3>
            <Badge className={getStatusColor(task.status)}>
              {task.status}
            </Badge>
            {task.platform_post_url && (
              <Badge variant="outline" className="text-green-600 border-green-200">
                Published
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="truncate max-w-32">{campaignTitle}</span>
            {formattedDate && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formattedDate}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isOpen && preview && (
            <div className={`text-gray-600 truncate max-w-24 ${isMobile ? 'text-xs' : 'text-sm'}`}>
              {preview.substring(0, 30)}...
            </div>
          )}
          
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>
    </div>
  );
};
