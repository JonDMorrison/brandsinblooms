
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";
import { format } from "date-fns";
import { DateCalendarIcon } from "./DateCalendarIcon";
import { HolidayGenerationSuccess } from "./HolidayGenerationSuccess";
import { HolidayGenerationButton } from "./HolidayGenerationButton";
import { FivePostModal } from "@/components/shared/FivePostModal";

interface HolidayItemProps {
  holiday: any;
  onGenerateContent: (holidayId: string) => Promise<void>;
  onViewContent: (holidayId: string, holidayName: string) => void;
  isGenerating: boolean;
  contentState?: any;
  isFirst?: boolean;
  holidayTasks?: any[]; // Add tasks prop for modal
}

export const HolidayItem = ({ 
  holiday, 
  onGenerateContent, 
  onViewContent, 
  isGenerating, 
  contentState,
  isFirst = false,
  holidayTasks = []
}: HolidayItemProps) => {
  const [showFivePostModal, setShowFivePostModal] = useState(false);
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

  const handleViewClick = () => {
    console.log(`🎉 HOLIDAY_ITEM: Opening content viewer for: ${holiday.holiday_name}`);
    setShowFivePostModal(true);
  };

  const handleApprove = (postIds: string[]) => {
    console.log('Approving holiday posts:', postIds);
    // Add approval logic here
    setShowFivePostModal(false);
  };

  const handleRegenerate = async () => {
    console.log('Regenerating holiday content for:', holiday.holiday_name);
    await onGenerateContent(holiday.id);
    setShowFivePostModal(false);
  };

  return (
    <>
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
                {contentState.contentCount} {contentState.contentCount !== 1 ? 'pieces' : 'piece'}
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

      {/* Five Post Modal for Holiday Content */}
      {showFivePostModal && (
        <FivePostModal
          isOpen={showFivePostModal}
          onClose={() => setShowFivePostModal(false)}
          title={holiday.holiday_name}
          posts={holidayTasks}
          onApprove={handleApprove}
          onRegenerate={handleRegenerate}
          campaignTheme={holiday.holiday_name}
        />
      )}
    </>
  );
};
