import React, { useState, useEffect, useCallback } from 'react';
import { CalendarGrid } from './calendar/CalendarGrid';
import { TaskModal } from './modals/TaskModal';
import { CampaignModal } from './modals/CampaignModal';
import { DateModal } from './modals/DateModal';
import { useCampaigns } from '@/contexts/CampaignContext';
import { useTasks } from '@/contexts/TaskContext';
import { Button } from '@/components/ui/button';
import { Plus, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast"
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/AuthContext';
import { useEnhancedDragAndDrop } from '@/hooks/useEnhancedDragAndDrop';

export const CalendarView = () => {
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [dateModalOpen, setDateModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<any | null>(null);
  const [currentWeek, setCurrentWeek] = useState<Date[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [bulkCompleteLoading, setBulkCompleteLoading] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const { campaigns, fetchCampaigns } = useCampaigns();
  const { tasks, fetchTasks, deleteTask, completeTask } = useTasks();
  const { toast } = useToast();
	const { user } = useUser();

  // Calculate the current week
  useEffect(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const startOfWeek = new Date(today.setDate(diff));

    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const nextDay = new Date(startOfWeek);
      nextDay.setDate(startOfWeek.getDate() + i);
      weekDays.push(nextDay);
    }
    setCurrentWeek(weekDays);
  }, []);

  // Fetch campaigns and tasks on mount
  useEffect(() => {
    if (user) {
      fetchCampaigns(user.id);
      fetchTasks(user.id);
    }
  }, [fetchCampaigns, fetchTasks, user]);

  // Handlers for opening modals
  const handleTaskClick = (task: any) => {
    setSelectedTask(task);
    setTaskModalOpen(true);
  };

  const handleCampaignClick = (campaign: any) => {
    setSelectedCampaign(campaign);
    setCampaignModalOpen(true);
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setDateModalOpen(true);
  };

  const handleCloseTaskModal = () => {
    setSelectedTask(null);
    setTaskModalOpen(false);
  };

  const handleCloseCampaignModal = () => {
    setSelectedCampaign(null);
    setCampaignModalOpen(false);
  };

  const handleCloseDateModal = () => {
    setSelectedDate(null);
    setDateModalOpen(false);
  };

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
        await completeTask(taskId);
      }));

      toast({
        title: "Tasks completed.",
        description: `${selectedTasks.length} tasks have been marked as complete.`,
      })
      setSelectedTasks([]);
      fetchTasks(user?.id); // Refresh tasks
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
        await deleteTask(taskId);
      }));

      toast({
        title: "Tasks deleted.",
        description: `${selectedTasks.length} tasks have been deleted.`,
      })
      setSelectedTasks([]);
      fetchTasks(user?.id); // Refresh tasks
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
  
  const {
    draggedTasks,
    isDragging,
    handleDragStart,
    handleDragEnd,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop
  } = useEnhancedDragAndDrop();

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
          <Button size="sm" onClick={() => setTaskModalOpen(true)}>
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
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          isDragging={isDragging}
          draggedTasks={draggedTasks}
        />
      </div>

      <TaskModal
        open={taskModalOpen}
        onClose={handleCloseTaskModal}
        selectedTask={selectedTask}
        fetchTasks={() => fetchTasks(user?.id)}
      />
      <CampaignModal
        open={campaignModalOpen}
        onClose={handleCloseCampaignModal}
        selectedCampaign={selectedCampaign}
        fetchCampaigns={() => fetchCampaigns(user?.id)}
      />
      <DateModal
        open={dateModalOpen}
        onClose={handleCloseDateModal}
        selectedDate={selectedDate}
      />
    </div>
  );
};
