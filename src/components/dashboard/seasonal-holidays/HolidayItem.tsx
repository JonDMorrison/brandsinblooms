
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";
import { format } from "date-fns";
import { DateCalendarIcon } from "./DateCalendarIcon";
import { HolidayGenerationSuccess } from "./HolidayGenerationSuccess";
import { HolidayGenerationButton } from "./HolidayGenerationButton";

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
    console.log(`🎉 HOLIDAY_ITEM: Generate button clicked for: ${holiday.holiday_name}`);
    
    if (isGenerating) {
      console.log(`🎉 HOLIDAY_ITEM: Already generating, ignoring click`);
      return;
    }

    try {
      console.log(`🎉 HOLIDAY_ITEM: Calling onGenerateContent for holiday: ${holiday.holiday_name}`);
      await onGenerateContent(holiday.id);
      
      console.log(`🎉 HOLIDAY_ITEM: Content generation completed successfully for: ${holiday.holiday_name}`);
    } catch (error) {
      console.error('🎉 HOLIDAY_ITEM: Error in handleGenerateClick:', error);
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
        
        {/* Use compact view when content exists, similar to WeeklyThemeGenerator */}
        {hasContent ? (
          <HolidayGenerationSuccess
            contentCount={contentState.contentCount}
            holidayName={holiday.holiday_name}
            onViewContent={handleViewClick}
          />
        ) : (
          <HolidayGenerationButton
            loading={isGenerating}
            onGenerate={handleGenerateClick}
            holidayName={holiday.holiday_name}
          />
        )}
      </CardContent>
    </Card>
  );
};
