
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, Clock, CheckCircle, Move, Eye } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isToday } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { ContentTaskItem } from "@/components/content/ContentTaskItem";
import { useDragAndDrop } from "@/hooks/useDragAndDrop";
import { toast } from "sonner";

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
  const [selectedTask, setSelectedTask] = useState<ContentTask | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  // Drag and drop functionality
  const {
    isDragging,
    draggedTask,
    handleDragStart,
    handleDragEnd,
    handleDrop
  } = useDragAndDrop(() => {
    fetchTasksForWeek();
  });

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
        .in('status', ['posted', 'scheduled', 'published'])
        .order('scheduled_date');

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error('Failed to load tasks');
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
      case 'posted': return 'bg-green-100 text-green-800';
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'published': return 'bg-purple-100 text-purple-800';
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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'posted': return 'Approved';
      case 'scheduled': return 'Scheduled';
      case 'published': return 'Published';
      default: return status;
    }
  };

  const handleTaskClick = (task: ContentTask) => {
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  const handleTaskDragStart = (e: React.DragEvent, task: ContentTask) => {
    handleDragStart(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDayDrop = (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    handleDrop(targetDate);
  };

  const handleDayDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Publishing Schedule - Approved Content
            </CardTitle>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentWeek(new Date(currentWeek.getTime() - 7 * 24 * 60 * 60 * 1000))}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50 transition-colors"
              >
                Previous Week
              </button>
              <span className="text-sm font-medium">
                {format(startOfWeek(currentWeek), 'MMM d')} - {format(endOfWeek(currentWeek), 'MMM d, yyyy')}
              </span>
              <button
                onClick={() => setCurrentWeek(new Date(currentWeek.getTime() + 7 * 24 * 60 * 60 * 1000))}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50 transition-colors"
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
                  className={`border rounded-lg p-3 min-h-[200px] transition-colors ${
                    isCurrentDay ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                  } ${isDragging ? 'border-dashed border-blue-400 bg-blue-50' : ''}`}
                  onDrop={(e) => handleDayDrop(e, day)}
                  onDragOver={handleDayDragOver}
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
                        className={`text-xs p-2 rounded border bg-white shadow-sm cursor-pointer hover:shadow-md hover:border-blue-300 transition-all group relative ${
                          draggedTask?.id === task.id ? 'opacity-50 scale-95' : ''
                        }`}
                        draggable
                        onClick={() => handleTaskClick(task)}
                        onDragStart={(e) => handleTaskDragStart(e, task)}
                        onDragEnd={handleDragEnd}
                      >
                        {/* Drag handle */}
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Move className="w-3 h-3 text-gray-400" />
                        </div>
                        
                        {/* View icon */}
                        <div className="absolute top-1 right-5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Eye className="w-3 h-3 text-blue-500" />
                        </div>
                        
                        <div className="flex items-center gap-1 mb-1">
                          <span>{getPostTypeIcon(task.post_type)}</span>
                          <span className="font-medium capitalize">
                            {task.post_type}
                          </span>
                          {task.status === 'posted' && (
                            <CheckCircle className="w-3 h-3 text-green-600" />
                          )}
                        </div>
                        
                        <Badge className={`text-xs ${getStatusColor(task.status)}`} variant="secondary">
                          {getStatusLabel(task.status)}
                        </Badge>
                        
                        {task.campaigns && (
                          <div className="text-gray-600 mt-1 truncate">
                            {task.campaigns.title}
                          </div>
                        )}
                        
                        {task.ai_output && (
                          <div className="text-gray-500 mt-1 text-xs line-clamp-2">
                            {task.ai_output.replace(/<[^>]*>/g, '').substring(0, 50)}...
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {dayTasks.length === 0 && (
                      <div className="text-xs text-gray-400 text-center mt-8">
                        No approved content
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Task Content Modal */}
      <Dialog open={isTaskModalOpen} onOpenChange={setIsTaskModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white z-[100] border border-gray-200 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">
                {selectedTask?.post_type === 'facebook' && '📘'}
                {selectedTask?.post_type === 'instagram' && '📷'}
                {selectedTask?.post_type === 'email' && '📧'}
                {selectedTask?.post_type === 'newsletter' && '📰'}
                {selectedTask?.post_type === 'video' && '🎥'}
                {(!selectedTask?.post_type || !['facebook', 'instagram', 'email', 'newsletter', 'video'].includes(selectedTask.post_type)) && '📝'}
              </span>
              {selectedTask?.post_type && (
                <span className="capitalize">{selectedTask.post_type} Content</span>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {selectedTask && (
            <div className="mt-4">
              <ContentTaskItem 
                task={selectedTask} 
                onTaskUpdate={() => {
                  fetchTasksForWeek();
                  setIsTaskModalOpen(false);
                }} 
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
