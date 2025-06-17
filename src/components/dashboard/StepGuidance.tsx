
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
    return onReviewContent ? (
      <EnhancedAppleButton 
        variant="primary" 
        size="default"
        onClick={onReviewContent}
        className="bg-green-600 text-white hover:bg-green-700 shadow-lg px-8 py-3"
        pulseOnHover={true}
      >
        Review Your Personalized Content
        <ArrowRight className="w-4 h-4 ml-2" />
      </EnhancedAppleButton>
    ) : null;
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6">
      {/* Visual Indicator */}
      <div className="flex items-center justify-center mb-6">
        <div className="flex items-center justify-center w-16 h-16 bg-blue-500 rounded-full shadow-lg">
          <span className="text-white font-semibold text-xl">📝</span>
        </div>
      </div>

      {/* Content */}
      <div className="text-center space-y-3 mb-6">
        <div className="flex items-center justify-center gap-2">
          <BodyMedium className="text-blue-900 font-bold text-lg">
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
        <CaptionMedium className="text-blue-800 max-w-md mx-auto">
          Click any content piece below to review and customize it for your garden center.
        </CaptionMedium>
      </div>
      
      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {onReviewContent && (
          <EnhancedAppleButton 
            variant="primary" 
            size="default"
            onClick={onReviewContent}
            className="bg-blue-600 text-white hover:bg-blue-700 shadow-lg px-8 py-3"
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
            className="bg-white text-blue-700 border-blue-300 hover:bg-blue-50 shadow-lg px-6 py-3"
          >
            Approve All
          </EnhancedAppleButton>
        )}
      </div>
    </div>
  );
};
