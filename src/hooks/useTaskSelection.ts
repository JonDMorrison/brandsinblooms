
import { useState, useCallback } from 'react';

interface Task {
  id: string;
  scheduled_date: string;
  post_type: string;
  status: string;
  ai_output?: string;
  campaigns?: {
    title: string;
  };
}

export const useTaskSelection = () => {
  const [selectedTasks, setSelectedTasks] = useState<Task[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);

  const toggleTaskSelection = useCallback((task: Task, isCtrlKey: boolean = false) => {
    if (!isCtrlKey && !selectionMode) {
      // First selection or single click - enter selection mode
      setSelectedTasks([task]);
      setSelectionMode(true);
      return;
    }

    setSelectedTasks(prev => {
      const isSelected = prev.some(t => t.id === task.id);
      if (isSelected) {
        const newSelection = prev.filter(t => t.id !== task.id);
        if (newSelection.length === 0) {
          setSelectionMode(false);
        }
        return newSelection;
      } else {
        return [...prev, task];
      }
    });
  }, [selectionMode]);

  const clearSelection = useCallback(() => {
    setSelectedTasks([]);
    setSelectionMode(false);
  }, []);

  const selectAllTasks = useCallback((tasks: Task[]) => {
    setSelectedTasks(tasks);
    setSelectionMode(true);
  }, []);

  const isTaskSelected = useCallback((task: Task) => {
    return selectedTasks.some(t => t.id === task.id);
  }, [selectedTasks]);

  return {
    selectedTasks,
    selectionMode,
    toggleTaskSelection,
    clearSelection,
    selectAllTasks,
    isTaskSelected
  };
};
