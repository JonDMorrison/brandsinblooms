
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ContentComplianceBadgeProps {
  wordCount: number;
  maxWords: number;
  issues: string[];
  className?: string;
}

export const ContentComplianceBadge = ({ 
  wordCount, 
  maxWords, 
  issues, 
  className = '' 
}: ContentComplianceBadgeProps) => {
  const isCompliant = issues.length === 0;
  const isNearLimit = wordCount > maxWords * 0.8;
  
  const getBadgeVariant = () => {
    if (isCompliant) return 'default';
    if (wordCount > maxWords) return 'destructive';
    return 'secondary';
  };
  
  const getBadgeColor = () => {
    if (isCompliant) return 'bg-green-100 text-green-700 border-green-200';
    if (wordCount > maxWords) return 'bg-red-100 text-red-700 border-red-200';
    return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  };
  
  const getIcon = () => {
    if (isCompliant) return <CheckCircle className="w-3 h-3" />;
    if (wordCount > maxWords) return <AlertTriangle className="w-3 h-3" />;
    return <AlertCircle className="w-3 h-3" />;
  };
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`inline-flex items-center gap-1 ${className}`}>
            <Badge className={`${getBadgeColor()} text-xs px-2 py-1`}>
              {getIcon()}
              {wordCount}/{maxWords}
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">
              Facebook Content Guidelines
            </p>
            <p className="text-sm">
              Word count: {wordCount}/{maxWords}
            </p>
            {issues.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-red-600">Issues:</p>
                <ul className="text-sm space-y-1">
                  {issues.map((issue, index) => (
                    <li key={index} className="text-red-600">• {issue}</li>
                  ))}
                </ul>
              </div>
            )}
            {isCompliant && (
              <p className="text-sm text-green-600">✓ Meets all guidelines</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
