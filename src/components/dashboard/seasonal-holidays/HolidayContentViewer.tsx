
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ContentTaskItem } from '@/components/content/ContentTaskItem';
import { FileText, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface HolidayContentViewerProps {
  holidayId: string;
  holidayName: string;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdate?: () => void;
  onManualGeneration?: () => void;
}

export const HolidayContentViewer = ({
  holidayId,
  holidayName,
  isOpen,
  onClose,
  onTaskUpdate,
  onManualGeneration
}: HolidayContentViewerProps) => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleTaskUpdate = () => {
    fetchHolidayContent();
    if (onTaskUpdate) onTaskUpdate();
  };

  // Filter tasks with and without content
  const tasksWithContent = tasks.filter(task => task.ai_output && task.ai_output.trim() !== '');
  const tasksWithoutContent = tasks.filter(task => !task.ai_output || task.ai_output.trim() === '');

  // Group tasks by type for tabs
  const facebookTasks = tasks.filter(task => task.post_type === 'facebook');
  const instagramTasks = tasks.filter(task => task.post_type === 'instagram');
  const blogTasks = tasks.filter(task => task.post_type === 'blog');
  const videoTasks = tasks.filter(task => task.post_type === 'video');
  const newsletterTasks = tasks.filter(task => task.post_type === 'newsletter');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-2xl font-bold">
            Content for "{holidayName}"
          </DialogTitle>
          <DialogDescription>
            Review and manage your generated holiday content
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner size="lg" text="Loading holiday content..." />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="w-16 h-16 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No holiday content found</h3>
                <p className="text-gray-500 mb-6">Holiday content will be created when you generate content for this holiday.</p>
                {onManualGeneration && (
                  <Button onClick={onManualGeneration} className="bg-primary hover:bg-primary/90">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Holiday Content
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {tasksWithoutContent.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-amber-800">Missing Content</h4>
                        <p className="text-sm text-amber-700">
                          {tasksWithoutContent.length} content piece(s) need to be generated: {tasksWithoutContent.map(t => t.post_type).join(', ')}
                        </p>
                      </div>
                      {onManualGeneration && (
                        <Button 
                          onClick={onManualGeneration} 
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-700 text-white"
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          Generate Missing Content
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                <Tabs defaultValue="all" className="w-full">
                  <TabsList className="grid w-full grid-cols-6">
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="facebook">Facebook</TabsTrigger>
                    <TabsTrigger value="instagram">Instagram</TabsTrigger>
                    <TabsTrigger value="blog">Blog</TabsTrigger>
                    <TabsTrigger value="video">Video</TabsTrigger>
                    <TabsTrigger value="newsletter">Newsletter</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="all" className="space-y-4">
                    <div className="grid gap-4">
                      {tasks.map((task) => (
                        <ContentTaskItem 
                          key={task.id} 
                          task={task} 
                          onTaskUpdate={handleTaskUpdate}
                        />
                      ))}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="facebook" className="space-y-4">
                    <div className="grid gap-4">
                      {facebookTasks.map((task) => (
                        <ContentTaskItem 
                          key={task.id} 
                          task={task} 
                          onTaskUpdate={handleTaskUpdate}
                        />
                      ))}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="instagram" className="space-y-4">
                    <div className="grid gap-4">
                      {instagramTasks.map((task) => (
                        <ContentTaskItem 
                          key={task.id} 
                          task={task} 
                          onTaskUpdate={handleTaskUpdate}
                        />
                      ))}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="blog" className="space-y-4">
                    <div className="grid gap-4">
                      {blogTasks.map((task) => (
                        <ContentTaskItem 
                          key={task.id} 
                          task={task} 
                          onTaskUpdate={handleTaskUpdate}
                        />
                      ))}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="video" className="space-y-4">
                    <div className="grid gap-4">
                      {videoTasks.map((task) => (
                        <ContentTaskItem 
                          key={task.id} 
                          task={task} 
                          onTaskUpdate={handleTaskUpdate}
                        />
                      ))}
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="newsletter" className="space-y-4">
                    <div className="grid gap-4">
                      {newsletterTasks.map((task) => (
                        <ContentTaskItem 
                          key={task.id} 
                          task={task} 
                          onTaskUpdate={handleTaskUpdate}
                        />
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
