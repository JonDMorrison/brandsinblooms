
import React from "react";
import { Calendar, FileText } from "lucide-react";
import { BodyMedium, CaptionMedium } from "@/components/ui/typography";

interface WeeklyContentExplanationProps {
  activeCampaign: any;
  tasksCount: number;
}

export const WeeklyContentExplanation = ({ 
  activeCampaign, 
  tasksCount 
}: WeeklyContentExplanationProps) => {
  // Extract the theme from the campaign, removing "Week X" prefix if present
  const getWeeklyTheme = () => {
    if (!activeCampaign) return "seasonal gardening topics";
    
    const theme = activeCampaign.theme || activeCampaign.title;
    if (!theme) return "seasonal gardening topics";
    
    // Remove "Week X - " pattern if it exists
    const cleanedTheme = theme.replace(/^Week \d+\s*-?\s*/i, '').trim();
    return cleanedTheme || theme;
  };

  const weeklyTheme = getWeeklyTheme();

  return (
    <div className="flex items-start gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
      <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg flex-shrink-0">
        <Calendar className="w-5 h-5 text-blue-600" />
      </div>
      <div className="flex-1 space-y-2">
        <BodyMedium className="text-blue-900 font-medium">
          Each week we create five pieces of content. This week we are talking about{" "}
          <span className="font-semibold text-blue-800">{weeklyTheme}</span>.
        </BodyMedium>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1 text-blue-700">
            <FileText className="w-4 h-4" />
            <CaptionMedium>
              {tasksCount}/5 content pieces ready for review
            </CaptionMedium>
          </div>
        </div>
      </div>
    </div>
  );
};
