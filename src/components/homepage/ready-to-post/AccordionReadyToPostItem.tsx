
import React, { useState } from "react";
import { ChevronDown, ChevronRight, Calendar, Clock, Eye } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { getPostTypeIcon, getPostTypeColor } from "./postTypeUtils";
import { getStatusColor } from "../homepageUtils";
import { formatDistanceToNow } from "date-fns";
import { EnhancedPostNowButton } from "./EnhancedPostNowButton";
import { useIsMobile } from "@/hooks/use-mobile";

interface AccordionReadyToPostItemProps {
  task: any;
  onViewFull: (task: any) => void;
  onTaskUpdate?: () => void;
  isFirst?: boolean;
  socialConnections?: any[];
  batchMode?: boolean;
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
}

const getPostTypeLabel = (postType: string) => {
  switch (postType) {
    case 'instagram': return 'Instagram Post';
    case 'facebook': return 'Facebook Post';
    case 'email': return 'Email';
    case 'newsletter': return 'Newsletter';
    case 'video': return 'Video';
    default: return 'Content';
  }
};

export const AccordionReadyToPostItem: React.FC<AccordionReadyToPostItemProps> = ({
  task,
  onViewFull,
  onTaskUpdate,
  isFirst = false,
  socialConnections = [],
  batchMode = false,
  isSelected = false,
  onSelect
}) => {
  const [isOpen, setIsOpen] = useState(isFirst);
  const isMobile = useIsMobile();

  const PostIcon = getPostTypeIcon(task.post_type);
  const postLabel = getPostTypeLabel(task.post_type);
  const colorClass = getPostTypeColor(task.post_type);

  const cleanContent = task.ai_output ? 
    task.ai_output.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : '';

  const preview = cleanContent.length > 120 ? 
    cleanContent.substring(0, 120) + '...' : cleanContent;

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (error) {
      return '';
    }
  };

  const campaignTitle = task.campaigns?.title || task.holidays?.holiday_name || 'Content';
  const formattedDate = formatDate(task.created_at);

  const facebookConnection = socialConnections.find(conn => conn.platform === 'facebook');
  const instagramConnection = socialConnections.find(conn => conn.platform === 'instagram');

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className={`
        border rounded-xl transition-all duration-150 mb-3 card-interactive
        ${isOpen ? 'border-brand-teal shadow-md bg-white' : 'border-gray-200 hover:border-brand-teal/50 hover:shadow-sm'}
        ${batchMode && isSelected ? 'ring-2 ring-brand-blue/20 bg-brand-blue/5' : ''}
      `}>
        <CollapsibleTrigger asChild>
          <div className={`
            p-4 cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2
            ${isMobile ? 'p-3' : 'p-4'}
          `}>
            <div className="flex items-center gap-3">
              {batchMode && (
                <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => onSelect?.(checked as boolean)}
                      className="data-[state=checked]:bg-brand-blue data-[state=checked]:border-brand-blue focus-visible:ring-brand-teal"
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
                  <h3 className={`font-semibold text-brand-navy tracking-tight truncate ${isMobile ? 'text-sm' : 'text-base'}`}>
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
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 border-t border-gray-100">
            <div className="pt-4 space-y-4">
              {/* Content Preview */}
              {cleanContent && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <div 
                    className={`text-gray-700 line-clamp-4 ${isMobile ? 'text-sm' : 'text-base'}`}
                    dangerouslySetInnerHTML={{ __html: task.ai_output }}
                  />
                </div>
              )}

              {/* Error Message */}
              {task.last_posting_error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-600">{task.last_posting_error}</p>
                  {task.posting_attempts > 0 && (
                    <p className="text-xs text-red-500 mt-1">
                      Failed {task.posting_attempts} time{task.posting_attempts !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onViewFull(task)}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Full Content
                </Button>

                {!batchMode && (
                  <div className="flex gap-2">
                    {facebookConnection && (
                      <EnhancedPostNowButton
                        task={task}
                        platform="facebook"
                        onSuccess={onTaskUpdate}
                        socialConnections={socialConnections}
                      />
                    )}
                    {instagramConnection && (
                      <EnhancedPostNowButton
                        task={task}
                        platform="instagram"
                        onSuccess={onTaskUpdate}
                        socialConnections={socialConnections}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};
