
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, CheckCircle } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isToday } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

interface ContentTask {
  id: string;
  post_type: string;
  status: string;
  scheduled_date: string;
  ai_output: string;
  campaigns: {
    title: string;
    theme: string;
  };
}

export const PublishingScheduleView = () => {
  const [tasks, setTasks] = useState<ContentTask[]>([]);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasksForWeek();
  }, [currentWeek]);

  const fetchTasksForWeek = async () => {
    setLoading(true);
    try {
      const weekStart = startOfWeek(currentWeek);
      const weekEnd = endOfWeek(currentWeek);

      const { data, error } = await supabase
        .from('content_tasks')
        .select(`
          *,
          campaigns (
            title,
            theme
          )
        `)
        .gte('scheduled_date', format(weekStart, 'yyyy-MM-dd'))
        .lte('scheduled_date', format(weekEnd, 'yyyy-MM-dd'))
        .order('scheduled_date');

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const weekDays = eachDayOfInterval({
    start: startOfWeek(currentWeek),
    end: endOfWeek(currentWeek)
  });

  const getTasksForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return tasks.filter(task => task.scheduled_date === dateStr);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPostTypeIcon = (type: string) => {
    switch (type) {
      case 'facebook': return '📘';
      case 'instagram': return '📷';
      case 'email': return '📧';
      case 'newsletter': return '📰';
      case 'video': return '🎥';
      default: return '📝';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Publishing Schedule
          </CardTitle>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentWeek(new Date(currentWeek.getTime() - 7 * 24 * 60 * 60 * 1000))}
              className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
            >
              Previous Week
            </button>
            <span className="text-sm font-medium">
              {format(startOfWeek(currentWeek), 'MMM d')} - {format(endOfWeek(currentWeek), 'MMM d, yyyy')}
            </span>
            <button
              onClick={() => setCurrentWeek(new Date(currentWeek.getTime() + 7 * 24 * 60 * 60 * 1000))}
              className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
            >
              Next Week
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-4">
          {weekDays.map((day) => {
            const dayTasks = getTasksForDay(day);
            const isCurrentDay = isToday(day);
            
            return (
              <div
                key={day.toISOString()}
                className={`border rounded-lg p-3 min-h-[200px] ${
                  isCurrentDay ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
              >
                <div className="text-center mb-3">
                  <div className="text-xs text-gray-500">
                    {format(day, 'EEE')}
                  </div>
                  <div className={`text-lg font-semibold ${
                    isCurrentDay ? 'text-blue-600' : 'text-gray-900'
                  }`}>
                    {format(day, 'd')}
                  </div>
                </div>
                
                <div className="space-y-2">
                  {dayTasks.map((task) => (
                    <div
                      key={task.id}
                      className="text-xs p-2 rounded border bg-white"
                    >
                      <div className="flex items-center gap-1 mb-1">
                        <span>{getPostTypeIcon(task.post_type)}</span>
                        <span className="font-medium capitalize">
                          {task.post_type}
                        </span>
                      </div>
                      
                      <Badge className={`text-xs ${getStatusColor(task.status)}`} variant="secondary">
                        {task.status}
                      </Badge>
                      
                      {task.campaigns && (
                        <div className="text-gray-600 mt-1 truncate">
                          {task.campaigns.title}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {dayTasks.length === 0 && (
                    <div className="text-xs text-gray-400 text-center mt-8">
                      No content scheduled
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
