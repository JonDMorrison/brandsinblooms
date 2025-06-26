
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Copy, Edit, Trash2, Calendar, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ContentSidebar } from '@/components/ContentSidebar';
import { HolidayContentNavigation } from './HolidayContentNavigation';

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
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
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

  const currentTask = tasks[currentTaskIndex];

  const handleCopy = (content: string) => {
    if (!content) return;
    const cleanContent = content.replace(/<[^>]*>/g, '').replace(/\\n/g, '\n').trim();
    navigator.clipboard.writeText(cleanContent);
    toast.success('Content copied to clipboard');
  };

  const handleEdit = (task: any) => {
    setSelectedTask(task);
    setShowContentSidebar(true);
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this content?')) return;

    try {
      const { error } = await supabase
        .from('content_tasks')
        .delete()
        .eq('id', taskId);

      if (error) {
        toast.error('Failed to delete content');
      } else {
        toast.success('Content deleted successfully');
        await fetchHolidayContent();
        if (onTaskUpdate) onTaskUpdate();
        
        // Adjust current index if needed
        if (currentTaskIndex >= tasks.length - 1 && currentTaskIndex > 0) {
          setCurrentTaskIndex(currentTaskIndex - 1);
        }
      }
    } catch (error) {
      toast.error('Failed to delete content');
    }
  };

  const handlePrevious = () => {
    setCurrentTaskIndex(prev => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentTaskIndex(prev => Math.min(tasks.length - 1, prev + 1));
  };

  const handleContentSidebarClose = () => {
    setShowContentSidebar(false);
    setSelectedTask(null);
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

          {currentTask && (
            <div className="space-y-6">
              {/* Navigation */}
              {tasks.length > 1 && (
                <HolidayContentNavigation
                  currentIndex={currentTaskIndex}
                  totalItems={tasks.length}
                  onPrevious={handlePrevious}
                  onNext={handleNext}
                />
              )}

              {/* Content Display */}
              <div className="border rounded-lg p-6 bg-card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="capitalize">
                      {currentTask.post_type}
                    </Badge>
                    <Badge variant={currentTask.status === 'approved' ? 'default' : 'secondary'}>
                      {currentTask.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    {new Date(currentTask.created_at).toLocaleDateString()}
                  </div>
                </div>

                <div className="prose max-w-none mb-6">
                  <div 
                    className="whitespace-pre-wrap text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ 
                      __html: currentTask.ai_output || 'No content generated' 
                    }}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(currentTask.ai_output)}
                    className="flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Content
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(currentTask)}
                    className="flex items-center gap-2"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(currentTask.id)}
                    className="flex items-center gap-2 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          )}
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
