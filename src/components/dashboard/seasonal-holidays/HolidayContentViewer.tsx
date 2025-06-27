
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Calendar, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ContentSidebar } from '@/components/ContentSidebar';
import { TaskItem } from '@/components/dashboard/current-campaign/TaskItem';
import { ScrollArea } from '@/components/ui/scroll-area';

interface HolidayContentViewerProps {
  holidayId: string;
  holidayName: string;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdate?: () => void;
}

export const HolidayContentViewer = ({
  holidayId,
  holidayName,
  isOpen,
  onClose,
  onTaskUpdate
}: HolidayContentViewerProps) => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showContentSidebar, setShowContentSidebar] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);

  useEffect(() => {
    if (isOpen && holidayId) {
      fetchHolidayContent();
    }
  }, [isOpen, holidayId]);

  const fetchHolidayContent = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('content_tasks')
        .select(`
          *,
          holidays (
            holiday_name,
            holiday_date
          )
        `)
        .eq('holiday_id', holidayId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching holiday content:', error);
        toast.error('Failed to load holiday content');
      } else {
        setTasks(data || []);
      }
    } catch (error) {
      console.error('Exception fetching holiday content:', error);
      toast.error('Failed to load holiday content');
    } finally {
      setLoading(false);
    }
  };

  const handleTaskClick = (task: any) => {
    setSelectedTask(task);
    setShowContentSidebar(true);
  };

  const handleContentSidebarClose = () => {
    setShowContentSidebar(false);
    setSelectedTask(null);
    fetchHolidayContent();
    if (onTaskUpdate) onTaskUpdate();
  };

  const handleTaskUpdate = () => {
    fetchHolidayContent();
    if (onTaskUpdate) onTaskUpdate();
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {holidayName} Content
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (tasks.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {holidayName} Content
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-12">
            <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-muted-foreground">No content found for this holiday.</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {holidayName} Content
              <Badge variant="outline">
                {tasks.length} piece{tasks.length !== 1 ? 's' : ''}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-4">
              <div className="text-sm text-gray-600 mb-4">
                Found {tasks.length} content pieces for {holidayName}
              </div>

              {tasks.map((task, index) => (
                <TaskItem 
                  key={task.id} 
                  task={task} 
                  onClick={handleTaskClick}
                  onTaskUpdate={handleTaskUpdate}
                  isFirst={index === 0}
                />
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Content Sidebar */}
      {selectedTask && (
        <ContentSidebar
          task={selectedTask}
          isOpen={showContentSidebar}
          onClose={handleContentSidebarClose}
          onTaskUpdate={handleContentSidebarClose}
          initialEditMode={true}
        />
      )}
    </>
  );
};
