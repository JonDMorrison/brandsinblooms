
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Eye, Calendar, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { DateCalendarIcon } from "./DateCalendarIcon";
import { toast } from "sonner";

interface HolidayItemProps {
  holiday: any;
  onGenerateContent: (holidayId: string) => Promise<void>;
  onViewContent: (holidayId: string, holidayName: string) => void;
  isGenerating: boolean;
  contentState?: any;
  isFirst?: boolean;
}

export const HolidayItem = ({ 
  holiday, 
  onGenerateContent, 
  onViewContent, 
  isGenerating, 
  contentState,
  isFirst = false
}: HolidayItemProps) => {
  const hasContent = contentState && contentState.contentCount > 0;
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [isLocalGenerating, setIsLocalGenerating] = React.useState(false);

  const handleGenerateClick = async () => {
    console.log(`🎉 HOLIDAY_ITEM: Generate button clicked for: ${holiday.holiday_name}`);
    console.log(`🎉 HOLIDAY_ITEM: Current isGenerating state: ${isGenerating}`);
    
    if (isGenerating || isLocalGenerating) {
      console.log(`🎉 HOLIDAY_ITEM: Already generating, ignoring click`);
      return;
    }

    try {
      setLocalError(null);
      setIsLocalGenerating(true);
      console.log(`🎉 HOLIDAY_ITEM: Calling onGenerateContent for holiday: ${holiday.holiday_name}`);
      
      await onGenerateContent(holiday.id);
      
      console.log(`🎉 HOLIDAY_ITEM: Content generation completed successfully for: ${holiday.holiday_name}`);
      
      // Auto-open the content viewer modal after successful generation
      setTimeout(() => {
        console.log(`🎉 HOLIDAY_ITEM: Auto-opening content viewer for: ${holiday.holiday_name}`);
        onViewContent(holiday.id, holiday.holiday_name);
      }, 1000);
      
    } catch (error) {
      console.error('🎉 HOLIDAY_ITEM: Error in handleGenerateClick:', error);
      const errorMessage = error?.message || 'Unknown error occurred';
      setLocalError(errorMessage);
      
      toast.error(`Failed to generate content for ${holiday.holiday_name}`, {
        description: errorMessage
      });
    } finally {
      setIsLocalGenerating(false);
    }
  };

  const handleViewClick = () => {
    console.log(`🎉 HOLIDAY_ITEM: Opening content viewer for: ${holiday.holiday_name}`);
    onViewContent(holiday.id, holiday.holiday_name);
  };

  // Format date safely with validation
  const formatHolidayDate = (dateString: string) => {
    if (!dateString) return "Date not available";
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "Date not available";
      return format(date, "MMMM dd, yyyy");
    } catch (error) {
      return "Date not available";
    }
  };

  const isCurrentlyGenerating = isGenerating || isLocalGenerating;

  return (
    <Card className="transition-all duration-200 hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <DateCalendarIcon 
            dateString={holiday.holiday_date} 
            className="w-10 h-10 flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
              {holiday.holiday_name || holiday.theme}
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Calendar className="w-4 h-4" />
              <span>{formatHolidayDate(holiday.holiday_date)}</span>
            </div>
          </div>
          {hasContent && (
            <Badge variant="success" className="text-xs">
              {contentState.contentCount} post{contentState.contentCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {holiday.description && (
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
            {holiday.description}
          </p>
        )}
        
        {/* Show error message if generation failed */}
        {localError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800">Generation Failed</p>
              <p className="text-xs text-red-600 mt-1">{localError}</p>
            </div>
          </div>
        )}
        
        {/* Show generation status */}
        {isCurrentlyGenerating && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
            <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full mt-0.5"></div>
            <div>
              <p className="text-sm font-medium text-blue-800">Generating Content</p>
              <p className="text-xs text-blue-600 mt-1">Creating holiday-themed content pieces...</p>
            </div>
          </div>
        )}
        
        {!hasContent ? (
          <div className="space-y-2">
            <Button
              onClick={handleGenerateClick}
              disabled={isCurrentlyGenerating}
              size="sm"
              className="flex items-center gap-2 w-full"
            >
              <Sparkles className={`w-4 h-4 ${isCurrentlyGenerating ? 'animate-spin' : ''}`} />
              {isCurrentlyGenerating ? 'Generating & Opening Review...' : 'Generate Content & Review'}
            </Button>
            {localError && (
              <Button
                onClick={handleGenerateClick}
                disabled={isCurrentlyGenerating}
                variant="outline"
                size="sm"
                className="flex items-center gap-2 w-full text-xs"
              >
                Try Again
              </Button>
            )}
          </div>
        ) : (
          <Button
            onClick={handleViewClick}
            variant="default"
            size="sm"
            className="flex items-center gap-2 w-full"
          >
            <Eye className="w-4 h-4" />
            Review Content
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
