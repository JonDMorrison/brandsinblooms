
import { EnhancedAppleButton } from "@/components/ui/enhanced-apple-button";
import { BodyMedium, CaptionMedium } from "@/components/ui/typography";
import { ArrowRight, HelpCircle, CheckCircle, Sparkles } from "lucide-react";
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
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full">
            <Sparkles className="w-6 h-6 text-blue-600 animate-pulse" />
          </div>
          <div className="flex-1">
            <BodyMedium className="text-blue-900 font-semibold mb-1">
              AI is generating your content...
            </BodyMedium>
            <CaptionMedium className="text-blue-700">
              We're creating professional marketing content for your garden center. This usually takes 1-2 minutes.
            </CaptionMedium>
          </div>
        </div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl overflow-hidden">
        {/* Success Header */}
        <div className="bg-green-100/50 px-6 py-4 border-b border-green-200">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-green-500 rounded-full">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <BodyMedium className="text-green-900 font-semibold">
                🎉 All content reviewed and ready!
              </BodyMedium>
              <CaptionMedium className="text-green-700">
                Your content is now ready to publish
              </CaptionMedium>
            </div>
          </div>
        </div>

        {/* Content & Action */}
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1">
              <CaptionMedium className="text-green-800 mb-2">
                Move to the next step to share it with your audience.
              </CaptionMedium>
            </div>
            
            {onReviewContent && (
              <EnhancedAppleButton 
                variant="primary" 
                size="default"
                onClick={onReviewContent}
                className="bg-green-600 text-white hover:bg-green-700 shadow-sm"
                pulseOnHover={true}
              >
                Review Your Personalized Content
                <ArrowRight className="w-4 h-4 ml-2" />
              </EnhancedAppleButton>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl overflow-hidden">
      {/* Header Section */}
      <div className="bg-blue-100/50 px-6 py-4 border-b border-blue-200">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 bg-blue-500 rounded-full">
            <span className="text-white font-semibold text-sm">📝</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <BodyMedium className="text-blue-900 font-semibold">
                Review your generated content
              </BodyMedium>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="w-4 h-4 text-blue-600 hover:text-blue-800 transition-colors" />
                  </TooltipTrigger>
                  <TooltipContent className="bg-white border border-gray-200 shadow-lg">
                    <p>Click on any content piece to review, edit, and approve it for publishing</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>
      </div>

      {/* Content & Actions */}
      <div className="p-6">
        <div className="space-y-4">
          <CaptionMedium className="text-blue-800">
            Click any content piece below to review and customize it for your garden center.
          </CaptionMedium>
          
          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            {onReviewContent && (
              <EnhancedAppleButton 
                variant="primary" 
                size="default"
                onClick={onReviewContent}
                className="bg-blue-600 text-white hover:bg-blue-700 shadow-sm flex-1 sm:flex-none"
                pulseOnHover={true}
              >
                Review Your Personalized Content
                <ArrowRight className="w-4 h-4 ml-2" />
              </EnhancedAppleButton>
            )}
            
            {onQuickApprove && (
              <EnhancedAppleButton 
                variant="secondary" 
                size="default"
                onClick={onQuickApprove}
                className="bg-white text-blue-700 border-blue-300 hover:bg-blue-50 shadow-sm"
              >
                Approve All
              </EnhancedAppleButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
