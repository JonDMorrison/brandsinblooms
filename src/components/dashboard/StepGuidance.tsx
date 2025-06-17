
import { EnhancedAppleButton } from "@/components/ui/enhanced-apple-button";
import { BodyMedium, CaptionMedium } from "@/components/ui/typography";
import { ArrowRight, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface StepGuidanceProps {
  isComplete: boolean;
  hasContent: boolean;
  onQuickApprove?: () => void;
  onReviewContent?: () => void;
}

export const StepGuidance = ({ isComplete, hasContent, onQuickApprove, onReviewContent }: StepGuidanceProps) => {
  if (!hasContent) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <BodyMedium className="text-blue-800 font-medium">
            AI is generating your content...
          </BodyMedium>
        </div>
        <CaptionMedium className="text-blue-700">
          We're creating professional marketing content for your garden center. This usually takes 1-2 minutes.
        </CaptionMedium>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <BodyMedium className="text-green-800 font-medium mb-1">
              🎉 All content reviewed and ready!
            </BodyMedium>
            <CaptionMedium className="text-green-700">
              Your content is now ready to publish. Move to the next step to share it with your audience.
            </CaptionMedium>
          </div>
          {onReviewContent && (
            <EnhancedAppleButton 
              variant="secondary" 
              size="sm"
              onClick={onReviewContent}
              className="bg-green-100 text-green-800 border-green-200 hover:bg-green-200"
            >
              Review Your Personalized Content
              <ArrowRight className="w-4 h-4 ml-1" />
            </EnhancedAppleButton>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <BodyMedium className="text-blue-800 font-medium">
              📝 Review your generated content
            </BodyMedium>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="w-4 h-4 text-blue-600" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Click on any content piece to review, edit, and approve it for publishing</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <CaptionMedium className="text-blue-700">
            Click any content piece below to review and customize it for your garden center.
          </CaptionMedium>
        </div>
        <div className="flex gap-2">
          {onReviewContent && (
            <EnhancedAppleButton 
              variant="secondary" 
              size="sm"
              onClick={onReviewContent}
              className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200"
            >
              Review Your Personalized Content
            </EnhancedAppleButton>
          )}
          {onQuickApprove && (
            <EnhancedAppleButton 
              variant="secondary" 
              size="sm"
              onClick={onQuickApprove}
              className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200"
            >
              Approve All
            </EnhancedAppleButton>
          )}
        </div>
      </div>
    </div>
  );
};
