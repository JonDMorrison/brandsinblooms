
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Palette, Sparkles } from "lucide-react";
import { EditableTheme } from "./calendar/EditableTheme";
import { WeeklyThemeGenerator } from "./theme-generation/WeeklyThemeGenerator";

interface Campaign {
  id: number;
  week_number: number;
  start_date: string;
  title: string;
  theme?: string;
  description?: string;
}

interface Task {
  id: string;
  scheduled_date: string;
  post_type: string;
  status: string;
  campaigns?: {
    title: string;
  };
}

interface CalendarViewProps {
  campaigns: Campaign[];
  tasks?: Task[];
  onDataUpdate?: () => void;
}

const getWeekDateRange = (weekNumber: number, year: number) => {
  // Calculate the first day of the year
  const firstDayOfYear = new Date(year, 0, 1);
  
  // Calculate which day of the week January 1st falls on (0 = Sunday, 1 = Monday, etc.)
  const firstDayWeekday = firstDayOfYear.getDay();
  
  // Calculate the date of the first Monday of the year (start of week 1)
  const firstMonday = new Date(firstDayOfYear);
  const daysToFirstMonday = firstDayWeekday === 0 ? 1 : (8 - firstDayWeekday);
  firstMonday.setDate(firstDayOfYear.getDate() + daysToFirstMonday);
  
  // Calculate the start date of the specified week
  const weekStartDate = new Date(firstMonday);
  weekStartDate.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);
  
  // Calculate the end date of the week (Sunday)
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekStartDate.getDate() + 6);
  
  return { startDate: weekStartDate, endDate: weekEndDate };
};

const getCurrentWeekNumber = () => {
  const today = new Date();
  const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
  const pastDaysOfYear = (today.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
};

export const CalendarView = ({ campaigns, tasks = [], onDataUpdate }: CalendarViewProps) => {
  const [localCampaigns, setLocalCampaigns] = useState(campaigns);
  const [showThemeGenerator, setShowThemeGenerator] = useState(false);
  const currentYear = new Date().getFullYear();
  const currentWeekNumber = getCurrentWeekNumber();

  // Update local campaigns when props change
  useState(() => {
    setLocalCampaigns(campaigns);
  });

  // Check if campaigns need AI-generated themes
  const campaignsNeedingThemes = localCampaigns.filter(campaign => 
    !campaign.theme || campaign.theme.includes("Summer Heat Solutions") || campaign.theme === campaign.title
  );

  // Sort campaigns starting with current week, then subsequent weeks in order
  const sortedCampaigns = [...localCampaigns].sort((a, b) => {
    // Calculate order starting from current week
    const aOrder = a.week_number >= currentWeekNumber 
      ? a.week_number - currentWeekNumber
      : (52 - currentWeekNumber) + a.week_number;
    
    const bOrder = b.week_number >= currentWeekNumber 
      ? b.week_number - currentWeekNumber
      : (52 - currentWeekNumber) + b.week_number;
    
    return aOrder - bOrder;
  });

  const groupedCampaigns = sortedCampaigns.reduce((acc, campaign) => {
    const week = `Week ${campaign.week_number}`;
    if (!acc[week]) acc[week] = [];
    acc[week].push(campaign);
    return acc;
  }, {} as Record<string, Campaign[]>);

  const handleThemeUpdate = (campaignId: string, newTheme: string, newDescription?: string) => {
    setLocalCampaigns(prev => 
      prev.map(campaign => 
        campaign.id.toString() === campaignId 
          ? { ...campaign, theme: newTheme, description: newDescription }
          : campaign
      )
    );
    onDataUpdate?.();
  };

  const handleThemesGenerated = () => {
    onDataUpdate?.();
    setShowThemeGenerator(false);
  };

  return (
    <div className="space-y-6">
      {/* AI Theme Generator Alert */}
      {campaignsNeedingThemes.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-orange-600" />
                <div>
                  <h3 className="font-semibold text-orange-800">Generate Creative Themes</h3>
                  <p className="text-sm text-orange-700">
                    {campaignsNeedingThemes.length} campaigns need unique, seasonal themes. 
                    Generate 52 creative weekly themes with AI.
                  </p>
                </div>
              </div>
              <Button 
                onClick={() => setShowThemeGenerator(true)}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Themes
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Theme Generator */}
      {showThemeGenerator && (
        <Card className="border-purple-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-purple-800">AI Theme Generator</h3>
              <Button 
                variant="outline" 
                onClick={() => setShowThemeGenerator(false)}
                className="text-gray-600"
              >
                Cancel
              </Button>
            </div>
            <WeeklyThemeGenerator onThemesGenerated={handleThemesGenerated} />
          </CardContent>
        </Card>
      )}

      {/* Weekly Content Themes */}
      <div className="grid gap-4">
        <h3 className="text-xl font-bold text-garden-green-dark flex items-center gap-2">
          <Palette className="w-6 h-6" />
          Weekly Content Themes
        </h3>
        {Object.entries(groupedCampaigns).map(([week, weekCampaigns]) => {
          const weekNumber = weekCampaigns[0].week_number;
          const { startDate, endDate } = getWeekDateRange(weekNumber, currentYear);
          const isCurrentWeek = weekNumber === currentWeekNumber;
          
          return (
            <Card key={week} className={`border-green-200 ${isCurrentWeek ? 'ring-2 ring-blue-500 shadow-lg' : ''}`}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between text-green-800">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5" />
                    {week} ({currentYear})
                    {isCurrentWeek && (
                      <Badge className="bg-blue-100 text-blue-800 text-xs">
                        Current Week
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm font-normal text-gray-500">
                    {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid gap-4">
                  {weekCampaigns.map((campaign) => {
                    const needsTheme = !campaign.theme || 
                                     campaign.theme.includes("Summer Heat Solutions") || 
                                     campaign.theme === campaign.title;
                    
                    return (
                      <div 
                        key={campaign.id}
                        className={`p-4 rounded-lg border transition-shadow ${
                          needsTheme 
                            ? 'bg-orange-50 border-orange-200 hover:shadow-sm' 
                            : 'bg-white border-gray-200 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-800 mb-1">{campaign.title}</h4>
                            {needsTheme && (
                              <Badge variant="outline" className="text-orange-700 border-orange-300 bg-orange-100">
                                Needs Creative Theme
                              </Badge>
                            )}
                          </div>
                          {!needsTheme && (
                            <Badge variant="outline" className="text-green-700 border-green-300">
                              Active
                            </Badge>
                          )}
                        </div>
                        
                        <div className="border-t pt-3">
                          <EditableTheme
                            campaignId={campaign.id.toString()}
                            currentTheme={campaign.theme || ""}
                            currentDescription={campaign.description || ""}
                            weekNumber={campaign.week_number}
                            onThemeUpdate={(newTheme, newDescription) => handleThemeUpdate(campaign.id.toString(), newTheme, newDescription)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
