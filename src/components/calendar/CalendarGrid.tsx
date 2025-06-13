import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Plus, CalendarIcon, TrendingUp } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, startOfWeek, endOfWeek } from "date-fns";
import { CalendarDayCell } from "./CalendarDayCell";
import { getCurrentWeekNumber, getDateForWeek, dateToWeekNumber } from "@/utils/dateUtils";

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
  ai_output?: string;
  campaigns?: {
    title: string;
  };
}

interface CalendarGridProps {
  campaigns: Campaign[];
  tasks?: Task[];
  onCampaignClick?: (campaign: Campaign) => void;
  onTaskClick?: (task: Task) => void;
  selectionMode?: boolean;
  selectedCampaigns?: Campaign[];
  selectedTasks?: Task[];
  isDragging?: boolean;
  draggedTasks?: Task[];
  dragPreview?: string;
  onTaskSelection?: (task: Task, ctrlKey: boolean) => void;
  onDragStart?: (tasks: Task[]) => void;
  onDragEnd?: () => void;
  onDrop?: (date: Date) => void;
  isTaskSelected?: (task: Task) => boolean;
  taskSelectionMode?: boolean;
}

export const CalendarGrid = ({ 
  campaigns, 
  tasks = [],
  onCampaignClick,
  onTaskClick,
  selectionMode = false,
  selectedCampaigns = [],
  selectedTasks = [],
  isDragging = false,
  draggedTasks = [],
  dragPreview = '',
  onTaskSelection,
  onDragStart,
  onDragEnd,
  onDrop,
  isTaskSelected,
  taskSelectionMode = false
}: CalendarGridProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const currentWeekNumber = getCurrentWeekNumber();
  const currentYear = currentDate.getFullYear();
  
  // Create a map of campaigns by date
  const campaignsByDate = new Map<string, Campaign>();

  campaigns.forEach(campaign => {
    const campaignDate = getDateForWeek(campaign.week_number, currentYear);
    const dateKey = format(campaignDate, 'yyyy-MM-dd');
    
    if (!campaignsByDate.has(dateKey)) {
      campaignsByDate.set(dateKey, {
        ...campaign,
        start_date: dateKey
      });
    }
  });

  // Create a map of approved tasks by date
  const tasksByDate = new Map<string, Task[]>();
  
  tasks.filter(task => task.status === 'posted' && task.scheduled_date).forEach(task => {
    const dateKey = task.scheduled_date;
    if (!tasksByDate.has(dateKey)) {
      tasksByDate.set(dateKey, []);
    }
    tasksByDate.get(dateKey)!.push(task);
  });

  // Convert map back to the expected format for rendering
  const campaignsByDateObject = Array.from(campaignsByDate.entries()).reduce((acc, [dateKey, campaign]) => {
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(campaign);
    return acc;
  }, {} as Record<string, Campaign[]>);

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter(c => c.week_number <= currentWeekNumber + 4).length;

  return (
    <Card className="w-full shadow-lg border-0 bg-white">
      <CardHeader className="pb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <CardTitle className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <CalendarIcon className="w-8 h-8 text-blue-600" />
                {format(currentDate, 'MMMM yyyy')}
              </CardTitle>
              <div className="flex items-center gap-4 mt-2">
                <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-sm font-medium">
                  Week {currentWeekNumber}
                </Badge>
                <div className="text-sm text-gray-600 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  {totalCampaigns} total campaigns, {activeCampaigns} upcoming
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('prev')}
              className="hover:bg-blue-50 border-blue-200"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              className="hover:bg-blue-50 border-blue-200 font-medium"
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('next')}
              className="hover:bg-blue-50 border-blue-200"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {selectionMode && selectedCampaigns.length > 0 && (
          <div className="mt-4 p-3 bg-blue-100 border border-blue-200 rounded-lg">
            <div className="text-sm text-blue-800 font-medium">
              {selectedCampaigns.length} campaign{selectedCampaigns.length !== 1 ? 's' : ''} selected
            </div>
          </div>
        )}

        {isDragging && (
          <div className="mt-4 p-3 bg-orange-100 border border-orange-200 rounded-lg animate-pulse">
            <div className="text-sm text-orange-800 font-medium">
              Dragging {dragPreview} - drop on a date to reschedule
            </div>
          </div>
        )}

        {taskSelectionMode && selectedTasks && selectedTasks.length > 0 && (
          <div className="mt-4 p-3 bg-blue-100 border border-blue-200 rounded-lg">
            <div className="text-sm text-blue-800 font-medium">
              {selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''} selected - Ctrl+Click to select multiple, drag to move
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => (
            <div key={day} className="p-4 text-center text-sm font-semibold text-gray-700 border-r border-gray-200 last:border-r-0">
              <span className="hidden sm:inline">{day}</span>
              <span className="sm:hidden">{day.slice(0, 3)}</span>
            </div>
          ))}
        </div>
        
        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, index) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayCampaigns = campaignsByDateObject[dateKey] || [];
            const dayTasks = tasksByDate.get(dateKey) || [];
            const dayWeekNumber = dateToWeekNumber(day);
            const isLastInRow = (index + 1) % 7 === 0;
            
            return (
              <div
                key={dateKey}
                className={cn(
                  "border-r border-b border-gray-200",
                  isLastInRow && "border-r-0"
                )}
              >
                <CalendarDayCell
                  date={day}
                  campaigns={dayCampaigns}
                  tasks={dayTasks}
                  isCurrentMonth={isSameMonth(day, currentDate)}
                  isToday={isToday(day)}
                  onCampaignClick={onCampaignClick}
                  onTaskClick={onTaskClick}
                  selectionMode={selectionMode}
                  selectedCampaigns={selectedCampaigns}
                  selectedTasks={selectedTasks}
                  weekNumber={dayWeekNumber}
                  isDragging={isDragging}
                  draggedTasks={draggedTasks}
                  dragPreview={dragPreview}
                  onTaskSelection={onTaskSelection}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onDrop={onDrop}
                  isTaskSelected={isTaskSelected}
                  taskSelectionMode={taskSelectionMode}
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

function cn(...classes: (string | undefined | boolean)[]): string {
  return classes.filter(Boolean).join(' ');
}
