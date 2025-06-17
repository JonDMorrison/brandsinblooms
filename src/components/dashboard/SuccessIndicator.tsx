
import { Check, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CaptionMedium } from "@/components/ui/typography";

interface SuccessIndicatorProps {
  stepNumber: number;
  title: string;
  isComplete: boolean;
  isActive: boolean;
  totalItems?: number;
  completedItems?: number;
}

export const SuccessIndicator = ({ 
  stepNumber, 
  title, 
  isComplete, 
  isActive, 
  totalItems, 
  completedItems 
}: SuccessIndicatorProps) => {
  return (
    <div className="flex items-center gap-3">
      {/* Step Number Circle */}
      <div className={`
        flex items-center justify-center w-8 h-8 rounded-full font-medium text-sm
        ${isComplete 
          ? 'bg-green-100 text-green-800 border-2 border-green-200' 
          : isActive 
            ? 'bg-blue-100 text-blue-800 border-2 border-blue-200' 
            : 'bg-gray-100 text-gray-600 border-2 border-gray-200'
        }
      `}>
        {isComplete ? (
          <Check className="w-4 h-4" />
        ) : (
          stepNumber
        )}
      </div>

      {/* Title and Progress */}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <CaptionMedium className={`font-medium ${
            isActive ? 'text-blue-800' : isComplete ? 'text-green-800' : 'text-gray-600'
          }`}>
            {title}
          </CaptionMedium>
          
          {isComplete && (
            <Badge className="bg-green-100 text-green-800 text-xs">
              ✅ Complete
            </Badge>
          )}
          
          {isActive && !isComplete && (
            <Badge className="bg-blue-100 text-blue-800 text-xs">
              <Clock className="w-3 h-3 mr-1" />
              In Progress
            </Badge>
          )}
        </div>

        {/* Progress indicator */}
        {totalItems && completedItems !== undefined && (
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  isComplete ? 'bg-green-500' : 'bg-blue-500'
                }`}
                style={{ width: `${(completedItems / totalItems) * 100}%` }}
              />
            </div>
            <CaptionMedium className="text-gray-600 text-xs">
              {completedItems}/{totalItems}
            </CaptionMedium>
          </div>
        )}
      </div>
    </div>
  );
};
