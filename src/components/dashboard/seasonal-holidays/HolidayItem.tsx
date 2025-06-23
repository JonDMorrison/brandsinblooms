
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Eye, ChevronDownIcon } from "lucide-react";
import { format } from "date-fns";
import { DateCalendarIcon } from "./DateCalendarIcon";
import { PostTypeAvatar } from "@/components/ui/post-type-avatar";

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
    <div className={`
      relative flex items-center w-full py-3 px-4 
      hover:bg-slate-50/70 dark:hover:bg-slate-800/50
      transition-colors duration-200
      focus-visible:outline focus-visible:outline-2 focus-visible:outline-green-500/60 rounded-md
      ${!isFirst ? 'before:border-t before:border-slate-100 dark:before:border-slate-700 before:absolute before:inset-x-0 before:top-0' : ''}
    `}>
      {/* Holiday Icon/Avatar */}
      <div className="flex-shrink-0 mr-3">
        <DateCalendarIcon 
          dateString={holiday.holiday_date} 
          className="w-9 h-9 sm:w-8 sm:h-8"
        />
      </div>
      
      {/* Holiday Name + Description */}
      <div className="flex-1 min-w-0 text-left md:w-[45%]">
        <div className="flex flex-col">
          <span className="font-medium text-slate-900 dark:text-slate-100 mb-0.5">
            {holiday.holiday_name || holiday.theme}
          </span>
          {holiday.description && (
            <span className="text-sm text-slate-500 dark:text-slate-400 truncate">
              {holiday.description}
            </span>
          )}
        </div>
      </div>
      
      {/* Meta Cluster - Status and Date */}
      <div className="hidden md:flex items-center gap-2 text-xs mr-3">
        {hasContent && (
          <Badge variant="success" className="text-xs">
            {contentState.contentCount} post{contentState.contentCount !== 1 ? 's' : ''}
          </Badge>
        )}
        
        <span className="text-slate-300 dark:text-slate-600">•</span>
        
        <span className="text-slate-400 dark:text-slate-500">
          {formatHolidayDate(holiday.holiday_date)}
        </span>
      </div>
      
      {/* Actions */}
      <div className="flex items-center gap-2">
        {!hasContent ? (
          <Button
            onClick={handleGenerateClick}
            disabled={isGenerating}
            size="sm"
            variant="ghost"
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          >
            <Sparkles className="w-3 h-3" />
            {isGenerating ? 'Generating...' : 'Generate'}
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              onClick={handleViewClick}
              variant="ghost"
              size="sm"
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            >
              <Eye className="w-3 h-3" />
              View ({contentState.contentCount})
            </Button>
            <Button
              onClick={handleGenerateClick}
              disabled={isGenerating}
              variant="ghost"
              size="sm"
              className="flex items-center gap-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100"
            >
              <Sparkles className="w-3 h-3" />
              {isGenerating ? 'Regenerating...' : 'Regenerate'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
