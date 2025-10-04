import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SequentialImageLoader } from '@/services/SequentialImageLoader';

interface Task {
  id: string;
  image_idea: string | null;
  image_url: string | null;
  image_generation_status: string | null;
  post_type: string;
}

/**
 * Hook to automatically queue AI image generation for tasks that need it
 */
export const useAutoImageGeneration = (tasks: Task[]) => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !tasks || tasks.length === 0) return;

    // Find tasks that need AI generation
    const tasksNeedingGeneration = tasks.filter(task => 
      task.id && 
      task.image_idea && 
      !task.image_url &&
      task.image_generation_status === 'pending'
    );

    if (tasksNeedingGeneration.length === 0) return;

    console.log('[AutoImageGeneration] Found', tasksNeedingGeneration.length, 'tasks needing AI generation');

    // Queue each task for AI generation
    tasksNeedingGeneration.forEach(task => {
      console.log('[AutoImageGeneration] Queuing task:', task.id, 'with prompt:', task.image_idea);
      
      SequentialImageLoader.addToQueue(
        task.image_idea!,
        'normal',
        task.id,
        user.id
      ).catch(error => {
        console.error('[AutoImageGeneration] Failed to queue task:', task.id, error);
      });
    });
  }, [tasks, user]);
};
