
import * as React from "react";
import { cn } from "@/lib/utils";
import { PremiumIcon } from "@/components/ui/premium-icons";
import { EnhancedProgress } from "@/components/ui/enhanced-progress";
import { HeadlineMedium, CaptionMedium } from "@/components/ui/typography";

interface EnhancedSuccessIndicatorProps {
  stepNumber: number;
  title: string;
  isComplete: boolean;
  isActive: boolean;
  totalItems: number;
  completedItems: number;
  className?: string;
}

export const EnhancedSuccessIndicator = ({
  stepNumber,
  title,
  isComplete,
  isActive,
  totalItems,
  completedItems,
  className
}: EnhancedSuccessIndicatorProps) => {
  return (
    <div className={cn(
      'p-4 rounded-lg border transition-all duration-300',
      isComplete ? 'apple-success-glow border-green-200' : 
      isActive ? 'bg-blue-50 border-blue-200' : 
      'bg-gray-50 border-gray-200',
      className
    )}>
      <div className="flex items-center gap-3 mb-3">
        <div className={cn(
          'flex items-center justify-center w-8 h-8 rounded-full font-medium text-sm transition-all duration-300',
          isComplete ? 'bg-green-100 text-green-800' :
          isActive ? 'bg-blue-100 text-blue-800' :
          'bg-gray-100 text-gray-600'
        )}>
          {isComplete ? (
            <PremiumIcon icon="check" size="sm" variant="gradient" />
          ) : (
            stepNumber
          )}
        </div>
        
        <HeadlineMedium className={cn(
          'apple-headline-medium flex-1',
          isComplete ? 'text-green-800' :
          isActive ? 'text-blue-800' :
          'text-gray-700'
        )}>
          {title}
        </HeadlineMedium>
      </div>

      {(isActive || isComplete) && totalItems > 0 && (
        <div className="space-y-2">
          <EnhancedProgress
            value={completedItems}
            max={totalItems}
            animated={true}
            size="md"
          />
          <CaptionMedium className="apple-caption-enhanced">
            {isComplete 
              ? "🎉 All content reviewed and ready!" 
              : `${completedItems} of ${totalItems} pieces reviewed`
            }
          </CaptionMedium>
        </div>
      )}
    </div>
  );
};
