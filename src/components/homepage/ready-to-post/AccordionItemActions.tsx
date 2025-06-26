
import React from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EnhancedPostNowButton } from "./EnhancedPostNowButton";

interface AccordionItemActionsProps {
  task: any;
  onViewFull: (task: any) => void;
  onTaskUpdate?: () => void;
  socialConnections?: any[];
  batchMode?: boolean;
}

export const AccordionItemActions: React.FC<AccordionItemActionsProps> = ({
  task,
  onViewFull,
  onTaskUpdate,
  socialConnections = [],
  batchMode = false
}) => {
  const facebookConnection = socialConnections.find(conn => conn.platform === 'facebook');
  const instagramConnection = socialConnections.find(conn => conn.platform === 'instagram');

  return (
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
  );
};
