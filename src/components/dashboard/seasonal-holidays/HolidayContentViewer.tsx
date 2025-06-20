
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ContentTaskItem } from "@/components/content/ContentTaskItem";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";

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
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchHolidayTasks = async () => {
    if (!holidayId || !isOpen || !user) {
      console.log('HolidayContentViewer: Skipping fetch - holidayId:', holidayId, 'isOpen:', isOpen, 'user:', !!user);
      return;
    }
    
    console.log('HolidayContentViewer: Starting fetch for holidayId:', holidayId, 'user:', user.id, 'tenant:', tenant?.id || 'none');
    setLoading(true);
    
    try {
      // Build query based on tenant vs user model (same logic as useSeasonalHolidays)
      let query = supabase
        .from('content_tasks')
        .select('*')
        .eq('holiday_id', holidayId)
        .order('created_at', { ascending: true });

      if (tenant?.id) {
        // Tenant-based access control
        query = query.eq('tenant_id', tenant.id);
        console.log('HolidayContentViewer: Using tenant-based query for tenant:', tenant.id);
      } else {
        // User-based access control
        query = query.eq('user_id', user.id);
        console.log('HolidayContentViewer: Using user-based query for user:', user.id);
      }

      const { data, error } = await query;

      console.log('HolidayContentViewer: Fetch result - data:', data?.length || 0, 'tasks, error:', error);

      if (error) {
        console.error('HolidayContentViewer: Error fetching tasks:', error);
        toast.error(`Failed to load holiday content: ${error.message}`);
        setTasks([]);
      } else {
        console.log('HolidayContentViewer: Successfully fetched', data?.length || 0, 'tasks for holiday', holidayId);
        console.log('HolidayContentViewer: Task details:', data?.map(t => ({
          id: t.id,
          post_type: t.post_type,
          status: t.status,
          user_id: t.user_id,
          tenant_id: t.tenant_id,
          holiday_id: t.holiday_id
        })));
        setTasks(data || []);
      }
    } catch (error) {
      console.error('HolidayContentViewer: Exception in fetchHolidayTasks:', error);
      toast.error('An unexpected error occurred loading holiday content');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('HolidayContentViewer: useEffect triggered - holidayId:', holidayId, 'isOpen:', isOpen, 'user:', !!user, 'tenant:', !!tenant);
    if (isOpen && holidayId && user) {
      fetchHolidayTasks();
    } else if (!isOpen) {
      // Reset state when dialog closes
      setTasks([]);
    }
  }, [holidayId, isOpen, user, tenant]);

  const handleTaskUpdate = () => {
    console.log('HolidayContentViewer: Task update requested');
    fetchHolidayTasks();
    if (onTaskUpdate) onTaskUpdate();
  };

  // Don't render if no authenticated user
  if (!user) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-2xl font-bold">
            {holidayName} Content
          </DialogTitle>
          <DialogDescription>
            Review and manage your generated content for {holidayName}
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
                <div className="text-6xl mb-4">🎉</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No content found</h3>
                <p className="text-gray-500">
                  Holiday content may still be generating or there was an issue creating it.
                </p>
                <div className="text-xs text-gray-400 mt-2">
                  Searching with: {tenant?.id ? `tenant_id: ${tenant.id}` : `user_id: ${user.id}`}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="text-sm text-gray-600 mb-4">
                  Found {tasks.length} content pieces for {holidayName}
                </div>

                <div className="grid gap-4">
                  {tasks.map((task) => (
                    <ContentTaskItem 
                      key={task.id} 
                      task={task} 
                      onTaskUpdate={handleTaskUpdate}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
