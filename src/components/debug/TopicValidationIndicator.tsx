import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface TopicValidationIndicatorProps {
  validation?: {
    isValid: boolean;
    confidence: number;
    suggestions: string[];
  };
  campaignTitle?: string;
  className?: string;
}

export const TopicValidationIndicator = ({
  validation,
  campaignTitle,
  className = ''
}: TopicValidationIndicatorProps) => {
  if (!validation || !campaignTitle) {
    return null;
  }

  const { isValid, confidence, suggestions } = validation;
  const confidencePercentage = Math.round(confidence * 100);

  // Don't show for high confidence, valid content
  if (isValid && confidence >= 0.8) {
    return null;
  }

  const getIndicatorColor = () => {
    if (!isValid) return 'bg-red-500';
    if (confidence < 0.7) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getIndicatorIcon = () => {
    if (!isValid) return <AlertTriangle className="h-3 w-3" />;
    if (confidence < 0.7) return <Info className="h-3 w-3" />;
    return <CheckCircle className="h-3 w-3" />;
  };

  const getStatusText = () => {
    if (!isValid) return 'Topic Misaligned';
    if (confidence < 0.7) return 'Partial Alignment';
    return 'Good Alignment';
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={isValid ? (confidence >= 0.7 ? 'default' : 'secondary') : 'destructive'}
            className={`flex items-center gap-1 text-xs ${className}`}
          >
            {getIndicatorIcon()}
            {getStatusText()} ({confidencePercentage}%)
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-sm">
          <div className="space-y-2">
            <div className="font-medium">
              Topic: "{campaignTitle}"
            </div>
            <div className="text-sm">
              Content alignment: {confidencePercentage}%
            </div>
            {suggestions.length > 0 && (
              <div className="space-y-1">
                <div className="text-sm font-medium">Suggestions:</div>
                <ul className="text-xs space-y-1">
                  {suggestions.slice(0, 3).map((suggestion, index) => (
                    <li key={index} className="text-muted-foreground">
                      • {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};