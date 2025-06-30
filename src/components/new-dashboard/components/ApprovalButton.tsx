
import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApprovalButtonProps {
  selectedDraft: any;
  editContent: string;
  socialConnections: any[];
  hasValidImage: boolean;
  postWithoutImage: boolean;
  approving: boolean;
  saving: boolean;
  onApprove: () => void;
}

export const ApprovalButton = ({
  selectedDraft,
  editContent,
  socialConnections,
  hasValidImage,
  postWithoutImage,
  approving,
  saving,
  onApprove
}: ApprovalButtonProps) => {
  const isInstagram = selectedDraft?.post_type?.toLowerCase().includes('instagram');

  const getApprovalButtonStatus = () => {
    const issues = [];
    
    if (!selectedDraft) {
      issues.push("No draft selected - choose a draft from the tray first");
    }
    
    if (selectedDraft && !editContent.trim()) {
      issues.push("Content is empty - add some text first");
    }
    
    if (socialConnections.length === 0) {
      issues.push("No social media accounts connected - connect Instagram or Facebook first");
    }
    
    if (selectedDraft && isInstagram && !hasValidImage) {
      issues.push("Instagram posts require an image - select one from the gallery");
    }
    
    if (selectedDraft && selectedDraft.post_type?.toLowerCase() === 'facebook' && !hasValidImage && !postWithoutImage) {
      issues.push("Facebook posts need an image OR check 'Post without an image'");
    }
    
    const isDisabled = issues.length > 0 || saving || approving;
    
    return {
      isDisabled,
      issues,
      tooltipContent: issues.length > 0 ? (
        <div className="space-y-2">
          <div className="font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Requirements not met:
          </div>
          <ul className="space-y-1">
            {issues.map((issue, index) => (
              <li key={index} className="text-sm flex items-start gap-2">
                <span className="text-orange-400 mt-0.5">•</span>
                {issue}
              </li>
            ))}
          </ul>
        </div>
      ) : null
    };
  };

  const approvalStatus = getApprovalButtonStatus();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button 
          className={cn(
            "flex-1 relative",
            approvalStatus.isDisabled 
              ? "bg-gray-300 hover:bg-gray-300 text-gray-500 cursor-not-allowed" 
              : "bg-[#68BEB9] hover:bg-[#56a7a1]"
          )}
          onClick={onApprove}
          disabled={approvalStatus.isDisabled}
        >
          {approvalStatus.isDisabled && approvalStatus.issues.length > 0 && (
            <AlertCircle className="w-4 h-4 mr-2 text-orange-500" />
          )}
          {!approvalStatus.isDisabled && (
            <CheckCircle className="w-4 h-4 mr-2" />
          )}
          {approving ? 'Approving...' : 'Approve Content'}
        </Button>
      </TooltipTrigger>
      {approvalStatus.tooltipContent && (
        <TooltipContent side="top" className="max-w-sm">
          {approvalStatus.tooltipContent}
        </TooltipContent>
      )}
      {!approvalStatus.isDisabled && (
        <TooltipContent side="top" className="max-w-xs">
          <div className="text-sm">
            This will approve your content and make it ready for drag-and-drop scheduling
          </div>
        </TooltipContent>
      )}
    </Tooltip>
  );
};
