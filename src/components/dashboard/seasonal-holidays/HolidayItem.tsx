
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Eye, Calendar } from "lucide-react";
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

  const handleGenerateClick = async () => {
    try {
      console.log(`🎉 HOLIDAY_ITEM: Starting content generation for holiday: ${holiday.holiday_name}`);
      
      // Show immediate feedback
      toast.loading(`Starting content generation for ${holiday.holiday_name}...`, {
        id: `holiday-loading-${holiday.id}`
      });
      
      await onGenerateContent(holiday.id);
      
      // Success feedback is handled in the parent component
      toast.dismiss(`holiday-loading-${holiday.id}`);
      
    } catch (error) {
      console.error('🎉 HOLIDAY_ITEM: Error generating content:', error);
      toast.dismiss(`holiday-loading-${holiday.id}`);
      toast.error(`Failed to generate content for ${holiday.holiday_name}`, {
        description: 'Please try again or contact support if the issue persists.'
      });
    }
  };

  const handleViewClick = () => {
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
        
        {!hasContent ? (
          <Button
            onClick={handleGenerateClick}
            disabled={isGenerating}
            size="sm"
            className="flex items-center gap-2"
          >
            <Sparkles className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
            {isGenerating ? 'Generating...' : 'Generate Content'}
          </Button>
        ) : (
          <Button
            onClick={handleViewClick}
            variant="default"
            size="sm"
            className="flex items-center gap-2"
          >
            <Eye className="w-4 h-4" />
            View Content
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
