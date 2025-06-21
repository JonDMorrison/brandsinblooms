import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { Loader2, Calendar, Sparkles } from 'lucide-react';
import { getPostTypeIcon } from '@/components/content/ContentViewerUtils';
import { getStatusBadgeVariant, getPlatformBadgeVariant, getStatusLabel, getPlatformLabel } from '@/utils/badgeUtils';
import { TaskContent } from '@/components/content/task-item/TaskContent';
import { TaskActions } from '@/components/content/task-item/TaskActions';
import { toast } from 'sonner';
import { HolidayContentNavigation } from './HolidayContentNavigation';

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

interface ContentSection {
  type: string;
  task: ContentTask | null;
  ref: React.RefObject<HTMLDivElement>;
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
  const [activeSection, setActiveSection] = useState('instagram');

  // Create refs for each content section
  const sectionRefs = {
    instagram: useRef<HTMLDivElement>(null),
    facebook: useRef<HTMLDivElement>(null),
    blog: useRef<HTMLDivElement>(null),
    video: useRef<HTMLDivElement>(null),
    newsletter: useRef<HTMLDivElement>(null)
  };

  const fetchHolidayTasks = async () => {
    if (!user || !holidayId) return;

    setLoading(true);
    try {
      console.log('🔍 HOLIDAY_VIEWER DEBUG: Fetching tasks for holiday:', holidayId);
      
      let data = null;
      let error = null;

      // Try tenant-based query first if tenant exists
      if (tenant) {
        console.log('🔍 HOLIDAY_VIEWER DEBUG: Trying tenant-based query with tenant:', tenant.id);
        const { data: tenantData, error: tenantError } = await supabase
          .from('content_tasks')
          .select('*')
          .eq('holiday_id', holidayId)
          .eq('tenant_id', tenant.id)
          .order('created_at', { ascending: false });

        if (tenantError) {
          console.warn('🔍 HOLIDAY_VIEWER DEBUG: Tenant-based task query failed, trying user-based:', tenantError);
        } else {
          data = tenantData;
          console.log('🔍 HOLIDAY_VIEWER DEBUG: Tenant query successful, found tasks:', data?.length || 0);
        }
      }

      // Fallback to user-based query if tenant query failed or no tenant
      if (!data) {
        console.log('🔍 HOLIDAY_VIEWER DEBUG: Trying user-based query with user:', user.id);
        const { data: userData, error: userError } = await supabase
          .from('content_tasks')
          .select('*')
          .eq('holiday_id', holidayId)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (userError) {
          console.error('🔍 HOLIDAY_VIEWER ERROR: User-based task query also failed:', userError);
          error = userError;
        } else {
          data = userData;
          console.log('🔍 HOLIDAY_VIEWER DEBUG: User query successful, found tasks:', data?.length || 0);
        }
      }

      if (error) {
        console.error('🔍 HOLIDAY_VIEWER ERROR: Error fetching holiday tasks:', error);
        toast.error('Failed to load holiday content');
        return;
      }

      console.log(`🔍 HOLIDAY_VIEWER DEBUG: Found ${data?.length || 0} tasks for holiday`);
      
      // Enhanced task logging
      if (data && data.length > 0) {
        data.forEach((task, index) => {
          console.log(`🔍 TASK_${index} DEBUG:`, {
            id: task.id,
            post_type: task.post_type,
            status: task.status,
            ai_output_length: task.ai_output?.length || 0,
            ai_output_preview: task.ai_output?.substring(0, 100) || 'No content',
            created_at: task.created_at
          });
          
          if (task.post_type === 'video') {
            console.log(`🎬 VIDEO_TASK DEBUG: Video task found with content length: ${task.ai_output?.length || 0}`);
            if (task.ai_output) {
              console.log(`🎬 VIDEO_TASK DEBUG: Video content preview: ${task.ai_output.substring(0, 300)}...`);
            } else {
              console.log(`🎬 VIDEO_TASK ERROR: Video task has no ai_output content!`);
            }
          }
        });
      } else {
        console.log('🔍 HOLIDAY_VIEWER DEBUG: No tasks found for this holiday');
      }
      
      setTasks(data || []);
    } catch (error) {
      console.error('🔍 HOLIDAY_VIEWER ERROR: Exception fetching holiday tasks:', error);
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

  const scrollToSection = (sectionType: string) => {
    const ref = sectionRefs[sectionType as keyof typeof sectionRefs];
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(sectionType);
    }
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

  // Enhanced logging for tasksByType
  console.log('🔍 HOLIDAY_VIEWER DEBUG: Tasks by type:', Object.keys(tasksByType));
  if (tasksByType.video) {
    console.log('🎬 VIDEO_DISPLAY DEBUG: Video task found in tasksByType:', {
      id: tasksByType.video.id,
      content_length: tasksByType.video.ai_output?.length || 0,
      status: tasksByType.video.status
    });
  } else {
    console.log('🎬 VIDEO_DISPLAY DEBUG: No video task found in tasksByType');
  }

  // Expected content types in preferred order
  const contentTypes = ['instagram', 'facebook', 'blog', 'video', 'newsletter'];
  const availableTypes = contentTypes.filter(type => tasksByType[type]);

  const renderContentSection = (type: string) => {
    const task = tasksByType[type];
    const isAvailable = !!task;

    return (
      <div 
        key={type}
        ref={sectionRefs[type as keyof typeof sectionRefs]}
        className="mb-12 scroll-mt-4"
      >
        {/* Section Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            {getPostTypeIcon(type)}
            <div>
              <h3 className="font-semibold capitalize text-xl text-gray-900">
                {getPlatformLabel(type)} Content
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={getPlatformBadgeVariant(type)}>
                  {getPlatformLabel(type)}
                </Badge>
                {isAvailable && (
                  <Badge variant={getStatusBadgeVariant(task.status)}>
                    {getStatusLabel(task.status)}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          {isAvailable && (
            <TaskActions
              task={task}
              onTaskUpdate={handleTaskUpdate}
              onEdit={handleTaskEdit}
            />
          )}
        </div>

        {/* Section Content */}
        <div className="min-h-[200px]">
          {isAvailable ? (
            <TaskContent
              task={task}
              onRetryGeneration={() => {}}
              retryingGeneration={false}
            />
          ) : (
            <div className="flex items-center justify-center py-12 bg-gray-50 rounded-lg">
              <div className="text-center">
                <Sparkles className="w-8 h-8 mx-auto mb-3 text-gray-400" />
                <p className="text-gray-500 font-medium">No {getPlatformLabel(type)} content available</p>
                <p className="text-gray-400 text-sm mt-1">Generate content for this holiday to see it here</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
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
        </DialogHeader>

        <div className="flex-1 flex min-h-0">
          {/* Navigation Sidebar */}
          <div className="flex-shrink-0 w-48 bg-gray-50 border-r">
            <HolidayContentNavigation
              contentTypes={contentTypes}
              tasksByType={tasksByType}
              activeSection={activeSection}
              onSectionClick={scrollToSection}
            />
          </div>

          {/* Main Content Area */}
          <div className="flex-1 min-h-0">
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-green-600" />
                  <p className="text-gray-500">Loading holiday content...</p>
                </div>
              </div>
            ) : availableTypes.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Sparkles className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500 text-lg font-medium">No content available yet</p>
                  <p className="text-gray-400 text-sm">Generate content for this holiday to see it here</p>
                </div>
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="p-6 space-y-0">
                  {contentTypes.map(renderContentSection)}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
