
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Leaf, Mail, Instagram, Facebook, Video, FileText, Sparkles, Eye } from "lucide-react";
import { format } from "date-fns";

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

  return (
    <Card className="mb-4 hover:shadow-md transition-shadow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Leaf className="w-5 h-5 text-green-500" />
          {holiday.holiday_name || holiday.theme}
        </CardTitle>
        <p className="text-sm text-gray-500">
          <Calendar className="w-4 h-4 mr-1 inline-block" />
          {format(new Date(holiday.date), "MMMM dd, yyyy")}
        </p>
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
