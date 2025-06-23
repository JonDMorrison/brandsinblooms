
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Mail, Instagram, Facebook, Video, FileText, Sparkles, Eye } from "lucide-react";
import { format } from "date-fns";
import { DateCalendarIcon } from "./DateCalendarIcon";

interface HolidayItemProps {
  holiday: any;
  onGenerateContent: (holidayId: string) => Promise<void>;
  onViewContent: (holidayId: string, holidayName: string) => void;
  isGenerating: boolean;
  contentState?: any;
}

export const HolidayItem = ({ 
  holiday, 
  onGenerateContent, 
  onViewContent, 
  isGenerating, 
  contentState 
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
    <Card className="mb-4 hover:shadow-md transition-shadow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DateCalendarIcon 
            dateString={holiday.holiday_date} 
            className="w-10 h-10"
          />
          {holiday.holiday_name || holiday.theme}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {holiday.description && (
            <p className="text-sm text-gray-600">{holiday.description}</p>
          )}
          
          <div className="flex gap-2">
            {!hasContent ? (
              <Button
                onClick={handleGenerateClick}
                disabled={isGenerating}
                className="flex items-center gap-2"
                size="sm"
              >
                <Sparkles className="w-4 h-4" />
                {isGenerating ? 'Generating...' : 'Generate Content'}
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  onClick={handleViewClick}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  View Content ({contentState.contentCount})
                </Button>
                <Button
                  onClick={handleGenerateClick}
                  disabled={isGenerating}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {isGenerating ? 'Regenerating...' : 'Regenerate'}
                </Button>
              </div>
            )}
          </div>

          {hasContent && (
            <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
              ✓ Content ready for {contentState.contentCount} post{contentState.contentCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
