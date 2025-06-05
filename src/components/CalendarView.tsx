import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Palette } from "lucide-react";
import { getStatusColor } from "./homepage/homepageUtils";
import { EditableTheme } from "./calendar/EditableTheme";

interface Campaign {
  id: number;
  week_number: number;
  start_date: string;
  title: string;
  theme?: string;
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

export const CalendarView = ({ campaigns, tasks = [], onDataUpdate }: CalendarViewProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [localCampaigns, setLocalCampaigns] = useState(campaigns);

  // Update local campaigns when props change
  useState(() => {
    setLocalCampaigns(campaigns);
  });

  // Get tasks for the selected date
  const getTasksForDate = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    return tasks.filter(task => task.scheduled_date === dateString);
  };

  // Get dates that have scheduled tasks
  const getDatesWithTasks = () => {
    return tasks
      .filter(task => task.scheduled_date)
      .map(task => new Date(task.scheduled_date));
  };

  const tasksForSelectedDate = selectedDate ? getTasksForDate(selectedDate) : [];
  const datesWithTasks = getDatesWithTasks();

  const groupedCampaigns = localCampaigns.reduce((acc, campaign) => {
    const week = `Week ${campaign.week_number}`;
    if (!acc[week]) acc[week] = [];
    acc[week].push(campaign);
    return acc;
  }, {} as Record<string, Campaign[]>);

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    if (direction === 'prev') {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  const handleThemeUpdate = (campaignId: string, newTheme: string) => {
    setLocalCampaigns(prev => 
      prev.map(campaign => 
        campaign.id.toString() === campaignId 
          ? { ...campaign, theme: newTheme }
          : campaign
      )
    );
    onDataUpdate?.();
  };

  return (
    <div className="space-y-6">
      {/* Calendar Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Widget */}
        <div className="lg:col-span-2">
          <Card className="border-green-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-green-800">
                  <CalendarIcon className="w-5 h-5" />
                  Content Calendar
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigateMonth('prev')}
                    className="border-green-300 hover:bg-green-100"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigateMonth('next')}
                    className="border-green-300 hover:bg-green-100"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                className="rounded-md border-green-200 pointer-events-auto"
                modifiers={{
                  hasTask: datesWithTasks,
                }}
                modifiersStyles={{
                  hasTask: { 
                    backgroundColor: '#bbf7d0', 
                    color: '#166534',
                    fontWeight: 'bold'
                  },
                }}
              />
            </CardContent>
          </Card>
        </div>

        {/* Selected Date Details */}
        <div>
          <Card className="border-green-200">
            <CardHeader className="bg-green-50">
              <CardTitle className="text-green-800">
                {selectedDate 
                  ? selectedDate.toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })
                  : 'Select a date'
                }
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {tasksForSelectedDate.length > 0 ? (
                <div className="space-y-3">
                  {tasksForSelectedDate.map((task) => (
                    <div 
                      key={task.id}
                      className="p-3 bg-white rounded-lg border border-gray-200 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-800">
                          {task.post_type}
                        </h4>
                        <Badge 
                          variant="outline" 
                          className={getStatusColor(task.status)}
                        >
                          {task.status}
                        </Badge>
                      </div>
                      {task.campaigns && (
                        <p className="text-sm text-gray-600">
                          {task.campaigns.title}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">
                  No content scheduled for this date
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Weekly Content Themes */}
      <div className="grid gap-4">
        <h3 className="text-xl font-bold text-garden-green-dark flex items-center gap-2">
          <Palette className="w-6 h-6" />
          Weekly Content Themes
        </h3>
        {Object.entries(groupedCampaigns).map(([week, weekCampaigns]) => (
          <Card key={week} className="border-green-200">
            <CardHeader className="bg-green-50">
              <CardTitle className="flex items-center gap-2 text-green-800">
                <CalendarIcon className="w-5 h-5" />
                {week}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid gap-4">
                {weekCampaigns.map((campaign) => (
                  <div 
                    key={campaign.id}
                    className="p-4 bg-white rounded-lg border border-gray-200 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-800 mb-1">{campaign.title}</h4>
                        <p className="text-sm text-gray-500">
                          Starting {new Date(campaign.start_date).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-green-700 border-green-300">
                        Active
                      </Badge>
                    </div>
                    
                    <div className="border-t pt-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Palette className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">Content Theme:</span>
                      </div>
                      <EditableTheme
                        campaignId={campaign.id.toString()}
                        currentTheme={campaign.theme || ""}
                        onThemeUpdate={(newTheme) => handleThemeUpdate(campaign.id.toString(), newTheme)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
