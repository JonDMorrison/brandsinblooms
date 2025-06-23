
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Eye, Calendar } from "lucide-react";
import { format } from "date-fns";
import { DateCalendarIcon } from "./DateCalendarIcon";

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

  const handleGenerateClick = () => {
    onGenerateContent(holiday.id);
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
            <Sparkles className="w-4 h-4" />
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
