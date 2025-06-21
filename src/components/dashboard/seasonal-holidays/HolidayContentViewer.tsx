
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { Loader2, Calendar, Sparkles, X } from 'lucide-react';
import { getPostTypeIcon } from '@/components/content/ContentViewerUtils';
import { getStatusBadgeVariant, getPlatformBadgeVariant, getStatusLabel, getPlatformLabel } from '@/utils/badgeUtils';
import { TaskContent } from '@/components/content/task-item/TaskContent';
import { TaskActions } from '@/components/content/task-item/TaskActions';
import { toast } from 'sonner';

interface HolidayContentViewerProps {
  holidayId: string;
  holidayName: string;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdate?: () => void;
}

interface ContentTask {
  id: string;
  post_type: string;
  ai_output: string;
  status: string;
  created_at: string;
  notes?: string;
  image_idea?: string;
  hashtags?: string;
}

export const HolidayContentViewer = ({
  holidayId,
  holidayName,
  isOpen,
  onClose,
  onTaskUpdate
}: HolidayContentViewerProps) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [tasks, setTasks] = useState<ContentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState('instagram');

  const fetchHolidayTasks = async () => {
    if (!user || !tenant || !holidayId) return;

    setLoading(true);
    try {
      console.log('Fetching tasks for holiday:', holidayId);
      
      const { data, error } = await supabase
        .from('content_tasks')
        .select('*')
        .eq('holiday_id', holidayId)
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching holiday tasks:', error);
        toast.error('Failed to load holiday content');
        return;
      }

      console.log(`Found ${data?.length || 0} tasks for holiday`);
      setTasks(data || []);
      
      // Set first available tab as selected
      if (data && data.length > 0) {
        const availableTypes = data.map(task => task.post_type);
        const preferredOrder = ['instagram', 'facebook', 'blog', 'video', 'newsletter'];
        const firstAvailable = preferredOrder.find(type => availableTypes.includes(type));
        if (firstAvailable) {
          setSelectedTab(firstAvailable);
        }
      }
    } catch (error) {
      console.error('Exception fetching holiday tasks:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleTaskUpdate = () => {
    fetchHolidayTasks();
    if (onTaskUpdate) {
      onTaskUpdate();
    }
  };

  const handleTaskEdit = () => {
    // Placeholder for edit functionality
    toast.info('Edit functionality coming soon');
  };

  useEffect(() => {
    if (isOpen && holidayId) {
      fetchHolidayTasks();
    }
  }, [isOpen, holidayId, user, tenant]);

  const tasksByType = tasks.reduce((acc, task) => {
    acc[task.post_type] = task;
    return acc;
  }, {} as Record<string, ContentTask>);

  // Expected content types in preferred order
  const contentTypes = ['instagram', 'facebook', 'blog', 'video', 'newsletter'];
  const availableTypes = contentTypes.filter(type => tasksByType[type]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-green-100 to-blue-100 rounded-lg">
                <Calendar className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold">
                  {holidayName} Content Pack
                </DialogTitle>
                <p className="text-sm text-gray-500 mt-1">
                  {availableTypes.length} of 5 content pieces ready
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-green-600" />
              <p className="text-gray-500">Loading holiday content...</p>
            </div>
          </div>
        ) : availableTypes.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Sparkles className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500 text-lg font-medium">No content available yet</p>
              <p className="text-gray-400 text-sm">Generate content for this holiday to see it here</p>
            </div>
          </div>
        ) : (
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="flex-1 flex flex-col min-h-0">
            <div className="px-6 py-2 border-b bg-gray-50">
              <TabsList className="grid w-full grid-cols-5 bg-white">
                {contentTypes.map(type => {
                  const task = tasksByType[type];
                  const isAvailable = !!task;
                  
                  return (
                    <TabsTrigger 
                      key={type} 
                      value={type}
                      disabled={!isAvailable}
                      className="flex items-center gap-2 data-[state=active]:bg-green-50 data-[state=active]:text-green-700"
                    >
                      {getPostTypeIcon(type)}
                      <span className="hidden sm:inline capitalize">
                        {getPlatformLabel(type)}
                      </span>
                      {isAvailable && (
                        <Badge 
                          variant={getStatusBadgeVariant(task.status)}
                          className="ml-1 text-xs"
                        >
                          {getStatusLabel(task.status)}
                        </Badge>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            <div className="flex-1 min-h-0">
              {contentTypes.map(type => {
                const task = tasksByType[type];
                if (!task) return null;

                return (
                  <TabsContent 
                    key={type} 
                    value={type} 
                    className="h-full m-0 p-6 data-[state=active]:flex data-[state=active]:flex-col"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {getPostTypeIcon(type)}
                        <div>
                          <h3 className="font-semibold capitalize text-lg">
                            {getPlatformLabel(type)} Content
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={getPlatformBadgeVariant(type)}>
                              {getPlatformLabel(type)}
                            </Badge>
                            <Badge variant={getStatusBadgeVariant(task.status)}>
                              {getStatusLabel(task.status)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      
                      <TaskActions
                        task={task}
                        onTaskUpdate={handleTaskUpdate}
                        onEdit={handleTaskEdit}
                      />
                    </div>

                    <ScrollArea className="flex-1 pr-4">
                      <TaskContent
                        task={task}
                        onRetryGeneration={() => {}}
                        retryingGeneration={false}
                      />
                    </ScrollArea>
                  </TabsContent>
                );
              })}
            </div>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};
