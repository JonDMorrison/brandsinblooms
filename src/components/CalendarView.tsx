
import React, { useState, useEffect } from 'react';
import { CalendarGrid } from './calendar/CalendarGrid';
import { Button } from '@/components/ui/button';
import { Plus, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast"
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDragAndDrop } from '@/hooks/useDragAndDrop';

export const CalendarView = ({ campaigns, tasks, onDataUpdate }: {
  campaigns: any[];
  tasks: any[];
  onDataUpdate: () => void;
}) => {
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [bulkCompleteLoading, setBulkCompleteLoading] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // Calculate the current week
  const [currentWeek, setCurrentWeek] = useState<Date>(new Date());

  useEffect(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(today.setDate(diff));
    setCurrentWeek(startOfWeek);
  }, []);

  // Use the simpler drag and drop hook
  const { handleDrop } = useDragAndDrop(onDataUpdate);

  // Task selection and bulk operations
  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const handleBulkComplete = async () => {
    if (selectedTasks.length === 0) {
      toast({
        title: "No tasks selected.",
        description: "Please select tasks to complete.",
      })
      return;
    }

    setBulkCompleteLoading(true);
    try {
      await Promise.all(selectedTasks.map(async (taskId) => {
        const { error } = await supabase
          .from('content_tasks')
          .update({ status: 'completed' })
          .eq('id', taskId);
        
        if (error) throw error;
      }));

      toast({
        title: "Tasks completed.",
        description: `${selectedTasks.length} tasks have been marked as complete.`,
      })
      setSelectedTasks([]);
      onDataUpdate();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error completing tasks.",
        description: "Failed to complete selected tasks. Please try again.",
      })
      console.error("Error completing tasks:", error);
    } finally {
      setBulkCompleteLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTasks.length === 0) {
      toast({
        title: "No tasks selected.",
        description: "Please select tasks to delete.",
      })
      return;
    }

    setBulkDeleteLoading(true);
    try {
      await Promise.all(selectedTasks.map(async (taskId) => {
        const { error } = await supabase
          .from('content_tasks')
          .delete()
          .eq('id', taskId);
        
        if (error) throw error;
      }));

      toast({
        title: "Tasks deleted.",
        description: `${selectedTasks.length} tasks have been deleted.`,
      })
      setSelectedTasks([]);
      onDataUpdate();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error deleting tasks.",
        description: "Failed to delete selected tasks. Please try again.",
      })
      console.error("Error deleting tasks:", error);
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  const handleTaskClick = (task: any) => {
    // TODO: Implement task modal
    console.log('Task clicked:', task);
  };

  const handleCampaignClick = (campaign: any) => {
    // TODO: Implement campaign modal
    console.log('Campaign clicked:', campaign);
  };

  const handleDateClick = (date: Date) => {
    // TODO: Implement date modal
    console.log('Date clicked:', date);
  };

  const isTaskSelected = (task: any) => {
    return selectedTasks.includes(task.id);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="border-b px-4 py-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Calendar</h2>
        <div className="flex gap-2">
          {selectedTasks.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkComplete}
                disabled={bulkCompleteLoading}
                className="text-green-600 hover:bg-green-50"
              >
                {bulkCompleteLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500"></div>
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Complete ({selectedTasks.length})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkDelete}
                disabled={bulkDeleteLoading}
                className="text-red-600 hover:bg-red-50"
              >
                {bulkDeleteLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
                ) : (
                  <XCircle className="w-4 h-4 mr-2" />
                )}
                Delete ({selectedTasks.length})
              </Button>
            </>
          )}
          <Button size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Task
          </Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <CalendarGrid
          campaigns={campaigns}
          tasks={tasks}
          currentWeek={currentWeek}
          onTaskClick={handleTaskClick}
          onCampaignClick={handleCampaignClick}
          onDateClick={handleDateClick}
          selectedTasks={selectedTasks}
          onDrop={handleDrop}
          isTaskSelected={isTaskSelected}
        />
      </div>
    </div>
  );
};
